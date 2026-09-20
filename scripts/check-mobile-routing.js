const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Release already containing iOS Build 6 consent, native bridge and API safeguards.
const BASELINE = '2eaf89cb1d91b511dc998666691cb64c71a22dbe';
const customerWeb = {
    isCustomer: true,
    experience: 'online',
    surface: 'web',
    platform: 'web',
    apiBase: '',
    features: { multiImagePreview: true, prioritizedPrompts: true }
};

function baselineFile(filename) {
    // Apply the same checkout filters (notably Windows CRLF) as the working tree.
    return execFileSync('git', ['cat-file', '--filters', `${BASELINE}:${filename}`], {
        cwd: root, maxBuffer: 16 * 1024 * 1024, windowsHide: true
    });
}

async function availablePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

function waitUntilReady(child, port) {
    return new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => finish(new Error('Local server startup timed out.')), 10000);
        const onData = chunk => {
            output = (output + chunk.toString()).slice(-4096);
            if (output.includes(`http://localhost:${port}`)) finish();
        };
        const onError = error => finish(error);
        const onExit = code => finish(new Error(`Local server exited before startup (${code}).`));
        function finish(error) {
            clearTimeout(timer);
            child.stdout.off('data', onData);
            child.off('error', onError);
            child.off('exit', onExit);
            if (error) reject(error);
            else resolve();
        }
        child.stdout.on('data', onData);
        child.once('error', onError);
        child.once('exit', onExit);
    });
}

async function withServer(verify) {
    const port = await availablePort();
    const child = spawn(process.execPath, ['index.js'], {
        cwd: root,
        env: {
            ...process.env,
            PORT: String(port),
            NODE_ENV: 'test',
            // Tests cannot initialize a real database or authenticate AI requests.
            DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/browser_isolation_smoke',
            OPENROUTER_API_KEY: '',
            JWT_SECRET: 'browser-isolation-smoke-only',
            ADMIN_SECRET: 'browser-isolation-smoke-only',
            IMAGE_HEALTH_TOKEN: ''
        },
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true
    });
    const base = `http://127.0.0.1:${port}`;
    async function request(route) {
        return fetch(`${base}${route}`, {
            headers: { 'X-Forwarded-Host': 'offgridtoolkit.ai' },
            redirect: 'manual',
            signal: AbortSignal.timeout(5000)
        });
    }
    async function page(route) {
        const response = await request(route);
        assert.equal(response.status, 200, `${route} must serve directly`);
        assert.equal(response.headers.get('location'), null, `${route} must retain its URL`);
        assert.match(response.headers.get('content-type') || '', /^text\/html\b/);
        return response.text();
    }
    try {
        await waitUntilReady(child, port);
        await verify({ base, request, page });
    } finally {
        child.kill();
    }
}

function pageConfig(html, route) {
    const matches = [...html.matchAll(/window\.OFFGRID_CONFIG\s*=\s*(\{[^\n]*\});<\/script>/g)];
    assert.equal(matches.length, 1, `${route} must inject exactly one experience config`);
    return JSON.parse(matches[0][1]);
}

function injectConfig(html, config) {
    return html.replace('</head>', `<script>window.OFFGRID_CONFIG = ${JSON.stringify(config)};</script>\n</head>`);
}

async function main() {
    let checks = 0;
    async function check(label, verify) {
        await verify();
        checks += 1;
        console.log(`PASS: ${label}`);
    }
    await withServer(async ({ base, request, page }) => {
        const mobileHtml = fs.readFileSync(path.join(root, 'mobile.html'), 'utf8');
        for (const route of ['/mobile', '/mobile/']) {
            await check(`${route} serves only the browser customer experience`, async () => {
                const html = await page(route);
                assert.deepEqual(pageConfig(html, route), customerWeb);
                assert.equal(html, injectConfig(mobileHtml, customerWeb));
            });
            await check(`${route} loads its separate browser stylesheet`, async () => {
                const html = await page(route);
                const stylesheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/);
                assert.ok(stylesheet, `${route} must link its stylesheet`);
                assert.equal(stylesheet[1], '/mobile.css?v=20260920');
                const url = new URL(stylesheet[1], `${base}${route}`);
                const response = await request(`${url.pathname}${url.search}`);
                assert.equal(response.status, 200);
                assert.match(response.headers.get('content-type') || '', /^text\/css\b/);
                assert.ok(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join(root, 'mobile.css'))));
            });
        }
        for (const query of [
            '?surface=app&platform=ios&apiBase=production',
            '?surface=app&platform=android&apiBase=production',
            '?surface=desktop&platform=windows&apiBase=https%3A%2F%2Fexample.com',
            '?surface=app&surface=web&platform=ios&platform=android&apiBase=production&apiBase=unknown',
        ]) {
            await check(`/mobile${query} cannot select native app mode or a remote API`, async () => {
                assert.deepEqual(pageConfig(await page(`/mobile${query}`), query), customerWeb);
            });
        }
        await check('/mobile preserves the optional single-image preview rollback', async () => {
            assert.deepEqual(pageConfig(await page('/mobile?preview=single-image'), '/mobile'), {
                ...customerWeb, features: { multiImagePreview: false, prioritizedPrompts: false }
            });
        });
        await check('duplicate preview options do not activate single-image rollback', async () => {
            assert.deepEqual(pageConfig(await page('/mobile?preview=single-image&preview=unknown'), '/mobile'), customerWeb);
        });
        for (const route of ['/mobile/ready-made-prompts', '/mobile/ready-made-prompts/']) {
            await check(`${route} serves the browser prompt page`, async () => {
                assert.equal(await page(route), fs.readFileSync(path.join(root, 'mobile-ready-made-prompts.html'), 'utf8'));
            });
        }
        await check('the root keeps its existing prospect page', async () => {
            assert.equal(await page('/'), baselineFile('index.html').toString('utf8'));
        });
    });
    console.log(`Browser routing checks passed (${checks}/${checks}).`);
}

module.exports = { BASELINE, root, customerWeb, baselineFile, injectConfig, withServer };
if (require.main === module) {
    main().catch(error => {
        console.error(`FAIL: ${error.message}`);
        process.exitCode = 1;
    });
}

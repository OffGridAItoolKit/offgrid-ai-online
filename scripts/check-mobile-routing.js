const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { outsideDesktopKBSave } = require('./kb-save-release-scope');

const root = path.resolve(__dirname, '..');
// Pin the deployed source immediately before the field-guide formatting change.
const BASELINE = '53c9e18a954dd5564d073bb75452b8acc7f71c14';
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
    await withServer(async ({ request, page }) => {
        for (const route of ['/mobile', '/mobile/', '/mobile?surface=app&platform=ios']) {
            await check(`${route} sends QR visitors to the FieldGuide download page`, async () => {
                const response = await request(route);
                assert.equal(response.status, 302);
                assert.equal(response.headers.get('location'), 'https://offgridai.guide/');
            });
        }
        for (const platform of ['ios', 'android']) {
            const route = `/online?surface=app&platform=${platform}`;
            await check(`${platform} retains its native app entry point`, async () => {
                const config = pageConfig(await page(route), route);
                assert.equal(config.surface, 'app');
                assert.equal(config.platform, platform);
            });
        }
        for (const route of ['/mobile/ready-made-prompts', '/mobile/ready-made-prompts/']) {
            await check(`${route} serves the browser prompt page`, async () => {
                assert.equal(await page(route), fs.readFileSync(path.join(root, 'mobile-ready-made-prompts.html'), 'utf8'));
            });
        }
        await check('the root keeps its prospect page outside the tested desktop KB save functions', async () => {
            assert.equal(outsideDesktopKBSave(await page('/')), outsideDesktopKBSave(baselineFile('index.html').toString('utf8')));
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

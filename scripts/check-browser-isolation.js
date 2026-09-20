const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { BASELINE, root, customerWeb, baselineFile, injectConfig, withServer } = require('./check-mobile-routing');

// These files implement the store apps, their policies and their shared backend.
// A browser-only change must not rewrite any of them.
const protectedPaths = [
    'index.html', 'offgridai.css', 'ready-made-prompts.html', 'ready-made-prompts-online.js',
    'mobile-app', 'vendor', 'package-lock.json', 'license-system.js', 'lib', 'server',
    'image-studio.html', 'image-studio-app.html', 'privacy.html', 'data-deletion.html'
];

function protectedFiles() {
    return execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', BASELINE, '--', ...protectedPaths], {
        cwd: root, windowsHide: true
    }).toString('utf8').split('\0').filter(Boolean);
}

function outsideBrowserRouting(source) {
    const normalized = source.replace(/\r\n/g, '\n');
    const helper = /^function serveWithExperience\([^\n]*\) \{[\s\S]*?^\}\n/m;
    assert.ok(helper.test(normalized), 'Experience helper must exist');
    let remainder = normalized.replace(helper, '// EXPERIENCE_HELPER\n');
    // Only the two browser routes and their directly preceding comments may differ.
    remainder = remainder.replace(/(?:^\/\/[^\n]*\n)*^app\.get\('\/mobile(?:\/ready-made-prompts)?', \(req, res\) => \{[\s\S]*?^\}\);\n(?:\n)?/gm, '');
    return remainder;
}

function originalExperienceHelper(source) {
    const helper = source.replace(/\r\n/g, '\n').match(/^function serveWithExperience\([^\n]*\) \{[\s\S]*?^\}\n/m);
    assert.ok(helper, 'Experience helper must exist');
    return helper[0]
        .replace("isCustomer, htmlFilename = 'index.html')", 'isCustomer)')
        .replace("path.join(__dirname, htmlFilename)", "path.join(__dirname, 'index.html')")
        .replace('        // The QR browser release never opts into native app or iOS API behavior.\n', '')
        .replace("        const isBrowserRelease = htmlFilename === 'mobile.html';\n", '')
        .replaceAll('!isBrowserRelease && ', '');
}

async function main() {
    let checks = 0;
    async function check(label, verify) {
        await verify();
        checks += 1;
        console.log(`PASS: ${label}`);
    }
    await check(`store app, policy, native and backend files match release ${BASELINE.slice(0, 7)}`, () => {
        const files = protectedFiles();
        assert.ok(files.length > 100, 'Protection manifest unexpectedly shrank');
        for (const filename of files) {
            assert.ok(fs.readFileSync(path.join(root, filename)).equals(baselineFile(filename)),
                `${filename} differs from the pinned release`);
        }
        const changed = execFileSync('git', ['diff', '--name-only', BASELINE, '--', ...protectedPaths], {
            cwd: root, windowsHide: true
        }).toString('utf8').trim();
        assert.equal(changed, '', 'Protected tracked files must have no staged or unstaged changes');
        console.log(`  Preserved ${files.length} protected files including both native platforms.`);
    });
    await check('server code outside browser routing is unchanged', () => {
        const current = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
        assert.equal(outsideBrowserRouting(current), outsideBrowserRouting(baselineFile('index.js').toString('utf8')),
            'Backend, existing route registration or server policy changed');
        assert.equal(originalExperienceHelper(current), originalExperienceHelper(baselineFile('index.js').toString('utf8')),
            'Shared experience helper changed beyond browser file selection and native-mode exclusion');
    });
    await withServer(async ({ request, page }) => {
        const originalHtml = baselineFile('index.html').toString('utf8');
        const onlineCases = [
            ['/online', customerWeb],
            ['/online/', customerWeb],
            ['/online?surface=app', { ...customerWeb, surface: 'app' }],
            ['/online?surface=app&platform=android', { ...customerWeb, surface: 'app', platform: 'android' }],
            ['/online?surface=app&platform=ios', { ...customerWeb, surface: 'app', platform: 'ios' }],
            ['/online?surface=app&platform=ios&apiBase=production', { ...customerWeb, surface: 'app', platform: 'ios', apiBase: 'https://offgridtoolkit.ai' }],
            ['/online?surface=app&platform=android&apiBase=production', { ...customerWeb, surface: 'app', platform: 'android', apiBase: 'https://offgridtoolkit.ai' }],
            ['/online?surface=app&platform=ios&preview=single-image', {
                ...customerWeb, surface: 'app', platform: 'ios', features: { multiImagePreview: false, prioritizedPrompts: false }
            }],
            ['/online?surface=app&surface=web&platform=ios&platform=android&apiBase=production&apiBase=unknown', customerWeb]
        ];
        for (const [route, config] of onlineCases) {
            await check(`${route} returns the exact release page and config`, async () => {
                assert.equal(await page(route), injectConfig(originalHtml, config));
            });
        }
        const assets = [
            ['/offgridai.css?v=6.6', 'offgridai.css'],
            ['/online/ready-made-prompts', 'ready-made-prompts.html'],
            ['/online/ready-made-prompts?surface=app&platform=ios', 'ready-made-prompts.html'],
            ['/online/ready-made-prompts?surface=app&platform=android', 'ready-made-prompts.html'],
            ['/command/ready-made-prompts', 'ready-made-prompts.html'],
            ['/ready-made-prompts-online.js', 'ready-made-prompts-online.js'],
            ['/vendor/marked.umd.js', 'vendor/marked.umd.js'],
            ['/vendor/purify.min.js', 'vendor/purify.min.js'],
            ['/vendor/qrcode.min.js', 'vendor/qrcode.min.js'],
            ['/image-studio', 'image-studio-app.html'],
            ['/privacy', 'privacy.html'],
            ['/data-deletion', 'data-deletion.html']
        ];
        for (const [route, filename] of assets) {
            await check(`${route} returns its exact release bytes`, async () => {
                const response = await request(route);
                assert.equal(response.status, 200);
                assert.ok(Buffer.from(await response.arrayBuffer()).equals(baselineFile(filename)),
                    `${route} content changed`);
            });
        }
    });
    console.log(`Browser isolation checks passed (${checks}/${checks}) against ${BASELINE}.`);
}

async function checkLiveRelease() {
    // Opt-in, read-only HTTP checks. No AI requests, uploads, credentials or database calls.
    // Git blobs use the LF line endings sent by the Linux production deployment.
    const rawFile = filename => execFileSync('git', ['show', `${BASELINE}:${filename}`], {
        cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024
    });
    const originalHtml = rawFile('index.html').toString('utf8');
    const pages = [
        ['/online', customerWeb],
        ['/online?surface=app', { ...customerWeb, surface: 'app' }],
        ['/online?surface=app&platform=ios', { ...customerWeb, surface: 'app', platform: 'ios' }],
        ['/online?surface=app&platform=android', { ...customerWeb, surface: 'app', platform: 'android' }]
    ].map(([route, config]) => [route, Buffer.from(injectConfig(originalHtml, config), 'utf8')]);
    const assets = [
        ['/offgridai.css', 'offgridai.css'],
        ['/online/ready-made-prompts', 'ready-made-prompts.html'],
        ['/online/ready-made-prompts?surface=app&platform=ios', 'ready-made-prompts.html'],
        ['/online/ready-made-prompts?surface=app&platform=android', 'ready-made-prompts.html'],
        ['/ready-made-prompts-online.js', 'ready-made-prompts-online.js'],
        ['/vendor/marked.umd.js', 'vendor/marked.umd.js'],
        ['/vendor/purify.min.js', 'vendor/purify.min.js'],
        ['/vendor/qrcode.min.js', 'vendor/qrcode.min.js']
    ].map(([route, filename]) => [route, rawFile(filename)]);
    const hash = value => createHash('sha256').update(value).digest('hex');
    const results = await Promise.allSettled([...pages, ...assets].map(async ([route, expected]) => {
        const response = await fetch(`https://offgridtoolkit.ai${route}`, {
            redirect: 'manual', signal: AbortSignal.timeout(20000),
            headers: { 'Cache-Control': 'no-cache' }
        });
        assert.equal(response.status, 200, `LIVE ${route} did not return HTTP 200`);
        const actual = Buffer.from(await response.arrayBuffer());
        assert.ok(actual.equals(expected),
            `LIVE ${route} differs from ${BASELINE.slice(0, 7)}: expected sha256 ${hash(expected)}, received ${hash(actual)}`);
        return route;
    }));
    let failures = 0;
    for (const result of results) {
        if (result.status === 'fulfilled') console.log(`PASS: LIVE ${result.value} matches pinned release bytes`);
        else {
            failures += 1;
            console.error(`FAIL: ${result.reason.message}`);
        }
    }
    assert.equal(failures, 0, `${failures} live release checks failed; production baseline is NOT verified`);
    console.log(`Live release verification passed (${results.length}/${results.length}) against ${BASELINE}.`);
}

(process.argv.includes('--live') ? checkLiveRelease() : main()).catch(error => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
});

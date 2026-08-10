const { spawn } = require('child_process');
const path = require('path');

const port = 32109;
const root = path.resolve(__dirname, '..');
const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
});

let output = '';
let settled = false;

function finish(code, message) {
    if (settled) return;
    settled = true;
    child.kill();
    if (message) console.log(message);
    process.exitCode = code;
}

async function verify() {
    const primary = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { 'X-Forwarded-Host': 'offgridai.guide' }
    });
    const primaryHtml = await primary.text();
    if (primary.status !== 200 || !primaryHtml.includes('<title>OffGrid AI FieldGuide')) {
        throw new Error(`Primary landing response was unexpected (${primary.status}).`);
    }

    const video = await fetch(`http://127.0.0.1:${port}/assets/field-guide/walkthrough/create-a-field-guide-walkthrough.mp4`, {
        headers: {
            'X-Forwarded-Host': 'offgridai.guide',
            Range: 'bytes=0-31'
        }
    });
    if (video.status !== 206 || !String(video.headers.get('content-type')).startsWith('video/mp4')) {
        throw new Error(`Landing video asset response was unexpected (${video.status}, ${video.headers.get('content-type')}).`);
    }

    const robots = await fetch(`http://127.0.0.1:${port}/robots.txt`, {
        headers: { 'X-Forwarded-Host': 'offgridai.guide' }
    });
    const robotsText = await robots.text();
    if (robots.status !== 200 || !robotsText.includes('Sitemap: https://offgridai.guide/sitemap.xml')) {
        throw new Error(`robots.txt response was unexpected (${robots.status}).`);
    }

    const sitemap = await fetch(`http://127.0.0.1:${port}/sitemap.xml`, {
        headers: { 'X-Forwarded-Host': 'offgridai.guide' }
    });
    const sitemapText = await sitemap.text();
    if (sitemap.status !== 200 || !sitemapText.includes('<loc>https://offgridai.guide/</loc>')) {
        throw new Error(`sitemap.xml response was unexpected (${sitemap.status}).`);
    }

    const llms = await fetch(`http://127.0.0.1:${port}/llms.txt`, {
        headers: { 'X-Forwarded-Host': 'offgridai.guide' }
    });
    const llmsText = await llms.text();
    if (llms.status !== 200 || !llmsText.includes('# OffGrid AI FieldGuide')) {
        throw new Error(`llms.txt response was unexpected (${llms.status}).`);
    }

    const redirect = await fetch(`http://127.0.0.1:${port}/features`, {
        headers: { 'X-Forwarded-Host': 'offgridaifieldguide.com' },
        redirect: 'manual'
    });
    if (redirect.status !== 301 || redirect.headers.get('location') !== 'https://offgridai.guide/features') {
        throw new Error(`Redirect response was unexpected (${redirect.status}, ${redirect.headers.get('location')}).`);
    }

    finish(0, 'Landing host smoke checks passed (6/6).');
}

child.stdout.on('data', (chunk) => {
    output += chunk.toString();
    if (output.includes(`http://localhost:${port}`)) {
        verify().catch((error) => finish(1, `FAIL: ${error.message}`));
    }
});

child.stderr.on('data', (chunk) => {
    output += chunk.toString();
});

child.on('exit', (code) => {
    if (!settled) finish(1, `FAIL: Local server exited early (${code}).`);
});

setTimeout(() => finish(1, 'FAIL: Local server did not become ready in time.'), 10000).unref();

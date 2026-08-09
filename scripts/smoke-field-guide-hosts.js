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
    if (primary.status !== 200 || !primaryHtml.includes('<title>OffGrid AI Field Guide')) {
        throw new Error(`Primary landing response was unexpected (${primary.status}).`);
    }

    const redirect = await fetch(`http://127.0.0.1:${port}/features`, {
        headers: { 'X-Forwarded-Host': 'offgridaifieldguides.com' },
        redirect: 'manual'
    });
    if (redirect.status !== 301 || redirect.headers.get('location') !== 'https://offgridai.guide/features') {
        throw new Error(`Redirect response was unexpected (${redirect.status}, ${redirect.headers.get('location')}).`);
    }

    finish(0, 'Landing host smoke checks passed (2/2).');
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

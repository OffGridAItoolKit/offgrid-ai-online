'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { withServer, root } = require('./check-mobile-routing');
const baseline = '640daa7';
const original = file => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, windowsHide: true }).toString('utf8').replace(/\r\n/g, '\n');
const stripConfig = html => html.replace(/<script>window\.OFFGRID_CONFIG = [^\n]*;<\/script>\n/, '').replace(/\r\n/g, '\n');
async function main() {
    let count = 0;
    await withServer(async ({ page, request }) => {
        for (const route of ['/', '/online', '/online?surface=app', '/online?surface=app&platform=ios', '/online?surface=app&platform=android']) {
            assert.equal(stripConfig(await page(route)), original('index.html'), route);
            console.log(`PASS ${route}: current release page preserved`); count++;
        }
        assert.equal(stripConfig(await page('/mobile')), original('mobile.html')); count++;
        for (const file of ['offgridai.css', 'mobile.css', 'ready-made-prompts.html', 'mobile-ready-made-prompts.html', 'privacy.html', 'image-studio.html']) {
            const response = await request(`/${file}`); assert.equal(response.status, 200);
            assert.equal((await response.text()).replace(/\r\n/g, '\n'), original(file), file); count++;
        }
        const studio = await page('/image-studio');
        assert.equal(studio, fs.readFileSync(path.join(root, 'image-studio-app.html'), 'utf8'));
        assert.match(studio, /Create an image/); count++;
        const helper = await request('/assets/image-studio-flow.js'); assert.equal(helper.status, 200);
        assert.equal(await helper.text(), fs.readFileSync(path.join(root, 'assets/image-studio-flow.js'), 'utf8')); count++;
    });
    console.log(`Standalone release HTTP checks passed (${count}/${count}) against ${baseline}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

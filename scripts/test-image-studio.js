'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const flow = require('../assets/image-studio-flow');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'image-studio-app.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
function harness({ failImage = false, pending = false, payload = null } = {}) {
    const elements = new Map(), calls = [], writes = [], timers = [];
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', disabled: false,
            classList: { add() {}, remove() {} }, setAttribute() {}, focus() {}, scrollIntoView() {} });
        return elements.get(id);
    };
    element('visualCategory').value = 'other'; element('visualFormat').value = 'auto'; element('categoryInput').value = 'Other';
    const listeners = {};
    const context = vm.createContext({
        ImageStudioFlow: flow, console: { log() {}, warn() {}, error() {} }, URL, URLSearchParams, Blob, Uint8Array,
        atob, btoa, escape, decodeURIComponent, Date,
        localStorage: { getItem: () => null, removeItem() {} },
        sessionStorage: { getItem: () => payload ? JSON.stringify(payload) : null, removeItem() {} },
        window: { location: { origin: 'http://localhost', search: '' },
            showDirectoryPicker: async () => ({ getFileHandle: async name => ({ createWritable: async () => ({ write: async blob => writes.push({ name, blob }), close: async () => {} }) }) }) },
        document: { getElementById: element, querySelector: () => element('composer'), querySelectorAll: () => [...elements.values()],
            createElement: () => ({ set textContent(value) { this.innerHTML = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); } }),
            addEventListener: (name, fn) => { listeners[name] = fn; } },
        setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
        fetch: async (url, options) => {
            calls.push({ url, body: JSON.parse(options.body || '{}') });
            if (pending) await new Promise(() => {});
            const image = url.endsWith('generate-image');
            return { ok: !(image && failImage), json: async () => image
                ? (failImage ? { success: false, error: 'Fixture failure' } : { success: true, image: 'data:image/png;base64,aGVsbG8=' })
                : { success: true, prompt: 'Crafted diagram with exact labels' } };
        }
    });
    vm.runInContext(script, context);
    vm.runInContext('applyOffGridImageWatermark = async image => image; createImageDisplayUrl = () => "blob:fixture"; revokeObjectUrl = () => {};', context);
    return { context, element, calls, writes, timers, listeners, run: code => vm.runInContext(code, context) };
}
test('standalone ideas use category-specific crafting; article requests retain the established contract', () => {
    const standalone = flow.promptRequest({ mode: 'create', request: 'A camp kitchen', category: 'adventure', format: 'landscape' });
    assert.equal(standalone.endpoint, '/api/image-studio/craft-prompt');
    assert.equal(standalone.body.category, 'adventure');
    assert.match(standalone.body.description, /16:9/);
    const article = flow.promptRequest({ mode: 'article', request: 'Original source', category: 'Other', format: 'auto' });
    assert.deepEqual(article.body, { conversationContext: 'Original source', category: 'Other' });
    assert.equal(flow.imagePrompt('Original model prompt', 'article', 'auto'), 'Original model prompt');
});
test('sample cards fill the composer without calling an API', () => {
    const h = harness(); h.run('usePreset(1, 0)');
    assert.match(h.element('visualInput').value, /chicken coop/);
    assert.equal(h.element('visualCategory').value, 'homestead'); assert.equal(h.calls.length, 0);
});
test('craft, edit, generate reuses the edited prompt and keeps source text in KB', async () => {
    const h = harness(); h.element('visualInput').value = 'My camp kitchen';
    await h.run('craftPrompt()'); assert.equal(h.calls.length, 1);
    h.element('craftedPrompt').value = 'My edited prompt';
    await h.run('createImage()'); assert.equal(h.calls.length, 2);
    assert.match(h.calls[1].body.prompt, /^My edited prompt/);
    assert.match(h.run('current.markdown'), /My camp kitchen/);
    assert.doesNotMatch(h.run('current.markdown'), /My edited prompt|Do not invent/);
});
test('changing layout invalidates an old prompt and crafts again', async () => {
    const h = harness(); h.element('visualInput').value = 'A diagram';
    await h.run('craftPrompt()'); h.element('visualFormat').value = 'phone'; h.run('invalidatePrompt()');
    await h.run('createImage()'); assert.equal(h.calls.length, 3);
    assert.match(h.calls[2].body.prompt, /4:5/);
});
test('a direct prompt can generate without a separate description or crafting call', async () => {
    const h = harness(); h.element('craftedPrompt').value = 'A watercolor of a cabin';
    await h.run('createImage()'); assert.equal(h.calls.length, 1);
    assert.ok(h.calls[0].url.endsWith('generate-image'));
});
test('article handoff auto-generates through visual-prompt and preserves complete source', async () => {
    const source = 'Article text '.repeat(450);
    const h = harness({ payload: { answer: source, title: 'Article', category: 'Water & Food' } });
    h.listeners.DOMContentLoaded(); await h.timers.shift()();
    assert.ok(h.calls[0].url.endsWith('visual-prompt'));
    assert.equal(h.calls[0].body.conversationContext, source.trim());
    assert.equal(h.calls[0].body.category, 'Water & Food');
    assert.equal(h.calls[1].body.prompt, 'Crafted diagram with exact labels');
    assert.ok(h.run('current.markdown').includes(source.trim()));
});
test('busy generation prevents duplicate requests, reset and preset mutation', async () => {
    const h = harness({ pending: true }); h.element('visualInput').value = 'Keep this request';
    h.run('createImage()'); await h.run('createImage()'); h.run('clearStudio(); usePreset(0, 0); setStudioMode("article")');
    assert.equal(h.calls.length, 1); assert.equal(h.element('visualInput').value, 'Keep this request');
    assert.equal(h.run('studioMode'), 'create');
});
test('failed regeneration retains the previous savable image', async () => {
    const h = harness({ failImage: true }); h.element('visualInput').value = 'New diagram';
    h.run('current = { title: "Previous", image: "data:image/png;base64,aGVsbG8=", markdown: "previous article", imageFilename: "previous.png" }');
    await h.run('createImage()'); assert.equal(h.run('current.title'), 'Previous');
    assert.equal(h.run('studioBusy'), false); assert.match(h.element('stage').innerHTML, /Previous/);
});
test('KB export writes the source and relative image as a pair', async () => {
    const h = harness(); h.element('visualInput').value = 'An equipment checklist';
    await h.run('createImage()'); await h.run('saveToKnowledgeBase()');
    assert.equal(h.writes.length, 2);
    const md = h.writes.find(w => w.name.endsWith('.md'));
    const png = h.writes.find(w => w.name.endsWith('.png'));
    assert.ok((await md.blob.text()).includes(png.name));
    assert.ok((await md.blob.text()).includes('An equipment checklist'));
});
test('anonymous and unavailable allowance never invent a remaining balance', async () => {
    const h = harness(); await h.run('refreshImageUsage()');
    assert.doesNotMatch(h.element('imageUsagePill').textContent, /10 \/ 10/);
});
test('shared backend, mobile apps, article handoff and saving code are unchanged from the starting release', () => {
    const protectedPaths = ['index.js', 'index.html', 'mobile.html', 'offgridai.css', 'mobile.css', 'mobile-app', 'lib', 'server', 'license-system.js', 'privacy.html', 'image-studio.html', 'package-lock.json'];
    const changes = execFileSync('git', ['diff', '--name-only', '640daa7', '--', ...protectedPaths], { cwd: root, windowsHide: true }).toString().trim();
    assert.equal(changes, '');
});

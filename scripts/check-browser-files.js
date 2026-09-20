'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'mobile.html'), 'utf8');
const themeKeyDeclaration = html.match(/const APP_THEME_STORAGE_KEY = '([^']+)';/);
assert.ok(themeKeyDeclaration, 'Browser theme storage key is missing');
assert.equal(themeKeyDeclaration[1], 'offgrid-fieldguide-browser-theme', 'Browser preferences must be isolated from the installed app');
const functionNames = [
    'getBottomInputBarHTML',
    'getPreferredAppTheme', 'setAppTheme',
    'parseNativeBridgeResult', 'requestOpenSavedGuides', 'openSavedGuides',
    'showAppPdfPreview', 'printAppPdfPreview', 'shareAppPdfPreview'
];
const source = themeKeyDeclaration[0] + '\n' + functionNames.map(name => {
    const start = html.indexOf(`        function ${name}(`);
    assert.notEqual(start, -1, `Missing ${name}`);
    const end = html.indexOf('\n        function ', start + 1);
    assert.notEqual(end, -1, `Missing function boundary after ${name}`);
    return html.slice(start, end);
}).join('\n');

function harness({ native = null, app = false, customer = true, recorded = false, dialogSupported = true, preferences = {} } = {}) {
    const toasts = [];
    const createdUrls = [];
    const revokedUrls = [];
    const pageListeners = new Map();
    const storage = new Map(Object.entries(preferences));
    const storageReads = [];
    let prints = 0;
    let uploads = 0;
    let recordReads = 0;
    let doc;

    class Element {
        constructor(tag) {
            this.tagName = tag;
            this.children = [];
            this.attributes = {};
            this.events = new Map();
            this.style = {};
            this.classList = { add() {}, remove() {}, toggle() {} };
            this.hidden = false;
            if (tag === 'dialog' && !dialogSupported) this.showModal = undefined;
        }
        get isConnected() { return this === doc.body || Boolean(this.parent?.isConnected); }
        append(...children) {
            children.forEach(child => { child.parent = this; this.children.push(child); });
        }
        appendChild(child) { this.append(child); return child; }
        remove() {
            if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
            this.parent = null;
        }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; delete this[name]; }
        addEventListener(name, callback) {
            const callbacks = this.events.get(name) || [];
            callbacks.push(callback);
            this.events.set(name, callbacks);
        }
        async emit(name) {
            await Promise.all((this.events.get(name) || []).map(callback => callback({ target: this })));
        }
        querySelector(tag) { return this.children.find(child => child.tagName === tag); }
        querySelectorAll() { return []; }
        focus() { doc.activeElement = this; }
        showModal() { this.open = true; }
        close() { this.open = false; return this.emit('close'); }
    }

    doc = {
        body: new Element('body'),
        activeElement: null,
        createElement: tag => new Element(tag),
        getElementById(id) {
            const find = element => element.id === id ? element : element.children.map(find).find(Boolean);
            return find(this.body) || null;
        }
    };
    const opener = new Element('button');
    doc.body.append(opener);
    opener.focus();
    const context = vm.createContext({
        document: doc,
        window: {
            OffGridNative: native,
            print: () => { prints += 1; },
            addEventListener: (name, callback) => pageListeners.set(name, callback),
            removeEventListener: name => pageListeners.delete(name)
        },
        IS_APP_SURFACE: app,
        IS_PHONE_SURFACE: customer || app,
        MULTI_IMAGE_PREVIEW_ENABLED: true,
        CONFIG: { isCustomer: customer },
        IS_IOS_APP: false,
        localStorage: {
            getItem: key => { storageReads.push(key); return storage.get(key) ?? null; },
            setItem: (key, value) => storage.set(key, value)
        },
        hasSavedGuideRecord: () => { recordReads += 1; return recorded; },
        markSavedGuideAvailable() {},
        closeAppPdfPreview() {},
        openSavedPdfFromPhone() {},
        showSaveToast: (...args) => toasts.push(args),
        generateFilename: () => 'test-guide.md',
        escapeHtml: value => value,
        Blob,
        URL: {
            createObjectURL(blob) {
                const url = `blob:test-${createdUrls.length + 1}`;
                createdUrls.push({ url, blob });
                return url;
            },
            revokeObjectURL: url => revokedUrls.push(url)
        },
        // Selecting and opening a guide must never contact the server.
        fetch: () => { uploads += 1; throw new Error('Unexpected upload'); },
        DOMParser: class {
            parseFromString(value) { return { querySelectorAll: () => [], body: { innerHTML: value } }; }
        },
        appPdfPreviewPayload: null
    });
    vm.runInContext(source, context, { filename: 'mobile.html browser-file functions' });
    return {
        context, doc, opener, toasts, createdUrls, revokedUrls, pageListeners, storage, storageReads,
        get prints() { return prints; },
        get uploads() { return uploads; },
        get recordReads() { return recordReads; }
    };
}

function fakePdf(name = 'field-guide.pdf', header = '%PDF-1.7\n') {
    return { name, size: header.length, slice: () => ({ text: async () => header }) };
}

async function run() {
    const freshTheme = harness();
    assert.equal(freshTheme.context.getPreferredAppTheme(), 'night', 'First browser visit should use dark mode');
    const savedTheme = harness({ preferences: { 'offgrid-fieldguide-browser-theme': 'day', 'offgrid-toolkit-theme': 'night' } });
    assert.equal(savedTheme.context.getPreferredAppTheme(), 'day', 'An explicit browser day preference should be respected');
    savedTheme.context.setAppTheme('night');
    assert.equal(savedTheme.storage.get('offgrid-fieldguide-browser-theme'), 'night');
    assert.equal(savedTheme.storage.get('offgrid-toolkit-theme'), 'night');
    const nativePreference = harness({ preferences: { 'offgrid-toolkit-theme': 'day' } });
    assert.equal(nativePreference.context.getPreferredAppTheme(), 'night', 'Installed-app preference must not determine browser theme');
    nativePreference.context.setAppTheme('night');
    assert.equal(nativePreference.storage.get('offgrid-toolkit-theme'), 'day', 'Browser theme changes must not overwrite installed-app preference');
    assert.deepEqual(nativePreference.storageReads, ['offgrid-fieldguide-browser-theme']);
    console.log('PASS fresh dark theme, saved day preference, and isolated browser theme storage');
    const web = harness();
    const browserInput = web.context.getBottomInputBarHTML();
    assert.match(browserInput, /<button[^>]+onclick="exportAsPDF\(\)"[^>]*>Save \/ Print PDF<\/button>/,
        'Customer browser must be able to save a text-only conversation');
    assert.doesNotMatch(harness({ app: true }).context.getBottomInputBarHTML(), /onclick="exportAsPDF\(\)"/,
        'Native app must retain its existing input actions');
    const demoInput = harness({ customer: false }).context.getBottomInputBarHTML();
    assert.doesNotMatch(demoInput, /onclick="exportAsPDF\(\)"/);
    assert.match(demoInput, /onclick="handleSaveToKB\(\)"/,
        'Desktop demo must retain its original save action');
    console.log('PASS customer browser text PDF action and unchanged native/demo input actions');
    assert.equal(web.context.requestOpenSavedGuides(), true);
    assert.equal(web.recordReads, 0, 'Browser must not depend on native download record');
    const dialog = web.doc.getElementById('browserSavedGuides');
    const input = dialog.querySelector('input');
    const link = dialog.querySelector('a');
    const status = dialog.children.find(child => child.attributes.role === 'status');
    assert.equal(dialog.open, true);
    assert.equal(dialog.attributes['aria-labelledby'], 'browserSavedGuidesTitle');
    assert.equal(input.accept, '.pdf,application/pdf');
    assert.equal(web.doc.activeElement, input);
    assert.equal(link.hidden, true, 'Open action must wait for a selection');
    assert.equal(web.context.openSavedGuides(), true);
    assert.equal(web.doc.body.children.filter(child => child.tagName === 'dialog').length, 1);

    input.files = [fakePdf()];
    await input.emit('change');
    assert.equal(link.hidden, false);
    assert.equal(link.href, 'blob:test-1');
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener');
    assert.equal(web.doc.activeElement, link);
    assert.equal(web.createdUrls[0].blob.type, 'application/pdf');
    assert.equal(web.uploads, 0);
    assert.match(status.textContent, /field-guide\.pdf/);

    input.files = [fakePdf('renamed.pdf', '<html>not a PDF</html>')];
    await input.emit('change');
    assert.equal(link.hidden, true);
    assert.equal(link.href, undefined);
    assert.match(status.textContent, /not a readable PDF/);
    assert.deepEqual(web.revokedUrls, ['blob:test-1']);

    input.files = [fakePdf('second.pdf')];
    await input.emit('change');
    await dialog.close();
    assert.deepEqual(web.revokedUrls, ['blob:test-1', 'blob:test-2']);
    assert.equal(web.doc.getElementById('browserSavedGuides'), null);
    assert.equal(web.pageListeners.size, 0);
    assert.equal(web.doc.activeElement, web.opener);
    console.log('PASS local PDF selection, validation, accessible open action, and URL cleanup');

    const pending = harness();
    pending.context.openSavedGuides();
    const pendingDialog = pending.doc.getElementById('browserSavedGuides');
    const pendingInput = pendingDialog.querySelector('input');
    let completeRead;
    pendingInput.files = [{ name: 'slow.pdf', size: 12, slice: () => ({ text: () => new Promise(resolve => { completeRead = resolve; }) }) }];
    const read = pendingInput.emit('change');
    await pendingDialog.close();
    completeRead('%PDF-1.7');
    await read;
    assert.equal(pending.createdUrls.length, 0, 'Closing during a read must not leak a Blob URL');
    console.log('PASS closing during an asynchronous file read');

    const failed = harness();
    failed.context.openSavedGuides();
    const failedDialog = failed.doc.getElementById('browserSavedGuides');
    const failedInput = failedDialog.querySelector('input');
    failedInput.files = [{ name: 'unreadable.pdf', size: 12, slice: () => { throw new Error('File unavailable'); } }];
    await failedInput.emit('change');
    assert.equal(failedDialog.querySelector('a').hidden, true);
    assert.match(failedDialog.children.find(child => child.attributes.role === 'status').textContent, /could not be opened/);
    failedInput.files = [];
    await failedInput.emit('change');
    assert.equal(failed.createdUrls.length, 0);
    await failed.pageListeners.get('pagehide')();
    assert.equal(failed.doc.getElementById('browserSavedGuides'), null);
    const unsupported = harness({ dialogSupported: false });
    assert.equal(unsupported.context.openSavedGuides(), false);
    assert.match(unsupported.toasts[0][1], /folder you chose/);
    console.log('PASS unreadable/cancelled files, page cleanup, and older-browser fallback');

    let nativePickerCalls = 0;
    const native = harness({ app: true, recorded: true, native: { openSavedGuides: () => { nativePickerCalls += 1; return '{"ok":true,"action":"pick-pdf"}'; } } });
    assert.equal(native.context.requestOpenSavedGuides(), true);
    assert.equal(nativePickerCalls, 1);
    assert.equal(native.doc.getElementById('browserSavedGuides'), null);
    const emptyNative = harness({ app: true, native: { openSavedGuides() {} } });
    assert.equal(emptyNative.context.requestOpenSavedGuides(), false);
    assert.equal(emptyNative.toasts[0][0], 'No saved guides recorded yet');
    const failedNative = harness({ app: true, native: { openSavedGuides: () => ({ ok: false, error: 'Picker unavailable' }) } });
    assert.equal(failedNative.context.openSavedGuides(), false);
    assert.equal(failedNative.toasts[0][1], 'Picker unavailable');
    console.log('PASS native Saved Guides behavior remains available');

    const preview = harness();
    preview.context.showAppPdfPreview('<p>Guide</p>', 'Guide', { type: 'image-studio' });
    assert.match(preview.doc.getElementById('appPdfPreview').innerHTML, /Save \/ Print PDF/);
    assert.doesNotMatch(preview.doc.getElementById('appPdfPreview').innerHTML, />Save Field Guide</);
    preview.context.shareAppPdfPreview();
    const prompt = preview.toasts.at(-1);
    assert.equal(prompt[0], 'Save the PDF before sharing');
    assert.match(prompt[1], /Save as PDF/);
    assert.doesNotMatch(prompt[1], /Android|app update|OffGrid AI/);
    prompt[3]();
    assert.equal(preview.prints, 1);
    console.log('PASS browser preview labels and Share PDF use the existing print flow');

    const oldNative = harness({ app: true, native: {} });
    oldNative.context.showAppPdfPreview('<p>Guide</p>', 'Guide', { type: 'image-studio' });
    oldNative.context.shareAppPdfPreview();
    assert.equal(oldNative.toasts.at(-1)[0], 'App update required for direct sharing');
    const iosFallback = harness({ app: true });
    iosFallback.context.showAppPdfPreview('<p>Guide</p>', 'Guide', { type: 'image-studio' });
    iosFallback.context.shareAppPdfPreview();
    assert.equal(iosFallback.toasts.at(-1)[0], 'Save the PDF before sharing');
    let shared = 0;
    const nativePreview = harness({ app: true, native: {
        saveFieldGuidePdf() {},
        shareFieldGuidePdf: () => { shared += 1; return { ok: true }; }
    } });
    nativePreview.context.showAppPdfPreview('<p>Guide</p>', 'Guide', { type: 'image-studio' });
    assert.match(nativePreview.doc.getElementById('appPdfPreview').innerHTML, />Save Field Guide</);
    nativePreview.context.shareAppPdfPreview();
    assert.equal(shared, 1);
    assert.match(nativePreview.toasts.at(-1)[1], /device’s share sheet/);
    console.log('PASS native save/share labels and older-native compatibility');
    console.log('Browser file checks passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });

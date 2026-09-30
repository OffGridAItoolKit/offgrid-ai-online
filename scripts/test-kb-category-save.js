'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { outsideDesktopKBSave } = require('./kb-save-release-scope');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['resolveKBDirectory', 'refreshKBFolderOptions', 'pickKBDirectory', 'confirmKBBundleOverwrite', 'writeKBBundle',
    'executeSave', 'generateMarkdownContent', 'extractBase64Images', 'dataUrlToBlob', 'generateFilename',
    'saveOnlineStudioToKnowledgeBase'];
function extract(name) {
    const start = html.search(new RegExp(`^        (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, `Missing ${name}`);
    const following = html.slice(start + 1).search(/^        (?:async )?function /m);
    assert.notEqual(following, -1, `Missing boundary after ${name}`);
    return html.slice(start, start + 1 + following);
}
const extracted = names.map(extract).join('\n');

function directory(name, children = {}, options = {}) {
    const calls = [];
    const files = new Map();
    return {
        name, kind: 'directory', calls, files,
        async getDirectoryHandle(child, settings) {
            calls.push(['directory', child, settings]);
            assert.ok(!settings?.create, 'A save must not create arbitrary folders');
            if (options.denied) throw Object.assign(new Error('Folder permission denied'), { name: 'NotAllowedError' });
            if (children[child]?.kind === 'directory') return children[child];
            throw Object.assign(new Error('Not found'), { name: 'NotFoundError' });
        },
        async *entries() {
            calls.push(['entries']);
            yield* Object.entries(children);
        },
        async getFileHandle(filename, settings) {
            if (!settings?.create) {
                calls.push(['lookup', filename]);
                if (options.failLookup) throw Object.assign(new Error('File permission denied'), { name: 'NotAllowedError' });
                if (!files.has(filename)) throw Object.assign(new Error('Not found'), { name: 'NotFoundError' });
                return { name: filename };
            }
            calls.push(['file', filename]);
            if (options.failWrite) throw new Error('Drive disconnected');
            return { createWritable: async () => ({
                write: async value => { files.set(filename, value); },
                close: async () => { calls.push(['closed', filename]); }
            }) };
        }
    };
}

function harness({ selected, pickerError, unsupported = false, overwrite = true } = {}) {
    const toasts = [], downloads = [], pickers = [], modalOptions = [], confirmations = [];
    let closed = 0, added = 0;
    const elements = Object.fromEntries(['saveTitle', 'saveCategory', 'saveTags', 'kbSaveFolderLabel',
        'kbChooseFolderBtn', 'kbWriteFilesBtn'].map(id => [id, {
        value: id === 'saveTitle' ? 'Shelter guide' : id === 'saveCategory' ? 'Other' : '',
        children: [], replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); }
    }]));
    const context = vm.createContext({
        window: unsupported ? {} : { confirm: message => {
            confirmations.push(message);
            return typeof overwrite === 'function' ? overwrite(message) : overwrite;
        }, showDirectoryPicker: async options => {
            pickers.push(options);
            if (pickerError) throw pickerError;
            return selected;
        } },
        document: {
            getElementById: id => elements[id] || null,
            createElement: tag => ({ tag, click() { downloads.push(this.download); } }),
            body: { appendChild() {}, removeChild() {} }
        },
        kbDirectoryHandle: null, kbDirectoryState: null, kbFolderBusy: false,
        conversationHistory: [
            { role: 'user', content: 'I need emergency shelter.' },
            { role: 'assistant', content: 'Prioritize insulation.', image: 'data:image/png;base64,aGk=' }
        ],
        onlineStudioState: { title: 'Shelter guide', category: 'Shelter & Fire', image: 'data:image/png;base64,aGk=' },
        showSaveToast: (...args) => toasts.push(args),
        escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        closeSaveModal: () => { closed++; },
        closeOnlineImageStudio: () => { closed++; },
        addOnlineStudioResultToChat: () => { added++; },
        showSaveModal: options => modalOptions.push(options),
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        setTimeout: callback => { callback(); }, Blob, atob, console
    });
    vm.runInContext(extracted, context);
    return { context, elements, toasts, downloads, pickers, modalOptions, confirmations, get closed() { return closed; }, get added() { return added; } };
}

test('all inline scripts still parse', () => {
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (script[1].trim()) new vm.Script(script[1]);
    }
});

test('release-scope guard still detects changes outside desktop save functions', () => {
    const original = outsideDesktopKBSave(html);
    assert.notEqual(outsideDesktopKBSave(html.replace('function exportOnlineStudioPDF(options = {})',
        'function exportOnlineStudioPDF(options = {changed: true})')), original);
    assert.notEqual(outsideDesktopKBSave(html.replace("const IS_APP_SURFACE = CONFIG.surface === 'app';",
        'const IS_APP_SURFACE = true;')), original);
    assert.notEqual(outsideDesktopKBSave(html.replace('function generateMarkdownContent(title, category, tags, imageFilenames)',
        'function generateMarkdownContent(title, category, tags, alteredImages)')), original);
});

test('actual desktop and phone dialogs keep quoted and HTML-like titles in input.value only', () => {
    const unsafeTitle = '\" autofocus onfocus=\"window.injected=true\"><img src=x onerror=\"window.injected=true\"> & \' Shelter';
    for (const phone of [false, true]) {
        const overlays = [];
        const context = vm.createContext({
            window: phone ? { innerWidth: 390 } : { innerWidth: 1100, showDirectoryPicker() {} },
            IS_APP_SURFACE: phone,
            conversationHistory: [], kbDirectoryState: null,
            document: {
                createElement(tag) {
                    assert.equal(tag, 'div');
                    const input = { value: '', focus() {}, select() {} };
                    return {
                        innerHTML: '', input, addEventListener() {},
                        querySelector(selector) { assert.equal(selector, '#saveTitle'); return input; }
                    };
                },
                body: { appendChild: overlay => overlays.push(overlay) },
                getElementById: id => id === 'saveTitle' ? overlays.at(-1)?.input : null
            },
            refreshKBFolderOptions() {}, closeSaveModal() {},
            setTimeout: callback => callback()
        });
        vm.runInContext(extract('showSaveModal'), context);
        context.showSaveModal({ title: 'Ordinary shelter title' });
        context.showSaveModal({ title: unsafeTitle });
        assert.equal(overlays[1].input.value, unsafeTitle, 'Preserve the full title as text');
        assert.equal(overlays[1].innerHTML, overlays[0].innerHTML,
            'User title must not affect element or attribute construction');
        assert.match(overlays[1].innerHTML, /<input type="text" id="saveTitle" placeholder="Enter a title\.\.\.">/);
        assert.doesNotMatch(overlays[1].innerHTML, /autofocus|onfocus|onerror|<img/);
    }
});

test('product-root choice discovers actual KB categories, custom and nested folders', async () => {
    const nested = directory('Winter'), shelter = directory('Shelter & Fire', { Winter: nested });
    const kb = directory('Saved Knowledge Base', {
        'Shelter & Fire': shelter, 'Custom & <Field>': directory('Custom & <Field>'),
        '.hidden': directory('.hidden'), 'guide.md': { kind: 'file' }
    });
    const product = directory('OffGrid AI Mac', { 'Saved Knowledge Base': kb });
    const h = harness({ selected: product });
    assert.equal(await h.context.pickKBDirectory(), true);
    assert.equal(h.context.kbDirectoryHandle, kb);
    assert.deepEqual(Array.from(h.context.kbDirectoryState.destinations, d => d.path),
        ['Custom & <Field>', 'Shelter & Fire', 'Shelter & Fire/Winter']);
    assert.ok(h.elements.saveCategory.children.some(option => option.textContent === 'Custom & <Field>'));
    assert.equal(product.files.size, 0);
    assert.equal(kb.files.size, 0);
});

test('Save after product selection writes article and image to Shelter & Fire, never the root', async () => {
    const shelter = directory('Shelter & Fire');
    const kb = directory('Saved Knowledge Base', { 'Shelter & Fire': shelter, Other: directory('Other') });
    const product = directory('OffGrid AI Mac', { 'Saved Knowledge Base': kb });
    const h = harness({ selected: product });
    await h.context.executeSave();
    assert.equal(h.pickers.length, 1);
    assert.equal(shelter.files.size, 0, 'First click chooses folders; user reviews category before writing');
    h.elements.saveCategory.value = 'Shelter & Fire';
    h.elements.saveCategory.onchange();
    await h.context.executeSave();
    assert.equal(product.files.size, 0);
    assert.equal(kb.files.size, 0);
    const markdown = shelter.files.get('Shelter-guide.md');
    assert.match(markdown, /category: Shelter & Fire/);
    assert.match(markdown, /!\[Generated Image\]\(\.\/Shelter-guide-img-1\.png\)/);
    assert.doesNotMatch(markdown, /data:image/);
    assert.ok(shelter.files.get('Shelter-guide-img-1.png') instanceof Blob);
    assert.ok(shelter.calls.findIndex(c => c[0] === 'closed' && c[1].endsWith('.png')) <
        shelter.calls.findIndex(c => c[0] === 'file' && c[1].endsWith('.md')));
    h.elements.saveTitle.value = 'Second guide';
    await h.context.executeSave();
    assert.equal(h.pickers.length, 1, 'Selected handle is retained for repeat saves');
    assert.ok(shelter.files.has('Second-guide.md'));
    assert.match(h.toasts.at(-1)[0], /Saved Knowledge Base\/Shelter &amp; Fire/);
});

test('nested selection and text-only save use the actual nested handle', async () => {
    const winter = directory('Winter');
    const kb = directory('Saved Knowledge Base', { 'Shelter & Fire': directory('Shelter & Fire', { Winter: winter }) });
    const h = harness({ selected: kb });
    h.context.conversationHistory = [{ role: 'assistant', content: 'A text-only guide.' }];
    await h.context.pickKBDirectory();
    h.elements.saveCategory.value = 'Shelter & Fire/Winter';
    await h.context.executeSave();
    assert.equal(winter.files.size, 1);
    assert.match(winter.files.get('Shelter-guide.md'), /category: Shelter & Fire\/Winter/);
    assert.equal(kb.files.size, 0);
});

test('existing article and image require confirmation before any write; Cancel keeps both originals and the dialog', async () => {
    const shelter = directory('Shelter & Fire');
    shelter.files.set('Shelter-guide.md', 'original article');
    shelter.files.set('Shelter-guide-img-1.png', 'original image');
    const h = harness({ selected: shelter, overwrite: message => {
        assert.match(message, /Shelter-guide\.md/);
        assert.match(message, /Shelter-guide-img-1\.png/);
        assert.match(message, /Replace the matching article and image files/);
        assert.equal(shelter.calls.some(call => call[0] === 'file'), false);
        return false;
    } });
    await h.context.pickKBDirectory();
    await h.context.executeSave();
    assert.equal(h.confirmations.length, 1);
    assert.equal(shelter.files.get('Shelter-guide.md'), 'original article');
    assert.equal(shelter.files.get('Shelter-guide-img-1.png'), 'original image');
    assert.equal(shelter.calls.some(call => call[0] === 'file'), false);
    assert.equal(h.closed, 0);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.elements.kbWriteFilesBtn.disabled, false);
});

test('image-only collision is confirmed after all names are checked, then the entire bundle is saved', async () => {
    const shelter = directory('Shelter & Fire');
    shelter.files.set('Shelter-guide-img-1.png', 'old image');
    const h = harness({ selected: shelter, overwrite: message => {
        assert.match(message, /Shelter-guide-img-1\.png/);
        assert.deepEqual(shelter.calls.filter(call => call[0] === 'lookup').map(call => call[1]),
            ['Shelter-guide.md', 'Shelter-guide-img-1.png']);
        assert.equal(shelter.calls.some(call => call[0] === 'file'), false);
        return true;
    } });
    await h.context.pickKBDirectory();
    await h.context.executeSave();
    assert.equal(h.confirmations.length, 1);
    assert.ok(shelter.files.get('Shelter-guide-img-1.png') instanceof Blob);
    assert.match(shelter.files.get('Shelter-guide.md'), /Prioritize insulation/);
    assert.equal(h.closed, 1);
});

test('existing text-only article requires confirmation and denied collision lookup aborts before writers', async () => {
    const shelter = directory('Shelter & Fire');
    shelter.files.set('Shelter-guide.md', 'old article');
    const h = harness({ selected: shelter });
    h.context.conversationHistory = [{ role: 'assistant', content: 'Replacement text' }];
    await h.context.pickKBDirectory();
    await h.context.executeSave();
    assert.equal(h.confirmations.length, 1);
    assert.match(shelter.files.get('Shelter-guide.md'), /Replacement text/);

    const denied = directory('Shelter & Fire', {}, { failLookup: true });
    const d = harness({ selected: denied });
    await d.context.pickKBDirectory();
    await d.context.executeSave();
    assert.equal(denied.calls.some(call => call[0] === 'file'), false);
    assert.equal(d.confirmations.length, 0);
    assert.equal(d.closed, 0);
    assert.match(d.toasts.at(-1)[0], /Save could not finish/);
});

test('direct category choice is used without directory creation or unrelated enumeration', async () => {
    const custom = directory('My Field Guides', { hugeUnrelatedChild: directory('hugeUnrelatedChild') });
    const h = harness({ selected: custom });
    await h.context.pickKBDirectory();
    assert.equal(h.elements.saveCategory.value, '.');
    await h.context.executeSave();
    assert.equal(custom.calls.filter(call => call[0] === 'entries').length, 0);
    assert.match(custom.files.get('Shelter-guide.md'), /category: My Field Guides/);
    assert.equal(h.toasts.at(-1)[0], 'Saved to My Field Guides');
});

test('folder names and access errors are escaped before reaching the HTML toast', async () => {
    const h = harness({ selected: directory('<img src=x onerror=alert(1)>') });
    await h.context.pickKBDirectory();
    await h.context.executeSave();
    assert.equal(h.toasts.at(-1)[0], 'Saved to &lt;img src=x onerror=alert(1)&gt;');
    const d = harness({ pickerError: new Error('<img src=x onerror=alert(1)>') });
    await d.context.pickKBDirectory();
    assert.equal(d.toasts.at(-1)[1], '&lt;img src=x onerror=alert(1)&gt;');
});

test('cancelling Change Folder preserves previous selection and never saves or downloads', async () => {
    const original = directory('Shelter & Fire');
    const h = harness({ selected: original });
    await h.context.pickKBDirectory();
    const savedState = h.context.kbDirectoryState;
    h.context.window.showDirectoryPicker = async options => {
        assert.equal(options.startIn, original);
        throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    };
    assert.equal(await h.context.pickKBDirectory(), false);
    assert.equal(h.context.kbDirectoryState, savedState);
    assert.equal(original.files.size, 0);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.context.kbFolderBusy, false);
});

test('Windows Base and Map product roots use existing KB folders without OS-specific paths', async () => {
    for (const name of ['OffGrid AI Windows', 'OffGrid AI Windows with Map']) {
        const shelter = directory('Shelter & Fire');
        const kb = directory('Saved Knowledge Base', { 'Shelter & Fire': shelter });
        const product = directory(name, { 'Saved Knowledge Base': kb });
        const h = harness({ selected: product });
        await h.context.pickKBDirectory();
        assert.equal(h.context.kbDirectoryHandle, kb);
        assert.equal(h.elements.saveCategory.value, 'Shelter & Fire');
        await h.context.executeSave();
        assert.equal(product.files.size, 0);
        assert.equal(kb.files.size, 0);
        assert.equal(shelter.files.size, 2);
        assert.match(shelter.files.get('Shelter-guide.md'), /category: Shelter & Fire/);
    }
});

test('direct-folder workflow retains destination for the next save and allows Change Folder', async () => {
    const shelter = directory('Shelter & Fire');
    const water = directory('Water & Food');
    const h = harness({ selected: shelter });
    await h.context.pickKBDirectory();
    assert.equal(h.pickers[0].id, 'offgrid-knowledge-base');
    assert.equal(h.pickers[0].mode, 'readwrite');
    await h.context.executeSave();
    // Recreate the selectable state as a reopened modal does; retain session handle.
    h.elements.saveCategory.value = 'Other';
    h.context.refreshKBFolderOptions(h.context.kbDirectoryState.selectedPath);
    h.elements.saveTitle.value = 'Second shelter guide';
    await h.context.executeSave();
    assert.equal(h.pickers.length, 1, 'Repeat Save does not require folder navigation again');
    assert.equal(shelter.files.size, 4);
    h.context.window.showDirectoryPicker = async options => {
        h.pickers.push(options);
        assert.equal(options.startIn, shelter, 'Change Folder opens at the chosen folder');
        return water;
    };
    assert.equal(await h.context.pickKBDirectory(), true);
    h.elements.saveTitle.value = 'Water guide';
    await h.context.executeSave();
    assert.equal(h.context.kbDirectoryHandle, water);
    assert.equal(h.pickers.length, 2);
    assert.equal(water.files.size, 2);
    assert.equal(shelter.files.size, 4, 'Earlier category files remain untouched');
    assert.match(water.files.get('Water-guide.md'), /category: Water & Food/);
});

test('a fresh page keeps the production picker ID but does not claim a persisted directory handle', async () => {
    const h = harness({ selected: directory('Shelter & Fire') });
    assert.equal(h.context.kbDirectoryState, null);
    assert.equal(h.context.kbDirectoryHandle, null);
    await h.context.pickKBDirectory();
    assert.equal(h.pickers[0].id, 'offgrid-knowledge-base');
    assert.equal(h.pickers[0].startIn, 'documents');
    // Last-used-location restoration belongs to the browser; this mock cannot qualify it.
});

test('permission and write failures keep the dialog open, do not fall back to misleading downloads', async () => {
    const denied = harness({ selected: directory('OffGrid AI Mac', {}, { denied: true }) });
    assert.equal(await denied.context.pickKBDirectory(), false);
    assert.equal(denied.context.kbDirectoryState, null);
    assert.match(denied.toasts[0][0], /Could not select/);
    const disconnected = directory('Shelter & Fire', {}, { failWrite: true });
    const h = harness({ selected: disconnected });
    await h.context.pickKBDirectory();
    await h.context.executeSave();
    assert.equal(h.closed, 0);
    assert.equal(h.downloads.length, 0);
    assert.equal(disconnected.calls.some(call => call[0] === 'file' && call[1].endsWith('.md')), false);
    assert.match(h.toasts.at(-1)[0], /Save could not finish/);
    assert.equal(h.elements.kbWriteFilesBtn.disabled, false);
});

test('Studio Save opens the category modal with source title and leaves generation untouched', async () => {
    const h = harness();
    await h.context.saveOnlineStudioToKnowledgeBase();
    assert.equal(h.added, 1);
    assert.equal(h.closed, 1);
    assert.equal(h.modalOptions[0].title, 'Shelter guide');
    assert.equal(h.modalOptions[0].category, 'Shelter & Fire');
    assert.equal(h.pickers.length, 0);
    assert.equal(h.downloads.length, 0);
});

test('unsupported browsers still download both siblings with explicit placement instructions', async () => {
    const h = harness({ unsupported: true });
    h.context.refreshKBFolderOptions('Other');
    assert.equal(h.elements.kbChooseFolderBtn.hidden, true);
    assert.match(h.elements.kbWriteFilesBtn.textContent, /Download/);
    await h.context.executeSave();
    assert.deepEqual(h.downloads, ['Shelter-guide.md', 'Shelter-guide-img-1.png']);
    assert.match(h.toasts.at(-1)[1], /Move ALL/);
});

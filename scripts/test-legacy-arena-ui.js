'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require.resolve('../arena-open.html'), 'utf8');
const resetCode = html.slice(html.indexOf('function createNewTestButton()'), html.indexOf('function returnToHome()'));
const sendCode = html.slice(html.indexOf('async function sendMessage()'), html.indexOf('// SINGLE MODEL STREAMING'));

function harness() {
    const element = () => ({ value: 'previous input', innerHTML: 'previous answer', disabled: false, style: {}, classList: { remove() {} }, focus() {}, remove() {}, setAttribute() {} });
    const ids = Object.fromEntries(['messages', 'bottomInputArea', 'imagePreview', 'imagePreviewWelcome', 'mobileImagePreview', 'messageInput', 'messageInputWelcome', 'sendButton', 'sendButtonWelcome'].map(id => [id, element()]));
    const files = [element(), element()];
    const controls = [element(), element(), ids.sendButton, ids.sendButtonWelcome];
    const writes = [];
    const context = {
        isTyping: false, selectedModel: 'navigator', judgeMode: 'gpt-5.2',
        conversationHistory: [{ role: 'user', content: 'previous question' }],
        lastCouncilDeliberation: { old: true }, lastCouncilLabelMap: { A: 'ranger' }, councilScores: { ranger: 45 },
        chairmanKey: 'ranger', chairmanName: 'Advanced', chairmanEmoji: '', selectedImage: { dataUrl: 'image' },
        deepModeData: { totalQueries: 4, modelStats: { ranger: { wins: 3 } } },
        lifetimeData: { totalQueries: 25, models: { ranger: { wins: 15 } }, trackingSince: '2026-05-10' },
        dialogs: [],
        setTimeout(fn) { fn(); }, autoResize() {}, selectModel(model) { context.selectedModel = model; },
        localStorage: { setItem: (...args) => writes.push(args), removeItem: (...args) => writes.push(args) },
        sessionStorage: { setItem: (...args) => writes.push(args), removeItem: (...args) => writes.push(args) },
        document: {
            body: { appendChild() {} },
            querySelector() { return null; },
            getElementById(id) { return ids[id] || null; },
            createElement(tag) {
                const el = element();
                if (tag === 'dialog') {
                    el.showModal = () => context.dialogs.push(el);
                    el.addEventListener = (event, listener) => { el.closeListener = listener; };
                    el.finish = value => { el.returnValue = value; el.closeListener(); };
                } else controls.push(el);
                return el;
            },
            querySelectorAll(selector) {
                if (selector === 'input[type="file"]') return files;
                if (selector === '.new-test-control, .send-button') return controls;
                return [];
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(resetCode, context);
    return { context, ids, files, controls, writes };
}

test('all inline scripts parse, including the rebuilt welcome screen', () => {
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});

test('initial, bottom and rebuilt input bars include New Test; creation/plus entry points are gone', () => {
    assert.equal((html.match(/class="test-input-actions"/g) || []).length, 4); // Three inputs plus confirmation.
    assert.equal((html.match(/class="new-test-btn new-test-control" onclick="clearChat\(\)"/g) || []).length, 3);
    assert.doesNotMatch(html, /onclick="(?:toggleAttachMenu|openImageStudio)\(/);
    assert.doesNotMatch(html, /class="attach-menu"|class="attach-btn/);
    assert.doesNotMatch(html, /(?:singleVisualBtn|visualBtn)\./);
    assert.equal((html.match(/actions.appendChild\(createNewTestButton\(\)\)/g) || []).length, 2);
    assert.match(html, /actions.appendChild\(delibBtn\)/);
    assert.match(html, /onclick="triggerGalleryUpload\(\)"/);
});

test('New Test clears turns, drafts and attachments but retains model, judge and exact analytics', () => {
    const { context: c, ids, files, writes } = harness();
    const before = JSON.stringify([c.deepModeData, c.lifetimeData]);
    c.createNewTestButton().onclick();
    assert.equal(c.dialogs.length, 1);
    c.dialogs[0].finish('confirm');
    assert.equal(c.conversationHistory.length, 0);
    for (const key of ['lastCouncilDeliberation', 'lastCouncilLabelMap', 'councilScores', 'chairmanKey', 'selectedImage']) assert.equal(c[key], null);
    assert.equal(ids.messageInput.value, '');
    assert.ok(files.every(file => file.value === ''));
    assert.equal(c.selectedModel, 'navigator');
    assert.equal(c.judgeMode, 'gpt-5.2');
    assert.equal(JSON.stringify([c.deepModeData, c.lifetimeData]), before);
    assert.deepEqual(writes, []);
    assert.match(ids.messages.innerHTML, /New Test/);
    assert.doesNotMatch(ids.messages.innerHTML, /attach-menu|Generate Visual/);
});

test('cancelling confirmation leaves the current answer and context in place', () => {
    const { context: c, ids } = harness();
    c.clearChat();
    c.dialogs[0].finish('cancel');
    assert.equal(c.conversationHistory.length, 1);
    assert.equal(ids.messages.innerHTML, 'previous answer');
});

test('all reset controls are disabled during a run, including dynamically created answer controls', () => {
    const { context: c, ids, controls } = harness();
    c.setTestBusy(true);
    assert.ok(controls.every(button => button.disabled));
    const button = c.createNewTestButton(); assert.equal(button.disabled, true);
    c.clearChat(); c.softResetChat();
    assert.equal(c.dialogs.length, 0);
    assert.equal(ids.messages.innerHTML, 'previous answer');
    c.setTestBusy(false);
    assert.ok(controls.every(control => !control.disabled));
});

test('connection preflight locks resets, then unlocks on failure without starting a model call', async () => {
    const { context: c, ids, controls } = harness();
    let finish;
    c.getActiveInput = () => ids.messageInputWelcome;
    c.checkConnection = () => new Promise(resolve => { finish = resolve; });
    c.addMessage = () => {};
    vm.runInContext(sendCode, c);
    const pending = c.sendMessage();
    assert.equal(c.isTyping, true);
    assert.ok(controls.every(button => button.disabled));
    c.clearChat(); assert.equal(c.dialogs.length, 0);
    finish(false); await pending;
    assert.equal(c.isTyping, false);
    assert.ok(controls.every(button => !button.disabled));
});

test('six recent development prompts are present verbatim, without changing the rubric or roster', () => {
    assert.equal((html.match(/class="prompt-item" onclick="usePrompt\(this\)"/g) || []).length, 16);
    for (const phrase of ['a visible cut in its sidewall', 'plug smells hot', 'longitude -112.2468', 'blossom end', 'planned 50% discharge limit', 'my ring feels tight']) assert.ok(html.includes(phrase));
});

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isOptimized, toRequest, createLegacyOptimized, TIMEOUT_MS } = require('../server/legacy-arena-optimized');
const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
const enabled = { enabled: true, budgetsConfirmed: true, modalUrl: 'https://test.modal.run', modalKey: 'test', modalSecret: 'test' };
const question = [{ role: 'system', content: 'Current OffGrid instructions' }, { role: 'user', content: 'Pack a repair kit.' }];

test('only explicitly configured legacy E4B uses Modal', () => {
    assert.equal(isOptimized({ id: 'gemma4:e4b', inference: 'modal-e4b' }), true);
    assert.equal(isOptimized({ id: 'gemma4:e4b' }), false);
    assert.equal(isOptimized({ id: 'google/gemma-4-26b-a4b-it' }), false);
    assert.ok(TIMEOUT_MS > 140000);
});

test('preserves candidate versus reviewer system instructions and user text', () => {
    assert.equal(toRequest(question).system, question[0].content);
    assert.equal(toRequest(question).prompt, question[1].content);
    const review = [{ role: 'system', content: 'Anonymous ranking rubric' }, { role: 'user', content: 'Answer A\nOne\nAnswer B\nTwo' }];
    assert.equal(toRequest(review, true).system, review[0].content);
    assert.equal(toRequest(review, true).prompt, review[1].content);
    assert.equal(toRequest(question.slice(1)).system, '');
});

test('preserves conversation turns, does not silently discard large context', () => {
    const messages = [...question, { role: 'assistant', content: 'Tools first.' }, { role: 'user', content: 'Why?' }];
    assert.equal(toRequest(messages).prompt, 'User:\nPack a repair kit.\n\nAssistant:\nTools first.\n\nUser:\nWhy?');
    assert.throws(() => toRequest([{ role: 'user', content: 'x'.repeat(4001) }]), /too long/);
    assert.equal(toRequest([{ role: 'user', content: 'x'.repeat(10000) }], true).prompt.length, 10000);
    assert.throws(() => toRequest([{ role: 'assistant', content: 'No question' }]), /user question/);
});

test('one supported image is retained; unsupported or multiple images rejected', () => {
    const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } };
    const msg = [{ role: 'user', content: [{ type: 'text', text: 'Identify this' }, image] }];
    assert.equal(toRequest(msg).image, image.image_url.url);
    assert.equal(toRequest(msg).prompt, 'Identify this');
    assert.throws(() => toRequest([{ role: 'user', content: [image, image] }]), /too long|one image/);
    assert.throws(() => toRequest([{ role: 'user', content: [{ type: 'text', text: 'Look' }, { type: 'image_url', image_url: { url: 'https://example.com/a.png' } }] }]), /under 2 MB/);
});

test('calls generation and grading separately; rejects unverified or partial replies', async () => {
    const calls = [];
    let output = { text: 'Complete', matched: true, finishReason: 'stop' };
    const providers = Object.fromEntries(['generate', 'review'].map(key => [key, async (...args) => { calls.push({ key, args }); return output; }]));
    const adapter = createLegacyOptimized({ config: enabled, providers });
    await adapter.call(question);
    await adapter.call(question, { grading: true });
    assert.deepEqual(calls.map(c => c.key), ['generate', 'review']);
    assert.equal(calls[0].args[0].pair, 'e4b');
    assert.equal(calls[0].args[1].system, question[0].content);
    output = { ...output, matched: false };
    await assert.rejects(adapter.call(question), /identity/);
    output = { ...output, matched: true, finishReason: 'length' };
    await assert.rejects(adapter.call(question), /incomplete/);
});

test('shared GPU lease changes no counters and releases once', async () => {
    const sql = [], releases = [];
    const client = { query: async q => { sql.push(q); return { rows: [{ acquired: true }] }; }, release: flag => releases.push(flag) };
    const adapter = createLegacyOptimized({ config: enabled, pool: { connect: async () => client }, providers: {} });
    const release = await adapter.acquire();
    await release(); await release();
    assert.deepEqual(sql, ['SELECT pg_try_advisory_lock(70410261) AS acquired', 'SELECT pg_advisory_unlock(70410261)']);
    assert.equal(releases.length, 1);
});

test('busy, unconfigured and failed guards block hosting and release clients', async () => {
    let released = 0;
    const pool = { connect: async () => ({ query: async () => ({ rows: [{ acquired: false }] }), release: () => released++ }) };
    await assert.rejects(createLegacyOptimized({ config: enabled, pool, providers: {} }).acquire(), /in progress/);
    assert.equal(released, 1);
    await assert.rejects(createLegacyOptimized({ config: {}, pool, providers: {} }).acquire(), /not configured/);
    await assert.rejects(createLegacyOptimized({ config: enabled, pool: { connect: async () => { throw Error('private details'); } }, providers: {} }).acquire(), /guard is unavailable/);
});

function harness() {
    const requests = [], events = [], handlers = {};
    const state = { leases: 0, released: 0 };
    const ranking = JSON.stringify({ accuracy_ranking: ['A','B','C','D'], prioritization_ranking: ['B','A','D','C'], actionability_ranking: ['D','C','B','A'], top_accuracy_explanation: 'A facts', top_prioritization_explanation: 'B order', top_actionability_explanation: 'D steps' });
    const context = {
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, isOptimized, OPTIMIZED_TIMEOUT_MS: TIMEOUT_MS,
        OPENROUTER_API_KEY: 'test', requireLicense() {}, checkPromptLimit() {}, incrementUsage: async () => {},
        keepOptimizedAlive: () => () => {},
        legacyOptimized: {
            acquire: async () => { state.leases++; return async () => { state.released++; }; },
            call: async (messages, options = {}) => { requests.push({ model: 'gemma4:e4b', messages, grading: options.grading === true }); return { text: options.grading ? ranking : 'E4B original', metadata: { model: 'gemma4:e4b', provider: 'Modal / Ollama' } }; },
        },
        callOpenRouter: async (model, messages, tokens) => { requests.push({ model, messages, grading: tokens === 1024 }); return tokens === 1024 ? ranking : 'Hosted original'; },
        streamOpenRouter: async (model, messages, res) => { requests.push({ model, messages, streaming: true }); res.write('data: {"content":"Synthesis"}\n\n'); },
        withTimeout: async promise => promise,
        buildOpenRouterMessages: messages => messages,
        app: { post: (route, ...args) => { handlers[route] = args.at(-1); } },
    };
    const config = source.slice(source.indexOf('const COMMAND_MODELS ='), source.indexOf('// MIDDLEWARE'));
    const review = source.slice(source.indexOf('function safeParseJSON('), source.indexOf('/** FREE TIER API ROUTES'));
    const routes = source.slice(source.indexOf("app.post('/api/command/stream'"), source.indexOf('// NANO BANANA IMAGE GENERATION ENDPOINT'));
    vm.runInNewContext(config + '\n' + review + '\n' + routes, context);
    const res = { headersSent: false, setHeader() {}, status() { return this; }, json: value => events.push(value), write: text => { if (text.startsWith('data: ') && !text.includes('[DONE]')) events.push(JSON.parse(text.slice(6))); }, end() {} };
    return { requests, events, state, context, async run(route, client = 'open-arena', extra = {}) { await handlers[route]({ headers: { 'x-offgrid-client': client }, body: { messages: [{ role: 'user', content: 'Pack a kit' }], ...extra } }, res); } };
}

test('real Council handler uses four candidates and four voters, with E4B on Modal', async () => {
    const h = harness();
    await h.run('/api/command/council', 'open-arena', { judgeMode: 'borda' });
    assert.deepEqual(h.events.filter(e => e.error), []);
    assert.equal(h.state.leases, 1); assert.equal(h.state.released, 1);
    const modal = h.requests.filter(r => r.model === 'gemma4:e4b');
    assert.equal(modal.length, 2);
    assert.match(modal[0].messages[0].content, /You are OffGrid AI/);
    assert.match(modal[1].messages[0].content, /anonymous review panel/);
    assert.doesNotMatch(modal[1].messages[0].content, /You are OffGrid AI/);
    assert.equal(h.requests.filter(r => r.grading).length, 4);
    const meta = h.events.find(e => e.councilMeta).councilMeta;
    assert.equal(meta.rawReviews.length, 4);
    assert.equal(Object.keys(meta.scores).length, 4);
    assert.equal(meta.scores.C.key, 'navigator');
    assert.equal(h.events.find(e => e.progress === 'navigator').verified, true);
});

test('single Optimized and outside judge paths also work without changing other model sets', async () => {
    let h = harness();
    await h.run('/api/command/stream', 'open-arena', { model: 'navigator' });
    assert.equal(h.events.find(e => e.content).content, 'E4B original');
    assert.equal(h.state.released, 1);
    h = harness();
    await h.run('/api/command/council', 'open-arena', { judgeMode: 'gpt-5.2' });
    assert.equal(h.requests.filter(r => r.model === 'gemma4:e4b').length, 1);
    assert.equal(h.events.find(e => e.councilMeta).councilMeta.rawReviews[0].reviewer, 'gpt-judge');
    for (const client of ['arena', 'command']) {
        h = harness();
        await h.run('/api/command/stream', client, { model: 'navigator' });
        assert.equal(h.state.leases, 0);
        assert.equal(h.requests[0].model, 'google/gemini-3.1-pro-preview');
    }
});

test('Council provider failure still releases the lease; no prompt or rubric rewrite', async () => {
    const h = harness();
    h.context.legacyOptimized.call = async () => { throw Error('Model service temporarily unavailable'); };
    await h.run('/api/command/council');
    assert.equal(h.state.released, 1);
    assert.equal(h.events.find(e => e.progress === 'navigator').message.includes('skipped'), true);
});

test('existing All-Time counts, categories and tracking date load without writes or migration', () => {
    const html = fs.readFileSync(require.resolve('../arena-open.html'), 'utf8');
    const code = html.slice(html.indexOf("const LIFETIME_STORAGE_KEY ="), html.indexOf('function resetLifetimeData()'));
    const previous = { totalQueries: 23, totalResponseTime: 1742.3, trackingSince: '2026-05-10T18:16:38.459Z', closestElection: { margin: 1 }, models: { scout: { wins: 2 }, medic: { wins: 4 }, navigator: { wins: 3, categoryWins: { gear: 1 } }, ranger: { wins: 14 } } };
    const raw = JSON.stringify(previous), writes = [];
    const context = { localStorage: { getItem: key => key === 'offgrid-open-deep-mode-lifetime' ? raw : null, setItem: (...args) => writes.push(args) } };
    vm.runInNewContext(code + '\nresult = loadLifetimeData();', context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.result)), previous);
    assert.equal(writes.length, 0);
    assert.match(html, /const DEEP_MODE_STORAGE_KEY = 'offgrid-open-deep-mode-data'/);
});

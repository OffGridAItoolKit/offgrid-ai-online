'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../assets/arena/analytics');
function run(id = 'one', overrides = {}) {
    const score = (n) => ({
        accuracy: n,
        prioritization: n,
        actionability: n,
        total: n * 5,
    });
    return {
        id,
        createdAt: '2026-09-07T18:00:00.000Z',
        mode: 'judge',
        category: 'water',
        status: 'complete',
        rosterVersion: 'test',
        rubricDigest: 'rubric',
        promptDigest: 'prompt',
        validationVersion: 'v2',
        settings: { temperature: 1 },
        elapsedMs: 1000,
        prompt: 'Private question',
        privateKey: 'PRIVATE-TEST-KEY',
        scores: {
            optimized: score(3),
            e4b: score(1),
            advanced: score(1),
            '26b': score(1),
        },
        answers: A.KEYS.map((key) => ({
            key,
            model: key,
            text: 'Private answer',
            metadata: {
                provider: 'test',
                settings: { seed: 1, temperature: 1 },
            },
        })),
        reviews: [
            {
                reviewer: 'judge',
                model: 'gpt',
                rawText: 'Private reasoning',
                metadata: { provider: 'test', settings: { seed: 1 } },
            },
        ],
        ...overrides,
    };
}
const selection = (r) => ({ mode: r.mode, series: r.series, category: 'all' });
test('analytics record omits questions, answers, reasoning, keys and unknown fields', () => {
    const record = A.record(run());
    const raw = JSON.stringify(record);
    for (const text of [
        'Private question',
        'Private answer',
        'Private reasoning',
        'PRIVATE-TEST-KEY',
    ])
        assert.ok(!raw.includes(text));
    assert.deepEqual(A.validateRecords([{ ...record, prompt: 'discard' }]), [
        record,
    ]);
});
test('same settings with new seed, answer order or property order remain one configuration', () => {
    const first = run(),
        second = run('two');
    second.answers.reverse();
    second.answers.forEach((a) => {
        a.metadata.settings = { temperature: 1, seed: 900 };
    });
    second.reviews[0].metadata.settings.seed = 42;
    assert.equal(A.series(first), A.series(second));
});
test('mode, prompt, rubric, validation, provider and model changes split configurations', () => {
    for (const field of [
        'mode',
        'promptDigest',
        'rubricDigest',
        'validationVersion',
        'rosterVersion',
        'gradingProtocol',
    ]) {
        const changed = run('two', { [field]: 'different' });
        assert.notEqual(A.series(run()), A.series(changed));
    }
    const changed = run();
    changed.answers[0].metadata.provider = 'different';
    assert.notEqual(A.series(run()), A.series(changed));
    changed.answers[0].model = 'different';
    assert.notEqual(A.series(run()), A.series(changed));
});

test('absent Council protocol preserves existing judge fingerprints; new protocol splits old Council', () => {
    assert.equal(
        A.series(run()),
        A.series(run('two', { gradingProtocol: undefined })),
    );
    assert.notEqual(
        A.series(run('old', { mode: 'council' })),
        A.series(
            run('new', {
                mode: 'council',
                gradingProtocol: 'balanced-four-seats-rubric-only-v1',
            }),
        ),
    );
});
test('category is assigned before scoring, but does not split inference configurations', () => {
    assert.equal(
        A.series(run()),
        A.series(run('two', { category: 'repairs' })),
    );
    assert.equal(
        A.record(run('two', { category: 'constructor' })).category,
        'general',
    );
});
test('paired ties, wins and losses use scores, never supplied outcome labels', () => {
    const r = A.record(run());
    const s = A.summarize([r], selection(r));
    assert.equal(s.pairs.optimized.wins, 1);
    assert.equal(s.pairs.advanced.ties, 1);
    assert.equal(s.pairs.optimized.delta.total, 10);
    assert.equal(s.pairs.advanced.winRate, 0);
    const losing = run('two');
    [losing.scores.optimized, losing.scores.e4b] = [
        losing.scores.e4b,
        losing.scores.optimized,
    ];
    const mixed = A.summarize([r, A.record(losing)], selection(r));
    assert.equal(mixed.pairs.optimized.losses, 1);
    assert.equal(mixed.pairs.optimized.winRate, 0.5);
    assert.equal(mixed.pairs.optimized.delta.total, 0);
});
test('incomplete and invalid scores never become wins or losses', () => {
    const valid = A.record(run());
    const incomplete = A.record(run('two', { status: 'incomplete' }));
    const invalid = run('three');
    invalid.scores.optimized.total = 99;
    const s = A.summarize(
        [valid, incomplete, A.record(invalid)],
        selection(valid),
    );
    assert.equal(s.count, 1);
    assert.equal(s.incomplete, 2);
    assert.equal(s.pairs.optimized.count, 1);
    assert.equal(incomplete.series, null);
});
test('categories, modes and configurations filter without mixing evidence', () => {
    const water = A.record(run());
    const records = [
        water,
        A.record(run('repair', { category: 'repairs' })),
        A.record(run('council', { mode: 'council' })),
        A.record(run('new-prompt', { promptDigest: 'changed' })),
    ];
    assert.equal(A.summarize(records, selection(water)).count, 2);
    assert.equal(
        A.summarize(records, { ...selection(water), category: 'water' }).count,
        1,
    );
    assert.equal(A.configurations(records, 'judge').length, 2);
});
test('empty results have no invented percentage, advantage or timing', () => {
    const s = A.summarize([], { mode: 'judge', series: '', category: 'all' });
    assert.equal(s.count, 0);
    assert.equal(s.pairs.optimized.winRate, null);
    assert.equal(s.pairs.advanced.delta.total, null);
    assert.equal(s.medianMs, null);
});
test('duplicate delivery is idempotent and independent arrays can reset independently', () => {
    const r = A.record(run());
    let session = A.add([], r),
        lifetime = A.add([], r);
    assert.equal(A.add(session, r).length, 1);
    session = [];
    assert.equal(lifetime.length, 1);
    session = A.add(session, A.record(run('two')));
    lifetime = [];
    assert.equal(session.length, 1);
});
test('storage rejects malformed scores, duplicated ids and unsafe categories', () => {
    const r = A.record(run());
    assert.throws(() => A.validateRecords([r, r]));
    assert.throws(() => A.validateRecords([{ ...r, category: '__proto__' }]));
    assert.throws(() => A.validateRecords([{ ...r, scores: {} }]));
    assert.throws(() => A.validateRecords([{ ...r, date: 'nonsense' }]));
    assert.throws(() => A.validateRecords({}));
});
test('share text includes both pairs, limitations, incomplete scope and canonical live URL', () => {
    const r = A.record(run());
    const text = A.shareSummary(A.summarize([r], selection(r)), {
        scope: 'lifetime',
        mode: 'judge',
        category: 'all',
    });
    for (const term of [
        'Optimized',
        'Advanced',
        'tie',
        'losses',
        '1 complete',
        'user-resettable',
        'not accuracy percentages',
        'https://offgridtoolkit.ai/open-arena',
    ])
        assert.ok(text.includes(term), term);
    assert.ok(!text.includes('Private question'));
});

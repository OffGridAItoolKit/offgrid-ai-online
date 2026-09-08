'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    CATEGORY_VERSION,
    CATEGORY_PROMPT,
    categoryRequest,
    resolveCategory,
} = require('../server/open-arena/categories');
const {
    runComparison,
    WEIGHTS,
    candidateRequest,
} = require('../server/open-arena/core');
const {
    createProviders,
    configuration,
} = require('../server/open-arena/providers');
const analytics = require('../assets/arena/analytics');
const input = {
    prompt: 'How can I bake bread over a campfire?',
    category: 'auto',
    mode: 'judge',
    image: 'private-image',
};
const good = (category) => ({
    text: JSON.stringify({ category }),
    finishReason: 'stop',
    matched: true,
});

test('classification sees the question only, never images, answers, identities, grades or OffGrid instructions', () => {
    const request = categoryRequest({
        ...input,
        answers: ['private answer'],
        scores: { optimized: 15 },
        system: 'private system',
    });
    assert.equal(request.system, CATEGORY_PROMPT);
    assert.deepEqual(JSON.parse(request.prompt), { question: input.prompt });
    assert.equal(request.image, null);
    assert.ok(!JSON.stringify(request).includes('private'));
});

test('manual override skips classification and automatic labels are validated', async () => {
    const manual = await resolveCategory(
        { ...input, category: 'repairs' },
        {
            classify: () =>
                assert.fail('Manual category must not cost a classifier call'),
        },
    );
    assert.deepEqual(manual, {
        category: 'repairs',
        source: 'manual',
        version: 'manual-v1',
    });
    for (const category of Object.keys(analytics.CATEGORIES)) {
        const result = await resolveCategory(input, {
            classify: async () => good(category),
        });
        assert.equal(result.category, category);
        assert.equal(result.source, 'automatic');
        assert.equal(result.version, CATEGORY_VERSION);
    }
});

test('invalid, failed, truncated or mismatched classification has an explicit fallback, not a model loss', async () => {
    for (const result of [
        good('constructor'),
        good(['water']),
        good('unknown'),
        { ...good('medical'), matched: false },
        { ...good('medical'), finishReason: 'length' },
        { ...good('water'), text: 'not json' },
    ]) {
        const category = await resolveCategory(input, {
            classify: async () => result,
        });
        assert.equal(category.category, 'general');
        assert.equal(category.source, 'fallback');
    }
    const category = await resolveCategory(input, {
        classify: async () => {
            throw new Error('private upstream detail');
        },
    });
    assert.equal(category.source, 'fallback');
    assert.ok(!JSON.stringify(category).includes('private upstream'));
});

test('cancellation during classification stops before candidate generation', async () => {
    const controller = new AbortController();
    await assert.rejects(
        runComparison(
            input,
            {
                classify: async () => {
                    controller.abort();
                    throw new Error('cancel');
                },
                generate: () => assert.fail('No generation after cancellation'),
            },
            { signal: controller.signal },
        ),
        /cancelled/,
    );
});

test('category is fixed before four original answers and exactly one outside review', async () => {
    const events = [];
    const result = await runComparison(input, {
        classify: async () => {
            events.push('category');
            return good('water');
        },
        generate: async (model, request) => {
            events.push('answer');
            assert.deepEqual(
                { ...request.settings, seed: 1 },
                { ...candidateRequest(model, input, 1).settings },
            );
            assert.equal(request.prompt, input.prompt);
            assert.equal(request.image, input.image);
            assert.ok(!('category' in request));
            return {
                text: 'Identical fixture answer',
                matched: true,
                finishReason: 'stop',
            };
        },
        review: async (model, request) => {
            events.push('judge');
            assert.equal(model.model, 'openai/gpt-5.2');
            assert.deepEqual(Object.keys(JSON.parse(request.prompt)).sort(), [
                'answers',
                'question',
            ]);
            return {
                matched: true,
                finishReason: 'stop',
                text: JSON.stringify({
                    rankings: Object.fromEntries(
                        Object.keys(WEIGHTS).map((k) => [
                            k,
                            [['A', 'B', 'C', 'D']],
                        ]),
                    ),
                    reasons: Object.fromEntries(
                        ['A', 'B', 'C', 'D'].map((l) => [
                            l,
                            Object.fromEntries(
                                Object.keys(WEIGHTS).map((k) => [
                                    k,
                                    'Identical answer content.',
                                ]),
                            ),
                        ]),
                    ),
                }),
            };
        },
    });
    assert.deepEqual(events, [
        'category',
        'answer',
        'answer',
        'answer',
        'answer',
        'judge',
    ]);
    assert.equal(result.category, 'water');
    assert.equal(result.status, 'complete');
    assert.equal(result.categorization.source, 'automatic');
    const record = analytics.record(result);
    assert.equal(record.categorySource, 'automatic');
    assert.equal(record.categoryVersion, CATEGORY_VERSION);
    assert.deepEqual(analytics.validateRecords([record]), [record]);
    const legacy = { ...record };
    delete legacy.categorySource;
    delete legacy.categoryVersion;
    const migrated = analytics.validateRecords([legacy])[0];
    assert.equal(migrated.category, legacy.category);
    assert.deepEqual(migrated.scores, legacy.scores);
    assert.equal(migrated.categorySource, 'legacy');
});

test('classification is one bounded pinned GPT request with JSON output and no image', async () => {
    const calls = [];
    const adapters = createProviders(
        configuration({}),
        async (url, options) => {
            calls.push({
                url,
                body: JSON.parse(options.body),
                signal: options.signal,
            });
            return {
                ok: true,
                json: async () => ({
                    model: 'openai/gpt-5.2',
                    provider: 'OpenAI',
                    choices: [
                        {
                            message: { content: '{"category":"water"}' },
                            finish_reason: 'stop',
                        },
                    ],
                }),
            };
        },
    );
    const result = await adapters.classify(categoryRequest(input));
    assert.equal(result.matched, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.max_tokens, 128);
    assert.deepEqual(calls[0].body.provider.only, ['openai']);
    assert.equal(calls[0].body.provider.allow_fallbacks, false);
    assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
    assert.ok(!JSON.stringify(calls[0].body).includes(input.image));
});

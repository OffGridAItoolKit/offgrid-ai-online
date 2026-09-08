'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
if (
    !process.env.OPEN_ARENA_OFFGRID_PROMPT &&
    !process.env.OPEN_ARENA_OFFGRID_PROMPT_FILE &&
    !fs.existsSync(path.resolve(__dirname, '../.arena-pilot-prompt.txt'))
)
    process.env.OPEN_ARENA_OFFGRID_PROMPT =
        'Fixture OffGrid instructions for unit tests only.';
const {
    createPost,
    retryAfterMs,
    RELIABILITY_VERSION,
} = require('../server/open-arena/transport');
const {
    createProviders,
    configuration,
} = require('../server/open-arena/providers');
const {
    ROSTER,
    candidateRequest,
    runComparison,
} = require('../server/open-arena/core');

const reply = (status, data = {}, retryAfter) => ({
    ok: status === 200,
    status,
    headers: { get: () => retryAfter ?? null },
    json: async () => data,
});
const success = {
    model: ROSTER[2].model,
    provider: 'Google',
    choices: [
        {
            message: { content: 'Unchanged original answer.' },
            finish_reason: 'stop',
        },
    ],
};
const call = (post, options = {}, signal, timeout = 180000) =>
    post(
        'https://fixture.invalid',
        {
            seed: 42,
            provider: {
                only: ['google-vertex/global'],
                allow_fallbacks: false,
            },
        },
        { Authorization: 'secret-fixture' },
        signal,
        timeout,
        { maxAttempts: 3, ...options },
    );

test('429 and 503 retry identical requests, honor Retry-After and retain every attempt', async () => {
    const requests = [],
        waits = [],
        progress = [];
    const responses = [
        reply(429, { error: { message: 'private raw body' } }, '12'),
        reply(503),
        reply(200, success),
    ];
    const post = createPost(
        async (url, options) => {
            requests.push({ url, ...options });
            return responses.shift();
        },
        async (ms) => waits.push(ms),
    );
    const result = await call(post, { onRetry: (p) => progress.push(p) });
    assert.equal(result.data, success);
    assert.equal(result.transport.version, RELIABILITY_VERSION);
    assert.deepEqual(waits, [12000, 10000]);
    assert.equal(progress.length, 2);
    assert.ok(
        requests.every(
            (r) =>
                r.body === requests[0].body &&
                r.signal === requests[0].signal &&
                r.headers.Authorization === 'secret-fixture',
        ),
    );
    assert.deepEqual(
        result.transport.attempts.map((a) => a.httpStatus),
        [429, 503, 200],
    );
    assert.ok(!JSON.stringify(result).includes('private raw body'));
});

test('transient retry count is bounded and terminal provider errors are sanitized', async () => {
    let count = 0;
    const post = createPost(
        async () => {
            count++;
            return reply(429, {
                error: {
                    message: 'secret-fixture',
                    metadata: { raw: 'private prompt' },
                },
            });
        },
        async () => {},
    );
    await assert.rejects(call(post), (error) => {
        assert.match(error.message, /rate-limited.*After 3 attempts/);
        assert.equal(error.transport.attempts.length, 3);
        assert.ok(!JSON.stringify(error).includes('private prompt'));
        assert.ok(!error.message.includes('secret-fixture'));
        return true;
    });
    assert.equal(count, 3);
});

test('auth, credit, validation, network and malformed-response failures are not retried', async () => {
    for (const status of [400, 401, 402, 403, 404, 500]) {
        let count = 0;
        const post = createPost(
            async () => {
                count++;
                return reply(status);
            },
            () => assert.fail('must not wait'),
        );
        await assert.rejects(call(post), /Model service/);
        assert.equal(count, 1);
    }
    for (const fetchImpl of [
        async () => {
            throw new Error('https://private-url?key=secret');
        },
        async () => ({
            ok: true,
            status: 200,
            json: async () => {
                throw new Error('private raw body');
            },
        }),
    ]) {
        await assert.rejects(call(createPost(fetchImpl)), (error) => {
            assert.equal(error.transport.attempts.length, 1);
            assert.ok(!error.message.includes('private'));
            return true;
        });
    }
});

test('Retry-After accepts seconds or HTTP-date and never retries earlier than long waits', async () => {
    assert.equal(retryAfterMs('12'), 12000);
    assert.equal(
        retryAfterMs(
            'Tue, 08 Sep 2026 15:00:30 GMT',
            Date.parse('2026-09-08T15:00:00Z'),
        ),
        30000,
    );
    for (const bad of [null, '', 'nonsense', '-1', '9/8/2026'])
        assert.equal(retryAfterMs(bad), null);
    for (const [header, timeout] of [
        ['120', 180000],
        ['30', 10000],
    ]) {
        let count = 0;
        const post = createPost(
            async () => {
                count++;
                return reply(503, {}, header);
            },
            () => assert.fail('cannot fit wait'),
        );
        await assert.rejects(
            call(post, {}, undefined, timeout),
            /temporarily unavailable/,
        );
        assert.equal(count, 1);
    }
});

test('cancellation during backoff prevents another fetch', async () => {
    const controller = new AbortController();
    let count = 0;
    const post = createPost(async () => {
        count++;
        return reply(429);
    });
    await assert.rejects(
        call(post, { onRetry: () => controller.abort() }, controller.signal),
        /cancelled/,
    );
    assert.equal(count, 1);
});

test('a shared deadline bounds all attempts and waiting', async () => {
    const post = createPost(
        async (url, { signal }) =>
            new Promise((resolve, reject) => {
                signal.addEventListener(
                    'abort',
                    () => reject(new Error('timeout')),
                    { once: true },
                );
            }),
    );
    // Keep the test process alive while the unref'd AbortSignal timer fires.
    const keepAlive = setTimeout(() => {}, 500);
    try {
        await assert.rejects(call(post, {}, undefined, 20), /timed out/);
    } finally {
        clearTimeout(keepAlive);
    }
});

test('HTTP 200 error envelopes retry only before any output; partial text is preserved', async () => {
    let count = 0;
    const post = createPost(
        async () =>
            ++count === 1
                ? reply(200, { error: { code: 503 } })
                : reply(200, success),
        async () => {},
    );
    assert.equal((await call(post)).data, success);
    assert.equal(count, 2);
    for (const partial of [
        { ...success, error: { code: 429 } },
        {
            choices: [{ message: { reasoning: 'partial thinking' } }],
            error: { code: 503 },
        },
        { usage: { completion_tokens: 1 }, error: { code: 503 } },
    ]) {
        count = 0;
        const result = await call(
            createPost(
                async () => {
                    count++;
                    return reply(200, partial);
                },
                () => assert.fail('no rerolls'),
            ),
        );
        assert.equal(result.data, partial);
        assert.equal(result.failed, true);
        assert.equal(count, 1);
    }
});

test('valid responses, truncations and identity mismatches never trigger a reroll', async () => {
    for (const data of [
        success,
        { ...success, provider: 'Wrong provider' },
        {
            ...success,
            choices: [
                { message: { content: 'partial' }, finish_reason: 'length' },
            ],
        },
    ]) {
        let count = 0;
        const result = await call(
            createPost(
                async () => {
                    count++;
                    return reply(200, data);
                },
                () => assert.fail('no rerolls'),
            ),
        );
        assert.equal(result.data, data);
        assert.equal(count, 1);
    }
});

test('both 26B variants use the same recovery policy; classifier and judge remain single-attempt', async () => {
    for (const model of ROSTER.filter((m) => m.pair === '26b')) {
        let count = 0;
        const providers = createProviders(
            configuration({}),
            async () => (++count === 1 ? reply(503) : reply(200, success)),
            async () => {},
        );
        const result = await providers.generate(
            model,
            candidateRequest(model, { prompt: 'question' }, 9),
        );
        assert.equal(count, 2);
        assert.equal(result.matched, true);
        assert.equal(result.metadata.transport.attempts.length, 2);
    }
    let count = 0;
    const providers = createProviders(
        configuration({}),
        async () => {
            count++;
            return reply(429);
        },
        () => assert.fail('no retries for category or judge'),
    );
    await assert.rejects(
        providers.classify({ prompt: 'question' }),
        /rate-limited/,
    );
    await assert.rejects(
        providers.review({ model: 'openai/gpt-5.2' }, { prompt: 'question' }),
        /rate-limited/,
    );
    assert.equal(count, 2);
});

test('comparison retains failed provider attempts and partial-answer causes, without judging', async () => {
    const providers = createProviders(
        configuration({}),
        async () => reply(503),
        async () => {},
    );
    let reviews = 0;
    const run = await runComparison(
        { prompt: 'question', category: 'water' },
        {
            ...providers,
            generate: async (model, request, signal, options) =>
                model.pair === '26b'
                    ? providers.generate(model, request, signal, options)
                    : {
                          text: 'partial',
                          finishReason:
                              model.key === 'e4b' ? 'length' : 'error',
                          matched: true,
                      },
            review: async () => {
                reviews++;
            },
        },
    );
    assert.equal(run.status, 'incomplete');
    assert.equal(run.winners, undefined);
    assert.equal(reviews, 0);
    for (const answer of run.answers) {
        if (answer.pair === '26b')
            assert.equal(answer.metadata.transport.attempts.length, 3);
        else assert.equal(answer.text, 'partial');
    }
    assert.ok(run.errors.some((e) => e.includes('output limit')));
    assert.ok(run.errors.some((e) => e.includes('interrupted')));
});

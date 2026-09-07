'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Tests remain self-contained in a public checkout without exposing the real prompt.
if (
    !process.env.OPEN_ARENA_OFFGRID_PROMPT &&
    !process.env.OPEN_ARENA_OFFGRID_PROMPT_FILE &&
    !fs.existsSync(path.resolve(__dirname, '../.arena-pilot-prompt.txt'))
) {
    process.env.OPEN_ARENA_OFFGRID_PROMPT =
        'Fixture OffGrid instructions for unit tests only.';
}
const {
    ROSTER,
    WEIGHTS,
    GRADER_PROMPT,
    validateInput,
    candidateRequest,
    reviewerRequest,
    validateReview,
    scoreReviews,
    runComparison,
} = require('../server/open-arena/core');
const { OFFGRID_PROMPT } = require('../server/open-arena/prompt');
const {
    configuration,
    readiness,
    openRouterPayload,
    createProviders,
} = require('../server/open-arena/providers');
const {
    accessAllowed,
    reserveRun,
    registerOpenArenaRoutes,
} = require('../server/open-arena/routes');
const input = {
    prompt: 'What should I do with the tools I have?',
    image: null,
    mode: 'judge',
};
function review(groups = [['A'], ['B'], ['C'], ['D']]) {
    return {
        rankings: Object.fromEntries(
            Object.keys(WEIGHTS).map((k) => [k, groups]),
        ),
        reasons: Object.fromEntries(
            ['A', 'B', 'C', 'D'].map((l) => [
                l,
                {
                    accuracy: 'Supported facts.',
                    prioritization: 'Correct order.',
                    actionability: 'Executable steps.',
                },
            ]),
        ),
    };
}
const mapping = Object.fromEntries(
    ROSTER.map((m, i) => [String.fromCharCode(65 + i), m]),
);
const good = (text) => ({
    text,
    finishReason: 'stop',
    matched: true,
    metadata: { provider: 'Fixture only' },
});

test('matched requests differ only in system instructions', () => {
    for (const pair of ['e4b', '26b']) {
        const models = ROSTER.filter((m) => m.pair === pair);
        const [a, b] = models.map((m) =>
            candidateRequest(m, { ...input, image: 'same-image' }, 42),
        );
        assert.equal(a.system, OFFGRID_PROMPT);
        assert.equal(b.system, '');
        delete a.system;
        delete b.system;
        assert.deepEqual(a, b);
        assert.equal(a.settings.thinking, false);
        assert.ok(!('history' in a));
    }
});
test('canonical offline prompt matches evaluated Dashboard literal when reference is present', (t) => {
    const reference = process.env.OFFGRID_DASHBOARD_REFERENCE;
    if (!reference)
        return t.skip(
            'Set OFFGRID_DASHBOARD_REFERENCE for source parity verification.',
        );
    const html = fs.readFileSync(reference, 'utf8');
    const match = html.match(/fieldExpert:\s*(`(?:[^`\\]|\\.)*`)/);
    assert.ok(match);
    const expected = vm.runInNewContext(match[1]);
    assert.equal(OFFGRID_PROMPT, expected.replace(/\r\n/g, '\n'));
});
test('input rejects history-only prompts, oversized or external images, invalid modes', () => {
    for (const bad of [
        {},
        { prompt: ' ' },
        { prompt: 'x'.repeat(4001) },
        { prompt: 'q', image: 'https://example.com/i' },
        { prompt: 'q', mode: 'rigged' },
    ])
        assert.throws(() => validateInput(bad));
    assert.deepEqual(
        validateInput({
            ...input,
            messages: ['old answer'],
            system: 'override',
        }),
        { ...input, category: 'general' },
    );
});
test('rankings must be complete permutations, with substantive reasons', () => {
    assert.deepEqual(validateReview(JSON.stringify(review())), review());
    for (const groups of [
        [['A'], ['A'], ['C'], ['D']],
        [['A'], ['B'], ['C']],
        [['A'], [], ['B'], ['C'], ['D']],
        [['A'], ['B'], ['C'], ['E']],
        ['A', 'B', 'C', 'D'],
    ])
        assert.throws(() => validateReview(review(groups)));
    const bad = review();
    bad.reasons.B.accuracy = '';
    assert.throws(() => validateReview(bad));
    const extra = {
        ...review(),
        reviewer: 'Spoofed',
        labelMap: { A: 'optimized' },
        metadata: 'untrusted',
    };
    assert.deepEqual(validateReview(extra), review());
});
test('2:2:1 arithmetic, matched-pair results, and no empty-council winner', () => {
    const result = scoreReviews([{ review: review(), mapping }]);
    assert.equal(result.scores.optimized.total, 15);
    assert.equal(result.scores.e4b.total, 10);
    assert.equal(result.scores.advanced.total, 5);
    assert.equal(result.scores['26b'].total, 0);
    assert.equal(result.pairs[0].outcome, 'win');
    assert.throws(() => scoreReviews([]));
    const council = scoreReviews(Array(4).fill({ review: review(), mapping }));
    assert.deepEqual(council, result);
});
test('ties use average occupied positions and never alphabetical tiebreaking', () => {
    const result = scoreReviews([
        { review: review([['A', 'B', 'C', 'D']]), mapping },
    ]);
    assert.equal(result.winners.length, 4);
    for (const score of Object.values(result.scores))
        assert.equal(score.total, 7.5);
    assert.ok(result.pairs.every((p) => p.outcome === 'tie'));
    const two = scoreReviews([
        { review: review([['A', 'B'], ['C'], ['D']]), mapping },
    ]);
    assert.equal(two.scores.optimized.total, 12.5);
    assert.equal(two.ranking[2].place, 3);
});
test('review request includes original question, image, raw text, but no identity map or OffGrid prompt', () => {
    const map = Object.fromEntries(
        Object.entries(mapping).map(([k, v]) => [
            k,
            { ...v, text: `Raw answer ${k}` },
        ]),
    );
    const r = reviewerRequest({ ...input, image: 'same-image' }, map);
    assert.equal(r.image, 'same-image');
    assert.equal(r.system, GRADER_PROMPT);
    assert.equal(JSON.parse(r.prompt).answers.A, 'Raw answer A');
    assert.ok(!r.prompt.includes('conditioned'));
    assert.notEqual(r.system, OFFGRID_PROMPT);
});

test('identical answers cannot receive different grades', () => {
    const identical = Object.fromEntries(
        ['A', 'B', 'C', 'D'].map((k) => [k, { text: 'Same exact answer.' }]),
    );
    assert.throws(
        () => validateReview(review(), identical),
        /Identical answers/,
    );
    assert.doesNotThrow(() =>
        validateReview(review([['A', 'B', 'C', 'D']]), identical),
    );
});

test('label-only and placeholder reasons cannot become valid reviews', () => {
    for (const placeholder of [
        'A',
        'D',
        '...',
        'N/A',
        'Not applicable',
        'TBD',
    ]) {
        const result = review();
        result.reasons.A.accuracy = placeholder;
        assert.throws(() => validateReview(result), /explanation/);
    }
    const result = review();
    result.reasons.A.actionability =
        'No procedure requested; the visual description is sufficient.';
    assert.doesNotThrow(() => validateReview(result));
});
test('successful run preserves raw answers with no synthesis call', async () => {
    let calls = 0,
        judges = 0;
    const result = await runComparison(input, {
        generate: async (model) => {
            calls++;
            return good(`  # ${model.key}\n\nOriginal answer.  `);
        },
        review: async () => {
            judges++;
            return good(JSON.stringify(review()));
        },
    });
    assert.equal(result.status, 'complete');
    assert.equal(calls, 4);
    assert.equal(judges, 1);
    for (const answer of result.answers)
        assert.equal(answer.text, `  # ${answer.key}\n\nOriginal answer.  `);
    assert.ok(result.promptDigest);
    assert.ok(!JSON.stringify(result).includes(OFFGRID_PROMPT));
});
test('failures, empty replies, truncation and model mismatch are excluded, not ranked last', async () => {
    for (const failure of [
        { text: '', finishReason: 'stop', matched: true },
        { ...good('partial'), finishReason: 'length' },
        { ...good('answer'), matched: false },
    ]) {
        let judges = 0;
        const result = await runComparison(input, {
            generate: async (model) =>
                model.key === 'optimized' ? failure : good('answer'),
            review: async () => {
                judges++;
                return good(JSON.stringify(review()));
            },
        });
        assert.equal(result.status, 'incomplete');
        assert.equal(judges, 0);
        assert.equal(result.winners, undefined);
    }
});
test('invalid single judge or partial council cannot become a benchmark winner', async () => {
    for (const mode of ['judge', 'council']) {
        let judges = 0;
        const run = await runComparison(
            { ...input, mode },
            {
                generate: async () => good('answer'),
                review: async () => {
                    judges++;
                    return good(judges === 1 ? '{}' : JSON.stringify(review()));
                },
            },
        );
        assert.equal(run.status, 'incomplete');
        assert.equal(run.winners, undefined);
        assert.equal(judges, mode === 'judge' ? 1 : 4);
        assert.equal(run.reviews[0].valid, false);
        assert.equal(run.reviews[0].rawText, '{}');
    }
});
test('cancelled run makes no further calls', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        runComparison(
            input,
            { generate: () => assert.fail('Should not generate') },
            { signal: controller.signal },
        ),
        /cancelled/,
    );
});
test('generation provider routing is pinned with no fallback; GPT judge omits unsupported temperature', () => {
    const r = candidateRequest(ROSTER[2], input, 123);
    const payload = openRouterPayload(r.model, r, 'google-vertex/global');
    assert.deepEqual(payload.provider.only, ['google-vertex/global']);
    assert.equal(payload.provider.allow_fallbacks, false);
    assert.equal(payload.provider.require_parameters, true);
    assert.equal(payload.seed, 123);
    assert.equal(payload.messages[0].content, OFFGRID_PROMPT);
    const judge = openRouterPayload(
        'openai/gpt-5.2',
        { prompt: 'q', system: GRADER_PROMPT },
        'openai',
        true,
    );
    assert.ok(!('temperature' in judge));
    assert.equal(judge.messages[0].content, GRADER_PROMPT);
});
test('provider metadata is checked, not inferred from requested labels', async () => {
    const config = configuration({});
    const providers = createProviders(config, async () => ({
        ok: true,
        json: async () => ({
            model: ROSTER[2].model,
            provider: 'Wrong provider',
            choices: [
                { message: { content: 'answer' }, finish_reason: 'stop' },
            ],
        }),
    }));
    const result = await providers.generate(
        ROSTER[2],
        candidateRequest(ROSTER[2], input, 3),
    );
    assert.equal(result.matched, false);
    assert.equal(result.text, 'answer');
});
test('pilot defaults fail closed and access keys never accept empty values', () => {
    assert.ok(readiness(configuration({})).length >= 4);
    assert.equal(accessAllowed('', ''), false);
    assert.equal(accessAllowed('wrong', 'secret'), false);
    assert.equal(accessAllowed('secret', 'secret'), true);
});

test('E4B identity includes pinned runtime, artifact and actual generation settings', async () => {
    const { E4B_DIGEST } = require('../server/open-arena/core');
    const data = {
        model: 'gemma4:e4b',
        artifactDigest: E4B_DIGEST,
        runtime: '0.33.3',
        verified: true,
        text: 'Original answer.',
        finishReason: 'stop',
        settings: {
            temperature: 1,
            top_k: 64,
            top_p: 0.95,
            num_ctx: 4096,
            num_predict: 2048,
            seed: 3,
            num_thread: 4,
            think: false,
        },
    };
    const providers = createProviders(configuration({}), async () => ({
        ok: true,
        json: async () => data,
    }));
    const request = candidateRequest(ROSTER[0], input, 3);
    assert.equal((await providers.generate(ROSTER[0], request)).matched, true);
    data.settings.temperature = 0.7;
    assert.equal((await providers.generate(ROSTER[0], request)).matched, false);
    data.settings.temperature = 1;
    data.runtime = 'different-runtime';
    assert.equal((await providers.generate(ROSTER[0], request)).matched, false);
});
test('usage guard fails closed when database is down', async () => {
    await assert.rejects(
        reserveRun(
            {
                connect: async () => {
                    throw new Error('DB unavailable');
                },
            },
            configuration({}),
        ),
    );
});
test('monthly usage cap blocks calls and releases its advisory lock', async () => {
    const queries = [];
    let released = false;
    const client = {
        query: async (sql) => {
            queries.push(sql);
            return {
                rows: sql.includes('pg_try')
                    ? [{ acquired: true }]
                    : sql.startsWith('SELECT COALESCE')
                      ? [{ monthly: 20, daily: 1 }]
                      : [],
            };
        },
        release: () => (released = true),
    };
    await assert.rejects(
        reserveRun({ connect: async () => client }, configuration({})),
        /allowance/,
    );
    assert.ok(queries.some((q) => q.includes('pg_advisory_unlock')));
    assert.equal(released, true);
    assert.ok(!queries.some((q) => q.startsWith('INSERT')));
});

test('usage cleanup destroys a connection if its advisory lock cannot be released', async () => {
    let destroyed = false;
    const client = {
        query: async (sql) => {
            if (sql.includes('pg_advisory_unlock'))
                throw new Error('Connection failed');
            return {
                rows: sql.includes('pg_try')
                    ? [{ acquired: true }]
                    : sql.startsWith('SELECT COALESCE')
                      ? [{ monthly: 0, daily: 0 }]
                      : [],
            };
        },
        release: (destroy) => {
            destroyed = destroy;
        },
    };
    const release = await reserveRun(
        { connect: async () => client },
        configuration({}),
    );
    await assert.rejects(release());
    assert.equal(destroyed, true);
});

test('HTTP route gates credentials, readiness, inputs and budget before any model call', async (t) => {
    const express = require('express');
    const config = {
        ...configuration({}),
        enabled: true,
        budgetsConfirmed: true,
        promptReady: true,
        accessKey: 'fixture-access-only',
        modalUrl: 'https://fixture.modal.run',
        modalKey: 'fixture-modal',
        modalSecret: 'fixture-secret',
        apiKey: 'fixture-router',
    };
    let calls = 0,
        reservations = 0,
        releases = 0,
        quotaChecks = 0,
        deniedBudget = false;
    const app = express();
    app.use(express.json());
    registerOpenArenaRoutes(app, {
        config,
        requireLicense: (req, res, next) => next(),
        checkPromptLimit: (req, res, next) => {
            quotaChecks++;
            next();
        },
        incrementUsage: async () => {},
        reserve: async () => {
            reservations++;
            if (deniedBudget) throw new Error('Budget used up');
            return async () => {
                releases++;
            };
        },
        providers: {
            generate: async () => {
                calls++;
                return good('  Original answer.  ');
            },
            review: async () => {
                calls++;
                return good(JSON.stringify(review([['A', 'B', 'C', 'D']])));
            },
        },
    });
    app.post('/api/command/query', (req, res) => res.json({ legacy: true }));
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    t.after(() => {
        server.closeAllConnections();
        return new Promise((resolve) => server.close(resolve));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body = input, key = config.accessKey) =>
        fetch(`${base}/api/open-arena/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Arena-Access': key,
            },
            body: JSON.stringify(body),
        });
    assert.equal((await post(input, 'wrong')).status, 403);
    assert.equal(quotaChecks, 0);
    config.budgetsConfirmed = false;
    assert.equal((await post()).status, 503);
    assert.equal(quotaChecks, 0);
    config.budgetsConfirmed = true;
    assert.equal((await post({ prompt: '' })).status, 400);
    assert.equal(reservations, 0);
    deniedBudget = true;
    assert.equal((await post()).status, 429);
    assert.equal(calls, 0);
    deniedBudget = false;
    const response = await post();
    assert.equal(response.status, 200);
    const packets = (await response.text())
        .split('\n\n')
        .filter((p) => p.startsWith('data: '))
        .map((p) => JSON.parse(p.slice(6)));
    const result = packets.find((p) => p.type === 'result').run;
    assert.equal(result.status, 'complete');
    assert.equal(calls, 5);
    assert.equal(releases, 1);
    assert.ok(result.answers.every((a) => a.text === '  Original answer.  '));
    const publicConfig = await (
        await fetch(`${base}/api/open-arena/config`)
    ).text();
    for (const secret of [
        config.accessKey,
        config.apiKey,
        config.modalKey,
        config.modalSecret,
        OFFGRID_PROMPT,
    ])
        assert.ok(!publicConfig.includes(secret));
    const legacy = await fetch(`${base}/api/command/query`, {
        method: 'POST',
        headers: { 'X-OffGrid-Client': 'open-arena' },
    });
    assert.equal(legacy.status, 200);
    assert.deepEqual(await legacy.json(), { legacy: true });
});

test('new route is additive and categories do not change candidate or grader messages', () => {
    const categorized = validateInput({ ...input, category: 'repairs' });
    assert.equal(categorized.category, 'repairs');
    assert.throws(
        () => validateInput({ ...input, category: ['water'] }),
        /category/,
    );
    assert.throws(
        () => validateInput({ ...input, category: 'constructor' }),
        /category/,
    );
    assert.throws(
        () => validateInput({ ...input, category: '<script>' }),
        /category/,
    );
    assert.equal(validateInput(input).category, 'general');
    assert.deepEqual(
        candidateRequest(ROSTER[0], categorized, 42),
        candidateRequest(ROSTER[0], input, 42),
    );
    const source = fs.readFileSync(
        path.resolve(__dirname, '../index.js'),
        'utf8',
    );
    assert.match(source, /app\.get\('\/open-arena'/);
    assert.match(
        source,
        /app\.get\('\/arena-open', \(req, res\) => \{\s*res\.sendFile\(path\.join\(__dirname, 'arena-open\.html'\)\)/,
    );
    assert.ok(!source.includes("app.use('/api/arena-open/', commandLimiter)"));
});

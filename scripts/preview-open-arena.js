'use strict';
process.env.OPEN_ARENA_OFFGRID_PROMPT = 'Local UI fixture instructions only.';
// Loopback-only fixture server for UI verification. It cannot call model services.
if (process.env.NODE_ENV === 'production')
    throw new Error('UI fixture server is development-only.');
const express = require('express');
const path = require('node:path');
const {
    ROSTER,
    GRADER_PROMPT,
    WEIGHTS,
    VERSION,
    runComparison,
} = require('../server/open-arena/core');
const app = express();
app.use(express.json({ limit: '3mb' }));
app.get('/arena-open', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../arena-open-matched.html')),
);
app.get('/api/arena-open/config', (req, res) =>
    res.json({
        roster: ROSTER,
        ready: true,
        issues: [],
        rosterVersion: VERSION,
        graderPrompt: GRADER_PROMPT,
        privacy: 'LOCAL UI FIXTURES ONLY. No AI providers receive this data.',
    }),
);
app.post('/api/arena-open/run', async (req, res) => {
    const groups = req.body.prompt.includes('tie')
        ? [['A', 'B', 'C', 'D']]
        : [['A'], ['B'], ['C'], ['D']];
    const review = {
        rankings: Object.fromEntries(
            Object.keys(WEIGHTS).map((c) => [c, groups]),
        ),
        reasons: Object.fromEntries(
            ['A', 'B', 'C', 'D'].map((l) => [
                l,
                {
                    accuracy: 'UI fixture: checking reason display.',
                    prioritization: 'UI fixture: checking ordered steps.',
                    actionability: 'UI fixture: checking practical detail.',
                },
            ]),
        ),
    };
    const signal = new AbortController();
    res.on('close', () => signal.abort());
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
    });
    res.flushHeaders();
    const send = (x) => {
        if (!res.destroyed) res.write(`data: ${JSON.stringify(x)}\n\n`);
    };
    try {
        const run = await runComparison(
            req.body,
            {
                async generate(model) {
                    await new Promise((resolve) =>
                        setTimeout(
                            resolve,
                            req.body.prompt.includes('slow') ? 2000 : 60,
                        ),
                    );
                    return {
                        text:
                            '## UI verification fixture\n\nThis is sample text, not an AI benchmark answer.\n\n1. Check the available resources.\n2. Choose the next action.\n\n| Resource | Status |\n| --- | --- |\n| Flashlight | Available |\n| Map | Available |\n\n**Keep original formatting.**\n\n<img src="https://example.com/tracker" onerror="alert(1)">\n\n`A_long_reference_identifier_that_must_wrap_on_a_small_phone_screen_without_overflow_1234567890`\n\nFixture item: ' +
                            model.key,
                        matched: true,
                        finishReason:
                            req.body.prompt.includes('incomplete') &&
                            model.key === 'e4b'
                                ? 'length'
                                : 'stop',
                        metadata: {
                            provider: 'LOCAL FIXTURE',
                            model: model.model,
                            runtime: 'fixture-only',
                        },
                    };
                },
                async review() {
                    return {
                        text: req.body.prompt.includes('bad-review')
                            ? '{}'
                            : JSON.stringify(review),
                        matched: true,
                        finishReason: 'stop',
                        metadata: { provider: 'LOCAL FIXTURE' },
                    };
                },
            },
            {
                signal: signal.signal,
                onProgress: (x) => send({ type: 'progress', ...x }),
            },
        );
        send({ type: 'result', run });
    } catch {
        send({ type: 'error', error: 'Fixture cancelled.' });
    } finally {
        res.end();
    }
});
app.use(
    '/assets/arena',
    express.static(path.resolve(__dirname, '../assets/arena')),
);
app.get('/compass-192.png', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../compass-192.png')),
);
app.listen(3108, '127.0.0.1', () =>
    console.log(
        'UI FIXTURE preview: http://127.0.0.1:3108/arena-open (no model calls)',
    ),
);

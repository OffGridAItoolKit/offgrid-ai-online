'use strict';
// Explicit, bounded technical probes. Results are not held-out benchmark evidence.
const fs = require('node:fs');
const path = require('node:path');
const {
    ROSTER,
    candidateRequest,
    reviewerRequest,
    validateReview,
    runComparison,
} = require('../server/open-arena/core');
const {
    configuration,
    createProviders,
} = require('../server/open-arena/providers');
const command = process.argv[2];
if (!['e4b', 'image', 'e4b-review', 'judge', 'council'].includes(command))
    throw new Error('Choose e4b, image, e4b-review, judge or council.');
const config = configuration();
if (!config.promptReady)
    throw new Error(
        'Configure the verified private OffGrid prompt before running a pilot.',
    );
const adapters = createProviders(config);
const input = {
    prompt:
        command === 'image'
            ? 'Describe the visible object in this image, including its colors and shape. Be concise.'
            : 'In three brief steps, how would you organize a small campsite so essential supplies can be found quickly in the dark?',
    image:
        command === 'image'
            ? `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../compass-192.png')).toString('base64')}`
            : null,
    mode: command === 'council' ? 'council' : 'judge',
};
(async () => {
    if (['judge', 'council'].includes(command)) {
        if (!config.apiKey)
            throw new Error('Dedicated OpenRouter key is not set.');
        const response = await fetch('https://openrouter.ai/api/v1/key', {
            headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (!response.ok) throw new Error('OpenRouter key validation failed.');
        const { data } = await response.json();
        if (
            typeof data.limit !== 'number' ||
            data.limit > 25 ||
            data.limit_remaining <= 0 ||
            data.limit_reset !== 'monthly'
        ) {
            throw new Error(
                'Pilot requires an OpenRouter key capped at $25/month or less, with remaining allowance.',
            );
        }
        console.log(
            'Dedicated API-key monthly budget verified; no key was printed.',
        );
    }
    let result;
    if (command === 'e4b' || command === 'image') {
        result = {
            technicalProbe: true,
            createdAt: new Date().toISOString(),
            prompt: input.prompt,
            imageIncluded: !!input.image,
            answers: [],
        };
        for (const model of ROSTER.filter((m) => m.pair === 'e4b')) {
            try {
                const answer = await adapters.generate(
                    model,
                    candidateRequest(model, input, 1984),
                );
                result.answers.push({ ...model, ...answer });
                console.log(
                    JSON.stringify({
                        name: model.name,
                        matched: answer.matched,
                        finishReason: answer.finishReason,
                        metadata: answer.metadata,
                    }),
                );
                if (
                    !answer.matched ||
                    answer.finishReason !== 'stop' ||
                    !answer.text.trim()
                )
                    process.exitCode = 1;
            } catch (error) {
                result.answers.push({
                    ...model,
                    error: error.message,
                    matched: false,
                });
                console.error(`${model.name}: ${error.message}`);
                process.exitCode = 1;
            }
        }
    } else if (command === 'e4b-review') {
        result = {
            technicalProbe: true,
            createdAt: new Date().toISOString(),
            purpose: 'E4B JSON review protocol, not a benchmark',
        };
        const mapping = Object.fromEntries(
            ['A', 'B', 'C', 'D'].map((label) => [
                label,
                {
                    text: '1. Pick one easily reached place for essentials. 2. Group and label supplies by use. 3. Put a light there and make sure everyone knows the layout.',
                },
            ]),
        );
        try {
            result.response = await adapters.review(
                ROSTER[0],
                reviewerRequest(input, mapping),
            );
            result.review = validateReview(result.response.text, mapping);
            if (
                !result.response.matched ||
                result.response.finishReason !== 'stop'
            )
                throw new Error('Review identity or completion check failed.');
            console.log(
                JSON.stringify({
                    matched: result.response.matched,
                    finishReason: result.response.finishReason,
                    metadata: result.response.metadata,
                    rankings: result.review.rankings,
                }),
            );
        } catch (error) {
            result.error = error.message;
            console.error(error.message);
            process.exitCode = 1;
        }
    } else {
        result = await runComparison(input, adapters, {
            onProgress: (progress) => console.log(progress.message),
        });
        console.log(
            JSON.stringify({
                status: result.status,
                elapsedMs: result.elapsedMs,
                errors: result.errors,
                answers: result.answers.map((a) => ({
                    key: a.key,
                    valid: a.valid,
                    metadata: a.metadata,
                })),
                pairs: result.pairs,
            }),
        );
        if (result.status !== 'complete') process.exitCode = 1;
    }
    fs.mkdirSync(path.resolve(__dirname, '../test-results'), {
        recursive: true,
    });
    const output = path.resolve(
        __dirname,
        `../test-results/pilot-${command}-${Date.now()}.json`,
    );
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(`Technical probe saved: ${output}`);
})().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});

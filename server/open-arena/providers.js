'use strict';

const { MODEL_26B, E4B_DIGEST } = require('./core');
const { PROMPT_READY } = require('./prompt');
const { RELIABILITY_VERSION, createPost } = require('./transport');
const { FORMAT, REVIEW_SCHEMA } = require('./review-schema');

function configuration(env = process.env) {
    return {
        enabled: env.OPEN_ARENA_MATCHED_ENABLED === 'true',
        publicAccess: env.OPEN_ARENA_PUBLIC_ACCESS === 'true',
        budgetsConfirmed: env.OPEN_ARENA_BUDGETS_CONFIRMED === 'true',
        promptReady: PROMPT_READY,
        accessKey: env.OPEN_ARENA_ACCESS_KEY || '',
        modalUrl: env.OPEN_ARENA_MODAL_URL || '',
        modalKey: env.OPEN_ARENA_MODAL_KEY || '',
        modalSecret: env.OPEN_ARENA_MODAL_SECRET || '',
        apiKey: env.OPEN_ARENA_OPENROUTER_KEY || '',
        provider26: env.OPEN_ARENA_26B_PROVIDER || 'google-vertex/global',
        provider26Name: env.OPEN_ARENA_26B_PROVIDER_NAME || 'Google',
        judgeProvider: env.OPEN_ARENA_JUDGE_PROVIDER || 'openai',
        judgeProviderName: env.OPEN_ARENA_JUDGE_PROVIDER_NAME || 'OpenAI',
        monthlyRunLimit: Math.min(
            100,
            Math.max(1, Number(env.OPEN_ARENA_MONTHLY_RUN_LIMIT) || 20),
        ),
        dailyRunLimit: Math.min(
            20,
            Math.max(1, Number(env.OPEN_ARENA_DAILY_RUN_LIMIT) || 10),
        ),
    };
}
function readiness(config) {
    const missing = [];
    if (!config.enabled) missing.push('Pilot is not enabled.');
    if (!config.budgetsConfirmed)
        missing.push('Provider spending limits have not been confirmed.');
    if (!config.promptReady)
        missing.push('The verified private OffGrid prompt is not configured.');
    if (!config.publicAccess && !config.accessKey)
        missing.push('Pilot access is not configured.');
    if (
        !/^https:\/\/[^/]+\.modal\.run\/?$/.test(config.modalUrl) ||
        !config.modalKey ||
        !config.modalSecret
    )
        missing.push('Gemma 4 E4B hosting is not connected.');
    if (!config.apiKey)
        missing.push('Budget-limited OpenRouter key is not connected.');
    return missing;
}
function messages(request) {
    const content = request.image
        ? [
              { type: 'text', text: request.prompt },
              { type: 'image_url', image_url: { url: request.image } },
          ]
        : request.prompt;
    return [
        ...(request.system
            ? [{ role: 'system', content: request.system }]
            : []),
        { role: 'user', content },
    ];
}
function openRouterPayload(
    model,
    request,
    provider,
    grading = false,
    maxReviewTokens = 4096,
) {
    return {
        model,
        messages: messages(request),
        max_tokens: grading ? maxReviewTokens : request.settings.max_tokens,
        ...(model === MODEL_26B
            ? { temperature: grading ? 0.2 : request.settings.temperature }
            : {}),
        ...(grading
            ? {
                  response_format:
                      model === MODEL_26B
                          ? {
                                type: 'json_schema',
                                json_schema: {
                                    name: FORMAT,
                                    strict: true,
                                    schema: REVIEW_SCHEMA,
                                },
                            }
                          : { type: 'json_object' },
              }
            : {
                  top_p: request.settings.top_p,
                  top_k: request.settings.top_k,
                  seed: request.settings.seed,
              }),
        reasoning: { enabled: false },
        provider: {
            only: [provider],
            allow_fallbacks: false,
            require_parameters: true,
            data_collection: 'deny',
        },
        stream: false,
    };
}
function createProviders(config, fetchImpl = fetch, sleep) {
    const post = createPost(fetchImpl, sleep);
    async function openRouter(
        model,
        request,
        grading,
        signal,
        { maxTokens = 4096, timeoutMs = 180000, onRetry } = {},
    ) {
        const is26 = model === MODEL_26B;
        const provider = is26 ? config.provider26 : config.judgeProvider;
        const providerName = is26
            ? config.provider26Name
            : config.judgeProviderName;
        const payload = openRouterPayload(
            model,
            request,
            provider,
            grading,
            maxTokens,
        );
        const started = Date.now();
        const { data, transport, failed } = await post(
            'https://openrouter.ai/api/v1/chat/completions',
            payload,
            {
                Authorization: `Bearer ${config.apiKey}`,
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid Matched-Pair Arena',
            },
            signal,
            timeoutMs,
            { maxAttempts: is26 && !grading ? 3 : 1, onRetry },
        ).catch((error) => {
            error.metadata = {
                providerRoute: provider,
                expectedProvider: providerName,
                expectedModel: model,
                transport: error.transport,
            };
            throw error;
        });
        return {
            text: data.choices?.[0]?.message?.content || '',
            finishReason: failed ? 'error' : data.choices?.[0]?.finish_reason,
            matched: data.model === model && data.provider === providerName,
            metadata: {
                provider: data.provider,
                providerRoute: provider,
                model: data.model,
                generationId: data.id,
                usage: data.usage,
                elapsedMs: Date.now() - started,
                transport,
                settings: {
                    max_tokens: payload.max_tokens,
                    temperature: payload.temperature,
                    top_p: payload.top_p,
                    top_k: payload.top_k,
                    seed: payload.seed,
                    reasoning: payload.reasoning,
                    response_format: payload.response_format,
                },
                offlineParity:
                    'Hosted weights/runtime, not the USB GGUF artifact',
            },
        };
    }
    async function modal(request, grading, signal) {
        const started = Date.now();
        const { data, transport, failed } = await post(
            `${config.modalUrl.replace(/\/$/, '')}/generate`,
            {
                prompt: request.prompt,
                system: request.system || '',
                image: request.image,
                grading,
                ...(grading ? { reviewFormat: FORMAT } : {}),
                seed: request.settings?.seed || 0,
            },
            {
                'Modal-Key': config.modalKey,
                'Modal-Secret': config.modalSecret,
            },
            signal,
            140000,
        ).catch((error) => {
            error.metadata = {
                expectedProvider: 'Modal / Ollama',
                expectedModel: 'gemma4:e4b',
                transport: error.transport,
            };
            throw error;
        });
        const expected = {
            temperature: grading ? 0.2 : 1,
            top_k: 64,
            top_p: 0.95,
            num_ctx: grading ? 32768 : 4096,
            num_predict: grading ? 4096 : 2048,
            seed: request.settings?.seed || 0,
            num_thread: 4,
            think: false,
        };
        return {
            text: data.text || '',
            finishReason: failed ? 'error' : data.finishReason,
            matched:
                data.model === 'gemma4:e4b' &&
                data.artifactDigest === E4B_DIGEST &&
                data.runtime === '0.33.3' &&
                (!grading || data.reviewFormat === FORMAT) &&
                data.verified === true &&
                Object.entries(expected).every(
                    ([key, value]) => data.settings?.[key] === value,
                ),
            metadata: {
                provider: 'Modal / Ollama',
                model: data.model,
                artifactDigest: data.artifactDigest,
                runtime: data.runtime,
                settings: data.settings,
                ...(grading ? { reviewFormat: data.reviewFormat } : {}),
                usage: data.usage,
                elapsedMs: Date.now() - started,
                transport,
                offlineParity: 'Pinned USB model layer; Linux GPU runtime',
            },
        };
    }
    return {
        reliabilityVersion: RELIABILITY_VERSION,
        classify(request, signal) {
            return openRouter('openai/gpt-5.2', request, true, signal, {
                maxTokens: 128,
                timeoutMs: 20000,
            });
        },
        generate(model, request, signal, options = {}) {
            return model.pair === 'e4b'
                ? modal(request, false, signal)
                : openRouter(model.model, request, false, signal, options);
        },
        review(model, request, signal) {
            return model.pair === 'e4b'
                ? modal(request, true, signal)
                : openRouter(model.model, request, true, signal);
        },
    };
}
module.exports = {
    configuration,
    readiness,
    messages,
    openRouterPayload,
    createProviders,
};

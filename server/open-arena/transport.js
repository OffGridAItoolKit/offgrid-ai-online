'use strict';

const { setTimeout: delay } = require('node:timers/promises');
const RELIABILITY_VERSION = 'same-provider-transient-v1';
const TRANSIENT = new Set([429, 502, 503, 504]);

function retryAfterMs(value, now = Date.now()) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value) * 1000;
    // HTTP-date values, not arbitrary strings accepted as dates by JavaScript.
    if (!/^[A-Za-z]{3}, /.test(value)) return null;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function serviceMessage(status) {
    if (status === 429) return 'Model service is rate-limited (HTTP 429).';
    if ([502, 503, 504].includes(status))
        return `Model service is temporarily unavailable (HTTP ${status}).`;
    if (status === 402)
        return 'Model service credit allowance is unavailable (HTTP 402).';
    return status
        ? `Model service returned HTTP ${status}.`
        : 'Model service did not produce an answer.';
}

function hasOutput(data) {
    return Boolean(
        data?.text ||
            data?.usage?.completion_tokens > 0 ||
            data?.choices?.some((choice) => {
                const message = choice.message || choice.delta;
                return (
                    message?.content ||
                    message?.reasoning ||
                    message?.reasoning_content ||
                    message?.tool_calls?.length
                );
            }),
    );
}

function createPost(fetchImpl = fetch, sleep = delay) {
    return async function post(
        url,
        payload,
        headers,
        signal,
        timeoutMs,
        { maxAttempts = 1, onRetry = () => {} } = {},
    ) {
        const started = Date.now();
        const combined = AbortSignal.any([
            ...(signal ? [signal] : []),
            AbortSignal.timeout(timeoutMs),
        ]);
        const transport = { version: RELIABILITY_VERSION, attempts: [] };
        // Reuse the exact serialized request, including seed and pinned provider.
        const body = JSON.stringify(payload);
        let failureMessage;
        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                combined.throwIfAborted();
                const record = { attempt, outcome: 'connection-error' };
                transport.attempts.push(record);
                const attemptStart = Date.now();
                const response = await fetchImpl(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body,
                    signal: combined,
                    redirect: 'error',
                });
                record.httpStatus = response.status || 200;
                record.outcome = response.ok ? 'response' : 'http-error';
                let data;
                try {
                    data = await response.json();
                } catch {
                    if (response.ok) {
                        failureMessage =
                            'Model service returned an unreadable response.';
                        throw new Error(failureMessage);
                    }
                }
                record.elapsedMs = Date.now() - attemptStart;
                if (
                    response.ok &&
                    (!data || typeof data !== 'object' || Array.isArray(data))
                ) {
                    failureMessage =
                        'Model service returned an unreadable response.';
                    throw new Error(failureMessage);
                }
                const code = Number(data?.error?.code);
                const status = !response.ok
                    ? response.status
                    : Number.isInteger(code) && code >= 400 && code <= 599
                      ? code
                      : null;
                if (data?.error) {
                    record.outcome = 'provider-error';
                    record.errorCode = status;
                }
                if (response.ok && !data?.error)
                    return { data, transport, failed: false };
                // Never discard generated content and reroll it, even on a transient error.
                if (hasOutput(data)) return { data, transport, failed: true };
                failureMessage = serviceMessage(status);
                const headerDelay = retryAfterMs(
                    response.headers?.get('retry-after'),
                );
                const waitMs = Math.max(
                    5000 * 2 ** (attempt - 1),
                    headerDelay ?? 0,
                );
                if (headerDelay !== null) record.retryAfterMs = headerDelay;
                if (
                    !TRANSIENT.has(status) ||
                    attempt === maxAttempts ||
                    waitMs > 60000 ||
                    Date.now() - started + waitMs >= timeoutMs
                )
                    break;
                record.retryDelayMs = waitMs;
                onRetry({
                    status,
                    attempt,
                    nextAttempt: attempt + 1,
                    maxAttempts,
                    waitMs,
                });
                await sleep(waitMs, undefined, { signal: combined });
                failureMessage = undefined;
            }
            throw new Error(failureMessage);
        } catch {
            // Provider bodies can contain prompts, URLs and credentials: retain only our own fields.
            const message = combined.aborted
                ? signal?.aborted
                    ? 'Run cancelled.'
                    : 'Model service timed out.'
                : failureMessage || 'Unable to reach the model service.';
            const attempts = transport.attempts.length;
            const error = new Error(
                `${message}${attempts > 1 ? ` After ${attempts} attempts on the same provider.` : ''}`,
            );
            error.transport = transport;
            throw error;
        }
    };
}

module.exports = { RELIABILITY_VERSION, retryAfterMs, createPost };

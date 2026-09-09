'use strict';

const { configuration, createProviders } = require('./open-arena/providers');

const MODEL_ID = 'gemma4:e4b';
const INFERENCE = 'modal-e4b';
const TIMEOUT_MS = 145000;

function isOptimized(model) {
    return model?.id === MODEL_ID && model.inference === INFERENCE;
}

function keepAlive(res) {
    res.write(': Waiting for hosted E4B\n\n');
    const timer = setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(': E4B running\n\n');
    }, 15000);
    timer.unref();
    return () => clearInterval(timer);
}

function toRequest(messages, grading = false) {
    const systems = [];
    const turns = [];
    const images = [];
    if (!Array.isArray(messages)) throw new Error('Messages are required.');
    for (const message of messages) {
        if (!['system', 'user', 'assistant'].includes(message.role))
            throw new Error('Optimized received an unsupported message role.');
        let text;
        if (typeof message.content === 'string') text = message.content;
        else if (Array.isArray(message.content)) {
            text = message.content.map(part => {
                if (part.type === 'text' && typeof part.text === 'string') return part.text;
                if (part.type === 'image_url' && message.role === 'user') {
                    images.push(part.image_url?.url);
                    return '';
                }
                throw new Error('Optimized received unsupported message content.');
            }).filter(Boolean).join('\n');
        } else throw new Error('Optimized received invalid message content.');
        if (message.role === 'system') systems.push(text);
        else turns.push({ role: message.role, text });
    }
    if (!turns.length || turns.at(-1).role !== 'user')
        throw new Error('Optimized needs a user question.');
    // The fixed host accepts one prompt. Preserve prior turns explicitly, never truncate them.
    const prompt = turns.length === 1 ? turns[0].text : turns.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}:\n${turn.text}`,
    ).join('\n\n');
    const system = systems.join('\n\n');
    if (!prompt.trim() || prompt.length > (grading ? 100000 : 4000) || system.length > 16000)
        throw new Error('Optimized context is too long. Start a new chat with a shorter question.');
    if (images.length > 1)
        throw new Error('Optimized supports one image per chat. Start a new chat for another image.');
    if (images.length && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(images[0]) ||
        Buffer.from(images[0].split(',')[1], 'base64').length > 2 * 1024 * 1024))
        throw new Error('Optimized needs a PNG, JPEG or WebP image under 2 MB.');
    return { prompt, system, image: images[0] || null, settings: { seed: 0 } };
}

function createLegacyOptimized({ pool, config = configuration(), providers = createProviders(config) }) {
    async function acquire() {
        if (!config.enabled || !config.budgetsConfirmed ||
            !/^https:\/\/[^/]+\.modal\.run\/?$/.test(config.modalUrl) ||
            !config.modalKey || !config.modalSecret)
            throw new Error('Optimized hosting is not configured.');
        let client;
        try { client = await pool.connect(); }
        catch { throw new Error('Optimized hosting guard is unavailable. Please try again.'); }
        try {
            // Share the matched Arena GPU lock, without changing its run counters or history.
            const result = await client.query('SELECT pg_try_advisory_lock(70410261) AS acquired');
            if (!result.rows[0]?.acquired) {
                client.release();
                throw new Error('Another E4B run is in progress. Please try again shortly.');
            }
        } catch (error) {
            if (error.message.startsWith('Another E4B')) throw error;
            client.release(true);
            throw new Error('Optimized hosting guard is unavailable. Please try again.');
        }
        let released = false;
        return async () => {
            if (released) return;
            released = true;
            try {
                await client.query('SELECT pg_advisory_unlock(70410261)');
                client.release();
            } catch { client.release(true); }
        };
    }

    async function call(messages, { grading = false, signal } = {}) {
        const request = toRequest(messages, grading);
        const model = { pair: 'e4b', model: MODEL_ID };
        const result = await (grading ? providers.review : providers.generate)(model, request, signal);
        if (!result.matched) throw new Error('Optimized model identity could not be verified.');
        if (result.finishReason !== 'stop' || !result.text?.trim())
            throw new Error('Optimized returned an incomplete response. Please use a shorter question.');
        return result;
    }
    return { acquire, call };
}

module.exports = { MODEL_ID, INFERENCE, TIMEOUT_MS, isOptimized, keepAlive, toRequest, createLegacyOptimized };

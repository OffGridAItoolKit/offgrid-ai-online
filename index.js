/**
 * OffGrid AI ToolKit Online - Backend API Server
 * 
 * This server acts as a secure proxy between the frontend and OpenRouter API,
 * keeping the API key secure on the server side.
 * 
 * Includes:
 * - Original Gemma 3 model routing (free demo)
 * - Command Center multi-model routing (Scout, Medic, Navigator, Ranger)
 * - Command Council mode (parallel calls + competitive ranking + synthesis)
 * - Response streaming for all endpoints
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// CONFIGURATION
// =============================================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Original Gemma 3 Models (Free Demo)
const GEMMA_MODELS = {
    'gemma-3-27b': {
        id: 'google/gemma-3-27b-it',
        name: 'Gemma 3 27B',
        description: 'Most capable Gemma 3 model - Maximum intelligence',
        multimodal: true,
        responseTime: '~2-5 seconds'
    },
    'gemma-3-12b': {
        id: 'google/gemma-3-12b-it',
        name: 'Gemma 3 12B',
        description: 'Balanced performance and speed',
        multimodal: true,
        responseTime: '~1-3 seconds'
    },
    'gemma-3-4b': {
        id: 'google/gemma-3-4b-it',
        name: 'Gemma 3 4B',
        description: 'Lightweight, fastest response',
        multimodal: true,
        responseTime: '~1-2 seconds'
    },
    'medgemma-3-4b': {
        id: 'google/medgemma-4b-it',
        name: 'MedGemma 3 4B',
        description: 'Specialized for medical/healthcare questions',
        multimodal: true,
        responseTime: '~1-2 seconds'
    }
};

// Command Center Models (Premium)
const COMMAND_MODELS = {
    'scout': {
        id: 'openai/gpt-5.2',
        name: 'Scout (GPT 5.2)',
        shortName: 'Scout',
        emoji: '🔭',
        description: 'Vision Specialist',
        multimodal: true
    },
    'medic': {
        id: 'anthropic/claude-sonnet-4',
        name: 'Medic (Claude 4.5 Sonnet)',
        shortName: 'Medic',
        emoji: '🏥',
        description: 'Safety & Analysis',
        multimodal: true
    },
    'navigator': {
        id: 'google/gemini-2.5-pro',
        name: 'Navigator (Gemini 2.5 Pro)',
        shortName: 'Navigator',
        emoji: '🧭',
        description: 'Research & Planning',
        multimodal: true
    },
    'ranger': {
        id: 'x-ai/grok-4.1-fast',
        name: 'Ranger (Grok 4.1)',
        shortName: 'Ranger',
        emoji: '🏕️',
        description: 'Creative Solutions',
        multimodal: true
    }
};

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS Configuration
app.use(cors({
    origin: true,
    credentials: true
}));

// JSON body parser with size limit for images
app.use(express.json({ limit: '10mb' }));

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Rate limiting for free demo API
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
    message: { 
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false }
});

// Rate limiting for Command Center (more generous)
const commandLimiter = rateLimit({
    windowMs: 60000,
    max: 20,
    message: { 
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false }
});

app.use('/api/chat', limiter);
app.use('/api/stream', limiter);
app.use('/api/command/', commandLimiter);

// Serve static files from the same directory as index.js (flat structure)
app.use(express.static(__dirname));

// Request logging (minimal for privacy)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build OpenRouter-compatible messages array from request messages
 */
function buildOpenRouterMessages(messages, multimodal = true) {
    return messages.map(msg => {
        if (msg.image && multimodal) {
            return {
                role: msg.role,
                content: [
                    { type: 'text', text: msg.content || 'Describe this image in detail.' },
                    { 
                        type: 'image_url', 
                        image_url: { 
                            url: msg.image.startsWith('data:') 
                                ? msg.image 
                                : `data:image/jpeg;base64,${msg.image}`
                        }
                    }
                ]
            };
        }
        return {
            role: msg.role,
            content: msg.content
        };
    });
}

/**
 * Promise-based timeout helper. Rejects after `ms` milliseconds.
 */
function withTimeout(promise, ms, label = 'Operation') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Make a non-streaming request to OpenRouter and return the text response
 */
async function callOpenRouter(modelId, messages, maxTokens = 4096, temperature = 0.7) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://offgridtoolkit.ai',
            'X-Title': 'OffGrid AI Command Center'
        },
        body: JSON.stringify({
            model: modelId,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * Make a streaming request to OpenRouter and pipe SSE chunks to Express response
 */
async function streamOpenRouter(modelId, messages, res, maxTokens = 4096, temperature = 0.7) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://offgridtoolkit.ai',
            'X-Title': 'OffGrid AI Command Center'
        },
        body: JSON.stringify({
            model: modelId,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
            stream: true
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        res.write(`data: ${JSON.stringify({ error: errorData.error?.message || 'Stream error' })}\n\n`);
        res.end();
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                } else {
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }
}

/**
 * Utility: parse (possibly noisy) JSON from a model response.
 * If parsing fails, returns null.
 */
function safeParseJSON(text) {
    if (!text || typeof text !== 'string') return null;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
        return JSON.parse(candidate);
    } catch {
        return null;
    }
}

/**
 * Utility: simple Fisher-Yates shuffle
 */
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Build Stage 2 reviewer messages for anonymous peer review.
 * Each reviewer sees:
 * - Original user query
 * - Answer A, B, C, D (no model identities)
 */
function buildReviewerMessages(userQuery, answersByLabel, labelOrder) {
    const orderedLabels = labelOrder || Object.keys(answersByLabel);
    let answersBlock = '';
    for (const label of orderedLabels) {
        answersBlock += `Answer ${label}:\n${answersByLabel[label]}\n\n`;
    }

    const systemPrompt = `
You are part of an anonymous review panel evaluating multiple answers to the same user question.

Important rules:
- You do NOT know which model wrote which answer.
- Do NOT try to guess which model wrote what.
- Focus only on the content quality.
- You are evaluating for a human user who cares about both correctness and creativity.

You must:
1. Rank the answers by Accuracy (most accurate to least accurate).
2. Rank the answers by Insight (most insightful / helpful to least).
3. Give a brief explanation for your top choice in each category.

Definitions:
- Accuracy: factual correctness, lack of hallucinations, correct use of terminology, and appropriate caveats where the answer is uncertain.
- Insight: depth of reasoning, helpful structure, non-obvious but valid ideas, and practical usefulness to the user.

Do NOT write a new answer to the question. You are only judging the answers provided.

Respond ONLY with a valid JSON object in this exact structure:

{
  "accuracy_ranking": ["A", "B", "C", "D"],
  "insight_ranking": ["C", "B", "A", "D"],
  "top_accuracy_explanation": "Short explanation of why the top-ranked answer is most accurate.",
  "top_insight_explanation": "Short explanation of why the top-ranked answer is most insightful."
}
`;

    const userContent = `Original user question:

${userQuery}

Candidate answers (in random order):

${answersBlock}

Now provide your rankings and explanations as described.`;

    return [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userContent }
    ];
}

/**
 * Run Stage 2 peer review and compute Chairman using Borda-style scoring.
 * 
 * Inputs:
 *  - userQuery: string
 *  - labeledResults: [{ label, key, name, emoji, response }]
 * 
 * Returns:
 *  {
 *    chairmanLabel,
 *    chairmanResult,   // the chosen result object
 *    scores: { [label]: { accPoints, insightPoints, councilScore } },
 *    rawReviews: [ ... ] // optional debugging info
 *  }
 */
async function runCouncilReview(userQuery, labeledResults) {
    const labels = labeledResults.map(r => r.label);
    const answersByLabel = {};
    for (const r of labeledResults) {
        answersByLabel[r.label] = r.response || '';
    }

    const modelKeys = ['scout', 'medic', 'navigator', 'ranger'];
    const N = labels.length;
    const accPoints = {};
    const insightPoints = {};
    const rawReviews = [];

    labels.forEach(label => {
        accPoints[label] = 0;
        insightPoints[label] = 0;
    });

    // Stage 2: each model acts as a reviewer, anonymously
    // Per-model timeout: 30 seconds for reviews (shorter since they're simpler tasks)
    const REVIEW_TIMEOUT_MS = 30000;

    const reviewPromises = modelKeys.map(async (reviewKey) => {
        const reviewModel = COMMAND_MODELS[reviewKey];
        // Randomize label order per reviewer to reduce positional bias
        const shuffledLabels = shuffleArray(labels);
        const reviewMessages = buildReviewerMessages(userQuery, answersByLabel, shuffledLabels);

        try {
            const reviewText = await withTimeout(
                callOpenRouter(reviewModel.id, reviewMessages, 1024, 0.2),
                REVIEW_TIMEOUT_MS,
                `${reviewModel.shortName} review`
            );
            const parsed = safeParseJSON(reviewText);

            if (!parsed || !Array.isArray(parsed.accuracy_ranking) || !Array.isArray(parsed.insight_ranking)) {
                console.warn(`[Council Review] ${reviewModel.shortName} returned invalid review JSON.`);
                return { reviewer: reviewKey, success: false, raw: reviewText };
            }

            // Borda scoring: best gets N-1 points, worst gets 0
            const ar = parsed.accuracy_ranking;
            const ir = parsed.insight_ranking;

            // Accuracy points
            ar.forEach((label, idx) => {
                if (labels.includes(label)) {
                    accPoints[label] += (N - 1 - idx);
                }
            });

            // Insight points
            ir.forEach((label, idx) => {
                if (labels.includes(label)) {
                    insightPoints[label] += (N - 1 - idx);
                }
            });

            rawReviews.push({
                reviewer: reviewKey,
                modelName: reviewModel.name,
                accuracy_ranking: ar,
                insight_ranking: ir,
                top_accuracy_explanation: parsed.top_accuracy_explanation,
                top_insight_explanation: parsed.top_insight_explanation
            });

            return { reviewer: reviewKey, success: true };
        } catch (error) {
            console.error(`[Council Review] ${reviewModel.shortName} review error:`, error.message);
            return { reviewer: reviewKey, success: false, error: error.message };
        }
    });

    await Promise.all(reviewPromises);

    // Combine accuracy + insight into CouncilScore
    const scores = {};
    const wAcc = 2; // Accuracy weight
    const wIns = 1; // Insight weight

    labels.forEach(label => {
        const a = accPoints[label];
        const i = insightPoints[label];
        const councilScore = wAcc * a + wIns * i;
        scores[label] = { accPoints: a, insightPoints: i, councilScore };
    });

    // Select Chairman by highest CouncilScore, with tie-breakers
    // Skip errored models — they can't be chairman
    const eligibleLabels = labeledResults
        .filter(r => !r.response.startsWith('[Error:'))
        .map(r => r.label);
    let chairmanLabel = eligibleLabels[0] || labels[0];
    for (const label of eligibleLabels) {
        const current = scores[label];
        const best = scores[chairmanLabel];
        if (!best) {
            chairmanLabel = label;
            continue;
        }
        if (current.councilScore > best.councilScore) {
            chairmanLabel = label;
        } else if (current.councilScore === best.councilScore) {
            // Tie-breaker 1: higher accuracy points
            if (current.accPoints > best.accPoints) {
                chairmanLabel = label;
            } else if (current.accPoints === best.accPoints) {
                // Tie-breaker 2: higher insight points
                if (current.insightPoints > best.insightPoints) {
                    chairmanLabel = label;
                } else if (current.insightPoints === best.insightPoints) {
                    // Tie-breaker 3: alphabetical label (deterministic)
                    if (label < chairmanLabel) {
                        chairmanLabel = label;
                    }
                }
            }
        }
    }

    const chairmanResult = labeledResults.find(r => r.label === chairmanLabel);

    return {
        chairmanLabel,
        chairmanResult,
        scores,
        rawReviews
    };
}

// =============================================================================
/** ORIGINAL API ROUTES (Free Demo - Gemma 3) */
// =============================================================================

/**
 * GET /api/models
 * Returns available Gemma 3 models and their capabilities
 */
app.get('/api/models', (req, res) => {
    res.json({
        models: Object.entries(GEMMA_MODELS).map(([key, model]) => ({
            key,
            ...model
        })),
        defaultModel: 'gemma-3-4b'
    });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'OffGrid AI ToolKit Online',
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /api/chat
 * Main chat endpoint - proxies requests to OpenRouter (non-streaming, Gemma models)
 */
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { model, messages } = req.body;
        
        if (!OPENROUTER_API_KEY) {
            console.error('OpenRouter API key not configured');
            return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
        }
        
        const modelConfig = GEMMA_MODELS[model];
        if (!modelConfig) {
            return res.status(400).json({ 
                error: 'Invalid model selected',
                availableModels: Object.keys(GEMMA_MODELS)
            });
        }
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages are required' });
        }
        
        const openRouterMessages = buildOpenRouterMessages(messages, modelConfig.multimodal);
        const aiResponse = await callOpenRouter(modelConfig.id, openRouterMessages);
        const responseTime = Date.now() - startTime;
        
        res.json({
            response: aiResponse,
            model: modelConfig.name,
            modelId: modelConfig.id,
            responseTime: responseTime,
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing your request. Please try again.' 
        });
    }
});

/**
 * POST /api/stream
 * Streaming chat endpoint for Gemma models
 */
app.post('/api/stream', async (req, res) => {
    try {
        const { model, messages } = req.body;
        
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        const modelConfig = GEMMA_MODELS[model];
        if (!modelConfig) {
            return res.status(400).json({ error: 'Invalid model selected' });
        }
        
        const openRouterMessages = buildOpenRouterMessages(messages, modelConfig.multimodal);
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        await streamOpenRouter(modelConfig.id, openRouterMessages, res);
        res.end();
        
    } catch (error) {
        console.error('Stream endpoint error:', error);
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
        res.end();
    }
});

// =============================================================================
/** COMMAND CENTER API ROUTES (Premium - Multi-Model) */
// =============================================================================

/**
 * GET /api/command/models
 * Returns available Command Center models
 */
app.get('/api/command/models', (req, res) => {
    res.json({
        models: Object.entries(COMMAND_MODELS).map(([key, model]) => ({
            key,
            ...model
        })),
        defaultModel: 'command'
    });
});

/**
 * POST /api/command/stream
 * Streaming endpoint for single Command Center models
 */
app.post('/api/command/stream', async (req, res) => {
    try {
        const { model, messages } = req.body;
        
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        const modelConfig = COMMAND_MODELS[model];
        if (!modelConfig) {
            return res.status(400).json({ error: 'Invalid Command Center model selected' });
        }
        
        const openRouterMessages = buildOpenRouterMessages(messages, modelConfig.multimodal);
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        await streamOpenRouter(modelConfig.id, openRouterMessages, res);
        res.end();
        
    } catch (error) {
        console.error('Command stream error:', error);
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/command/council
 * Command Council mode - parallel calls to all 4 models, then competitive ranking + synthesis
 * 
 * Flow:
 * 1. Send user query to Scout, Medic, Navigator, Ranger in parallel
 * 2. Collect all 4 responses
 * 3. Run anonymous peer review (each model ranks all answers for accuracy & insight)
 * 4. Compute Chairman using Borda-style scoring
 * 5. Use Scout (GPT-4o) as Command editor to synthesize final answer
 * 6. Stream the synthesized response to the client
 */
app.post('/api/command/council', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages are required' });
        }
        
        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Extract the user's original query (last user message)
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const userQuery = lastUserMessage?.content || '';
        
        console.log(`[Council] Starting parallel calls for: "${userQuery.substring(0, 80)}..."`);
        
        // Step 1: Make parallel calls to all 4 models
        const modelKeys = ['scout', 'medic', 'navigator', 'ranger'];
        const baseMessages = buildOpenRouterMessages(messages, true);
        
        // Per-model timeout: 45 seconds for initial answers
        const MODEL_TIMEOUT_MS = 45000;

        const promises = modelKeys.map(async (key) => {
            const model = COMMAND_MODELS[key];
            try {
                const modelMessages = buildOpenRouterMessages(messages, model.multimodal);
                const response = await withTimeout(
                    callOpenRouter(model.id, modelMessages, 2048),
                    MODEL_TIMEOUT_MS,
                    model.shortName
                );
                
                // Send progress update
                res.write(`data: ${JSON.stringify({ 
                    progress: key, 
                    message: `${model.emoji} ${model.shortName} complete ✓` 
                })}\n\n`);
                
                console.log(`[Council] ${model.shortName} responded (${response.length} chars)`);
                return { key, name: model.name, shortName: model.shortName, emoji: model.emoji, response };
            } catch (error) {
                console.error(`[Council] ${model.shortName} error:`, error.message);
                
                const isTimeout = error.message.includes('timed out');
                res.write(`data: ${JSON.stringify({ 
                    progress: key, 
                    message: `${model.emoji} ${model.shortName} ${isTimeout ? 'timed out' : 'error'} (skipped)` 
                })}\n\n`);
                
                return { key, name: model.name, shortName: model.shortName, emoji: model.emoji, response: `[Error: ${error.message}]` };
            }
        });
        
        const results = await Promise.all(promises);

        // Filter out timed-out/errored models so they don't poison the council
        const validResults = results.filter(r => !r.response.startsWith('[Error:'));
        const skippedCount = results.length - validResults.length;
        if (skippedCount > 0) {
            console.log(`[Council] ${skippedCount} model(s) failed/timed out, proceeding with ${validResults.length}`);
        }

        // Need at least 2 models to run a meaningful council
        if (validResults.length < 2) {
            res.write(`data: ${JSON.stringify({ error: 'Too many models failed. Please try again.' })}\n\n`);
            res.end();
            return;
        }

        // Assign labels A, B, C, D to each result in a deterministic order
        // Use ALL results (including errors) so label positions stay consistent
        const labeledResults = results.map((r, idx) => ({
            label: String.fromCharCode(65 + idx), // 'A', 'B', 'C', ...
            ...r
        }));

        // Step 2: Run competitive peer review to select Chairman
        res.write(`data: ${JSON.stringify({ 
            progress: 'review', 
            message: '🤝 Running anonymous peer review (accuracy + insight)...' 
        })}\n\n`);

        const reviewOutcome = await runCouncilReview(userQuery, labeledResults);
        const { chairmanLabel, chairmanResult, scores } = reviewOutcome;

        // Build a scores summary for the frontend
        const scoresSummary = {};
        for (const r of labeledResults) {
            const s = scores[r.label];
            scoresSummary[r.label] = {
                model: r.shortName,
                emoji: r.emoji,
                key: r.key,
                accPoints: s.accPoints,
                insightPoints: s.insightPoints,
                councilScore: s.councilScore
            };
        }

        res.write(`data: ${JSON.stringify({ 
            progress: 'chairman', 
            message: `🏆 Chairman selected: ${chairmanResult.emoji} ${chairmanResult.shortName} (Answer ${chairmanLabel})`,
            chairmanKey: chairmanResult.key,
            chairmanLabel: chairmanLabel,
            scores: scoresSummary,
            rawReviews: reviewOutcome.rawReviews,
            labelMap: labeledResults.reduce((acc, r) => { acc[r.label] = { key: r.key, name: r.shortName, emoji: r.emoji }; return acc; }, {})
        })}\n\n`);

        console.log('[Council] Chairman selected:', {
            label: chairmanLabel,
            modelKey: chairmanResult.key,
            modelName: chairmanResult.name,
            scores
        });

        // Step 3: Signal synthesis phase
        res.write(`data: ${JSON.stringify({ 
            progress: 'synthesis', 
            message: '⭐ Synthesizing Command answer from Chairman + advisors...' 
        })}\n\n`);
        
        // Step 4: Build the synthesis prompt
        const chairmanBlock = `Chairman answer (selected as best by peer review):
[Model: ${chairmanResult.name}]
[Label: ${chairmanLabel}]
${chairmanResult.response}`;

        const advisorBlocks = labeledResults
            .filter(r => r.label !== chairmanLabel)
            .map(r => `Advisor answer:
[Model: ${r.name}]
[Label: ${r.label}]
${r.response}`)
            .join('\n\n---\n\n');

        const synthesisMessages = [
            {
                role: 'system',
                content: `
You are the Command Center editor-in-chief.

You are given:
- The user's original question.
- One "Chairman" answer that was ranked highest by a peer-review process for accuracy and insight.
- Several "advisor" answers from other models that may contain useful details, edge cases, or alternative perspectives.

Your job:
1. Use the Chairman answer as the primary spine of your response.
2. Incorporate genuinely helpful improvements, clarifications, and edge cases from the advisor answers.
3. Resolve any conflicts explicitly and conservatively (do not blindly merge contradictions).
4. Clearly mark uncertainty where it matters, especially in safety-critical domains.
5. Write a single, decisive, well-structured answer that is at least as accurate and insightful as the Chairman answer, and ideally better.

Do NOT mention the council process, voting, peer review, or other models in your final answer.
Just speak directly to the user with the best possible response.
`.trim()
            },
            {
                role: 'user',
                content: `
User query:
${userQuery}

${chairmanBlock}

${advisorBlocks ? '\n\n---\n\n' + advisorBlocks : ''}

Based on these, write the final Command answer as described.
`.trim()
            }
        ];
        
        // Step 5: Stream the synthesis response (using Scout/GPT-4o as the editor)
        console.log('[Council] Starting synthesis stream (Command editor)...');
        // Send the council metadata before streaming begins
        res.write(`data: ${JSON.stringify({ 
            councilMeta: {
                chairmanKey: chairmanResult.key,
                chairmanName: chairmanResult.shortName,
                chairmanEmoji: chairmanResult.emoji,
                scores: scoresSummary,
                rawReviews: reviewOutcome.rawReviews,
                labelMap: labeledResults.reduce((acc, r) => { acc[r.label] = { key: r.key, name: r.shortName, emoji: r.emoji }; return acc; }, {})
            }
        })}\n\n`);
        await streamOpenRouter(COMMAND_MODELS.scout.id, synthesisMessages, res, 4096, 0.5);
        
        res.write('data: [DONE]\n\n');
        res.end();
        
        console.log('[Council] Complete');
        
    } catch (error) {
        console.error('Council endpoint error:', error);
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({ error: 'Council error: ' + error.message })}\n\n`);
        res.end();
    }
});

// =============================================================================
// NANO BANANA IMAGE GENERATION ENDPOINT
// =============================================================================

/**
 * POST /api/command/generate-image
 * Generates an image using Nano Banana Pro (Gemini 3 Pro Image Preview) via OpenRouter.
 * Takes a text prompt and returns the generated image as base64.
 * No data is stored — processed in memory and discarded.
 */
app.post('/api/command/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'A text prompt is required' });
        }
        
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        console.log(`[Nano Banana] Generating image for: "${prompt.substring(0, 80)}..."`);
        
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid AI Command Center - Image Studio'
            },
            body: JSON.stringify({
                model: 'google/gemini-3-pro-image-preview',
                messages: [
                    {
                        role: 'user',
                        content: prompt.trim()
                    }
                ],
                modalities: ['image', 'text']
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Nano Banana] API error:', errorData);
            throw new Error(errorData.error?.message || `Image generation failed (${response.status})`);
        }
        
        const data = await response.json();
        
        // Check finish_reason for content policy / safety blocks
        const finishReason = data.choices?.[0]?.finish_reason || '';
        console.log('[Nano Banana] finish_reason:', finishReason);
        
        // Extract image from response
        // OpenRouter returns images in message.images[] array as base64 data URLs
        let imageBase64 = null;
        let textResponse = '';
        
        const message = data.choices?.[0]?.message;
        
        // Method 1: OpenRouter normalized format - message.images array
        if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
            const firstImage = message.images[0];
            if (firstImage?.image_url?.url) {
                imageBase64 = firstImage.image_url.url;
            }
        }
        
        // Method 2: Check content array (multipart response)
        const content = message?.content;
        if (!imageBase64 && Array.isArray(content)) {
            for (const part of content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                    imageBase64 = part.image_url.url;
                } else if (part.type === 'text') {
                    textResponse += part.text || '';
                } else if (part.inline_data) {
                    imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                }
            }
        } else if (typeof content === 'string') {
            textResponse = content;
            // Check if the response contains a base64 image in markdown format
            const imgMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
            if (imgMatch) {
                imageBase64 = imgMatch[1];
            }
        }
        
        if (!imageBase64) {
            console.warn('[Nano Banana] No image in response. finish_reason:', finishReason);
            console.warn('[Nano Banana] Message keys:', JSON.stringify(Object.keys(message || {})));
            console.warn('[Nano Banana] Text response:', (textResponse || '').substring(0, 200));
            
            // Determine specific error reason based on finish_reason
            let errorReason = 'unknown';
            let errorMessage = 'The model did not generate an image. Try rephrasing your prompt.';
            
            if (finishReason === 'SAFETY' || finishReason === 'safety') {
                errorReason = 'safety';
                errorMessage = 'Your prompt was flagged by the model\'s safety filters. Try rephrasing to avoid content that could be interpreted as harmful, violent, or dangerous.';
            } else if (finishReason === 'OTHER' || finishReason === 'other') {
                errorReason = 'content_policy';
                errorMessage = 'Your prompt was blocked by content policy (possibly copyright or trademark related). Try describing the concept in your own words without referencing specific brands or characters.';
            } else if (finishReason === 'MAX_TOKENS' || finishReason === 'max_tokens' || finishReason === 'length') {
                errorReason = 'max_tokens';
                errorMessage = 'The response was cut off due to length limits. Try a simpler prompt.';
            } else if (finishReason === 'RECITATION' || finishReason === 'recitation') {
                errorReason = 'recitation';
                errorMessage = 'The model detected potential copyright content duplication. Try a more original prompt.';
            } else {
                // Generic - the model just chose not to generate an image
                errorReason = 'no_image';
                errorMessage = 'The model responded with text but did not generate an image. Try being more specific about the visual style you want (e.g., "photorealistic", "watercolor", "technical diagram").';
            }
            
            return res.json({
                success: false,
                error: errorMessage,
                errorReason: errorReason,
                finishReason: finishReason,
                textResponse: textResponse
            });
        }
        
        console.log('[Nano Banana] Image generated successfully');
        
        res.json({
            success: true,
            image: imageBase64,
            textResponse: textResponse,
            prompt: prompt.trim()
        });
        
    } catch (error) {
        console.error('[Nano Banana] Error:', error);
        res.status(500).json({ 
            error: 'Image generation failed: ' + error.message 
        });
    }
});

// =============================================================================
// AI PROMPT ASSISTANT ENDPOINT
// =============================================================================

/**
 * POST /api/command/craft-prompt
 * Uses GPT-4.1 Mini via OpenRouter to transform a user's plain-language description
 * into an optimized image generation prompt for Nano Banana Pro.
 * Includes audience-specific context for OffGrid AI ToolKit users.
 * No data is stored — processed in memory and discarded.
 */
app.post('/api/command/craft-prompt', async (req, res) => {
    try {
        const { description, category } = req.body;

        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ error: 'Please describe what image you need.' });
        }

        console.log(`[Prompt Assistant] Crafting prompt for category: ${category || 'general'}`);
        console.log(`[Prompt Assistant] User description: "${description.substring(0, 100)}..."`);

        // Category-specific context to guide the AI
        const categoryContext = {
            'survival': 'The user needs survival and emergency preparedness visuals. Focus on educational diagrams with labeled steps, safety procedures, and practical wilderness techniques. Frame all content as educational reference material.',
            'homestead': 'The user needs homesteading and self-sufficient living visuals. Focus on practical guides for crops, livestock care, repairs, building, food preservation, and off-grid systems. Use warm, earthy, approachable illustration styles.',
            'medical': 'The user needs medical and first aid reference visuals. Focus on clear anatomical diagrams, first aid procedures, triage protocols, and medical reference charts. Use clinical, professional illustration style with labeled components. Frame as educational medical reference material.',
            'wilderness': 'The user needs wilderness identification and outdoor safety visuals. Focus on plant/animal identification cards, trail safety infographics, weather pattern guides, and navigation references. Use naturalist field guide illustration style.',
            'adventure': 'The user needs overlanding, van life, and adventure travel visuals. Focus on vehicle diagrams, route planning maps, camp setup guides, gear checklists, and equipment maintenance illustrations.',
            'research': 'The user needs field research and NGO documentation visuals. Focus on data visualization, process flow diagrams, documentation templates, and analytical charts. Use clean, professional, academic illustration style.',
            'ministry': 'The user needs ministry and mission work visuals. Focus on educational materials, sermon illustrations, translation aids, cultural reference guides, and community outreach graphics. Use warm, inclusive, respectful illustration style.',
            'education': 'The user needs remote education and teaching visuals. Focus on lesson diagrams, educational infographics, concept maps, study guides, and instructional illustrations. Use clear, engaging, student-friendly style.',
            'other': 'The user needs a general-purpose visual. Determine the best illustration style based on the description.'
        };

        const contextForCategory = categoryContext[category] || categoryContext['other'];

        const systemPrompt = `You are the OffGrid AI Image Prompt Specialist. Your job is to transform a user's plain-language description into a highly effective, optimized prompt for an AI image generation model (Nano Banana Pro / Gemini 3 Pro).

ABOUT THE USERS:
Your users are survivalists, homesteaders, first responders, field medics, hikers, hunters, overlanders, van lifers, field researchers, NGO workers, missionaries, remote educators, and privacy advocates. They typically need PRACTICAL visual content: diagrams, how-to illustrations, infographics, educational charts, identification cards, and reference materials.

CATEGORY CONTEXT:
${contextForCategory}

YOUR TASK:
1. Take the user's description and transform it into a detailed, specific image generation prompt
2. Emphasize visual style, composition, labeling, and educational clarity
3. Include specific details about: subject matter, visual style (diagram, infographic, illustration, etc.), color palette, background, text/labels to include, and layout
4. CRITICAL: Reframe any potentially sensitive content (survival techniques, medical procedures, hunting, trapping, weapons, wound care) as EDUCATIONAL ILLUSTRATIONS or TECHNICAL DIAGRAMS. Use academic/clinical language. Never use words that could trigger safety filters.
5. The model excels at: text rendering in images, labeled diagrams, infographics, step-by-step guides, and multi-element compositions

RULES:
- Output ONLY the optimized prompt text, nothing else
- Do NOT include any preamble, explanation, or commentary
- Do NOT wrap in quotes
- Keep the prompt between 50-150 words for best results
- Be specific and descriptive — vague prompts produce poor results
- Always specify an illustration/visual style
- Always mention background color or setting
- Include "labeled" or "annotated" for diagrams
- Use "educational" "technical" "reference" "clinical" framing for sensitive topics`;

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid Command Center'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: description.trim() }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Prompt Assistant] API error:', errorData);
            throw new Error(errorData.error?.message || `API returned ${response.status}`);
        }

        const data = await response.json();
        const craftedPrompt = data.choices?.[0]?.message?.content?.trim();

        if (!craftedPrompt) {
            throw new Error('No prompt was generated');
        }

        console.log(`[Prompt Assistant] Crafted prompt: "${craftedPrompt.substring(0, 100)}..."`);

        res.json({
            success: true,
            prompt: craftedPrompt,
            model: 'gpt-4.1-mini',
            category: category || 'other'
        });

    } catch (error) {
        console.error('[Prompt Assistant] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Prompt crafting failed: ' + error.message
        });
    }
});

// =============================================================================
// IMAGE CONTEXT SUMMARY ENDPOINT
// =============================================================================

/**
 * POST /api/command/image-summary
 * Generates a practical contextual summary for a generated image.
 * Takes the image prompt and category, returns actionable text:
 * supplies needed, steps, safety notes, etc.
 * Uses GPT-4.1 Mini for fast, cost-effective generation.
 * No data is stored — processed in memory and discarded.
 */
app.post('/api/command/image-summary', async (req, res) => {
    try {
        const { prompt, category } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Image prompt is required' });
        }

        const categoryContext = {
            survival: 'Focus on survival priorities, safety warnings, and materials that can be found in the wild or in a basic emergency kit.',
            homestead: 'Focus on building materials, tools needed, estimated costs, and seasonal considerations for off-grid homesteading.',
            medical: 'Focus on supplies needed, step-by-step procedure, when to seek professional help, and important safety warnings.',
            wilderness: 'Focus on identification tips, safety warnings (toxic lookalikes), seasonal availability, and habitat information.',
            adventure: 'Focus on gear needed, safety precautions, weather considerations, and navigation tips.',
            research: 'Focus on methodology, equipment needed, data collection tips, and field safety protocols.',
            ministry: 'Focus on practical application, audience considerations, and supporting resources.',
            education: 'Focus on learning objectives, materials needed, age-appropriate adaptations, and assessment ideas.',
            other: 'Focus on practical, actionable information that adds real-world value.'
        };

        const contextHint = categoryContext[category] || categoryContext.other;

        const systemPrompt = `You are a practical field guide assistant for the OffGrid AI ToolKit — a USB-based AI system used by survivalists, homesteaders, first responders, hikers, and off-grid communities.

The user just generated an image using this prompt: "${prompt}"

Your job is to write a SHORT, practical companion summary that adds real survival/practical value when this image is saved to their Knowledge Base. This text will appear alongside the image.

${contextHint}

Format your response EXACTLY like this:
## Quick Reference
[1-2 sentence summary of what this image shows and why it's useful]

### What You'll Need
- [Bullet list of supplies, materials, or tools — be specific]

### Key Steps
1. [Numbered actionable steps — keep it concise, 4-6 steps max]

### Safety Notes
- [Important warnings or considerations]

Rules:
- Be concise — this is a field reference, not an essay
- Use plain language a non-expert can understand
- Include specific quantities, measurements, or sizes where relevant
- If the topic involves any danger, ALWAYS include safety warnings
- Do NOT describe the image itself — add NEW practical value
- Total response should be 150-250 words max`;

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid Command Center'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Generate a practical companion summary for this image. The image was created from this prompt: "${prompt}"` }
                ],
                temperature: 0.4
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Image summary API error:', errorText);
            return res.status(500).json({ error: 'Failed to generate summary' });
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content || '';

        res.json({ success: true, summary });

    } catch (error) {
        console.error('Image summary error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

// =============================================================================
// VISUAL PROMPT FROM CONVERSATION ENDPOINT
// =============================================================================

/**
 * POST /api/command/visual-prompt
 * Takes the last council/AI response from a conversation and generates
 * an optimized Image Studio prompt based on that content.
 * Uses GPT-4.1 Mini for fast, cost-effective generation.
 * No data is stored — processed in memory and discarded.
 */
app.post('/api/command/visual-prompt', async (req, res) => {
    try {
        const { conversationContext, category } = req.body;

        if (!conversationContext || typeof conversationContext !== 'string' || conversationContext.trim().length === 0) {
            return res.status(400).json({ error: 'Conversation context is required.' });
        }

        console.log(`[Visual Prompt] Generating image prompt from conversation (${conversationContext.length} chars)`);

        const systemPrompt = `You are the OffGrid AI Visual Prompt Specialist. You read an AI-generated answer about survival, homesteading, medical, or off-grid topics and create an optimized image generation prompt that produces a useful COMPANION VISUAL for that information.

ABOUT THE USERS:
Survivalists, homesteaders, first responders, field medics, hikers, hunters, overlanders, field researchers, missionaries, remote educators, and privacy advocates. They need PRACTICAL visual content they can reference in the field.

YOUR TASK:
1. Read the AI response provided
2. Identify the KEY practical information that would benefit from a visual companion
3. Create an image generation prompt for a useful diagram, infographic, checklist, or reference chart
4. The visual should COMPLEMENT the text — not just illustrate it, but add organizational value

IMAGE SIZE & STYLE RULES:
- Create PRACTICAL REFERENCE VISUALS — NOT large posters
- Target size: standard document/screen size (like a reference card, field guide page, or single-page infographic)
- Style: clean, organized, labeled, easy to read at normal screen/print size
- Best formats: labeled diagrams, step-by-step infographics, checklists with icons, comparison charts, flow charts, identification cards, quick-reference guides
- Use clear section dividers, consistent icons, readable text sizes
- Specify: clean white or light background, professional illustration style, labeled components
- Include color palette suggestions (earth tones for survival, clinical blues for medical, etc.)

SAFETY REFRAMING:
- Reframe any sensitive content (survival techniques, medical procedures, weapons, wound care) as EDUCATIONAL ILLUSTRATIONS or TECHNICAL DIAGRAMS
- Use academic/clinical language
- Never use words that could trigger safety filters

RULES:
- Output ONLY the optimized prompt text, nothing else
- Do NOT include any preamble, explanation, or commentary
- Do NOT wrap in quotes
- Keep the prompt between 80-200 words
- Be specific and descriptive
- Always specify illustration/visual style
- Always mention background color
- Include "labeled" or "annotated" for diagrams`;

        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid Command Center'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Read this AI response and create an optimized image generation prompt for a practical companion visual:\n\n${conversationContext.substring(0, 4000)}` }
                ],
                temperature: 0.7,
                max_tokens: 400
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Visual Prompt] API error:', errorData);
            throw new Error(errorData.error?.message || `API returned ${response.status}`);
        }

        const data = await response.json();
        const visualPrompt = data.choices?.[0]?.message?.content?.trim();

        if (!visualPrompt) {
            throw new Error('No visual prompt was generated');
        }

        console.log(`[Visual Prompt] Generated: "${visualPrompt.substring(0, 100)}..."`);

        res.json({
            success: true,
            prompt: visualPrompt,
            model: 'gpt-4.1-mini'
        });

    } catch (error) {
        console.error('[Visual Prompt] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Visual prompt generation failed: ' + error.message
        });
    }
});

// =============================================================================
// PDF EXPORT ENDPOINT
// =============================================================================

/**
 * POST /api/export-pdf
 * Converts Markdown conversation content to a styled PDF.
 * The conversion happens server-side; the PDF is returned as a downloadable file.
 * No conversation data is stored — processed in memory and discarded.
 */
app.post('/api/export-pdf', async (req, res) => {
    try {
        const { markdown, title } = req.body;
        
        if (!markdown || typeof markdown !== 'string') {
            return res.status(400).json({ error: 'Markdown content is required' });
        }
        
        // Convert markdown to styled HTML
        const styledHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 40px 30px;
            color: #1a1a1a;
            line-height: 1.7;
            font-size: 13px;
        }
        
        h1 {
            color: #2c1810;
            font-size: 22px;
            border-bottom: 3px solid #b8860b;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        h2 {
            color: #4a2c1a;
            font-size: 16px;
            margin-top: 28px;
            margin-bottom: 10px;
            padding: 6px 12px;
            background: #faf5eb;
            border-left: 4px solid #b8860b;
            border-radius: 0 6px 6px 0;
        }
        
        h3, h4 {
            color: #374151;
            margin-top: 16px;
        }
        
        p {
            margin: 8px 0;
        }
        
        em {
            color: #6b7280;
        }
        
        strong {
            color: #1a1a1a;
        }
        
        hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 20px 0;
        }
        
        ul, ol {
            padding-left: 24px;
            margin: 8px 0;
        }
        
        li {
            margin: 4px 0;
        }
        
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            font-family: 'Courier New', monospace;
        }
        
        pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.5;
        }
        
        pre code {
            background: none;
            padding: 0;
            color: inherit;
        }
        
        blockquote {
            border-left: 3px solid #b8860b;
            margin: 12px 0;
            padding: 8px 16px;
            background: #faf5eb;
            color: #4a2c1a;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 12px;
        }
        
        th, td {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            text-align: left;
        }
        
        th {
            background: #f9fafb;
            font-weight: 600;
        }
        
        img {
            max-width: 100%;
            border-radius: 8px;
            margin: 8px 0;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 2px solid #b8860b;
            text-align: center;
            color: #9ca3af;
            font-size: 11px;
        }
    </style>
</head>
<body>
    ${markdownToHtml(markdown)}
    <div class="footer">
        Generated by OffGrid AI ToolKit Online &bull; offgridtoolkit.ai<br>
        This document was saved directly to your device. No data was stored on our servers.
    </div>
</body>
</html>`;
        
        // Use a simple HTML-to-PDF approach without Puppeteer
        // We'll send the HTML and let the client print-to-PDF, OR
        // use a lightweight server-side approach
        
        const safeTitle = (title || 'conversation')
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        const filename = `${new Date().toISOString().split('T')[0]}_${safeTitle}.pdf`;
        
        // Return styled HTML for client-side PDF generation via window.print()
        res.json({
            html: styledHtml,
            filename: filename
        });
        
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ error: 'Failed to generate PDF export' });
    }
});

/**
 * Simple Markdown to HTML converter for PDF export.
 * Handles basic markdown syntax without external dependencies.
 */
function markdownToHtml(md) {
    // Remove YAML frontmatter
    md = md.replace(/^---[\s\S]*?---\n*/m, '');
    
    let html = md
        // Code blocks (must be before other replacements)
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Images (base64 embedded)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Unordered lists
        .replace(/^[\s]*[-*] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^[\s]*\d+\. (.+)$/gm, '<li>$1</li>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Paragraphs (lines that aren't already HTML)
        .replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p>$1</p>')
        // Clean up consecutive list items into ul
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/g, '')
        // Clean up consecutive blockquotes
        .replace(/<\/blockquote>\n<blockquote>/g, '<br>');
    
    return html;
}

// =============================================================================
// ROUTE: /command - Serve Command Center page
// =============================================================================

app.get('/command', (req, res) => {
    res.sendFile(path.join(__dirname, 'command.html'));
});

// =============================================================================
// DUAL-EXPERIENCE ROUTING
// =============================================================================
// /        = Prospect experience (free demo, sales messaging, CTAs)
// /online  = Customer experience (ad-free, premium feel, no sales messaging)
//
// Both routes serve the same index.html but inject a config flag that the
// frontend reads to conditionally show/hide elements.
// =============================================================================

function serveWithExperience(req, res, isCustomer) {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, html) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Server error');
        }
        // Inject the experience config right before </head>
        const configScript = `<script>window.OFFGRID_CONFIG = { isCustomer: ${isCustomer}, experience: '${isCustomer ? 'online' : 'demo'}' };</script>`;
        const injectedHtml = html.replace('</head>', configScript + '\n</head>');
        res.setHeader('Content-Type', 'text/html');
        res.send(injectedHtml);
    });
}

// Ready-Made Prompts page (customer feature)
app.get('/online/ready-made-prompts', (req, res) => {
    res.sendFile(path.join(__dirname, 'ready-made-prompts.html'));
});

// Ready-Made Prompts page (Command Center)
app.get('/command/ready-made-prompts', (req, res) => {
    res.sendFile(path.join(__dirname, 'ready-made-prompts.html'));
});

// Customer experience - ad-free online toolkit
app.get('/online', (req, res) => {
    serveWithExperience(req, res, true);
});

// Mobile route
app.get('/mobile', (req, res) => {
    serveWithExperience(req, res, true);
});

// Prospect experience - free demo with sales messaging
app.get('/', (req, res) => {
    serveWithExperience(req, res, false);
});

// Catch-all route - serve prospect experience for any other path
app.get('*', (req, res) => {
    serveWithExperience(req, res, false);
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       OffGrid AI ToolKit Online - Server Started          ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}                          ║`);
    console.log(`║  Network: http://0.0.0.0:${PORT}                            ║`);
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  Free Demo Models (Gemma 3):                              ║');
    console.log('║    • Gemma 3 27B (gemma-3-27b)                            ║');
    console.log('║    • Gemma 3 12B (gemma-3-12b)                            ║');
    console.log('║    • Gemma 3 4B  (gemma-3-4b)                             ║');
    console.log('║    • MedGemma 3 4B (medgemma-3-4b)                        ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  Command Center Models:                                   ║');
    console.log('║    🔭 Scout    (GPT 5.2)          - Vision Specialist      ║');
    console.log('║    🏥 Medic    (Claude 4.5 Sonnet) - Safety & Analysis     ║');
    console.log('║    🧭 Navigator (Gemini 2.5 Pro)  - Research & Planning   ║');
    console.log('║    🏕️  Ranger   (Grok 4.1)        - Creative Solutions    ║');
    console.log('║    ⭐ Command  (Council Consensus) - All 4 + Synthesis    ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  API Key: ${OPENROUTER_API_KEY ? '✓ Configured' : '✗ Missing'}                               ║`);
    console.log('║  Routes:                                                  ║');
    console.log('║    /         → Prospect Demo (sales messaging)            ║');
    console.log('║    /online   → Customer ToolKit (ad-free)                 ║');
    console.log('║    /command  → Command Center (premium)                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});

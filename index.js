/**
 * OffGrid AI ToolKit Online - Backend API Server
 * 
 * This server acts as a secure proxy between the frontend and OpenRouter API,
 * keeping the API key secure on the server side.
 * 
 * Includes:
 * - Original Gemma 3 model routing (free demo)
 * - Command Center multi-model routing (Scout, Medic, Navigator, Ranger)
 * - Command Council mode (parallel calls + synthesis)
 * - Response streaming for all endpoints
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
        id: 'openai/gpt-4o',
        name: 'Scout (GPT-4o)',
        shortName: 'Scout',
        emoji: '🔭',
        description: 'Vision Specialist',
        multimodal: true
    },
    'medic': {
        id: 'anthropic/claude-sonnet-4',
        name: 'Medic (Claude Sonnet 4)',
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
        id: 'x-ai/grok-3-mini',
        name: 'Ranger (Grok 3 Mini)',
        shortName: 'Ranger',
        emoji: '🏕️',
        description: 'Creative Solutions',
        multimodal: false
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
 * Make a non-streaming request to OpenRouter and return the text response
 */
async function callOpenRouter(modelId, messages, maxTokens = 4096) {
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
            temperature: 0.7
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
async function streamOpenRouter(modelId, messages, res, maxTokens = 4096) {
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
            temperature: 0.7,
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

// =============================================================================
// ORIGINAL API ROUTES (Free Demo - Gemma 3)
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
// COMMAND CENTER API ROUTES (Premium - Multi-Model)
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
 * Command Council mode - parallel calls to all 4 models, then synthesis
 * 
 * Flow:
 * 1. Send user query to Scout, Medic, Navigator, Ranger in parallel
 * 2. Collect all 4 responses
 * 3. Send progress updates via SSE
 * 4. Synthesize the best answer using GPT-4o as the "chairman"
 * 5. Stream the synthesized response to the client
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
        
        const openRouterMessages = buildOpenRouterMessages(messages, true);
        
        // Extract the user's original query (last user message)
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const userQuery = lastUserMessage?.content || '';
        
        console.log(`[Council] Starting parallel calls for: "${userQuery.substring(0, 80)}..."`);
        
        // Step 1: Make parallel calls to all 4 models
        const modelKeys = ['scout', 'medic', 'navigator', 'ranger'];
        const promises = modelKeys.map(async (key) => {
            const model = COMMAND_MODELS[key];
            try {
                const modelMessages = buildOpenRouterMessages(messages, model.multimodal);
                const response = await callOpenRouter(model.id, modelMessages, 2048);
                
                // Send progress update
                res.write(`data: ${JSON.stringify({ 
                    progress: key, 
                    message: `${model.emoji} ${model.shortName} complete ✓` 
                })}\n\n`);
                
                console.log(`[Council] ${model.shortName} responded (${response.length} chars)`);
                return { key, name: model.name, emoji: model.emoji, response };
            } catch (error) {
                console.error(`[Council] ${model.shortName} error:`, error.message);
                
                res.write(`data: ${JSON.stringify({ 
                    progress: key, 
                    message: `${model.emoji} ${model.shortName} error (skipped)` 
                })}\n\n`);
                
                return { key, name: model.name, emoji: model.emoji, response: `[Error: ${error.message}]` };
            }
        });
        
        const results = await Promise.all(promises);
        
        // Step 2: Signal synthesis phase
        res.write(`data: ${JSON.stringify({ 
            progress: 'synthesis', 
            message: '⭐ Synthesizing council consensus...' 
        })}\n\n`);
        
        // Step 3: Build the synthesis prompt
        const synthesisMessages = [
            {
                role: 'system',
                content: 'You are the Command Center chairman. Your job is to synthesize the single best, most comprehensive, and safest answer from the responses of four AI assistants. Provide a clear, well-structured response. Do not mention the debate, the other models, or the council process in your final response. Just deliver the best answer directly.'
            },
            {
                role: 'user',
                content: `User query: ${userQuery}\n\nFour AI assistants provided these answers:\n\n${results.map(r => `${r.emoji} ${r.name}:\n${r.response}`).join('\n\n---\n\n')}\n\nBased on these, synthesize the single best, most comprehensive, and safest answer. Do not mention the debate or the other models in your final response.`
            }
        ];
        
        // Step 4: Stream the synthesis response
        console.log('[Council] Starting synthesis stream...');
        await streamOpenRouter(COMMAND_MODELS.scout.id, synthesisMessages, res, 4096);
        
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
// ROUTE: /command - Serve Command Center page
// =============================================================================

app.get('/command', (req, res) => {
    res.sendFile(path.join(__dirname, 'command.html'));
});

// Catch-all route - serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
    console.log('║    🔭 Scout    (GPT-4o)          - Vision Specialist      ║');
    console.log('║    🏥 Medic    (Claude Sonnet 4)  - Safety & Analysis     ║');
    console.log('║    🧭 Navigator (Gemini 2.5 Pro)  - Research & Planning   ║');
    console.log('║    🏕️  Ranger   (Grok 3 Mini)     - Creative Solutions    ║');
    console.log('║    ⭐ Command  (Council Consensus) - All 4 + Synthesis    ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  API Key: ${OPENROUTER_API_KEY ? '✓ Configured' : '✗ Missing'}                               ║`);
    console.log('║  Command Center: /command                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});

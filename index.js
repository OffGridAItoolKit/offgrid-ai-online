/**
 * OffGrid AI ToolKit Online - Backend API Server
 * 
 * This server acts as a secure proxy between the frontend and OpenRouter API,
 * keeping the API key secure on the server side.
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

// Gemma 3 Models Configuration
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

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS Configuration - Allow all origins for demo
app.use(cors({
    origin: true,
    credentials: true
}));

// JSON body parser with size limit for images
app.use(express.json({ limit: '10mb' }));

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Rate limiting
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

app.use('/api/', limiter);

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
// API ROUTES
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
 * Main chat endpoint - proxies requests to OpenRouter
 */
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { model, messages, image } = req.body;
        
        // Validate API key
        if (!OPENROUTER_API_KEY) {
            console.error('OpenRouter API key not configured');
            return res.status(500).json({ 
                error: 'Server configuration error. Please contact support.' 
            });
        }
        
        // Validate model
        const modelConfig = GEMMA_MODELS[model];
        if (!modelConfig) {
            return res.status(400).json({ 
                error: 'Invalid model selected',
                availableModels: Object.keys(GEMMA_MODELS)
            });
        }
        
        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages are required' });
        }
        
        // Build the request for OpenRouter
        const openRouterMessages = messages.map(msg => {
            // Handle multimodal messages (with images)
            if (msg.image && modelConfig.multimodal) {
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
        
        // Make request to OpenRouter
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid AI ToolKit Online'
            },
            body: JSON.stringify({
                model: modelConfig.id,
                messages: openRouterMessages,
                max_tokens: 4096,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenRouter API error:', response.status, errorData);
            
            if (response.status === 401) {
                return res.status(500).json({ error: 'API authentication error. Please contact support.' });
            }
            if (response.status === 429) {
                return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
            }
            
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Failed to get response from AI model'
            });
        }
        
        const data = await response.json();
        const responseTime = Date.now() - startTime;
        
        // Extract the response
        const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';
        
        res.json({
            response: aiResponse,
            model: modelConfig.name,
            modelId: modelConfig.id,
            responseTime: responseTime,
            usage: data.usage
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
 * Streaming chat endpoint for real-time responses
 */
app.post('/api/stream', async (req, res) => {
    try {
        const { model, messages, image } = req.body;
        
        // Validate API key
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        // Validate model
        const modelConfig = GEMMA_MODELS[model];
        if (!modelConfig) {
            return res.status(400).json({ error: 'Invalid model selected' });
        }
        
        // Build messages for OpenRouter
        const openRouterMessages = messages.map(msg => {
            if (msg.image && modelConfig.multimodal) {
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
            return { role: msg.role, content: msg.content };
        });
        
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Make streaming request to OpenRouter
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://offgridtoolkit.ai',
                'X-Title': 'OffGrid AI ToolKit Online'
            },
            body: JSON.stringify({
                model: modelConfig.id,
                messages: openRouterMessages,
                max_tokens: 4096,
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
        
        // Stream the response
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
        
        res.end();
        
    } catch (error) {
        console.error('Stream endpoint error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
        res.end();
    }
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
    console.log('║  Available Models:                                        ║');
    console.log('║    • Gemma 3 27B (gemma-3-27b)                            ║');
    console.log('║    • Gemma 3 12B (gemma-3-12b)                            ║');
    console.log('║    • Gemma 3 4B  (gemma-3-4b)                             ║');
    console.log('║    • MedGemma 3 4B (medgemma-3-4b)                        ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  API Key: ${OPENROUTER_API_KEY ? '✓ Configured' : '✗ Missing'}                               ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});

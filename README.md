# OffGrid AI ToolKit Online

**Cloud-Powered Gemma 3 AI Assistant** - The online demonstration version of OffGrid AI ToolKit.

## Overview

This is the online version of OffGrid AI ToolKit, designed to showcase the power of Gemma 3 models with cloud-based inference. Users can experience the same AI models available in the offline USB version, but with significantly faster response times thanks to cloud infrastructure.

## Features

| Feature | Description |
|---------|-------------|
| **Gemma 3 Models** | Access to Gemma 3 4B, 12B, 27B, and MedGemma 3 4B |
| **Multimodal Support** | Image upload and analysis capabilities |
| **Fast Responses** | Cloud-powered inference for 1-5 second response times |
| **Privacy First** | No conversation storage - sessions are ephemeral |
| **Mobile Responsive** | Works on desktop, tablet, and mobile devices |
| **Purchase CTA** | Prominent call-to-action for the offline USB version |

## Technical Stack

The application uses a simple, maintainable architecture:

**Backend**: Node.js with Express serves as a secure proxy between the frontend and OpenRouter API. This keeps the API key secure on the server side and handles rate limiting, CORS, and request validation.

**Frontend**: Vanilla HTML, CSS, and JavaScript adapted from the original Electron-based offline version. No build step required - files can be served directly from any static file server.

**API Integration**: OpenRouter provides unified access to all Gemma 3 models through a single API interface.

## Project Structure

```
offgrid-ai-online/
├── package.json          # Node.js dependencies and scripts
├── .env                  # Environment variables (API key, etc.)
├── .env.example          # Template for environment variables
├── README.md             # This documentation
├── server/
│   └── index.js          # Express server with OpenRouter proxy
└── public/
    ├── index.html        # Main application HTML
    ├── offgridai.css     # Styling (from offline version)
    └── [assets]          # Logo images and icons
```

## Setup Instructions

### Prerequisites

Before deploying, ensure you have:

1. Node.js 18+ installed
2. An OpenRouter API key (get one at https://openrouter.ai/keys)
3. A hosting environment that supports Node.js (cPanel with Node.js, VPS, etc.)

### Local Development

1. Clone or download the project files
2. Copy `.env.example` to `.env` and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open http://localhost:3000 in your browser

### Production Deployment

#### Option 1: cPanel with Node.js

1. Upload all project files to your hosting directory
2. Create a `.env` file with your production settings
3. In cPanel, go to "Setup Node.js App"
4. Create a new application pointing to your project directory
5. Set the startup file to `server/index.js`
6. Install dependencies and start the application

#### Option 2: VPS/Cloud Server

1. Upload files to your server
2. Install Node.js if not already installed
3. Create `.env` with production settings:
   ```
   OPENROUTER_API_KEY=your_key
   PORT=3000
   NODE_ENV=production
   ALLOWED_ORIGINS=https://offgridtoolkit.ai
   ```
4. Install dependencies: `npm install`
5. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name offgrid-ai-online
   pm2 save
   ```
6. Configure your reverse proxy (nginx/Apache) to forward requests to port 3000

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check - returns server status |
| `/api/models` | GET | Returns available Gemma 3 models |
| `/api/chat` | POST | Main chat endpoint - sends messages to AI |
| `/api/stream` | POST | Streaming chat endpoint for real-time responses |

### Chat Request Format

```json
{
  "model": "gemma-3-4b",
  "messages": [
    {
      "role": "user",
      "content": "Hello, what is OffGrid AI?",
      "image": "data:image/jpeg;base64,..." // Optional
    }
  ]
}
```

### Chat Response Format

```json
{
  "response": "OffGrid AI ToolKit is...",
  "model": "Gemma 3 4B",
  "modelId": "google/gemma-3-4b-it",
  "responseTime": 1234,
  "usage": { "prompt_tokens": 10, "completion_tokens": 50 }
}
```

## Available Models

| Model Key | OpenRouter ID | Description |
|-----------|---------------|-------------|
| `gemma-3-4b` | google/gemma-3-4b-it | Fastest, great for quick questions |
| `gemma-3-12b` | google/gemma-3-12b-it | Balanced performance |
| `gemma-3-27b` | google/gemma-3-27b-it | Maximum intelligence |
| `medgemma-3-4b` | google/medgemma-4b-it | Medical/healthcare specialist |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | - | Your OpenRouter API key |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `ALLOWED_ORIGINS` | No | localhost | CORS allowed origins |
| `RATE_LIMIT_WINDOW_MS` | No | 60000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | 30 | Max requests per window |

## Security Considerations

The application implements several security measures:

**API Key Protection**: The OpenRouter API key is stored server-side and never exposed to the frontend. All API calls are proxied through the backend.

**Rate Limiting**: Built-in rate limiting prevents abuse (default: 30 requests per minute per IP).

**Input Validation**: All user inputs are validated before being sent to the API.

**CORS Configuration**: In production, configure `ALLOWED_ORIGINS` to only allow requests from your domain.

## Customization

### Changing Branding

The application uses the OffGrid branding with earth tones (browns, golds) and the compass logo. To customize:

1. Replace logo files in `public/` directory
2. Modify colors in `public/offgridai.css` (search for color values like `#b8860b`, `#2c1810`)
3. Update the title and meta tags in `public/index.html`

### Adding Models

To add new models, update the `GEMMA_MODELS` object in `server/index.js`:

```javascript
const GEMMA_MODELS = {
    'new-model': {
        id: 'provider/model-id',
        name: 'Display Name',
        description: 'Model description',
        multimodal: true,
        responseTime: '~X seconds'
    }
};
```

## Troubleshooting

**"API authentication error"**: Verify your OpenRouter API key is correct in the `.env` file.

**"Cannot connect to server"**: Ensure the Node.js server is running and accessible.

**Slow responses**: This may indicate high load on OpenRouter. Try a smaller model like Gemma 3 4B.

**Images not working**: Ensure the model supports multimodal input. MedGemma and all Gemma 3 models support images.

## License

Proprietary - OffGrid AI ToolKit LLC

## Support

For support, contact: support@offgridaitoolkit.com

For the offline USB version, visit: https://offgridaitoolkit.com

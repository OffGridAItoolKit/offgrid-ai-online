# OffGrid AI ToolKit Online - Technical Overview

**Version 5.7.2** | **Last Updated:** 2026-07-10

This document provides a comprehensive technical overview of the OffGrid AI ToolKit Online platform, including the free Online ToolKit and the premium Command Center. It is intended for developers, administrators, and technical staff.

---

## 1. System Architecture

The platform is built on a simple and robust technical stack, prioritizing maintainability, security, and privacy.

**Frontend**: Vanilla HTML, CSS, and JavaScript. The frontend is a single-page application for the free toolkit and a separate one for the Command Center. No complex build step is required, allowing for simple static file serving.

**Backend**: A Node.js server using the Express framework. The backend serves three primary functions:
1.  **Static File Server**: Serves the HTML, CSS, and JS files for the frontend.
2.  **Secure API Proxy**: All communication with external AI model providers (like OpenRouter) is proxied through the backend. This keeps all API keys and sensitive credentials on the server, never exposing them to the client.
3.  **Business Logic**: Implements application-specific features such as the AI Council, PDF export, and health checks.

**External Services**:
*   **OpenRouter**: Provides a unified API to access a wide range of large language models (LLMs), including Google's Gemma 4, OpenAI's GPT models, Anthropic's Claude, and more.
*   **Render**: Hosts the Node.js service and provides short-lived deployment, application-console, and request logs for troubleshooting.

## 2. Core Features

The platform is divided into two main products: the free Online ToolKit and the premium Command Center.

### 2.1. Online ToolKit (Free)

The free toolkit provides a demonstration of the core OffGrid AI experience using the same Gemma 4 model found in the offline USB product.

*   **Gemma 4 26B A4B**: Single model architecture with system prompt for decision-oriented responses.
*   **Multimodal Input**: Supports image uploads for visual analysis.
*   **Ephemeral Conversations**: All chat sessions are processed in memory and are not stored, ensuring user privacy.
*   **Saved Guides**: Users can save generated visuals to their gallery and complete field guides as local PDF documents.
*   **PDF Export**: Conversations and generated visuals can be exported as styled PDF field guides.

### 2.2. Command Center (Premium)

The Command Center is the premium offering, providing access to advanced features and a council of powerful AI models.

*   **AI Council**: A multi-model system where four specialist AIs work in parallel to answer a user's query. The council consists of:
    *   **Scout (GPT-5.2)**: Vision and image analysis specialist.
    *   **Medic (Claude Sonnet 4.6)**: Safety, analysis, and medical specialist.
    *   **Navigator (Gemini 3.1 Pro)**: Research, planning, and web-browsing specialist.
    *   **Ranger (Grok 4.1)**: Creative solutions and unconventional thinking.
*   **Command Mode**: A synthesis mode where the AI Council's responses are reviewed by a "Chairman" AI, which then provides a final, synthesized answer.
*   **Image Studio**: An AI-assisted image generation tool using Nano Banana Pro (Gemini 3 Pro Image Preview) with features like prompt crafting and visual prompt generation from conversations.
*   **Ready-Made Prompts**: A library of pre-built prompts for common survival, homesteading, and off-grid scenarios.

## 3. API Endpoints

The backend exposes a set of API endpoints for the frontend to consume. All endpoints are prefixed with `/api`.

### 3.1. Public Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | General health check for the server. |
| `/api/models` | GET | Returns the available Gemma 4 model for the free toolkit. |
| `/api/chat` | POST | Main chat endpoint for the free toolkit. |
| `/api/stream` | POST | Streaming chat endpoint for the free toolkit. |
| `/api/export-pdf` | POST | Converts a Markdown conversation to a PDF. |

### 3.2. Command Center Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/command/models` | GET | Returns the list of available Command Center models. |
| `/api/command/stream` | POST | Streaming chat endpoint for the Command Center models. |
| `/api/command/council` | POST | Initiates a parallel request to the AI Council. |
| `/api/command/generate-image` | POST | Generates an image from a text prompt. |
| `/api/command/craft-prompt` | POST | Generates an optimized image prompt from a user query. |
| `/api/command/image-summary` | POST | Generates a text summary of an image. |
| `/api/command/visual-prompt` | POST | Generates an image prompt from a conversation. |
| `/api/health/image-gen` | GET | Health check for the image generation service. |

## 4. Environment Variables

The application is configured using environment variables. A `.env.example` file is provided as a template. Never commit real `.env` files, API keys, database URLs, admin secrets, JWT secrets, or other credentials.

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Your API key for OpenRouter. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the license key and usage limit system. |
| `JWT_SECRET` | Yes | Stable secret used to sign license/session JWTs. Changing this invalidates existing customer sessions. |
| `ADMIN_SECRET` | Yes | Production admin secret checked by admin API routes via the `x-admin-key` request header. This is the required production environment variable. |
| `ADMIN_SECRET_BACKUP` | No | Optional secondary admin secret for temporary rotation or backup access. |
| `PORT` | No | The port for the server to run on (default: 3000). |
| `NODE_ENV` | No | The environment mode (e.g., `production`). |
| `ALLOWED_ORIGINS` | No | A comma-separated list of additional allowed browser origins for CORS. |
| `RATE_LIMIT_WINDOW_MS` | No | The window for rate limiting in milliseconds (default: 60000). |
| `RATE_LIMIT_MAX_REQUESTS` | No | The maximum number of requests per window (default: 30). |
| `ANON_DAILY_PROMPT_LIMIT` | No | Daily anonymous AI-request allowance per one-way network identifier (default: 100). |
| `ANON_DAILY_IMAGE_LIMIT` | No | Daily anonymous Image Studio allowance per one-way network identifier (default: 6). |
| `GLOBAL_DAILY_IMAGE_LIMIT` | No | Global anonymous Image Studio ceiling per UTC day (default: 100). |
| `IMAGE_BURST_LIMIT` | No | Image-generation requests allowed per minute per network (default: 3). |
| `ANON_USAGE_HASH_SECRET` | Recommended | Stable secret used to create non-reversible anonymous usage identifiers. |
| `IMAGE_HEALTH_TOKEN` | Recommended | Secret required for the optional active image-generation health probe. Passive health checks spend no credits. |
| `CORS_ALLOWED_ORIGINS` | No | Alias for `ALLOWED_ORIGINS`; comma-separated additions to the built-in approved browser-origin list. |

`ADMIN_KEY` is not a production environment variable. It is only the browser-side variable name used by the admin dashboard when sending the `x-admin-key` header; configure `ADMIN_SECRET` on the server instead.

## 5. Mobile App

The `mobile-app/` directory contains the Capacitor shell used for the Android and iOS releases. It loads the production app surface at `https://offgridtoolkit.ai/online?surface=app` and adds native camera, media, microphone, compass, file-saving, and sharing support.

From `mobile-app/`:

```powershell
npm install
npm run build
npm run sync
```

Open Android with `npm run open:android`. On a Mac with Xcode installed, open iOS with `npm run open:ios`. Android upload keys, `android/key.properties`, Apple signing certificates, provisioning profiles, API keys, and store credentials must remain outside the repository. Store-ready Android releases are uploaded as signed Android App Bundles (`.aab`).

The mobile release checklist, privacy worksheet, store copy, and tester instructions live in `mobile-app/store-launch/`.

## 6. Deployment

The application is deployed on Render, a cloud platform that supports Node.js applications. The deployment is configured to be continuous, meaning that any push to the `main` branch of the GitHub repository will automatically trigger a new Render deployment.

Render handles Brotli/gzip compression at the platform layer. Do not add Express compression middleware unless the deployment architecture changes and compression behavior is re-evaluated.

## 7. Monitoring & Troubleshooting

Operational monitoring and troubleshooting are handled through health checks and Render's short-lived service logs.

*   **Health Checks**: The `/api/health` and `/api/health/image-gen` endpoints provide real-time status of the server and its key services.
*   **Render Logs**: Deployment output, application console messages, and technical request logs are available from the Render service dashboard. Application code does not send a second copy to an external log-aggregation service.
*   **Health Check Script**: A shell script (`scripts/health-check.sh`) is available for manual or automated testing of the image generation service.

---

*For more detailed information on specific features or operational procedures, please refer to the **Command Center Developer Documentation** and the **Operations & Troubleshooting Manual**.*

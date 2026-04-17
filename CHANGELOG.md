# Development Changelog & Progress Report

**Last Updated:** 2026-04-17

This document provides a reverse-chronological summary of recent development progress, features, and improvements to the OffGrid AI ToolKit Online platform.

---

### April 2026

**2026-04-17**
*   **Mobile Layout Hotfix (v5.4.1)**
    *   Fixed mobile layout: added `welcome-content` wrapper div so CSS flex ordering works correctly.
    *   Fixed duplicated quick action buttons (Take Picture, Upload Image, etc. appearing twice).
    *   Fixed compass icon overlapping header/ONLINE badge — reduced size and added proper margins.
    *   Replaced emoji microphone (🎤) with SVG icon for consistent rendering across all Android devices.
    *   Hidden hamburger/sidebar toggle button on all experiences (was only hidden for customers).
    *   Updated service worker cache version to force fresh cache on deploy.

*   **Weak Signal Optimization, Voice Input & UX Polish (v5.4.0)**
    *   Added tagline: "Built for weak signals and hard decisions." below compass on welcome screen.
    *   Implemented **gzip compression** for static assets (HTML, CSS, JS) — 60-70% smaller page loads. SSE streams and API responses are explicitly excluded.
    *   Added **keep-alive headers** with 120s timeout to reduce TCP handshake overhead on slow connections.
    *   Added **service worker** (stale-while-revalidate) for offline caching of static assets. Repeat visits load instantly even on poor connections. API calls are never cached.
    *   Created web app manifest (`offgrid-manifest.json`) for PWA-like behavior.
    *   Added **Voice Input** button (Web Speech API) on both welcome screen and chat view. Pulses red when actively listening. Appends to existing text.
    *   Keyboard now **auto-dismisses after sending** a message (blur on send) — matches ChatGPT/Claude behavior.
    *   Improved welcome textarea auto-resize with proper overflow handling.
    *   Reduced compass icon gap from top of screen for better vertical centering.
    *   Added cache-control headers: 1 hour for HTML/CSS/JS, 7 days for images and fonts.

*   **Mobile UI Overhaul & Branding Cleanup (v5.3.0)**
    *   Enlarged compass icon on mobile using viewport-relative units (25vw) for proportional scaling across all phone sizes.
    *   Replaced model label in bottom bar with contextual action buttons: **Ready-Made Prompts** on welcome screen, **Clear** and **Save** in chat view.
    *   Improved textarea auto-expansion — input box now grows up to ~6 lines on mobile before scrolling (matching ChatGPT/Claude behavior).
    *   Reduced textarea line-height from 1.5 to 1.4 for tighter, more readable text.
    *   Removed "New!" tooltips from video and image upload buttons for cleaner UI.
    *   Removed model name and response time footer from AI messages (no longer needed with single model).
    *   Shortened privacy microcopy to "Ephemeral · No data stored" for mobile space efficiency.
    *   Added privacy microcopy to welcome screen input area.
    *   Removed Gemma model branding from chat interface — OffGrid AI is now the primary identity.

**2026-04-16**
*   **Gemma 4 Migration & System Prompt (v5.2.0)**
    *   Migrated free tier from multi-model Gemma 3 architecture to single-model **Gemma 4 26B A4B**.
    *   Implemented **OffGrid AI system prompt** — a pre-inference behavioral conditioning layer that provides decision-oriented, practical, safety-aware guidance. The AI now identifies as "OffGrid AI" with a calm, authoritative field-expert persona.
    *   Removed all deprecated models: Gemma 3 4B, Gemma 3 12B, Gemma 4 31B (testing), and MedGemma 3 4B.
    *   Replaced model dropdown (welcome screen and chat view) with a static model label.
    *   Updated the "Model Selection" info panel to "About Gemma 4" with Decision Intelligence messaging.
    *   Fixed video analysis prompt — frames are now described as sequential video frames instead of unrelated images.
    *   Updated all meta tags, Open Graph tags, info panels, and marketing copy from Gemma 3 to Gemma 4.
    *   Updated ready-made prompts page badges from "All Models" / "12B+" to "Gemma 4".
    *   Updated Homepage_Redesign_v2.html, README.md, and package.json.
    *   Cleaned up session persistence and model restore logic for single-model architecture.

---

### February 2026

**2026-02-20**
*   **AI Council Model Upgrades**
    *   Upgraded **Medic** from Claude Sonnet 4 (`anthropic/claude-sonnet-4`) to **Claude Sonnet 4.6** (`anthropic/claude-sonnet-4.6`). Same pricing, strictly better benchmarks, 1M context window.
    *   Upgraded **Navigator** from Gemini 2.5 Pro (`google/gemini-2.5-pro`) to **Gemini 3.1 Pro Preview** (`google/gemini-3.1-pro-preview`). Highest Intelligence Index on OpenRouter (57.0). Same pricing.
    *   Updated all display names, comments, and startup banner to reflect the new models.
    *   Updated all documentation (README, Command Center Docs, project docs).
*   **Better Stack Logging Integration (eccb628)**
    *   Integrated privacy-safe, persistent operational logging using Better Stack.
    *   Added a `logToBetterStack` function that sends event metadata (model, duration, status) without logging any user data, prompts, or IPs.
    *   Implemented logging across all major endpoints, including chat, streaming, AI Council, image generation, and PDF export.
    *   Added a `BETTERSTACK_SOURCE_TOKEN` environment variable to securely configure the logging endpoint.

**2026-02-19**
*   **Image Generation Monitoring & Health Check (6e87234)**
    *   Created an in-memory rolling log of the last 50 image generation attempts for real-time monitoring (no prompts are stored).
    *   Added a new health check endpoint at `/api/health/image-gen` that performs a live test and returns recent performance statistics.
    *   Developed a standalone health check script (`scripts/health-check.sh`) for manual or cron-based monitoring of the image generation service.

**2026-02-18**
*   **Command Center UI Refresh (30d7822)**
    *   Removed the "Purchase Offline Version" CTA from the Command Center to create a premium, customer-focused experience.
    *   Added a "Ready-Made Prompts" feature to the Command Center, providing users with a library of pre-built prompts.

**2026-02-17**
*   **Knowledge Base Image Handling (6dec656, 41b12b6)**
    *   Enhanced the "Save to Knowledge Base" feature to correctly handle conversations with images.
    *   User-uploaded and AI-generated images are now saved as separate files alongside the Markdown conversation file, with relative paths for portability.

**2026-02-16**
*   **AI Council Timeouts (a2b36da)**
    *   Implemented strict timeouts for the AI Council to improve responsiveness.
    *   Each council member has 45 seconds to respond, and the Chairman has 30 seconds to provide a synthesis.
*   **AI-Assisted Image Studio (bec51a6, 36ced7d, 1c1f8f9)**
    *   Launched the Image Studio, an AI-assisted suite for generating images.
    *   Added "Prompt Crafting" to generate optimized image prompts from simple user queries.
    *   Added "Create Visual" to generate companion visuals for conversation topics.

### January 2026

**2026-01-17**
*   **Mobile Responsiveness & QR Code (6900c30, 48648a6)**
    *   Overhauled the mobile user experience with a responsive layout for all pages.
    *   Added a QR code to the desktop version for easy access on mobile devices.
*   **UI & Content Improvements (25717a7, 3fdbe9d, eda65cc)**
    *   Redesigned the welcome screen with accordion-style quick prompts.
    *   Improved the content of the info boxes with more detailed technical information and use case scenarios.

**2026-01-14**
*   **Initial Launch (e32282b)**
    *   Initial commit and launch of the OffGrid AI ToolKit Online platform.
    *   Integrated with OpenRouter to provide access to Gemma 3 models.

---

*This changelog is a high-level summary. For detailed technical information, please refer to the **Technical Overview**, **Command Center Developer Documentation**, and **Operations & Troubleshooting Manual**.*

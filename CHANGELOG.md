# Development Changelog & Progress Report

**Last Updated:** 2026-04-19

This document provides a reverse-chronological summary of recent development progress, features, and improvements to the OffGrid AI ToolKit Online platform.

---

### April 2026

**2026-04-19**
*   **PDF Typography & Readability Improvements (v5.5.2)**
    *   **Body text enlarged** from 13px to 15px for better readability, especially on mobile-saved PDFs used as field references.
    *   **Headings scaled up** across all levels: h1 from 22px to 24px, h2 from 16px to 18px, h3/h4 now explicit at 16px.
    *   **Image sizing refined** from `max-height: 45vh` / 400px to `38vh` / 340px. Images remain clearly visible but leave more room for the AI response to begin on the same page.
    *   **Supporting elements** (code, pre, tables) bumped from 12px to 13px. List item and paragraph spacing slightly increased.

*   **Vision System Prompt, PDF Layout, Video Frames & Terms Modal (v5.5.1)**
    *   **Vision-specific system prompt** — Added "Image and video analysis" section to `OFFGRID_SYSTEM_PROMPT`. Instructs the AI to always provide its best assessment even when uncertain, offer a short list of possibilities with reasoning, keep disclaimers concise, and suggest additional images or video uploads for better identification.
    *   **PDF image layout fix** — Added `max-height: 45vh` and `page-break-inside: avoid` to images in the PDF export template. Prevents tall uploaded images from pushing to a new page and leaving a blank first page.
    *   **Video frame limit bump** — Increased server-side frame limit from 5 to 8 evenly-spaced frames sent to the AI. Longer videos now provide better visual coverage for analysis.
    *   **Terms modal mobile fix** — Made the first-run terms/disclaimer modal scrollable on small mobile screens. The banner now uses `overflow-y: auto` with compact spacing so the accept button is always reachable regardless of screen size.

*   **Mobile Save Redesign, PDF Naming & Image Upload UX (v5.5.0)**
    *   **PDF filename fix** — Added `<title>` tag to export-pdf HTML template. Browser now uses the conversation title for the PDF filename instead of "about_blank."
    *   **Keyboard dismiss after image/video upload** — On mobile, keyboard now automatically dismisses after selecting an image or video so users can see the upload preview confirmation.
    *   **Mobile Save modal redesign** — Mobile users (both demo and customer) now see a streamlined "Save Conversation" modal with title field and a prominent "Save as PDF" button. Category, tags, and .md save remain available on desktop for USB drive users.
    *   **Demo mobile Save** — Demo users on mobile now get PDF save functionality with a soft upsell to the USB version, instead of a full-screen upsell-only modal that blocked saving entirely.
    *   Video upload also dismisses keyboard on mobile after frame extraction completes.

**2026-04-18**
*   **Mobile UX Fixes (v5.4.1)**
    *   **Fixed tagline visibility on mobile** — added explicit `display: block !important` to override the paragraph-hide rule. "Built for weak signals and hard decisions." now shows on all screen sizes.
    *   **Enlarged compass** back to 22vw / 150px max for better visual presence on mobile.
    *   **Fixed voice input text transfer** — was looking for wrong textarea ID (`welcomeInput` instead of `welcomeMessageInput`). Voice transcription now correctly populates the input field.
    *   **Fixed textarea auto-resize for ready-made prompts** — `autoResizeWelcome()` now called after prompt text is injected. Increased max-height to 160px on mobile (~6 lines) before scrollbar appears.
    *   **Keyboard stays dismissed after AI response** — removed auto-focus on mobile after stream completes. Desktop still auto-focuses. User taps input when ready to type again.
    *   Reduced line-height to 1.35 on both welcome and chat textareas for tighter text display.

*   **Welcome Screen Polish, Voice Input & Keyboard UX (v5.4.0)**
    *   Added tagline "Built for weak signals and hard decisions." below compass icon on welcome screen.
    *   Added **Voice Input** button (SVG microphone icon) to both welcome screen and chat view button rows. Uses Web Speech API for native browser speech-to-text. Button pulses red when actively listening.
    *   Added `welcome-content` wrapper div for proper CSS flex ordering on mobile — fixes duplicate quick action buttons issue.
    *   **Keyboard dismiss on send:** Input field now blurs after sending a message, automatically dismissing the mobile keyboard so users can see the AI response streaming in (matching ChatGPT/Claude behavior).
    *   Reduced compass icon to 18vw (from 25vw) with 120px max to prevent header overlap on mobile.
    *   Hidden hamburger menu on all experiences (was only hidden for customers).
    *   Updated CSS ordering to accommodate tagline in the mobile welcome screen flow.
    *   Protected tagline from the mobile "hide description paragraphs" rule.

**2026-04-17**
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

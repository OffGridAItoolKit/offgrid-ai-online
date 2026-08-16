# Development Changelog & Progress Report

**Last Updated:** 2026-08-16

This document provides a reverse-chronological summary of recent development progress, features, and improvements to the OffGrid AI FieldGuide online platform.

---

### August 2026

**2026-08-16**
*   **Branded Android system bars**
    *   Added an accessible gold status-bar treatment with dark indicators and a dark-brown navigation bar with light controls while preserving Android's native usability.
    *   Added Android 15+ inset-sized protection views because modern edge-to-edge Android versions ignore direct opaque system-bar colors.
    *   Kept legacy system-bar colors for Android 14 and earlier and added automated regression checks for both paths.

**2026-08-12**
*   **Multi-photo rollout and mobile presentation polish**
    *   Promoted the tested four-photo identification flow and Ready-Made Prompts-first home order to the normal app, with a temporary `preview=single-image` rollback available during rollout.
    *   Routed Upload Image(s) through the Android image/gallery picker instead of the generic any-file chooser while keeping camera capture as a separate action.
    *   Promoted `Save Field Guide` to the first and strongest Image Studio action, removed the redundant `PDF` label there, and aligned related action menus.
    *   Preserved the gold Android status bar, exposed Light Mode/Dark Mode labels at 390 CSS pixels and wider, and added a slightly warmer off-white light-mode canvas for clearer card separation.

**2026-08-11 — private preview**
*   **Multi-photo identification and home-action prioritization**
    *   Added an opt-in `preview=multi-image` experience that accepts up to four related photos, presents removable thumbnails, and instructs the vision model to compare the photos as one evidence set.
    *   Prioritized the positively received Ready-Made Prompts card above image, video, and Saved Guides actions while leaving the public experience unchanged during phone testing.

**2026-08-11**
*   **Google Play privacy-policy clarification**
    *   Added explicit Data Retention and Data Deletion sections that distinguish transient AI request content, 31-day anonymous usage counters, optional support records, third-party technical metadata, and user-saved local files.
    *   Added a direct deletion-request procedure and strengthened the standalone data-deletion page without changing the app's underlying data practices.
    *   Added an automated privacy-policy compliance check to prevent the required disclosures from being removed accidentally.

**2026-08-10**
*   **FieldGuide branding and landing-page discovery**
    *   Standardized the online product name as `OffGrid AI FieldGuide` across the hosted app, native labels, policy pages, sharing text, store-launch material, and operational documentation while retaining two-word `field guide` wording for the content itself.
    *   Added a new 1200-by-630 social share card using the actual app phone screen, published it under the descriptive `offgrid-ai-fieldguide-social-share.png` filename, and updated Open Graph and Twitter metadata.
    *   Added crawl directives, a root sitemap, `SoftwareApplication` structured data, an AI-readable `llms.txt`, and Google Search Console ownership verification; the landing content remains server-rendered HTML and does not require a separate prerendering service.
    *   Highlighted the ability to open previously saved PDFs without an internet connection while preserving the clear statement that AI features require internet access.

**2026-08-08**
*   **Native Read Aloud and field-guide sharing follow-up**
    *   Added an Android system Text-to-Speech bridge because the installed WebView does not expose browser `speechSynthesis`; speech uses the phone's configured local voice and preserves structured pauses.
    *   Preserved the original assistant Markdown when handing an answer to Field Guide creation so preview and native PDFs retain headings, emphasis, bullets, numbered steps, and tables.
    *   Renamed the PDF-preview action to `Share PDF` and the generated-image actions to `Share Image` and `Share Field Guide`; the native PDF share sheet remains scheduled for the next Android binary.
    *   Added an approximately one-minute expectation to Image Studio generation messaging and updated shared-image attribution to `Made with OffGrid AI Image Studio`.
*   **Field Guide becomes the primary answer-to-offline workflow**
    *   Promoted `Make Field Guide` to the first, primary follow-up action while keeping `Create Visual` immediately available beside it.
    *   Changed `Make Field Guide` into one automated sequence: generate the supporting visual, assemble it with the answer, and open the final field-guide preview without requiring an intermediate Image Studio save action.
    *   Renamed the preview's top save action to `Save Field Guide`; the persistent lower actions are now `Share PDF` and `Save PDF`.
    *   Added an Android native `shareFieldGuidePdf` bridge that creates the same complete PDF in cache and opens the Android share sheet with the PDF attached. This native capability requires the next Android binary release.
    *   Older installed builds receive explicit guidance to save the PDF and share it from `Files > Downloads > OffGrid AI`.
*   **Mobile first-visit and welcome-screen polish**
    *   Stopped automatic focus of the welcome composer on phone/app surfaces so the keyboard remains closed until the user taps the input.
    *   Restyled the required first-run safety and privacy consent screen with the app's charcoal, slate, and gold visual system without changing the disclosure wording or acceptance requirement.
    *   Removed the redundant green `OffGrid AI` header badge on mobile while preserving the connection indicator and day/night control.
    *   Renamed the composer shortcut to `Field Prompts`, made it equal width with `Voice Input`, and added modest spacing and padding to the lower mobile action cards.

**2026-08-07**
*   **Ready-Made Prompts synchronized with OffGrid AI Intel**
    *   Replaced the online 114-prompt showcase and visible 285-prompt legacy split with the live Intel catalog: 9 categories, 81 subcategories, and 2,106 prompt entries.
    *   Preserved the Intel wording, ordering, Starter/Core/Advanced/Image-Based tiers, and intentional repeated placements.
    *   Added collapsed topic sections so mobile users browse 26-prompt groups without rendering hundreds of cards at once; search and capability filters expand matching topics automatically.
    *   Preserved local Favorites, Recent prompts, photo handoff, and field-guide handoff. The separate `/command/ready-made-prompts` catalog remains unchanged.
    *   Added a reproducible Intel sync script, source SHA-256 metadata, and catalog integrity tests.
*   **Video intake and Saved Guides follow-up**
    *   Raised the local video-selection limit from 50 MB to 200 MB while preserving the 20-second duration limit; only eight compressed frames are sent for analysis, not the source video.
    *   Replaced Android's unreliable folder-view request with a document picker initialized at `Downloads/OffGrid AI`; selecting a saved guide opens its PDF.
    *   The video limit is deployed through the hosted app. The Saved Guides native picker requires the next Android binary release.
*   **Online product rename deployed**
    *   Updated the online web/app interface, native mobile labels, policy pages, exports, sharing text, and operational metadata to `OffGrid AI FieldGuide`.
    *   Used `by OffGrid AI` for consumer-facing attribution while retaining `OFFGRID AI TOOLKIT, LLC` as the legal entity.
    *   Preserved explicit `OffGrid AI ToolKit` references that describe the separate offline/USB product.
*   **Responsive mobile layout deployed**
    *   Prevented flex children and welcome-screen controls from expanding the document beyond compact Android viewports.
    *   Added a two-row action layout for phones at 420 CSS pixels or narrower so Prompts, Voice Input, and Send remain reachable with enlarged display text.
    *   Added safe vertical centering so short screens begin at the compass and scroll normally instead of hiding content behind the fixed header.
    *   Verified zero horizontal overflow at 320x568, 360x800, 412x915, 768x1024, and 1024x768 viewports in both web and installed-app configurations.

---

### July 2026

**2026-07-23**
*   **Restore Image Studio provider routing**
    *   Replaced the unavailable `google/gemini-3-pro-image-preview` route with its production successor, `google/gemini-3-pro-image`.
    *   Kept per-request Zero Data Retention enforcement and the existing OpenRouter chat-completions image response contract.
    *   Updated the active image health probe to use the same shared model configuration as customer requests so monitoring cannot drift to a different model ID.

**2026-07-10**
*   **Simplified launch monitoring and privacy surface (v5.7.2)**
    *   Removed the Better Stack runtime integration, source token, endpoint, and event transmissions.
    *   Removed the license/admin event hooks that previously sent operational metadata to the external logging service.
    *   Standardized launch troubleshooting on Render's seven-day service logs, built-in health endpoints, and explicitly submitted in-app feedback.
    *   Updated environment templates, operations documentation, store privacy worksheets, and launch notes to match the reduced processor list.

---

### April 2026

**2026-04-30**
*   **iOS Video Fix v2: DOM Attachment + timeupdate Fallback (v5.6.3)**
    *   **Root cause identified:** `requestVideoFrameCallback` does not fire on iOS Safari when the video element is not attached to the DOM. The v5.6.2 video element was created via `document.createElement` but never appended to the page.
    *   **Fix:** Video element is now appended to the DOM (hidden off-screen with `position:fixed; top:-9999px; opacity:0`) before playback begins. Removed from DOM after frame extraction completes.
    *   **Reduced playback rate** from 4x to 2x for better iOS compatibility (iOS may silently cap or ignore high playback rates).
    *   **Added `timeupdate` fallback:** If rVFC doesn't fire (detected via a flag), frames are captured using `timeupdate` events instead. This provides a secondary capture path on devices where rVFC is unreliable.
    *   **Consolidated cleanup:** All video element cleanup (revoke blob URL + remove from DOM) now handled by a single `cleanupVideoEl()` helper used in all code paths.
    *   **Conservative timeout:** Safety timeout increased to `duration + 8 seconds` (assumes 1x playback as worst case).

*   **Hybrid Video Frame Extraction â€” iOS rVFC + Android Seek (v5.6.2)**
    *   **Complete rewrite of video frame extraction** using a platform-adaptive hybrid approach. iOS Safari's `currentTime` seeking is fundamentally unreliable â€” even with play/pause buffering and timeout fallbacks, it only captures frame 1.
    *   **iOS/Safari (Method A):** Uses `requestVideoFrameCallback` (rVFC) to play the video at 4x speed and capture frames as the system actually renders them. Includes a progress bar, safety timeout, and graceful fallback. Requires iOS 15.4+ (supported on all modern iPhones).
    *   **Android/Desktop (Method B):** Retains the proven seek-based approach (`currentTime` + `onseeked` event) which works reliably on non-iOS platforms.
    *   **Shared utilities:** `drawFrameToCanvas()`, `isValidFrame()`, and `completeVideoSetup()` are now shared between both methods, reducing code duplication.
    *   **Platform detection:** Uses UA sniffing + `maxTouchPoints` for iPad detection + feature detection (`'requestVideoFrameCallback' in HTMLVideoElement.prototype`) to choose the right method.
    *   **Older iOS fallback:** Devices without rVFC support get a clear error message directing them to update or use desktop.

*   **iOS Video Upload Fix & Command Center Token Overflow Fix (v5.6.1)**
    *   **iOS video frame extraction rewritten** â€” Fixed video upload getting stuck on iPhone/iOS Safari. Root cause: iOS requires `playsinline` attribute, `loadeddata` event (not `loadedmetadata`), and a playâ†’pause buffer cycle before seeking works. Added 3-second timeout fallback per frame seek â€” if `onseeked` doesn't fire, attempts to draw anyway and skips blank frames. Also added pixel-check validation to avoid capturing duplicate/black frames.
    *   **Base64 token overflow prevention** â€” Fixed follow-up messages after image generation causing 555,000+ token errors. Generated images were stored as full base64 data URLs in conversation history and sent as text tokens on follow-up. Added `stripBase64FromContent()` utility that replaces base64 image data with placeholder text before API calls. Applied to both `command.html` and `arena.html` (stream and council endpoints).
    *   **Memory cleanup** â€” Added `URL.revokeObjectURL()` calls after video processing completes to prevent memory leaks on mobile devices.

**2026-04-20**
*   **Weak-Signal Performance: Edge Caching & Cache-Control Headers (v5.6.0)**
    *   **Render Edge Caching enabled** â€” Static assets (CSS, JS, images, fonts) are now served from Render's global CDN edge nodes. Users on weak or distant connections receive cached assets from the nearest edge location instead of hitting the origin server. Cache purges automatically on every redeploy.
    *   **Cache-Control headers added** â€” CSS/JS/fonts cached for 24 hours (`max-age=86400`), images cached for 7 days (`max-age=604800`), HTML pages revalidate on every browser request but are cached at the edge for 1 hour (`s-maxage=3600`). These headers tell both the browser and Render's CDN how long to cache each asset type.
    *   **No Express compression middleware needed** â€” Confirmed that Render's native runtime already applies automatic Brotli and gzip compression at the infrastructure layer. Adding Express `compression` would cause double-compression.

**2026-04-19**
*   **PDF Typography & Readability Improvements (v5.5.2)**
    *   **Body text enlarged** from 13px to 15px for better readability, especially on mobile-saved PDFs used as field references.
    *   **Headings scaled up** across all levels: h1 from 22px to 24px, h2 from 16px to 18px, h3/h4 now explicit at 16px.
    *   **Image sizing refined** from `max-height: 45vh` / 400px to `38vh` / 340px. Images remain clearly visible but leave more room for the AI response to begin on the same page.
    *   **Supporting elements** (code, pre, tables) bumped from 12px to 13px. List item and paragraph spacing slightly increased.

*   **Vision System Prompt, PDF Layout, Video Frames & Terms Modal (v5.5.1)**
    *   **Vision-specific system prompt** â€” Added "Image and video analysis" section to `OFFGRID_SYSTEM_PROMPT`. Instructs the AI to always provide its best assessment even when uncertain, offer a short list of possibilities with reasoning, keep disclaimers concise, and suggest additional images or video uploads for better identification.
    *   **PDF image layout fix** â€” Added `max-height: 45vh` and `page-break-inside: avoid` to images in the PDF export template. Prevents tall uploaded images from pushing to a new page and leaving a blank first page.
    *   **Video frame limit bump** â€” Increased server-side frame limit from 5 to 8 evenly-spaced frames sent to the AI. Longer videos now provide better visual coverage for analysis.
    *   **Terms modal mobile fix** â€” Made the first-run terms/disclaimer modal scrollable on small mobile screens. The banner now uses `overflow-y: auto` with compact spacing so the accept button is always reachable regardless of screen size.

*   **Mobile Save Redesign, PDF Naming & Image Upload UX (v5.5.0)**
    *   **PDF filename fix** â€” Added `<title>` tag to export-pdf HTML template. Browser now uses the conversation title for the PDF filename instead of "about_blank."
    *   **Keyboard dismiss after image/video upload** â€” On mobile, keyboard now automatically dismisses after selecting an image or video so users can see the upload preview confirmation.
    *   **Mobile Save modal redesign** â€” Mobile users (both demo and customer) now see a streamlined "Save Conversation" modal with title field and a prominent "Save as PDF" button. Category, tags, and .md save remain available on desktop for USB drive users.
    *   **Demo mobile Save** â€” Demo users on mobile now get PDF save functionality with a soft upsell to the USB version, instead of a full-screen upsell-only modal that blocked saving entirely.
    *   Video upload also dismisses keyboard on mobile after frame extraction completes.

**2026-04-18**
*   **Mobile UX Fixes (v5.4.1)**
    *   **Fixed tagline visibility on mobile** â€” added explicit `display: block !important` to override the paragraph-hide rule. "Built for weak signals and hard decisions." now shows on all screen sizes.
    *   **Enlarged compass** back to 22vw / 150px max for better visual presence on mobile.
    *   **Fixed voice input text transfer** â€” was looking for wrong textarea ID (`welcomeInput` instead of `welcomeMessageInput`). Voice transcription now correctly populates the input field.
    *   **Fixed textarea auto-resize for ready-made prompts** â€” `autoResizeWelcome()` now called after prompt text is injected. Increased max-height to 160px on mobile (~6 lines) before scrollbar appears.
    *   **Keyboard stays dismissed after AI response** â€” removed auto-focus on mobile after stream completes. Desktop still auto-focuses. User taps input when ready to type again.
    *   Reduced line-height to 1.35 on both welcome and chat textareas for tighter text display.

*   **Welcome Screen Polish, Voice Input & Keyboard UX (v5.4.0)**
    *   Added tagline "Built for weak signals and hard decisions." below compass icon on welcome screen.
    *   Added **Voice Input** button (SVG microphone icon) to both welcome screen and chat view button rows. Uses Web Speech API for native browser speech-to-text. Button pulses red when actively listening.
    *   Added `welcome-content` wrapper div for proper CSS flex ordering on mobile â€” fixes duplicate quick action buttons issue.
    *   **Keyboard dismiss on send:** Input field now blurs after sending a message, automatically dismissing the mobile keyboard so users can see the AI response streaming in (matching ChatGPT/Claude behavior).
    *   Reduced compass icon to 18vw (from 25vw) with 120px max to prevent header overlap on mobile.
    *   Hidden hamburger menu on all experiences (was only hidden for customers).
    *   Updated CSS ordering to accommodate tagline in the mobile welcome screen flow.
    *   Protected tagline from the mobile "hide description paragraphs" rule.

**2026-04-17**
*   **Mobile UI Overhaul & Branding Cleanup (v5.3.0)**
    *   Enlarged compass icon on mobile using viewport-relative units (25vw) for proportional scaling across all phone sizes.
    *   Replaced model label in bottom bar with contextual action buttons: **Ready-Made Prompts** on welcome screen, **Clear** and **Save** in chat view.
    *   Improved textarea auto-expansion â€” input box now grows up to ~6 lines on mobile before scrolling (matching ChatGPT/Claude behavior).
    *   Reduced textarea line-height from 1.5 to 1.4 for tighter, more readable text.
    *   Removed "New!" tooltips from video and image upload buttons for cleaner UI.
    *   Removed model name and response time footer from AI messages (no longer needed with single model).
    *   Shortened privacy microcopy to "Ephemeral Â· No data stored" for mobile space efficiency.
    *   Added privacy microcopy to welcome screen input area.
    *   Removed Gemma model branding from chat interface â€” OffGrid AI is now the primary identity.

**2026-04-16**
*   **Gemma 4 Migration & System Prompt (v5.2.0)**
    *   Migrated free tier from multi-model Gemma 3 architecture to single-model **Gemma 4 26B A4B**.
    *   Implemented **OffGrid AI system prompt** â€” a pre-inference behavioral conditioning layer that provides decision-oriented, practical, safety-aware guidance. The AI now identifies as "OffGrid AI" with a calm, authoritative field-expert persona.
    *   Removed all deprecated models: Gemma 3 4B, Gemma 3 12B, Gemma 4 31B (testing), and MedGemma 3 4B.
    *   Replaced model dropdown (welcome screen and chat view) with a static model label.
    *   Updated the "Model Selection" info panel to "About Gemma 4" with Decision Intelligence messaging.
    *   Fixed video analysis prompt â€” frames are now described as sequential video frames instead of unrelated images.
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


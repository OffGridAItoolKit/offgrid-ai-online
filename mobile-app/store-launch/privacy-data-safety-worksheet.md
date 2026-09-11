# Privacy And Data Safety Worksheet

Complete this before submitting store forms. Do not submit privacy forms from assumptions.

## Current v1 Defaults

- Account creation: no.
- In-app purchases: no.
- Ads: no.
- Third-party ad analytics: no.
- App requires internet for AI responses: yes.
- User can upload text, images, videos, and generated-image requests: yes.
- User can save images/PDFs locally to phone: yes.

## Verified Application Facts

- [x] Text prompts and AI responses are processed in memory and are not written to OffGrid chat history or an OffGrid user account.
- [x] Uploaded images are resized in the browser, sent for the requested AI operation, and are not saved by the OffGrid application database.
- [x] Uploaded videos are reduced to selected image frames on the device; the original video is not uploaded or saved by the OffGrid application database.
- [x] Generated images are returned to the active session and are not saved by the OffGrid application database unless the user saves them to the phone.
- [x] The iOS app sends AI requests through the OffGrid service on Render and OpenRouter using fixed, per-request processor allowlists. Main assistant requests and text-only Image Studio prompt-preparation requests use Google Gemma 4 only through NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16. Only if all four fail may a main assistant request use Google Gemini 2.5 Pro through Google Cloud Vertex AI. Google-powered Image Studio generation also uses Google Cloud Vertex AI and receives the prepared text prompt.
- [x] The Android app and web app continue to use the legacy OpenRouter Zero Data Retention route and existing Image Studio helper behavior. They do not use the iOS fixed processor list or the iOS-specific consent flow; the eligible downstream endpoint can vary under that legacy route.
- [x] Apple Speech Recognition receives microphone audio only when an iOS user activates Voice Input. The resulting transcription text is sent to the AI route only when the user submits it.
- [x] Application code does not send operational events to a separate log-aggregation service. Troubleshooting uses Render's short-lived service logs.
- [x] No advertising analytics or third-party behavioral analytics are present in v1.
- [x] Anonymous abuse controls store a one-way HMAC of the request network address, usage type/date/count, and timestamps. The application removes these counters after 31 days.
- [x] Optional in-app feedback is stored in the OffGrid database. It includes category, user-entered details, app context, and the AI response only when the user chooses to include it. Feedback rows do not store IP address or user-agent text.

## Verified External Account Facts

- [x] OpenRouter Input & Output Logging is disabled for the Default Workspace.
- [x] OpenRouter observability Broadcast is disabled.
- [x] OpenRouter product-improvement input/output use and the 1% data discount are disabled.
- [x] OpenRouter endpoints that train on request data or publish prompts are not allowed by the account privacy settings.
- [x] Every iOS AI request enforces per-request Zero Data Retention, `data_collection: "deny"`, and a fixed processor allowlist. OpenRouter may fail over among only the four named Gemma 4 BF16 processors; unlisted provider fallback is disabled. After that fixed list fails, the application may separately retry a main assistant request with the pinned Gemini 2.5 Pro Google Cloud Vertex AI fallback. Image Studio text preparation uses that same four-processor Gemma 4 allowlist, while Google-powered image generation is pinned to Google Cloud Vertex AI.
- [x] The Android and web legacy OpenRouter route continues to require Zero Data Retention, but it is not represented as having the iOS fixed processor order or iOS-specific affirmative consent.
- [x] Render Starter request logs retain request path, network address, request ID, response timing/size, and user-agent data for 7 days. Application logs intentionally contain no prompt/response content.

## Likely Store Disclosures To Prepare

- User Content: prompts, uploaded images/video frames, generated-image requests.
- Diagnostics: crash/error/operational logs if retained.
- Identifiers: network address is processed for security and rate limiting; a one-way identifier is retained by the app for up to 31 days. Hosting providers may also process network data.
- Purpose: app functionality, security, abuse prevention, troubleshooting.
- Sharing: AI processors and hosting/logging providers receive data needed to operate the service.

## Google Play Form Submitted - 2026-07-10

The production submission uses these disclosures:

- Data shared: photos, videos, voice or sound recordings, health information, and other user-generated content.
- Data collected: diagnostics, app interactions, other user-generated content, and device or other identifiers.
- Photos, videos, voice input, and health information are optional, processed ephemerally, and used for app functionality.
- Other user-generated content is optional. It is used for app functionality and limited product-support analysis; it is not marked ephemeral because explicitly submitted feedback can be retained.
- App interactions and the one-way abuse identifier are required for daily limits, app operation, and abuse prevention and can be retained for up to 31 days.
- Diagnostics are required for troubleshooting/security and may be retained in Render service logs for up to 7 days.
- All disclosed data is encrypted in transit.
- The app does not create accounts, use Advertising ID, collect location, show ads, or make in-app sales.
- Data-deletion requests are documented at `https://offgridtoolkit.ai/data-deletion`.

## Plain-Language Disclosure

```text
OffGrid AI FieldGuide sends prompts and selected media to online AI services only when you use chat, upload, camera, video, voice, or Image Studio features. The app does not require an account, does not include ads, and does not include in-app purchases. Optional feedback is saved only when you submit it, and an AI response is included only when you choose that option.
```

## Platform-Specific AI Routes — Build 5

### iOS

- The first-launch disclosure names the data categories and processors, and requires affirmative consent before online AI features are enabled. A one-time contextual confirmation is also shown before the first selected photo or extracted video-frame transfer. Consent remains active until the user withdraws it from `+ menu > Privacy & AI Data`.
- Activated Voice Input uses Apple Speech Recognition for microphone-audio transcription. The transcription text is not sent to the online AI route until the user submits it.
- Main text, photo, and video-frame analysis travels through Render and OpenRouter to Google Gemma 4 using only NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16. The processor order is fixed.
- Google Gemini 2.5 Pro through Google Cloud Vertex AI is the only emergency main-assistant fallback and is attempted only after all four named Gemma 4 processors fail.
- Text-only Image Studio prompt preparation uses the same fixed Gemma 4 route through NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16. Google-powered Image Studio generation uses Google Cloud Vertex AI and receives only the prepared text prompt. Selected photos and extracted video frames are not sent to Image Studio.
- Every iOS AI request enforces Zero Data Retention, `data_collection: "deny"`, a fixed allowlist, and no undisclosed provider fallback.

### Android And Web

- Android and web retain the legacy OpenRouter Zero Data Retention route and their existing first-run experience.
- They do not use the iOS fixed processor order or the iOS-specific consent controls. Do not copy the fixed iOS processor claim into Google Play disclosures unless the Android route is intentionally changed and reverified.

## Apple App Privacy Configured - 2026-08-29

The conservative v1 label is configured with no tracking:

- Other User Content: App Functionality; not linked to identity.
- Product Interaction: App Functionality; linked conservatively because short-lived operational logs can include a network address.
- Performance Data: App Functionality; linked conservatively because short-lived operational logs can include a network address.
- Other Diagnostic Data: App Functionality; linked conservatively because short-lived operational logs can include a network address.
- Other Data Types: App Functionality; linked conservatively because hosting logs can briefly contain a network address.
- Real-time prompts and selected media are not disclosed as collected under Apple's definition because neither OffGrid nor its third-party partners retain them longer than necessary to service the request.

The account holder confirmed Apple's accuracy-and-compliance attestation, and the label was published on 2026-08-29.

## Google Play Health Apps Declaration Update - 2026-07-30

Selected categories:

- Emergency and first aid
- Medical reference and education
- Other

`Other` explanation:

```text
General-purpose AI chat analyzes user-selected photos/video frames and answers questions, including health and safety topics, or creates educational visuals. It provides general information only, not diagnosis or medical-device functionality.
```

The first-run safety notice, photo/video entry points, and store listing use matching language: health-related AI and media analysis is general educational information, not diagnosis, medical advice, or medical-device functionality. Users are directed to qualified healthcare professionals and local emergency services as appropriate.

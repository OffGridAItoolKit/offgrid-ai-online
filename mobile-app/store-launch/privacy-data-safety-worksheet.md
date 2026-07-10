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
- [x] OpenRouter receives the text/messages and selected image data required for the chosen AI operation. Image Studio also runs through OpenRouter.
- [x] Application code does not send operational events to a separate log-aggregation service. Troubleshooting uses Render's short-lived service logs.
- [x] No advertising analytics or third-party behavioral analytics are present in v1.
- [x] Anonymous abuse controls store a one-way HMAC of the request network address, usage type/date/count, and timestamps. The application removes these counters after 31 days.
- [x] Optional in-app feedback is stored in the OffGrid database. It includes category, user-entered details, app context, and the AI response only when the user chooses to include it. Feedback rows do not store IP address or user-agent text.

## Verified External Account Facts

- [x] OpenRouter Input & Output Logging is disabled for the Default Workspace.
- [x] OpenRouter observability Broadcast is disabled.
- [x] OpenRouter product-improvement input/output use and the 1% data discount are disabled.
- [x] OpenRouter endpoints that train on request data or publish prompts are not allowed by the account privacy settings.
- [x] App chat and Image Studio requests enforce per-request Zero Data Retention routing. Current ZDR registry checks confirmed eligible endpoints for Gemma 4 26B and Gemini 3 Pro Image Preview on Vertex.
- [x] Render Starter request logs retain request path, network address, request ID, response timing/size, and user-agent data for 7 days. Application logs intentionally contain no prompt/response content.

## Likely Store Disclosures To Prepare

- User Content: prompts, uploaded images/video frames, generated-image requests.
- Diagnostics: crash/error/operational logs if retained.
- Identifiers: network address is processed for security and rate limiting; a one-way identifier is retained by the app for up to 31 days. Hosting providers may also process network data.
- Purpose: app functionality, security, abuse prevention, troubleshooting.
- Sharing: AI processors and hosting/logging providers receive data needed to operate the service.

## Plain-Language Disclosure

```text
OffGrid AI ToolKit sends prompts and selected media to online AI services only when you use chat, upload, camera, video, voice, or Image Studio features. The app does not require an account, does not include ads, and does not include in-app purchases in v1. Optional feedback is saved only when you submit it, and an AI response is included only when you choose that option.
```

# App Store iOS v1 Metadata

Prepared: 2026-08-29

Build 5 compliance update: 2026-09-11

## Identity

- Platform: iOS
- App name (21/30): `OffGrid AI FieldGuide`
- Bundle ID: `com.offgridaitoolkit.app`
- Version: `1.0`
- Candidate build: `5`
- First submitted build: `1`
- Apple ID: `6806680581`
- SKU: `offgrid-ai-fieldguide-ios`
- Price: Free
- Primary language: English (U.S.)
- Public seller: `INSPIRED MARKETING & DESIGN, LLC`
- Copyright: `2026 INSPIRED MARKETING & DESIGN, LLC`

## Listing

- Subtitle (25/30): `Practical AI field guides`
- Promotional text (151/170 UTF-8 bytes): `Ask practical questions, analyze photos and videos, create visual field guides, and save useful answers as PDFs—no account, ads, or in-app purchases.`
- Keywords (92/100 UTF-8 bytes): `preparedness,survival,homestead,hiking,camping,RV,emergency,AI,field guide,compass,first aid`
- Primary category: Reference
- Secondary category: Utilities
- Support URL: `https://offgridai.guide`
- Marketing URL: `https://offgridai.guide`
- Privacy Policy URL: `https://offgridtoolkit.ai/privacy`

## Description

OffGrid AI FieldGuide is a practical AI companion for preparedness, homesteading, hiking, RV travel, van life, and hard decisions in the field.

Ask questions, upload photos or videos, create field-ready visuals, save guides to your phone, and use the built-in compass when you need a quick heading.

Photo and video analysis can be used for user-requested health, first-aid, or safety questions and provides general educational information only.

Features:

- Practical OffGrid AI chat
- Photo and video analysis
- Camera and gallery upload
- Image Studio for diagrams, field cards, and useful visuals
- Save generated visuals and field guide PDFs to your phone
- Share answers and visuals
- Ready-Made Prompts for common preparedness scenarios
- Day/night mode
- Tap-to-enable compass heading

OffGrid AI FieldGuide is online-only. Internet access is required for AI responses. The physical OffGrid AI ToolKit flash-drive product is available separately for offline use and emergency preparedness.

No account is required. No ads. No in-app purchases.

OffGrid AI FieldGuide is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. AI can make mistakes. Verify important survival, medical, legal, financial, or safety information before acting. For medical advice, diagnosis, or treatment, consult a qualified healthcare professional. In an emergency, contact local emergency services.

## Release Notes

Initial iPhone release of OffGrid AI FieldGuide, including practical AI chat, photo and video analysis, Image Studio visuals, Ready-Made Prompts, compass headings, and native saving and sharing of Field Guide PDFs.

## Review Information

- Sign-in required: No
- Demo account: Not applicable
- Contact email: `support@offgridaitoolkit.com`
- Notes: use the review note in `../ios-handoff-for-tedd.md`
- Release method: Manual release after approval

## Age Rating

App Store Connect calculated 13+ from the completed questionnaire on 2026-08-29.

- User-generated content distributed to other users: No
- User-to-user messaging or social media: No
- Unrestricted web access: No
- Advertising, gambling, contests, or loot boxes: No
- Medical or treatment information: Infrequent
- Realistic violence, weapons, or fear themes: Infrequent at most because users may request emergency, first-aid, or preparedness guidance
- Sexual content or nudity: None as an intended app experience

## App Privacy Answers

The following conservative disclosure was configured in App Store Connect on 2026-08-29 from the verified facts in `../privacy-data-safety-worksheet.md`:

- Other User Content: App Functionality; not linked to identity; not used for tracking.
- Product Interaction: App Functionality; linked conservatively because short-lived operational logs can include a network address; not used for tracking.
- Performance Data: App Functionality; linked conservatively because short-lived operational logs can include a network address; not used for tracking.
- Other Diagnostic Data: App Functionality; linked conservatively because short-lived operational logs can include a network address; not used for tracking.
- Other Data Types: App Functionality; linked conservatively because hosting logs can briefly contain a network address; not used for tracking.
- Text prompts, Apple Speech transcription text, selected images, selected video frames, and generated-image requests are processed for the user-requested operation and are not retained as account history. Microphone audio is processed by Apple Speech Recognition only when Voice Input is activated; it is not sent to the OffGrid AI service.
- On iOS, main assistant requests and text-only Image Studio prompt-preparation requests travel through Render and OpenRouter and are restricted to Google Gemma 4 through NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16. Only after all four fail may a main assistant request use Google Gemini 2.5 Pro through Google Cloud Vertex AI. Google-powered Image Studio generation also uses Google Cloud Vertex AI and receives the prepared text prompt. Every iOS AI request enforces Zero Data Retention, `data_collection: "deny"`, a fixed processor allowlist, and no undisclosed provider fallback.
- Tracking: No.

The privacy policy URL is `https://offgridtoolkit.ai/privacy`; the user privacy choices URL is `https://offgridtoolkit.ai/data-deletion`. The account holder approved and published the disclosure on 2026-08-29.

## Export Compliance

`ITSAppUsesNonExemptEncryption` is `false`. The app uses standard HTTPS through Apple/system networking and bundled SDKs and does not implement proprietary or non-exempt cryptography.

## Screenshot Order

The App Store Connect form for this app requests 6.5-inch portrait files. The upload-ready 1284×2778 files are under `screenshots/iphone-6.5/`. A matching 6.9-inch source set is retained under `screenshots/iphone-6.9/`.

1. `01-practical-ai-chat.jpg`
2. `02-multi-photo-analysis.jpg`
3. `03-image-studio.jpg`
4. `04-field-guide-preview.jpg`
5. `05-ready-made-prompts.jpg`
6. `06-saved-field-guide.jpg`

Do not use the older screenshot that shows the iOS status bar overlapping the app header.

The six files were uploaded individually on 2026-08-29 so App Store Connect retained the intended storefront order.

## Submission Status

On 2026-08-29, Apple verified the approved EU Digital Services Act trader phone and email and marked the compliance record Active. Version `1.0 (1)` was submitted with manual release selected and was later returned under Guideline 2.1 for additional information and physical-device video evidence.

Build `1.0 (3)` retained the native Apple Speech fix from build `2` and moved iPhone video selection/frame extraction to native PhotosUI and AVFoundation. The same 4K/60-fps clip that failed in build `2` passed the physical attachment test in build `3` on 2026-09-04. The complete seven-part response and recording checklist used for that submission are in `guideline-2.1-response-build-3.md`.

Build `1.0 (3)` was resubmitted on 2026-09-04 with the requested physical-device recording and complete Guideline 2.1 answers. Apple then requested detailed face-data practices and explicit permission before sharing personal data with third-party AI services.

Build `1.0 (4)` added the first iOS AI-data consent flow, contextual media confirmation, consent withdrawal, expanded privacy disclosures, and named native permission strings. It was uploaded on 2026-09-11. Physical testing found that its Google Vertex-only main-analysis route reduced photo-analysis quality and returned a video provider error, so its prepared face-data reply was not sent and Build `4` was not used for the next resubmission. The Build `4` response remains in `guideline-face-data-response-build-4.md` as history only.

Build `1.0 (5)` is the current candidate. It retains the explicit iOS consent experience and uses a fixed, disclosed, quality-preserving route: Render and OpenRouter; Google Gemma 4 through NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16 for the main assistant and text-only Image Studio prompt preparation; and Google Gemini 2.5 Pro through Google Cloud Vertex AI only after all four Gemma processors fail for a main assistant request. Google-powered Image Studio generation also uses Google Cloud Vertex AI and receives the prepared text prompt. All iOS AI requests enforce Zero Data Retention, `data_collection: "deny"`, fixed allowlists, and no undisclosed provider fallback. Android and web continue to use the legacy OpenRouter ZDR route and existing Image Studio helper behavior and are not part of the iOS App Store submission.

The hosted Build `5` route and privacy policy were deployed from commit `14ec049` and passed production smoke tests for legacy chat plus iOS text, photo, cohesive eight-frame video, and Image Studio prompt preparation. The distribution-signed Build `5` IPA was accepted by App Store Connect at 2026-09-11 14:44 MST, completed processing, and is available in the `Internal QA` TestFlight group as `Ready to Submit`.

Do not reply or resubmit until Build `5` is uploaded, processed, selected for version `1.0`, its live privacy policy matches the app, and the physical TestFlight smoke test and updated review recording pass. Then use `guideline-face-data-response-build-5.md`.

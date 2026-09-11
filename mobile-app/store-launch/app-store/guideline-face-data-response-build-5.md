# App Review Response — AI Data And Face Data — Version 1.0 (Build 5)

Use this reply only after all of the following are true:

- Version `1.0 (5)` is uploaded, processed, and selected for the App Store version.
- The updated privacy policy is live at `https://offgridtoolkit.ai/privacy` and matches Build `5`.
- A fresh TestFlight installation of Build `5` passes the consent, text, Voice Input, photo, video, and Image Studio smoke test on the physical iPhone.
- The Build `5` physical-device review video is publicly accessible without a sign-in.

Replace `[BUILD 5 REVIEW VIDEO URL]` before sending. Do not reuse the Build `4` draft or the Build `3` video as evidence for this build.

## Reply To App Review

Hello App Review,

Thank you for the additional guidance. We revised OffGrid AI FieldGuide in version 1.0, build 5 to provide complete, iOS-specific disclosures and affirmative permission before any user-selected data is shared for online AI processing. Build 5 also presents a contextual confirmation before the first selected photo or extracted video-frame transfer, provides in-app consent withdrawal, updates the Apple permission purpose strings, and restricts every iOS AI request to the named processors under Zero Data Retention and denied provider data collection. We also updated the privacy policy at https://offgridtoolkit.ai/privacy.

Physical-device review video for the exact submitted TestFlight Build 5: [BUILD 5 REVIEW VIDEO URL]

### Face data

**1. What face data does the app collect?**

The app does not intentionally collect biometric face data and does not perform face detection, facial recognition, identification, authentication, face comparison, or face tracking. It does not generate face geometry, faceprints, templates, embeddings, biometric identifiers, face profiles, or a face database.

If a user deliberately selects or captures a photo, or selects or records a video, the user-selected photo or an extracted video frame may incidentally contain a visible image of a person's face. That visible facial imagery is the only face-related data the app may process. We treat this incidental visible facial imagery as face data for purposes of this response.

Photos are resized on the device to a maximum of 1024 by 1024 pixels. Raw video is not uploaded. The app extracts up to eight JPEG frames on the device, each no larger than 512 by 384 pixels, and only those frames may be sent after the user consents.

**2. Complete use, sharing, retention, deletion, and storage practices**

- **Collection method:** Face-related imagery can enter the request only when the user deliberately takes or selects a photo, or records or selects a video, and then submits the attachment. The app does not scan the photo library or camera feed for faces.
- **Use:** A visible face is processed only as part of the user's requested general photo or video analysis. It is not used for identity verification, authentication, advertising, marketing, profiling, surveillance, eligibility decisions, sale, sharing with other users, or AI-model training.
- **Sharing and processing:** The selected photo or extracted frames travel through the OffGrid AI application service hosted by Render and OpenRouter. The request uses Google Gemma 4 through only one of four fixed BF16 processor endpoints in this order: NextBit, Venice, Parasail, or Novita. OpenRouter may fail over among only those four named processors. Only if all four Gemma 4 processors fail may the application separately retry with Google Gemini 2.5 Pro through Google Cloud Vertex AI. Fixed allowlists prevent any unlisted AI processor from receiving the media.
- **Image Studio separation:** Photos and extracted video frames are never sent to Image Studio. Text-only Image Studio prompt preparation uses the same fixed Gemma 4 processor allowlist. Google Cloud Vertex AI is used for Google-powered Image Studio generation and receives only the prepared Image Studio text prompt, not a photo or video frame from the analysis feature.
- **Storage:** Face-containing photos and frames are processed transiently for the current request. They are not written to the OffGrid AI application database or application content logs and are not stored as a face, conversation, or media history.
- **Retention:** Every iOS AI request requires OpenRouter Zero Data Retention, `data_collection: "deny"`, and a fixed processor allowlist. Prompt, response, photo, and video-frame content is retained only in transient processing for the duration of the request and is not persistently retained by OffGrid AI, OpenRouter, or the selected AI processor under this configuration.
- **Non-content operational data:** Render retains limited service-request metadata—request path, network address, request ID, response timing and size, and user-agent—for up to 7 days. The application intentionally does not place prompts, responses, photos, video frames, or face data in these logs. Anonymous abuse controls retain a one-way HMAC of the request network address, usage type/date/count, and timestamps for up to 31 days; this record cannot reproduce the address and contains no photo, video frame, face data, prompt, or response.
- **Raw video and on-device data:** The raw video remains on the user's device. A native temporary video copy used for frame extraction is deleted immediately after extraction. An attachment preview remains only in the active local session until the user removes it, starts a new chat, closes or reloads the app, or uninstalls it. Photos, generated images, and PDFs that the user separately saves remain in Photos or Files until the user deletes them.
- **Deletion:** Because face-containing photo and video-frame content is not persistently stored under this configuration, there is no server-side face record to delete after processing. Before submitting, the user can cancel or remove the attachment. The user can withdraw permission for all future AI and media transfers from `+ menu > Privacy & AI Data > Withdraw AI Data Consent`; this immediately blocks future AI transfers and clears selected media. The user may also request deletion of separately submitted feedback through https://offgridtoolkit.ai/data-deletion.

**3. Will face data be shared with third parties, and where is it stored?**

Yes. When a user affirmatively consents and submits selected media that happens to contain a visible face, the media is transiently processed through this disclosed iOS service chain only:

1. Render hosts the OffGrid AI application service.
2. OpenRouter routes each request under enforced Zero Data Retention, `data_collection: "deny"`, and a fixed processor allowlist. Any Gemma 4 failover is restricted to the four named processors; unlisted provider fallback is disabled.
3. Google Gemma 4 runs only through NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16, in that order.
4. Only after all four named Gemma 4 processors fail may Google Gemini 2.5 Pro run through Google Cloud Vertex AI.

The media is not shared with advertisers, data brokers, other users, Image Studio, or any unlisted AI-model processor. It is not persistently stored as a face or media record in any location; it is present only transiently on the named providers' processing infrastructure while the current request is completed. Limited non-content metadata is handled as described above.

Apple Speech Recognition may process microphone audio only when the user activates Voice Input. The resulting transcription text is sent to the disclosed online AI route only when the user submits it. Apple Speech Recognition does not receive selected photos or extracted video frames.

**4. How long is face data retained?**

Face-containing photo and video-frame content is not persistently retained. It exists only transiently while the current request is transferred and processed under the Zero Data Retention configuration. No OffGrid AI face or media history is created. The raw video stays on the device, and the native temporary video copy is deleted immediately after frame extraction. The 7-day Render logs and 31-day anonymous abuse counters described above contain no face data or request content.

### Privacy policy locations and exact text

The face-data and AI-sharing disclosures are in the sections **“Photos, Video Frames, And Face Data,” “Named Service Providers And Data Route,” “AI Data Consent And Withdrawal,” “Data Retention,”** and **“Data Deletion”** at https://offgridtoolkit.ai/privacy.

The specific text in **“Photos, Video Frames, And Face Data”** states:

> **Face data the app may collect:** OffGrid AI FieldGuide does not intentionally collect biometric face data. If a photo or extracted video frame that you choose to send contains a person, the submitted image may incidentally contain a visible image of that person's face. That visible facial imagery is the only face-related data the app may process.

> **No face recognition or biometric processing:** The app does not detect, recognize, identify, authenticate, map, measure, track, or compare faces. It does not create face geometry, faceprints, templates, embeddings, biometric identifiers, face profiles, or a face database. It does not use facial imagery for advertising, marketing, profiling, surveillance, eligibility decisions, or AI-model training.

> **Use and sharing:** A face that happens to be visible in user-selected media is processed only as part of the user's requested general image or video analysis. In the iOS app, the selected photo or extracted video frames are transmitted through the OffGrid AI service hosted by Render and OpenRouter to one of four fixed processors running Gemma 4: NextBit BF16, Venice BF16, Parasail BF16, or Novita BF16. Only if all four Gemma 4 processors fail may that same request be sent to Gemini 2.5 Pro through Google Cloud Vertex AI. Photos and video frames are not sent to Image Studio, advertisers, data brokers, other users, or any unlisted AI processor. Android and web use the separate legacy route described under “Named Service Providers And Data Route.”

> **Storage and retention:** Face-containing photos and video frames are handled transiently only for the time needed to complete the current request. They are not persisted in the OffGrid AI application database or application logs and are not retained as a face or media history after processing. The raw video remains on the device; a native temporary copy used for frame extraction is deleted after extraction. Every iOS AI request uses a fixed provider allowlist, OpenRouter Zero Data Retention routing, and denied provider data collection. The permitted iOS AI processors do not persist prompt, response, photo, or video-frame content under this routing. Android and web request OpenRouter Zero Data Retention routing but do not use the fixed iOS processor list. Limited non-content request metadata may be processed for billing, security, abuse prevention, and reliability.

> **Deletion:** Because OffGrid AI, OpenRouter, and the selected AI endpoint do not persist the submitted face-containing content under this configuration, there is no server-side face record to delete after processing. Before sending, a user can cancel the transfer or remove the attachment. After sending, local previews and session content can be cleared by starting a new chat, closing or reloading the app, or uninstalling it. Separately saved photos, generated images, or PDFs remain on the device until the user deletes them in Photos or Files.

### Personal data sharing and permission changes in Build 5

Build 5 meets the requirements in Guidelines 5.1.1(i) and 5.1.2(i) as follows:

1. On first launch after this update, the iOS app explains the exact categories of data that may be processed: text prompts, Apple Speech transcription text, selected photos, up to eight extracted video frames, and Image Studio text prompts.
2. It identifies the recipients and their roles: Apple Speech Recognition for activated Voice Input; the OffGrid AI service hosted on Render; OpenRouter; NextBit, Venice, Parasail, and Novita for Gemma 4 analysis and text-only Image Studio prompt preparation; and Google Cloud Vertex AI only for the emergency Gemini 2.5 Pro fallback and Google-powered Image Studio generation.
3. It requires the user to affirmatively check the consent box and tap `Consent & Continue` before online AI features are enabled. Choosing `Not Now` sends no AI data and keeps online AI features blocked.
4. Build 5 increments the stored consent version, so consent to the earlier Build 4 provider description does not carry over. Every iOS user must review and accept the new Build 5 disclosure before online AI features can send data.
5. Before the first selected photo or extracted video-frame transfer, the app presents a contextual confirmation explaining that the media may contain a visible face, naming the applicable processors, and describing the purpose and retention restrictions. This confirmation is recorded locally and remains active until the user withdraws consent; it is not repeated before every media request.
6. The user can withdraw consent from `+ menu > Privacy & AI Data > Withdraw AI Data Consent`. Withdrawal immediately blocks future online AI transfers and clears selected media. The user can review the current disclosure and consent again later.
7. Apple camera, photo-library, microphone, and Speech Recognition purpose strings explain the related data processing at the point Apple requests system permission.
8. Every iOS AI request enforces Zero Data Retention, `data_collection: "deny"`, a fixed processor allowlist, and no unlisted provider fallback. These technical controls require the disclosed processors to provide the same or equivalent protection described in our policy.

The consent sequence remains a smooth one-time first-use flow: one disclosure on first launch, followed by one contextual confirmation only when the user first chooses to send a photo or video frame. There is no recurring consent screen before each question.

This response and the processor chain above describe the submitted iOS Build 5. Android and web use a separate legacy OpenRouter Zero Data Retention route and do not use the iOS fixed processor order or iOS-specific consent state.

There are no accounts, ads, in-app purchases, external checkout links, or user-generated-content publishing features.

Thank you.

# App Review Response — AI Data And Face Data — Version 1.0 (Build 4)

Use this reply only after version `1.0 (4)` is uploaded, processed, selected for the App Store version, and the updated privacy policy is live at `https://offgridtoolkit.ai/privacy`.

## Reply To App Review

Hello App Review,

Thank you for the additional guidance. We revised OffGrid AI FieldGuide in version 1.0, build 4 to add explicit, named AI-data disclosures and consent before data is sent, plus contextual consent before the first photo or video-frame transfer. We also updated the privacy policy at https://offgridtoolkit.ai/privacy.

### Face data

**1. What face data does the app collect?**

The app does not intentionally collect biometric face data and does not perform face detection, facial recognition, identification, authentication, face comparison, or face tracking. It does not generate face geometry, faceprints, templates, embeddings, biometric identifiers, or face profiles.

If a user deliberately selects or captures a photo, or selects or records a video, the photo or one of the extracted video frames may incidentally contain a visible image of a person's face. That user-selected visible facial imagery is the only face-related data the app may process.

Photos are resized on the device to a maximum of 1024 by 1024 pixels. Raw video is not uploaded. The app extracts up to eight JPEG frames on the device, each no larger than 512 by 384 pixels, and only those frames may be sent after consent.

**2. Use, sharing, storage, retention, and deletion**

- **Use:** Any visible face is processed only as part of the user's requested general photo or video analysis. It is not used for identity verification, authentication, advertising, marketing, profiling, surveillance, eligibility decisions, sale, or AI-model training.
- **Sharing:** The selected photo or extracted frames travel through the OffGrid AI application service hosted by Render, then OpenRouter, and then Google Vertex AI. Photos and video frames are not sent to OpenAI, advertisers, data brokers, other users, or any other AI-model provider.
- **Storage:** Face-containing photos and frames are processed transiently for the current request. They are not written to the OffGrid AI application database or content logs and are not stored as a face, conversation, or media history.
- **Retention:** Content is retained only in transient processing for the duration of the request. OpenRouter routing requires Zero Data Retention, denies provider data collection, pins the AI processor to Google Vertex AI, and disables fallback providers. Limited non-content request metadata may be processed for billing, security, abuse prevention, and reliability.
- **Raw video:** The raw video remains on the user's device. A native temporary copy used for frame extraction is deleted immediately after extraction.
- **Deletion:** Because the submitted face-containing content is not persisted under this configuration, there is no server-side face record to delete after processing. Before sending, the user can cancel or remove the attachment. The user can withdraw future AI and media consent in `+ menu > Privacy & AI Data > Withdraw AI Data Consent`. Separately saved files remain on the device until the user deletes them in Photos or Files.

**3. Third parties and storage location**

Face-containing selected media is processed by the following service chain only:

1. Render hosts the OffGrid AI application service.
2. OpenRouter routes the request under enforced Zero Data Retention and data-collection restrictions.
3. Google Vertex AI performs the user-requested photo or video-frame analysis.

No face-containing photo or video frame is sent to OpenAI. OpenAI is used only for text-only visual-prompt preparation in Image Studio. Apple Speech Recognition may process microphone audio only when a user activates Voice Input; that feature does not receive photos or video frames.

**4. How long is face data retained?**

Face-containing photo and video-frame content is not persistently retained. It exists only transiently while the current request is transferred and processed. No OffGrid AI face or media history is created. The raw video stays on the device, and the native temporary video copy is deleted after frame extraction.

### Privacy policy locations and exact text

The face-data disclosures are in the sections **“Photos, Video Frames, And Face Data,” “Named Service Providers And Data Route,” “AI Data Consent And Withdrawal,” “Data Retention,”** and **“Data Deletion”** at https://offgridtoolkit.ai/privacy.

The specific text in **“Photos, Video Frames, And Face Data”** states:

> Face data the app may collect: OffGrid AI FieldGuide does not intentionally collect biometric face data. If a photo or extracted video frame that you choose to send contains a person, the submitted image may incidentally contain a visible image of that person's face. That visible facial imagery is the only face-related data the app may process.

> No face recognition or biometric processing: The app does not detect, recognize, identify, authenticate, map, measure, track, or compare faces. It does not create face geometry, faceprints, templates, embeddings, biometric identifiers, face profiles, or a face database. It does not use facial imagery for advertising, marketing, profiling, surveillance, eligibility decisions, or AI-model training.

> Use and sharing: A face that happens to be visible in user-selected media is processed only as part of the user's requested general image or video analysis. The selected photo or extracted video frames are transmitted through the OffGrid AI service hosted by Render and OpenRouter to Google Vertex AI. They are not shared with advertisers, data brokers, other users, or any other AI model provider.

> Storage and retention: Face-containing photos and video frames are handled transiently to complete the current request. They are not persisted in the OffGrid AI application database or logs and are not retained as a face or media history. The raw video remains on the device; a native temporary copy used for frame extraction is deleted after extraction. AI processing is restricted to OpenRouter Zero Data Retention endpoints with provider data collection denied and fallback providers disabled. OpenRouter and the selected Google Vertex AI endpoint do not persist prompt, response, photo, or video-frame content under this routing. Limited non-content request metadata may be processed for billing, security, abuse prevention, and reliability.

> Deletion: Because OffGrid AI, OpenRouter, and the selected AI endpoint do not persist the submitted face-containing content under this configuration, there is no server-side face record to delete after processing. Before sending, a user can cancel the transfer or remove the attachment. After sending, local previews and session content can be cleared by starting a new chat, closing or reloading the app, or uninstalling it. Separately saved photos, generated images, or PDFs remain on the device until the user deletes them in Photos or Files.

### AI data disclosure and permission changes in build 4

Build 4 now does all of the following before personal data can be shared with an AI service:

1. On first launch after this update, it displays the exact categories of data that may be processed: text prompts, voice transcription text, selected photos, up to eight extracted video frames, and image-generation prompts.
2. On iOS it identifies the recipients by name: Apple Speech Recognition for optional voice transcription; the OffGrid AI service hosted on Render; OpenRouter; Google Vertex AI; and OpenAI for text-only Image Studio prompt preparation.
3. It requires the user to affirmatively check the consent box before online AI features are enabled. Choosing `Not Now` sends no AI data and keeps online AI features blocked.
4. Before the first photo or video-frame transfer, it presents a separate contextual confirmation explaining that the media may contain a visible face, naming Render, OpenRouter, and Google Vertex AI, and stating the purpose and retention restrictions. This media consent remains active until withdrawn.
5. It provides `+ menu > Privacy & AI Data > Withdraw AI Data Consent`, which blocks future transfers and clears selected media. The user may review and consent again later.
6. Apple camera, photo-library, microphone, and Speech Recognition purpose strings were updated to explain the related data processing.

The privacy policy also identifies how each category is collected and used, each named processor, retention and deletion practices, and the technical restrictions requiring Zero Data Retention, denying provider data collection, and disabling fallback providers. These restrictions are used so the processors provide the same or equivalent protection described in our policy.

There are no accounts, ads, in-app purchases, external checkout links, or user-generated-content publishing features.

Thank you.

# Guideline 2.1 Response — Version 1.0 (Build 2)

Use this draft only after the exact TestFlight build `1.0 (2)` has passed the final physical-device smoke test and the video URL has been added. Put the same material in the App Review Information Notes field for this submission and future submissions.

## Video Recording Checklist

Record the exact TestFlight build on the physical iPhone 14 Plus running iOS 26.5.2. Start from a fresh installation so the real Apple permission prompts appear. Begin with the Home Screen, launch OffGrid AI FieldGuide, and show:

1. The app launching to the main screen without a login.
2. A normal text question and the streamed AI response.
3. Voice Input, including the real Speech Recognition and microphone permission prompts, successful transcription, and submission.
4. Take Photo, including the camera prompt, capture, analysis, and response.
5. Upload Images and Upload Video, including the Photos prompt and a successful analysis.
6. Tap-to-enable Compass, including the motion prompt and a live heading.
7. Ready-Made Prompts returning a selected prompt to the app.
8. Image Studio generating a visual and opening the save/share controls.
9. Make Field Guide, Save Field Guide, the native PDF preview/share flow, and Saved Guides opening the app folder in Files.

There are no registration, login, account-deletion, paid-content, purchase, subscription, or user-generated-content moderation flows to demonstrate.

## Reviewer Reply and Notes Draft

Hello App Review,

Thank you for the guidance. We have uploaded version 1.0, build 2 and provided the requested information below.

1. **Physical-device screen recording**

Video URL: `[ADD PUBLICLY ACCESSIBLE VIDEO URL]`

The recording was captured on the physical device and operating system listed below using the exact TestFlight build submitted for review. It begins with launching the app and demonstrates the typical flow through the core features and the applicable Apple permission prompts.

2. **Test devices and operating systems**

- iPhone 14 Plus — iOS 26.5.2

3. **Functions, target audience, problem, and value**

OffGrid AI FieldGuide is a free online AI companion for people who want practical field guidance, including campers, hikers, travelers, homeowners, emergency-preparedness users, and people working in remote or resource-limited settings. Users can ask questions by typing or voice, analyze selected photos or short videos, use a compass heading, create survival-oriented reference visuals, and turn useful responses into PDFs saved on their phone. It makes practical instructions and reference material easier to obtain and preserve in a field-friendly format. Health, first-aid, survival, and safety responses are general educational information only; the app is not a medical device and does not provide professional diagnosis or treatment.

4. **Setup and access instructions**

No account, login credentials, subscription, purchase, or special configuration is required. An internet connection is required for AI responses and image generation.

- Launch the app and enter a question in the main field, or tap Voice Input to dictate it.
- Use Take Photo, Upload Images, Record Video, or Upload Video to include media in a question.
- Tap the compass control to enable a live heading.
- Open Ready-Made Prompts and choose a prompt to return it to the main question field.
- After an answer, use Create Visual or Make Field Guide. Save Field Guide creates a native PDF and opens the saved guide. Saved Guides opens the app's folder in Files.
- Open Image Studio to generate a visual, then save it to Photos or use the native share sheet.

Any camera, photo-library, microphone, Speech Recognition, or motion permission is requested only after the reviewer taps the feature that needs it. No sample file is required; the reviewer may use any ordinary photo or short video available on the device.

5. **External services, tools, and platforms**

- `offgridtoolkit.ai`: the app's HTTPS web service and interface.
- Render: hosts the Node.js application service.
- OpenRouter: routes user-requested AI operations to the configured models with Zero Data Retention routing enforced for FieldGuide requests.
- Google Gemma 4 26B: text, photo, and video analysis for the main assistant.
- Google Gemini 3 Pro Image: Image Studio generation.
- Apple iOS frameworks and Capacitor: camera/photo selection, native Speech Recognition and microphone input, motion/compass access, PDF/file handling, Photos saving, and native sharing.

The app does not use external authentication, advertising, payment, subscription, or analytics services.

6. **Regional differences**

The app's features and content function consistently across all regions where the app is offered. There are no region-specific feature sets, accounts, prices, or content variants. As an online AI app, core AI functions require that the device can reach the external services listed above.

7. **Regulated industry or protected third-party material**

The app is not offered as a regulated professional service or medical device and does not provide professional diagnosis or treatment. It does not include protected third-party material that requires separate authorization. No additional credentials or authorization documents are applicable.

There are no ads, in-app purchases, external checkout links, user accounts, or user-generated-content publishing features.

Thank you.

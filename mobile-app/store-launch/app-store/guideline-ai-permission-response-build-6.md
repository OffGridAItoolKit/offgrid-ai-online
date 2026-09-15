# App Review Response — Third-Party AI Permission — Version 1.0 (Build 6)

Use this reply only after all of the following are true:

- Version `1.0 (6)` is uploaded, processed, physically tested through TestFlight, and selected for App Store version `1.0`.
- The September 15 privacy policy is live at `https://offgridtoolkit.ai/privacy`.
- A new physical-device recording shows the Build 6 permission screen and is public without a sign-in.
- The App Review Information notes describe Build 6, not Build 5.

Replace `[BUILD 6 REVIEW VIDEO URL]` and `[PHYSICAL TEST DEVICE / IOS VERSION]` before sending.

## Final Copy/Paste Reply

```text
Hello App Review,

Thank you for the clarification. We revised OffGrid AI FieldGuide in version 1.0, build 6 to make third-party AI data sharing and the user's permission unmistakable inside the app before any personal data can be transmitted.

Physical-device Build 6 video (public; no sign-in):
[BUILD 6 REVIEW VIDEO URL]

Tested on: [PHYSICAL TEST DEVICE / IOS VERSION]

WHAT CHANGED IN BUILD 6

1. A fresh launch now opens a separate screen titled “AI DATA SHARING PERMISSION” with the direct question “Allow third-party AI processing?” This permission is not combined with acceptance of terms or safety notes.

2. Before permission, the screen identifies what may be sent: typed prompts, Apple Speech transcription text, selected photos, up to eight frames extracted on-device from a selected/recorded video, and Image Studio text prompts. It states that these items are personal data when they identify the user or another person.

3. Before permission, the screen identifies every recipient and its role: Render hosts the OffGrid AI service; OpenRouter routes FieldGuide requests only to NextBit, Venice, Parasail, or Novita for Google Gemma 4 processing; Google Cloud Vertex AI may process a FieldGuide request with Gemini 2.5 Pro only if all four are unavailable and also processes Image Studio text prompts; Apple Speech Recognition receives microphone audio only after Voice Input is activated.

4. The screen has two separate, always-visible choices: “Don’t Allow” and “Allow Third-Party AI.” Choosing Don’t Allow dismisses the screen, sends no AI data, and leaves every AI feature blocked. If the user later taps an AI feature, the permission screen is shown again. Only Allow Third-Party AI records permission locally and enables AI requests.

5. Before the first photo or extracted-video-frame transfer, the app also presents a contextual confirmation that names the applicable recipients, explains that media may contain a visible face or other personal information, and offers Cancel or OK before sending.

6. Permission can be reviewed or withdrawn at + menu > Privacy & AI Data. Withdrawal immediately blocks future AI transfers and clears the active local conversation, selected media, and pending Image Studio context.

7. Build 6 uses a new consent version, so permission from Build 5 does not carry forward. The native iOS package also explicitly opens the iOS experience, preventing the web/Android disclosure from appearing on an iPad review device.

PRIVACY POLICY

The updated policy is at https://offgridtoolkit.ai/privacy, last updated September 15, 2026. Relevant sections are “AI Data Consent And Withdrawal,” “Information You Choose To Send,” “Photos, Video Frames, And Face Data,” “Named Service Providers And Data Route,” “Data Retention,” “Data Deletion,” and “Third-Party Processing.”

The policy states: “The screen provides distinct Don’t Allow and Allow Third-Party AI choices; this permission is not bundled with acceptance of terms or safety notes. If you do not allow this processing, no prompt, voice transcription text, photo, video frame, or image-generation request is sent.”

Every iOS AI request enforces Zero Data Retention, denied provider data collection, fixed processor allowlists, and no undisclosed provider fallback. Each provider receives only the content needed for the requested function and is required to provide the same or equivalent protections described in the policy. Submitted content is not used for advertising, profiling, sale, or AI training and is not stored as an OffGrid AI account, chat, face, or media history.

REVIEW STEPS

1. Install Build 6 fresh and launch the app.
2. Review the AI Data Sharing Permission screen; the action buttons remain visible while the disclosure text scrolls.
3. Tap Don’t Allow and then try an AI feature to verify no data is sent and the permission screen returns.
4. Tap Allow Third-Party AI, then submit a typed question.
5. Select a photo or video to see the additional contextual media confirmation before the first transfer.
6. Open + menu > Privacy & AI Data to review the disclosure or withdraw permission.

There are no accounts, ads, in-app purchases, external checkout links, or user-generated-content publishing features.

Thank you.
```

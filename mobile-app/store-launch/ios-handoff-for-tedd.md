# iOS Release Record

## Goal

Archive and upload the Capacitor iOS app for TestFlight and App Store review from the Mac mini.

## Project

```text
/Users/davidprian/Developer/OffGridAI/offgrid-ai-online/mobile-app/ios/App/App.xcodeproj
```

## App Identity

- App name: OffGrid AI FieldGuide
- Bundle ID: `com.offgridaitoolkit.app`
- Version: `1.0`
- Working build: `3`
- First submitted build: `1`
- Device family: iPhone
- Orientation: portrait
- Price: free
- Accounts: none
- In-app purchases: none
- Ads: none
- Production URL: `https://offgridtoolkit.ai/online?surface=app`
- Xcode: 26.6
- Signing team and App Store public seller: `INSPIRED MARKETING & DESIGN, LLC` (`3X9J4MHTK3`)

## Completed Physical iPhone Proof

Testing on an iPhone 14 Plus running iOS 26.5.2 passed:

- Fresh launch, day/night mode, and safe areas.
- Chat streaming and post-answer actions.
- Camera, multi-photo upload, and short-video analysis.
- Tap-to-enable compass.
- Image Studio generation and image save/share.
- Field Guide PDF preview, native PDF generation, unique filenames, single-file save, and native sharing.
- `OffGrid AI Field Guides` folder creation and Saved Guides browsing.
- Ready-Made Prompts returns the selected prompt to the installed app.
- Native Voice Input requests microphone and Speech Recognition access on first use, transcribes speech, and returns the text to the question field.
- Native video selection extracts eight compressed frames with AVFoundation and successfully handles a 4K/60-fps iPhone clip without reloading the app.
- In-app feedback returns a production `201 Created` response and stores the report in the protected support database; it does not send an email notification.
- No account, advertising, in-app purchase, or external checkout flow.

## Remaining Release Steps

- [x] Public seller confirmed as the current Apple team, `INSPIRED MARKETING & DESIGN, LLC`.
- [x] Create and validate the App Store archive.
- [x] Export a distribution-signed App Store IPA.
- [x] Create the App Store Connect record (`6806680581`).
- [x] Upload and attach build `1.0 (1)`.
- [x] Complete the age rating (13+), worldwide availability, and free pricing forms.
- [x] Configure and publish the App Privacy label and URLs after owner approval.
- [x] Upload the final screenshots in the intended storefront order.
- [x] Add the review notes.
- [x] Add the review contact information.
- [x] Confirm and save the Content Rights answer.
- [x] Complete EU Digital Services Act trader contact verification; Apple reports the compliance record as Active.
- [x] First submission `1.0 (1)` returned under Guideline 2.1 for additional review information and physical-device video evidence.
- [x] Replace unsupported Web Speech usage in the iOS shell with native Apple Speech recognition and add the Speech Recognition permission description.
- [x] Build, sign with David Prian's Apple Development certificate, and install development build `1.0 (2)` on the physical iPhone 14 Plus.
- [x] Complete the physical Voice Input and permission-flow retest on build `1.0 (2)`.
- [x] Archive build `1.0 (2)`, export a company-signed App Store IPA, validate its signature and entitlements, and upload it to App Store Connect on 2026-09-03.
- [x] Create the `Internal QA` TestFlight group with automatic distribution and add David Prian's App Store Connect account as an internal tester.
- [x] Reproduce the build `2` 4K video-selection failure and replace WKWebView video decoding with native PhotosUI and AVFoundation extraction in build `3`.
- [x] Complete the physical 4K video selection and attachment retest on development build `1.0 (3)`.
- [x] Archive build `1.0 (3)`, export and validate the distribution-signed IPA, and upload it to App Store Connect on 2026-09-04.
- [ ] Run a short internal TestFlight smoke test using build `1.0 (3)`.
- [ ] Record the requested physical-device review video using the exact TestFlight build selected for review.
- [ ] Attach the video and complete reviewer answers in App Store Connect, then resubmit version `1.0` using build `3`.

The App Store IPA for build `2` is signed by `Apple Distribution: INSPIRED MARKETING & DESIGN, LLC (3X9J4MHTK3)`. The upload completed successfully on 2026-09-03, passed App Store Connect processing, and is listed in TestFlight as `Ready to Submit`. The distributable and export records are stored outside the repository at `/Users/davidprian/Developer/OffGridAI/Releases/OffGrid-AI-FieldGuide-1.0-2/`.

Build `3` moves iPhone video selection and frame extraction to PhotosUI and AVFoundation. It was physically verified on 2026-09-04 with the same 4K/60-fps clip that failed in build `2`. The browser/Android fallback remains unchanged except that it now permits reselecting the same clip after a cancelled or failed attempt.

The build `3` archive is stored at `/Users/davidprian/Developer/OffGridAI/Releases/OffGrid-AI-FieldGuide-1.0-3/OffGrid-AI-FieldGuide-1.0-3.xcarchive`. The exported IPA is stored at `/Users/davidprian/Developer/OffGridAI/Releases/OffGrid-AI-FieldGuide-1.0-3/export/App.ipa` and has SHA-256 `c9dfeb73a3714a0cbb09ab982b25534e92101c32c8bfc7fdfbd3a9ff7bad22c4`. The exported app is signed by `Apple Distribution: INSPIRED MARKETING & DESIGN, LLC (3X9J4MHTK3)`, has `get-task-allow = false` and `beta-reports-active = true`, and the App Store Connect upload completed successfully at 2026-09-04 07:14 MST. Apple then began normal package processing.

## App Review Note

```text
OffGrid AI FieldGuide is a free online AI companion for practical field guidance. No account or review credentials are required. The app has no ads and no in-app purchases.

The reviewer can start on the main screen and submit a question, tap Take Photo / Upload Images, tap Record Video / Upload Video, or open Ready-Made Prompts. Camera, photo library, microphone, and motion permissions are requested only after the reviewer taps the related feature.

After an AI response, the reviewer can create a visual or make a Field Guide. Save Field Guide generates a native PDF, creates the app's OffGrid AI Field Guides folder in Files, and opens the saved guide. Saved Guides opens that same folder. Image Studio visuals can be saved to Photos or shared with the native share sheet.

An internet connection is required for AI responses. Health, first-aid, survival, and safety responses are general educational information only; the app is not a medical device and does not provide professional diagnosis or treatment.
```

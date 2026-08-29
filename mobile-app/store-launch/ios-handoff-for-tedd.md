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
- Build: `1`
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
- Voice input and microphone permission flow.
- Tap-to-enable compass.
- Image Studio generation and image save/share.
- Field Guide PDF preview, native PDF generation, unique filenames, single-file save, and native sharing.
- `OffGrid AI Field Guides` folder creation and Saved Guides browsing.
- Ready-Made Prompts returns the selected prompt to the installed app.
- No account, advertising, in-app purchase, or external checkout flow.

## Remaining Release Steps

- [x] Public seller confirmed as the current Apple team, `INSPIRED MARKETING & DESIGN, LLC`.
- [x] Create and validate the App Store archive.
- [x] Export a distribution-signed App Store IPA.
- [x] Create the App Store Connect record (`6806680581`).
- [x] Upload and attach build `1.0 (1)`.
- [x] Complete the age rating (13+), worldwide availability, and free pricing forms.
- [x] Configure the App Privacy label and URLs; owner publish attestation remains.
- [ ] Upload the final screenshots; Chrome file-upload permission is required.
- [x] Add the review notes.
- [ ] Add the review contact information.
- [ ] Confirm the Content Rights answer and EU Digital Services Act trader information.
- [ ] Optionally run a short internal TestFlight smoke test.
- [ ] Submit for App Review using manual release.

## App Review Note

```text
OffGrid AI FieldGuide is a free online AI companion for practical field guidance. No account or review credentials are required. The app has no ads and no in-app purchases.

The reviewer can start on the main screen and submit a question, tap Take Photo / Upload Images, tap Record Video / Upload Video, or open Ready-Made Prompts. Camera, photo library, microphone, and motion permissions are requested only after the reviewer taps the related feature.

After an AI response, the reviewer can create a visual or make a Field Guide. Save Field Guide generates a native PDF, creates the app's OffGrid AI Field Guides folder in Files, and opens the saved guide. Saved Guides opens that same folder. Image Studio visuals can be saved to Photos or shared with the native share sheet.

An internet connection is required for AI responses. Health, first-aid, survival, and safety responses are general educational information only; the app is not a medical device and does not provide professional diagnosis or treatment.
```

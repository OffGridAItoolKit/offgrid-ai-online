# OffGrid AI FieldGuide App Store Launch Packet

Status: in progress
Launch target: free online v1 for Google Play and Apple App Store
Production URL: https://offgridtoolkit.ai/online?surface=app

Native changes awaiting a future Play binary are tracked in [android-native-update-queue.md](android-native-update-queue.md).
App id / bundle id: com.offgridaitoolkit.app

## Launch Defaults

- Store identity: organization account.
- Price: free.
- Monetization: none in v1.
- Accounts/license keys: none in v1.
- Ads/analytics: none in v1.
- Core feature set: chat, image upload, camera, video upload/record, Image Studio, Saved Guides, compass, share/export, Ready-Made Prompts, day/night mode.
- App review posture: online AI companion, not an offline app claim.

## Checklist

### Accounts

- [ ] Google Play organization onboarding fully cleared. Identity is approved; website verification is requested and phone verification is waiting behind it.
- [ ] Apple Developer Program organization account verified.
- [ ] Tedd invited to App Store Connect with certificate/profile/TestFlight/upload access.
- [x] Public app name is `OffGrid AI FieldGuide`; public developer brand is `OffGrid AI ToolKit`; verified legal organization is `OFFGRID AI TOOLKIT, LLC`.
- [x] Support email confirmed as `support@offgridaitoolkit.com`.

### Product Readiness

- [x] Capacitor app id set to com.offgridaitoolkit.app.
- [x] Production app URL set to https://offgridtoolkit.ai/online?surface=app.
- [x] Android app icon uses the OffGrid AI compass.
- [x] iOS 1024x1024 icon exists in the Xcode asset catalog.
- [x] Native launcher icons and web shortcut artwork use the standalone dark-background compass; source copy is `store-launch/app-icon-source-512.png`.
- [x] Mobile app surfaces hide Command Center and Knowledge Base purchase/save flows.
- [x] Mobile app has phone-native save/share/Saved Guides behavior.
- [x] Mobile composer is limited to `Clear`, labeled `Voice Input`, and `Send`; Create Visual remains a post-answer and More Actions feature.
- [x] Privacy page route exists at /privacy.
- [x] Feedback path exists from the mobile app surface.
- [ ] Final legal/privacy review completed before submission.
- [x] Backend rate limits, daily anonymous cost ceilings, and media size limits implemented and locally verified.
- [x] OpenRouter prompt logging, observability broadcast, model-training data use, and prompt publication are disabled.
- [x] Field Guide app AI requests enforce OpenRouter Zero Data Retention routing per request.
- [x] Render technical request-log fields and 7-day Starter retention are documented for Data Safety.
- [x] Android cloud backup is disabled for the release manifest.
- [ ] Store screenshots captured from final release build.

### Android

- [x] Upload key generated and stored outside the repo at `C:\OffGridAI\ReleaseKeys`.
- [x] Release signing uses a temporary gitignored `key.properties`; plaintext is removed immediately after each build.
- [x] Signed release AAB built and verified at `C:\OffGridAI\ReleaseBuilds\Play\1.0\offgrid-ai-toolkit-1.0.aab`.
- [ ] Play App Signing enabled.
- [ ] Internal test uploaded.
- [ ] Closed test completed if Play Console requires it.
- [ ] Production release submitted with staged rollout.

### iOS

- [x] iOS permission strings added to Info.plist.
- [ ] Tedd confirms Xcode version and Apple team.
- [ ] Tedd archives and uploads the app to App Store Connect.
- [ ] TestFlight internal testing completed.
- [ ] App privacy labels completed.
- [ ] App Review submitted.

### TestFlight Ownership

- Codex owns shared code fixes, test criteria, release notes, and diagnosis.
- Tedd owns macOS/Xcode signing, archive, App Store Connect upload, and TestFlight build assignment.
- A physical iPhone tester owns final permission, file-save, share, compass, and safe-area proof.

## External Sources To Recheck Before Submission

- Google Play developer setup: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play closed testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Apple Developer enrollment: https://developer.apple.com/programs/enroll/
- Apple App Privacy: https://developer.apple.com/app-store/app-privacy-details/
- Apple Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

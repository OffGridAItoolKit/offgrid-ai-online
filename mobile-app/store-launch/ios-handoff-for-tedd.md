# iOS Handoff For Tedd

## Goal

Archive and upload the Capacitor iOS app for TestFlight and App Store review.

## Project

```text
C:\Users\prian\Documents\New project\mobile-app\ios\App
```

On Mac, open:

```text
App.xcodeproj
```

## App Identity

- App name: OffGrid AI ToolKit
- Bundle id: com.offgridaitoolkit.app
- Version: 1.0
- Build: 1
- Price: free
- Accounts: none
- In-app purchases: none
- Ads: none
- Production URL: https://offgridtoolkit.ai/online?surface=app

## Permission Strings Already Added

- Camera: take pictures or record video for online AI analysis.
- Microphone: voice input and video recording.
- Photo Library: choose media to upload.
- Photo Library Add: save generated visuals/guides.
- Motion: tap-to-enable compass heading.

## Tedd Checklist

- [ ] Confirm Apple Developer organization team.
- [ ] Confirm bundle id exists in Certificates, Identifiers & Profiles.
- [ ] Confirm signing/provisioning in Xcode.
- [ ] Build on a physical iPhone.
- [ ] Verify first-run screen, camera, photo upload, video, microphone, Image Studio, share sheet, Saved Guides, and compass fallback.
- [ ] Archive release build.
- [ ] Upload to App Store Connect.
- [ ] Add build to TestFlight internal testing.
- [ ] Send Codex/user screenshots or notes for any iOS-specific UI issues.

## Required TestFlight Parity Matrix

Codex can prepare, inspect, and fix the shared web/Capacitor code, but cannot sign or upload a TestFlight build from Windows. Tedd must perform the Xcode archive/upload and the physical-iPhone checks below. Send the build number, iPhone model, iOS version, and pass/fail notes back to Codex for any repairs.

- [ ] Fresh install opens in Night mode and the theme toggle reaches Light mode.
- [ ] First-run privacy/setup sheet fits, links work, and acceptance persists.
- [ ] Chat streams a complete answer and then shows Create Visual, Make Field Guide, and Save PDF.
- [ ] Take Photo and Upload Image request permissions only when tapped.
- [ ] Gallery picker includes screenshots and downloads where iOS exposes them.
- [ ] Record Video and Upload Video complete a short-clip analysis.
- [ ] Microphone accept, deny, and Settings recovery paths are understandable.
- [ ] Compass starts only after tap, reports a plausible heading, and degrades cleanly when unavailable.
- [ ] Generated visual can save to Photos and open the native share sheet.
- [ ] Field Guide PDF is created, can be opened, and remains discoverable in Files.
- [ ] Saved Guides opens the expected iOS location or gives accurate fallback instructions.
- [ ] Ready-Made Prompts preserves theme, sends a prompt back to chat, and has no USB purchase link.
- [ ] Long-press answer menu supports Copy, Share, Read Aloud, Search, Export, Select Text, and Report Issue.
- [ ] Report Issue submits in-app and shows confirmation without leaving for Mail.
- [ ] No Command Center, Knowledge Base save, upgrade, or external checkout control is visible.
- [ ] Airplane mode/no-network launch and request failures show a useful recovery message.
- [ ] Safe areas, keyboard, status bar, rotation lock, and small/large iPhone layouts have no clipped controls.

## Current iOS Risk To Prove

Android has a custom `OffGridNative` bridge for phone-specific file, share, PDF, Saved Guides, and compass behavior. iOS currently depends on browser/Capacitor fallbacks unless equivalent Swift handlers are added. TestFlight parity is therefore a required proof step, not an assumption. Any failed native action should be returned to Codex with a screen recording and Xcode console excerpt.

## App Review Note

```text
OffGrid AI ToolKit is a free online AI companion app for practical field guidance. It does not require an account, does not include ads, and does not include in-app purchases. Camera, photo library, microphone, and motion permissions are requested only when the user taps related features. The app requires internet access for AI responses.
```

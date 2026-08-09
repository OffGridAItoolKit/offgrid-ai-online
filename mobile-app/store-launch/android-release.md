# Android Release Checklist

## One-Time Setup

1. Create or verify the Google Play Console organization account.
2. Create or verify the app record for `OffGrid AI Field Guide`.
3. Confirm package name: `com.offgridaitoolkit.app`.
4. Generate the upload key outside the repo:

```powershell
keytool -genkeypair -v -keystore C:\OffGridAI\ReleaseKeys\offgrid-ai-toolkit-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias offgrid-ai-toolkit-upload
```

5. Keep the password protected outside the repository. On the authorized build computer, decrypt it only into process-scoped environment variables.
6. Set `OFFGRID_ANDROID_KEYSTORE_PATH`, `OFFGRID_ANDROID_KEY_ALIAS`, `OFFGRID_ANDROID_STORE_PASSWORD`, and `OFFGRID_ANDROID_KEY_PASSWORD` only for the release-build process. A gitignored `key.properties` remains supported for recovery compatibility but is not the preferred workflow.

## Current v1 Release State - 2026-07-10

- Play account identity documents are approved.
- `offgridaitoolkit.com` is already a verified Search Console domain property.
- Play website verification request has been sent; phone verification remains locked until the website check clears.
- Upload keystore: `C:\OffGridAI\ReleaseKeys\offgrid-ai-toolkit-upload.jks`
- Encrypted password file: `C:\OffGridAI\ReleaseKeys\offgrid-ai-toolkit-upload.password.dpapi`
- Public upload certificate: `C:\OffGridAI\ReleaseKeys\upload_certificate.pem`
- Signed AAB: `C:\OffGridAI\ReleaseBuilds\Play\1.0\offgrid-ai-toolkit-1.0.aab`
- AAB SHA-256: `BD6E2A82D4E609EB55FA5E17FD53A18497E5F900FC4E3FB6F2A512A5D1525549`
- Signing fingerprint: `84:E1:49:F6:2D:D9:56:9A:20:B3:A0:9B:8C:6F:A4:D2:9D:8F:A1:47:C8:F3:A0:1E:67:6A:F8:50:5E:27:AC:8A`

The original release build used a temporary `mobile-app/android/key.properties`. Current builds use process-scoped environment variables so the plaintext password is never written to the workspace.

## Build

Current candidate: version name `1.1.0`, version code `2`. Debug builds use the separate `com.offgridaitoolkit.app.dev` package so they can be installed beside the Play production app without replacing it.

```powershell
cd "C:\Users\prian\Documents\New project\mobile-app"
npm run build
npm run sync
cd android
.\gradlew.bat :app:bundleRelease
```

Expected output:

```text
mobile-app\android\app\build\outputs\bundle\release\app-release.aab
```

## Version 1.1.0 Signed Candidate - 2026-08-08

- Package: `com.offgridaitoolkit.app`
- Version name: `1.1.0`
- Version code: `2`
- Release artifact: `C:\OffGridAI\ReleaseBuilds\Play\1.1.0\offgrid-ai-field-guide-1.1.0.aab`
- AAB SHA-256: `D343F4183F862891EB51ABA32D0C770C4AAFA28955386D6D39A4399FDB88FF8D`
- Upload certificate SHA-256: `84:E1:49:F6:2D:D9:56:9A:20:B3:A0:9B:8C:6F:A4:D2:9D:8F:A1:47:C8:F3:A0:1E:67:6A:F8:50:5E:27:AC:8A`
- `jarsigner` verification: passed with no unsigned-entry or invalid-signature warnings; the expected self-signed upload-certificate warning remains.
- Signing secret handling: ASUS DPAPI-protected password decrypted only into process-scoped environment variables; no plaintext `key.properties` was created.
- Release state: active in Google Play Internal testing as `1.1.0 - Field Guide improvements`, released 2026-08-08 at 8:41 PM. The `Owners - Internal Test` list contains two authorized owner testers. Play reported no errors; the remaining advisories are the expected missing deobfuscation file while minification is disabled and missing native debug-symbol archive for bundled third-party native code.
- Internal-test opt-in URL: `https://play.google.com/apps/internaltest/4701601831150090903`
- Next gate: install the Play-delivered update over production v1.0, complete the physical-device release checklist, then promote this same AAB to Production.

## Version 1.1.0 Production Submission - 2026-08-09

- Both authorized owner testers confirmed that all internal-release tests passed.
- The exact internally tested version code `2` AAB was added from the Play artifact library; it was not rebuilt or replaced.
- Production rollout: 100% in all currently targeted countries/regions.
- Device support change: zero phones, tablets, TVs, cars, Chromebooks, or Android XR devices removed.
- Google Play validation: no errors; only the existing deobfuscation and native debug-symbol advisories.
- Submission state: `1.1.0 - Field Guide improvements` sent to Google for Production review. Managed publishing is off, so approval should publish the rollout automatically.

## Play Console Submission

- Upload the `.aab`.
- Enroll in Play App Signing.
- Complete Data Safety, content rating, target audience, and app access forms.
- Use `/privacy` as the privacy policy URL after the page is deployed.
- Start with internal testing.
- Use closed testing if Play Console requires it.
- Production rollout should be staged: 5-10%, then 50%, then 100%.

## Review Notes

Use this in the Play Console review notes:

```text
OffGrid AI Field Guide is a free online AI companion app. It does not require an account, does not include ads, and does not include in-app purchases. Camera, microphone, media, and compass permissions are requested only when the user taps those features. The app requires internet access for AI responses.
```

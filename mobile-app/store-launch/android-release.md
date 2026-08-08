# Android Release Checklist

## One-Time Setup

1. Create or verify the Google Play Console organization account.
2. Create or verify the app record for `OffGrid AI Field Guide`.
3. Confirm package name: `com.offgridaitoolkit.app`.
4. Generate the upload key outside the repo:

```powershell
keytool -genkeypair -v -keystore C:\OffGridAI\ReleaseKeys\offgrid-ai-toolkit-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias offgrid-ai-toolkit-upload
```

5. Copy `mobile-app/android/key.properties.example` to `mobile-app/android/key.properties`.
6. Point `storeFile` to the real upload key path and fill in passwords.

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

The release build used a temporary `mobile-app/android/key.properties`. It was deleted immediately after signing so the plaintext password is not left in the workspace.

## Build

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

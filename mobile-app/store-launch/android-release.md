# Android Release Checklist

## One-Time Setup

1. Create or verify the Google Play Console organization account.
2. Create the app record for `OffGrid AI ToolKit`.
3. Confirm package name: `com.offgridaitoolkit.app`.
4. Generate the upload key outside the repo:

```powershell
keytool -genkeypair -v -keystore C:\OffGridAI\ReleaseKeys\offgrid-ai-toolkit-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias offgrid-ai-toolkit-upload
```

5. Copy `mobile-app/android/key.properties.example` to `mobile-app/android/key.properties`.
6. Point `storeFile` to the real upload key path and fill in passwords.

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
OffGrid AI ToolKit is a free online AI companion app. It does not require an account, does not include ads, and does not include in-app purchases. Camera, microphone, media, and compass permissions are requested only when the user taps those features. The app requires internet access for AI responses.
```

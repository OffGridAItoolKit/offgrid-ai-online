# Guideline 5.1.1(iv) Response — Version 1.1 (Build 8)

Use this reply only after version `1.1 (8)` is uploaded, processed, selected for App Store version `1.1`, and the denial flow has been verified on a fresh installation.

```text
Hello App Review,

Thank you for identifying the microphone-permission issue. We corrected the Voice Input permission flow in OffGrid AI FieldGuide version 1.1 (Build 8).

When a user first taps Voice Input and chooses “Don’t Allow” for Speech Recognition or microphone access, the app now respects that decision. It closes the Voice Input flow, does not show a prompt or link directing the user to Settings, and clearly explains that the user can continue by typing a question.

Only if the user later deliberately taps Voice Input again while the required permission remains denied does the app explain that Voice Input is unavailable and offer an optional, user-initiated way to open the app’s Settings. The app requests these permissions only after the user taps Voice Input.

Please review version 1.1 (Build 8).

Thank you.
```

## Verification checklist

- Reset or remove the app so Speech Recognition and microphone permissions are undetermined.
- Tap Voice Input and choose “Don’t Allow.”
- Confirm that no Settings prompt or redirect appears and that typed input remains available.
- Tap Voice Input again.
- Confirm that the optional Settings recovery prompt appears only on this later, user-initiated attempt.
- Repeat separately for Speech Recognition denial and microphone denial.

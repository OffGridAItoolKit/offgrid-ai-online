# Android Native Update Queue

This file tracks changes that cannot reach installed users through the hosted `https://offgridtoolkit.ai/online?surface=app` interface alone.

## Current Google Play baseline

- Package: `com.offgridaitoolkit.app`
- Production version: `1.0`
- Production version code: `1`
- Signed v1 AAB SHA-256: `BD6E2A82D4E609EB55FA5E17FD53A18497E5F900FC4E3FB6F2A512A5D1525549`
- Current source branch: `codex/online-responsive-layout`
- Native feature baseline commit: `78522b6`

## Candidate next release

- Proposed version name: `1.1.0`
- Required version code: `2` or higher
- Status: source prepared; Android build, device validation, signed AAB, internal test, and Play submission pending

### Native changes waiting for this release

| Change | Source status | Validation still required |
|---|---|---|
| Attach completed field-guide PDF to Android Share sheet (`shareFieldGuidePdf`) | Implemented at `78522b6` | JDK/Gradle build, physical-device share test |
| Saved Guides PDF picker initialized at `Downloads/OffGrid AI` | Implemented at `f13df58` | Confirm behavior from the new Play-signed binary across Samsung/Files providers |
| Preserve Markdown structure and styling in native saved/shared Field Guide PDFs | Implemented locally after `49d6f96`; headings, emphasis, bullets, numbered steps, quotes, code, and page splitting now render through Android styled text | Install the next signed test binary and visually inspect short, long, list-heavy, and multi-page PDFs on a physical phone |
| Installed launcher label and icon use `OffGrid AI Field Guide` branding | Present in current source after Play v1 | Confirm launcher label, adaptive icon, and upgrade preservation |

The owner reports that the current hosted Saved Guides experience already opens the useful location on the test phone. That does not prove the updated native picker is present in Play v1; retain it in this queue until version code `2` is installed and verified.

## Hosted versus native decision rule

- HTML, CSS, browser JavaScript, prompts, server routing, and server-side policy text normally deploy through GitHub `main` to Render and appear without a Play update.
- Java/Kotlin/Swift code, Android permissions, native share/file behavior, launcher label/icon, splash resources, package metadata, and bundled Capacitor configuration require a new signed store binary.
- A hosted feature that checks for a new native bridge method may deploy first. It must keep a safe fallback until the corresponding binary is broadly installed.

## Release gates

1. Install and verify JDK 17/Android Studio on the build computer.
2. Confirm `origin/main` and a clean working tree.
3. Set version name/code deliberately; never reuse version code `1`.
4. Run web tests, Capacitor sync, Android unit tests, and release bundle assembly.
5. Verify the release is signed with the existing upload key; never create a replacement key casually.
6. Install through Google Play Internal testing and test upgrade behavior on a physical phone.
7. Verify chat, image/video, automatic Make Field Guide, Save Field Guide, attached-PDF Share, Saved Guides, compass, permissions, launcher name/icon, and offline access to previously saved PDFs.
8. Upload/promote the same tested AAB to Production, add release notes, submit for review, and monitor status.
9. After approval and rollout, verify that Google Play offers `Update` to a version-code-1 installation.

## Completion record

Do not remove an item when code is committed. Move it to a dated completed-release section only after the Play-delivered update is installed and physically verified.

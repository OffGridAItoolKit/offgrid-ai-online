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
- Status: internal testing passed; the exact version `1.1.0` / code `2` AAB was submitted for a 100% Production rollout on 2026-08-09 and is in Google review

### Native changes waiting for this release

| Change | Source status | Validation still required |
|---|---|---|
| Attach completed field-guide PDF to Android Share sheet (`shareFieldGuidePdf`) | Implemented at `78522b6`; confirmed working in the side-by-side `1.1.0-dev` build on Samsung SM-S938U1 | Reconfirm from the Play-signed internal-test upgrade |
| Saved Guides PDF picker initialized at `Downloads/OffGrid AI` | Implemented at `f13df58` | Confirm behavior from the new Play-signed binary across Samsung/Files providers |
| Preserve Markdown structure and styling in native saved/shared Field Guide PDFs | Implemented after `49d6f96`; physical test confirmed formatting restoration. Candidate now uses a taller/narrower mobile page, 16.5-point body text, earlier wrapping, and hanging list indents | Rebuild/reinstall Dev candidate and visually inspect short, long, list-heavy, and multi-page PDFs; reconfirm from Play internal test |
| Read answers through Android system Text-to-Speech when WebView speech is unavailable | Implemented after `50daea1`; default voice, punctuation, long-answer playback, and Stop Reading confirmed working well on Samsung SM-S938U1 in `1.1.0-dev` | Reconfirm from the Play-signed internal-test upgrade |
| Share generated images with `Made with OffGrid AI Image Studio` attribution | Implemented after `50daea1`; attribution and share workflow confirmed working in the side-by-side physical-device candidate | Reconfirm from the Play-signed internal-test upgrade and one additional recipient app if practical |
| Installed launcher label and icon use `OffGrid AI FieldGuide` branding | Present in current source after Play v1 | Confirm launcher label, adaptive icon, and upgrade preservation |

The owner reports that the current hosted Saved Guides experience already opens the useful location on the test phone. That does not prove the updated native picker is present in Play v1; retain it in this queue until version code `2` is installed and verified.

## Hosted versus native decision rule

- HTML, CSS, browser JavaScript, prompts, server routing, and server-side policy text normally deploy through GitHub `main` to Render and appear without a Play update.
- Java/Kotlin/Swift code, Android permissions, native share/file behavior, launcher label/icon, splash resources, package metadata, and bundled Capacitor configuration require a new signed store binary.
- A hosted feature that checks for a new native bridge method may deploy first. It must keep a safe fallback until the corresponding binary is broadly installed.

## Release gates

1. Verify Android Studio, Android SDK 36, and JDK 21 on the build computer; retain JDK 17 only for older-project compatibility.
2. Confirm `origin/main` and a clean working tree.
3. Set version name/code deliberately; never reuse version code `1`.
4. Run web tests, Capacitor sync, Android unit tests, and release bundle assembly.
5. Verify the release is signed with the existing upload key; never create a replacement key casually.
6. Install through Google Play Internal testing and test upgrade behavior on a physical phone.
7. Verify chat, image/video, automatic Make Field Guide, Save Field Guide, attached-PDF Share, Saved Guides, compass, permissions, launcher name/icon, and offline access to previously saved PDFs.
8. Upload/promote the same tested AAB to Production, add release notes, submit for review, and monitor status.
9. After approval and rollout, verify that Google Play offers `Update` to a version-code-1 installation.

Internal-test opt-in URL: `https://play.google.com/apps/internaltest/4701601831150090903`

## Completion record

Do not remove an item when code is committed. Move it to a dated completed-release section only after the Play-delivered update is installed and physically verified.

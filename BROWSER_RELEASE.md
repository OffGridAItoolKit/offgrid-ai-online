# FieldGuide browser release boundary

Updated September 20, 2026. Workstream: ONLINE_APP. Approved for production by the owner after Google Play testing and the owner's report that Mac testing was good to go. Deployment outcome is recorded in the dated deployment log and release backup directory.

## Baseline and Apple evidence

This checkout is based on `2eaf89cb1d91b511dc998666691cb64c71a22dbe` from current `origin/main`, including September iOS consent and routing work. The older ASUS checkout at `b2d9315` is not a release candidate; the first local patch there was never deployed.

The owner says the Apple submission was built on a Mac mini using TestFlight and is awaiting review. Local vault records identify iOS Build 1.0 (6) and URL `/online?surface=app&platform=ios`. The submitted archive was not inspected on this Windows machine. Mac-origin notes through September 16 are present, but current Mac vault sync health remains unconfirmed.

## Separate browser UI

| Surface | Page | Styles | Prompt navigation |
| --- | --- | --- | --- |
| QR browser `/mobile` | `mobile.html` | `mobile.css` | `/mobile/ready-made-prompts` returns to `/mobile` |
| Existing `/online`, Android and iOS app URLs | Original `index.html` | Original `offgridai.css` | Original app prompt page and return behavior |

The browser route always uses web configuration, even when its query includes `surface=app` or `platform=ios`. Browser pages start dark and use a separate theme key, `offgrid-fieldguide-browser-theme`; deliberate light-mode choices are remembered. App files and their preference key are unchanged.

The browser pages are an intentional release snapshot based on current app source. Future app improvements must be deliberately ported and tested in this copy. Shared libraries and APIs remain shared and are protected against modification by this patch's checks.

## Completed verification

- `test:browser-isolation`: 23/23; 131 protected UI, native, policy, dependency and backend files match the baseline. Shared server changes are restricted to browser routing. Existing app responses and assets match exactly.
- `node scripts/check-browser-isolation.js --live`: 12/12 read-only checks; production `/online` variants, CSS, prompt pages/catalog and vendor resources match raw pinned Git bytes.
- `test:mobile-routing`: 13/13; browser-only config, slash routes, separate CSS/prompts and unchanged root page.
- `test:browser-files`: eight behavioral groups including dark default, remembered theme, separate storage key, local PDF chooser and browser print/share behavior.
- Current regression suites passed: FieldGuide 57/57, platform isolation 23/23, AI consent 31/31, privacy 33/33, health disclosure 6/6, PDF Markdown 12/12, and prompt catalog 2,106 entries.
- Consent/platform test readers now normalize Windows CRLF to LF. Assertions and product consent code are unchanged.
- Chromium observation: `/mobile` opens dark despite the old preview's saved light preference; prompt search and Use actions return to `/mobile`.
- Physical Google Play smoke test on September 20: version 1.2.0 / code 3, Samsung SM-S938U1, Android 16. Launch, prompt navigation, live chat, integrated guide generation, PDF save/share/reopen, image save, photo analysis, short-video analysis, theme and Read Aloud controls passed. Installed APK targets `/online?surface=app`, which is covered by the exact-response checks. The app used current production; it did not load the unpublished candidate. Hardware-specific camera/microphone/compass and other untested cases are recorded in the separate Android report.
- The owner reported that the Mac said everything looked good to go and explicitly authorized deployment. This is an owner-reported Mac result; the Windows agent did not independently inspect the Mac archive or detailed test output.
- Immediately before release, `origin/main` was refreshed and remained at the pinned baseline. Local preservation (23), routing (13), browser-file behavior (8 groups) and live native-page preservation (12) checks passed again.

## Release limits

This release changes the hosted browser experience only; it includes no native build, signing change or store submission. These checks establish preservation of current app content and backend code; they do not make hosting independent or replace device testing.

Both products share hosting and APIs, so deployment availability and service outages remain shared concerns. Post-deployment verification must check the new browser route, health, and unchanged native response bytes.

## Backup and fallback

The last known good production commit is `2eaf89cb1d91b511dc998666691cb64c71a22dbe`, named by Git tag `backup/pre-mobile-browser-20260920`. A verified Git bundle and source ZIP are retained outside the checkout under `release-backup-20260920`, alongside checksums and the exact release commit.

For a code rollback, create a fresh branch from current `origin/main`, revert this browser release commit, review and test the revert, then push it normally to `main` to trigger Render. This preserves subsequent history. Do not hard-reset or force-push production. The backup ZIP and bundle contain repository code, not Render environment variables or a database backup; this release changes neither configuration nor database schema.

Some browsers may have cached the former permanent `/mobile` to `/online` redirect. Those clients may need a hard refresh or cleared redirect cache; `/online` stays on the protected app experience.

Local preview: `http://localhost:32120/mobile`, served from this checkout. AI credentials were not copied from the old checkout; the preview database is intentionally unavailable. The initial browser-isolation pass used UI checks and no AI-generation requests. Subsequent physical Android testing used the installed app's live service with a built-in packing prompt and public logo/video fixtures; no personal media was submitted. The resulting four-page test PDF is complete, with a minor existing heading/page-break issue logged for later native PDF layout work.

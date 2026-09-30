# Desktop Knowledge Base save checks

`npm run test:kb-save` tests the actual save functions extracted from `index.html`.
Coverage includes Mac/Windows product layouts, exact-category selection, nested
folders, remembered session destinations, Change Folder cancellation, duplicate
confirmation, denied permissions/disconnected storage, sibling image references,
title/folder HTML escaping, and browsers without directory-picker support.

For a native picker check without AI generation or production data:

1. Create a **disposable** product folder containing `Saved Knowledge Base`,
   `Shelter & Fire`, `Shelter & Fire/Winter`, and `Water & Food` directories.
2. Run `node scripts/serve-kb-save-fixture.js`, then open
   `http://localhost:38174` in Chrome or Edge. It binds only to localhost, reads
   the current production functions, and uses a synthetic article/one-pixel PNG.
3. Choose an exact category and save. Save again under a different title; no new
   picker should be needed. Reuse a title; cancel the replacement confirmation
   and check that the original files are unchanged.
4. Change Folder; it should start in the remembered folder. Cancel once, then
   choose the disposable product root. Select an actual category or nested
   category; Markdown and PNG must be together with a relative image link.
5. Check that no files were written into the product or Knowledge Base root.
   Stop the fixture server after testing. Never select a real customer library.

The app retains the directory handle only for the current page session. A fresh
page uses the existing `offgrid-knowledge-base` picker ID; last-used picker
location after reload is browser-managed, not guaranteed permanent storage.
Safari/unsupported desktop browsers retain file downloads and placement guidance.
The separately routed `/mobile`, native PDF saves/shares, and `/image-studio`
are not changed by this desktop correction.

Deployment follows the existing Render auto-deploy on a fast-forward push to
`main`. After deployment, compare full live page and asset bytes to an exact
commit (read-only; no AI calls):

```
node scripts/check-browser-isolation.js --live --release-ref <commit-sha>
```

The historical isolation guard now pins pre-correction release `2dfabdf`, allows
only the explicitly named/tested desktop-save functions, and still compares all
other shared-page code, native code, policies, server files, and protected assets.
Native macOS picker behavior does not substitute for a real Windows Explorer
test; Windows layout/session logic is tested automatically.

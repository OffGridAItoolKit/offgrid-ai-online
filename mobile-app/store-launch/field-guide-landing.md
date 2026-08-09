# OffGrid AI Field Guide Landing Page

## Domain plan

- Canonical domain: `https://offgridai.guide`
- Redirect domain: `https://offgridaifieldguide.com`
- Product: online `OffGrid AI Field Guide`
- Google Play package: `com.offgridaitoolkit.app`

`offgridai.guide` is the primary address because it is short, memorable, and matches the product name. Both root and `www` forms of `offgridaifieldguide.com` should redirect permanently to the corresponding path on `offgridai.guide`.

## Hosting behavior

The landing page is served by the existing Render service when the forwarded request host is `offgridai.guide` or `www.offgridai.guide`. The longer domain redirects at the application layer. Existing `offgridtoolkit.ai` application routes are unchanged.

Required Render custom domains:

- `offgridai.guide`
- `www.offgridai.guide`
- `offgridaifieldguide.com`
- `www.offgridaifieldguide.com`

After Render supplies the DNS targets, configure those exact records at the domain registrar. Do not replace existing `offgridtoolkit.ai` records.

## Product positioning

- Lead promise: turn questions, photos, and short videos into practical Field Guides.
- Primary CTA: Google Play listing.
- Secondary CTA: online web experience.
- Online edition: free, no account, no ads, internet required for AI and visual generation.
- Offline edition: separate future paid `OffGrid AI ToolKit`, designed to run AI locally and intentionally not presented as the same app.

## Release state - 2026-08-09

- Landing page source, host routing, social card, and automated checks are deployed from GitHub `main` at commit `8fdfc52`.
- The deployed Render origin returned HTTP 200 for the new landing-page asset and contained the expected title and Google Play link.
- Domain attachment and registrar DNS changes remain required before either new domain resolves to the landing page.

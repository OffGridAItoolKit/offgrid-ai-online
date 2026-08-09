# OffGrid AI Field Guide Landing Page

## Domain plan

- Canonical domain: `https://offgridai.guide`
- Redirect domain: `https://offgridaifieldguide.com`
- Product: online `OffGrid AI Field Guide`
- Google Play package: `com.offgridaitoolkit.app`

`offgridai.guide` is the primary address because it is short, memorable, and matches the product name. Both root and `www` forms of `offgridaifieldguide.com` redirect permanently to the corresponding path on `offgridai.guide`.

## Hosting behavior

The landing page is served by the existing Render service when the forwarded request host is `offgridai.guide` or `www.offgridai.guide`. The longer domain redirects at the application layer. Existing `offgridtoolkit.ai` application routes are unchanged.

Required Render custom domains:

- `offgridai.guide`
- `www.offgridai.guide`
- `offgridaifieldguide.com`
- `www.offgridaifieldguide.com`

Namecheap BasicDNS uses an `A` record for each root (`@`) pointing to Render's documented address and a `CNAME` for each `www` host pointing to `offgrid-ai-online.onrender.com`. Existing `offgridtoolkit.ai` records were not changed.

## Product positioning

- Lead promise: turn questions, photos, and short videos into practical Field Guides.
- Primary CTA: Google Play listing.
- Secondary CTA: online web experience.
- Online edition: free, no account, no ads, internet required for AI and visual generation.
- Offline edition: separate future paid `OffGrid AI ToolKit`, designed to run AI locally and intentionally not presented as the same app.

## Release state - 2026-08-09

- Landing page source, corrected host routing, Apple-version notice, social card, and automated checks are deployed from GitHub `main` at commit `a67db55`.
- `https://offgridai.guide` is verified in Render, has a TLS certificate, and returns HTTP 200 with the expected title and Google Play link.
- `https://www.offgridai.guide` redirects permanently to the canonical root domain.
- `https://offgridaifieldguide.com` is verified in Render and redirects permanently to the canonical domain; its `www` certificate was still completing at the time of this record.
- The Google Play store-listing contact website is published as `https://offgridai.guide`.
- A gallery will be added after the owner provides approximately eight representative Field Guide images.

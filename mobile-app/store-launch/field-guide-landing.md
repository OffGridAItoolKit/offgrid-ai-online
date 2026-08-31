# OffGrid AI FieldGuide Landing Page

## Domain plan

- Canonical domain: `https://offgridai.guide`
- Redirect domain: `https://offgridaifieldguide.com`
- Product: online `OffGrid AI FieldGuide`
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

## Public media library

Landing-page media is stored under `assets/field-guide/` so it is deployed with the existing Render service and can be reused by future website, blog, social, and store-listing work.

- `brand/` preserves both full-quality angled phone PNGs and provides optimized WebP copies. The left-facing version is used on the right side of the landing-page hero so the device points inward toward the headline.
- `walkthrough/` contains the straight-on, silent walkthrough video and poster. The unchanged generation wait is shortened, Android system bars are cropped, and the recording ends before the notification shade appears.
- `gallery/original/` preserves the six full-resolution generated PNGs with corrected descriptive filenames.
- `gallery/web/` and `gallery/thumb/` contain optimized WebP copies used by the responsive gallery and accessible lightbox.

The gallery includes a prominent verification notice because its examples include medical, emergency, mechanical, food-safety, and survival information.

## Mobile presentation

The landing page is mobile-first for the expected audience. On phone-width screens it uses a shorter hero render, compact Google Play header action, 2-by-2 trust summary, denser feature cards, reduced section spacing, smaller straight-on video frame, and a horizontally swipeable gallery instead of stacking six large images. Very narrow screens switch the feature cards to a readable single-column horizontal layout.

## Website support form

- Formspree team: `Inspired`
- Project: `OffGrid AI FieldGuide`
- Form: `Website Support`
- Public endpoint: `https://formspree.io/f/xqpkevea`
- Allowed submission domain: `offgridai.guide` and its subdomains
- Intended notification address: `support@offgridaitoolkit.com`

The landing page uses a dependency-free AJAX form with accessible labels and status messages, browser validation, a honeypot field, topic/platform context, a warning not to send sensitive information, and a direct-email fallback. The Formspree endpoint is a public form identifier, not a secret. Formspree account credentials and email-verification links must never be committed.

As of 2026-08-31, `support@offgridaitoolkit.com` is verified and selected as the Formspree notification address. A direct production-origin diagnostic returned HTTP 200 and appeared in the Formspree submissions inbox, confirming that the endpoint, allowed domain, and delivery workflow are active. The landing page also guards against browser autofill overlays that look populated but provide an empty email value, and it surfaces Formspree's rejection details when available.

## Release state - 2026-08-09

- The initial landing page, corrected host routing, Apple-version notice, social card, and automated checks were deployed at `a67db55`; the owner-supplied media showcase and reusable asset library were deployed at `1ca6f15`.
- `https://offgridai.guide` is verified in Render, has a TLS certificate, and returns HTTP 200 with the expected title and Google Play link.
- `https://www.offgridai.guide` is verified and configured to redirect permanently to the canonical root domain; its certificate was still propagating across edges at the time of this record.
- Both root and `www` forms of `https://offgridaifieldguide.com` are verified and redirect permanently to the canonical domain.
- The Google Play store-listing contact website is published as `https://offgridai.guide`.
- The landing page now includes an actual app hero render, straight-on workflow video, and six-example responsive gallery with keyboard-accessible lightbox.

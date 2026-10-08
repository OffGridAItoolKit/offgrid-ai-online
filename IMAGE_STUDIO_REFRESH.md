# Standalone Image Studio candidate — October 8, 2026

Workstream: ONLINE_APP. Repository: OffGridAItoolKit/offgrid-ai-online. Branch: codex/image-studio-refresh. Starting release: 640daa7. Local candidate; not deployed.

## Result

The standalone `/image-studio` page now starts with idea-based creation. It uses the existing `/api/image-studio/craft-prompt` endpoint with the selected visual category, layout guidance and instructions to preserve supplied facts and avoid invented specifications. Prompt review/editing and direct prompt entry are optional. An explicit article mode retains the existing `/visual-prompt` contract, and incoming article payloads still select that mode and auto-generate. Article + Auto sends the established crafted prompt to generation without the standalone additions.

The page includes gallery examples that populate the form without spending an image credit, phone-first placement of the creator, layout choices, Save Image and Share Image. The existing standalone Markdown/image and PDF save paths remain. Raw user descriptions/articles, not hidden prompt instructions, are saved. The layout choices guide the model in text; this release does not set exact image dimensions or change the shared generator request schema.

All controls are locked during requests, duplicate submissions are rejected, changed idea/category/layout invalidates the previous prompt, and failed regeneration preserves the last successful image. Anonymous visitors see preview access rather than an invented 10/10 balance; authenticated allowance errors say unavailable.

Files changed: `image-studio-app.html`, standalone helper `assets/image-studio-flow.js`, test scripts, isolated comparison script, this note and a package test command. `index.js`, `index.html`, `mobile.html`, mobile binaries/source, privacy/routing policies, license accounting and existing article/KB/PDF handlers are unchanged from 640daa7.

## Model investigation

The newer backend uses `google/gemini-3-pro-image` (Nano Banana Pro). The frontend's older preview model hint is unchanged; the backend already normalizes it to the configured Pro model. This candidate does not change any model default.

An isolated comparison was attempted using the same public six-item DAY HIKE KIT prompt and `provider: { zdr: true }` on October 8. No customer content or personal media was used.

| Model | Result | Time | API-reported cost |
| --- | --- | --- | --- |
| google/gemini-3-pro-image | 200, PNG generated | 30.852 seconds | $0.138828 |
| google/gemini-nano-banana-2.1 | 404, no ZDR-compatible endpoint | 0.036 seconds | No usage returned |

The exact rejection was: `No endpoints found matching your data policy (Zero data retention).` Remaining generations were stopped. No privacy setting, recipient allowlist or fallback was relaxed. The iOS route additionally requires Google Vertex; public endpoint discovery listed only Google AI Studio for 2.1. Keep Pro in all production flows.

This is an availability result, not a comparative quality verdict. The Pro sample is a readable 1024×1024 image with the six requested labels and matching illustrations. There is no 2.1 sample to score. Once a compatible endpoint exists, rerun all three matched cases, then repeat borderline cases; score exact labels, diagram relationships, factual fidelity, phone readability, requested layout, latency, cost and retries. A single image per case is an initial screen, not proof of general superiority.

Local raw evidence: sibling `image-studio-review-20261008/results.json` and `packing-pro.png`. Reproduction: `node scripts/compare-image-models.js <new-output-directory>` with `OPENROUTER_API_KEY` already in the environment. The runner stops on the first failed/empty response, never silently relaxes routing, saves usage metadata without credentials, and refuses to overwrite an existing report.

## Verification

- Standalone behavior: 11 passing tests (prompt routing/editing, direct prompt, invalidation, preset no-spend behavior, article handoff, concurrency, failure recovery, KB pairing, allowance wording, protected source equality).
- Desktop Knowledge Base regression: 18 passing tests.
- HTTP release preservation: 14 checks against 640daa7, covering existing web, Android and iOS page responses/assets plus the new standalone page/helper.
- Existing checks pass: Field Guide 57, platform isolation 23, AI consent 31, privacy policy 33, PDF Markdown 12, iPhone Duo 18, browser-file behavior 8 groups.
- Browser observation: desktop and 390px phone layout inspected; no horizontal overflow at 390px. Gallery selection populates the composer without generating. Live Craft My Prompt returned an editable prompt with placeholders for unspecified dimensions.
- Live end-to-end generation: a public six-item DAY HIKE KIT request produced a watermarked Pro image. Save Image and Download KB Files downloaded the image and Markdown successfully. The Markdown retained the original request and matching relative image filename; the two downloaded PNG copies have identical SHA-256 hashes. Native folder selection, native sharing and physical USB readback remain untested.
- Historical `check-mobile-routing.js` passes its first 12 assertions but fails its final comparison to the old 2dfabdf baseline because main now includes iPhone Duo viewport/CSS updates. Those app files and that historical test are unchanged in this candidate. The dedicated 14-check release test uses the actual starting release; the old guard was not weakened.

## Release boundary

No store build, signing, installation, listing change or production deployment is included. Native device save/share and physical USB readback have not been re-run on this candidate. Their implementations are byte-preserved and the relevant automated tests pass, which does not replace physical-device verification.

For a hosted rollout, review this standalone candidate first, deploy only the reviewed commit, then verify `/image-studio` and unchanged `/online`, `/mobile`, Android and iOS response contracts. Do not combine a model switch with this rollout. Roll back with a normal revert of the standalone change if needed; preserve subsequent history.

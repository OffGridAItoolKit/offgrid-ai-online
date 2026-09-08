# Matched Open Arena Provider Reliability

Implemented September 8, 2026. Scope: `/open-arena` and `/api/open-arena/*`, not the legacy `/arena-open`, `/arena`, `/command` or `/online` flows.

## Incident

The owner reported two incomplete seawater-desalination comparisons. The screenshots show successful automatic Water & Food categorization followed by HTTP 429/503 failures on the hosted 26B pair, plus one incomplete baseline answer. Its exact finish reason was not retained in the screenshots; do not infer truncation, filtering or identity mismatch from the old combined error message.

The dedicated OpenRouter key had $24.81400455 of its $25 monthly allowance remaining when checked. A bounded direct baseline request for the same question subsequently completed on the pinned Google provider with `finish_reason=stop`. This supports intermittent provider/routing availability rather than a deterministic category-input failure; it does not establish which upstream quota or capacity condition caused the original errors. The classifier uses a separate GPT-5.2/OpenAI request and cannot change candidate or grading messages.

## Recovery Policy

Version: `same-provider-transient-v1`.

- Both 26B candidates have the same maximum of three total attempts for HTTP 429, 502, 503 or 504, including equivalent numeric OpenRouter error envelopes under HTTP 200. Retries apply only before any detected output. Retry delays are 5 then 10 seconds, or longer when required by `Retry-After`.
- The original 180-second deadline covers all attempts and waits for that candidate. A wait longer than 60 seconds, or one that cannot fit before the deadline, ends the attempt sequence without retrying early. Cancellation interrupts waiting and prevents further calls.
- Every retry sends the exact same serialized payload, model, Google provider route, seed, generation settings and question/system instructions. Provider fallbacks remain disabled. There is no higher-scoring-answer selection or reroll of a completed answer.
- Partial text, output-limit truncation, content filtering, unverifiable identity/settings and malformed replies are not retried. Ambiguous network failures, authentication/credit/validation errors and unlisted status codes are not retried. Partial text returned with an explicit provider error is preserved as incomplete.
- E4B/Modal, GPT-5.2 classification and GPT-5.2 judging remain single-attempt. A failed classifier still uses the labeled General / Visual fallback. The judge is not called unless all four candidates pass completion and identity checks.
- The UI shows retry progress and provider-attempt counts. Full comparison exports and the report retain reliability version and safe per-attempt status/timing/wait metadata, including failed attempts. Raw upstream error bodies, request headers, private prompts and provider credentials are never included in diagnostics.
- Error messages distinguish rate limits, temporary unavailability, output limits, interrupted generation, content filtering, empty answers and unverified identity. None is a win or loss.

## Research and Budget Boundaries

The OffGrid instructions, grading prompt, 2:2:1 weights, provider pins and model settings are unchanged. Existing Session/Lifetime records are not rewritten or reset. Reliability metadata does not split an otherwise identical inference configuration; detailed transport history remains in full run exports, not text-free persistent analytics. Prior incomplete attempts remain incomplete.

The existing 10/day and 20/month comparison limits and provider spending caps remain. Retrying a candidate stays inside the same reserved comparison, but an upstream service can bill failed processing; the exported successful-response cost is not a guaranteed total including failed attempts. No plan, key allowance or always-warm GPU setting changed. This mitigates transient failures; it does not guarantee provider capacity.

## Verification

`npm run test:arena` covers transport bounds, identical payloads, Retry-After, cancellation/deadlines, sanitized errors, no partial-answer rerolls, both 26B variants, unchanged classifier/judge policy, failure exclusion and existing analytics/category rules. `scripts/check-arena-browser.js` checks retry labels, specific incomplete-answer explanations and the existing category/history/reset/export/responsive workflows using local fixtures, not paid model calls.

Error semantics and backoff reference: [OpenRouter error handling](https://openrouter.ai/docs/api/reference/errors-and-debugging).

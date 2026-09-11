# Provider Qualification — Version 1.0 (Build 5)

Tested September 11, 2026 (America/Phoenix) from the production Render service shell. These were read-only API qualifications; no environment settings, application files, deployments, or stored user media were changed. Credentials and raw request media were not printed or recorded.

## Purpose

Determine whether the iOS privacy route can preserve the original `google/gemma-4-26b-a4b-it` model, BF16 inference quality, and cohesive eight-frame video analysis while restricting requests to a fixed, named set of OpenRouter Zero Data Retention endpoints.

## Request Shapes

All requests used the production OffGrid system prompt and the OpenRouter Chat Completions API.

1. **Text:** one ordinary field-safety question.
2. **Photo:** one text instruction plus one PNG `image_url` data part.
3. **Video:** the production-style video instruction plus eight PNG `image_url` data parts in one request.
4. **Changing sequence:** eight compass images of varying apparent size to check that the model treated the images as a cohesive sequence rather than unrelated pictures.

The standard streaming reliability requests used `stream: true`, temperature `0.7`, and 300 output tokens. The production-budget Gemini fallback qualification used 4,096 output tokens. Every provider-specific request set `zdr: true`, `data_collection: "deny"`, an exact `only` endpoint tag, and `allow_fallbacks: false` so the returned result could be attributed to one endpoint.

## Gemma 4 BF16 Results

The OpenRouter ZDR registry listed these four Gemma 4 endpoints as Zero Data Retention and BF16 at test time:

| Endpoint tag | Returned provider | Non-stream text/photo/video | Standard eight-frame streams | Eight-frame stream timing |
| --- | --- | ---: | ---: | --- |
| `nextbit/bf16` | NextBit | 3/3 passed | 4/4 passed | 2.222–3.111 s total; 2.660 s mean; 0.646 s mean response start |
| `venice/bf16` | Venice | 3/3 passed | 4/4 passed | 2.671–5.140 s total; 3.683 s mean; 2.011 s mean response start |
| `parasail/bf16` | Parasail | 3/3 passed | 1/1 passed | 6.774 s total; 0.598 s response start |
| `novita/bf16` | Novita | 3/3 passed | 1/1 passed | 7.215 s total; 0.719 s response start |

The non-stream matrix passed 12/12 requests. The standard one-request, eight-frame streaming cohort passed 10/10 requests. Responses correctly identified the controlled compass image and, for repeated frames, recognized that the sequence did not materially change.

OpenRouter response metadata reported the expected provider name and the exact returned model `google/gemma-4-26b-a4b-it` for every successful request. An ordered-policy smoke test also passed and returned NextBit when `nextbit/bf16` was first in `order`.

### Changing-Sequence Caveat

NextBit accepted an eight-frame sequence containing image sizes from 32 through 512 pixels and correctly identified both the compass and the apparent size change. Venice returned HTTP 400 when the sequence included a 32-by-32-pixel image, then passed the same class of eight-frame test when every image was at least 180 by 180 pixels, correctly identifying the object and size change in 2.878 seconds.

This tiny-image limitation is not representative of FieldGuide video frames: the iOS app extracts frames no larger than 512 by 384 pixels from ordinary phone video, and normal source frames are substantially larger than 32 by 32 pixels. It nevertheless supports placing NextBit first in the route order.

## Recommended iOS Gemma Policy

```js
{
  zdr: true,
  data_collection: 'deny',
  only: [
    'nextbit/bf16',
    'venice/bf16',
    'parasail/bf16',
    'novita/bf16'
  ],
  order: [
    'nextbit/bf16',
    'venice/bf16',
    'parasail/bf16',
    'novita/bf16'
  ],
  allow_fallbacks: true
}
```

This policy keeps the exact Gemma 4 model and BF16 quantization, permits a single cohesive eight-frame inference, and limits OpenRouter routing to the four named and tested ZDR endpoints. A 4-plus-4 frame split is not required.

## Gemini 2.5 Pro Emergency Fallback

`google/gemini-2.5-pro` was separately pinned to `google-vertex` with `zdr: true`, `data_collection: "deny"`, and `allow_fallbacks: false`. Using the production 4,096-token budget:

| Request | Result | Response start | Total time | Content check |
| --- | --- | ---: | ---: | --- |
| Text | HTTP 200 | 1.761 s | 20.946 s | Actionable field-safety answer |
| One photo | HTTP 200 | 4.573 s | 14.013 s | Correct compass identification |
| Eight frames | HTTP 200 | 4.890 s | 5.164 s | Correct compass and sequence assessment |

OpenRouter metadata returned provider `Google` and model `google/gemini-2.5-pro` for all three requests. Gemini 2.5 Pro is therefore a viable quality-first emergency fallback after all four Gemma BF16 endpoints fail, but its higher latency makes it unsuitable as the normal route.

## Image Studio Qualification

The iOS Image Studio text-preparation step was tested with its existing production `visual-prompt` instructions and a representative water-purification response. The former proposed policy—`openai/gpt-4.1-mini` restricted to `only: ["openai"]` under Zero Data Retention—returned HTTP 404 because no first-party OpenAI endpoint matched that policy. It was not selected.

The same visual-prompt request was then tested three times through the qualified Gemma 4 BF16 allowlist. All three requests returned HTTP 200 from NextBit in 2.533–3.730 seconds (3.136-second mean), stayed within the requested 80–200 words, and passed all requested format and content checks: prompt-only output, water and boiling content, mobile-readable portrait layout, labels, and a specified background. The other two iOS text-helper shapes also passed on the same route: craft-prompt returned a compliant 111-word result in 2.229 seconds, and image-summary returned all four required sections and 242 words in 5.251 seconds.

GPT-4.1 Mini through Azure ZDR also passed the visual-prompt test, but took 7.595 seconds and would have added another processor to the iOS disclosure. Gemini 2.5 Flash through Google Vertex AI was slightly faster across three trials (2.534-second mean) but only two of three responses passed every formatting check and stayed within the requested word range. Gemini 2.5 Pro was unsuitable for this small 400-token helper budget because reasoning consumed most of the available output.

Build 5 therefore uses the same four-provider Gemma 4 BF16 policy for all iOS Image Studio text helpers. Android and web retain their existing GPT-4.1 Mini legacy route.

The image-generation step was separately tested with `google/gemini-3-pro-image`, restricted to Google Vertex AI with Zero Data Retention and denied provider data collection. It returned HTTP 200 from Google, included a valid PNG data URL, and finished successfully in 17.306 seconds. The iOS image-generation route remains pinned to Google Cloud Vertex AI.

## Limitations

- These were controlled transport, capacity, latency, and basic-content checks using bundled compass assets, not a broad visual-accuracy benchmark or service-level guarantee.
- Timings are point-in-time measurements from one production Render instance and may vary with provider load and network conditions.
- The changing-sequence check used still-image assets that simulate apparent zoom; it was not raw video. Production uses the same request structure with eight locally extracted JPEG frames.
- The exact provider that served successful requests before the Apple-specific routing change cannot be reconstructed. The previous application sent only `zdr: true`, discarded returned provider metadata, and stored no generation IDs. The production API key cannot read OpenRouter's management-key-only historical activity endpoint.
- The ordered smoke test verified that the first allowed provider was selected; it did not deliberately cause an upstream outage to fault-inject every fallback transition.

## Reference Endpoints

- OpenRouter ZDR documentation: https://openrouter.ai/docs/guides/features/zdr
- OpenRouter provider routing: https://openrouter.ai/docs/guides/routing/provider-selection
- OpenRouter live ZDR endpoint registry: https://openrouter.ai/api/v1/endpoints/zdr
- Google Gemini 2.5 Pro specifications: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro

# Open Arena Private Pilot

This is an isolated `/arena-open` replacement. The default feature flag is OFF.
The existing `/arena`, `/command`, `/online`, offline application and legacy Arena history are unchanged.

## Deployment and Budget

- Modal app: `offgrid-gemma4-e4b-pilot`, workspace `offgridaitoolkit`, environment `main`.
- Website remains on Render. Only E4B inference runs on Modal.
- Initial workspace usage limit: **$10**. Do not raise it without reviewing and approving the pilot budget.
- One L4, four CPU cores, 16 GiB RAM, at most one container, zero minimum containers, three-minute scale-down window.
- One inference at a time. Busy requests fail rather than building an unbounded queue. No automatic retries or model fallbacks.
- Use a dedicated OpenRouter key capped at **$25/month or less**, not the existing production key. The CLI checks its actual key allowance before four-way probes.
- Production also reserves a persistent PostgreSQL allowance before model calls: default 20 attempts/month and 10/day. Failures consume an attempt; restarts do not reset counts. Database failure stops the pilot. Provider usage caps remain the dollar controls.
- Local pilot uses a persistent ignored usage file and exclusive lock instead of PostgreSQL. Review a stale lock after a crash; never erase usage to bypass the allowance.

Illustrative current allocation cost: L4 $0.7992/hour + four CPUs $0.18864/hour + 16 GiB RAM $0.127872/hour = $1.115712 per allocated hour, before any other applicable costs. Cold starts and idle warm time count. This is not a continuously warm $100/month service.

## Model Identity

E4B uses the exact Ollama model layer inspected in the approved Windows ToolKit:

```text
Model: gemma4:e4b
Artifact: sha256:4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a
Manifest: c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb
Quantization: Q4_K_M
Ollama runtime: 0.33.3
Docker: ollama/ollama@sha256:32931b46719f673c05fdbaa81ccb26da18ea4a1c57590a754874ab28ba269eb2
```

The CPU image build verifies the manifest and every model/config/parameter/license blob. The image retains the model's license layer. It does not replace or remove the upstream model attribution or license. Nothing is downloaded at GPU startup. Model pulls and the general Ollama API are not exposed.

The offline Windows runtime inspected was Ollama 0.21.0. This pilot uses a newer Linux GPU runtime with `OLLAMA_FLASH_ATTENTION=0`. Thus E4B weights match the inspected USB artifact, but hardware/runtime and the Arena output cap differ. The 26B pair uses the same OpenRouter model/provider for both contestants; its hosted artifact is **not verified as the USB GGUF**.

E4B generation: context 4096, maximum output 2048, temperature 1, top-p .95, top-k 64, thinking off, shared per-run seed, four threads. Council review uses context 32768, maximum output 4096, temperature .2 and the separate grader prompt. E4B settings/runtime/digest mismatches invalidate a run.

## Private Configuration

Install the Python requirements into an isolated environment, authenticate Modal, confirm the workspace limit, then deploy:

```powershell
python -X utf8 -m pip install -r infra/modal/requirements.txt
python -X utf8 -m modal token new
python -X utf8 -m modal deploy infra/modal/e4b.py
```

`local_setup.py` creates a dedicated Modal proxy token and an ignored `.env.arena` file without printing credentials. It refuses to overwrite an existing file. The model endpoint requires Modal proxy authentication before container execution.

The GitHub repository is public. **Do not commit the current offline conditioning prompt or credentials.** Configure the current prompt locally from the approved Dashboard:

```powershell
node scripts/configure-arena-prompt.js 'PATH_TO_APPROVED_DASHBOARD/index.html'
```

This verifies its digest and writes `.arena-pilot-prompt.txt` (ignored). On Render use the `OPEN_ARENA_OFFGRID_PROMPT` secret environment variable, or `OPEN_ARENA_OFFGRID_PROMPT_FILE` pointing to a private Render secret file. Preserve the exact text, including backslashes and the absence of a trailing newline. Wrong or absent prompt text fails readiness. Only its version/digest are exported to the browser.

Required `.env.arena` / Render settings:

| Variable | Purpose |
| --- | --- |
| `OPEN_ARENA_MATCHED_ENABLED` | `true` selects the new public route; leave `false` until approved |
| `OPEN_ARENA_BUDGETS_CONFIRMED` | `true` only after actual provider caps are verified |
| `OPEN_ARENA_ACCESS_KEY` | Private pilot access key; not a provider credential |
| `OPEN_ARENA_MODAL_URL` | Deployed HTTPS `*.modal.run` URL, no trailing path |
| `OPEN_ARENA_MODAL_KEY`, `OPEN_ARENA_MODAL_SECRET` | Dedicated Modal proxy credentials |
| `OPEN_ARENA_OPENROUTER_KEY` | Dedicated monthly-budgeted OpenRouter key |
| `OPEN_ARENA_OFFGRID_PROMPT` or `OPEN_ARENA_OFFGRID_PROMPT_FILE` | Exact privately stored offline instructions |
| `OPEN_ARENA_26B_PROVIDER` | Initially `google-vertex/global` |
| `OPEN_ARENA_26B_PROVIDER_NAME` | Expected returned provider identity, initially `Google` |
| `OPEN_ARENA_JUDGE_PROVIDER` | Initially `openai` |
| `OPEN_ARENA_JUDGE_PROVIDER_NAME` | Initially `OpenAI` |
| `OPEN_ARENA_MONTHLY_RUN_LIMIT`, `OPEN_ARENA_DAILY_RUN_LIMIT` | Initially `20`, `10` |

The private pilot key is held in browser memory only. Server/provider secrets are never sent to the browser. The application retains usage counters, not question/answer logs. Model hosting and API providers still process the supplied data; do not claim a networked Arena is offline or provider-free.

## Local Preview and Tests

```powershell
npm ci --ignore-scripts
npm run test:arena
python -X utf8 -m unittest discover -s infra/modal -p 'test_*.py' -v
node scripts/serve-open-arena-pilot.js
```

Real-provider preview: `http://127.0.0.1:3109/arena-open`. Missing keys/flags leave Compare disabled. Restart after configuration changes. This loopback-only launcher must never be used as a production deployment. Production uses the existing PostgreSQL-backed server.

`node scripts/preview-open-arena.js` serves **synthetic UI fixtures only** on port 3108. It cannot call model APIs; its displayed results are not benchmark evidence.

Explicit bounded technical probes:

```powershell
node --env-file=.env.arena scripts/pilot-open-arena.js e4b
node --env-file=.env.arena scripts/pilot-open-arena.js image
node --env-file=.env.arena scripts/pilot-open-arena.js e4b-review
node --env-file=.env.arena scripts/pilot-open-arena.js judge
node --env-file=.env.arena scripts/pilot-open-arena.js council
```

These scripts save local probe records under ignored `test-results/`. Direct technical probes do not reserve the website's monthly run counter; they still use the provider usage caps. Do not run them in an unattended loop. A nonzero exit means an invalid/incomplete probe, not a model losing a benchmark.

## Pilot Observations, September 7, 2026

- Automatic flash attention timed out on tested Ollama 0.21.0 and 0.33.3 configurations. Explicitly disabling it allowed text and image responses. This is a measured configuration result, not a proven root-cause diagnosis.
- Final 0.33.3 text probe: Optimized cold 102.1 seconds, baseline warm 3.2 seconds. Image probe: Optimized 6.5 seconds, baseline 4.5 seconds. Small technical samples, not throughput guarantees.
- E4B returned valid JSON review responses, but twice ranked byte-identical answers separately despite explaining that they were equivalent. The new semantic validator rejects such a review; no winner is awarded. Council quality needs further calibration. This is separate from response-generation quality.
- No new four-way live GPT-5.2 or Council comparison has yet been completed with the dedicated key. No new benchmark win-rate claim is supported.
- GPT-5.2 remains the default outside judge. Council uses four calls but two foundation families without OffGrid candidate instructions during review; the votes are not independent experts.

## Release and Rollback Gates

Before changing the live route: verify the budgeted OpenRouter key, both pinned provider identities, text and image four-way runs, GPT judgment validity, Council failure behavior, large-context/truncation behavior, PostgreSQL integration, and measured cost/latency. Obtain approval to merge/deploy.

Rollback the web experience by setting `OPEN_ARENA_MATCHED_ENABLED=false` and restarting the web service. Legacy files and storage keys are preserved. Stop all E4B pilot availability with:

```powershell
python -X utf8 -m modal app stop offgrid-gemma4-e4b-pilot
```

The schema/configuration hashes start a new statistics series when models, prompts, rubric, judge, provider or inference settings change. Do not combine historical wins, UI fixture results or failed runs with the matched-pair evidence.

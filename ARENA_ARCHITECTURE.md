# OffGrid AI Arena Architecture

Last verified against `origin/main` on 2026-05-16.

This document describes the production Arena implementation used by:

- `https://offgridtoolkit.ai/arena`
- `https://offgridtoolkit.ai/arena-open`

The Arena system is implemented primarily in `index.js`, `arena.html`, and `arena-open.html`.

## Purpose

The Arena lets users submit one prompt and compare four model answers through a blind review process. It is used for two related but different experiences:

- Standard Arena: OffGrid AI competes against ChatGPT, Claude, and Gemini.
- Open Arena: OffGrid AI variants and baseline Gemma models compete in a more controlled Gemma-family comparison.

Both Arenas share the same backend council endpoint and scoring machinery.

## Frontend Pages

### `/arena`

Served by:

```js
app.get('/arena', (req, res) => {
    res.sendFile(path.join(__dirname, 'arena.html'));
});
```

Purpose:

- Public-facing AI Arena.
- Compares OffGrid AI against ChatGPT, Claude, and Gemini.
- Uses `X-OffGrid-Client: arena`.
- Stores browser-side analytics under the standard Arena local/session storage keys.

### `/arena-open`

Served by:

```js
app.get('/arena-open', (req, res) => {
    res.sendFile(path.join(__dirname, 'arena-open.html'));
});
```

Purpose:

- Open model research Arena.
- Compares OffGrid AI Advanced, OffGrid AI Optimized, and baseline Gemma models.
- Uses `X-OffGrid-Client: open-arena`.
- Stores analytics separately from `/arena`.

## Backend Model Selection

The backend uses `getCommandModelSet(req)` to choose the active model roster.

Selection logic:

```js
const client = req.headers['x-offgrid-client'];

if (client === 'open-arena') {
    return { isArenaRequest: true, arenaType: 'Open Arena', activeModels: OPEN_ARENA_MODELS };
}

if (req.licenseData?.isArena === true || client === 'arena') {
    return { isArenaRequest: true, arenaType: 'Arena', activeModels: ARENA_MODELS };
}

return { isArenaRequest: false, arenaType: 'Council', activeModels: COMMAND_MODELS };
```

The internal model keys are legacy role names:

- `scout`
- `medic`
- `navigator`
- `ranger`

These keys are implementation details. The public UI displays human-friendly model names.

## Standard Arena Roster

Defined in `ARENA_MODELS`.

| Key | Display Name | Model ID | Notes |
| --- | --- | --- | --- |
| `scout` | ChatGPT | `openai/gpt-5.2` | General high-end model |
| `medic` | Claude | `anthropic/claude-sonnet-4.6` | Claude competitor |
| `navigator` | Gemini | `google/gemini-3.1-pro-preview` | Gemini competitor |
| `ranger` | OffGrid AI | `google/gemma-4-26b-a4b-it` | Receives OffGrid behavior layer |

The OffGrid AI model is marked with:

```js
offgridPrompt: true
```

This causes the backend to inject the OffGrid AI behavior prompt before inference.

## Open Arena Roster

Defined in `OPEN_ARENA_MODELS`.

| Key | Display Name | Model ID | Notes |
| --- | --- | --- | --- |
| `scout` | Gemma 4 26B | `google/gemma-4-26b-a4b-it` | Baseline Gemma 4 26B |
| `medic` | Gemma 4 31B | `google/gemma-4-31b-it` | Larger baseline Gemma 4 |
| `navigator` | OffGrid AI Optimized | `google/gemma-3n-e4b-it` | E4B-class Gemma with OffGrid behavior layer |
| `ranger` | OffGrid AI Advanced | `google/gemma-4-26b-a4b-it` | 26B Gemma with OffGrid behavior layer |

Both Open Arena OffGrid models are marked with:

```js
offgridPrompt: true
```

## OffGrid Behavior Layer

The OffGrid behavior layer is stored in `OFFGRID_AI_SYSTEM_PROMPT`.

It is injected only when:

- The request is an Arena request.
- The selected model has `offgridPrompt: true`.

Injection path for single-model responses:

```js
if (isArenaRequest && modelConfig.offgridPrompt) {
    openRouterMessages = [
        { role: 'system', content: OFFGRID_AI_SYSTEM_PROMPT },
        ...openRouterMessages
    ];
}
```

Injection path for council responses:

```js
if (isArenaRequest && model.offgridPrompt) {
    modelMessages = [
        { role: 'system', content: OFFGRID_AI_SYSTEM_PROMPT },
        ...modelMessages
    ];
}
```

## Main API Endpoints

### `GET /api/arena/models`

Returns the standard Arena roster.

### `GET /api/arena-open/models`

Returns the Open Arena roster.

### `POST /api/command/stream`

Streams a single selected model response.

This endpoint is shared across Command Center, Arena, and Open Arena. It uses the `X-OffGrid-Client` header to select the right model roster.

### `POST /api/command/council`

Runs the full Arena council flow.

Middleware:

```js
requireLicense
checkPromptLimit
```

High-level flow:

1. Determine active roster from `X-OffGrid-Client`.
2. Send the user query to all four models in parallel.
3. Collect all model answers.
4. Assign anonymous labels: `A`, `B`, `C`, `D`.
5. Run either peer review or GPT-5.2 Judge Mode.
6. Select the Chairman answer by score.
7. Stream a synthesized final answer using GPT-5.2 as editor.
8. Send scoring metadata to the frontend for the deliberation report.
9. Increment usage after successful completion.

## Judge Modes

Both `/arena` and `/arena-open` support two scoring modes.

### Council Mode

Default mode.

All four participating models answer the prompt. Then each model reviews the anonymous answers and ranks them.

### GPT-5.2 Judge Mode

Enabled by sending:

```json
{
  "judgeMode": "gpt-5.2"
}
```

The backend check is:

```js
const useGptJudge = isArenaRequest && judgeMode === 'gpt-5.2';
```

In Judge Mode:

- All four Arena models still answer.
- GPT-5.2 performs the anonymous review alone.
- The UI labels the deliberation as `GPT-5.2 single judge`.

## Frontend Judge Controls

Both Arena pages include:

- A Deep Mode Scoring Mode toggle.
- `Council` button.
- `GPT-5.2 Judge` button.
- `Ctrl+J` keyboard shortcut.
- Header badge when GPT-5.2 Judge Mode is active.

Storage keys:

| Page | Judge Mode Storage Key |
| --- | --- |
| `/arena` | `offgrid-arena-judge-mode` |
| `/arena-open` | `offgrid-open-judge-mode` |

## Deep Mode Analytics

Both Arena pages track analytics in the browser.

Session data is stored in `sessionStorage`.

Lifetime data is stored in `localStorage`.

Tracked concepts include:

- Total queries.
- Chairman wins.
- Category wins.
- Average response time.
- Closest election margin.
- Current and longest streak.
- Average Borda scores.
- Judge mode used for each query.

Storage keys are separated so standard Arena and Open Arena results do not mix.

| Page | Session Key | Lifetime Key |
| --- | --- | --- |
| `/arena` | `offgrid-deep-mode-data` | `offgrid-deep-mode-lifetime` |
| `/arena-open` | `offgrid-open-deep-mode-data` | `offgrid-open-deep-mode-lifetime` |

## Failure Handling

Each model call has a 45 second timeout during initial answer generation.

Each peer-review call has a 30 second timeout.

If one or more models fail:

- The system marks that model response as an error.
- The council proceeds if at least two valid model answers remain.
- If fewer than two valid model answers remain, the council returns an error.

Errored models are not eligible to become Chairman.

## Important Implementation Notes

- The review phase is anonymous: reviewers see Answer A/B/C/D, not model names.
- Label order is shuffled per reviewer to reduce positional bias.
- The final user-facing answer is synthesized by GPT-5.2 using the Chairman answer as the primary spine.
- The final answer does not mention voting, peer review, or the other models.
- Standard Arena and Open Arena share backend scoring logic but maintain separate UI copy and analytics storage.

# OffGrid AI Arena Benchmarks

Last verified against `origin/main` on 2026-05-16.

This document describes what the Arena currently benchmarks, how runs should be interpreted, and how to use Arena results responsibly.

## Benchmark Purpose

The Arena is not a general academic benchmark. It is a practical, user-facing comparison system for survival, emergency, homesteading, and off-grid prompts.

Its core question is:

Can OffGrid AI produce more useful field-ready answers than strong general-purpose models or untuned baseline models?

The Arena measures practical answer quality, not raw model intelligence.

## Benchmark Surfaces

There are two benchmark surfaces.

### Standard Arena

URL:

```text
https://offgridtoolkit.ai/arena
```

Purpose:

Compare OffGrid AI against well-known frontier models.

Roster:

| Model | Backend ID | Role in Benchmark |
| --- | --- | --- |
| ChatGPT | `openai/gpt-5.2` | General high-end comparator |
| Claude | `anthropic/claude-sonnet-4.6` | General high-end comparator |
| Gemini | `google/gemini-3.1-pro-preview` | General high-end comparator |
| OffGrid AI | `google/gemma-4-26b-a4b-it` plus OffGrid behavior layer | Specialized survival/off-grid model |

Best use:

- Marketing-oriented head-to-head comparison.
- Public demonstrations.
- User curiosity testing.
- Evidence that a specialized field-use system can compete with major hosted AI models.

### Open Arena

URL:

```text
https://offgridtoolkit.ai/arena-open
```

Purpose:

Compare OffGrid AI against baseline Gemma-family models in a more controlled model-family test.

Roster:

| Model | Backend ID | Role in Benchmark |
| --- | --- | --- |
| Gemma 4 26B | `google/gemma-4-26b-a4b-it` | Baseline foundation comparison |
| Gemma 4 31B | `google/gemma-4-31b-it` | Larger baseline Gemma comparison |
| OffGrid AI Optimized | `google/gemma-3n-e4b-it` plus OffGrid behavior layer | Smaller OffGrid-conditioned model |
| OffGrid AI Advanced | `google/gemma-4-26b-a4b-it` plus OffGrid behavior layer | Main OffGrid-conditioned 26B model |

Best use:

- Product research.
- Comparing tuned behavior versus untuned baseline behavior.
- Testing whether smaller specialized models can outperform larger untuned models on field-use prompts.
- More defensible "apples to apples" analysis.

## Prompt Categories

The Arena is strongest when prompts are relevant to the OffGrid AI use case.

Representative categories:

- Survival priorities.
- Wilderness navigation.
- Emergency first aid.
- Medicinal plant identification and toxic look-alikes.
- Grid-down planning.
- Off-grid water, power, heating, and sanitation.
- Homesteading and preparedness.
- Vehicle and field-repair decision trees.
- Wildfire, desert, cold-weather, flood, and evacuation scenarios.

The UI includes sample prompts such as:

- "I'm lost in the desert with 1 liter of water. What do I do first?"
- "Someone was bitten by an unidentified snake. What do I do right now?"
- "What are the top 5 medicinal plants in North America and their dangerous look-alikes?"
- "Walk me through the first 72 hours of a complete grid-down event."

## Benchmark Flow

For a council run:

1. The user submits a prompt.
2. All four models answer independently.
3. Answers are anonymized as A/B/C/D.
4. The system runs either Council Mode or GPT-5.2 Judge Mode.
5. Scores are computed.
6. A Chairman answer is selected.
7. GPT-5.2 synthesizes the final user-facing answer from the Chairman and advisor answers.
8. The deliberation report stores the transparent scoring data.

## Benchmark Modes

### Council Mode

Default mode.

All four models act as reviewers after answering.

Strengths:

- More entertaining and transparent for users.
- Shows how the participating models evaluate each other.
- Produces a multi-reviewer Borda-style result.

Limitations:

- Reviewers are also competitors.
- The review panel changes when the Arena roster changes.
- Some model families may have different preferences for style, caution, or verbosity.

### GPT-5.2 Judge Mode

Optional mode.

All four models still answer, but GPT-5.2 alone reviews the anonymous answers.

Strengths:

- Consistent outside judge.
- Useful for research comparisons.
- Easier to compare results across multiple prompts.

Limitations:

- Single-judge evaluation can encode that judge model's preferences.
- GPT-5.2 is also a participant in the Standard Arena as ChatGPT, so Judge Mode should be interpreted carefully there.
- For Open Arena, GPT-5.2 is not a contestant, so Judge Mode is cleaner as an outside evaluation lens.

## What Counts as a Win

The system elects a Chairman by total score.

For Arena runs, the score is:

```text
Score = 2 x Accuracy + 2 x Priority + 1 x Actionability
```

The highest scoring answer wins.

Tie-breakers:

1. Higher total score.
2. Higher Accuracy points.
3. Higher Prioritization points.
4. Higher Actionability points.
5. Stable label ordering as final fallback.

## Analytics

Deep Mode tracks benchmark history in the browser.

Session analytics include:

- Total council queries.
- Chairman wins.
- Average response time.
- Current streak.
- Closest race.
- Category strengths.
- Average Borda scores.
- Query log.

Lifetime analytics persist across browser sessions and include:

- All-time query count.
- All-time Chairman leaderboard.
- Longest streak.
- Closest election.
- Average score history.
- Exportable JSON.

Standard Arena and Open Arena analytics are intentionally separated.

## Recommended Benchmark Practice

For useful research results:

1. Run the same prompt in Council Mode and GPT-5.2 Judge Mode.
2. Track whether OffGrid AI beats its baseline model, not only whether it wins the entire Arena.
3. Use prompts that require priorities, safety, and decisive field guidance.
4. Avoid judging only by prose polish.
5. Record the exact prompt and judge mode.
6. Prefer multiple prompts across several categories over one-off results.

## Interpreting Open Arena Results

The Open Arena is the stronger test for OffGrid AI's product claim.

The most important comparison is:

```text
OffGrid AI Advanced vs Gemma 4 26B
```

Both use the same base model ID:

```text
google/gemma-4-26b-a4b-it
```

The difference is that OffGrid AI Advanced receives the OffGrid behavior layer.

If OffGrid AI Advanced consistently beats baseline Gemma 4 26B on survival/off-grid prompts, that supports the claim that domain-specific conditioning improves field-use answer quality.

The second important comparison is:

```text
OffGrid AI Optimized vs larger untuned Gemma models
```

If the smaller OffGrid AI Optimized model wins or performs competitively, that supports the claim that specialized behavior can sometimes matter more than raw model size.

## Interpreting Standard Arena Results

The Standard Arena is better for public storytelling.

It answers:

Can a specialized OffGrid AI system compete against major general-purpose AI brands on practical field-use prompts?

Strong claims should be phrased carefully:

Good:

- "OffGrid AI is purpose-built for survival and off-grid decision support."
- "The Arena lets users test whether specialization matters."
- "In our Arena tests, OffGrid AI often performs strongly on practical field-use prompts."

Avoid:

- "OffGrid AI is smarter than ChatGPT."
- "OffGrid AI always wins."
- "This proves one model is objectively best."

## Known Limitations

- Results are prompt-dependent.
- Model providers can update hosted models over time.
- GPT-5.2 Judge Mode is not perfectly neutral in Standard Arena because ChatGPT/GPT-5.2 is also a contestant there.
- Browser analytics are local to the user's browser unless exported.
- Arena results are not a substitute for expert validation in medical, survival, or life-threatening situations.

## Suggested Reporting Format

When saving or sharing benchmark results, include:

- Date.
- Arena type: Standard Arena or Open Arena.
- Prompt.
- Judge mode: Council or GPT-5.2 Judge.
- Chairman winner.
- Final score table.
- Top accuracy explanation.
- Top prioritization explanation.
- Top actionability explanation.
- Any observations about safety, uncertainty, or missing caveats.

'use strict';

// Shared, deterministic analytics for the browser and its regression tests.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ArenaAnalytics = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    const VERSION = 'matched-analytics-v2';
    const CATEGORIES = Object.freeze({
        water: 'Water & Food',
        shelter: 'Shelter & Exposure',
        medical: 'Medical & First Aid',
        navigation: 'Navigation & Rescue',
        repairs: 'Tools & Repairs',
        planning: 'Planning & Preparedness',
        general: 'General / Visual',
    });
    const KEYS = ['optimized', 'e4b', 'advanced', '26b'];
    const PAIRS = { optimized: 'e4b', advanced: '26b' };
    const CRITERIA = ['accuracy', 'prioritization', 'actionability', 'total'];
    const categoryName = (key) => CATEGORIES[key] || 'Uncategorized';
    const safeCategory = (key) =>
        typeof key === 'string' && Object.hasOwn(CATEGORIES, key)
            ? key
            : 'general';
    function canonical(value) {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object')
            return Object.fromEntries(
                Object.keys(value)
                    .sort()
                    .map((k) => [k, canonical(value[k])]),
            );
        return value;
    }
    function series(run) {
        const withoutSeed = (settings) =>
            Object.fromEntries(
                Object.entries(settings || {}).filter(
                    ([key]) => key !== 'seed',
                ),
            );
        const metadata = (item) => [
            item.key || item.reviewer,
            item.model,
            item.metadata?.providerRoute || item.metadata?.provider,
            item.metadata?.runtime,
            item.metadata?.artifactDigest,
            withoutSeed(item.metadata?.settings),
        ];
        return JSON.stringify(
            canonical([
                VERSION,
                run.mode,
                run.rosterVersion,
                run.validationVersion || 'initial-validation',
                run.rubricDigest,
                run.promptDigest,
                withoutSeed(run.settings),
                run.answers
                    .map(metadata)
                    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
                run.reviews
                    .map(metadata)
                    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
            ]),
        );
    }
    function scoreValid(score) {
        return (
            score &&
            CRITERIA.every(
                (c) =>
                    Number.isFinite(score[c]) &&
                    score[c] >= 0 &&
                    score[c] <= (c === 'total' ? 15 : 3),
            ) &&
            Math.abs(
                score.total -
                    (2 * score.accuracy +
                        2 * score.prioritization +
                        score.actionability),
            ) < 1e-8
        );
    }
    function pairsFrom(scores) {
        return Object.entries(PAIRS).map(([conditioned, baseline]) => {
            const delta = scores[conditioned].total - scores[baseline].total;
            return {
                conditioned,
                baseline,
                delta,
                outcome:
                    Math.abs(delta) < 1e-8 ? 'tie' : delta > 0 ? 'win' : 'loss',
            };
        });
    }
    function record(run) {
        const complete =
            run.status === 'complete' &&
            KEYS.every((k) => scoreValid(run.scores?.[k]));
        return {
            id: run.id,
            date: run.createdAt,
            mode: run.mode,
            category: safeCategory(run.category),
            status: complete ? 'complete' : 'incomplete',
            series: complete ? series(run) : null,
            scores: complete
                ? Object.fromEntries(
                      KEYS.map((k) => [
                          k,
                          Object.fromEntries(
                              CRITERIA.map((c) => [c, run.scores[k][c]]),
                          ),
                      ]),
                  )
                : null,
            elapsedMs: Number.isFinite(run.elapsedMs) ? run.elapsedMs : null,
        };
    }
    function validateRecords(raw) {
        if (!Array.isArray(raw)) throw new Error('Invalid analytics storage.');
        const ids = new Set();
        return raw.map((r) => {
            if (
                !r ||
                typeof r.id !== 'string' ||
                r.id.length > 100 ||
                ids.has(r.id) ||
                !['judge', 'council'].includes(r.mode) ||
                !['complete', 'incomplete'].includes(r.status) ||
                !Number.isFinite(Date.parse(r.date)) ||
                typeof r.category !== 'string' ||
                !Object.hasOwn(CATEGORIES, r.category) ||
                (r.status === 'complete' &&
                    (typeof r.series !== 'string' ||
                        r.series.length > 20000 ||
                        !KEYS.every((k) => scoreValid(r.scores?.[k]))))
            )
                throw new Error('Invalid analytics record.');
            ids.add(r.id);
            return {
                id: r.id,
                date: r.date,
                mode: r.mode,
                category: r.category,
                status: r.status,
                series: r.status === 'complete' ? r.series : null,
                scores:
                    r.status === 'complete'
                        ? Object.fromEntries(
                              KEYS.map((k) => [
                                  k,
                                  Object.fromEntries(
                                      CRITERIA.map((c) => [c, r.scores[k][c]]),
                                  ),
                              ]),
                          )
                        : null,
                elapsedMs:
                    Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0
                        ? r.elapsedMs
                        : null,
            };
        });
    }
    function add(records, item) {
        return records.some((r) => r.id === item.id)
            ? records
            : [...records, item];
    }
    function configurations(records, mode) {
        const found = new Map();
        for (const r of records) {
            if (r.mode !== mode || r.status !== 'complete') continue;
            const entry = found.get(r.series) || {
                id: r.series,
                first: r.date,
                latest: r.date,
                count: 0,
            };
            entry.count++;
            if (r.date < entry.first) entry.first = r.date;
            if (r.date > entry.latest) entry.latest = r.date;
            found.set(r.series, entry);
        }
        return [...found.values()].sort((a, b) =>
            b.latest.localeCompare(a.latest),
        );
    }
    function summarize(
        records,
        { mode, series: fingerprint, category = 'all' },
    ) {
        const selected = records.filter(
            (r) =>
                r.mode === mode &&
                (category === 'all' || r.category === category),
        );
        const complete = selected.filter(
            (r) => r.status === 'complete' && r.series === fingerprint,
        );
        const pairs = Object.fromEntries(
            Object.keys(PAIRS).map((k) => [
                k,
                {
                    wins: 0,
                    ties: 0,
                    losses: 0,
                    count: complete.length,
                    winRate: null,
                    delta: Object.fromEntries(CRITERIA.map((c) => [c, null])),
                },
            ]),
        );
        const averages = Object.fromEntries(KEYS.map((k) => [k, null]));
        if (complete.length) {
            for (const key of KEYS)
                averages[key] =
                    complete.reduce((s, r) => s + r.scores[key].total, 0) /
                    complete.length;
            for (const [key, baseline] of Object.entries(PAIRS)) {
                const p = pairs[key];
                for (const r of complete) {
                    const result = pairsFrom(r.scores).find(
                        (p) => p.conditioned === key,
                    );
                    p[
                        result.outcome === 'win'
                            ? 'wins'
                            : result.outcome === 'tie'
                              ? 'ties'
                              : 'losses'
                    ]++;
                }
                p.winRate = p.wins / p.count;
                for (const c of CRITERIA)
                    p.delta[c] =
                        complete.reduce(
                            (s, r) =>
                                s + r.scores[key][c] - r.scores[baseline][c],
                            0,
                        ) / complete.length;
            }
        }
        const times = complete
            .map((r) => r.elapsedMs)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        return {
            count: complete.length,
            incomplete: selected.filter((r) => r.status !== 'complete').length,
            incompleteScope:
                'Selected mode/category, across all configurations',
            pairs,
            averages,
            medianMs: times.length
                ? (times[Math.floor((times.length - 1) / 2)] +
                      times[Math.floor(times.length / 2)]) /
                  2
                : null,
            first: complete.length
                ? complete.map((r) => r.date).sort()[0]
                : null,
            latest: complete.length
                ? complete
                      .map((r) => r.date)
                      .sort()
                      .at(-1)
                : null,
        };
    }
    function shareSummary(summary, { scope, mode, category }) {
        const format = (n) => n.toFixed(2).replace(/\.?0+$/, '');
        return [
            'OffGrid AI Open Arena | Matched Model Comparison',
            `${scope === 'lifetime' ? 'Lifetime on this device' : 'This browser session'} | ${mode === 'judge' ? 'GPT-5.2 Judge' : 'Council'} | ${category === 'all' ? 'All categories' : categoryName(category)}`,
            `${summary.count} complete ${summary.count === 1 ? 'comparison' : 'comparisons'} in one configuration.`,
            ...Object.entries(summary.pairs).map(
                ([key, p]) =>
                    `${key === 'optimized' ? 'OffGrid AI Optimized vs Gemma 4 E4B' : 'OffGrid AI Advanced vs Gemma 4 26B A4B'}: ${p.wins} ${p.wins === 1 ? 'win' : 'wins'}, ${p.ties} ${p.ties === 1 ? 'tie' : 'ties'}, ${p.losses} ${p.losses === 1 ? 'loss' : 'losses'}${p.count ? `; mean score difference ${p.delta.total > 0 ? '+' : ''}${format(p.delta.total)} / 15` : ''}.`,
            ),
            `${summary.incomplete} incomplete ${summary.incomplete === 1 ? 'attempt' : 'attempts'} in this mode/category across configurations; excluded from wins and losses.`,
            'Score: 2 x Accuracy + 2 x Prioritization + 1 x Actionability. Relative rankings, not accuracy percentages.',
            'User-selected questions; browser-local, user-resettable statistics. Not an independently verified or held-out benchmark. Hosted results may differ from the offline ToolKit.',
            'https://offgridtoolkit.ai/open-arena',
        ].join('\n');
    }
    return {
        VERSION,
        CATEGORIES,
        KEYS,
        PAIRS,
        CRITERIA,
        safeCategory,
        categoryName,
        series,
        record,
        validateRecords,
        add,
        configurations,
        summarize,
        shareSummary,
    };
});

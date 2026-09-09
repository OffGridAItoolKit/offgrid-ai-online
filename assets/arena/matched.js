'use strict';

(() => {
    const $ = (id) => document.getElementById(id);
    const analytics = window.ArenaAnalytics;
    const statsKey = 'offgrid-matched-statistics-v2';
    const sessionKey = 'offgrid-matched-session-v2';
    const preferenceKey = 'offgrid-matched-remember-v2';
    const oldPilotKey = 'offgrid-matched-statistics-v1';
    const legacyKeys = [
        'offgrid-open-deep-mode-lifetime',
        'offgrid-open-deep-mode-data',
    ];
    const criteria = ['accuracy', 'prioritization', 'actionability'];
    const names = {
        optimized: 'OffGrid AI Optimized',
        e4b: 'Gemma 4 E4B',
        advanced: 'OffGrid AI Advanced',
        '26b': 'Gemma 4 26B A4B',
    };
    let config = null,
        accessKey = '',
        image = null,
        currentRun = null,
        controller = null;
    const runs = [],
        imageByRun = new Map();
    let sessionStats = [],
        lifetimeStats = [],
        remember = true;
    let selectedSeries = '',
        resetScope = null,
        activeSummary = null;
    const storageBlocked = { session: false, lifetime: false };
    const icons = () => window.lucide?.createIcons();
    const escape = (value) =>
        String(value ?? '').replace(
            /[&<>"']/g,
            (c) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                })[c],
        );
    const number = (n) =>
        Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const mode = () => $('history-mode').value;
    const modeName = (value) =>
        value === 'judge' ? 'GPT-5.2 Judge' : 'Council';
    const capitalize = (value) =>
        value.charAt(0).toUpperCase() + value.slice(1);
    function status(message, type = '') {
        $('status').textContent = message;
        $('status').className = `status ${type}`;
    }
    function download(data, filename) {
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json',
            }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const period = () =>
        document.querySelector('input[name="analytics-period"]:checked').value;
    const activeStats = () =>
        period() === 'session' ? sessionStats : lifetimeStats;
    const signed = (n) =>
        n === null ? '-' : `${n > 0 ? '+' : ''}${number(n)}`;
    function persistStats() {
        try {
            if (!storageBlocked.session)
                sessionStorage.setItem(
                    sessionKey,
                    JSON.stringify(sessionStats),
                );
            if (remember && !storageBlocked.lifetime)
                localStorage.setItem(statsKey, JSON.stringify(lifetimeStats));
            localStorage.setItem(preferenceKey, String(remember));
        } catch {
            status(
                'This browser could not save statistics. Your run is still available to export.',
                'error',
            );
        }
    }
    function renderStats() {
        const blocked = Object.keys(storageBlocked).filter(
            (key) => storageBlocked[key],
        );
        $('stats-storage-error').hidden = !blocked.length;
        $('stats-storage-error').textContent = blocked.length
            ? `Saved ${blocked.join(' and ')} statistics are unreadable or unavailable. Existing storage is preserved; new results remain in memory.`
            : '';
        const records = activeStats();
        const hasCouncil = records.some((r) => r.mode === 'council');
        $('history-mode-label').hidden = !hasCouncil;
        $('history-mode').hidden = !hasCouncil;
        if (!hasCouncil) $('history-mode').value = 'judge';
        const configs = analytics.configurations(records, mode());
        if (!configs.some((c) => c.id === selectedSeries))
            selectedSeries = configs[0]?.id || '';
        $('stats-config').innerHTML = configs.length
            ? configs
                  .map(
                      (c, i) =>
                          `<option value="${i}" ${c.id === selectedSeries ? 'selected' : ''}>${i + 1}. ${escape(new Date(c.first).toLocaleDateString())} / ${c.count} ${c.count === 1 ? 'run' : 'runs'}</option>`,
                  )
                  .join('')
            : '<option value="">No completed configuration</option>';
        $('stats-config').disabled = !configs.length;
        const filters = {
            mode: mode(),
            series: selectedSeries,
            category: $('stats-category').value,
        };
        const summary = analytics.summarize(records, filters);
        activeSummary = { summary, filters, scope: period() };
        $('stats-scope').textContent =
            `${modeName(mode())} / ${period() === 'session' ? 'this browser session' : 'lifetime on this device'}`;
        for (const key of ['optimized', 'advanced']) {
            const p = summary.pairs[key];
            $(`${key}-stats`).innerHTML = ['wins', 'ties', 'losses']
                .map(
                    (label) =>
                        `<div><strong>${p[label]}</strong><span>${label.toUpperCase()}</span></div>`,
                )
                .join('');
            $(`${key}-delta`).textContent = p.count
                ? `${Math.round(p.winRate * 100)}% wins / ${p.count} complete. Mean advantage ${signed(p.delta.total)} points.`
                : 'No complete comparisons in this selection.';
        }
        $('run-count').textContent = `${summary.count} complete`;
        $('incomplete-count').textContent =
            `${summary.incomplete} incomplete (all configs)`;
        $('stats-timing').textContent =
            summary.medianMs === null
                ? 'No timing data yet.'
                : `Median comparison: ${number(summary.medianMs / 1000)}s. Since ${new Date(summary.first).toLocaleDateString()}.`;
        $('share-stats').disabled = summary.count === 0;
        const categories = Object.entries(analytics.CATEGORIES).filter(
            ([key]) => filters.category === 'all' || key === filters.category,
        );
        $('category-strength').innerHTML = categories
            .map(([category, label]) => {
                const s = analytics.summarize(records, {
                    ...filters,
                    category,
                });
                return `<div class="category-result"><div class="category-title"><strong>${escape(label)}</strong><span>${s.count} ${s.count === 1 ? 'run' : 'runs'}${s.count > 0 && s.count < 10 ? ' / early sample' : ''}</span></div>${[
                    'optimized',
                    'advanced',
                ]
                    .map((key) => {
                        const p = s.pairs[key];
                        return `<div class="category-pair"><span class="${key}">${key === 'optimized' ? 'Optimized' : 'Advanced'}</span><span>${p.count ? `${p.wins}W / ${p.ties}T / ${p.losses}L` : 'Not tested'}</span><strong title="Mean weighted score difference">${signed(p.delta.total)}</strong></div>`;
                    })
                    .join('')}</div>`;
            })
            .join('');
        $('criterion-deltas').innerHTML = ['optimized', 'advanced']
            .map(
                (key) =>
                    `<div class="criterion-group"><strong class="${key}">${escape(names[key])}</strong>${criteria.map((c) => `<div><span>${capitalize(c)}</span><b>${signed(summary.pairs[key].delta[c])}</b></div>`).join('')}</div>`,
            )
            .join('');
        $('average-scores').innerHTML = Object.entries(summary.averages)
            .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
            .map(
                ([key, value]) =>
                    `<div class="average-row"><span class="${key}">${escape(names[key])}</span><strong>${value === null ? '-' : number(value)}</strong><meter min="0" max="15" value="${value || 0}" aria-label="Average score for ${escape(names[key])}"></meter></div>`,
            )
            .join('');
    }
    function addRun(run, attachedImage) {
        runs.unshift(run);
        if (attachedImage) imageByRun.set(run.id, attachedImage);
        // Statistics retain no question, answer, image, private key or grader reasoning text.
        const entry = analytics.record(run);
        sessionStats = analytics.add(sessionStats, entry);
        if (remember && !storageBlocked.lifetime) {
            try {
                lifetimeStats = analytics.validateRecords(
                    JSON.parse(localStorage.getItem(statsKey) || '[]'),
                );
            } catch {
                storageBlocked.lifetime = true;
                status(
                    'Saved lifetime statistics could not be read. Existing storage was preserved.',
                    'error',
                );
            }
        }
        lifetimeStats = analytics.add(lifetimeStats, entry);
        $('history-mode').value = run.mode;
        selectedSeries = '';
        persistStats();
        renderStats();
        $('history').replaceChildren();
        for (const item of runs) {
            const button = document.createElement('button');
            button.className = 'history-item';
            button.innerHTML = `${escape(item.prompt.slice(0, 110))}${item.prompt.length > 110 ? '...' : ''}<small>${escape(modeName(item.mode))} / ${escape(analytics.categoryName(item.category))} / ${item.status === 'complete' ? 'Complete' : 'Incomplete'} / ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>`;
            button.addEventListener('click', () => renderRun(item));
            $('history').append(button);
        }
        renderRun(run);
    }
    function renderMarkdown(text) {
        if (!window.marked || !window.DOMPurify)
            return `<pre>${escape(text)}</pre>`;
        // Prevent generated images/iframes from loading external trackers, and strip executable markup.
        return DOMPurify.sanitize(marked.parse(text), {
            FORBID_TAGS: [
                'img',
                'iframe',
                'video',
                'audio',
                'form',
                'input',
                'button',
                'style',
                'script',
                'svg',
                'math',
            ],
            FORBID_ATTR: ['style', 'id', 'name'],
        });
    }
    function answerElement(answer, run) {
        const score = run.scores?.[answer.key],
            ranked = run.ranking?.find((s) => s.key === answer.key);
        const winner = run.winners?.includes(answer.key);
        const article = document.createElement('article');
        article.className = `answer${winner ? ' winner' : ''}`;
        article.innerHTML = `<div class="answer-header"><div class="answer-title"><span class="place">${ranked ? '#' + ranked.place : '-'}</span><div><h3 class="${answer.conditioned ? answer.key : ''}">${escape(answer.name)}</h3><div class="answer-meta">${winner ? (run.winners.length > 1 ? 'Tied first / ' : 'Highest ranked / ') : ''}${answer.valid ? 'Original answer' : 'Incomplete'} / ${escape(answer.metadata?.provider || 'Provider unavailable')}</div></div></div><button class="icon-button copy-answer" title="Copy original answer" aria-label="Copy ${escape(answer.name)} answer"><i data-lucide="copy"></i></button></div>${score ? `<p class="score-line"><strong>${number(score.total)} / 15</strong> &nbsp; Accuracy ${number(score.accuracy)} &middot; Priority ${number(score.prioritization)} &middot; Action ${number(score.actionability)}</p>` : ''}<div class="answer-body">${answer.text ? renderMarkdown(answer.text) : `<p class="error">${escape(answer.error || 'No complete answer returned.')}</p>`}</div>`;
        const attempts = answer.metadata?.transport?.attempts?.length || 1;
        if (attempts > 1)
            article
                .querySelector('.answer-meta')
                .append(` / ${attempts} provider attempts`);
        if (!answer.valid && answer.text && answer.error) {
            const warning = document.createElement('p');
            warning.className = 'error';
            warning.textContent = answer.error;
            article.querySelector('.answer-body').before(warning);
        }
        article
            .querySelector('.copy-answer')
            .addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(answer.text);
                    status(`Copied ${answer.name}'s original answer.`);
                } catch {
                    status(
                        'Clipboard access was blocked. Export the run instead.',
                        'error',
                    );
                }
            });
        article.querySelectorAll('.answer-body a').forEach((a) => {
            a.rel = 'noopener noreferrer';
            a.target = '_blank';
        });
        return article;
    }
    function renderRun(run) {
        currentRun = run;
        $('results').hidden = false;
        $('result-mode').textContent =
            `${modeName(run.mode)} / ${analytics.categoryName(run.category)} / ${run.rosterVersion}`;
        $('category-assignment').textContent =
            `Category: ${analytics.categoryName(run.category)} / ${
                run.categorization?.source === 'automatic'
                    ? 'Automatic, question only'
                    : run.categorization?.source === 'manual'
                      ? 'Manually selected'
                      : run.categorization?.source === 'fallback'
                        ? 'Automatic categorization unavailable; General / Visual fallback'
                        : 'Earlier or unassigned category'
            }`;
        $('result-title').textContent =
            run.status !== 'complete'
                ? 'Incomplete comparison'
                : run.winners.length > 1
                  ? 'A tie at the top'
                  : 'Highest-ranked original answer';
        $('result-question').textContent = run.prompt;
        $('run-errors').hidden = !run.errors?.length;
        $('run-errors').textContent = (run.errors || []).join('\n');
        $('pair-results').innerHTML = (run.pairs || [])
            .map(
                (p) =>
                    `<div class="pair-result"><strong>${escape(names[p.conditioned])}</strong>: ${p.outcome === 'tie' ? 'tied its baseline' : p.outcome === 'win' ? 'ranked above its baseline' : 'ranked below its baseline'} (${p.delta > 0 ? '+' : ''}${number(p.delta)})</div>`,
            )
            .join('');
        $('winning-answers').replaceChildren();
        $('other-answer-list').replaceChildren();
        const ordered = run.ranking
            ? run.ranking.map((r) => run.answers.find((a) => a.key === r.key))
            : run.answers;
        let others = 0;
        for (const answer of ordered) {
            const primary =
                run.status !== 'complete' || run.winners.includes(answer.key);
            $(primary ? 'winning-answers' : 'other-answer-list').append(
                answerElement(answer, run),
            );
            if (!primary) others++;
        }
        $('other-answers').hidden = others === 0;
        $('other-answers').open = false;
        $('other-count').textContent = `(${others})`;
        icons();
    }
    function showReport() {
        if (!currentRun) return;
        const run = currentRun;
        let html = `<p>${escape(modeName(run.mode))} / ${escape(run.status)}. Score = 2 x Accuracy + 2 x Prioritization + 1 x Actionability.</p>`;
        if (run.mode === 'council')
            html +=
                '<p>Council scores average four votes on a 0-15 scale. Two E4B and two 26B seats use the identical rubric; they are not four independent judging families.</p>';
        if (run.ranking)
            html += `<div class="table-scroll"><table class="report-table"><thead><tr><th>Place / Model</th><th>Accuracy</th><th>Priority</th><th>Action</th><th>Total</th></tr></thead><tbody>${run.ranking.map((s) => `<tr><td>#${s.place} ${escape(names[s.key])}</td><td>${number(s.accuracy)}</td><td>${number(s.prioritization)}</td><td>${number(s.actionability)}</td><td><strong>${number(s.total)}</strong></td></tr>`).join('')}</tbody></table></div>`;
        for (const review of run.reviews) {
            html += `<h3>${escape(review.reviewer)}</h3>`;
            if (review.valid === false) {
                html += `<p class="error">${escape(review.error || 'Invalid review. No scores awarded.')}</p><details><summary>Original incomplete review</summary><pre>${escape(review.rawText || 'No response returned.')}</pre></details>`;
                continue;
            }
            for (const [label, key] of Object.entries(review.labelMap))
                html += `<div class="reason"><strong>${escape(names[key])} (anonymous ${escape(label)})</strong>${criteria.map((c) => `<p><b>${capitalize(c)}:</b> ${escape(review.reasons[label][c])}</p>`).join('')}</div>`;
            html += `<details><summary>Anonymous rankings and provider record</summary><pre>${escape(JSON.stringify({ rankings: review.rankings, labelMap: review.labelMap, metadata: review.metadata }, null, 2))}</pre></details>`;
        }
        html += `<details><summary>Run and model records</summary><pre>${escape(JSON.stringify({ id: run.id, seed: run.seed, gradingProtocol: run.gradingProtocol, promptVersion: run.promptVersion, promptDigest: run.promptDigest, rubricVersion: run.rubricVersion, rubricDigest: run.rubricDigest, validationVersion: run.validationVersion || 'initial-validation', reliabilityVersion: run.reliabilityVersion || 'single-attempt-v1', answers: run.answers.map((a) => ({ key: a.key, finishReason: a.finishReason, matched: a.matched, error: a.error, metadata: a.metadata })), errors: run.errors }, null, 2))}</pre></details>`;
        $('report-content').innerHTML = html;
        $('report-dialog').showModal();
    }
    function busy(on) {
        $('run-button').hidden = on;
        $('cancel-button').hidden = !on;
        for (const id of [
            'question',
            'sample',
            'attach-button',
            'remove-image',
            'new-button',
            'category',
        ])
            $(id).disabled = on;
        $('run-button').disabled = !config?.ready;
        $('scoring-judge').disabled = on;
        $('scoring-council').disabled =
            on || !config?.scoringModes?.includes('council');
    }
    async function submit(event) {
        event.preventDefault();
        if (controller || !config?.ready) return;
        if (config.privatePilot !== false && !accessKey) {
            $('settings-dialog').showModal();
            $('access-key').focus();
            return;
        }
        const attachedImage = image;
        const payload = {
            prompt: $('question').value,
            mode: $('scoring-council').checked ? 'council' : 'judge',
            image: attachedImage,
            category: $('category').value,
        };
        controller = new AbortController();
        busy(true);
        status(
            'Starting the comparison. The E4B GPU may need a cold start.',
            'busy',
        );
        let gotResult = false,
            started = false;
        let resolvedCategory =
            payload.category === 'auto'
                ? null
                : {
                      category: payload.category,
                      source: 'manual',
                      version: 'manual-v1',
                  };
        const startedAt = Date.now();
        try {
            const response = await fetch('/api/open-arena/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-OffGrid-Client': 'matched-open-arena',
                    ...(config.privatePilot !== false
                        ? { 'X-Arena-Access': accessKey }
                        : {}),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (!response.ok)
                throw new Error(
                    (await response.json()).error ||
                        'The comparison could not start.',
                );
            started = true;
            const reader = response.body.getReader(),
                decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let split;
                while ((split = buffer.indexOf('\n\n')) >= 0) {
                    const packet = buffer.slice(0, split);
                    buffer = buffer.slice(split + 2);
                    if (!packet.startsWith('data: ')) continue;
                    const data = JSON.parse(packet.slice(6));
                    if (data.type === 'progress') {
                        if (data.stage === 'category')
                            resolvedCategory = data.categorization;
                        status(data.message, 'busy');
                    } else if (data.type === 'error')
                        throw new Error(data.error);
                    else if (data.type === 'result') {
                        gotResult = true;
                        addRun(data.run, attachedImage);
                    }
                }
            }
            if (!gotResult)
                throw new Error(
                    'Connection ended before a result arrived. No win was recorded.',
                );
            status(
                currentRun.status === 'complete'
                    ? `Comparison complete in ${Math.round(currentRun.elapsedMs / 1000)} seconds.`
                    : 'Incomplete run retained for inspection. No wins or losses recorded.',
                currentRun.status === 'complete' ? '' : 'error',
            );
        } catch (error) {
            if (started && !gotResult)
                addRun(
                    {
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        mode: payload.mode,
                        category: resolvedCategory?.category || 'general',
                        categorization: resolvedCategory || {
                            source: 'unassigned',
                            version: 'unassigned',
                        },
                        prompt: payload.prompt,
                        rosterVersion: config.rosterVersion,
                        status: 'incomplete',
                        answers: [],
                        reviews: [],
                        errors: [
                            error.name === 'AbortError'
                                ? 'Cancelled before a complete result reached this browser.'
                                : 'Connection failed before a complete result reached this browser.',
                        ],
                        elapsedMs: Date.now() - startedAt,
                    },
                    attachedImage,
                );
            status(
                error.name === 'AbortError'
                    ? 'Cancelled. No win recorded; an in-flight provider call may still be billed.'
                    : error.message,
                'error',
            );
        } finally {
            controller = null;
            busy(false);
        }
    }
    $('question-form').addEventListener('submit', submit);
    $('cancel-button').addEventListener('click', () => controller?.abort());
    $('settings-button').addEventListener('click', () =>
        $('settings-dialog').showModal(),
    );
    $('method-button').addEventListener('click', () =>
        $('method-dialog').showModal(),
    );
    $('review-button').addEventListener('click', showReport);
    document
        .querySelectorAll('.close-dialog')
        .forEach((button) =>
            button.addEventListener('click', () =>
                button.closest('dialog').close(),
            ),
        );
    $('access-form').addEventListener('submit', (event) => {
        event.preventDefault();
        accessKey = $('access-key').value.trim();
        $('access-key').value = '';
        $('settings-dialog').close();
        status(
            accessKey ? 'Pilot key set for this page.' : 'Pilot key cleared.',
        );
    });
    $('new-button').addEventListener('click', () => {
        $('question').value = '';
        $('question').dispatchEvent(new Event('input'));
        $('remove-image').click();
        $('sample').value = '';
        $('category').value = 'auto';
        $('results').hidden = true;
        $('question').focus();
    });
    $('question').addEventListener(
        'input',
        () =>
            ($('char-count').textContent =
                `${$('question').value.length.toLocaleString()} / 4,000`),
    );
    $('history-mode').addEventListener('change', () => {
        selectedSeries = '';
        renderStats();
    });
    $('sample').addEventListener('change', () => {
        const samples = {
            water: 'Our well pump stopped during a power outage. Two adults have 4 liters of drinking water, a camping stove, a metal pot, and access to a nearby stream. No cellular service. What should we do first over the next 24 hours?',
            vehicle:
                'My vehicle will not start on a remote gravel road. The lights come on but I hear rapid clicking. I have a multimeter, basic tools, water and a charged phone with no signal. What is the best troubleshooting order?',
            shelter:
                'Two adults are camping in wet, windy weather, around 40 F. One is shivering after their sleeping bag got soaked. We have a tarp, two foam pads, dry spare clothes, cord and a stove. What should we do first?',
            navigation:
                'I have lost a marked trail in a wooded area. It is two hours before sunset. I have a paper map, compass, charged phone with no service, headlamp, water and a light rain jacket. What should I do first?',
            planning:
                'Two adults are preparing for a 48-hour power outage at home. We have drinking water, canned food, flashlights, blankets and a gas stove. What should we prioritize before the power goes out?',
            medical:
                'Two adults are preparing a first-aid kit for a three-day remote camping trip. Space is limited and help may be several hours away. What are the most useful essentials and how should we organize them?',
        };
        if (samples[$('sample').value]) {
            $('question').value = samples[$('sample').value];
            $('category').value = 'auto';
            $('question').dispatchEvent(new Event('input'));
        }
    });
    $('attach-button').addEventListener('click', () =>
        $('image-input').click(),
    );
    $('remove-image').addEventListener('click', () => {
        image = null;
        $('image-input').value = '';
        $('image-preview').removeAttribute('src');
        $('attachment').hidden = true;
    });
    $('image-input').addEventListener('change', async () => {
        const file = $('image-input').files[0];
        if (!file) return;
        if (
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
            file.size > 2 * 1024 * 1024
        ) {
            status('Choose a JPEG, PNG or WebP image under 2 MB.', 'error');
            $('image-input').value = '';
            return;
        }
        try {
            image = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(file);
            });
            $('image-preview').src = image;
            $('image-name').textContent = file.name;
            $('attachment').hidden = false;
        } catch {
            status('The image could not be read.', 'error');
        }
    });
    $('remember-stats').addEventListener('change', () => {
        remember = $('remember-stats').checked;
        if (!remember && !storageBlocked.lifetime) {
            try {
                localStorage.removeItem(statsKey);
            } catch {
                status('Browser storage is unavailable.', 'error');
            }
        }
        persistStats();
    });
    document
        .querySelectorAll('input[name="analytics-period"]')
        .forEach((input) =>
            input.addEventListener('change', () => {
                selectedSeries = '';
                renderStats();
            }),
        );
    $('stats-config').addEventListener('change', () => {
        selectedSeries =
            analytics.configurations(activeStats(), mode())[
                Number($('stats-config').value)
            ]?.id || '';
        renderStats();
    });
    $('stats-category').addEventListener('change', renderStats);
    for (const scope of ['session', 'lifetime'])
        $(`reset-${scope}`).addEventListener('click', () => {
            resetScope = scope;
            $('reset-heading').textContent = `Reset ${scope} statistics?`;
            $('reset-message').textContent =
                `This clears ${scope} counts for all categories, configurations and scoring modes on this browser. ${scope === 'session' ? 'Lifetime' : 'Session'} counts, original answers currently open, legacy Arena history and server spending allowances are unchanged. Export analytics first to retain a record.`;
            $('reset-dialog').showModal();
        });
    $('confirm-reset').addEventListener('click', () => {
        if (!resetScope) return;
        if (resetScope === 'session') sessionStats = [];
        else lifetimeStats = [];
        storageBlocked[resetScope] = false;
        try {
            (resetScope === 'session'
                ? sessionStorage
                : localStorage
            ).removeItem(resetScope === 'session' ? sessionKey : statsKey);
        } catch {
            status('Browser storage could not be cleared.', 'error');
        }
        persistStats();
        renderStats();
        $('reset-dialog').close();
        resetScope = null;
    });
    $('analytics-toggle').addEventListener('click', () => {
        const show = $('deep-analytics').hidden;
        $('deep-analytics').hidden = !show;
        $('workspace').classList.toggle('analytics-hidden', !show);
        $('analytics-toggle').setAttribute('aria-expanded', String(show));
        if (show && window.innerWidth <= 800)
            $('deep-analytics').scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
    });
    $('share-stats').addEventListener('click', () => {
        const { summary, filters, scope } = activeSummary;
        $('share-text').textContent = analytics.shareSummary(summary, {
            ...filters,
            scope,
        });
        $('copy-summary').innerHTML = '<i data-lucide="copy"></i> Copy summary';
        icons();
        $('share-dialog').showModal();
    });
    $('copy-summary').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText($('share-text').textContent);
            $('copy-summary').textContent = 'Copied';
        } catch {
            status(
                'Clipboard access blocked. Export analytics instead.',
                'error',
            );
        }
    });
    $('export-stats').addEventListener('click', () => {
        download(
            {
                schemaVersion: analytics.VERSION,
                source: 'browser-local, user-resettable',
                exportedAt: new Date().toISOString(),
                scope: period(),
                selection: activeSummary.filters,
                summary: activeSummary.summary,
                records: activeStats(),
                limitations:
                    'User-selected questions, not a held-out or independently verified benchmark. No question or answer text included. Records include all modes/categories/configurations in the selected period; the summary uses the stated filters.',
            },
            `offgrid-analytics-${period()}-${new Date().toISOString().slice(0, 10)}.json`,
        );
    });
    $('pilot-export').addEventListener('click', () =>
        download(
            {
                historical: true,
                source: 'earlier pilot v1',
                raw: localStorage.getItem(oldPilotKey),
            },
            'offgrid-earlier-pilot-statistics.json',
        ),
    );
    $('export-button').addEventListener('click', () => {
        if (currentRun)
            download(
                {
                    ...currentRun,
                    image: $('export-image').checked
                        ? imageByRun.get(currentRun.id) || null
                        : undefined,
                    imageIncluded: !!(
                        $('export-image').checked &&
                        imageByRun.get(currentRun.id)
                    ),
                },
                `offgrid-arena-${currentRun.id}.json`,
            );
    });
    $('legacy-export').addEventListener('click', () => {
        const legacy = {};
        for (const key of legacyKeys) {
            const raw =
                localStorage.getItem(key) || sessionStorage.getItem(key);
            if (raw) {
                try {
                    legacy[key] = JSON.parse(raw);
                } catch {
                    legacy[key] = raw;
                }
            }
        }
        download(
            { historical: true, notMatchedPairEvidence: true, legacy },
            'offgrid-arena-historical.json',
        );
    });
    for (const scope of ['session', 'lifetime']) {
        try {
            const storage = scope === 'session' ? sessionStorage : localStorage;
            const saved = JSON.parse(
                storage.getItem(scope === 'session' ? sessionKey : statsKey) ||
                    '[]',
            );
            const records = analytics.validateRecords(saved);
            if (scope === 'session') sessionStats = records;
            else lifetimeStats = records;
        } catch {
            storageBlocked[scope] = true;
            status(
                `Saved ${scope} statistics could not be read. Existing storage was preserved.`,
                'error',
            );
        }
    }
    try {
        remember = localStorage.getItem(preferenceKey) !== 'false';
        $('legacy-export').hidden = !legacyKeys.some(
            (k) => localStorage.getItem(k) || sessionStorage.getItem(k),
        );
        $('pilot-export').hidden = !localStorage.getItem(oldPilotKey);
    } catch {
        /* Storage-disabled browsers still support in-memory comparisons. */
    }
    $('remember-stats').checked = remember;
    window.addEventListener('storage', (event) => {
        if (event.key !== statsKey || !remember) return;
        try {
            lifetimeStats = analytics.validateRecords(
                JSON.parse(event.newValue || '[]'),
            );
            storageBlocked.lifetime = false;
            renderStats();
        } catch {
            storageBlocked.lifetime = true;
            status(
                'Lifetime statistics changed in another tab but could not be read.',
                'error',
            );
        }
    });
    const categoryOptions = Object.entries(analytics.CATEGORIES)
        .map(
            ([key, label]) =>
                `<option value="${key}">${escape(label)}</option>`,
        )
        .join('');
    $('category').innerHTML =
        '<option value="auto">Automatic (question context)</option>' +
        categoryOptions;
    $('category').value = 'auto';
    $('stats-category').innerHTML =
        '<option value="all">All categories</option>' + categoryOptions;
    icons();
    renderStats();
    busy(false);
    fetch('/api/open-arena/config')
        .then(async (response) => {
            if (!response.ok) throw new Error();
            return response.json();
        })
        .then((data) => {
            config = data;
            const privateAccess = data.privatePilot !== false;
            $('access-form').hidden = !privateAccess;
            $('access-badge').textContent = privateAccess
                ? 'PRIVATE PILOT'
                : 'RESEARCH PREVIEW';
            $('settings-heading').textContent = privateAccess
                ? 'Pilot Access'
                : 'Privacy & Exports';
            const settingsLabel = privateAccess
                ? 'Pilot access and privacy'
                : 'Privacy and exports';
            $('settings-button').title = settingsLabel;
            $('settings-button').setAttribute('aria-label', settingsLabel);
            $('privacy').textContent = data.privacy;
            $('grader-prompt').textContent = data.graderPrompt;
            status(
                data.ready
                    ? `${privateAccess ? 'Pilot ready.' : 'Ready.'} Each question is evaluated independently.`
                    : data.issues.join(' '),
            );
            busy(false);
        })
        .catch(() =>
            status(
                'Pilot connection unavailable. Please reload after the server is ready.',
                'error',
            ),
        );
})();

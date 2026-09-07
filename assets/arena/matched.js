'use strict';

(() => {
    const $ = (id) => document.getElementById(id);
    const statsKey = 'offgrid-matched-statistics-v1';
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
    let stats = [],
        remember = false;
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
    const mode = () =>
        document.querySelector('input[name="mode"]:checked').value;
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
    function series(run) {
        const settings = (value) =>
            Object.fromEntries(
                Object.entries(value || {}).filter(([key]) => key !== 'seed'),
            );
        return JSON.stringify([
            run.rosterVersion,
            run.rubricDigest,
            run.promptDigest,
            run.settings,
            run.answers
                .map((a) => [
                    a.key,
                    a.model,
                    a.metadata?.providerRoute || a.metadata?.provider,
                    a.metadata?.runtime,
                    a.metadata?.artifactDigest,
                    settings(a.metadata?.settings),
                ])
                .sort((a, b) => a[0].localeCompare(b[0])),
            run.reviews
                .map((r) => [
                    r.reviewer,
                    r.model,
                    r.metadata?.providerRoute || r.metadata?.provider,
                    r.metadata?.runtime,
                    r.metadata?.artifactDigest,
                    settings(r.metadata?.settings),
                ])
                .sort((a, b) => a[0].localeCompare(b[0])),
        ]);
    }
    function persistStats() {
        try {
            if (remember) localStorage.setItem(statsKey, JSON.stringify(stats));
            else localStorage.removeItem(statsKey);
        } catch {
            status(
                'This browser could not save statistics. Your run is still available to export.',
                'error',
            );
        }
    }
    function renderStats() {
        const activeSeries =
            [...stats]
                .reverse()
                .find((s) => s.mode === mode() && s.status === 'complete')
                ?.series || null;
        $('stats-scope').textContent =
            `${modeName(mode())} / ${activeSeries ? 'latest configuration' : 'no completed configuration yet'}`;
        const eligible = stats.filter(
            (s) => s.mode === mode() && s.series === activeSeries,
        );
        for (const key of ['optimized', 'advanced']) {
            const counts = { win: 0, tie: 0, loss: 0 };
            for (const s of eligible.filter((s) => s.status === 'complete')) {
                const pair = s.pairs.find((p) => p.conditioned === key);
                if (pair && pair.outcome in counts) counts[pair.outcome]++;
            }
            $(`${key}-stats`).innerHTML = Object.entries(counts)
                .map(
                    ([label, value]) =>
                        `<div><strong>${value}</strong><span>${label === 'loss' ? 'LOSSES' : label.toUpperCase() + 'S'}</span></div>`,
                )
                .join('');
        }
        $('run-count').textContent =
            `${eligible.filter((s) => s.status === 'complete').length} complete runs`;
        $('incomplete-count').textContent =
            `${stats.filter((s) => s.mode === mode() && s.status !== 'complete').length} incomplete (all configs)`;
    }
    function addRun(run, attachedImage) {
        runs.unshift(run);
        if (attachedImage) imageByRun.set(run.id, attachedImage);
        // Statistics retain no question, answer, image, private key or grader reasoning text.
        const fingerprint = run.status === 'complete' ? series(run) : null;
        stats.push({
            id: run.id,
            mode: run.mode,
            status: run.status,
            series: fingerprint,
            pairs: run.pairs || [],
            date: run.createdAt,
        });
        persistStats();
        renderStats();
        $('history').replaceChildren();
        for (const item of runs) {
            const button = document.createElement('button');
            button.className = 'history-item';
            button.innerHTML = `${escape(item.prompt.slice(0, 110))}${item.prompt.length > 110 ? '...' : ''}<small>${escape(modeName(item.mode))} / ${item.status === 'complete' ? 'Complete' : 'Incomplete'} / ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>`;
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
            `${modeName(run.mode)} / ${run.rosterVersion}`;
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
        html += `<details><summary>Run and model records</summary><pre>${escape(JSON.stringify({ id: run.id, seed: run.seed, promptVersion: run.promptVersion, promptDigest: run.promptDigest, rubricVersion: run.rubricVersion, rubricDigest: run.rubricDigest, answers: run.answers.map((a) => ({ key: a.key, finishReason: a.finishReason, metadata: a.metadata })), errors: run.errors }, null, 2))}</pre></details>`;
        $('report-content').innerHTML = html;
        $('report-dialog').showModal();
    }
    function busy(on) {
        $('run-button').hidden = on;
        $('cancel-button').hidden = !on;
        for (const id of [
            'question',
            'mode-control',
            'sample',
            'attach-button',
            'remove-image',
            'new-button',
        ])
            $(id).disabled = on;
        $('run-button').disabled = !config?.ready;
    }
    async function submit(event) {
        event.preventDefault();
        if (controller || !config?.ready) return;
        if (!accessKey) {
            $('settings-dialog').showModal();
            $('access-key').focus();
            return;
        }
        const attachedImage = image;
        const payload = {
            prompt: $('question').value,
            mode: mode(),
            image: attachedImage,
        };
        controller = new AbortController();
        busy(true);
        status(
            'Starting the comparison. The E4B GPU may need a cold start.',
            'busy',
        );
        let gotResult = false;
        try {
            const response = await fetch('/api/arena-open/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-OffGrid-Client': 'open-arena',
                    'X-Arena-Access': accessKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (!response.ok)
                throw new Error(
                    (await response.json()).error ||
                        'The comparison could not start.',
                );
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
                    if (data.type === 'progress') status(data.message, 'busy');
                    else if (data.type === 'error') throw new Error(data.error);
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
        $('results').hidden = true;
        $('question').focus();
    });
    $('question').addEventListener(
        'input',
        () =>
            ($('char-count').textContent =
                `${$('question').value.length.toLocaleString()} / 4,000`),
    );
    document
        .querySelectorAll('input[name="mode"]')
        .forEach((input) => input.addEventListener('change', renderStats));
    $('sample').addEventListener('change', () => {
        const samples = {
            water: 'Our well pump stopped during a power outage. Two adults have 4 liters of drinking water, a camping stove, a metal pot, and access to a nearby stream. No cellular service. What should we do first over the next 24 hours?',
            vehicle:
                'My vehicle will not start on a remote gravel road. The lights come on but I hear rapid clicking. I have a multimeter, basic tools, water and a charged phone with no signal. What is the best troubleshooting order?',
            shelter:
                'Two adults are camping in wet, windy weather, around 40 F. One is shivering after their sleeping bag got soaked. We have a tarp, two foam pads, dry spare clothes, cord and a stove. What should we do first?',
        };
        if (samples[$('sample').value]) {
            $('question').value = samples[$('sample').value];
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
        persistStats();
    });
    $('clear-stats').addEventListener('click', () => {
        if (
            confirm(
                'Clear statistics for the new matched-pair series? Original answers in this session and legacy Arena history will remain.',
            )
        ) {
            stats = [];
            persistStats();
            renderStats();
        }
    });
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
    try {
        const saved = JSON.parse(localStorage.getItem(statsKey) || 'null');
        if (Array.isArray(saved)) {
            stats = saved.filter(
                (s) =>
                    s &&
                    ['judge', 'council'].includes(s.mode) &&
                    Array.isArray(s.pairs),
            );
            remember = true;
        }
        $('remember-stats').checked = remember;
        $('legacy-export').hidden = !legacyKeys.some(
            (k) => localStorage.getItem(k) || sessionStorage.getItem(k),
        );
    } catch {
        status(
            'Saved statistics could not be read. Historical data has not been changed.',
            'error',
        );
    }
    icons();
    renderStats();
    busy(false);
    fetch('/api/arena-open/config')
        .then(async (response) => {
            if (!response.ok) throw new Error();
            return response.json();
        })
        .then((data) => {
            config = data;
            $('privacy').textContent = data.privacy;
            $('grader-prompt').textContent = data.graderPrompt;
            status(
                data.ready
                    ? 'Pilot ready. Each question is evaluated independently.'
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

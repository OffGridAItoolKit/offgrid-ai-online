'use strict';
// Requires the loopback-only fixture server on 3108. Never calls real providers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../test-results');
const publicAccess = process.argv.includes('--public');
const readyText = `${publicAccess ? 'Ready.' : 'Pilot ready.'} Each question is evaluated independently.`;
(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
    });
    try {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
            permissions: ['clipboard-read', 'clipboard-write'],
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto('http://127.0.0.1:3108/open-arena');
        await page.getByText(readyText, { exact: true }).waitFor();
        assert.equal(await page.locator('input[name="mode"]').count(), 0);
        assert.equal(await page.locator('#history-mode').isVisible(), false);
        assert.equal(await page.locator('#category').inputValue(), 'auto');
        if (publicAccess) {
            assert.equal(await page.locator('#access-form').isVisible(), false);
            assert.equal(
                await page.locator('#access-badge').textContent(),
                'RESEARCH PREVIEW',
            );
            await page
                .getByRole('button', {
                    name: 'Privacy and exports',
                    exact: true,
                })
                .click();
            assert.equal(
                await page
                    .getByRole('textbox', {
                        name: 'Private pilot key',
                        exact: true,
                    })
                    .isVisible(),
                false,
            );
            await page
                .getByRole('button', { name: 'Close', exact: true })
                .click();
        } else {
            await page
                .getByRole('button', {
                    name: 'Pilot access and privacy',
                    exact: true,
                })
                .click();
            await page
                .getByRole('textbox', {
                    name: 'Private pilot key',
                    exact: true,
                })
                .fill('browser-access-test-only');
            await page
                .getByRole('button', { name: 'Use key', exact: true })
                .click();
        }
        page.on('request', (request) => {
            if (request.url().endsWith('/api/open-arena/run'))
                assert.equal(request.postDataJSON().mode, 'judge');
            if (publicAccess && request.url().endsWith('/api/open-arena/run'))
                assert.equal(request.headers()['x-arena-access'], undefined);
        });
        const compare = async (prompt, category) => {
            await page
                .getByRole('textbox', { name: 'Your scenario', exact: true })
                .fill(prompt);
            await page
                .getByRole('combobox', {
                    name: 'Scenario category',
                    exact: true,
                })
                .selectOption(category);
            await page
                .getByRole('button', { name: 'Compare answers', exact: true })
                .click();
            await page
                .getByRole('button', { name: 'Cancel', exact: true })
                .waitFor({ state: 'hidden' });
        };
        await compare('tie retry fixture first', 'water');
        assert.equal(
            await page
                .locator('.answer-meta')
                .filter({ hasText: '2 provider attempts' })
                .count(),
            2,
        );
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        assert.equal(await page.locator('#results article').count(), 4);
        assert.ok(
            (await page.locator('#category-strength').innerText()).includes(
                '1 run / early sample',
            ),
        );
        await page
            .getByRole('radio', { name: 'Lifetime', exact: true })
            .check();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('button', {
                name: 'Reset session statistics',
                exact: true,
            })
            .click();
        await page
            .getByRole('button', { name: 'Reset statistics', exact: true })
            .click();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page.getByRole('radio', { name: 'Session', exact: true }).check();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '0 complete',
        );
        await compare('tie fixture second', 'repairs');
        await page
            .getByRole('radio', { name: 'Lifetime', exact: true })
            .check();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '2 complete',
        );
        await page
            .getByRole('combobox', { name: 'Analytics category', exact: true })
            .selectOption('water');
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('combobox', { name: 'Analytics category', exact: true })
            .selectOption('all');
        await page
            .getByRole('button', {
                name: 'Reset lifetime statistics',
                exact: true,
            })
            .click();
        await page
            .getByRole('button', { name: 'Reset statistics', exact: true })
            .click();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '0 complete',
        );
        await page.getByRole('radio', { name: 'Session', exact: true }).check();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await compare('incomplete fixture', 'medical');
        assert.match(
            await page.locator('#results').innerText(),
            /Answer reached the output limit and was cut short/,
        );
        assert.match(
            await page
                .locator('#results article')
                .filter({ hasText: 'Gemma 4 E4B' })
                .innerText(),
            /Not graded/,
        );
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        assert.equal(
            await page.locator('#incomplete-count').textContent(),
            '1 incomplete (all configs)',
        );
        // Seed only this isolated test browser with a historical record, never a new Council run.
        await page.evaluate(() => {
            const session = JSON.parse(
                sessionStorage.getItem('offgrid-matched-session-v2'),
            );
            const original = session.find((r) => r.status === 'complete');
            const legacy = {
                ...original,
                id: 'historical-council-fixture',
                mode: 'council',
                category: 'navigation',
                series: 'historical-council-fixture',
            };
            sessionStorage.setItem(
                'offgrid-matched-session-v2',
                JSON.stringify([...session, legacy]),
            );
            const lifetime = JSON.parse(
                localStorage.getItem('offgrid-matched-statistics-v2'),
            );
            localStorage.setItem(
                'offgrid-matched-statistics-v2',
                JSON.stringify([...lifetime, legacy]),
            );
        });
        await page.reload();
        await page.getByText(readyText, { exact: true }).waitFor();
        await page
            .getByRole('combobox', { name: 'Scoring history', exact: true })
            .selectOption('council');
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('combobox', { name: 'Scoring history', exact: true })
            .selectOption('judge');
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('button', { name: 'Share results summary', exact: true })
            .click();
        const share = await page.locator('#share-text').textContent();
        assert.ok(share.includes('1 complete comparison'));
        assert.ok(share.includes('user-resettable'));
        await page
            .getByRole('button', { name: 'Copy summary', exact: true })
            .click();
        assert.equal(
            (await page.evaluate(() => navigator.clipboard.readText())).replace(
                /\r\n/g,
                '\n',
            ),
            share,
        );
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        const downloadReady = page.waitForEvent('download');
        await page
            .getByRole('button', { name: 'Export analytics', exact: true })
            .click();
        const download = await downloadReady;
        const exportPath = path.join(output, 'analytics-fixture-export.json');
        await download.saveAs(exportPath);
        const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'));
        assert.equal(exported.summary.count, 1);
        assert.equal(exported.records.length, 3);
        assert.ok(
            !JSON.stringify(exported).includes('browser-access-test-only'),
        );
        assert.ok(!JSON.stringify(exported).includes('Private question'));
        assert.ok(
            exported.records.every(
                (r) => !('prompt' in r) && !('answers' in r),
            ),
        );
        await page.reload();
        await page.getByText(readyText, { exact: true }).waitFor();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('radio', { name: 'Lifetime', exact: true })
            .check();
        assert.equal(
            await page.locator('#run-count').textContent(),
            '0 complete',
        );
        await page
            .getByRole('combobox', { name: 'Scoring history', exact: true })
            .selectOption('council');
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('button', { name: 'Toggle Deep Analytics', exact: true })
            .click();
        assert.equal(await page.locator('#deep-analytics').isVisible(), false);
        await page
            .getByRole('button', { name: 'Toggle Deep Analytics', exact: true })
            .click();
        assert.equal(await page.locator('#deep-analytics').isVisible(), true);
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({
                width,
                height: width > 800 ? 1000 : 844,
            });
            await page.screenshot({
                path: path.join(output, `analytics-${width}.png`),
                fullPage: true,
            });
            assert.ok(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <= innerWidth + 1,
                ),
                `Overflow at ${width}`,
            );
            const clipped = await page
                .locator('button, h1, h2, h3, .category-pair')
                .evaluateAll((elements) =>
                    elements
                        .filter(
                            (el) =>
                                el.getClientRects().length &&
                                el.scrollWidth > el.clientWidth + 2,
                        )
                        .map((el) => el.textContent),
                );
            assert.deepEqual(clipped, [], `Clipped controls at ${width}`);
        }
        if (!publicAccess) {
            await page
                .getByRole('button', {
                    name: 'Pilot access and privacy',
                    exact: true,
                })
                .click();
            await page
                .getByRole('textbox', {
                    name: 'Private pilot key',
                    exact: true,
                })
                .fill('browser-access-test-only');
            await page
                .getByRole('button', { name: 'Use key', exact: true })
                .click();
        }
        // A new run while viewing historical Council statistics must still use the outside judge.
        await compare('How can I bake bread over a campfire?', 'auto');
        assert.equal(await page.locator('#history-mode').inputValue(), 'judge');
        assert.match(
            await page.locator('#category-assignment').innerText(),
            /Water & Food \/ Automatic, question only/,
        );
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await compare(
            'What are medicinal plants and dangerous look-alikes?',
            'auto',
        );
        assert.match(
            await page.locator('#category-assignment').innerText(),
            /Medical & First Aid \/ Automatic/,
        );
        await compare('How can I bake bread over a campfire?', 'shelter');
        assert.match(
            await page.locator('#category-assignment').innerText(),
            /Shelter & Exposure \/ Manually selected/,
        );
        await compare('category-failure fixture', 'auto');
        assert.match(
            await page.locator('#category-assignment').innerText(),
            /fallback/,
        );
        assert.equal(
            await page.locator('#run-count').textContent(),
            '4 complete',
        );
        assert.equal(
            await page.locator('#incomplete-count').textContent(),
            '1 incomplete (all configs)',
        );
        await page
            .getByRole('combobox', { name: 'Scoring history', exact: true })
            .selectOption('council');
        assert.equal(
            await page.locator('#run-count').textContent(),
            '1 complete',
        );
        await page
            .getByRole('combobox', { name: 'Scoring history', exact: true })
            .selectOption('judge');
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({
                width,
                height: width > 800 ? 1000 : 844,
            });
            assert.ok(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <= innerWidth + 1,
                ),
            );
            await page.screenshot({
                path: path.join(output, `categories-${width}.png`),
                fullPage: true,
            });
        }
        assert.deepEqual(errors, []);
        console.log(
            'Browser passed: judge-only new runs, historical Council preserved, automatic/manual/fallback categories, independent resets, persistence, sharing/export and 1440/390/320px layouts. Synthetic fixtures only.',
        );
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

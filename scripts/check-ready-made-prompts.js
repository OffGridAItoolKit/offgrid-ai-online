'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'ready-made-prompts-online.js');
const promptPagePath = path.join(root, 'ready-made-prompts.html');
const onlinePagePath = path.join(root, 'index.html');

const dataSource = fs.readFileSync(dataPath, 'utf8');
const promptPage = fs.readFileSync(promptPagePath, 'utf8');
const onlinePage = fs.readFileSync(onlinePagePath, 'utf8');

const context = { window: {} };
vm.runInNewContext(dataSource, context, { filename: dataPath });
const library = context.window.OFFGRID_ONLINE_PROMPT_LIBRARY;

assert.ok(library, 'Online prompt library was not exported.');
assert.equal(library.version, '2026-08-07.intel-1', 'Unexpected Intel catalog version.');
assert.equal(library.source.url, 'https://intel.offgridaitoolkit.com/resources/ready-made-prompts.html');
assert.match(library.source.sha256, /^[a-f0-9]{64}$/);
assert.equal(library.categories.length, 9, 'The Intel catalog must keep 9 categories.');

const expectedCategories = [
    ['Survival & Emergency Prep', 10, 260],
    ['Homesteaders', 9, 234],
    ['Healthcare & First Responders', 9, 234],
    ['Hikers & Hunters', 9, 234],
    ['Overlanders & Adventurers', 9, 234],
    ['Privacy Advocates', 8, 208],
    ['Remote Educators', 9, 234],
    ['Ministry & Mission Work', 9, 234],
    ['Field Researchers & NGOs', 9, 234]
];

const prompts = library.categories.flatMap(category =>
    category.subcategories.flatMap(subcategory => subcategory.prompts)
);
const subcategoryCount = library.categories.reduce((total, category) => total + category.subcategories.length, 0);
assert.equal(subcategoryCount, 81, 'The Intel catalog must keep 81 subcategories.');
assert.equal(prompts.length, 2106, 'The Intel catalog must keep 2,106 prompt entries.');
assert.equal(new Set(prompts.map(prompt => prompt.text)).size, 1943, 'The Intel catalog unique-text count changed.');

library.categories.forEach((category, index) => {
    const [title, expectedSubcategories, expectedPrompts] = expectedCategories[index];
    assert.equal(category.title, title, `Category order/title changed at position ${index + 1}.`);
    assert.equal(category.subcategories.length, expectedSubcategories, `Unexpected subcategory count for ${title}.`);
    assert.equal(
        category.subcategories.reduce((total, subcategory) => total + subcategory.prompts.length, 0),
        expectedPrompts,
        `Unexpected prompt count for ${title}.`
    );
    for (const subcategory of category.subcategories) {
        assert.equal(subcategory.prompts.length, 26, `Intel topic must keep 26 prompt entries: ${title} / ${subcategory.title}`);
        assert.deepEqual(
            [...new Set(subcategory.prompts.map(prompt => prompt.section))],
            ['Starter Prompts', 'Core Prompts', 'Advanced Prompts', 'Image-Based Prompts'],
            `Prompt tiers changed for ${title} / ${subcategory.title}`
        );
    }
});

const ids = prompts.map(prompt => prompt.id);
assert.equal(new Set(ids).size, ids.length, 'Prompt IDs must be unique even when wording is intentionally repeated.');
for (const prompt of prompts) {
    assert.match(prompt.id, /^[a-z0-9-]+$/, `Invalid prompt ID: ${prompt.id}`);
    assert.ok(prompt.text.length >= 12, `Prompt text is unexpectedly short: ${prompt.id}`);
    assert.ok(['all', 'advanced', 'vision'].includes(prompt.badge), `Invalid badge: ${prompt.id}`);
    assert.ok(['use', 'image', 'field-guide'].includes(prompt.action), `Invalid action: ${prompt.id}`);
    assert.ok(Array.isArray(prompt.capabilities) && prompt.capabilities.length, `Missing capabilities: ${prompt.id}`);
    assert.ok(['Starter Prompts', 'Core Prompts', 'Advanced Prompts', 'Image-Based Prompts'].includes(prompt.section), `Invalid Intel prompt tier: ${prompt.id}`);
}

assert.equal(prompts[0].text, "I found a water source but I'm not sure if it's safe. What should I look for before drinking, and what are my options to make it safer?");
assert.equal(prompts.at(-1).text, 'Upload photo: Review this handover document and identify gaps that incoming teams would need filled.');

const countByAction = prompts.reduce((counts, prompt) => {
    counts[prompt.action] = (counts[prompt.action] || 0) + 1;
    return counts;
}, {});
assert.deepEqual({ ...countByAction }, { use: 1417, 'field-guide': 366, image: 323 });

const audienceIds = new Set(library.audiences.map(audience => audience.id));
for (const audience of ['emergency', 'homestead', 'healthcare', 'hiker-hunter', 'overlander', 'privacy', 'educator', 'ministry', 'field-research']) {
    assert.ok(audienceIds.has(audience), `Missing Intel audience filter: ${audience}`);
}

// The embedded legacy catalog still serves the separate Command Center route.
const dataStart = promptPage.indexOf('const PROMPT_CATEGORIES = ');
const dataEnd = promptPage.indexOf('// ============================================', dataStart);
assert.ok(dataStart >= 0 && dataEnd > dataStart, 'Command Center prompt catalog could not be located.');
const legacyChunk = promptPage.slice(dataStart + 'const PROMPT_CATEGORIES = '.length, dataEnd).trim();
const legacyExpression = legacyChunk.endsWith(';') ? legacyChunk.slice(0, -1) : legacyChunk;
const legacyCategories = Function(`"use strict"; return (${legacyExpression});`)();
const activeLegacyCategories = legacyCategories.filter(category =>
    !category.subcategories.every(subcategory => subcategory.prompts.every(prompt => prompt.challenging))
);
const legacyPrompts = activeLegacyCategories.flatMap(category =>
    category.subcategories.flatMap(subcategory => subcategory.prompts)
);
assert.equal(activeLegacyCategories.length, 26, 'The Command Center catalog must keep 26 active categories.');
assert.equal(legacyPrompts.length, 285, 'The Command Center catalog must keep 285 prompts.');

assert.match(promptPage, /ready-made-prompts-online\.js\?v=20260807-intel1/, 'Versioned Intel data asset is missing.');
assert.doesNotMatch(promptPage, />Showcase<|>Full Library</, 'Retired online collection toggles are still visible.');
for (const marker of [
    'setAudience',
    'favoritePromptById',
    'recentPromptIds',
    'toggleSubcategory',
    'data-owner-safety-review',
    '__OFFGRID_PROMPT_LIBRARY_STATUS__',
    'dataset.promptLibraryVersion',
    'dataset.catalogPromptCount'
]) {
    assert.ok(promptPage.includes(marker), `Prompt-page behavior marker is missing: ${marker}`);
}
for (const marker of ['offgrid-ready-prompt-action', 'triggerGalleryUpload()', 'openVideoActions()']) {
    assert.ok(onlinePage.includes(marker), `Online action handoff marker is missing: ${marker}`);
}

function compileInlineScripts(source, filename) {
    const scriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;
    while ((match = scriptPattern.exec(source))) {
        index += 1;
        new vm.Script(match[1], { filename: `${filename}:inline-${index}` });
    }
    assert.ok(index > 0, `No inline scripts found in ${filename}`);
}

compileInlineScripts(promptPage, 'ready-made-prompts.html');
compileInlineScripts(onlinePage, 'index.html');

console.log(JSON.stringify({
    version: library.version,
    source: library.source.url,
    sourceSha256: library.source.sha256,
    categories: library.categories.length,
    subcategories: subcategoryCount,
    promptEntries: prompts.length,
    uniquePromptTexts: new Set(prompts.map(prompt => prompt.text)).size,
    actions: countByAction,
    commandCategories: activeLegacyCategories.length,
    commandPrompts: legacyPrompts.length,
    status: 'ok'
}, null, 2));

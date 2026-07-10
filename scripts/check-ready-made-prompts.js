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
assert.equal(library.categories.length, 10, 'The approved showcase must keep 10 categories.');

const prompts = library.categories.flatMap(category =>
    category.subcategories.flatMap(subcategory => subcategory.prompts)
);
assert.equal(prompts.length, 114, 'The approved showcase must keep 114 prompts.');

const ids = prompts.map(prompt => prompt.id);
const texts = prompts.map(prompt => prompt.text.toLowerCase().replace(/\s+/g, ' ').trim());
assert.equal(new Set(ids).size, ids.length, 'Prompt IDs must be unique.');
assert.equal(new Set(texts).size, texts.length, 'Showcase prompt text must be unique.');

for (const prompt of prompts) {
    assert.match(prompt.id, /^[a-z0-9-]+$/, `Invalid prompt ID: ${prompt.id}`);
    assert.ok(prompt.text.length >= 40, `Prompt is too short to be scenario-driven: ${prompt.id}`);
    assert.ok(['all', 'advanced', 'vision', 'video'].includes(prompt.badge), `Invalid badge: ${prompt.id}`);
    assert.ok(['use', 'image', 'video', 'visual', 'field-guide'].includes(prompt.action), `Invalid action: ${prompt.id}`);
    assert.ok(Array.isArray(prompt.capabilities) && prompt.capabilities.length, `Missing capabilities: ${prompt.id}`);
    assert.ok(!/Gemma|\b\d+B\b|all models/i.test(prompt.text), `Model name leaked into showcase prompt: ${prompt.id}`);
}

const requiredPromptIds = [
    'wildfire-go-10-minutes',
    'outage-food-triage',
    'seven-day-readiness-audit',
    'no-cell-family-plan',
    'sunset-route-decision',
    'silty-filter-trickle',
    'campsite-photo-hazards',
    'tarp-wind-video',
    'van-overnight-battery',
    'rv-ceiling-leak-video',
    'rv-water-pump-cycle',
    'car-one-click',
    'well-pump-short-cycle',
    'chickens-heat-laying',
    'property-ember-entry',
    'identify-with-confidence',
    'generator-startup-video',
    'solar-controller-photo',
    'rainwater-system-visual',
    'vehicle-breakdown-guide'
];
for (const id of requiredPromptIds) assert.ok(ids.includes(id), `Approved showcase prompt is missing: ${id}`);

const countByAction = prompts.reduce((counts, prompt) => {
    counts[prompt.action] = (counts[prompt.action] || 0) + 1;
    return counts;
}, {});
assert.ok(countByAction.image >= 12, 'Showcase must include at least 12 image-analysis actions.');
assert.ok(countByAction.video >= 9, 'Showcase must include at least 9 video-analysis actions.');
assert.ok(countByAction['field-guide'] >= 10, 'Showcase must include at least 10 field-guide actions.');
assert.ok(countByAction.visual >= 5, 'Showcase must include at least 5 visual actions.');

const audienceIds = new Set(library.audiences.map(audience => audience.id));
for (const audience of ['emergency', 'prepper', 'homestead', 'hiker', 'camper', 'overlander', 'van-rv', 'rural']) {
    assert.ok(audienceIds.has(audience), `Missing approved audience filter: ${audience}`);
}

const dataStart = promptPage.indexOf('const PROMPT_CATEGORIES = ');
const dataEnd = promptPage.indexOf('// ============================================', dataStart);
assert.ok(dataStart >= 0 && dataEnd > dataStart, 'Legacy prompt catalog could not be located.');
const legacyChunk = promptPage.slice(dataStart + 'const PROMPT_CATEGORIES = '.length, dataEnd).trim();
const legacyExpression = legacyChunk.endsWith(';') ? legacyChunk.slice(0, -1) : legacyChunk;
const legacyCategories = Function(`"use strict"; return (${legacyExpression});`)();
const activeLegacyCategories = legacyCategories.filter(category =>
    !category.subcategories.every(subcategory => subcategory.prompts.every(prompt => prompt.challenging))
);
const legacyPrompts = activeLegacyCategories.flatMap(category =>
    category.subcategories.flatMap(subcategory => subcategory.prompts)
);
assert.equal(activeLegacyCategories.length, 26, 'The preserved online legacy catalog must keep 26 categories.');
assert.equal(legacyPrompts.length, 285, 'The preserved online legacy catalog must keep 285 prompts.');

for (const exactText of [
    'Calculate the correct amoxicillin dose for a 35-pound child with otitis media',
    'I think someone has been poisoned by a household chemical. What immediate steps should I take',
    'How do I respond to an unexpected house invasion when off grid',
    'Create a detailed security and defense guide for protecting a homestead or bug-out location'
]) {
    assert.ok(legacyPrompts.some(prompt => prompt.text === exactText), `Owner-review prompt changed or disappeared: ${exactText}`);
}

assert.match(promptPage, /ready-made-prompts-online\.js\?v=20260710-1/, 'Versioned showcase data asset is missing.');
for (const marker of [
    'setCollection',
    'setAudience',
    'favoritePromptById',
    'recentPromptIds',
    'data-owner-safety-review',
    '__OFFGRID_PROMPT_LIBRARY_STATUS__',
    'dataset.promptLibraryVersion'
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
    categories: library.categories.length,
    prompts: prompts.length,
    actions: countByAction,
    legacyCategories: activeLegacyCategories.length,
    legacyPrompts: legacyPrompts.length,
    status: 'ok'
}, null, 2));

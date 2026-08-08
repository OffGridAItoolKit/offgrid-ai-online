'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://intel.offgridaitoolkit.com/resources/ready-made-prompts.html';
const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'ready-made-prompts-online.js');
const markdownFlag = process.argv.indexOf('--markdown');
const markdownPath = markdownFlag >= 0 ? process.argv[markdownFlag + 1] : null;

const categoryMetadata = {
    'survival-and-emergency-prep': { icon: '🧭', audience: 'emergency' },
    homesteaders: { icon: '🌱', audience: 'homestead' },
    'healthcare-and-first-responders': { icon: '⛑️', audience: 'healthcare' },
    'hikers-and-hunters': { icon: '🥾', audience: 'hiker-hunter' },
    'overlanders-and-adventurers': { icon: '🚙', audience: 'overlander' },
    'privacy-advocates': { icon: '🔒', audience: 'privacy' },
    'remote-educators': { icon: '📚', audience: 'educator' },
    'ministry-and-mission-work': { icon: '🤝', audience: 'ministry' },
    'field-researchers-and-ngos': { icon: '🔬', audience: 'field-research' }
};

const audienceLabels = {
    emergency: 'Survival & Emergency',
    homestead: 'Homesteaders',
    healthcare: 'Healthcare',
    'hiker-hunter': 'Hikers & Hunters',
    overlander: 'Overlanders',
    privacy: 'Privacy',
    educator: 'Educators',
    ministry: 'Ministry',
    'field-research': 'Field Research'
};

function decodeHtml(value) {
    const named = {
        amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
        ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“'
    };
    return String(value || '')
        .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(
            code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10)
        ))
        .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanText(value) {
    return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slug(value, maxLength = 64) {
    return cleanText(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLength);
}

function classifyPrompt(text, sectionTitle, categoryTitle, subcategoryTitle) {
    const isImage = /image-based/i.test(sectionTitle) || /^upload photo:/i.test(text);
    const isAdvanced = /advanced/i.test(sectionTitle);
    const isGuide = !isImage && /\b(create|build|develop|design|make)\b[\s\S]{0,80}\b(plan|checklist|decision tree|protocol|template|framework|system|schedule|curriculum|worksheet|review process|guide)\b/i.test(text);

    return {
        badge: isImage ? 'vision' : isAdvanced ? 'advanced' : 'all',
        audiences: [categoryMetadata[slug(categoryTitle)]?.audience].filter(Boolean),
        tags: [sectionTitle],
        capabilities: isImage ? ['image', 'decision'] : isGuide ? ['field-guide', 'decision'] : ['decision'],
        outputType: isGuide ? 'field-guide' : 'answer',
        followups: isGuide ? ['Make Field Guide', 'Save PDF'] : [],
        action: isImage ? 'image' : isGuide ? 'field-guide' : 'use',
        ownerSafetyReview: /Healthcare & First Responders/i.test(categoryTitle) || /\b(dose|dosage|poison|severe bleeding|chest pain|suicid|weapon|defen[cs]e|looter|riot|house invasion)\b/i.test(text)
    };
}

function parseCatalog(html) {
    const categoryHeaders = [...html.matchAll(/<div class="category-section"[^>]*id="([^"]+)"[^>]*>\s*<div class="category-header">([\s\S]*?)<\/div>/gi)];
    const categories = [];

    categoryHeaders.forEach((match, categoryIndex) => {
        const id = match[1];
        const title = cleanText(match[2]);
        const end = categoryHeaders[categoryIndex + 1]?.index ?? html.indexOf('<blockquote>', match.index);
        const categoryHtml = html.slice(match.index, end > match.index ? end : html.length);
        const subcategories = [];

        for (const detailsMatch of categoryHtml.matchAll(/<details>([\s\S]*?)<\/details>/gi)) {
            const detailsHtml = detailsMatch[1];
            const summaryMatch = detailsHtml.match(/<summary><strong>([\s\S]*?)<\/strong><\/summary>/i);
            if (!summaryMatch) continue;
            const subcategoryTitle = cleanText(summaryMatch[1]);
            const prompts = [];
            let sectionTitle = 'Prompts';
            let promptIndex = 0;

            const tokens = detailsHtml.matchAll(/<h3>([\s\S]*?)<\/h3>|<div class="prompt">([\s\S]*?)<\/div>/gi);
            for (const token of tokens) {
                if (token[1] !== undefined) {
                    sectionTitle = cleanText(token[1]);
                    continue;
                }
                const text = cleanText(token[2]);
                if (!text) continue;
                promptIndex += 1;
                const sectionId = slug(sectionTitle, 20) || 'prompts';
                const subcategoryId = slug(subcategoryTitle, 30) || `subcategory-${subcategories.length + 1}`;
                prompts.push({
                    id: `${id}-${subcategoryId}-${sectionId}-${String(promptIndex).padStart(2, '0')}`,
                    text,
                    section: sectionTitle,
                    ...classifyPrompt(text, sectionTitle, title, subcategoryTitle)
                });
            }

            subcategories.push({ title: subcategoryTitle, prompts });
        }

        const metadata = categoryMetadata[id] || { icon: '🧭', audience: slug(title) };
        categories.push({
            id,
            icon: metadata.icon,
            title,
            description: `Prompts from the OffGrid AI Intel catalog for ${title}.`,
            audiences: [metadata.audience],
            subcategories
        });
    });

    return categories;
}

function markdownSnapshot(categories, sourceHash, fetchedAt) {
    const totalPrompts = categories.reduce((sum, category) => sum + category.subcategories.reduce((subSum, subcategory) => subSum + subcategory.prompts.length, 0), 0);
    const lines = [
        '# Ready-Made Prompts Catalog Snapshot',
        '',
        `**Source:** ${SOURCE_URL}  `,
        `**Captured:** ${fetchedAt}  `,
        `**Source SHA-256:** \`${sourceHash}\`  `,
        `**Categories:** ${categories.length}  `,
        `**Subcategories:** ${categories.reduce((sum, category) => sum + category.subcategories.length, 0)}  `,
        `**Prompt entries:** ${totalPrompts}`,
        '',
        '> This is a versioned content snapshot. The live Intel page is the editorial source; current Git data and reproducible sync/test evidence are authoritative for the online app.',
        ''
    ];

    for (const category of categories) {
        lines.push(`## ${category.title}`, '');
        for (const subcategory of category.subcategories) {
            lines.push(`### ${subcategory.title}`, '');
            let priorSection = '';
            for (const prompt of subcategory.prompts) {
                if (prompt.section !== priorSection) {
                    lines.push(`#### ${prompt.section}`, '');
                    priorSection = prompt.section;
                }
                lines.push(`- ${prompt.text}`);
            }
            lines.push('');
        }
    }
    return `${lines.join('\n').trim()}\n`;
}

async function main() {
    const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'OffGrid-AI-Catalog-Sync/1.0' } });
    if (!response.ok) throw new Error(`Intel catalog request failed: HTTP ${response.status}`);
    const html = await response.text();
    const sourceHash = crypto.createHash('sha256').update(html).digest('hex');
    const categories = parseCatalog(html);
    const prompts = categories.flatMap(category => category.subcategories.flatMap(subcategory => subcategory.prompts));
    const fetchedAt = new Date().toISOString();

    if (categories.length !== 9 || prompts.length !== 2106) {
        throw new Error(`Unexpected Intel catalog shape: ${categories.length} categories, ${prompts.length} prompts`);
    }
    if (new Set(prompts.map(prompt => prompt.id)).size !== prompts.length) {
        throw new Error('Generated prompt IDs are not unique.');
    }

    const audiences = [
        { id: 'all', label: 'Everyone' },
        ...Object.entries(audienceLabels).map(([id, label]) => ({ id, label }))
    ];
    const payload = {
        version: '2026-08-07.intel-1',
        source: {
            url: SOURCE_URL,
            fetchedAt,
            sha256: sourceHash,
            categories: categories.length,
            subcategories: categories.reduce((sum, category) => sum + category.subcategories.length, 0),
            promptEntries: prompts.length,
            uniquePromptTexts: new Set(prompts.map(prompt => prompt.text)).size
        },
        categories,
        ownerSafetyReviewRules: [],
        audiences
    };
    const transport = {
        version: payload.version,
        source: payload.source,
        audiences: payload.audiences,
        categories: categories.map(category => ({
            id: category.id,
            icon: category.icon,
            title: category.title,
            description: category.description,
            audiences: category.audiences,
            subcategories: category.subcategories.map(subcategory => ({
                title: subcategory.title,
                prompts: subcategory.prompts.map(prompt => [
                    prompt.id,
                    prompt.text,
                    prompt.section,
                    prompt.badge,
                    prompt.action,
                    prompt.ownerSafetyReview
                ])
            }))
        }))
    };
    const source = `(function () {\n    'use strict';\n\n    const raw = ${JSON.stringify(transport)};\n    const categories = raw.categories.map(category => ({\n        ...category,\n        subcategories: category.subcategories.map(subcategory => ({\n            ...subcategory,\n            prompts: subcategory.prompts.map(([id, text, section, badge, action, ownerSafetyReview]) => ({\n                id,\n                text,\n                section,\n                badge,\n                action,\n                ownerSafetyReview,\n                audiences: category.audiences,\n                tags: [section],\n                capabilities: action === 'image' ? ['image', 'decision'] : action === 'field-guide' ? ['field-guide', 'decision'] : ['decision'],\n                outputType: action === 'field-guide' ? 'field-guide' : 'answer',\n                followups: action === 'field-guide' ? ['Make Field Guide', 'Save PDF'] : []\n            }))\n        }))\n    }));\n\n    window.OFFGRID_ONLINE_PROMPT_LIBRARY = {\n        version: raw.version,\n        source: raw.source,\n        categories,\n        ownerSafetyReviewRules: [],\n        audiences: raw.audiences\n    };\n})();\n`;
    fs.writeFileSync(outputPath, source, 'utf8');

    if (markdownPath) {
        fs.mkdirSync(path.dirname(path.resolve(markdownPath)), { recursive: true });
        fs.writeFileSync(path.resolve(markdownPath), markdownSnapshot(categories, sourceHash, fetchedAt), 'utf8');
    }

    console.log(JSON.stringify(payload.source, null, 2));
}

main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
});

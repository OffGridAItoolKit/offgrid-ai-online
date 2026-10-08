'use strict';
// Explicitly run research only. Synthetic, non-customer prompts; no app configuration changes.
// Default policy matches web/Android ZDR. Never relax it silently after a rejection.
const fs = require('node:fs');
const path = require('node:path');
const flow = require('../assets/image-studio-flow');
const models = ['google/gemini-3-pro-image', 'google/gemini-nano-banana-2.1'];
const cases = [
    { id: 'packing', prompt: 'Create a square illustrated checklist titled "DAY HIKE KIT". Show exactly six items in a clean 2 by 3 grid: Water, Snacks, Rain shell, Headlamp, Map, First-aid kit. Use those exact labels. Light background, forest green and warm gold accents, clear practical illustrations. No other items, logos, captions or footer.', format: 'square' },
    { id: 'layout', prompt: 'Create a landscape technical illustration titled "CAMP KITCHEN". Show three separate work zones left to right labeled exactly "WASH", "PREP", "COOK". WASH has a basin and soap; PREP has a cutting board and knife; COOK has a stove and pot. Show an arrow from WASH to PREP to COOK. Add a separate lidded waste bin below the zones, labeled "WASTE". This is a conceptual layout: no invented measurements or safety distances. Light background, clear line work, readable labels.', format: 'landscape' },
    { id: 'article', prompt: 'Portrait 4:5 phone-readable field card titled "BEFORE YOU LEAVE". Source notes: Check the forecast. Tell a trusted contact the route and return time. Pack a map and headlamp. Fill water bottles. Keep the exact four numbered steps in that order with one icon per step. Use large legible text, generous spacing, a light background and forest-green headings. Do not add advice, numbers, footer or branding.', format: 'phone' }
];
async function main() {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required in the environment.');
    const out = path.resolve(process.argv[2] || 'test-results/image-model-comparison');
    if (fs.existsSync(path.join(out, 'results.json'))) throw new Error('Results already exist. Choose a new output directory to preserve the previous evidence.');
    fs.mkdirSync(out, { recursive: true });
    const rows = [];
    const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ date: new Date().toISOString(), policy: { zdr: true }, samplesPerCase: 1, rows }, null, 2));
    let total = 0;
    for (const item of cases) {
        for (const model of models) {
            if (total >= 1.5) throw new Error('Research spend guard reached; no more requests sent.');
            const prompt = flow.imagePrompt(item.prompt, 'create', item.format);
            const request = { model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'], provider: { zdr: true }, max_tokens: 6000 };
            const start = Date.now();
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'OffGrid Image Studio isolated comparison' },
                body: JSON.stringify(request), signal: AbortSignal.timeout(180000)
            });
            const data = await response.json();
            const row = { case: item.id, model, prompt, elapsedMs: Date.now() - start, status: response.status, provider: data.provider, usage: data.usage, finishReason: data.choices?.[0]?.finish_reason };
            const image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (image?.startsWith('data:image/')) {
                const match = image.match(/^data:image\/([^;]+);base64,(.+)$/s);
                if (!match) throw new Error('Unexpected image encoding');
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                row.file = `${item.id}-${model.includes('2.1') ? 'banana21' : 'pro'}.${ext}`;
                fs.writeFileSync(path.join(out, row.file), Buffer.from(match[2], 'base64'));
            } else row.error = data.error?.message || 'No image returned';
            rows.push(row); total += Number(data.usage?.cost || 0); save();
            console.log(JSON.stringify({ case: row.case, model, status: row.status, elapsedMs: row.elapsedMs, cost: data.usage?.cost, file: row.file, error: row.error }));
            if (!response.ok || !row.file) { console.log('Comparison stopped; investigate this result before spending more.'); return; }
        }
    }
    console.log(`Completed ${rows.length} images. Reported API cost: $${total.toFixed(4)}. Results: ${out}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

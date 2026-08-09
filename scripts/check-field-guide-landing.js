const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'field-guide-landing.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

const checks = [
    ['canonical domain', html.includes('https://offgridai.guide/')],
    ['Google Play package link', html.includes('id=com.offgridaitoolkit.app')],
    ['web app link', html.includes('https://offgridtoolkit.ai/online')],
    ['privacy link', html.includes('https://offgridtoolkit.ai/privacy')],
    ['real phone hero asset', html.includes('/assets/field-guide/brand/offgrid-field-guide-phone-angle-left.webp')],
    ['walkthrough video', html.includes('/assets/field-guide/walkthrough/create-a-field-guide-walkthrough.mp4')],
    ['video assets bypass landing HTML routing', server.includes('|mp4|webm)')],
    ['six gallery examples', (html.match(/class="gallery-card"/g) || []).length === 6],
    ['accessible gallery lightbox', html.includes('<dialog class="lightbox"') && html.includes('aria-label="Close enlarged image"')],
    ['gallery verification disclosure', html.includes('AI-generated visuals can contain mistakes')],
    ['compact mobile navigation label', html.includes('class="nav-cta-short">Get the app</span>')],
    ['mobile swipe gallery', html.includes('scroll-snap-type: x mandatory') && html.includes('Swipe through the examples')],
    ['small-phone feature fallback', html.includes('@media (max-width: 370px)')],
    ['online/offline product distinction', html.includes('Field Guide is online. ToolKit is built for offline use.')],
    ['primary domain routing', server.includes("host === 'offgridai.guide'")],
    ['www primary domain routing', server.includes("host === 'www.offgridai.guide'")],
    ['long domain redirect', server.includes("host === 'offgridaifieldguide.com'")],
    ['www long domain redirect', server.includes("host === 'www.offgridaifieldguide.com'")],
    ['canonical redirect target', server.includes('https://offgridai.guide${req.originalUrl')]
];

let failures = 0;
for (const [name, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
    if (!passed) failures += 1;
}

if (failures) process.exit(1);
console.log(`Landing checks passed (${checks.length}/${checks.length}).`);

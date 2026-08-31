const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'field-guide-landing.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const imageTags = html.match(/<img\b[^>]*>/g) || [];

const checks = [
    ['canonical domain', html.includes('https://offgridai.guide/')],
    ['Google Play package link', html.includes('id=com.offgridaitoolkit.app')],
    ['web app link', html.includes('https://offgridtoolkit.ai/online')],
    ['privacy link', html.includes('https://offgridtoolkit.ai/privacy')],
    ['real phone hero asset', html.includes('/assets/field-guide/brand/offgrid-field-guide-phone-angle-left.webp')],
    ['eight current app screen renders', (html.match(/class="app-tour-card"/g) || []).length === 8 && html.includes('/assets/field-guide/device-renders/03-offgrid-ai-fieldguide-multiple-photo-analysis-phone.webp')],
    ['multi-photo feature copy', html.includes('Compare Multiple Photos') && html.includes('one or multiple photos')],
    ['accessible app tour controls', html.includes('aria-label="App tour controls"') && html.includes('aria-label="Show next app screen"')],
    ['reduced-motion support', html.includes('prefers-reduced-motion: reduce') && html.includes('animation-duration: 0.01ms')],
    ['walkthrough video', html.includes('/assets/field-guide/walkthrough/create-a-field-guide-walkthrough.mp4')],
    ['video assets bypass landing HTML routing', server.includes('|mp4|webm|txt|xml)')],
    ['FieldGuide product branding', html.includes('<title>OffGrid AI FieldGuide') && !html.includes('OffGrid AI Field Guide')],
    ['Open Graph share image', html.includes('https://offgridai.guide/offgrid-ai-fieldguide-social-share.png') && html.includes('og:image:width')],
    ['search indexing metadata', html.includes('name="robots" content="index,follow') && html.includes('rel="sitemap"')],
    ['Google Search Console verification', html.includes('google-site-verification') && html.includes('uydIXA-jb4R04Xf5o3ieMwHhzEs_ZPfbloO_FehdA9Q')],
    ['all landing images declare alt text', imageTags.length > 0 && imageTags.every((tag) => /\balt="[^"]*"/.test(tag))],
    ['software application structured data', html.includes('"@type": "SoftwareApplication"') && html.includes('"name": "OffGrid AI FieldGuide"')],
    ['offline PDF message highlight', html.includes('class="check offline-highlight"')],
    ['six gallery examples', (html.match(/class="gallery-card"/g) || []).length === 6],
    ['accessible gallery lightbox', html.includes('<dialog class="lightbox"') && html.includes('aria-label="Close enlarged image"')],
    ['gallery verification disclosure', html.includes('AI-generated visuals can contain mistakes')],
    ['compact mobile navigation label', html.includes('class="nav-cta-short">Get the app</span>')],
    ['mobile swipe gallery', html.includes('scroll-snap-type: x mandatory') && html.includes('Swipe through the examples')],
    ['small-phone feature fallback', html.includes('@media (max-width: 370px)')],
    ['online/offline product distinction', html.includes('FieldGuide is online. ToolKit is built for offline use.')],
    ['dedicated Formspree support endpoint', html.includes('action="https://formspree.io/f/xqpkevea"') && !html.includes('/f/xzebpnoz')],
    ['accessible support form status', html.includes('id="support-form"') && html.includes('aria-live="polite"') && html.includes('role="status"')],
    ['support contact and privacy guidance', html.includes('support@offgridaitoolkit.com') && html.includes('Please do not include passwords')],
    ['support form autofill guard', html.includes("formData.get('email')") && html.includes('autofill suggestion without adding it to the form')],
    ['Formspree rejection details surfaced', html.includes('payload?.errors') && html.includes('Formspree rejected the request.')],
    ['Formspree allowed by content security policy', server.includes("connect-src 'self' https://offgridtoolkit.ai https://*.offgridtoolkit.ai https://formspree.io")],
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

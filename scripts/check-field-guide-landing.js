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

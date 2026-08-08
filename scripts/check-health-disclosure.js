const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'offgridai.css'), 'utf8');

const checks = [
    {
        label: 'first-run medical-device disclosure',
        ok: html.includes('OffGrid AI Field Guide is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.')
    },
    {
        label: 'first-run professional-care guidance',
        ok: html.includes('consult a qualified healthcare professional')
            && html.includes('contact local emergency services')
    },
    {
        label: 'both More Actions media disclosures',
        ok: (html.match(/Photo\/video health results are general information only—not diagnosis or medical advice\./g) || []).length === 2
    },
    {
        label: 'photo action-sheet disclosure',
        ok: html.includes('Health-related image analysis provides general information only—not diagnosis or medical advice.')
    },
    {
        label: 'video action-sheet disclosure',
        ok: html.includes('Health-related video analysis provides general information only—not diagnosis or medical advice.')
    },
    {
        label: 'disclosure styles',
        ok: css.includes('.plus-menu-disclosure')
            && css.includes('.mobile-action-sheet-disclosure')
    }
];

const failures = checks.filter(check => !check.ok);
for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
}

if (failures.length > 0) {
    process.exitCode = 1;
} else {
    console.log(`Health disclosure checks passed (${checks.length}/${checks.length}).`);
}

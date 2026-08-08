const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const androidBridge = fs.readFileSync(
    path.join(root, 'mobile-app', 'android', 'app', 'src', 'main', 'java', 'com', 'offgridaitoolkit', 'app', 'MainActivity.java'),
    'utf8'
);

const checks = [
    ['Make Field Guide is the primary follow-up', html.includes('message-followup-action primary" onclick="createVisualFromMessageAction(this, \'field-guide\')">Make Field Guide')],
    ['Make Field Guide requests automatic preview', html.includes("autoOpenFieldGuide: mode === 'field-guide'")],
    ['generated image advances to PDF assembly', html.includes('await exportOnlineStudioPDF({ automatic: true });')],
    ['top preview action says Save Field Guide', html.includes("const saveLabel = isFieldGuidePreview ? 'Save Field Guide'")],
    ['bottom preview actions are Share and Save PDF', html.includes('onclick="shareAppPdfPreview()">Share</button>') && html.includes("const lowerSaveLabel = isFieldGuidePreview ? 'Save PDF'")],
    ['web bridge invokes PDF sharing', html.includes('window.OffGridNative.shareFieldGuidePdf(')],
    ['Android exposes PDF sharing', androidBridge.includes('public String shareFieldGuidePdf(')],
    ['Android shares a PDF attachment', androidBridge.includes('shareIntent.setType("application/pdf")') && androidBridge.includes('Intent.EXTRA_STREAM')],
    ['older Android builds receive a fallback', html.includes('Save PDF, then share')]
];

let failed = 0;
for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
    if (!passed) failed += 1;
}

if (failed) {
    console.error(`Field guide checks failed (${failed}/${checks.length}).`);
    process.exit(1);
}

console.log(`Field guide checks passed (${checks.length}/${checks.length}).`);

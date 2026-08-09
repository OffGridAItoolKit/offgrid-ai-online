const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'offgridai.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const androidBridge = fs.readFileSync(
    path.join(root, 'mobile-app', 'android', 'app', 'src', 'main', 'java', 'com', 'offgridaitoolkit', 'app', 'MainActivity.java'),
    'utf8'
);
const androidManifest = fs.readFileSync(
    path.join(root, 'mobile-app', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
);

const checks = [
    ['Make Field Guide is the primary follow-up', html.includes('message-followup-action primary" onclick="createVisualFromMessageAction(this, \'field-guide\')">Make Field Guide')],
    ['post-answer action offers Read Aloud', html.includes('data-read-aloud-action onclick="readMessageAloudFromAction(this)">Read Aloud') && !html.includes('onclick="exportAsPDF()">Save PDF</button>\n                    </div>')],
    ['Read Aloud prepares structured text and prefers local voices', html.includes('function prepareTextForToolkitTTS(text)') && html.includes("'Step $1. '") && html.includes('v.localService')],
    ['Read Aloud falls back to Android native speech', html.includes('window.OffGridNative.speakText(cleanText)') && html.includes('function handleNativeToolkitTTSFinished()') && androidBridge.includes('public String speakText(String text)') && androidManifest.includes('android.intent.action.TTS_SERVICE')],
    ['Make Field Guide requests automatic preview', html.includes("autoOpenFieldGuide: mode === 'field-guide'")],
    ['generated image advances to PDF assembly', html.includes('await exportOnlineStudioPDF({ automatic: true });')],
    ['top preview action says Save Field Guide', html.includes("const saveLabel = isFieldGuidePreview ? 'Save Field Guide'")],
    ['bottom preview actions are Share PDF and Save PDF', html.includes('onclick="shareAppPdfPreview()">Share PDF</button>') && html.includes("const lowerSaveLabel = isFieldGuidePreview ? 'Save PDF'")],
    ['web bridge invokes PDF sharing', html.includes('window.OffGridNative.shareFieldGuidePdf(')],
    ['Android exposes PDF sharing', androidBridge.includes('public String shareFieldGuidePdf(')],
    ['Android shares a PDF attachment', androidBridge.includes('shareIntent.setType("application/pdf")') && androidBridge.includes('Intent.EXTRA_STREAM')],
    ['generated-image actions share image and whole field guide', html.includes('onclick="shareOnlineStudioFieldGuide()">Share Field Guide</button>') && html.includes('>Share Image</button>')],
    ['image generation communicates expected wait', html.includes('This usually takes about one minute. Keep the app open') && html.includes('Generating image - usually about 60 seconds')],
    ['field-guide creation preserves source Markdown', html.includes('messageDiv.dataset.sourceMarkdown = fullResponse') && html.includes('const answerText = getMessageSourceText(messageEl)')],
    ['shared images include Image Studio attribution', html.includes('Made with OffGrid AI Image Studio') && androidBridge.includes('Made with OffGrid AI Image Studio.')],
    ['Android PDF preserves Markdown styling', androidBridge.includes('drawMarkdown(answer, 15.2f)') && androidBridge.includes('Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY)') && !androidBridge.includes('markdownToPlainText(answer)')],
    ['Android PDF uses mobile-friendly page and list indents', androidBridge.includes('PAGE_WIDTH = 540') && androidBridge.includes('PAGE_HEIGHT = 900') && androidBridge.includes('new LeadingMarginSpan.Standard(16, 38)')],
    ['older Android builds receive a fallback', html.includes('App update required for direct sharing')],
    ['successful native save returns to app', /if \(result\.ok\) \{[\s\S]*?markSavedGuideAvailable\(\);\s*closeAppPdfPreview\(\);\s*showSaveToast\('PDF saved'/.test(html)],
    ['field guide PDF omits model metadata', !html.includes('**Model:** ${MODEL_DISPLAY') && !html.includes('frontmatter += `model: ${selectedModel}')],
    ['field guide PDF title has compact line height', /h1 \{[\s\S]*?line-height: 1\.2;/.test(server)],
    ['generated images open the zoom view', html.includes('function openImageZoom(') && html.includes('Open generated image in zoom view')],
    ['generated image actions include New Field Guide', html.includes('onclick="startNewFieldGuide()">New Field Guide</button>')],
    ['generated image actions use an even two-column grid', css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));') && /button\.new-guide \{\s*grid-column: 2;/.test(css)],
    ['wide phones show explicit theme mode labels', html.includes("isNight ? 'Light Mode' : 'Dark Mode'") && css.includes('@media (min-width: 400px) and (max-width: 768px)')],
    ['home action opens Saved Guides directly', (html.match(/onclick="requestOpenSavedGuides\(\)"/g) || []).length >= 2 && html.includes('Open your offline field guide PDFs')],
    ['empty Saved Guides state has a recovery action', html.includes('No saved guides recorded yet') && html.includes("'Check Folder'")],
    ['markdown tables receive a scroll region', html.includes("wrapper.className = 'markdown-table-scroll'") && css.includes('.markdown-table-scroll')],
    ['redundant online badges are absent from markup', !html.includes('<span class="online-badge"') && !html.includes('id="customerBadge"')],
    ['customer UI does not name the provider model generation', !html.includes('Gemma 4')]
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

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
const androidStyles = fs.readFileSync(
    path.join(root, 'mobile-app', 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'),
    'utf8'
);
const iosBridge = fs.readFileSync(
    path.join(root, 'mobile-app', 'ios', 'App', 'App', 'AppDelegate.swift'),
    'utf8'
);
const iosStoryboard = fs.readFileSync(
    path.join(root, 'mobile-app', 'ios', 'App', 'App', 'Base.lproj', 'Main.storyboard'),
    'utf8'
);
const iosInfoPlist = fs.readFileSync(
    path.join(root, 'mobile-app', 'ios', 'App', 'App', 'Info.plist'),
    'utf8'
);
const mobileConfig = fs.readFileSync(
    path.join(root, 'mobile-app', 'capacitor.config.ts'),
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
    ['Android system bars use accessible FieldGuide colors', androidBridge.includes('configureBrandedSystemBars()') && androidBridge.includes('controller.setAppearanceLightStatusBars(true)') && androidBridge.includes('controller.setAppearanceLightNavigationBars(false)') && androidStyles.includes('#C58B00') && androidStyles.includes('#2C1810')],
    ['Android 15+ draws branded protection behind transparent system bars', androidBridge.includes('Build.VERSION_CODES.VANILLA_ICE_CREAM') && androidBridge.includes('addSystemBarProtection(decor, true, OFFGRID_GOLD)') && androidBridge.includes('addSystemBarProtection(decor, false, OFFGRID_DARK_BROWN)') && androidBridge.includes('WindowInsetsCompat.Type.statusBars()') && androidBridge.includes('WindowInsetsCompat.Type.navigationBars()')],
    ['Android shares a PDF attachment', androidBridge.includes('shareIntent.setType("application/pdf")') && androidBridge.includes('Intent.EXTRA_STREAM')],
    ['iOS exposes native PDF save and sharing', iosBridge.includes('saveFieldGuidePdf') && iosBridge.includes('shareFieldGuidePdf') && iosBridge.includes('try data.write(to: outputURL') && iosBridge.includes('UIActivityViewController(')],
    ['iOS saves one automatic app-folder copy', iosBridge.includes('notificationOccurred(.success)') && !iosBridge.includes('UIDocumentPickerViewController(forExporting:')],
    ['iOS PDF names use the prompt and a unique timestamp', iosBridge.includes('uniquePdfFilename(question, title, filename)') && iosBridge.includes('now.getMilliseconds()')],
    ['iOS waits for WebKit content before rendering PDFs', iosBridge.includes('OffGridHTMLPDFRenderJob') && iosBridge.includes('await Promise.all(images.map') && iosBridge.includes('document.fonts.ready') && iosBridge.includes('webView.viewPrintFormatter()') && !iosBridge.includes('UIMarkupTextPrintFormatter')],
    ['iOS rejects suspiciously blank PDF output', iosBridge.includes('data.count > 4_096') && iosBridge.includes('rendered without its content')],
    ['iOS PDF uses larger mobile-friendly type and tighter margins', iosBridge.includes('font-size: 18px !important') && iosBridge.includes('max-height: 736px !important') && iosBridge.includes('CGRect(x: 24, y: 24, width: 564, height: 744)')],
    ['iOS keeps and previews Saved Field Guides', iosBridge.includes('openSavedGuides') && iosBridge.includes('Field Guides') && iosBridge.includes('QLPreviewController')],
    ['iOS Saved Guides opens its managed folder directly', iosBridge.includes('presentFilesBrowser(startingAt: directory)') && iosBridge.includes('picker.directoryURL = directory') && iosBridge.includes('picker.delegate = self')],
    ['iOS creates its Field Guides folder during app startup', iosBridge.includes('override func capacitorDidLoad()') && iosBridge.includes('prepareFieldGuidesDirectory()')],
    ['iOS uses the custom Capacitor bridge controller', iosStoryboard.includes('customClass="OffGridBridgeViewController"') && iosStoryboard.includes('customModule="App"')],
    ['iOS installs the bridge after Capacitor assigns its content controller', iosBridge.includes('override func webView(with frame: CGRect, configuration: WKWebViewConfiguration)') && !iosBridge.includes('override func webViewConfiguration(')],
    ['iOS keeps the app header below the system status bar after reloads', iosBridge.includes('setOverlaysWebView({ overlay: true })') && iosBridge.includes('setOverlaysWebView({ overlay: false })') && iosBridge.includes("window.addEventListener('pageshow', applyIosStatusBarLayout)") && html.includes('setOverlaysWebView({ overlay: true })') && html.includes('setOverlaysWebView({ overlay: false })')],
    ['iOS exposes app documents in Files', iosInfoPlist.includes('<key>UIFileSharingEnabled</key>') && iosInfoPlist.includes('<key>LSSupportsOpeningDocumentsInPlace</key>')],
    ['iOS Voice Input uses native speech recognition', iosBridge.includes('SFSpeechRecognizer(locale:') && iosBridge.includes('SFSpeechAudioBufferRecognitionRequest()') && iosBridge.includes("send('startVoiceInput', [])") && iosBridge.includes("window.addEventListener('offgrid-native-voice-result'")],
    ['iOS video selection and frame extraction use native frameworks', iosBridge.includes('PHPickerViewControllerDelegate') && iosBridge.includes('AVAssetImageGenerator(asset: asset)') && iosBridge.includes("send('pickVideo', [source])") && iosBridge.includes("window.addEventListener('offgrid-native-video-ready'") && html.includes('function acceptNativeVideoSelection(details)')],
    ['iOS native video picker prepares the attachment UI', iosBridge.includes('const prepareVideoChat = () =>') && (iosBridge.match(/prepareVideoChat\(\);/g) || []).length >= 3 && /function acceptNativeVideoSelection\(details\)[\s\S]*?!document\.getElementById\('videoPreview'\)[\s\S]*?transitionToChat\(\)/.test(html)],
    ['browser video picker can reselect the same clip', /function triggerVideoUpload\(\)[\s\S]*?input\.value = '';[\s\S]*?input\.click\(\);/.test(html)],
    ['iOS declares microphone and speech permission reasons', iosInfoPlist.includes('<key>NSMicrophoneUsageDescription</key>') && iosInfoPlist.includes('<key>NSSpeechRecognitionUsageDescription</key>')],
    ['app navigation keeps OffGrid prompt pages inside Capacitor', mobileConfig.includes("allowNavigation: ['offgridtoolkit.ai']")],
    ['generated-image actions share image and whole field guide', html.includes('onclick="shareOnlineStudioFieldGuide()">Share Field Guide</button>') && html.includes('>Share Image</button>')],
    ['image generation communicates expected wait', html.includes('This usually takes about one minute. Keep the app open') && html.includes('Generating image - usually about 60 seconds')],
    ['field-guide creation preserves source Markdown', html.includes('messageDiv.dataset.sourceMarkdown = fullResponse') && html.includes('const answerText = getMessageSourceText(messageEl)')],
    ['shared images include Image Studio attribution', html.includes('Made with OffGrid AI Image Studio') && androidBridge.includes('Made with OffGrid AI Image Studio.')],
    ['Android PDF preserves Markdown styling', androidBridge.includes('drawMarkdown(answer, 16.5f)') && androidBridge.includes('Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY)') && !androidBridge.includes('markdownToPlainText(answer)')],
    ['Android PDF uses mobile-friendly page and list indents', androidBridge.includes('PAGE_WIDTH = 540') && androidBridge.includes('PAGE_HEIGHT = 900') && androidBridge.includes('new LeadingMarginSpan.Standard(16, 38)')],
    ['older Android builds receive a fallback', html.includes('App update required for direct sharing')],
    ['successful native save returns to app', /if \(result\.ok\) \{[\s\S]*?markSavedGuideAvailable\(\);\s*closeAppPdfPreview\(\);\s*showSaveToast\('PDF saved'/.test(html)],
    ['field guide PDF omits model metadata', !html.includes('**Model:** ${MODEL_DISPLAY') && !html.includes('frontmatter += `model: ${selectedModel}')],
    ['field guide PDF title has compact line height', /h1 \{[\s\S]*?line-height: 1\.2;/.test(server)],
    ['generated images open the zoom view', html.includes('function openImageZoom(') && html.includes('Open generated image in zoom view')],
    ['generated image actions include New Field Guide', html.includes('onclick="startNewFieldGuide()">New Field Guide</button>')],
    ['generated image actions use an even two-column grid', css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));') && /button\.new-guide \{\s*grid-column: 2;/.test(css)],
    ['wide phones show explicit theme mode labels', html.includes("isNight ? 'Light Mode' : 'Dark Mode'") && css.includes('@media (min-width: 390px) and (max-width: 768px)')],
    ['home action opens Saved Guides directly', (html.match(/onclick="requestOpenSavedGuides\(\)"/g) || []).length >= 2 && html.includes('Open your offline field guide PDFs')],
    ['multi-image is default with a single-image rollback', server.includes("req.query.preview !== 'single-image'") && html.includes("CONFIG.features?.multiImagePreview === true")],
    ['multi-image requests are limited to four photos', html.includes('MAX_SELECTED_IMAGES = MULTI_IMAGE_PREVIEW_ENABLED ? 4 : 1') && server.includes('msg.images.slice(0, 4)')],
    ['multi-image picker and removable thumbnails', html.includes("'multiple' : ''") && html.includes('imagePreviewGrid') && html.includes('removeImage(index)')],
    ['phone upload uses the image picker without duplicate camera intents', html.includes("label: MULTI_IMAGE_PREVIEW_ENABLED ? 'Upload Image(s)'") && html.includes("const uploadInputId = 'galleryInput'")],
    ['multiple photos are sent as a coherent evidence set', html.includes('historyEntry.images = selectedImages.map') && server.includes('Treat them as one evidence set')],
    ['preview prioritizes Ready-Made Prompts', html.includes('data-home-action="prompts"') && css.includes('body.is-multi-image-preview [data-home-action="prompts"] { order: 1; }')],
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

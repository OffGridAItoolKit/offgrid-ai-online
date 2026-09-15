const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const infoPlist = fs.readFileSync(path.join(root, 'mobile-app/ios/App/App/Info.plist'), 'utf8');
const iosBridge = fs.readFileSync(path.join(root, 'mobile-app/ios/App/App/AppDelegate.swift'), 'utf8');
const capacitorConfig = fs.readFileSync(path.join(root, 'mobile-app/capacitor.config.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'offgridai.css'), 'utf8');

const checks = [
  ['build 6 uses a new versioned AI consent key', index.includes("const AI_DATA_CONSENT_VERSION = '2026-09-15-v3'")],
  ['build 6 uses a new contextual media-consent version', index.includes("const AI_MEDIA_CONSENT_VERSION = '2026-09-15-v3'")],
  ['iOS app requires versioned consent while legacy surfaces keep prior first-run state', index.includes("const IS_IOS_APP = IS_APP_SURFACE && ACTIVE_PLATFORM === 'ios'") && index.includes('const needsFirstRunConsent = !hasCompletedRequiredFirstRun()')],
  ['all permitted iOS recipients appear before consent', ['Apple Speech Recognition', 'Render', 'OpenRouter', 'NextBit', 'Venice', 'Parasail', 'Novita', 'Google Cloud Vertex AI'].every(name => index.includes(name))],
  ['consent is a dedicated AI permission with separate allow and decline choices', index.includes('AI DATA SHARING PERMISSION') && index.includes('Allow third-party AI processing?') && index.includes("declineButton.textContent = 'Don\\u2019t Allow'") && index.includes("acceptButton.textContent = 'Allow Third-Party AI'")],
  ['iOS consent is not bundled with the legacy terms and safety checkbox', index.includes("if (termsBlock) termsBlock.style.display = 'none';") && index.includes('if (!IS_IOS_APP && (!checkbox || !checkbox.checked)) return;')],
  ['consent disclosure identifies submitted personal data', index.includes('These items are personal data when they identify you or another person.') && index.includes('The personal data you choose to submit is used only to complete the feature you request.')],
  ['consent disclosure distinguishes primary Gemma processors from the Vertex fallback', index.includes('for Google Gemma 4 processing') && index.includes('If all four are unavailable')],
  ['Image Studio recipient and purpose are disclosed before consent', index.includes('Vertex AI also processes Image Studio text prompts.')],
  ['iOS consent contains no obsolete OpenAI recipient', !index.includes('OpenAI')],
  ['iOS native sync pins the hosted experience to the iOS platform', capacitorConfig.includes('OFFGRID_MOBILE_PLATFORM') && capacitorConfig.includes('`&platform=${mobilePlatform}`')],
  ['AI permission choices remain visible while disclosure text scrolls', css.includes('.first-run-banner.is-ai-consent .first-run-message') && css.includes('overflow-y: auto;') && css.includes('.first-run-banner.is-ai-consent .first-run-actions') && css.includes('flex: 0 0 auto;')],
  ['speech provider wording is platform-specific', index.includes("ACTIVE_PLATFORM === 'ios'") && index.includes('Apple Speech Recognition')],
  ['AI send is blocked without consent', index.includes('async function sendMessage() {\n            if (!requireAiDataConsent()) return;')],
  ['native iOS Voice Input fails closed without current consent', index.includes('window.offgridHasAiDataConsent = hasAiDataConsent;') && iosBridge.includes("if (typeof window.offgridHasAiDataConsent !== 'function')") && iosBridge.includes('if (!window.offgridHasAiDataConsent())') && iosBridge.indexOf('if (!window.offgridHasAiDataConsent())') < iosBridge.indexOf('window.OffGridNative.startVoiceInput();')],
  ['media features are blocked without consent', ['triggerCameraCapture', 'triggerGalleryUpload', 'triggerVideoUpload', 'triggerVideoRecord'].every(name => index.includes(`function ${name}() {\n            if (!requireAiDataConsent()) return;`))],
  ['first media transfer requires contextual confirmation', index.includes('function confirmMediaTransfer()') && index.includes('if (!confirmMediaTransfer()) return;') && index.includes('This media consent remains active for future selections until you withdraw it')],
  ['face and biometric limits are explicit in transfer confirmation', index.includes('No facial recognition, biometric profile, advertising, or AI training is performed.')],
  ['media confirmation names the fixed processors and excludes Image Studio and unlisted processors', ['NextBit BF16', 'Venice BF16', 'Parasail BF16', 'Novita BF16'].every(name => index.includes(name)) && index.includes('Photos and video frames are not sent to Image Studio or any unlisted AI processor.')],
  ['media confirmation discloses iOS routing safeguards', index.includes('fixed provider allowlist, Zero Data Retention routing, and denied provider data collection')],
  ['consent withdrawal is available in both menus', (index.match(/plusMenuAction\('privacy'\)/g) || []).length === 2 && index.includes('function withdrawAiDataConsent()')],
  ['withdrawal clears both consent records', index.includes('localStorage.removeItem(AI_MEDIA_CONSENT_KEY)')],
  ['withdrawal clears historical media and resets the visible session', index.includes('conversationHistory = [];\n            sessionStorage.removeItem(\'offgrid-image-studio-payload\');') && index.includes('closeOnlineImageStudio();\n            location.reload();')],
  ['iOS Gemma requests use the exact fixed ZDR processor allowlist', server.includes("'nextbit/bf16'") && server.includes("'venice/bf16'") && server.includes("'parasail/bf16'") && server.includes("'novita/bf16'") && server.includes('only: IOS_GEMMA_PROVIDER_ORDER') && server.includes("data_collection: 'deny'" )],
  ['iOS FieldGuide retries only through the Google Vertex Gemini Pro fallback', server.includes("const FIELDGUIDE_VERTEX_FALLBACK_MODEL = 'google/gemini-2.5-pro'") && server.includes("routingProfile === 'ios' && enforceZdr") && server.includes("only: ['google-vertex']")],
  ['provider retry is limited to unavailable, transient, and overload statuses', server.includes('[404, 408, 409, 429, 500, 502, 503, 504, 529].includes(status)')],
  ['stream parser buffers split events and rejects empty replies', index.includes("let streamBuffer = ''") && index.includes('The AI service returned an empty response. Please try again.')],
  ['iOS Image Studio text helpers use the fixed Gemma route', server.includes("function getImageStudioTextModel(req)") && server.includes("return getRequestRoutingProfile(req) === 'ios'\n        ? GEMMA_MODELS['gemma-4-26b'].id") && (server.match(/const textModel = getImageStudioTextModel\(req\);/g) || []).length === 3],
  ['Android and web Image Studio text helpers retain the legacy model route', server.includes(": 'openai/gpt-4.1-mini';") && server.includes("if (routingProfile !== 'ios') return LEGACY_ZDR_POLICY;")],
  ['iOS permission strings name the fixed media route and fallback', ['Render and OpenRouter', 'NextBit', 'Venice', 'Parasail', 'Novita', 'Google Cloud Vertex AI only if all four fail'].every(name => infoPlist.includes(name))],
  ['iOS microphone purpose string distinguishes local video audio from speech transcription', infoPlist.includes('Recorded-video audio is not uploaded') && infoPlist.includes('Apple Speech Recognition may process dictated audio')],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;

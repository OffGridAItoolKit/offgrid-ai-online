const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const infoPlist = fs.readFileSync(path.join(root, 'mobile-app/ios/App/App/Info.plist'), 'utf8');
const project = fs.readFileSync(path.join(root, 'mobile-app/ios/App/App.xcodeproj/project.pbxproj'), 'utf8');

const checks = [
  ['versioned AI consent key', index.includes("const AI_DATA_CONSENT_VERSION = '2026-09-11-v1'")],
  ['versioned contextual media consent', index.includes("const AI_MEDIA_CONSENT_VERSION = '2026-09-11-v1'")],
  ['legacy consent cannot bypass new disclosure', index.includes('const needsFirstRunConsent = !hasAiDataConsent()')],
  ['named recipients appear before consent', ['Render', 'OpenRouter', 'Google Vertex AI', 'OpenAI'].every(name => index.includes(name))],
  ['speech provider wording is platform-specific', index.includes("ACTIVE_PLATFORM === 'ios'") && index.includes("'Apple Speech Recognition'")],
  ['AI send is blocked without consent', index.includes('async function sendMessage() {\n            if (!requireAiDataConsent()) return;')],
  ['media features are blocked without consent', ['triggerCameraCapture', 'triggerGalleryUpload', 'triggerVideoUpload', 'triggerVideoRecord'].every(name => index.includes(`function ${name}() {\n            if (!requireAiDataConsent()) return;`))],
  ['first media transfer requires contextual confirmation', index.includes('function confirmMediaTransfer()') && index.includes('if (!confirmMediaTransfer()) return;') && index.includes('This media consent remains active for future selections until you withdraw it')],
  ['face and biometric limits are explicit in transfer confirmation', index.includes('No facial recognition, biometric profile, advertising, or AI training is performed.')],
  ['consent withdrawal is available in both menus', (index.match(/plusMenuAction\('privacy'\)/g) || []).length === 2 && index.includes('function withdrawAiDataConsent()')],
  ['withdrawal clears both consent records', index.includes('localStorage.removeItem(AI_MEDIA_CONSENT_KEY)')],
  ['Google requests are pinned to Vertex ZDR', server.includes("only: ['google-vertex']") && server.includes("data_collection: 'deny'") && server.includes('allow_fallbacks: false')],
  ['OpenAI text requests are pinned to OpenAI ZDR', server.includes("only: ['openai']")],
  ['iOS permission strings name the media data route', infoPlist.includes('Render and OpenRouter to Google Vertex AI')],
  ['iOS build number is 4', (project.match(/CURRENT_PROJECT_VERSION = 4;/g) || []).length === 2],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;

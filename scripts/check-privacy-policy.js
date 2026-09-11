const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
const deletion = fs.readFileSync(path.join(root, 'data-deletion.html'), 'utf8');

const checks = [
  ['September 11 policy revision', privacy.includes('Last updated September 11, 2026')],
  ['explicit AI consent and withdrawal heading', privacy.includes('<h2>AI Data Consent And Withdrawal</h2>')],
  ['iOS consent flow is scoped to the iOS app', privacy.includes('<strong>iOS app:</strong> Before any online AI feature can send data') && privacy.includes('Withdraw AI Data Consent')],
  ['Android and web acknowledgment is described separately', privacy.includes('<strong>Android and web:</strong> These experiences use their existing first-run safety-and-privacy acknowledgment')],
  ['explicit face-data heading', privacy.includes('<h2>Photos, Video Frames, And Face Data</h2>')],
  ['face-data collection is narrowly described', privacy.includes('visible image of that person\'s face')],
  ['face recognition and biometrics are disclaimed', privacy.includes('does not detect, recognize, identify, authenticate, map, measure, track, or compare faces')],
  ['face-data use sharing retention deletion described', ['Use and sharing:', 'Storage and retention:', 'Deletion:'].every(text => privacy.includes(text))],
  ['all fixed iOS processors are disclosed', ['Apple Speech Recognition', 'Render', 'OpenRouter', 'NextBit BF16', 'Venice BF16', 'Parasail BF16', 'Novita BF16', 'Google Cloud Vertex AI'].every(text => privacy.includes(text))],
  ['iOS Gemma and Vertex fallback order is disclosed', privacy.includes('Only if all four Gemma 4 processors fail') && privacy.includes('Gemini 2.5 Pro through Google Cloud Vertex AI')],
  ['Image Studio purposes are separated', privacy.includes('text-only Image Studio prompt preparation') && privacy.includes('Google-powered Image Studio generation')],
  ['photos and frames are excluded from Image Studio', privacy.includes('Photos and video frames are not sent to Image Studio')],
  ['privacy policy contains no obsolete iOS OpenAI recipient', !privacy.includes('OpenAI')],
  ['raw video is not transferred', privacy.includes('A raw video file is not transferred')],
  ['media limits are disclosed', privacy.includes('up to eight JPEG frames') && privacy.includes('1024 by 1024 pixels')],
  ['iOS fixed allowlist, ZDR, and collection restrictions disclosed', privacy.includes('fixed provider allowlist') && privacy.includes('Zero Data Retention') && privacy.includes('denied provider data collection')],
  ['Android and web legacy ZDR routing is separate', privacy.includes('<strong>Android and web route:</strong>') && privacy.includes('legacy OpenRouter Zero Data Retention route') && privacy.includes('do not use the fixed iOS processor allowlist')],
  ['explicit Data Retention heading', privacy.includes('<h2>Data Retention</h2>')],
  ['explicit Data Deletion heading', privacy.includes('<h2>Data Deletion</h2>')],
  ['no cloud account history disclosure', privacy.includes('does not create user accounts or retain a cloud chat, face, or media history')],
  ['31-day anonymous-counter retention', privacy.includes('automatically deleted after 31 days')],
  ['7-day non-content Render log retention', privacy.includes('Render service logs') && privacy.includes('for up to 7 days')],
  ['deletion request email', privacy.includes('OffGrid%20AI%20FieldGuide%20Data%20Deletion%20Request')],
  ['deletion instructions link', privacy.includes('href="/data-deletion"')],
  ['local-file deletion instructions', privacy.includes('Gallery or Files app')],
  ['standalone deletion page', deletion.includes('<h1>Request Data Deletion</h1>')],
  ['standalone deletion request procedure', deletion.includes('support@offgridaitoolkit.com')],
  ['iOS consent withdrawal instructions', deletion.includes('<strong>iOS app:</strong>') && deletion.includes('Withdraw AI Data Consent')],
  ['deletion page separates Android and web', deletion.includes('<strong>Android and web:</strong>') && deletion.includes('do not use the iOS named-provider consent control')],
  ['deletion page distinguishes fixed iOS and legacy routes', deletion.includes('Every iOS AI request uses a fixed provider allowlist') && deletion.includes('Android and web use the legacy OpenRouter Zero Data Retention route')],
  ['deletion page has exact automatic retention periods', deletion.includes('automatically deleted after 31 days') && deletion.includes('for up to 7 days')],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;


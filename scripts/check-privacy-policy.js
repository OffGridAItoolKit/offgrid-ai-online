const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
const deletion = fs.readFileSync(path.join(root, 'data-deletion.html'), 'utf8');

const checks = [
  ['September 11 policy revision', privacy.includes('Last updated September 11, 2026')],
  ['explicit AI consent and withdrawal heading', privacy.includes('<h2>AI Data Consent And Withdrawal</h2>')],
  ['explicit face-data heading', privacy.includes('<h2>Photos, Video Frames, And Face Data</h2>')],
  ['face-data collection is narrowly described', privacy.includes('visible image of that person\'s face')],
  ['face recognition and biometrics are disclaimed', privacy.includes('does not detect, recognize, identify, authenticate, map, measure, track, or compare faces')],
  ['face-data use sharing retention deletion described', ['Use and sharing:', 'Storage and retention:', 'Deletion:'].every(text => privacy.includes(text))],
  ['named processors are disclosed', ['Render', 'OpenRouter', 'Google Vertex AI', 'OpenAI'].every(text => privacy.includes(text))],
  ['raw video is not transferred', privacy.includes('A raw video file is not transferred')],
  ['media limits are disclosed', privacy.includes('up to eight JPEG frames') && privacy.includes('1024 by 1024 pixels')],
  ['ZDR and collection restrictions disclosed', privacy.includes('Zero Data Retention') && privacy.includes('provider data collection denied')],
  ['explicit Data Retention heading', privacy.includes('<h2>Data Retention</h2>')],
  ['explicit Data Deletion heading', privacy.includes('<h2>Data Deletion</h2>')],
  ['no cloud account history disclosure', privacy.includes('does not create user accounts or retain a cloud chat, face, or media history')],
  ['31-day anonymous-counter retention', privacy.includes('automatically deleted after 31 days')],
  ['deletion request email', privacy.includes('OffGrid%20AI%20FieldGuide%20Data%20Deletion%20Request')],
  ['deletion instructions link', privacy.includes('href="/data-deletion"')],
  ['local-file deletion instructions', privacy.includes('Gallery or Files app')],
  ['standalone deletion page', deletion.includes('<h1>Request Data Deletion</h1>')],
  ['standalone deletion request procedure', deletion.includes('support@offgridaitoolkit.com')],
  ['consent withdrawal instructions', deletion.includes('Withdraw AI Data Consent')],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;


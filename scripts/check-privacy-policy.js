const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
const deletion = fs.readFileSync(path.join(root, 'data-deletion.html'), 'utf8');

const checks = [
  ['explicit Data Retention heading', privacy.includes('<h2>Data Retention</h2>')],
  ['explicit Data Deletion heading', privacy.includes('<h2>Data Deletion</h2>')],
  ['no cloud account history disclosure', privacy.includes('does not create user accounts or retain a cloud chat or media history')],
  ['31-day anonymous-counter retention', privacy.includes('automatically deleted after 31 days')],
  ['deletion request email', privacy.includes('OffGrid%20AI%20FieldGuide%20Data%20Deletion%20Request')],
  ['deletion instructions link', privacy.includes('href="/data-deletion"')],
  ['local-file deletion instructions', privacy.includes('Gallery or Files app')],
  ['standalone deletion page', deletion.includes('<h1>Request Data Deletion</h1>')],
  ['standalone deletion request procedure', deletion.includes('support@offgridaitoolkit.com')],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;


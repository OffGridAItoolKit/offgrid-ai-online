'use strict';
// Extract the approved literal locally, never publish the proprietary prompt to GitHub.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EXPECTED_PROMPT_DIGEST } = require('../server/open-arena/prompt');
const reference = process.argv[2] || process.env.OFFGRID_DASHBOARD_REFERENCE;
if (!reference)
    throw new Error('Supply the approved offline Dashboard/index.html path.');
const match = fs
    .readFileSync(reference, 'utf8')
    .match(/fieldExpert:\s*(`(?:[^`\\]|\\.)*`)/);
if (!match || match[1].includes('${'))
    throw new Error('Expected a plain fieldExpert string literal.');
const prompt = vm
    .runInNewContext(match[1], Object.create(null), { timeout: 1000 })
    .replace(/\r\n/g, '\n');
if (
    crypto.createHash('sha256').update(prompt).digest('hex') !==
    EXPECTED_PROMPT_DIGEST
) {
    throw new Error(
        'Offline prompt differs from the approved version. Review and version the change first.',
    );
}
const destination = path.resolve(__dirname, '../.arena-pilot-prompt.txt');
fs.writeFileSync(destination, prompt, { flag: 'wx', mode: 0o600 });
console.log(
    `Verified private prompt written to ${destination}. Contents were not printed.`,
);

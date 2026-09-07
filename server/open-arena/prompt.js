'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PROMPT_VERSION = 'offline-fieldExpert-2026-05-24';
const EXPECTED_PROMPT_DIGEST =
    '2474aa8e30ffed2de095e801f771ee97c72dc5255a142acad773f3694b1f674f';

function loadPrompt(env = process.env) {
    let prompt = env.OPEN_ARENA_OFFGRID_PROMPT || '';
    if (!prompt) {
        try {
            prompt = fs.readFileSync(
                env.OPEN_ARENA_OFFGRID_PROMPT_FILE ||
                    path.resolve(__dirname, '../../.arena-pilot-prompt.txt'),
                'utf8',
            );
        } catch {
            return '';
        }
    }
    return prompt.replace(/\r\n/g, '\n');
}
const OFFGRID_PROMPT = loadPrompt();
const PROMPT_READY =
    crypto.createHash('sha256').update(OFFGRID_PROMPT).digest('hex') ===
    EXPECTED_PROMPT_DIGEST;

module.exports = {
    OFFGRID_PROMPT,
    PROMPT_VERSION,
    PROMPT_READY,
    EXPECTED_PROMPT_DIGEST,
    loadPrompt,
};

'use strict';

// Disposable, localhost-only native-picker fixture. No API requests, uploads,
// credentials, generated-model content, or production routing changes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function extract(name) {
    const start = html.search(new RegExp(`^        (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1);
    const following = html.slice(start + 1).search(/^        (?:async )?function /m);
    assert.notEqual(following, -1);
    return html.slice(start, start + 1 + following);
}
const names = ['showSaveModal', 'closeSaveModal', 'resolveKBDirectory', 'refreshKBFolderOptions',
    'pickKBDirectory', 'confirmKBBundleOverwrite', 'writeKBBundle', 'executeSave',
    'generateMarkdownContent', 'extractBase64Images', 'dataUrlToBlob', 'generateFilename',
    'showSaveToast', 'escapeHtml', 'saveOnlineStudioToKnowledgeBase'];
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const fixture = `<!doctype html><meta charset="utf-8"><title>Local KB save fixture</title>
<style>${css} body{padding:32px;background:#242424;color:white} button{padding:12px}</style>
<h1>Local Knowledge Base Save Test</h1><p>Synthetic article and one pixel image; select only a disposable test folder.</p>
<button onclick="showSaveModal()">Open Save dialog</button>
<button onclick="saveOnlineStudioToKnowledgeBase()">Studio Save</button>
<script>
let kbDirectoryHandle=null,kbDirectoryState=null,kbFolderBusy=false;
const IS_APP_SURFACE=false;
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JHYAAAAASUVORK5CYII=';
let conversationHistory=[{role:'user',content:'Synthetic shelter guide test'},{role:'assistant',content:'Fixture only. No real field advice.',image:pixel}];
let onlineStudioState={title:'Studio fixture guide',category:'Shelter & Fire',image:pixel};
function addOnlineStudioResultToChat(){}
function closeOnlineImageStudio(){}
function exportAsPDF(){alert('PDF is outside this picker fixture.');}
${names.map(extract).join('\n')}
</script>`;
const port = Number(process.env.KB_FIXTURE_PORT || 38174);
http.createServer((req, res) => {
    if (req.url !== '/') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fixture);
}).listen(port, '127.0.0.1', () => console.log(`Local KB fixture: http://localhost:${port}`));

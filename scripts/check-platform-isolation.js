const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const expectedIosGemmaProviders = [
  'nextbit/bf16',
  'venice/bf16',
  'parasail/bf16',
  'novita/bf16',
];
const iosGemmaProviderBlock = server.match(/const IOS_GEMMA_PROVIDER_ORDER = Object\.freeze\(\[([\s\S]*?)\]\);/);
const configuredIosGemmaProviders = iosGemmaProviderBlock
  ? [...iosGemmaProviderBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  : [];

const checks = [
  ['native iOS app is identified separately', page.includes("const IS_IOS_APP = IS_APP_SURFACE && ACTIVE_PLATFORM === 'ios';")],
  ['iOS main requests use a dedicated API prefix', page.includes("const FIELDGUIDE_API_PREFIX = IS_IOS_APP ? '/api/ios' : '/api';") && page.includes('`${API_BASE}${FIELDGUIDE_API_PREFIX}/stream`')],
  ['iOS Image Studio requests use a dedicated API prefix', page.includes("const IMAGE_STUDIO_API_PREFIX = IS_IOS_APP ? '/api/ios/image-studio' : '/api/image-studio';") && page.includes('`${API_BASE}${IMAGE_STUDIO_API_PREFIX}/visual-prompt`') && page.includes('`${API_BASE}${IMAGE_STUDIO_API_PREFIX}/generate-image`')],
  ['Android and web retain the legacy initialized flag', page.includes(": localStorage.getItem('offgrid-online-initialized') === 'true';")],
  ['explicit AI consent is only enforced for iOS app requests', page.includes('function requireAiDataConsent() {\n            if (!IS_IOS_APP) return true;')],
  ['contextual media consent is only enforced for iOS app requests', page.includes('function confirmMediaTransfer() {\n            if (!IS_IOS_APP) return true;')],
  ['legacy first-run wording is retained', page.includes('I understand and accept these safety and privacy notes') && page.includes('Start Using OffGrid AI')],
  ['legacy routing retains the pre-Build-4 ZDR policy', server.includes('const LEGACY_ZDR_POLICY = Object.freeze({ zdr: true });') && server.includes("if (routingProfile !== 'ios') return LEGACY_ZDR_POLICY;")],
  ['iOS Gemma uses only the approved providers in priority order', JSON.stringify(configuredIosGemmaProviders) === JSON.stringify(expectedIosGemmaProviders)],
  ['iOS Gemma policy enforces the fixed allowlist and order', server.includes('only: IOS_GEMMA_PROVIDER_ORDER,') && server.includes('order: IOS_GEMMA_PROVIDER_ORDER,') && server.includes('allow_fallbacks: true')],
  ['iOS Gemma keeps ZDR and denies provider data collection', server.includes('const IOS_GEMMA_ZDR_POLICY = Object.freeze({\n    zdr: true,\n    data_collection: \'deny\',')],
  ['iOS Gemma model selects the approved Gemma policy before generic Google routing', server.includes("if (modelId === GEMMA_MODELS['gemma-4-26b'].id) return IOS_GEMMA_ZDR_POLICY;\n    if (String(modelId).startsWith('google/')) return GOOGLE_VERTEX_ZDR_POLICY;")],
  ['only explicit iOS API paths select the iOS routing profile', server.includes("return req.path.startsWith('/api/ios/') ? 'ios' : 'legacy';")],
  ['iOS chat and stream endpoints are separately rate limited', ['/api/ios/chat', '/api/ios/stream'].every(route => (server.match(new RegExp(`app\\.use\\('${route.replaceAll('/', '\\/')}'`, 'g')) || []).length === 2)],
  ['iOS stream endpoint is registered beside the legacy endpoint', server.includes("app.post(['/api/stream', '/api/ios/stream']")],
  ['iOS Image Studio endpoints are registered', ['generate-image', 'craft-prompt', 'image-summary', 'visual-prompt'].every(route => server.includes(`/api/ios/image-studio/${route}`))],
  ['quality-first fallback is Gemini 2.5 Pro', server.includes("const FIELDGUIDE_VERTEX_FALLBACK_MODEL = 'google/gemini-2.5-pro';") && !server.includes("const FIELDGUIDE_VERTEX_FALLBACK_MODEL = 'google/gemini-2.5-flash';")],
  ['Gemini fallback remains pinned to Google Vertex', server.includes("only: ['google-vertex']") && server.includes("if (String(modelId).startsWith('google/')) return GOOGLE_VERTEX_ZDR_POLICY;") && server.includes('allow_fallbacks: false')],
  ['iOS Image Studio text helpers use the fixed Gemma route', server.includes("function getImageStudioTextModel(req)") && server.includes("return getRequestRoutingProfile(req) === 'ios'\n        ? GEMMA_MODELS['gemma-4-26b'].id") && (server.match(/const textModel = getImageStudioTextModel\(req\);/g) || []).length === 3],
  ['Android and web Image Studio text helpers retain their legacy GPT-4.1 Mini route', server.includes(": 'openai/gpt-4.1-mini';") && server.includes("if (routingProfile !== 'ios') return LEGACY_ZDR_POLICY;")],
  ['iOS Image Studio generation is pinned to Google Vertex', server.includes('provider: getZdrProviderPolicy(imageModel, getRequestRoutingProfile(req))') && server.includes("if (String(modelId).startsWith('google/')) return GOOGLE_VERTEX_ZDR_POLICY;")],
  ['Gemini fallback cannot affect legacy Android/web requests', server.includes("if (routingProfile === 'ios' && enforceZdr && modelId === GEMMA_MODELS['gemma-4-26b'].id)")],
  ['Gemma primary model remains unchanged', server.includes("id: 'google/gemma-4-26b-a4b-it'")],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}
if (failures.length) process.exitCode = 1;

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const index = read('index.html');
const css = read('offgridai.css');
const prompts = read('ready-made-prompts.html');
const studio = read('image-studio-app.html');
const plist = read('mobile-app/ios/App/App/Info.plist');
const appDelegate = read('mobile-app/ios/App/App/AppDelegate.swift');
const project = read('mobile-app/ios/App/App.xcodeproj/project.pbxproj');

const checks = [
  ['main app opts into edge-to-edge viewport handling', index.includes('viewport-fit=cover')],
  ['prompt library opts into edge-to-edge viewport handling', prompts.includes('viewport-fit=cover')],
  ['Image Studio opts into edge-to-edge viewport handling', studio.includes('viewport-fit=cover')],
  ['app responds to live viewport changes', index.includes('updateAppViewportState') && index.includes('window.visualViewport?.addEventListener')],
  ['compact and regular app widths are distinguished', index.includes('is-app-regular-width') && css.includes('body.is-app-surface.is-app-regular-width')],
  ['left and right safe areas are independent', css.includes('safe-area-inset-left') && css.includes('safe-area-inset-right')],
  ['app content uses dynamic viewport height', css.includes('--app-viewport-height') && css.includes('100dvh')],
  ['website-only controls stay hidden at Duo widths', /body\.is-app-surface \.prospect-only,[\s\S]*body\.is-app-surface \.desktop-quick-actions/.test(css)],
  ['Duo regular width keeps app actions', /is-app-regular-width \.mobile-action-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/.test(css)],
  ['Duo regular width preserves the compact app hierarchy', /is-app-regular-width:not\(\.command-theme\) \.welcome h2,[\s\S]*display: none !important/.test(css)],
  ['PDF actions respect horizontal safe areas', /\.app-pdf-floating-actions[\s\S]*safe-area-inset-left[\s\S]*safe-area-inset-right/.test(css)],
  ['portrait remains supported', plist.includes('UIInterfaceOrientationPortrait')],
  ['left landscape is supported', plist.includes('UIInterfaceOrientationLandscapeLeft')],
  ['right landscape is supported', plist.includes('UIInterfaceOrientationLandscapeRight')],
  ['full-screen compatibility mode is not forced', !plist.includes('UIRequiresFullScreen')],
  ['Xcode 27 scene lifecycle is declared', plist.includes('UIApplicationSceneManifest') && plist.includes('UISceneDelegateClassName')],
  ['scene delegate preserves Capacitor URL routing', appDelegate.includes('final class SceneDelegate') && appDelegate.includes('ApplicationDelegateProxy.shared.application')],
  ['Duo update is versioned separately from the approved build', (project.match(/CURRENT_PROJECT_VERSION = 8;/g) || []).length === 2 && (project.match(/MARKETING_VERSION = 1\.1;/g) || []).length === 2],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS ${label}`);
  else {
    failed = true;
    console.error(`FAIL ${label}`);
  }
}

if (failed) process.exit(1);
console.log(`iPhone Duo readiness checks passed (${checks.length}/${checks.length}).`);

'use strict';

// The September desktop KB fix intentionally changes these functions in the
// shared page. Keep the pre-existing release guard for every other byte of code;
// behavior inside this explicit allowlist is covered by test-kb-category-save.
function outsideDesktopKBSave(source) {
    let remainder = String(source).replace(/\r\n/g, '\n');
    for (const name of ['resolveKBDirectory', 'refreshKBFolderOptions',
        'confirmKBBundleOverwrite', 'writeKBBundle', 'fieldGuideTitle', 'savedFieldGuideMarkdown']) {
        remainder = remainder.replace(new RegExp(`^        (?:async )?function ${name}\\([\\s\\S]*?(?=^        (?:async )?function )`, 'm'), '');
    }
    for (const name of ['showSaveModal', 'openKnowledgeBase', 'pickKBDirectory',
        'saveOnlineStudioToKnowledgeBase', 'executeSave']) {
        const pattern = new RegExp(`^        (?:async )?function ${name}\\([\\s\\S]*?(?=^        (?:async )?function )`, 'm');
        if (!pattern.test(remainder)) throw new Error(`Missing protected KB boundary: ${name}`);
        remainder = remainder.replace(pattern, `        // TESTED_DESKTOP_KB_FUNCTION_${name}\n`);
    }
    // Normalize only the new guide branches in shared PDF/image functions.
    // Other changes to their bodies still fail the release comparison.
    remainder = remainder
        .replace('function extractBase64Images(messages = conversationHistory) {\n            const images = [];\n            messages.forEach', 'function extractBase64Images() {\n            const images = [];\n            conversationHistory.forEach')
        .replace("const title = IS_PHONE_SURFACE ? (onlineStudioState.title || 'OffGrid AI Visual Guide') : fieldGuideTitle(onlineStudioState);", "const title = onlineStudioState.title || 'OffGrid AI Visual Guide';")
        .replace("IS_PHONE_SURFACE ? generateImageStudioFieldGuideMarkdown(title, category)\n                : savedFieldGuideMarkdown(onlineStudioState, title, category, '')", "generateImageStudioFieldGuideMarkdown(title, category)")
        .replace("const guide = document.getElementById('saveModal')?.fieldGuide;\n            const markdownContent = guide ? savedFieldGuideMarkdown(guide, title, category, tags) : generateMarkdownContent(title, category, tags);", "const markdownContent = generateMarkdownContent(title, category, tags);");
    return remainder
        .replace(/^        let kbDirectoryHandle = null;[^\n]*/m, '        let kbDirectoryHandle = null;')
        .replace(/^        let kbDirectoryState = null;\n/m, '')
        .replace(/^        let kbFolderBusy = false;\n/m, '')
        .replace(/^        \/\/ Resolve existing folders only\.[^\n]*\n        \/\/ Saved Knowledge Base;[^\n]*\n/m, '')
        .replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
}

module.exports = { outsideDesktopKBSave };

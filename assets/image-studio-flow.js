/* Standalone Studio only. Store apps keep their existing prompt and image contracts. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ImageStudioFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const formats = Object.freeze({
        auto: 'Choose the layout that best fits the requested image. Keep labels legible and avoid overcrowding.',
        phone: 'Portrait 4:5 field card, large phone-readable labels, generous spacing, at most 3–5 key sections.',
        print: 'Portrait 3:4 printable reference, light background, clear hierarchy, generous print margins and legible labels.',
        landscape: 'Landscape 16:9 diagram, clear left-to-right organization, ample spacing and readable annotations.',
        square: 'Square 1:1 composition, balanced layout and large readable labels.'
    });
    const accuracy = 'Preserve supplied facts and exact requested wording. Do not invent measurements, electrical ratings, medical doses, quotations or species-identification claims. Use placeholders for missing specifications. Do not generate branding, credits, footers, dates or watermarks.';
    function signature({ mode, request, category, format }) {
        return JSON.stringify([mode, request.trim(), category, format]);
    }
    function promptRequest({ mode, request, category, format }) {
        const text = request.trim();
        if (!text) throw new Error('Describe your image or paste your article first.');
        if (mode === 'article') return {
            endpoint: '/api/image-studio/visual-prompt',
            body: { conversationContext: text, category }
        };
        return {
            endpoint: '/api/image-studio/craft-prompt',
            body: { category, description: `${text}\n\nLayout: ${formats[format] || formats.auto}\n${accuracy}` }
        };
    }
    function imagePrompt(prompt, mode, format) {
        // Article handoffs with Auto retain the established output prompt exactly.
        if (mode === 'article' && format === 'auto') return prompt.trim();
        return `${prompt.trim()}\n\nLayout: ${formats[format] || formats.auto}\n${accuracy}`;
    }
    return { formats, signature, promptRequest, imagePrompt };
});

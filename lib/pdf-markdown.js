const { marked } = require('marked');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function decodeAttributeForProtocolCheck(value) {
    return String(value ?? '')
        .replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&colon;/gi, ':')
        .replace(/&Tab;|&NewLine;/gi, '')
        .trim()
        .toLowerCase();
}

function safeRenderedAttribute(attribute, rawValue) {
    const normalized = decodeAttributeForProtocolCheck(rawValue);
    const commonSafe = normalized.startsWith('https://')
        || normalized.startsWith('http://')
        || normalized.startsWith('/')
        || normalized.startsWith('./')
        || normalized.startsWith('../')
        || normalized.startsWith('#');

    if (attribute.toLowerCase() === 'href') {
        return commonSafe || normalized.startsWith('mailto:');
    }

    return commonSafe || /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(normalized);
}

function sanitizeRenderedMarkdown(html) {
    return String(html ?? '')
        .replace(/\s(?:on\w+|style)=(?:"[^"]*"|'[^']*')/gi, '')
        .replace(/\s(href|src)="([^"]*)"/gi, (match, attribute, value) => (
            safeRenderedAttribute(attribute, value) ? match : ''
        ));
}

function markdownToHtml(markdown) {
    const withoutFrontmatter = String(markdown ?? '').replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
    const withoutRawHtml = withoutFrontmatter.replace(/<\/?[A-Za-z][^>]*>/g, escapeHtml);
    const rendered = marked.parse(withoutRawHtml, {
        async: false,
        breaks: false,
        gfm: true
    });

    return sanitizeRenderedMarkdown(rendered);
}

module.exports = {
    markdownToHtml,
    sanitizeRenderedMarkdown
};

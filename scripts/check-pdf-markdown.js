const { markdownToHtml } = require('../lib/pdf-markdown');

const sample = `---
title: "Formatting check"
---

# Field Guide

Here is **bold guidance**, *supporting detail*, and \`inline code\`.

- **Water:** Carry a filter.
- Shelter and warmth

1. Stop and assess.
2. Choose the safest route.

> Verify conditions before acting.

| Priority | Action |
| --- | --- |
| High | Find water |

[Safe link](https://offgridtoolkit.ai)
[Unsafe link](javascript:alert(1))
<script>alert('no')</script>
`;

const html = markdownToHtml(sample);
const checks = [
    ['frontmatter removed', !html.includes('Formatting check')],
    ['heading rendered', html.includes('<h1>Field Guide</h1>')],
    ['bold rendered', html.includes('<strong>bold guidance</strong>') && html.includes('<strong>Water:</strong>')],
    ['italic rendered', html.includes('<em>supporting detail</em>')],
    ['inline code rendered', html.includes('<code>inline code</code>')],
    ['unordered list rendered', html.includes('<ul>') && html.includes('<li><strong>Water:</strong> Carry a filter.</li>')],
    ['ordered list rendered', html.includes('<ol>') && html.includes('<li>Stop and assess.</li>')],
    ['blockquote rendered', html.includes('<blockquote>')],
    ['table rendered', html.includes('<table>') && html.includes('<th>Priority</th>')],
    ['safe link retained', html.includes('href="https://offgridtoolkit.ai"')],
    ['unsafe link neutralized', !html.includes('href="javascript:')],
    ['raw HTML escaped', !html.includes('<script>')]
];

let failures = 0;
for (const [name, passed] of checks) {
    if (passed) {
        console.log(`PASS ${name}`);
    } else {
        failures += 1;
        console.error(`FAIL ${name}`);
    }
}

if (failures) {
    console.error(`PDF Markdown checks failed (${failures}/${checks.length}).`);
    process.exit(1);
}

console.log(`PDF Markdown checks passed (${checks.length}/${checks.length}).`);

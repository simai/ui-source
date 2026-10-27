import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const template = read('src/smart/tag/js/templates/default.js');
const element = read('src/smart/tag/index.js');

test('interactive tags render the label as a native button beside the remove action', () => {
    const branch = template.split('if (context.interactive) {')[1].split('\n    return html`')[0];
    assert.match(branch, /<button\s+type="button"\s+class="sf-tag-action/);
    assert.match(branch, /\?disabled=\$\{context\.disabled\}/);
    assert.match(branch, /<\/button>\s*\$\{renderClose\(context\)\}/);
    assert.match(template, /context\.type === 'checkbox' \|\| context\.interactive \? 'sf-tag--interactive'/);
});

test('checkbox tags ignore interactive and stay one toggle button', () => {
    assert.match(element, /return this\.type !== 'checkbox' && super\.interactive;/);
});


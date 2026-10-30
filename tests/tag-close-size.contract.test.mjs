import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {closeSize} from '../src/smart/tag/js/close-size.js';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* sf-tag 1.1.6. The tag asked sf-icon-button for size 1/4 at sizes 1/2 and
   1/3, a size the button does not have, and the button fell back to size 1
   (20.39px on a 16px line). Every size the tag asks for is one the button has;
   the box itself is drawn by the tag's sheet, which reaches the Smart markup
   (the native button under the display:contents host).
   tests/browser/tag-close-geometry.browser.mjs measures it. */
test('sf-tag asks sf-icon-button only for a size the button has', async () => {
  const tag = JSON.parse(await read('smart/tag/component.json'));
  const button = JSON.parse(await read('smart/icon-button/component.json'));
  const sizes = button.settings.size.values;
  for (const size of tag.settings.size.values) {
    assert.ok(sizes.includes(closeSize(size)), `tag size ${size} asks for ${closeSize(size)}, not in ${sizes.join(', ')}`);
  }
  const template = await read('smart/tag/js/templates/default.js');
  assert.match(template, /import \{closeSize\} from '\.\.\/close-size\.js';/);
  assert.match(template, /size="\$\{closeSize\(context\.size\)\}"/);
  assert.doesNotMatch(template, /function closeSize/);
});

test('sf-tag draws its remove button in the Smart markup', async () => {
  const css = await read('smart/tag/js/templates/default.css');
  const button = '.sf-tag > sf-icon-button > .sf-icon-button.sf-icon-button--close';
  assert.ok(css.includes(`${button} {\n        padding: 0;`), 'no padding of its own');
  assert.ok(css.includes(`${button}::after {\n        content: "";\n        position: absolute;\n        inset: min(calc(var(--sf-px) * 0), calc((100% - var(--sf-c2)) / 2));`), 'target of --sf-c2');
  assert.ok(css.includes(`${button} > sf-close > .sf-close > .sf-close-icon {\n        --sf-close-icon--height: calc(var(--sf-tag--font-size) * 0.7);`), 'mark from the label');
  assert.ok(css.includes(`.sf-tag.sf-tag--inline.sf-tag--inline > sf-icon-button > .sf-icon-button.sf-icon-button--close {\n        block-size: var(--sf-tag--line, var(--sf-tag--line-height));`), 'inline: the line');
  assert.ok(css.includes(`.sf-tag:not(.sf-tag--inline):has(> .sf-tag-action) > sf-icon-button > .sf-icon-button.sf-icon-button--close {\n        margin-inline-start: max(calc(var(--sf-px) * 0), calc((var(--sf-c2) - var(--sf-tag--font-size) * 0.7) / 2));`), 'the target stays off a label that is a button');
  assert.doesNotMatch(css, /text-size-1\\\/4/);
});

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
test('sf-tag asks sf-button-icon only for a size the button has', async () => {
  const tag = JSON.parse(await read('smart/tag/component.json'));
  const button = JSON.parse(await read('smart/button-icon/component.json'));
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
  // sf-tag 1.3.5 (LK-06): the remove button is sf-button-close; the rules
  // still reach a close a page passes in the close slot as sf-button-icon.
  const button = '.sf-tag > :is(sf-button-icon, sf-icon-button) > .sf-icon-button.sf-icon-button--close';
  const closeButton = '.sf-tag > :is(sf-button-close, sf-close) > .sf-icon-button.sf-icon-button--close';
  assert.ok(css.includes(`${button},\n    ${closeButton} {\n        padding: 0;`), 'no padding of its own');
  assert.ok(css.includes(`${button}::after,\n    ${closeButton}::after {\n        content: "";\n        position: absolute;\n        inset: min(calc(var(--sf-px) * 0), calc((100% - var(--sf-c2)) / 2));`), 'target of --sf-c2');
  assert.ok(css.includes(`.sf-tag > :is(sf-button-close, sf-close) > .sf-icon-button.sf-icon-button--close > .sf-close > .sf-close-icon {\n        --sf-close-icon--height: var(--sf-tag--close-size, calc(var(--sf-tag--font-size) * 0.7));`), 'mark from the cross ladder (C14)');
  assert.ok(css.includes(`.sf-tag.sf-tag--inline.sf-tag--inline > :is(sf-button-close, sf-close) > .sf-icon-button.sf-icon-button--close {\n        block-size: var(--sf-tag--line, var(--sf-tag--line-height));`), 'inline: the line');
  assert.ok(css.includes(`.sf-tag:not(.sf-tag--inline):has(> .sf-tag-action) > :is(sf-button-close, sf-close) > .sf-icon-button.sf-icon-button--close {\n        margin-inline-start: max(calc(var(--sf-px) * 0), calc((var(--sf-c2) - var(--sf-tag--close-size, calc(var(--sf-tag--font-size) * 0.7))) / 2));`), 'the target stays off a label that is a button');
  assert.doesNotMatch(css, /text-size-1\\\/4/);
});

test('sf-tag draws its remove cross from the cross ladder, plain (C14)', async () => {
  const tags = await read('component/tags/scss/_css__tags.scss');
  for (const [size, step] of [['1\\/3', '1\\/4'], ['1\\/2', '1\\/4'], ['1', '1\\/3'], ['2', '1\\/2'], ['3', '1']]) {
    const start = tags.indexOf(`.sf-tag.sf-tag--size-${size} {\n    --sf-tag--font-size:`);
    assert.ok(start >= 0, size);
    // Size 2 takes the small step 12 (C132 #q-icons: no 14 in small parts).
    const want = size === '2' ? 'var(--sf-mark--cross-2)' : `var(--sf-text-size-${step})`;
    assert.ok(tags.slice(start, tags.indexOf('}', start)).includes(`--sf-tag--close-size: ${want};`), size);
  }
  assert.doesNotMatch(tags, /\* 0\.7\)/u, 'no cross scaled from the label');
  const css = await read('smart/tag/js/templates/default.css');
  assert.match(css, /--sf-close-icon--background-color: color-mix\(in srgb, var\(--sf-tag-color, var\(--sf-on-surface\)\) 64%, transparent\);/u);
  assert.match(css, /:not\(:disabled\):is\(:hover, :active\)/u);
  assert.match(css, /\.sf-tag > :is\(sf-button-close, sf-close\) > \.sf-icon-button\.sf-button-close\.sf-button-close--plain \{\n\s+--sf-button-close--base: var\(--sf-tag-color, var\(--sf-on-surface\)\);/u, 'the plain close takes the tag ink');
  const template = await read('smart/tag/js/templates/default.js');
  assert.match(template, /<sf-button-close\s+size="\$\{closeSize\(context\.size\)\}"\s+appearance="plain"/u, 'the remove button is sf-button-close, plain (LK-06)');
  assert.doesNotMatch(template, /<sf-button-icon\b/u, 'not the retired sf-button-icon kind="close"');
});

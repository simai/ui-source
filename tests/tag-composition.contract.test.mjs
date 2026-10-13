import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* A tag is a control of its size, its parts on the ladder like a button's.
   Measured before: a text-only label 4-8px right of centre, a picture-to-label
   step of 9 and 17px, an icon of 20px at size 1/3 (the tag 28px tall) and 24px
   at sizes 2 and 3, a count at size 1/3 in size 1/2 text (the tag 28px tall),
   and a remove mark with no glyph when the close markup carried no size class.
   tests/browser/action-composition.cli.js measures the result. */
test('tag composition: label, count, picture and mark take the ladder', async () => {
  const css = await read('component/tags/scss/_css__tags.scss');
  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(css.includes(`.sf-tag.sf-tag--size-${size} .sf-tag-container {\n  --sf-tag-container--padding-inline-start: var(--sf-ui-${size}--text-space-x);\n  --sf-tag-container--padding-inline-end: var(--sf-ui-${size}--text-space-x);`), `label ${size}`);
    assert.ok(css.includes(`.sf-tag.sf-tag--size-${size} .sf-tag-count {\n  --sf-tag-count--font-size: var(--sf-text-size-${size});\n  --sf-tag-count--line-height: var(--sf-text-height-${size});`), `count ${size}`);
    assert.ok(css.includes(`.sf-tag.sf-tag--size-${size} > .sf-icon {\n  --sf-icon--font-size: var(--sf-text-height-${size});`), `icon ${size}`);
    assert.ok(css.includes(`--sf-close-icon--width: calc(var(--sf-text-size-${size}) * 0.7);`), `mark ${size}`);
  }
  assert.match(css, /\.sf-tag > \.sf-icon-button\.sf-icon-button--close > \.sf-close > \.sf-close-icon \{\s*--sf-close-icon--mask-image: url\(/);
  assert.match(css, /\.sf-tag > \.sf-icon-button\.sf-icon-button--close::after \{\s*content: "";\s*position: absolute;\s*inset: min\(calc\(var\(--sf-px\) \* 0\), calc\(\(100% - var\(--sf-c2\)\) \/ 2\)\)/);
});

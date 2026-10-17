import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);
const SIZES = ['1\\/3', '1\\/2', '1', '2', '3'];

/* Tags are used on their own and inside other controls. On their own they take
   the density the buttons have; inside a control they sit on its text line. The
   size sets the text; density and inline move only the spacing, through one
   layer of variables that the size rules never set for sizes 1 and 1/2. */
test('tags: five sizes publish their text on the root', async () => {
  const css = await read('component/tags/scss/_css__tags.scss');
  for (const size of SIZES) {
    assert.match(css, new RegExp(`\\.sf-tag\\.sf-tag--size-${size.replace('\\', '\\\\')} \\{\\s*--sf-tag--font-size: var\\(--sf-text-size-${size.replace('\\', '\\\\')}\\);\\s*--sf-tag--line-height: var\\(--sf-text-height-${size.replace('\\', '\\\\')}\\);`), size);
  }
  // sizes 1/3, 2 and 3 borrow the type and state rules of their neighbours
  assert.ok(css.includes(':is(.sf-tag--size-1\\/2, .sf-tag--size-1\\/3)'));
  assert.ok(css.includes(':is(.sf-tag--size-1, .sf-tag--size-2, .sf-tag--size-3)'));
});

test('tags: density uses the button names and the ladder of each size', async () => {
  const css = await read('component/tags/scss/_css__tags.scss');
  for (const size of SIZES) {
    for (const [name, step] of [['compact', 'low'], ['comfortable', 'high'], ['spacious', 'highest']]) {
      assert.ok(css.includes(`.sf-tag.sf-tag--size-${size}.spacing-${name} { --sf-tag--block: var(--sf-ui-${size}--space-y-tightness-${step}); }`), `${size} ${name}`);
    }
  }
  assert.match(css, /padding-top: var\(--sf-tag--block, var\(--sf-tag--padding-top\)\);/);
});

test('tags: inline drops the block padding and sizes the remove button to the line', async () => {
  const css = await read('component/tags/scss/_css__tags.scss');
  const block = (selector) => { const i = css.indexOf(`${selector} {`); assert.notEqual(i, -1, selector); return css.slice(i, css.indexOf('}', i)); };
  const inline = block('.sf-tag.sf-tag--inline.sf-tag--inline');
  assert.match(inline, /--sf-tag--block: 0;/);
  assert.match(inline, /--sf-tag--inline-line: var\(--sf-tag--line\);/);
  assert.match(inline, /min-block-size: var\(--sf-tag--line, var\(--sf-tag--line-height\)\);/);
  const button = block('.sf-tag.sf-tag--inline.sf-tag--inline > .sf-icon-button');
  assert.match(button, /block-size: var\(--sf-tag--line, var\(--sf-tag--line-height\)\);/);
  const mark = block('.sf-tag.sf-tag--inline.sf-tag--inline .sf-close-icon');
  assert.match(mark, /--sf-close-icon--height: calc\(var\(--sf-tag--font-size\) \* 0\.7\);/);
});

test('tags: the Smart tag exposes the sizes, spacing and inline', async () => {
  const meta = await read('smart/tags/meta.mjs');
  assert.match(meta, /values: \['1\/3', '1\/2', '1', '2', '3'\]/);
  assert.match(meta, /spacing: \{\s*kind: 'enum',\s*values: \['compact', 'normal', 'comfortable', 'spacious'\]/);
  assert.match(meta, /inline: \{\s*kind: 'boolean'/);
  const template = await read('smart/tags/js/templates/default.js');
  assert.match(template, /context\.spacing && context\.spacing !== 'normal' \? `spacing-\$\{context\.spacing\}` : ''/);
  assert.match(template, /context\.inline \? 'sf-tag--inline' : ''/);
});

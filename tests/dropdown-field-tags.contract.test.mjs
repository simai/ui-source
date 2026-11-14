import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* A field holding tags must be as tall as one holding text. Measured on the
   documentation page before the first fix: a size 1 field with one tag was
   56px against 40, with two short names 106px. The tag now knows how to sit on
   a line (sf-tag--inline); the dropdown renders it one size below the field and
   tells it how tall its line is. Rendered heights were measured per size after
   each change; these assertions keep the mechanism. */
test('dropdown tags: the field publishes its line and nothing else about the tag', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(css.includes(`.sf-dropdown.sf-dropdown--size-${size} { --sf-dropdown-tag-line--height: var(--sf-text-height-${size}); }`), `size ${size}`);
    // C145 (1), variant A: a tag in the field is the field less --sf-space-1/4 above and below.
    assert.ok(css.includes(`.sf-dropdown.sf-dropdown--tag.sf-dropdown--size-${size} { --sf-dropdown-tag-line--box: calc(var(--sf-ui-${size}--control-height) - 2 * var(--sf-space-1\\/4)); }`), `tag line ${size}`);
  }
  // the picture line of a single choice is the whole text line
  assert.match(css, /--sf-dropdown-tag-line--box: var\(--sf-dropdown-tag-line--height\);/);
  // every size puts the tag on the field's tag line; the field pads it by the inset less its border
  assert.match(css, /\.sf-dropdown\.sf-dropdown--tag \.sf-dropdown-tag-container \{\s*--sf-tag--line: var\(--sf-dropdown-tag-line--box\);\s*\}/);
  assert.match(css, /\.sf-dropdown\.sf-dropdown\.sf-dropdown--tag > \.sf-dropdown-field\.sf-dropdown-field \{\s*--sf-dropdown-field--padding-top: calc\(var\(--sf-space-1\\\/4\) - var\(--sf-px\)\);/);
  // a picture is the tag less 8 and at least 16
  assert.match(css, /--sf-dropdown--tag-picture: max\(var\(--sf-b6\), calc\(var\(--sf-dropdown-tag-line--box\) - 2 \* var\(--sf-space-1\\\/4\)\)\);/);
  // the tag's own padding, font and close size are the tag's business now
  assert.doesNotMatch(css, /--sf-tag--padding-(top|bottom)|--sf-tag-container--font-size|--sf-close-icon--(height|width)/);
});

test('dropdown tags: an inline tag one size below the field at every size (C145 (1))', async () => {
  for (const file of ['component/dropdown/js/_dropdown.js', 'smart/dropdown/js/templates/default.js']) {
    const source = await read(file);
    for (const [field, tag] of [['1/2', '1/3'], ['1', '1/2'], ['2', '1']]) {
      assert.ok(source.includes(`"${field}": {size: "${tag}", height: ""}`), `${file}: ${field}`);
    }
    assert.match(source, /sf-tag--size-\$\{tagSize\} sf-tag--inline\$\{tagSpacing\}/, file);
  }
  const tags = await read('component/tags/scss/_css__tags.scss');
  assert.ok(tags.includes('.sf-tag.sf-tag--inline.sf-tag--inline.sf-tag--size-1:is(.sf-tag--height-low, .spacing-compact) { --sf-tag--block: var(--sf-ui-1--space-y-tightness-low); }'));
});

test('dropdown tags: the chevron in a tag field is no taller than the line', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  const start = css.indexOf('.sf-dropdown.sf-dropdown--tag > .sf-dropdown-field > button {');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.match(rule, /block-size: var\(--sf-dropdown-tag-line--box\);/);
  assert.match(rule, /padding: 0;/);
  // C123: the field action keeps a 24 hit area, its margins give back what
  // passes the line, so the box in the line stays the line's height.
  const actionStart = css.indexOf('.sf-dropdown.sf-dropdown--tag > .sf-dropdown-field > button.sf-field-action {');
  const action = css.slice(actionStart, css.indexOf('}', actionStart));
  assert.match(action, /block-size: max\(var\(--sf-dropdown-tag-line--box\), var\(--sf-c2\)\);/);
  assert.match(action, /margin-block: calc\(\(var\(--sf-dropdown-tag-line--box\) - max\(var\(--sf-dropdown-tag-line--box\), var\(--sf-c2\)\)\) \/ 2\);/);
});

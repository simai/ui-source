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
  }
  // the picture and tag line is the whole text line; the field's padding gives up the border
  assert.match(css, /--sf-dropdown-tag-line--box: var\(--sf-dropdown-tag-line--height\);/);
  // only size 1/2 puts the tag on the field line; from size 1 up the chip has its own line
  assert.match(css, /\.sf-dropdown\.sf-dropdown--size-1\\\/2 \.sf-dropdown-tag-container \{\s*--sf-tag--line: var\(--sf-dropdown-tag-line--box\);\s*\}/);
  for (const size of ['1', '2']) {
    assert.ok(css.includes(`.sf-dropdown.sf-dropdown.sf-dropdown--tag.sf-dropdown--size-${size} > .sf-dropdown-field.sf-dropdown-field {\n  --sf-dropdown-field--padding-top: calc(var(--sf-ui-${size}--space-y-tightness-default) - var(--sf-ui-${size}--space-y-tightness-low) - var(--sf-px));`), `field padding ${size}`);
  }
  // the tag's own padding, font and close size are the tag's business now
  assert.doesNotMatch(css, /--sf-tag--padding-(top|bottom)|--sf-tag-container--font-size|--sf-close-icon--(height|width)/);
});

test('dropdown tags: compact chips of the field size from size 1 up, one size down below', async () => {
  for (const file of ['component/dropdown/js/_dropdown.js', 'smart/dropdown/js/templates/default.js']) {
    const source = await read(file);
    for (const [field, tag, spacing] of [['1/2', '1/3', ''], ['1', '1', 'compact'], ['2', '2', 'compact']]) {
      assert.ok(source.includes(`"${field}": {size: "${tag}", spacing: "${spacing}"}`), `${file}: ${field}`);
    }
    assert.match(source, /sf-tag--size-\$\{tagSize\} sf-tag--inline\$\{tagSpacing\}/, file);
  }
  const tags = await read('component/tags/scss/_css__tags.scss');
  assert.ok(tags.includes('.sf-tag.sf-tag--inline.sf-tag--inline.sf-tag--size-1.spacing-compact { --sf-tag--block: var(--sf-ui-1--space-y-tightness-low); }'));
});

test('dropdown tags: the chevron in a tag field is no taller than the line', async () => {
  const css = await read('component/dropdown/scss/_css__custom.scss');
  const start = css.indexOf('.sf-dropdown.sf-dropdown--tag > .sf-dropdown-field > button {');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.match(rule, /block-size: var\(--sf-dropdown-tag-line--box\);/);
  assert.match(rule, /padding: 0;/);
});

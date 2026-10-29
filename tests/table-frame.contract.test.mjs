// .table-frame is the frame a table stands in: a bordered, rounded surface
// that scrolls when the columns do not fit, gridlines between the cells and a
// filled head. Consumers used to restyle .table for it -- the documentation
// site did, with its own numbers -- so what the class must keep is written
// here: the numbers come from the ladder, the frame draws the only outer edge,
// and a page that needs other numbers has public variables to set.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stylePath = 'src/utility/table-frame/default/scss/_sf_css__table_frame.scss';

test('the frame is the scroll area and the only outer edge', () => {
  const source = read(stylePath);

  assert.match(source, /\.table-frame\s*\{/u);
  assert.match(source, /overflow:\s*auto/u);
  assert.match(source, /border:\s*var\(--sf-px\) solid var\(--sf-table-frame-border-color\)/u);
  assert.match(source, /border-radius:\s*var\(--sf-table-frame-radius\)/u);
  // The frame is a surface, so its corner reads the surface role, never a
  // numbered step or the old name.
  assert.match(source, /--sf-table-frame-radius:\s*var\(--sf-radius--surface\)/u);
  assert.doesNotMatch(source, /--sf-radius-(?:default|[0-9])\b/u);
  // Dimmed text on the head's container fill reads the container role.
  assert.match(source, /--sf-on-surface-variant:\s*var\(--sf-on-surface-container--variant\)/u);
  // A collapsed border is drawn over the frame's own, and the corners come out
  // square; the table inside keeps its borders separate.
  assert.match(source, /border-collapse:\s*separate/u);
  assert.match(source, /border-spacing:\s*0/u);
  // The table gives up its own margin, border and radius to the frame.
  assert.match(source, />\s*\.table\s*\{[\s\S]*?margin:\s*0/u);
  assert.match(source, />\s*\.table\s*\{[\s\S]*?border:\s*0/u);
  assert.match(source, />\s*\.table\s*\{[\s\S]*?border-radius:\s*0/u);
  // The last column and the last row leave their edge to the frame.
  assert.match(source, /\*:last-child\s*\{\s*border-inline-end-width:\s*var\(--sf-0\)/u);
  assert.match(source, /:last-child\s*>\s*tr:last-child\s*>\s*\*\s*\{\s*border-block-end-width:\s*var\(--sf-0\)/u);
});

test('every number comes from the ladder, through a public variable', () => {
  const source = read(stylePath);

  const declared = [...source.matchAll(/--sf-table-frame-([a-z-]+):\s*([^;]+);/gu)]
    .map(([, name, value]) => [name, value.trim()]);
  assert.deepEqual(declared.map(([name]) => name), [
    'border-color',
    'radius',
    'background',
    'head-color',
    'head-padding-block',
    'cell-padding-block',
    'cell-padding-inline',
    'cell-min-inline-size',
  ]);
  // The head's fill defaults where it is laid, beside the container text role,
  // and as a fallback, so a value set on the frame still reaches the head.
  assert.doesNotMatch(source, /--sf-table-frame-head-background:/u);
  assert.match(source, /background-color:\s*var\(--sf-table-frame-head-background, var\(--sf-surface-container\)\)/u);
  // Nine public variables, each defaulting to a token of the kit: no number is
  // typed into the rule.
  for (const [name, value] of declared) {
    assert.match(value, /^var\(--sf-[a-z0-9\\/-]+(,\s*var\(--sf-[a-z0-9\\/-]+\))?\)$/u, `${name} is ${value}`);
  }
  assert.doesNotMatch(source, /:\s*\d+(\.\d+)?(px|rem|em)/u);
});

test('the full utility and RuleLoader entrypoints include table-frame', () => {
  assert.match(read('src/core/utility-full.js'), /utility\/table-frame\/default\/index\.scss/u);
  assert.match(read('src/core/js/rule.src.js'), /utility\/table-frame\/default\/rule\.js/u);
  // The rule matches its own class and nothing of the other table families.
  const rule = read('src/utility/table-frame/default/rule.js');
  const pattern = new RegExp(/^(?:table-frame)(?![\s\S])/u.source, 'u');
  assert.match(rule, /SF\.RuleLoader\['table-frame\/default'\]/u);
  assert.ok(pattern.test('table-frame'));
  assert.ok(!pattern.test('table-frame-head'));
  assert.ok(!pattern.test('table-border'));
});

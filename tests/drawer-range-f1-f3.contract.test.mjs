import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// DEV letter msg-b4a29e05 (2026-11-22), defects found while publishing the
// docs (ui-control control/evidence/2026-11-22-docs-publish-9cee-live,
// data/defects.md): F1 sf-drawer's close on a wide opener's axis, F2 the
// range slider's thumbs outside the component, F3 sf-slider-range's
// root-class on the track. The geometry is measured on the built bytes by
// tests/browser/drawer-close-axis.browser.mjs (F1) and the branch's probes.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('F1: only a compact switch, no wider than the head close cell, takes the close onto its axis', () => {
  const source = read('src/smart/drawer/index.js');
  const axis = source.slice(source.indexOf('  closeAxisSide() {'), source.indexOf('  outermostInRow('));
  assert.match(axis, /if \(seen\.width > this\.closeCellSize\(\) \+ 0\.5\) return '';/u);
  // Before the phone-wide branch: a wide opener keeps the close at the end
  // in a panel as wide as its frame too.
  assert.ok(axis.indexOf('closeCellSize()') < axis.indexOf('const whole ='));
  assert.match(axis, /closeCellSize\(\) \{[\s\S]*getComputedStyle\(head\)\.minHeight[\s\S]*inline-size:var\(--sf-ui-2--control-height\)/u);
  // The head's row is the cell: its minimum block size is that token.
  assert.match(read('src/smart/drawer/scss/_smart__drawer.scss'), /min-height: var\(--sf-ui-2--control-height\);/u);
  assert.match(read('src/smart/drawer/docs.md'), /Широкая кнопка с текстом/u);
  assert.equal(json('src/smart/drawer/component.json').version, '1.22.0'); // GB17: 1.22.0 after the layers merge (Y3 withdrawn), F1 merged onto the released 1.21.0;
  assert.equal(json('src/smart/drawer/smart.manifest.json').version, '1.22.0');
});

test('F2: the track stands half a thumb in, so the thumbs keep to the component edges', () => {
  const custom = read('src/component/range-slider/scss/_css__range_slider_custom.scss');
  assert.match(custom, /\.sf-range-slider \.sf-range-slider-base \{[^}]*margin-inline: calc\(var\(--sf-thumb-handle--width, var\(--sf-icon-size-3\)\) \/ 2\);[^}]*width: auto;/u);
  const field = read('src/component/range-slider/scss/_css__range_slider_field.scss');
  // The scale follows the inset; its end labels reach out to the edges.
  assert.match(field, /\.sf-range-slider-scale \{[^}]*margin-inline: calc\(var\(--sf-thumb-handle--width, var\(--sf-icon-size-3\)\) \/ 2\);/u);
  assert.match(field, /\.sf-range-slider-scale-mark--start \{[^}]*margin-inline-start: calc\(var\(--sf-thumb-handle--width, var\(--sf-icon-size-3\)\) \/ -2\);/u);
  assert.match(field, /\.sf-range-slider-scale-mark--end \{[^}]*margin-inline-start: calc\(var\(--sf-thumb-handle--width, var\(--sf-icon-size-3\)\) \/ 2\);/u);
  // A read-only frame keeps its own inline space for the track.
  assert.match(field, /\.sf-range-slider-group\.readonly \.sf-range-slider \.sf-range-slider-base \{\s*margin-inline: 0;/u);
  assert.equal(json('src/component/range-slider/passport.json').version, '1.10.0');
});

test('F3: root-class and root-style land on the drawn root, the group', () => {
  const template = read('src/smart/slider-range/js/templates/default.js');
  const group = template.slice(template.indexOf('const groupClasses'), template.indexOf('const rootClasses'));
  const track = template.slice(template.indexOf('const rootClasses'), template.indexOf('return html`', template.indexOf('const rootClasses')));
  assert.match(group, /context\.rootClass,/u);
  assert.doesNotMatch(track, /context\.rootClass/u);
  assert.match(template, /<div class=\$\{groupClasses\} style=\$\{valueOrNothing\(context\.rootStyle\)\}>/u);
  assert.equal((template.match(/context\.rootStyle/gu) || []).length, 1);
  const source = read('src/smart/slider-range/index.js');
  assert.match(source, /const group = root\.closest\('\.sf-range-slider-group'\) \|\| root;[\s\S]{0,120}group\.setAttribute\('style', style\)/u);
  assert.equal(json('src/smart/slider-range/component.json').version, '1.8.0');
  assert.equal(json('src/smart/slider-range/smart.manifest.json').version, '1.8.0');
  const journal = json('contracts/changes/journal.json').records.map((record) => record.id);
  for (const id of ['behaviour-drawer-close-axis-compact-switch-only', 'behaviour-slider-range-root-class-on-group', 'behaviour-range-slider-track-half-thumb-inset']) {
    assert.ok(journal.includes(id), id);
  }
});

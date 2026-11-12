// Gradients in components (owner decisions C91 and C92, 2026-11-12): level 1
// is on by default and functional only -- the scroll-edge fade and text on a
// picture in three looks; level 2 is decorative, off by default, and turned on
// by a component's expressive setting or data-sf-style="expressive" on the
// root or a container (the nearest data-sf-style wins); level 3 is recipes,
// never a component.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const figure = read('src/component/figure/scss/_css__figure.scss');
const kinds = read('src/utility/gradient/default/scss/_sf_css__gradient_kind.scss');
const LEVEL2 = {
  'src/component/figure/scss/_css__figure.scss': '.sf-figure.sf-figure--expressive',
  'src/component/avatars/scss/_css__avatars.scss': '.sf-avatar.sf-avatar--expressive',
  'src/smart/empty-state/scss/_smart__empty_state.scss': '.sf-empty-state.sf-empty-state--expressive',
  'src/smart/header-page/scss/_smart__page_header.scss': '.sf-page-header.sf-page-header--expressive',
};

test('text on a picture: the figure over caption is the utility scrim, the plate black 64, nothing else', () => {
  const steps = (text) => [...text.matchAll(/var\(--sf-black--alfa-(\d+)\)/gu)].map(([, step]) => Number(step));
  const over = figure.slice(figure.indexOf('.sf-figure.sf-figure--caption-over > .sf-figure-caption {'), figure.indexOf('// Look 5'));
  const scrim = kinds.slice(kinds.indexOf('.gradient-scrim {'), kinds.indexOf('.gradient-scrim.gradient-scrim-plate {'));
  // the plain line and the OKLab line carry the same steps
  assert.deepEqual(steps(over), [...steps(scrim), ...steps(scrim)]);
  assert.deepEqual(steps(scrim), [64, 64, 48, 28, 16, 8]);
  assert.match(over, /padding-block-start: var\(--sf-figure--ramp\);/u, 'the ramp is the top padding');
  assert.match(figure, /\.sf-figure\.sf-figure--caption-plate > \.sf-figure-caption \{\n {4}background-color: var\(--sf-black--alfa-64\);/u);
  // C92 drops the radial spot, the blur band and the shadow-only look.
  for (const sheet of [figure, kinds]) assert.doesNotMatch(sheet, /backdrop-filter|text-shadow|radial-gradient\(closest-side/u);
});

test('the scroll-edge fade is on by default, a mask, at the edges the content goes on past', () => {
  const sheet = read('src/component/scrollbar/scss/_css__scrollbar.scss');
  const script = read('src/component/scrollbar/js/_scrollbar.js');
  assert.match(script, /const more = before && after \? 'both' : before \? 'start' : after \? 'end' : '';/u);
  assert.match(script, /delete this\.root\.dataset\.sfScrollbarMore;/u);
  assert.match(sheet, /\.sf-scrollbar\[data-sf-scrollbar-more\]:not\(\[data-mode="standard"\], :not\(\[data-mode\]\)\[data-sf-scrollbar="standard"\]\) \.sf-scrollbar__viewport \{\n {4}mask-image: linear-gradient\(/u);
  assert.match(sheet, /--sf-scrollbar--fade-end: var\(--sf-scrollbar-fade-size, var\(--sf-space-2\)\);/u);
  assert.doesNotMatch(sheet.slice(sheet.indexOf('The scroll-edge fade'), sheet.indexOf('.sf-scrollbar__thumb:focus-visible')), /background/u, 'a mask, never a paint');
});

test('level 2 is off unless the component or the nearest data-sf-style says expressive', () => {
  for (const [path, own] of Object.entries(LEVEL2)) {
    const sheet = read(path);
    assert.ok(sheet.includes(':where([data-sf-style="expressive"]) {\n') && /:where\(\[data-sf-style="expressive"\]\) \{\n\s+--sf-style--expressive: 1;/u.test(sheet), `${path}: the theme switch`);
    assert.match(sheet, /:where\(\[data-sf-style="strict"\]\) \{\n\s+--sf-style--expressive: 0;/u, `${path}: strict turns it off`);
    assert.ok(sheet.includes(`${own} {`), `${path}: the component's own switch`);
    // Off by default: every read of the switch falls back to 0.
    for (const [read] of sheet.matchAll(/var\(--sf-style--expressive[^)]*\)/gu)) assert.equal(read, 'var(--sf-style--expressive, 0)', `${path}: ${read}`);
    // Roles and alpha steps only; the switch sizes the paint, no colour mixing.
    assert.doesNotMatch(sheet, /color-mix\(/u, `${path}: no colour mixed at the point of use`);
  }
  for (const name of ['empty-state', 'avatar', 'header-page']) {
    const manifest = JSON.parse(read(`src/smart/${name}/smart.manifest.json`));
    assert.deepEqual(Object.fromEntries(Object.entries(manifest.inputs.properties.expressive).filter(([key]) => key !== 'description')), {type: 'boolean', default: false}, name);
  }
});

test('level 3 is recipes: no component sheet draws a hero, promo, intro, filled heading or chart area', () => {
  const sheets = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sheets(path) : /\.(?:scss|css|js)$/u.test(name) && !/\.min\./u.test(name) ? [path] : [];
  });
  const found = [];
  for (const area of ['component', 'smart']) {
    for (const path of sheets(resolve(root, 'src', area))) {
      if (/\/(?:css|static)\//u.test(path)) continue;
      // The recipe parts: glow (hero), duo (promo), tint (intro plate), text
      // (a filled heading).
      if (/gradient-(?:glow|duo|tint|text)\b/u.test(readFileSync(path, 'utf8'))) found.push(path.slice(root.length + 1));
    }
  }
  assert.deepEqual(found, []);
});

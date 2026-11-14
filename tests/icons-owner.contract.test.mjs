import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = path => readFile(new URL(path, uiDocRoot), 'utf8');

test('ordinary Icons has valid semantic defaults and token geometry', async () => {
  const styles = await read('src/component/icons/scss/_css__icons.scss');

  assert.match(styles, /--sf-icon--weight: var\(--sf-weight--regular\)/);
  assert.match(styles, /--sf-icon--optical-size: 24/);
  assert.match(styles, /--sf-icon--line-height: 1/);
  assert.match(styles, /color: var\(--sf-icon--color, var\(--sf-icon-color, currentColor\)\)/);
  // Without a size the glyph is a size-1 button's icon (24, phone and compact
  // 20; icons study IC-2).
  assert.match(styles, /font-size: var\(--sf-icon-glyph-size, var\(--sf-icon--font-size, var\(--sf-text-height-1\)\)\)/);
  // The steps a button draws read its icon step; the others go one icon step
  // down on a phone (IC-2, C01/C18).
  for (const [size, step] of [['1', '1\\/3'], ['2', '1\\/2'], ['3', '1'], ['4', '2']]) {
    assert.ok(styles.includes(`'${size}': (var(--sf-text-height-${step}), var(--sf-text-height-${step}))`), size);
  }
  assert.match(styles, /'5': \(var\(--sf-icon-size-4\), var\(--sf-icon-size-5\)\)/);
  assert.match(styles, /@media \(min-width: bp\.\$breakpoint-desktop\)/);
  assert.doesNotMatch(styles, /--sf-icon--optical-size:\s*inherit/);
  assert.doesNotMatch(styles, /(?<![-\w])\d+(?:\.\d+)?(?:px|rem|em)(?![-\w])/);
});

test('ordinary Icons publishes canonical modifiers and compatibility aliases', async () => {
  const styles = await read('src/component/icons/scss/_css__icons.scss');

  for (const value of ['rounded', 'sharp', 'filled']) {
    assert.match(styles, new RegExp(`\\.sf-icon--${value}`));
  }
  assert.match(styles, /@each \$name in \(thin, extra-light, light, regular, medium, semi-bold, bold\)/);
  assert.match(styles, /\.sf-icon--weight-#\{\$name\}/);
  assert.match(styles, /\.sf-icon-rounded/);
  assert.match(styles, /\.sf-icon-shape/);
  assert.match(styles, /\.sf-icon-filled/);
});

test('Loader tracks canonical and legacy ordinary icon descriptors', async () => {
  // The subset selectors live in the module the runtime shares with the
  // boot-time re-apply of a remembered subset (icon-subset-memory.js).
  const [loader, memory, rule] = await Promise.all([
    read('src/core/js/iconSubsetRuntime.js'),
    read('src/core/js/icon-subset-memory.js'),
    read('src/component/icons/rule.js'),
  ]);
  const runtime = `${loader}\n${memory}`;

  assert.match(runtime, /"sf-icon--weight-medium", "500"/);
  assert.match(runtime, /"sf-icon--rounded", "rounded"/);
  assert.match(runtime, /"sf-icon--sharp", "sharp"/);
  assert.match(runtime, /classList\.contains\("sf-icon--filled"\)/);
  assert.match(memory, /\.sf-icon:is\(\.sf-icon--sharp, \.sf-icon-shape\)/);
  assert.match(rule, /js: false/);
});

test('Smart Icons projects the canonical ordinary vocabulary', async () => {
  const [source, template] = await Promise.all([
    read('src/smart/icon/index.js'),
    read('src/smart/icon/js/templates/default.js'),
  ]);

  // sf-icon draws one family (1.2.0, IC-4); the class markup keeps the
  // family modifiers for hosts that ship their fonts (Docara).
  assert.match(source, /get iconType\(\) \{\n    return "outlined";/);
  assert.match(template, /sf-icon--weight-\$\{weightClass\}/);
  assert.doesNotMatch(template, /sf-icon--rounded|sf-icon--sharp/);
  assert.match(template, /sf-icon--filled/);
});

test('Icons documentation covers semantics and every public variation', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, families, weights, fill, sizes, color, rotation] = await Promise.all([
    readUiDoc('content/ru/components/content/icons.md'),
    readUiDoc('examples/components/icons/overview/index.html'),
    readUiDoc('examples/components/icons/families/index.html'),
    readUiDoc('examples/components/icons/weights/index.html'),
    readUiDoc('examples/components/icons/fill/index.html'),
    readUiDoc('examples/components/icons/sizes/index.html'),
    readUiDoc('examples/components/icons/color/index.html'),
    readUiDoc('examples/components/icons/rotation/index.html'),
  ]);

  assert.match(page, /role="img"/);
  // sf-icon-loaded is Loader-internal state: the page must say not to write it.
  assert.match(page, /sf-icon-loaded/);
  assert.match(overview, /aria-hidden="true"/);
  assert.match(overview, /role="img" aria-label=/);
  assert.match(families, /sf-icon--rounded/);
  assert.match(families, /sf-icon--sharp/);
  assert.match(weights, /sf-icon--weight-thin/);
  assert.match(fill, /sf-icon--filled/);
  assert.match(sizes, /sf-icon--size-1\/4/);
  assert.match(sizes, /sf-icon--size-7/);
  assert.match(color, /color-primary/);
  assert.match(rotation, /sf-icon--rotate-315/);
  assert.doesNotMatch(`${overview}${families}${weights}${fill}${sizes}${color}${rotation}`, /style=/);
});

// The hold on an unmarked icon is the Loader's, and only where it runs; the
// icons sheet answers no hold with an important size of its own, so a page's,
// a utility's and the density's size reach a glyph no Loader marks (a late
// icon in a compact row drew 24px in a 16px box, 2026-11-09).
test('only a Loader page holds an unmarked icon at 0; the icons sheet sets no important size', async () => {
  const {readFile} = await import('node:fs/promises');
  const core = await readFile(new URL('../src/core/scss/_sf_css__typograpy.scss', import.meta.url), 'utf8');
  const icons = await readFile(new URL('../src/component/icons/scss/_css__icons.scss', import.meta.url), 'utf8');
  assert.match(core, /:root\[data-sf-loader\] body \.sf-icon:not\(\.sf-icon-loaded\) \{\s*font-size: 0 !important;/);
  assert.doesNotMatch(core, /^\s*body \.sf-icon:not\(\.sf-icon-loaded\)/m);
  const loaderless = icons.slice(icons.indexOf(':root:not([data-sf-loader]) body .sf-icon:not(.sf-icon-loaded)'));
  assert.doesNotMatch(loaderless.slice(0, loaderless.indexOf('}')), /(^|[\s;{])font-size\s*:|!important/m);
});

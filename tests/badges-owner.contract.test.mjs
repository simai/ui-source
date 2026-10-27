import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Badge presentation uses semantic roles and high-level geometry tokens', async () => {
  const css = await read('src/component/badges/scss/_css__badges.scss');

  assert.match(css, /--sf-radius-circle/);
  assert.match(css, /--sf-px/);
  assert.ok(css.includes('--sf-ui-1\\/3--space-y-tightness-low'));
  assert.ok(css.includes('--sf-ui-1\\/2--text-space-x'));
  assert.match(css, /--sf-ui-1--text-space-x/);
  assert.match(css, /--sf-badge--border-style: solid/);
  assert.match(css, /text-overflow: ellipsis/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /\b(?:1|2|4|6|8|12|16|20|24|28|32)(?:px|rem)\b/);
});

test('Ordinary and Smart Badge preserve static inline semantics', async () => {
  const [ordinary, smartTemplate] = await Promise.all([
    read('src/component/badges/js/_badges.js'),
    read('src/smart/badge/js/templates/default.js'),
  ]);

  assert.match(ordinary, /createElement\('span'\)/);
  assert.match(ordinary, /classList\.add\('sr-only'\)/);
  assert.match(ordinary, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(smartTemplate, /<span[\s\S]*class=\$\{classes\.join\(' '\)\}/);
  assert.match(smartTemplate, /class="sr-only"/);
  assert.match(smartTemplate, /aria-hidden="true"/);
  assert.doesNotMatch(smartTemplate, /<button|tabindex/);
});

test('Smart Badge declares exact variants and no keyboard ownership', async () => {
  const manifest = JSON.parse(await read('src/smart/badge/smart.manifest.json'));

  assert.deepEqual(manifest.composition.uses, ['component.badges']);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1']);
  assert.deepEqual(manifest.inputs.properties.type.enum, ['main', 'tonal', 'outline']);
  assert.deepEqual(manifest.inputs.properties['icon-position'].enum, ['start', 'end']);
  assert.deepEqual(manifest.accessibility.keyboard, []);
  assert.match(manifest.accessibility.focus, /does not enter the tab order/);
});

test('Badge documentation covers every public axis with runnable examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, basic, types, schemes, sizes, icons] = await Promise.all([
    readUiDoc('content/ru/components/feedback/badges.md'),
    readUiDoc('examples/components/badges/basic/index.html'),
    readUiDoc('examples/components/badges/types/index.html'),
    readUiDoc('examples/components/badges/overview/index.html'),
    readUiDoc('examples/components/badges/sizes/index.html'),
    readUiDoc('examples/components/badges/icons/index.html'),
  ]);
  const examples = [basic, types, schemes, sizes, icons].join('\n');

  for (const id of ['basic', 'types', 'overview', 'sizes', 'icons']) {
    assert.ok(page.includes(`components/badges/${id}`));
  }
  for (const type of ['main', 'tonal', 'outline']) {
    assert.match(schemes, new RegExp(`sf-badge--${type}`));
  }
  for (const scheme of ['neutral', 'primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error', 'on-surface']) {
    assert.match(schemes, new RegExp(`sf-badge--${scheme}`));
  }
  // `danger` is a compatibility alias: the page lists it as deprecated with its
  // replacement, and examples show only the canonical `error`.
  assert.match(page, /\| Устаревшие \|[^\n]*`sf-badge--danger` → `sf-badge--error`/);
  assert.doesNotMatch(examples, /sf-badge--danger/);
  for (const size of ['1/3', '1/2', '1']) {
    assert.match(sizes, new RegExp(`sf-badge--size-${size.replace('/', '\\/')}`));
  }
  assert.match(icons, /class="sr-only"/);
  assert.match(icons, /aria-hidden="true"/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});

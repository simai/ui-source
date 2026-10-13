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

test('Featured Icon owns safe inline geometry and direct Icon composition', async () => {
  const css = await read('src/component/featured-icon/scss/_css_featured-icon.scss');

  assert.match(css, /display: inline-flex/);
  assert.match(css, /flex: none/);
  assert.match(css, /inline-size: max-content/);
  assert.match(css, /> \.sf-icon/);
  assert.match(css, /--sf-featured-icon--padding: var\(--sf-ui-1--space-y-tightness-default\)/);
  assert.match(css, /--sf-featured-icon--icon-size: var\(--sf-text-height-1\)/);
  assert.match(css, /--sf-featured-icon--radius: var\(--sf-radius-circle\)/);
  assert.doesNotMatch(css, /utility-hint/);
});

test('Featured Icon publishes closed size, shape, tone and intensity axes', async () => {
  const css = await read('src/component/featured-icon/scss/_css_featured-icon.scss');

  for (const size of ['1\\/3', '1\\/2', '1', '2', '3']) assert.ok(css.includes(`sf-featured-icon--size-${size}`));
  for (const shape of ['circle', 'square']) assert.ok(css.includes(`sf-featured-icon--${shape}`));
  for (const tone of ['primary', 'neutral', 'info', 'success', 'warning', 'error']) assert.ok(css.includes(`sf-featured-icon--${tone}`));
  for (const intensity of ['soft', 'medium', 'solid', 'elevated']) assert.ok(css.includes(`sf-featured-icon--${intensity}`));
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('Featured Icon legacy names are aliases and Smart File Upload consumes canonical classes', async () => {
  const [css, template, rule] = await Promise.all([
    read('src/component/featured-icon/scss/_css_featured-icon.scss'),
    read('src/smart/file-upload/js/templates/default.js'),
    read('src/component/featured-icon/rule.js'),
  ]);

  for (const alias of ['light', 'mid', 'dark', 'modern', 'clear']) assert.ok(css.includes(`sf-featured-icon--${alias}`));
  assert.match(template, /sf-featured-icon--soft/);
  assert.match(template, /sf-featured-icon--neutral/);
  const featuredClasses = template.match(/const featuredIconClasses = \[[\s\S]*?\]\.join\(' '\)/)?.[0] || '';
  assert.doesNotMatch(featuredClasses, /sf-featured-icon--(?:light|clear)|'flex'|'transition'/);
  assert.match(rule, /class\\s\*=\\s\*/);
  assert.match(rule, /css: true/);
  assert.match(rule, /js: false/);
});

test('Featured Icon documentation covers all axes and accessible naming', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, accessibility, intensities, tones, shapes, sizes] = await Promise.all([
    readUiDoc('content/ru/components/content/featured-icon.md'),
    readUiDoc('examples/components/featured-icon/overview/index.html'),
    readUiDoc('examples/components/featured-icon/accessibility/index.html'),
    readUiDoc('examples/components/featured-icon/tones/index.html'),
    readUiDoc('examples/components/featured-icon/colors/index.html'),
    readUiDoc('examples/components/featured-icon/shapes/index.html'),
    readUiDoc('examples/components/featured-icon/sizes/index.html'),
  ]);

  assert.match(page, /`sf-featured-icon--soft` — мягкий тон по умолчанию/);
  assert.match(accessibility, /role="img" aria-label="Информация"/);
  assert.match(overview, /aria-hidden="true"/);
  for (const intensity of ['soft', 'medium', 'solid', 'elevated']) assert.ok(intensities.includes(`sf-featured-icon--${intensity}`));
  for (const tone of ['primary', 'neutral', 'info', 'success', 'warning', 'error']) assert.ok(tones.includes(`sf-featured-icon--${tone}`));
  for (const shape of ['circle', 'square']) assert.ok(shapes.includes(`sf-featured-icon--${shape}`));
  for (const size of ['1/3', '1/2', '1', '2', '3']) assert.ok(sizes.includes(`sf-featured-icon--size-${size}`));
  assert.doesNotMatch(`${overview}${accessibility}${intensities}${tones}${shapes}${sizes}`, /style=/);
});

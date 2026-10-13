/* global URL */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Tooltip controller uses one concise opt-in relationship', async () => {
  const source = await read('src/component/tooltip/js/_tooltip.js');
  assert.match(source, /TRIGGER_SELECTOR = '\[data-tooltip\]'/);
  assert.match(source, /setAttribute\('aria-describedby'/);
  assert.match(source, /setAttribute\('role', 'tooltip'\)/);
  assert.doesNotMatch(source, /aria-expanded|aria-haspopup/);
});

test('Tooltip controller owns pointer, focus and Escape without moving focus', async () => {
  const source = await read('src/component/tooltip/js/_tooltip.js');
  assert.match(source, /pointerenter/);
  assert.match(source, /pointerleave/);
  assert.match(source, /focusin/);
  assert.match(source, /focusout/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.doesNotMatch(source, /\.focus\(/);
});

test('Tooltip anchor positioning follows logical tail classes and tokens', async () => {
  const css = await read('src/component/tooltip/scss/_css__tooltip_custom.scss');
  assert.match(css, /\.sf-tooltip-anchor/);
  assert.match(css, /sf-tooltip--arrow-inline-start/);
  assert.match(css, /sf-tooltip--arrow-inline-end/);
  assert.match(css, /var\(--sf-tooltip-tail-half\)/);
  assert.match(css, /var\(--sf-z-index-9\)/);
  assert.doesNotMatch(css, /(?:^|[:\s])(?:#[0-9a-f]{3,8}|rgba?\()/im);
  assert.doesNotMatch(css, /:\s*(?!0(?:[;,)\s]|$))\d+(?:\.\d+)?(?:px|rem)\b/);
});

test('Smart Tooltip keeps one shared anatomy and decorative tail', async () => {
  const template = await read('src/smart/tooltip/js/templates/default.js');
  assert.match(template, /sf-tooltip-wrap flex flex-col/);
  assert.match(template, /sf-tooltip-tail" aria-hidden="true"/);
  assert.match(template, /context\.rootClass/);
  assert.match(template, /context\.rootStyle/);
});

test('Smart Tooltip publishes closed skins, sizes and logical tails', async () => {
  const manifest = JSON.parse(await read('src/smart/tooltip/smart.manifest.json'));
  assert.equal(manifest.lifecycle, 'released');
  assert.equal(manifest.readiness.level, 'accepted');
  assert.deepEqual(manifest.inputs.properties.type.enum, ['light', 'dark']);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  assert.deepEqual(manifest.inputs.properties.arrow.enum, [
    'none',
    'top-center',
    'bottom-center',
    'inline-start',
    'inline-end',
    'bottom-inline-start',
    'bottom-inline-end',
  ]);
});

test('Tooltip documentation keeps surface and interaction ownership explicit', async () => {
  const ordinary = await read('src/component/tooltip/docs/docs.md');
  const smart = await read('src/smart/tooltip/docs/docs.md');
  for (const source of [ordinary, smart]) {
    assert.match(source, /data-tooltip/);
    assert.match(source, /aria-describedby/);
    assert.match(source, /Escape/);
    assert.match(source, /dialog|popover/i);
  }
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// --sf-surface-place-ground, the nearest opaque place (status dot on soft
// places, 2026-11-11): the page declares it, every solid place declares it
// with its solid colour, a soft coloured place leaves it to the place below,
// glass sets it initial (held for the owner). The avatar's status dot lays
// its fill over it, so nothing under the dot shows through.

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const body = (source, name) => {
  const start = source.indexOf(`@mixin ${name}`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}\n', start));
};

test('the page and every solid place declare the ground; a soft place does not', async () => {
  const theme = await read('src/core/scss/_sf_css__theme.scss');
  const mix = await read('src/core/scss/mix/_mix__places.scss');
  assert.match(theme, /\s--sf-surface-place-ground: var\(--sf-surface-page\);/u);
  assert.match(body(mix, 'sf-place('), /--sf-surface-place-solid: #\{\$surface\};\s*--sf-surface-place-ground: #\{\$surface\};/u);
  assert.match(body(mix, 'sf-place-strong'), /--sf-surface-place-solid: var\(--sf-#\{\$c\}\);\s*--sf-surface-place-ground: var\(--sf-#\{\$c\}\);/u);
  assert.doesNotMatch(body(mix, 'sf-place-soft'), /^\s*--sf-surface-place-ground:/mu, 'a soft place inherits the opaque place below');
});

test('places outside the mixins declare the ground with their solid colour; glass is held', async () => {
  const popover = await read('src/smart/popover/js/templates/default.css');
  assert.match(popover, /--sf-surface-place-ground: var\(--sf-popover-background-color, var\(--sf-surface-popup\)\);/u);
  const alertBar = await read('src/smart/alert-bar/scss/_smart__alert-bar.scss');
  assert.match(alertBar, /--sf-surface-place-solid: var\(--sf-alert-bar--fill\);\s*--sf-surface-place-ground: var\(--sf-alert-bar--fill\);/u);
  const glass = await read('src/core/scss/_sf_css__surface_places.scss');
  assert.match(glass, /\.sf-surface-media \{[^}]*--sf-surface-place-ground: initial;/u);
});

test('the status dot draws as before, over the ground', async () => {
  const dot = await read('src/component/avatars/scss/_css__avatar_online_indicator.scss');
  const base = dot.slice(dot.indexOf('.sf-online-indicator {'), dot.indexOf('}', dot.indexOf('.sf-online-indicator {')));
  assert.match(base, /border-color: var\(--sf-surface-place, transparent\);/u);
  assert.match(base, /background-color: var\(--sf-surface-place-ground, transparent\);/u);
  assert.match(base, /background-image: linear-gradient\(var\(--sf-online-indicator--background-color\) 0 0\);/u);
  assert.doesNotMatch(base, /background-clip/u);
  const offline = dot.slice(dot.indexOf('.sf-online-indicator--offline {'), dot.indexOf('}', dot.indexOf('.sf-online-indicator--offline {')));
  assert.match(offline, /--sf-online-indicator--background-color: var\(--sf-avatar-offline-background-color, var\(--sf-surface-place\)\);/u);
  assert.match(offline, /background-image: var\(--sf-avatar-offline-overlay, linear-gradient\(var\(--sf-on-surface-disabled\) 0 0\)\), linear-gradient\(var\(--sf-online-indicator--background-color\) 0 0\);/u);
  // No later rule paints the dot's background over the stack.
  const avatars = await read('src/component/avatars/scss/_css__avatars.scss');
  assert.doesNotMatch(avatars, /\.sf-online-indicator \{\s*background-color:/u);
});

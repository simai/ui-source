import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Owner decision C201 (2026-11-15, DEV msg-51b3564b): sf-button-copy takes
// appearance="plain", the plain icon button (sf-icon-button--plain): an
// icon-only copy draws sf-button-icon appearance="plain"; a copy with text has
// no plain button and draws ghost, as the clipboard constructor does.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/button-copy/component.json'));
const template = read('src/smart/button-copy/js/templates/default.js');

test('appearance lists plain, the default stays ghost', () => {
  assert.deepEqual(manifest.settings.appearance.values, ['ghost', 'outline', 'tonal', 'plain']);
  assert.equal(manifest.settings.appearance.default, 'ghost');
});

test('icon-only copy passes plain on; a text copy reads plain as ghost', () => {
  assert.match(template, /const buttonAppearance = common\.appearance === 'plain' \? 'ghost' : common\.appearance;/u);
  assert.match(template, /<sf-button size=\$\{common\.size\} appearance=\$\{buttonAppearance\}/u);
  assert.match(template, /<sf-button-icon size=\$\{common\.size\} appearance=\$\{common\.appearance\}/u);
});

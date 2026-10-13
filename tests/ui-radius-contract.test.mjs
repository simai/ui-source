import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishes one UI radius token backed by the 1/3 radius primitive', async () => {
  const [radius, border, compatibility] = await Promise.all([
    read('src/core/figma_variables/figma_radius.scss'),
    read('src/core/scss/_sf_css__border.scss'),
    read('src/core/figma_variables/figma_ui_radius.scss'),
  ]);

  assert.match(radius, /--sf-radius-1\\\/3: var\(--sf-a2\);/);
  // The role stands on a step of the scale, never on a primitive, so a retuned
  // scale carries the role with it.
  assert.match(border, /--sf-radius--ui: var\(--sf-radius-1\\\/2\);/);
  assert.match(border, /--sf-radius--surface: var\(--sf-radius-1\);/);
  assert.match(compatibility, /--sf-ui-radius-default: var\(--sf-radius--ui\);/);
});

test('small UI components expose native aliases that inherit the shared token', async () => {
  const sources = {
    button: await read('src/component/buttons/scss/_css__buttons.scss'),
    iconButton: await read('src/component/icon-buttons/scss/_css_icon_buttons.scss'),
    input: await read('src/component/inputs/scss/_css__inputs.scss'),
    dropdown: await read('src/component/dropdown/scss/_css__dropdown.scss'),
  };

  assert.match(sources.button, /--sf-button--radius: var\(--sf-radius--ui\);/);
  assert.match(sources.button, /var\(--sf-button--border-bottom-right-radius, var\(--sf-button--radius\)\)/);
  assert.match(sources.iconButton, /--sf-icon-button--radius: var\(--sf-radius--ui\);/);
  assert.match(sources.input, /--sf-input--radius: var\(--sf-radius--ui\);/);
  assert.match(sources.dropdown, /var\(--sf-dropdown--radius, var\(--sf-radius--ui\)\)/);
});

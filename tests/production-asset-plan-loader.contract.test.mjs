import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const loader = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const iconStyles = fs.readFileSync(
  new URL('../src/component/icons/scss/_css__icons.scss', import.meta.url),
  'utf8',
);
const iconButtonStyles = fs.readFileSync(
  new URL('../src/component/icon-buttons/scss/_css_icon_buttons.scss', import.meta.url),
  'utf8',
);
const menuElementStyles = fs.readFileSync(
  new URL('../src/component/menu/scss/_css__menu_element.scss', import.meta.url),
  'utf8',
);
const menuRuntime = fs.readFileSync(
  new URL('../src/component/menu/js/_menu.js', import.meta.url),
  'utf8',
);

test('SF_PRELOADED disables the previous-page plugin-list fallback', () => {
  assert.match(
    loader,
    /if \(!skipDefer && PluginList\.length < 10 && !this\.productionPlanActive\)/,
  );
  assert.match(
    loader,
    /if \(window\.SF_PRELOADED\) \{\s*this\.productionPlanActive = true;/,
  );
  assert.match(
    loader,
    /let plugins = this\.productionPlanActive\s*\? null\s*: localStorage\.getItem/,
  );
  assert.match(
    loader,
    /if \(!this\.productionPlanActive && !plugins && window\.BUNDLE_ID\)/,
  );
});

test('an undefined Smart icon reserves its final control geometry', () => {
  assert.match(iconStyles, /sf-icon:not\(:defined\) \{/);
  assert.match(iconStyles, /width: var\(--sf-icon--width, var\(--sf-icon-size-3\)\)/);
  assert.match(iconStyles, /height: var\(--sf-icon--height, var\(--sf-icon-size-3\)\)/);
  assert.match(iconStyles, /sf-icon\[size="1\/2"\]:not\(:defined\)/);
  assert.match(
    iconButtonStyles,
    /sf-icon-button--size-1\.sf-icon-button--icon :is\(\.sf-icon, sf-icon:not\(:defined\)\)/,
  );
});

test('an unbound flat menu has the same level-one geometry as the bound menu', () => {
  assert.match(
    menuElementStyles,
    /padding-inline-start: var\(--sf-menu-element--padding-inline-start, var\(--sf-space-1\)\)/,
  );
  assert.match(
    menuElementStyles,
    /\.sf-menu-element--level-1 \{\s*--sf-menu-element--padding-inline-start: var\(--sf-space-1\)/,
  );
});

test('menu hydration reuses server-rendered icon and text nodes', () => {
  assert.match(
    menuRuntime,
    /element\.querySelector\(':scope > \.sf-menu-element-text'\)/,
  );
  assert.match(menuRuntime, /if \(text\) wrap\.append\(text\)/);
  assert.match(menuRuntime, /if \(leading\) wrap\.append\(leading\)/);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

/* Owner decision C119 (ui-control research 2026-11-13-buttons-system R206):
   the split button is sf-button with menu and split, no new tag; the menu is
   sf-menu-context, the arrow part sf-button-icon, the joint the buttons
   sheet's sf-button-split. The drawing, the heights and the keys are
   measured by tests/browser/button-split.browser.mjs. */
test('split button: sf-button declares menu, split and select', () => {
  const manifest = json('src/smart/button/component.json');
  assert.equal(manifest.tag, 'sf-button');
  assert.equal(manifest.settings.menu.type, 'list');
  assert.deepEqual(manifest.settings.menu.default, []);
  assert.equal(manifest.settings.split.type, 'boolean');
  assert.equal(manifest.settings.split.default, false);
  assert.deepEqual(Object.keys(manifest.events.select.carries).sort(), ['entry', 'id']);
  for (const key of ['ArrowDown', 'ArrowUp', 'Escape']) assert.ok(manifest.keyboard.host[key], key);
  const relations = Object.fromEntries(manifest.relations.map((relation) => [relation.name, relation]));
  assert.equal(relations['cl-menu-context']?.lazy, true, 'the menu is fetched when a button has one');
  assert.equal(relations['cl-button-icon']?.lazy, true, 'the arrow part is fetched when a button splits');
  const rule = read('src/smart/button/rule.js');
  assert.match(rule, /name: 'cl-menu-context', lazy: true/u);
  assert.match(rule, /name: 'cl-button-icon', lazy: true/u);
});

test('split button: the template draws the parts, the menu and the arrow name', () => {
  const template = read('src/smart/button/js/templates/default.js');
  assert.match(template, /class=\$\{\['sf-button-split'/u);
  assert.match(template, /<sf-button-icon\s+class="sf-button-split-arrow"\s+icon="expand_more"/u);
  for (const attribute of ['appearance', 'scheme', 'size', 'height', 'radius']) {
    assert.match(template, new RegExp(`\\n\\s+${attribute}=\\$\\{`, 'u'), `the arrow takes the button's ${attribute}`);
  }
  assert.match(template, /aria-haspopup="menu"\s+aria-expanded="false"/u);
  assert.match(template, /<sf-menu-context\s+popup/u);
  assert.match(template, /@sf-menu-context-select=/u);
  assert.match(template, /@sf-button-icon-press=\$\{stop\}/u);
  for (const lang of ['en', 'ru']) {
    assert.match(json(`src/smart/button/lang/${lang}.json`).runtime['split-more'], /\{label\}/u, lang);
  }
  assert.equal(json('src/smart/button/lang/ru.json').runtime['split-more'], 'Другие варианты: {label}');
});

test('split button: main and regular looks only; a menu button opens instead of pressing', () => {
  const source = read('src/smart/button/index.js');
  assert.match(source, /appearance === "default" && scheme === "primary"/u);
  assert.match(source, /appearance === "outline"/u);
  assert.match(source, /if \(this\._menuMode === "menu"\) \{\s+this\.toggleMenu\(\);\s+return;\s+\}\s+this\.sfEmit\("press"/u);
  assert.match(source, /event\.key !== "ArrowDown" && event\.key !== "ArrowUp"/u);
  assert.match(source, /this\.sfEmit\("select", \{id, entry/u);
  // Said once per page, on the shared global (every bundle has its own copy).
  assert.match(source, /__sfButtonMenuWarned/u);
});

test('split button: the buttons sheet joins the parts as a button group', () => {
  const sheet = read('src/component/buttons/scss/_css__buttons_custom.scss');
  const block = (selector) => {
    const at = sheet.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    return sheet.slice(at, sheet.indexOf('}', at));
  };
  assert.match(block('.sf-button-split'), /gap: var\(--sf-px\)/u);
  assert.match(block('.sf-button-split:has(> .sf-button--outline)'), /gap: 0/u);
  assert.match(block('.sf-button-split > .sf-button'), /border-start-end-radius: 0;\s+border-end-end-radius: 0/u);
  assert.match(sheet, /\.sf-button-split > :is\(sf-button-icon, sf-icon-button\) > \.sf-icon-button \{\s+flex: 0 0 auto;\s+border-start-start-radius: 0;\s+border-end-start-radius: 0/u);
  assert.match(sheet, /> :is\(sf-button-icon, sf-icon-button\) > \.sf-icon-button \{\s+margin-inline-start: calc\(var\(--sf-px\) \* -1\)/u);
  // Values from the systems only: no literal lengths or colours in the joint.
  const joint = sheet.slice(sheet.indexOf('.sf-button-split {'), sheet.indexOf('.sf-button,\n.sf-icon-button {'));
  assert.doesNotMatch(joint, /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

/* Owner decision C118 (R205): only the danger outline has a coloured border,
   the error role at the ink family's 64 step; primary and on-surface keep the
   shared grey. */
test('danger outline border: red at 64 % on the button and the icon button; the others grey', () => {
  const red = 'color-mix(in srgb, var(--sf-error) 64%, transparent)';
  const buttons = read('src/component/buttons/scss/_css__buttons.scss');
  const dangerButton = buttons.slice(buttons.indexOf('.sf-button.sf-button--outline:is(.sf-button--danger, .sf-button--error) {'));
  assert.ok(dangerButton.slice(0, 300).includes(`--sf-button--border-color: var(--sf-button-border-color, ${red});`));
  const greyButton = buttons.slice(buttons.indexOf('.sf-button.sf-button--outline.sf-button--primary, .sf-button.sf-button--outline:is(.sf-button--on-surface, .sf-button--secondary) {'));
  assert.ok(greyButton.slice(0, 300).includes('--sf-button--border-color: var(--sf-button-border-color, var(--sf-outline));'));
  const icons = read('src/component/icon-buttons/scss/_css_icon_buttons.scss');
  const dangerIcon = icons.slice(icons.indexOf('.sf-icon-button.sf-icon-button--outline:is(.sf-icon-button--danger, .sf-icon-button--error).sf-icon-button--close {'));
  assert.ok(dangerIcon.slice(0, 700).includes(`--sf-icon-button--border-color: var(--sf-icon-button-border-color, ${red});`));
  assert.match(icons, /\.sf-icon-button--outline:is\(\.sf-icon-button--on-surface, \.sf-icon-button--secondary\)\.sf-icon-button--close \{\s+--sf-icon-button--background-color: var\(--sf-icon-button-background-color, transparent\);\s+--sf-icon-button--border-color: var\(--sf-icon-button-border-color, var\(--sf-outline\)\);/u);
  // A disabled danger outline greys as the others do.
  assert.match(buttons, /\.sf-button\.sf-button--outline:is\(\.sf-button--danger, \.sf-button--error\):disabled:not\(\.sf-button-state-loading:not\(\.disabled\)\) \{\s+--sf-button--border-color: var\(--sf-outline-disabled\);/u);
});

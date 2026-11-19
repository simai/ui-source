// The docs header gives way (owner decisions C369-C372, 2026-11-19; DEV
// msg-d9c2e1640ee24748b154 item 1; study ui-control
// control/research/2026-11-19-docs-header variant Д). The behaviour on the
// built bytes is tests/browser/header-site-collapse-auto.browser.mjs; here the
// contracts: the settings and their values, the order the bar gives way in,
// the words, the sheets that draw a step at once, and the row arithmetic.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitRow} from '../src/smart/menu/items.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('C371: sf-menu keeps the current section beside «Ещё» unless keep-current is false', () => {
  const menu = json('src/smart/menu/component.json');
  assert.equal(menu.settings['keep-current'].type, 'boolean');
  assert.equal(menu.settings['keep-current'].default, true);
  // No collapse="more": overflow="more" is the family's name for priority+.
  assert.ok(!menu.settings.collapse.values.includes('more'));
  assert.ok(menu.settings.overflow.values.includes('more'));
  assert.equal(menu.events.overflow.carries.fits.type, 'boolean');
  const source = read('src/smart/menu/index.js');
  assert.match(source, /const keep = this\.keepCurrent === false \? -1 : ids\.findIndex/u);
  // Widths five sections 133 97 131 186 99, «Ещё» 96, gap 4: in 520 px the
  // current fifth stays and changes places with the last shown one.
  const widths = [133, 97, 131, 186, 99];
  assert.deepEqual(fitRow(widths, 96, 520, 4, 4), [0, 1, 4]);
  assert.deepEqual(fitRow(widths, 96, 520, 4, -1), [0, 1, 2]);
  // Not even one item beside «Ещё»: nothing stays (the bar collapses then).
  assert.deepEqual(fitRow(widths, 96, 200, 4, -1), []);
});

test('C371: «Ещё» holding the current page says so in its name, in en and ru', () => {
  assert.equal(json('src/smart/menu/lang/ru.json').runtime['holds-current'], 'содержит текущую страницу');
  assert.equal(json('src/smart/menu/lang/en.json').runtime['holds-current'], 'holds the current page');
  assert.equal(json('src/core/lang/ru/menu.json').words['sf-menu']['holds-current'], 'содержит текущую страницу');
  const template = read('src/smart/menu/js/templates/default.js');
  assert.match(template, /const named = holds && item\.id === context\.moreId && context\.holdsCurrentName \? context\.holdsCurrentName\(item\.label\) : nothing;/u);
  assert.match(template, /aria-label=\$\{own\(named\)\}/u);
});

test('C371, C372: a row its bar lays out is measured through the bar, before the paint, in one step', () => {
  const menu = read('src/smart/menu/index.js');
  assert.match(menu, /const host = driven \? null : this\.rowHost\(\);\n\s+if \(host\) \{\n\s+host\.fitRow\(\);\n\s+return;/u);
  assert.match(menu, /if \(!driven && flip && flip\.back === key/u);
  assert.match(menu, /rowNeeds\(\) \{/u);
  const bar = read('src/smart/header-site/index.js');
  // The order: tools whole, tools as glyphs, then the menu's least row, else collapse.
  assert.match(bar, /if \(needs\.whole <= roomWhole \+ 0\.5\) \{\n\s+this\.setToolsCompact\(false\);\n\s+\} else if \(needs\.least <= \(shrinks \? roomGlyph : roomWhole\) \+ 0\.5\) \{\n\s+this\.setToolsCompact\(shrinks\);\n\s+\} else \{/u);
  assert.match(bar, /needs\.menu\?\.measureFit\(\{driven: true\}\);/u);
  assert.match(bar, /drivesRow\(menu\) \{\n\s+return this\.collapse === 'auto' && !this\.collapsed && this\.navMenus\(\)\.includes\(menu\);/u);
});

test('C372: sf-header-site collapse auto, its host states and its md floor before its code', () => {
  const header = json('src/smart/header-site/component.json');
  assert.deepEqual(header.settings.collapse.values, ['none', 'sm', 'md', 'lg', 'xl', 'auto', 'always']);
  assert.equal(header['host-states']['data-tools-compact'], 'boolean');
  assert.equal(header['host-states']['data-fitted'], 'boolean');
  const sheet = read('src/smart/header-site/scss/_smart__site_header.scss');
  assert.match(sheet, /@container sf-site-header \(width < #\{mq\.container-step\(h1\)\}\) \{\n  :is\(sf-header-site, sf-site-header\):not\(:defined\) > \.sf-site-header--collapse-auto \{\n    @include collapsed;/u);
});

test('C370: sf-button shrink icon draws its glyph square at once, keeps its name and keys, and tells its tooltip', () => {
  const button = json('src/smart/button/component.json');
  assert.deepEqual(button.settings.shrink.values, ['none', 'icon']);
  assert.equal(button.settings.shrink.default, 'none');
  assert.equal(button['host-states']['data-shrunk'], 'boolean');
  const sheet = read('src/component/buttons/scss/_css__buttons_shrink.scss');
  assert.match(sheet, /sf-button\[shrink='icon'\]\[data-shrunk='true'\] > \.sf-button \{\n  --sf-button--padding-inline-start: var\(--sf-button--padding-top\);\n  --sf-button--padding-inline-end: var\(--sf-button--padding-top\);/u);
  assert.match(sheet, /> :is\(\.sf-button-text-container, \.sf-button-shortcut\) \{\n  display: none;/u);
  assert.match(read('src/component/buttons/scss/index.scss'), /@use "css__buttons_shrink";/u);
  const source = read('src/smart/button/index.js');
  assert.match(source, /appearance: shrunk \? "ghost" : this\.appearance,/u);
  assert.match(source, /this\.getAttribute\("aria-label"\) \|\| shrinkName \|\| ""/u);
  const template = read('src/smart/button/js/templates/default.js');
  assert.equal((template.match(/data-sf-shrink-tip=\$\{context\.shrinkTip \|\| nothing\}/gu) || []).length, 2);
  assert.match(template, /aria-keyshortcuts=\$\{context\.ariaKeyShortcuts \|\| nothing\}\n\s+data-sf-shrink-tip/u);
  const tip = read('src/component/icon-buttons/js/_name-tooltip.js');
  assert.match(tip, /const SHRUNK = 'sf-button\[shrink="icon"\]\[data-shrunk="true"\] > \.sf-button\[data-sf-shrink-tip\]';/u);
  assert.match(tip, /export \{nameTarget, unlinkNameTip\};/u);
});

test('C369: sf-language trigger icon is the glyph alone, and core holds its square before the code', () => {
  const language = json('src/smart/language/component.json');
  assert.deepEqual(language.settings.trigger.values, ['code', 'icon']);
  assert.equal(language.settings.trigger.default, 'code');
  const core = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(core, /:where\(sf-language\[trigger="icon"\]\) \{\n  --sf-language--trigger: var\(--sf-language--box\);\n\}/u);
  assert.match(core, /:where\(sf-language \.sf-language-parts > :is\(sf-button, sf-button-icon, sf-icon-button\):not\(:defined\)\)/u);
  const source = read('src/smart/language/index.js');
  assert.match(source, /tipId: \(look === 'menu' \|\| look === 'search'\) && this\.getAttribute\('trigger'\) !== 'icon'/u);
});

test('docs pages for the four values', () => {
  assert.match(read('src/smart/header-site/docs.md'), /`collapse="auto"`/u);
  assert.match(read('src/smart/menu/docs.md'), /`keep-current="false"`/u);
  assert.match(read('src/smart/button/docs/docs.md'), /`shrink="icon"`/u);
  assert.match(read('src/smart/language/docs.md'), /`trigger="icon"`/u);
});

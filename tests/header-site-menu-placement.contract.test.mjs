import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-header-site, owner decision C104 (R189, 2026-11-12): the side of the
// menu button and its panel (menu-placement, MP-1), a switch of the page's
// own (data-header-site + aria-controls, MP-2), the open panel and scrim above
// the bar (MP-6) and the close button on the menu button's axis in a wide
// window (MP-3). The page itself is measured by ui-control's probe
// (control/evidence/2026-11-12-header-c104).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = JSON.parse(read('src/smart/header-site/component.json'));
const source = read('src/smart/header-site/index.js');
const template = read('src/smart/header-site/js/templates/default.js');
const sheet = read('src/smart/header-site/scss/_smart__site_header.scss');
const docs = read('src/smart/header-site/docs.md');
const collapsed = sheet.slice(sheet.indexOf('@mixin collapsed {'), sheet.indexOf('.sf-site-header--collapse-always {'));

test('header site C104: menu-placement is inline-start or inline-end, inline-start by default', () => {
  const setting = component.settings['menu-placement'];
  assert.equal(setting.type, 'enum');
  assert.deepEqual(setting.values, ['inline-start', 'inline-end']);
  assert.equal(setting.default, 'inline-start');
  const manifest = JSON.parse(read('src/smart/header-site/smart.manifest.json'));
  assert.ok(JSON.stringify(manifest).includes('menu-placement'));
  assert.match(source, /menuPlacement: this\.menuPlacement === 'inline-end' \? 'inline-end' : 'inline-start',/u);
  assert.match(template, /menuPlacement === 'inline-end' \? 'sf-site-header--menu-inline-end' : ''/u);
});

test('header site C104: the menu button is drawn first, or last after the tools, in the DOM where it is seen', () => {
  const row = template.slice(template.indexOf('<div class="sf-site-header-row'));
  const start = row.indexOf("ownMenuButton && menuPlacement !== 'inline-end' ? menuButton : nothing");
  const brand = row.indexOf("hasSlot('brand')");
  const tools = row.indexOf("hasSlot('tools')");
  const end = row.indexOf("ownMenuButton && menuPlacement === 'inline-end' ? menuButton : nothing");
  assert.ok(start > 0 && start < brand, 'inline-start: before the brand');
  assert.ok(end > tools, 'inline-end: after the tools');
  // One button, written once.
  assert.equal((template.match(/class="sf-site-header-menu-button"/gu) || []).length, 1);
  // At the end of the bar: alone, or right behind the tools at the row's gap.
  assert.match(collapsed, /&\.sf-site-header--menu-inline-end \.sf-site-header-menu-button > button \{\n    margin-inline-start: auto;\n  \}/u);
  assert.match(collapsed, /&\.sf-site-header--menu-inline-end \.sf-site-header-tools ~ \.sf-site-header-menu-button > button \{\n    margin-inline-start: 0;\n  \}/u);
});

test('header site C104: the panel comes from the button side, its close on the button axis there', () => {
  assert.match(collapsed, /&\.sf-site-header--menu-inline-end\.sf-site-header--open \.sf-site-header-panel \{\n    inset-inline-start: auto;\n    inset-inline-end: 0;\n  \}/u);
  // inline-start: the close first in the head; inline-end: last, at the end.
  assert.match(collapsed, /\.sf-site-header-close-button > button \{\n    order: -1;\n  \}/u);
  assert.match(collapsed, /&\.sf-site-header--menu-inline-end \.sf-site-header-close-button > button \{\n    order: 0;\n  \}/u);
  assert.match(collapsed, /padding-inline: var\(--sf-site-header--axis-inset\);/u);
  assert.match(collapsed, /justify-content: space-between;\n    padding-inline: var\(--sf-space-2\) var\(--sf-site-header--axis-inset\);/u);
});

test('header site C104: the head adds the row container centring offset, held inside the panel', () => {
  assert.match(sheet, /--sf-site-header--centring: calc\(var\(--sf-px\) \* 0\);/u);
  // Per container step: half of what the page is wider than the step.
  assert.match(sheet, /@each \$step, \$space in container\.\$container-array \{[\s\S]*?--sf-site-header--centring: max\(calc\(var\(--sf-px\) \* 0\), calc\(\(var\(--sf-container-breakout-page, 100vw\) - var\(--sf-breakpoint-#\{\$step\}\)\) \/ 2\)\);/u);
  assert.match(collapsed, /--sf-site-header--axis-inset: min\(\n      calc\(var\(--sf-site-header--gutter\) \+ var\(--sf-site-header--centring\)\),\n      calc\(var\(--sf-site-header--sheet-size\) - var\(--sf-site-header--control-height\) - var\(--sf-site-header--gutter\)\)\n    \);/u);
  // The panel and its head read one width.
  assert.match(collapsed, /inline-size: var\(--sf-site-header--sheet-size\);/u);
  assert.match(sheet, /--sf-site-header--sheet-size: var\(--sf-site-header-sheet-inline-size, min\(90vw, var\(--sf-g1\)\)\);/u);
});

test('header site C104 MP-6: while open the scrim and panel stand above the bar parts', () => {
  const scrim = collapsed.slice(collapsed.indexOf('&.sf-site-header--open .sf-site-header-scrim {'));
  assert.match(scrim, /^&\.sf-site-header--open \.sf-site-header-scrim \{\n    display: block;\n    position: fixed;\n    z-index: var\(--sf-z-index-1\);/u);
  const panel = collapsed.slice(collapsed.indexOf('&.sf-site-header--open .sf-site-header-panel {'));
  assert.match(panel, /^&\.sf-site-header--open \.sf-site-header-panel \{\n    position: fixed;\n    z-index: var\(--sf-z-index-1\);/u);
  // Isolation only while open: a menu dropping from the tools is not capped.
  assert.match(collapsed, /&\.sf-site-header--open :is\(\.sf-site-header-brand, \.sf-site-header-tools, \.sf-site-header-menu-button > button\) \{\n    isolation: isolate;\n  \}/u);
  assert.equal((sheet.match(/isolation: isolate/gu) || []).length, 1);
});

test('header site C104: a page switch data-header-site toggles, opens or closes the bar it names', () => {
  assert.match(source, /const SWITCH_OPERATIONS = \['toggle', 'open', 'close'\];/u);
  assert.match(source, /event\.target\.closest\('\[data-header-site\]\[aria-controls\]'\)/u);
  assert.match(source, /const TAGS = \['sf-header-site', 'sf-site-header'\];/u);
  assert.match(source, /bar\[operation\]\(operation === 'close' \? \{reason: 'close'\} : undefined\);/u);
  // One document listener, bound when the first bar connects.
  assert.match(source, /if \(switchesBound \|\| typeof document === 'undefined'\) return;/u);
  assert.match(source, /bindSwitches\(\);/u);
});

test('header site C104: the bar keeps aria-expanded on the switch and draws no button while one is on screen', () => {
  assert.match(source, /element\.setAttribute\('aria-expanded', expanded\);/u);
  assert.match(source, /&& !panel\?\.contains\(element\)\n\s+&& element\.getClientRects\(\)\.length > 0/u);
  assert.match(source, /ownMenuButton: !this\._outsideSwitch,/u);
  // Checked after every drawing, on resize (a frame, or at once without one), on open and on close.
  assert.match(source, /this\._offSwitches = this\.onAfterRender\(\(\) => this\.syncSwitches\(\), \{once: false\}\);/u);
  assert.match(source, /globalThis\.addEventListener\('resize', this\._onResize, \{passive: true\}\);/u);
  assert.match(source, /globalThis\.removeEventListener\('resize', this\._onResize\);/u);
  assert.equal((source.match(/this\.syncSwitches\(\);/gu) || []).length, 4);
  // Focus goes back to the switch when the bar drew no button.
  assert.match(source, /const button = this\.menuButton\(\) \?\? this\.outsideSwitch\(\);/u);
  assert.match(source, /return this\.collapsed \? \(this\.menuButton\(\) \?\? this\.outsideSwitch\(\)\) : null;/u);
});

test('header site C104: the docs name both settings and the version is a minor', () => {
  assert.match(docs, /menu-placement="inline-end"/u);
  assert.match(docs, /data-header-site="toggle"/u);
  assert.match(docs, /aria-controls="site-header"/u);
  assert.equal(component.version, '1.9.0');
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.9.0 (2026-11-12, owner decision C104')));
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {unfoldModes} from './support/paint-blocks.mjs';

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
// C273: the mixins' paint and shape mode blocks unfolded, as written before
const sheet = unfoldModes(read('src/smart/header-site/scss/_smart__site_header.scss'));
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
  assert.match(sheet, /--sf-site-header--sheet-size: var\(--sf-site-header-sheet-inline-size, min\(90vw, var\(--sf-g0\)\)\);/u);
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
  // 1.13.0 (F-1): after the switches, the nav's fit is measured too. The
  // collapsed answer is read again after a drawing only when it can have
  // changed (DF-9: a read after every drawing worked the page's styles out again).
  assert.match(source, /this\._offSwitches = this\.onAfterRender\(\(\) => \{\n\s+this\.observeSize\(\);\n\s+if \(this\.collapsedAnswerStale\(\)\) this\.syncCollapsed\(\);\n\s+this\.syncSwitches\(\);\n\s+this\.queueFit\(\);\n\s+\}, \{once: false\}\);/u);
  assert.match(source, /collapsedAnswerStale\(\) \{\n\s+return this\._collapsedNow === undefined\n\s+\|\| this\._collapsedRow !== this\.collapseRow\(\)\n\s+\|\| this\._collapsedStep !== this\.collapse;/u);
  assert.match(source, /globalThis\.addEventListener\('resize', this\._onResize, \{passive: true\}\);/u);
  assert.match(source, /globalThis\.removeEventListener\('resize', this\._onResize\);/u);
  assert.equal((source.match(/this\.syncSwitches\(\);/gu) || []).length, 5);
  // Focus goes back to the switch when the bar drew no button.
  assert.match(source, /const button = this\.menuButton\(\) \?\? this\.outsideSwitch\(\);/u);
  assert.match(source, /return this\.collapsed \? \(this\.menuButton\(\) \?\? this\.outsideSwitch\(\)\) : null;/u);
});

test('header site C104: the docs name both settings and the version is a minor', () => {
  assert.match(docs, /menu-placement="inline-end"/u);
  assert.match(docs, /data-header-site="toggle"/u);
  assert.match(docs, /aria-controls="site-header"/u);
  // 1.9.0 brought C104; later versions keep it (1.10.0: C161 (8)).
  const [major, minor] = component.version.split('.').map(Number);
  assert.ok(major === 1 && minor >= 9, component.version);
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.9.0 (2026-11-12, owner decision C104')));
});

test('header site C104 / C181 (2): collapse is a container step of the bar, and the script reads the sheet\'s answer', () => {
  // The <header> is the container; no screen query collapses the bar any more.
  assert.match(sheet, /container: sf-site-header \/ inline-size;/u);
  assert.match(sheet, /@each \$step, \$container-step in \(sm: g6, md: h1, lg: h5, xl: h8\) \{\n  @container sf-site-header \(width < #\{mq\.container-step\(\$container-step\)\}\) \{\n    \.sf-site-header--collapse-#\{\$step\} \{\n      @include collapsed;/u);
  assert.doesNotMatch(sheet, /@media not all and \(min-width/u);
  // collapse-always, each step, (1.13.0, F-1) a nav that overflows its box and
  // (1.14.0, C371) collapse auto's md floor before the bar has measured itself.
  assert.equal((sheet.match(/--sf-site-header--collapsed: 1;/gu) || []).length, 4, 'collapse-always, each step, the nav overflow and the auto floor publish the answer');
  assert.match(sheet, /:is\(sf-header-site, sf-site-header\):is\(:not\(:defined\), :has\(\.sf-site-header-nav > sf-menu:not\(:defined\)\)\) > \.sf-site-header--collapse-auto \{/u);
  assert.match(sheet, /:is\(sf-header-site, sf-site-header\)\[data-nav-overflow='true'\] > \.sf-site-header \{\n  @include collapsed;/u);
  // Every rule of the collapsed state styles a part inside the container, never the container itself.
  for (const [, selector] of collapsed.matchAll(/^  (&[^{\n]*)\{/gmu)) assert.match(selector, /^&[^ ]* \S/u, `${selector} styles a part of the bar`);
  assert.match(source, /getPropertyValue\('--sf-site-header--collapsed'\)\.trim\(\) === '1'/u);
  // collapse auto (1.14.0, C371, C372) lays the row out in the same observer.
  assert.match(source, /this\._sizeObserver = new ResizeObserver\(\(\) => \{\n\s+if \(this\.collapse === 'auto'\) \{\n\s+this\.fitRow\(\);\n\s+return;\n\s+\}\n\s+this\.syncCollapsed\(\);\n\s+this\.syncFit\(\);\n\s+\}\);/u);
  // F-1: the nav's content past its box collapses the bar until it is as wide as the nav needed.
  assert.match(source, /this\.setFit\(Math\.ceil\(width \+ spread\.width - room\.width\) \+ 1\);/u);
  assert.equal(component['host-states']['data-nav-overflow'], 'boolean');
  assert.match(source, /if \(collapsed === this\._collapsedNow\) return;/u);
  assert.match(component.settings.collapse.summary, /own width/u);
  // Below xl the row's gutter is the step the bar is at (the .container utility's own inset).
  assert.match(sheet, /@each \$from, \$to, \$step in \(g6 h1 sm, h1 h5 md, h5 h8 lg\) \{\n  \$space: map\.get\(container\.\$container-array, \$step\);/u);
  assert.match(sheet, /--sf-container--inset: var\(--sf-container-gutter, var\(--sf-space-#\{\$space\}\)\);/u);
  assert.match(sheet, /@container sf-site-header \(width >= #\{mq\.container-step\(h8\)\}\) \{\n  \.sf-site-header-row \{\n    --sf-container--inset: initial;/u);
});

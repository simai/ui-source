import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-alert-bar (2026-11-05), the page alert bar of block alert: what its
// source promises, held without a browser. The behaviour is probed on the
// built bytes by tests/browser/alert-bar.browser.mjs and
// src/smart/alert-bar/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/alert-bar/component.json');
const source = read('src/smart/alert-bar/index.js');
const template = read('src/smart/alert-bar/js/templates/default.js');
const sheet = read('src/smart/alert-bar/scss/_smart__alert-bar.scss');

test('the manifest: a leaf of block alert with items, four events and the close action', () => {
  assert.equal(manifest.tag, 'sf-alert-bar');
  assert.equal(manifest.family, 'alert');
  assert.equal(manifest.version, '1.6.1');
  assert.deepEqual(Object.keys(manifest.settings), ['items', 'size', 'label']);
  assert.deepEqual(manifest.settings.items.schema.items.properties.level.enum, ['error', 'warning', 'info']);
  assert.deepEqual(manifest.settings.items.schema.items.required, ['id', 'level', 'text']);
  assert.deepEqual(Object.keys(manifest.values), ['minimized']);
  assert.deepEqual(Object.keys(manifest.events), ['navigate', 'acknowledge', 'close', 'minimize']);
  assert.deepEqual(manifest.events.close.carries.hide.values, ['day', 'always']);
  for (const verb of ['navigate', 'acknowledge', 'close']) assert.equal(manifest.events[verb].cancelable, true, verb);
  assert.equal(manifest.events.acknowledge['own-verb'], true);
  assert.deepEqual(Object.keys(manifest.actions), ['close']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-time', 'cl-button', 'cl-button-icon', 'cl-icon']);
});

test('the name is registered in the Framework\'s family alert', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('alert'));
  assert.ok(framework.names.some(({element}) => element === 'sf-alert-bar'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/alert-bar\/rule\.js';/u);
});

test('the order, the hide periods and the level words', async () => {
  // The pure part of index.js, read without the element: the sort and the
  // periods are the owner's decisions of 2026-11-05.
  assert.match(source, /export const HIDE = \{warning: 'day', info: 'always'\}/u);
  assert.match(source, /const RANK = \{error: 0, warning: 1, info: 2\}/u);
  assert.match(source, /if \(a\.at !== null && b\.at !== null && a\.at !== b\.at\) return b\.at - a\.at;/u);
  assert.match(source, /dismissible: level !== 'error' && item\.dismissible !== false/u);
  const ru = json('src/smart/alert-bar/lang/ru.json');
  const en = json('src/smart/alert-bar/lang/en.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime['hide-day'], 'Скрыть на сутки');
  // «Ещё N» counts the others (C114 (3), NS-12); «Все N» is gone.
  assert.equal(ru.runtime.more, 'Ещё {count}');
  assert.equal(en.runtime.more, '{count} more');
  assert.equal(ru.runtime.all, undefined);
  // The acknowledge word (owner decision C114 (2), NS-11).
  assert.equal(ru.runtime.acknowledge, 'Прочитано');
  assert.equal(ru.events.acknowledge.label, 'Прочитано');
  assert.equal(en.runtime.acknowledge, 'Mark as read');
  assert.equal(en.events.acknowledge.label, 'Mark as read');
  // No paging (C114 (3)): the words of the arrows are gone with them.
  for (const key of ['position', 'prev', 'next']) assert.equal(ru.runtime[key], undefined, key);
  // The most serious level is error, as on every message (decision C13);
  // the former danger is read as error.
  assert.equal(ru.runtime['level-error'], 'Ошибка');
  assert.match(source, /if \(word === 'danger'\) \{/u);
});

test('it stores nothing and takes no focus', () => {
  const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(/u);
  // Focus moves only from a control of the bar that left, or on a press.
  assert.doesNotMatch(code, /onConnected\(\) \{[^}]*focus\(/u);
});

test('one live region for a new error item, one for the rest; the bar is a named region', () => {
  assert.match(template, /role="region" aria-label=\$\{label \|\| nothing\}/u);
  assert.match(template, /class="sf-alert-bar-live sr-only" role="alert">\$\{announce\.alert\}/u);
  assert.match(template, /class="sf-alert-bar-live sr-only" role="status">\$\{announce\.status\}/u);
  assert.equal((template.match(/role="alert"/gu) ?? []).length, 1);
});

test('the controls are the Framework\'s own: sf-button and sf-button-icon', () => {
  assert.match(template, /<sf-button class="sf-alert-bar-action"/u);
  assert.match(template, /<sf-button-icon class="sf-alert-bar-close" icon="close"/u);
  assert.doesNotMatch(template, /<sf-badge/u);
  assert.doesNotMatch(template, /<button class="sf-button/u);
  // No paging arrows (C114 (3)); one button family, the action tonal and the
  // rest ghost (AA-15, C110).
  assert.doesNotMatch(template, /sf-alert-bar-(pager|prev|next|position)/u);
  assert.match(template, /<sf-button class="sf-alert-bar-all" size=\$\{size\} height="low" appearance="ghost"/u);
  assert.equal((template.match(/<sf-button(-icon)? [^>]*appearance="tonal"/gu) ?? []).length, 0);
  assert.match(template, /actionLink\(context, item, 'tonal'\)/u);
});

test('the sheet: one rung, the theme status roles, the narrow container and reduced motion', () => {
  for (const role of ['--sf-error', '--sf-on-error', '--sf-warning', '--sf-on-warning', '--sf-info', '--sf-on-info']) {
    assert.ok(sheet.includes(`var(${role}`), role);
  }
  assert.match(sheet, /--sf-alert-bar--padding-block: calc\(\(var\(--sf-alert-bar--control\) - var\(--sf-alert-bar--line\)\) \/ 2\);/u);
  assert.match(sheet, /@container sf-alert-bar \(max-width: 38rem\)/u);
  // C105 steps (AA-14): edge 16, icon to text 12, text to actions 16,
  // between buttons and to the end button 8.
  assert.match(sheet, /--sf-alert-bar--edge: var\(--sf-space-1\);/u);
  assert.match(sheet, /--sf-alert-bar--gap: var\(--sf-alert-bar-gap, var\(--sf-space-1\)\);/u);
  assert.match(sheet, /--sf-alert-bar--icon-gap: var\(--sf-space-1\\\/2\);/u);
  assert.match(sheet, /--sf-alert-bar--between: var\(--sf-space-1\\\/3\);/u);
  // The page column of a site bar (AA-16): the .container inset per step.
  assert.match(sheet, /\(100cqi - var\(--sf-breakpoint-#\{\$step\}\)\) \/ 2/u);
  // Narrow: actions from the text start (AA-17) and an even bottom (NS-8).
  assert.match(sheet, /justify-content: flex-start;/u);
  assert.match(sheet, /padding-block-end: calc\(var\(--sf-alert-bar--padding-block\) \+ \(var\(--sf-alert-bar--control\) - var\(--sf-alert-bar--line\)\) \/ 2 \+ \(var\(--sf-alert-bar--line\) - 1cap\) \/ 2\);/u);
  assert.match(sheet, /@media \(prefers-reduced-motion: no-preference\)/u);
  // No raw colour: theme roles and the ink's alpha mixes only.
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgb\(/iu);
});

test('C117 (NS-13): every button is height low and the rung control is the low step', () => {
  // Six buttons: action, acknowledge, «Ещё N», close, minimize, the list's close.
  const buttons = template.match(/<sf-button(-icon)? class="sf-alert-bar-[a-z-]+"[^>]*>/gu) ?? [];
  assert.equal(buttons.length, 6);
  for (const one of buttons) assert.match(one, / height="low" /u, one);
  assert.match(sheet, /--sf-alert-bar--control: calc\(var\(--sf-alert-bar--line\) \+ 2 \* var\(--sf-ui-1\\\/2--space-y-tightness-low\)\);/u);
  assert.match(sheet, /--sf-alert-bar--control: calc\(var\(--sf-alert-bar--line\) \+ 2 \* var\(--sf-ui-1--space-y-tightness-low\)\);/u);
  assert.doesNotMatch(sheet, /--sf-alert-bar--control: var\(--sf-ui-[^)]*--control-height\)/u);
});

test('the conformance probe covers the twelve behaviours', () => {
  const probe = json('src/smart/alert-bar/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), [
    'p1-order-and-colour', 'p2-one-button-family', 'p3-list-of-all', 'p4-close-warning', 'p5-close-info', 'p6-danger-minimizes',
    'p7-acknowledge', 'p8-navigate', 'p9-live-regions', 'p10-close-action', 'p11-narrow', 'p12-english',
  ]);
});

test('NS-12: the open list holds the others, each row the bar row\'s composition', () => {
  // «Ещё N» counts the others; the list draws them, not the shown item.
  assert.match(source, /const others = list\.filter\(\(item\) => item !== current\);/u);
  assert.match(source, /more: word\('more', \{count: others\.length\}\)/u);
  assert.match(template, /text=\$\{listOpen \? words\.collapseList : words\.more\}/u);
  // A row: the level icon with its word for a screen reader, the text and
  // meta, the actions, then the close or its kept place (an error row).
  assert.match(template, /icon\(icons\[item\.level\], 'sf-alert-bar-item-icon'\)/u);
  assert.match(template, /<span class="sr-only">\$\{item\.levelWord\}: <\/span>/u);
  assert.match(template, /<sf-button-icon class="sf-alert-bar-item-close" icon="close"/u);
  assert.match(template, /<span class="sf-alert-bar-item-end" aria-hidden="true"><\/span>/u);
  // The sheet: a row is the bar row (the rung's block inset, the page
  // column, 8 to the end button), the kept place the low control's square,
  // the list's cross the notice ink 64 (C112), the narrow row on a grid.
  assert.match(sheet, /\.sf-alert-bar-item \{\n {2}display: flex;/u);
  assert.match(sheet, /\.sf-alert-bar-item > \.sf-alert-bar-item-end \{\n {2}inline-size: var\(--sf-alert-bar--control\);/u);
  assert.match(sheet, /light-dark\(var\(--sf-black--alfa-64\), var\(--sf-white--alfa-64\)\)/u);
  assert.match(sheet, /\.sf-alert-bar-item:has\(> \.sf-alert-bar-item-actions\) \{/u);
  // Focus after a row leaves goes to the row that takes its place.
  assert.match(source, /left\[Math\.min\(place, left\.length - 1\)\]/u);
});

test('1.6.1: narrow, the open toggle keeps the place of «Ещё N»; a row\'s time is no Tab stop', () => {
  // The open toggle names itself «Свернуть список» and carries the collapse
  // glyph; the glyph is drawn only on a narrow bar, where the label is hidden
  // for the name alone and the button is the low control's square.
  assert.match(template, /icon-start=\$\{listOpen \? context\.collapseIcon : nothing\}/);
  assert.match(source, /export const COLLAPSE_ICON = 'unfold_less';/);
  assert.match(source, /collapseIcon: COLLAPSE_ICON/);
  // Asked for with the first drawing of a bar with several items, so the
  // glyph rides the page's icon request.
  assert.match(source, /if \(context\.count > 1\) preloadControlIcons\(this, \[\{icon: COLLAPSE_ICON, filled: false\}\]\);/);
  assert.match(template, /aria-label=\$\{listOpen \? words\.collapseList : nothing\}/);
  assert.match(sheet, /@container sf-alert-bar \(width > 38rem\) \{\s*\.sf-alert-bar-row \.sf-alert-bar-all > button > sf-icon > \.sf-icon \{\s*position: absolute;\s*visibility: hidden;/);
  const narrow = sheet.slice(sheet.indexOf('@container sf-alert-bar (max-width: 38rem)'));
  assert.match(narrow, /\.sf-alert-bar-all > button\[aria-expanded="true"\] \{[^}]*inline-size: var\(--sf-alert-bar--control\);[^}]*padding-inline: 0;/);
  assert.match(narrow, /\.sf-alert-bar-all > button\[aria-expanded="true"\] > \.sf-button-text-container \{[^}]*clip-path: inset\(50%\);/);
  // A row's time: sf-time with tooltip none (no tooltip, no tabindex); the
  // bar's own time keeps its tooltip.
  assert.match(template, /meta\(item, 'sf-alert-bar-item-meta', 'none'\)/);
  assert.match(template, /tooltip=\$\{tooltip === 'auto' \? nothing : tooltip\}/);
  assert.match(template, /\$\{meta\(item\)\}/);
});

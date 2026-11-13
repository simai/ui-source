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
  assert.equal(manifest.version, '1.4.2');
  assert.deepEqual(Object.keys(manifest.settings), ['items', 'size', 'label']);
  assert.deepEqual(manifest.settings.items.schema.items.properties.level.enum, ['error', 'warning', 'info']);
  assert.deepEqual(manifest.settings.items.schema.items.required, ['id', 'level', 'text']);
  assert.deepEqual(Object.keys(manifest.values), ['minimized']);
  assert.deepEqual(Object.keys(manifest.events), ['navigate', 'acknowledge', 'close', 'minimize']);
  assert.deepEqual(manifest.events.close.carries.hide.values, ['day', 'always']);
  for (const verb of ['navigate', 'acknowledge', 'close']) assert.equal(manifest.events[verb].cancelable, true, verb);
  assert.equal(manifest.events.acknowledge['own-verb'], true);
  assert.deepEqual(Object.keys(manifest.actions), ['close']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-time', 'cl-button', 'cl-button-icon', 'cl-badge', 'cl-icon']);
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
  assert.equal(ru.runtime.position, '{n} из {count}');
  assert.equal(ru.runtime.all, 'Все {count}');
  assert.equal(en.events.acknowledge.label, 'Mark as seen');
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

test('the controls are the Framework\'s own: sf-button, sf-button-icon, sf-badge', () => {
  assert.match(template, /<sf-button class="sf-alert-bar-action"/u);
  assert.match(template, /<sf-button-icon class="sf-alert-bar-close" icon="close"/u);
  assert.match(template, /<sf-badge class="sf-alert-bar-badge"/u);
  assert.doesNotMatch(template, /<button class="sf-button/u);
});

test('the sheet: one rung, the theme status roles, the narrow container and reduced motion', () => {
  for (const role of ['--sf-error', '--sf-on-error', '--sf-warning', '--sf-on-warning', '--sf-info', '--sf-on-info']) {
    assert.ok(sheet.includes(`var(${role}`), role);
  }
  assert.match(sheet, /--sf-alert-bar--padding-block: calc\(\(var\(--sf-alert-bar--control\) - var\(--sf-alert-bar--line\)\) \/ 2\);/u);
  assert.match(sheet, /@container sf-alert-bar \(max-width: 38rem\)/u);
  assert.match(sheet, /@media \(prefers-reduced-motion: no-preference\)/u);
  // No raw colour: theme roles and the ink's alpha mixes only.
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgb\(/iu);
});

test('the conformance probe covers the twelve behaviours', () => {
  const probe = json('src/smart/alert-bar/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), [
    'p1-order-and-colour', 'p2-paging', 'p3-list-of-all', 'p4-close-warning', 'p5-close-info', 'p6-danger-minimizes',
    'p7-acknowledge', 'p8-navigate', 'p9-live-regions', 'p10-close-action', 'p11-narrow', 'p12-english',
  ]);
});

// A panel's rows (owner remark R193, dropdown-panels study, defects DP-1 and
// DP-4; measured in a browser in ui-control
// control/evidence/2026-11-12-settings-panel-dp/).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/component/context-menu/scss/_css__context_menu.scss', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/smart/menu-context/index.js', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../src/smart/menu-context/docs/docs.md', import.meta.url), 'utf8');
const core = readFileSync(new URL('../src/core/js/element-manifest.js', import.meta.url), 'utf8');

const rule = (selector) => {
  const at = css.indexOf(`\n${selector} {`);
  assert.ok(at >= 0, selector);
  return css.slice(at, css.indexOf('}', at));
};

// DP-1: three positional columns put the mark in the text's column when a row
// has no handle, right after a label of any length. The row places by role:
// the text takes the rest, so what follows it ends the row.
test('a panel row places its parts by role, the mark at the end', () => {
  const row = rule('.sf-context-menu-row');
  assert.match(row, /display: flex;/);
  assert.doesNotMatch(row, /grid-template-columns/);
  assert.match(row, /gap: var\(--sf-space-1\\\/3\);/);
  assert.match(rule('.sf-context-menu-row > *'), /flex: none;/);
  const text = rule('.sf-context-menu-row > .sf-context-menu-row-text');
  assert.match(text, /flex: 1 1 0;/);
  assert.match(text, /min-inline-size: 0;/);
});

// DP-4: the rows of one container with a checkbox or a switch are one Tab
// stop, walked by the arrows; radios are the platform's own group.
test('a list of checkable rows is one Tab stop with arrows inside', () => {
  assert.match(source, /const ROW_MARK = 'input\[type="checkbox"\], \[role="checkbox"\], \[role="switch"\]';/);
  assert.doesNotMatch(source.match(/const ROW_MARK = [^;]+;/)[0], /radio/);
  const lists = source.slice(source.indexOf('  rowLists() {'), source.indexOf('  rowListOf(element)'));
  assert.match(lists, /querySelectorAll\("\.sf-context-menu-row"\)/);
  assert.match(lists, /row\.parentElement/);
  assert.match(lists, /list\.marks\.length > 1/);
  const sync = source.slice(source.indexOf('  syncRowLists() {'), source.indexOf('  releaseRowMark(mark)'));
  assert.match(sync, /mark === current \? "0" : "-1"/);
  assert.match(sync, /this\.releaseRowMark\(mark\)/);
  const keys = source.slice(source.indexOf('  handleRowKeyDown(event) {'));
  for (const key of ['ArrowDown', 'ArrowUp', 'Home']) assert.ok(keys.includes(`case "${key}"`), key);
  for (const key of ['" "', '"Enter"', '"Tab"', '"Escape"']) assert.ok(!keys.slice(0, keys.indexOf('\n  }\n')).includes(`case ${key}`), key);
  // The row walk runs before the menu's own, and the mark's original tabindex
  // is given back when the menu leaves the page.
  assert.ok(source.indexOf('this.addEventListener("keydown", this.handleRowKeyDown)')
    < source.indexOf('this.addEventListener("keydown", this.handleMenuKeyDown)'));
  assert.match(source, /for \(const mark of \[\.\.\.this\._rowMarks\.keys\(\)\]\) this\.releaseRowMark\(mark\);\n    this\._currentItem = null;/);
  // A walked mark is not a Tab stop for the sheet's wrap or a form's first focus.
  assert.match(source, /&& element\.getAttribute\("tabindex"\) !== "-1"/);
});

// DP-2: a label around a form-associated sf-radio clicks the host, not the
// radio inside. The core passes the host's press on to its control (RD-1,
// element-manifest.js activateFromLabel, tests/label-activates-form-host); the
// menu keeps no row click of its own, which would reach a row's mark twice.
test('a press on a row reaches a form-associated mark through the core alone', () => {
  assert.doesNotMatch(source, /handleRowClick/);
  assert.match(core, /function activateFromLabel\(event\)/);
});

// Owner decision C106 (9): the context menu's page teaches actions only. The
// panel with tabs (its rows, the radio group of DP-2, the list keys) left the
// page: a list's view settings are sf-settings look="panel", and tabs is
// named a former name. It taught the panel's rows here before.
test('the docs teach actions only and send view settings to sf-settings', () => {
  assert.doesNotMatch(docs, /tabs="[^"]*"/);
  assert.doesNotMatch(docs, /## Панель с вкладками/);
  assert.match(docs, /`sf-settings` с `look="panel"`/);
  assert.match(docs, /Атрибут `tabs` у `sf-menu-context`[\s\S]*прежнее имя: до 2027-01-01/);
});

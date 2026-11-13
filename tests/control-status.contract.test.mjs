import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {warnUnknownControlStatus} from '../src/smart/helpers/control-status.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function captureWarnings(run) {
  const said = [];
  const original = console.warn;
  console.warn = (message) => said.push(String(message));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return said;
}

function freshPage() {
  delete globalThis.SF?.__sfUnknownStatusWarned;
}

/* BS-1 (ui-control research 2026-11-13-button-schemes, rule C13): a control's
   status is danger alone. success, warning and info were dropped without a
   sound; they still draw no status, and the console says so once per page for
   each component and word. */
test('control status: an unknown status is said once per page, per component and word', () => {
  freshPage();
  const said = captureWarnings(() => {
    for (let round = 0; round < 3; round += 1) {
      for (const word of ['success', 'warning', 'info']) {
        assert.equal(warnUnknownControlStatus('sf-button', word), true);
      }
    }
    assert.equal(warnUnknownControlStatus('sf-button-icon', 'success'), true);
  });
  assert.equal(said.length, 4, said.join('\n'));
  for (const word of ['success', 'warning', 'info']) {
    assert.equal(said.filter((line) => line.startsWith(`[SIMAI Framework] sf-button: status="${word}" is not a status of a control`)).length, 1);
  }
  assert.ok(said.some((line) => line.startsWith('[SIMAI Framework] sf-button-icon: status="success"')));
  assert.ok(said.every((line) => line.includes('rule C13')));
});

test('control status: danger, its former names and no status say nothing', () => {
  freshPage();
  const said = captureWarnings(() => {
    for (const word of [null, undefined, '', 'danger', 'error', 'critical']) {
      assert.equal(warnUnknownControlStatus('sf-button', word), false);
    }
    for (const word of [undefined, '', 'danger', 'error']) {
      assert.equal(warnUnknownControlStatus('sf-menu-context', word, {allowed: ['', 'danger', 'error'], label: 'item status'}), false);
    }
  });
  assert.deepEqual(said, []);
});

test('control status: a menu item names its own setting and reads its own words', () => {
  freshPage();
  const said = captureWarnings(() => {
    warnUnknownControlStatus('sf-menu-context', 'critical', {allowed: ['', 'danger', 'error'], label: 'item status'});
    warnUnknownControlStatus('sf-menu-context', 'critical', {allowed: ['', 'danger', 'error'], label: 'item status'});
  });
  assert.equal(said.length, 1);
  assert.match(said[0], /^\[SIMAI Framework\] sf-menu-context: item status="critical" is not a status of a control/);
});

test('control status: the words said live on the shared global, one list for every bundle', () => {
  freshPage();
  captureWarnings(() => warnUnknownControlStatus('sf-button', 'success'));
  const list = globalThis.SF.__sfUnknownStatusWarned;
  assert.ok(list instanceof Set);
  assert.equal(Object.keys(globalThis.SF).includes('__sfUnknownStatusWarned'), false, 'not enumerable');
  assert.ok(list.has('sf-button|status|success'));
});

test('control status: sf-button, sf-button-icon and the menu item read it, and draw as before', () => {
  const button = read('src/smart/button/index.js');
  assert.match(button, /warnUnknownControlStatus\("sf-button", this\.getAttribute\("status"\)\)/u);
  const icon = read('src/smart/button-icon/index.js');
  assert.match(icon, /warnUnknownControlStatus\('sf-button-icon', this\.getAttribute\('status'\)\)/u);
  const menu = read('src/smart/menu-context/js/templates/default.js');
  assert.match(menu, /warnUnknownControlStatus\("sf-menu-context", entry\.status, \{allowed: ITEM_STATUSES, label: "item status"\}\)/u);
  // No visual change: the templates still draw danger (and error) alone.
  assert.match(read('src/smart/button/js/templates/default.js'), /status === 'danger' \|\| status === 'error' \? \['sf-button--danger', 'sf-button--error'\] : \[`sf-button--\$\{scheme\}`\]/u);
  assert.match(read('src/smart/button-icon/js/templates/default.js'), /if \(status === 'danger' \|\| status === 'error'\) return \['sf-icon-button--danger', 'sf-icon-button--error'\];/u);
  assert.match(menu, /return Boolean\(entry\.danger\) \|\| entry\.status === "danger" \|\| entry\.status === "error";/u);
});

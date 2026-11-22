// sf-progress-run 1.6.1 (group build 17, ASR-1 of DEV msg-05b29788): the notice look shows Cancel on a running or
// paused cancelable run, like the row look, and it fires the existing cancel event. Measured in the browser in
// ui-control evidence 2026-11-22-group-build-17 (probe/asr1-notice-cancel.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ASR-1: the notice look draws Cancel whenever the run shows it, not only the row look', () => {
  const template = read('src/smart/progress-run/js/templates/default.js');
  const body = template.slice(template.indexOf('function iconActions(context)'), template.indexOf('function row(context)'));
  assert.match(body, /\$\{showCancel \? one\('cancel', 'close', words\.cancel, \(\) => component\.onCancel\(\)\) : nothing\}/u);
  assert.doesNotMatch(body, /showCancel && view === 'row'/u, 'the notice look keeps Cancel too');
  assert.ok(body.indexOf("one('cancel'") < body.indexOf("one('expand'"), 'Cancel stands before Expand');
});

test('ASR-1: Cancel is shown for a running or paused cancelable run and fires sf-progress-run-cancel', () => {
  const index = read('src/smart/progress-run/index.js');
  assert.match(index, /showCancel: Boolean\(this\.cancelable\) && \(state === 'running' \|\| state === 'paused'\),/u);
  assert.match(index, /this\.sfEmit\('cancel', \{\}, \{cancelable: true\}\);/u);
  assert.equal(JSON.parse(read('src/smart/progress-run/component.json')).version, '1.6.1');
});

test('ASR-1: the Cancel word comes from the registry in every language', () => {
  for (const lang of ['ru', 'en', 'de', 'ar']) {
    const words = JSON.parse(read(`src/smart/progress-run/lang/${lang}.json`));
    assert.equal(typeof words.runtime.cancel, 'string', `${lang} has a cancel word`);
  }
});

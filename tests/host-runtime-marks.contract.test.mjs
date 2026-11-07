// element.dataAttributes reports what the author wrote on a Smart host and
// nothing the runtime put there (docs review R022, 2026-11-07: sf-button
// returned sfStyleReady beside the author's data-add).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOST_RUNTIME_MARKS, readHostDataAttributes} from '../src/core/js/host-runtime-marks.js';

test('the style gate marks are runtime marks', () => {
  for (const mark of ['data-sf-style-pending', 'data-sf-style-ready', 'data-sf-started', 'data-sf-static', 'data-sf-role']) {
    assert.ok(HOST_RUNTIME_MARKS.has(mark), mark);
  }
});

test('dataAttributes reads the author\'s data-* the way dataset does and leaves the runtime marks out', () => {
  const record = new Map([
    ['data-add', 'x'],
    ['data-row-id', '7'],
    ['data-sf-style-ready', ''],
    ['data-sf-style-pending', ''],
    ['data-sf-started', ''],
  ]);
  assert.deepEqual(readHostDataAttributes(record), {add: 'x', rowId: '7'});
  assert.deepEqual(readHostDataAttributes(new Map([['data-sf-style-ready', '']])), {});
  assert.deepEqual(readHostDataAttributes(undefined), {});
  assert.deepEqual(readHostDataAttributes(new Map()), {});
});

test('the Smart base reads the record through the helper and forwards no runtime mark', async () => {
  const base = await readFile(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
  assert.match(base, /import \{ HOST_RUNTIME_MARKS, readHostDataAttributes \} from '\.\/host-runtime-marks\.js';/u);
  assert.match(base, /get dataAttributes\(\) \{\s*return readHostDataAttributes\(this\.__sfHostDataAttributes\);\s*\}/u);
  assert.match(base, /if \(HOST_RUNTIME_MARKS\.has\(name\)\) \{\s*return;\s*\}/u);
  assert.doesNotMatch(base, /const HOST_RUNTIME_MARKS = new Set/u, 'one list, in host-runtime-marks.js');
});

// Plain group 2, the remainder after C185 (DEV letter msg-0af5b318, study
// ui-control control/research/2026-11-14-plain-group-2.md, re-measured on the
// pair 5.20261115.1622): the class scale's thresholds (MR-2, owner decision
// C131 (7)) and the retired offline point of the avatar (DT-3, C152 (5)).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

// The class scale reads the thresholds through the one shared module
// (src/component/progress-threshold.js, C131 (7)), as sf-progress-bar and the
// Smart scale do (group build 9: GB8's fix/returns-gb67 had given the class
// scale that module; this branch's own copy of it is not taken).
test('MR-2, C131 (7): the class scale takes data-warning-at and data-error-at, the more serious status wins', async () => {
  const {readThreshold, effectiveStatus} = await import(new URL('src/component/progress-threshold.js', root));
  const tone = (status, value, warningAt, errorAt) => effectiveStatus(status, value, readThreshold(warningAt), readThreshold(errorAt));
  assert.equal(tone('', 85, '80', '95'), 'warning');
  assert.equal(tone('', 97, '80', '95'), 'error');
  assert.equal(tone('', 79, '80', '95'), '');
  assert.equal(tone('success', 85, '80', undefined), 'warning');
  assert.equal(tone('error', 85, '80', undefined), 'error', 'the page\'s error stays');
  assert.equal(tone('neutral', 50, '', 'x'), 'neutral', 'unset or not a number is no threshold');
  assert.equal(tone('', 0, '0', undefined), 'warning', 'a threshold of 0 holds');

  const source = await read('src/component/progress-scale/js/_progress_scale.js');
  assert.match(source, /import \{ effectiveStatus, readThreshold \} from '\.\.\/\.\.\/progress-threshold';/u);
  assert.match(source, /readThreshold\(root\.dataset\.warningAt\), readThreshold\(root\.dataset\.errorAt\)/u);
  assert.match(source, /syncScaleClasses\(root, step, size, drawn\);/u);
  // data-tone keeps the page's own word, so a later threshold change can
  // fall back to it.
  assert.match(source, /root\.dataset\.tone = tone;/u);
  assert.match(source, /\[\['warningAt', 'warningAt'\], \['errorAt', 'errorAt'\]\]\.forEach/u, 'setState takes warningAt and errorAt');
});

test('DT-3, C152 (5): .sf-online-indicator--offline is a retired class until 2027-01-01', async () => {
  const {default: retired} = await import(new URL('src/core/js/retired-classes.table.js', root));
  const {retiredClassName} = await import(new URL('src/core/js/utility-class-aliases.js', root));
  const row = retired.records.find((item) => item.journal === 'class-avatar-offline-point-retired');
  assert.ok(row, 'the retired-classes table holds the record');
  // group build 9: the record of fix/content-media-ct1 (C152 (5) with C185 (8), 2026-11-16) is the one taken.
  assert.deepEqual([row.decision, row.component, row.since, row.remove_after], ['C152 (5), C185 (8)', 'avatars', '2026-11-16', '2027-01-01']);
  const found = retiredClassName('sf-online-indicator--offline');
  assert.deepEqual([found.found.component, found.to], ['avatars', '']);
  for (const kept of ['sf-online-indicator--online', 'sf-online-indicator--away', 'sf-online-indicator']) {
    assert.equal(retiredClassName(kept), null, kept);
  }
  const journal = JSON.parse(await read('contracts/changes/journal.json'));
  const record = journal.records.find((item) => item.id === 'class-avatar-offline-point-retired');
  assert.ok(record, 'journal record');
  assert.deepEqual([record.kind, record.remove_after, record.items[0].from, record.items[0].to ?? null], ['class', '2027-01-01', 'sf-online-indicator--offline', null]);
  // The sheet holds the rule until the date; it hides the point (content study Av1, C185 (8)).
  const sheet = await read('src/component/avatars/scss/_css__avatar_online_indicator.scss');
  assert.match(sheet, /\.sf-online-indicator--offline \{\s*display: none;/u);
});

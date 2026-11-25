import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// The known reds and known flakes of the browser probes (group build 18 pre-cut, DEV
// answers 8 and 9): each entry names a probe that exists, its owner and what it says,
// and the runner reads both lists.
const root = resolve(import.meta.dirname, '..');
const read = (file) => JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'browser-probes', file), 'utf8'));

test('every known red names a browser probe, its owner, the pair it was red on and why', () => {
  const {known, pair} = read('known-reds.json');
  assert.match(pair, /^ui-[0-9a-f]{12}$/u);
  assert.ok(Object.keys(known).length > 0);
  for (const [name, entry] of Object.entries(known)) {
    assert.ok(existsSync(join(root, 'tests', 'browser', `${name}.browser.mjs`)), `${name}: no such probe`);
    assert.ok(entry.owner && entry.why && entry.seen, `${name}: owner, why and seen`);
    assert.equal(entry.red_since, pair, `${name}: red on the pair the list names`);
  }
});

test('every known flake says its gate, owner, the condition it shows under and how often', () => {
  const {flakes} = read('known-flakes.json');
  assert.ok(Object.keys(flakes).length > 0);
  for (const [id, flake] of Object.entries(flakes)) {
    for (const key of ['gate', 'owner', 'says', 'condition', 'rate', 'evidence']) assert.ok(flake[key], `${id}: ${key}`);
  }
});

test('the probe runner reads both lists and counts known reds apart without making them green', () => {
  const source = readFileSync(join(root, 'scripts', 'run-browser-probes.mjs'), 'utf8');
  assert.match(source, /known-reds\.json/u);
  assert.match(source, /known-flakes\.json/u);
  assert.match(source, /knownNowPassing/u);
  assert.match(source, /if \(results\.failed\.length \|\|/u, 'any failure, known or new, still fails the run');
});

// Group build 19 area C (msg-a844079b8ba3455d9123): 25 of the 41 known reds were
// probe faults, fixed and taken out. The list only shrinks: no more than the 16
// left, each a component fault with its triage line (a GB20 item).
test('the known reds only shrink, and each one left carries its GB19 triage', () => {
  const {known} = read('known-reds.json');
  assert.ok(Object.keys(known).length <= 16, `${Object.keys(known).length} known reds, at most 16 since GB19`);
  for (const [name, entry] of Object.entries(known)) assert.match(entry.triage ?? '', /^group build 19 area C .*component fault\. GB20: /u, `${name}: triage`);
});

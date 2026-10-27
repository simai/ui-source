import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// A modal drawer's Tab cycle takes in the edge beside the panel: the close,
// copy and open-full controls a record panel stands there were never reached
// by Tab (simai.main keyboard QA, 2026-10-28).
const source = readFileSync(new URL('../src/smart/drawer/index.js', import.meta.url), 'utf8');

test('the Tab cycle runs through the panel and then its edge', () => {
  const body = source.slice(source.indexOf('  onKeyDown(event) {'), source.indexOf('  emitDrawerEvent('));
  assert.match(body, /const edge = this\.getDrawerRoot\(\)\?\.querySelector\('\[data-sf-drawer-edge\]'\);/u);
  assert.match(body, /\[panel, edge\]\s*\.flatMap\(\(area\) => Array\.from\(area\?\.querySelectorAll\(FOCUSABLE_SELECTOR\) \|\| \[\]\)\)/u);
  assert.match(body, /if \(!inside\(document\.activeElement\)\) \{/u);
  assert.doesNotMatch(body, /!panel\?\.contains\(document\.activeElement\)/u);
});

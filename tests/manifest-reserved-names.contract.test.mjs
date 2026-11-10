// A setting, event or action whose name the element runtime keeps for itself
// (core/js/element-manifest.js RESERVED, a leading _ or sf) is refused without
// a word: the attribute does nothing. sf-progress-run 1.3 shipped `view` and
// `started` that way before the probe caught it; this keeps every manifest clear.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {readManifest} from '../src/core/js/element-manifest.js';

const smart = join(import.meta.dirname, '..', 'src', 'smart');

test('no smart manifest names a member the element runtime reserves', () => {
  const found = [];
  for (const folder of readdirSync(smart)) {
    const file = join(smart, folder, 'component.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    if (!manifest.tag) continue;
    let read;
    try { read = readManifest(manifest); } catch { continue; }
    for (const one of read.refused || []) found.push(`${manifest.tag} ${one.part} ${one.name}: ${one.reason}`);
  }
  assert.deepEqual(found, []);
});

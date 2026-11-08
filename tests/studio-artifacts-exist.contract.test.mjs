import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

// A manifest's artifacts name the Studio fixture and scenario files a Studio
// reads from the component folder. sf-input-choice 1.0.0 named a
// studio.scenario.json it never had (its studio example carried no scenario,
// and the generator's default names one), and the Studio tests in ui-view,
// ui-editor and ui-pro skip such a folder rather than fail (2026-11-08). A
// named artifact is a file of the folder.

const root = new URL('../', import.meta.url).pathname;
const smart = join(root, 'src/smart');

test('every artifact a Smart manifest names is a file of its folder', () => {
  const missing = [];
  for (const folder of readdirSync(smart)) {
    const path = join(smart, folder, 'smart.manifest.json');
    if (!existsSync(path)) continue;
    const {artifacts = {}} = JSON.parse(readFileSync(path, 'utf8'));
    for (const name of [...(artifacts.fixtures ?? []), ...(artifacts.scenarios ?? [])]) {
      if (!existsSync(join(smart, folder, name))) missing.push(`${folder}/${name}`);
    }
  }
  assert.deepEqual(missing, []);
});

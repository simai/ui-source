import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isSchema} from '../src/core/js/schema-name.mjs';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/* A manifest default is what the component does with the attribute absent;
   tests/browser/manifest-defaults.browser.mjs holds that on the built
   classes. This holds, for the node gate, the half that needs no browser: a
   component's meta.mjs overrides its manifest when the studio artifacts are
   regenerated, so the two must agree, or a regeneration silently rewrites the
   manifest (sf-dropdown's meta said filled while the component drew
   outlined). */
test('manifest defaults: meta.mjs and the manifest agree', async () => {
  const offenders = [];
  let compared = 0;
  for (const name of readdirSync(resolve(root, 'src/smart'))) {
    const metaPath = resolve(root, `src/smart/${name}/meta.mjs`);
    const manifestPath = resolve(root, `src/smart/${name}/smart.manifest.json`);
    if (!existsSync(metaPath) || !existsSync(manifestPath)) continue;
    const meta = (await import(pathToFileURL(metaPath).href)).default;
    const properties = JSON.parse(readFileSync(manifestPath, 'utf8')).inputs?.properties || {};
    for (const [attribute, spec] of Object.entries(meta?.attributes || {})) {
      if (!('default' in spec) || !properties[attribute]) continue;
      let expected = spec.default;
      if (spec.kind === 'boolean' && typeof expected === 'string') expected = expected === 'true';
      compared += 1;
      if (JSON.stringify(properties[attribute].default) !== JSON.stringify(expected)) {
        offenders.push(`${name} ${attribute}: meta ${JSON.stringify(expected)}, manifest ${JSON.stringify(properties[attribute].default)}`);
      }
    }
  }
  assert.ok(compared > 10, `only ${compared} meta defaults compared`);
  assert.deepEqual(offenders, []);
});

test('manifest defaults: every exemption names a real component and a reason', () => {
  const contract = JSON.parse(read('contracts/manifest-defaults.json'));
  assert.ok(isSchema(contract, 'simai.manifest-defaults', 1), 'either form of the format name');
  assert.ok(existsSync(resolve(root, contract.checked_by)));
  for (const entry of [...contract.derived, ...contract.pending]) {
    assert.ok(existsSync(resolve(root, `src/smart/${entry.component}/index.js`)), entry.component);
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 25, `${entry.component}.${entry.prop}: a reason`);
  }
  for (const entry of contract.pending) assert.ok(entry.owner, `${entry.component}.${entry.prop}: an owner`);
  const dropdown = JSON.parse(read('src/smart/dropdown/smart.manifest.json')).inputs.properties;
  assert.equal(dropdown.appearance.default, 'outlined', 'the dropdown draws outlined when nothing is asked');
});

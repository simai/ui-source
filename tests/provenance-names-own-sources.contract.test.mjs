import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// A manifest's provenance.source_artifacts is authored by hand: the provenance
// refresh only re-hashes the paths already listed, it never discovers them. So a
// manifest created by copying another one keeps the other component's files and
// the refresh happily re-hashes them for ever. sf-property-view shipped one pair
// claiming it was built from src/smart/data-view/index.js, and every check passed,
// because every hash was correct -- of the wrong files.
//
// A component must name its own sources. It may also name a file outside its
// directory, which is honest when it genuinely builds from one -- sf-table names
// src/smart/pagination/index.js -- so the rule is that its own directory must be
// named at least once and nothing may be claimed that does not exist.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const manifests = () => readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({directory: entry.name, path: `src/smart/${entry.name}/smart.manifest.json`}))
  .filter(({path}) => existsSync(resolve(root, path)))
  .map((entry) => ({...entry, manifest: JSON.parse(read(entry.path))}));

test('every manifest names its own sources, and only files that exist', () => {
  const wrong = [];
  const missing = [];
  let checked = 0;

  for (const {directory, manifest} of manifests()) {
    const artifacts = manifest.provenance?.source_artifacts ?? [];
    if (!artifacts.length) continue;
    checked += 1;
    const own = `src/smart/${directory}/`;
    if (!artifacts.some((artifact) => String(artifact.path).startsWith(own))) {
      wrong.push(`${manifest.id}: names no file under ${own} — it lists ${artifacts[0]?.path}`);
    }
    for (const artifact of artifacts) {
      if (!existsSync(resolve(root, artifact.path))) {
        missing.push(`${manifest.id}: claims ${artifact.path}, which does not exist`);
      }
    }
  }

  assert.deepEqual(wrong, [], 'a manifest that names another component as its source is a copied manifest');
  assert.deepEqual(missing, [], 'a provenance entry for a file that is gone is a claim nobody can check');
  // A guard that silently checks nothing is worse than no guard.
  assert.ok(checked >= 40, `only ${checked} manifests declared source artifacts`);
});

// A second rule was written here and withdrawn: that a component naming any
// source must name its template, stylesheet and rule too. Forty-odd components
// name only their index.js, so the rule would have failed almost the whole
// Framework -- and that is a convention about how much provenance records, not a
// defect. The list's breadth is the author's; that it describes the right
// component is not.

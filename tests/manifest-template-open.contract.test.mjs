import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// Any template name other than `default` loads from the external template
// base (<base>/<component>/<name>/index.js). The Studio generator wrote the
// shipped names into the `template` input as an enum, so 28 manifests -- and
// the catalogue pages built from them -- called a working page invalid. The
// shipped names stay in `templates`; the input stays open.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const smart = resolve(root, 'src/smart');

test('no manifest limits the template input to the shipped templates', () => {
  const limited = readdirSync(smart)
    .map((name) => [name, resolve(smart, name, 'smart.manifest.json')])
    .filter(([, file]) => existsSync(file))
    .filter(([, file]) => JSON.parse(readFileSync(file, 'utf8')).inputs?.properties?.template?.enum)
    .map(([name]) => name);
  assert.deepEqual(limited, []);
});

test('the generator leaves the template input open', () => {
  const source = readFileSync(resolve(root, 'scripts/generate-smart-studio-artifacts.mjs'), 'utf8');
  assert.doesNotMatch(source, /template\.enum\s*=/u);
  assert.match(source, /delete manifest\.inputs\.properties\.template\.enum/u);
});

// `x-words` in a component.json names the word settings of the part -- the
// strings a translator sets -- that the name rule of standard
// simai.smart-component 1.3.8 §15.1 does not already catch: the rule takes a
// string setting whose name is, or ends in, text, label, title, placeholder or
// hint, and anything else a part wants counted as words it declares by name.
//
// The list was written by the 1.3.8 migration from the manifests as they stood
// then, so a setting renamed afterwards leaves its old name behind in it. Two
// did: sf-alert kept `text`, a setting the stand proposed and the component
// never gained, and sf-input kept `right-text`, which became `text-end`. The
// catalogue that reads them (ui-control control/smart-architecture/standard/
// build-parts-catalogue.mjs) drops a name it cannot find and reports it, so the
// word quietly left the part's word list while its name sat in the file.
//
// A declared name therefore has to be a string setting of the same file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smart = path.join(root, 'src', 'smart');

const components = () => fs.readdirSync(smart, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(smart, entry.name, 'component.json')))
  .map((entry) => entry.name)
  .sort();

test('every x-words name is a string setting of its component', () => {
  const stale = [];
  let declared = 0;
  let files = 0;
  for (const folder of components()) {
    const file = path.join(smart, folder, 'component.json');
    const component = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = component['x-words'];
    if (!Array.isArray(names)) continue;
    files += 1;
    for (const name of names) {
      declared += 1;
      const setting = component.settings?.[name];
      const type = setting && typeof setting === 'object' ? setting.type : undefined;
      if (type === 'string') continue;
      stale.push(`${component.tag ?? folder} x-words lists ${JSON.stringify(name)}, which is no string setting of the file`);
    }
  }

  assert.ok(files > 20, `expected the parts that declare words, read ${files}`);
  assert.ok(declared > 50, `expected the declared word names of the kit, read ${declared}`);
  assert.deepEqual(stale, []);
});

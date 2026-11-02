import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const directory = join(root, 'src/core/contracts/packages');

/* A component package a free entry still names is referenced here and shipped
   in the runtime as distr/core/contracts/packages/, so a consumer that holds
   only the distribution can tell which elements need the package. The
   reference carries no bytes; its components must not be in the free source.
   The only one is pro's (the SIMAI Framework Pro components, simai/ui-pro),
   kept while the free recipe recipe.admin.collection still places its data
   view. Its former name larena (2026-10-11 to 2026-11-02) is a dated alias
   (journal option-package-larena-to-pro): larena.package.json names the same
   components, so a package built under either name agrees with the release,
   and it leaves with the alias. */
test('every package reference names components the free Framework does not ship', () => {
  const files = readdirSync(directory).filter((name) => name.endsWith('.package.json'));
  assert.ok(files.includes('pro.package.json'), 'pro is named while the free recipe places its data view');
  for (const name of files) {
    const reference = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    assert.equal(reference.schema_id, 'simai.framework.package-reference');
    assert.equal(`${reference.package}.package.json`, name);
    for (const entry of reference.provides) {
      assert.ok(!existsSync(join(root, 'src/smart', entry.folder)), `${entry.element} is not in the free source`);
      assert.doesNotMatch(readFileSync(join(root, 'src/core/js/rule.src.js'), 'utf8'),
        new RegExp(`smart/${entry.folder}/rule\\.js`), `${entry.rule_name} is not a Core rule`);
      // The ui registry builder refuses a requires list that is not sorted and
      // unique (package_reference_requires_invalid); a rename can reorder it.
      assert.deepEqual(entry.requires, [...new Set(entry.requires)].sort(), `${entry.id}: requires sorted and unique`);
    }
  }
});

test('larena.package.json is a dated alias of pro.package.json, entry for entry', () => {
  const read = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
  const pro = read('pro.package.json');
  const larena = read('larena.package.json');
  assert.equal(pro.alias_of, undefined, 'pro is the current name');
  assert.equal(larena.alias_of, 'pro');
  assert.deepEqual(larena.provides, pro.provides, 'the alias names the same components');
  const journal = JSON.parse(readFileSync(join(root, 'contracts/changes/journal.json'), 'utf8'));
  const record = journal.records.find((one) => one.id === 'option-package-larena-to-pro');
  assert.equal(larena.remove_after, record?.remove_after, 'the file leaves with the alias');
});

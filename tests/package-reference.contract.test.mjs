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
   Since SIMAI Framework Pro was dropped the only one is larena's, kept while
   the free recipe recipe.admin.collection still places its data view; both
   leave once Larena reads them from its own folder, and no reference for a
   package nobody publishes may stay behind. */
test('every package reference names components the free Framework does not ship', () => {
  const files = readdirSync(directory).filter((name) => name.endsWith('.package.json'));
  assert.ok(!files.includes('pro.package.json'), 'package pro is no longer published');
  assert.ok(files.includes('larena.package.json'), 'larena is named while the free recipe places its data view');
  for (const name of files) {
    const reference = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    assert.equal(reference.schema_id, 'simai.framework.package-reference');
    assert.equal(`${reference.package}.package.json`, name);
    for (const entry of reference.provides) {
      assert.ok(!existsSync(join(root, 'src/smart', entry.folder)), `${entry.element} is not in the free source`);
      assert.doesNotMatch(readFileSync(join(root, 'src/core/js/rule.src.js'), 'utf8'),
        new RegExp(`smart/${entry.folder}/rule\\.js`), `${entry.rule_name} is not a Core rule`);
    }
  }
});

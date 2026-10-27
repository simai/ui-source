import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// A component's smart.manifest.json is what a shared allowed-values check
// reads (core/js/composition validate, a product's own gate); its
// component.json is what the element takes. sf-tree 2.0.0 took the standard's
// selection words, none | one | many (§18.2), while its manifest still listed
// none | single | multiple, so the check refused "one", the word the element
// documents, and ui-pro passed the old word to get through it. Every value a
// component.json setting takes is in the manifest's enum; a manifest value the
// component does not take is a former value of that setting in aliases.json.

const root = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const components = readdirSync(resolve(root, 'src/smart'))
  .filter((name) => existsSync(resolve(root, 'src/smart', name, 'component.json')) && existsSync(resolve(root, 'src/smart', name, 'smart.manifest.json')));

test('every enum setting of a component.json is the manifest enum, former values aside', () => {
  const problems = [];
  for (const name of components) {
    const component = json(`src/smart/${name}/component.json`);
    const manifest = json(`src/smart/${name}/smart.manifest.json`);
    const aliasesPath = `src/smart/${name}/aliases.json`;
    const aliases = existsSync(resolve(root, aliasesPath)) ? json(aliasesPath).aliases ?? [] : [];
    const properties = manifest.inputs?.properties ?? {};
    for (const [setting, spec] of Object.entries(component.settings ?? {})) {
      if (spec?.type !== 'enum' || !Array.isArray(properties[setting]?.enum)) continue;
      const listed = properties[setting].enum;
      const former = new Set(aliases.filter((row) => row.kind === 'value' && row.setting === setting).map((row) => row.from));
      for (const value of spec.values) {
        if (!listed.includes(value)) problems.push(`${name}.${setting}: the manifest refuses ${JSON.stringify(value)}`);
      }
      for (const value of listed) {
        if (!spec.values.includes(value) && !former.has(value)) problems.push(`${name}.${setting}: the manifest lists ${JSON.stringify(value)}, neither a value nor a former value`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('sf-tree: selection none | one | many, single and multiple declared as dated former values', () => {
  const manifest = json('src/smart/tree/smart.manifest.json');
  const component = json('src/smart/tree/component.json');
  assert.deepEqual(manifest.inputs.properties.selection.enum, ['none', 'one', 'many']);
  assert.deepEqual(component.settings.selection.values, ['none', 'one', 'many']);
  assert.equal(manifest.version, component.version);
  assert.deepEqual(manifest.compatibility.aliases, ['selection=single', 'selection=multiple']);
  assert.deepEqual(manifest.compatibility.deprecations, [
    {path: 'selection=single', since: '2.0.0', replacement: 'selection=one'},
    {path: 'selection=multiple', since: '2.0.0', replacement: 'selection=many'},
  ]);
  const rows = json('src/smart/tree/aliases.json').aliases.filter((row) => row.kind === 'value' && row.setting === 'selection');
  assert.deepEqual(rows.map(({from, to, remove_after: removeAfter}) => [from, to, removeAfter]), [['single', 'one', '2026-12-01'], ['multiple', 'many', '2026-12-01']]);
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'value-tree-selection-single-multiple-to-one-many');
  assert.ok(record, 'the change journal records the value aliases');
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), [['single', 'one'], ['multiple', 'many']]);
  assert.equal(record.remove_after, '2026-12-01');
});

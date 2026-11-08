import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

/* A loader rule may declare relations: groups to load along with it. A relation
   that names a group which no longer exists does not fail anywhere at build
   time. It fails in the reader's browser: the loader asks for a stylesheet that
   is not there, the request comes back 404 and the console prints a warning on
   every page that uses the class. gradient-type pointed at gradient-color-ext
   for two and a half years after that group was deleted. */
const SRC = new URL('../src/', import.meta.url);

/* In a component set's overlay (ui-view package/scripts/test.mjs runs this file
   with SET_ROOT, the set's package folder) a relation may also name a rule of a
   set the passport requires (requires_sets): a page declares that set itself
   (data-sf-sets), so its rules are there when the relation is read. Those rules
   are the names the shared registry gives the required set's owner,
   cl-<element without sf->. Without SET_ROOT, or with no required set, only the
   rules of this tree count. */
export function requiredSetRules(setRoot = process.env.SET_ROOT, registryFile = new URL('../contracts/registry/names.json', import.meta.url)) {
  if (!setRoot || !existsSync(join(setRoot, 'set.json'))) return new Set();
  const required = new Set((JSON.parse(readFileSync(join(setRoot, 'set.json'), 'utf8')).requires_sets ?? []).map(({id}) => id));
  if (!required.size) return new Set();
  const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
  return new Set(registry.owners
    .filter((owner) => owner.kind === 'set' && required.has(owner.id))
    .flatMap((owner) => owner.names.map(({element}) => `cl-${element.slice(3)}`)));
}

async function rules(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) out.push(...await rules(next, base));
    else if (entry.name === 'rule.js') out.push(next);
  }
  return out;
}

test('loader: every related group a rule names exists as a rule, here or in a required set', async () => {
  const files = await rules(SRC);
  const declared = new Set();
  const sources = [];
  for (const url of files) {
    const source = await readFile(url, 'utf8');
    sources.push([url, source]);
    // Две записи: SF.RuleLoader['name'] и SF.RuleLoader.name.
    for (const match of source.matchAll(/SF\.RuleLoader(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z_$][\w$]*))\s*=/g)) declared.add(match[1] || match[2]);
  }
  const fromRequiredSets = requiredSetRules();
  const dangling = [];
  for (const [url, source] of sources) {
    for (const block of source.matchAll(/relation:\s*\[([^\]]*)\]/g)) {
      for (const name of block[1].matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
        if (!declared.has(name[1]) && !fromRequiredSets.has(name[1])) dangling.push(`${url.pathname.slice(url.pathname.indexOf('/src/') + 5)} -> ${name[1]}`);
      }
    }
  }
  assert.ok(declared.size > 100, `правил найдено подозрительно мало: ${declared.size}`);
  assert.deepEqual(dangling, []);
});

test('loader: a relation to a rule of a required set counts only for a set that requires it', async () => {
  const {mkdtempSync, writeFileSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const scratch = mkdtempSync(join(tmpdir(), 'loader-relations-'));
  try {
    const registry = join(scratch, 'names.json');
    writeFileSync(registry, JSON.stringify({owners: [
      {id: 'framework', kind: 'framework', names: [{element: 'sf-list'}]},
      {id: 'view', kind: 'set', names: [{element: 'sf-view-properties'}, {element: 'sf-view-table'}]},
      {id: 'mail', kind: 'set', names: [{element: 'sf-mail-canvas'}]},
    ]}));
    assert.deepEqual([...requiredSetRules('', registry)], [], 'no SET_ROOT: the tree alone');
    assert.deepEqual([...requiredSetRules(scratch, registry)], [], 'no set.json: the tree alone');
    writeFileSync(join(scratch, 'set.json'), JSON.stringify({id: 'chat', requires_sets: []}));
    assert.deepEqual([...requiredSetRules(scratch, registry)], [], 'no required set');
    writeFileSync(join(scratch, 'set.json'), JSON.stringify({id: 'chat', requires_sets: [{id: 'view', range: '>=1.3.0 <2.0.0'}]}));
    assert.deepEqual([...requiredSetRules(scratch, registry)].sort(), ['cl-view-properties', 'cl-view-table'], 'the required set\'s names, not the Framework\'s or another set\'s');
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});

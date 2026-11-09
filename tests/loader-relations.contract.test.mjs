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

/* A set may also declare a shared core (package.json simai.core {folder, abi}):
   a helper folder with no rule.js of its own. ui-builder writes the core's rule,
   cl-<folder> (libs/packageCore.js coreRuleName), a rule with a script and no
   tags, and every component that imports the core relates to it. That rule is
   in the set's rule file at run time, so a relation to it is not dangling. Only
   the core the set declares counts: a relation to another name stays dangling. */
export function setCoreRules(setRoot = process.env.SET_ROOT) {
  if (!setRoot || !existsSync(join(setRoot, 'package.json'))) return new Set();
  const core = JSON.parse(readFileSync(join(setRoot, 'package.json'), 'utf8')).simai?.core;
  if (!core) return new Set();
  assert.ok(typeof core.folder === 'string' && /^[a-z][a-z0-9-]*$/.test(core.folder), `simai.core.folder is not a folder name: ${core.folder}`);
  return new Set([`cl-${core.folder}`]);
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

/* The relations of the rule.js files under src that name no rule: none of this
   tree, none of the set core and none of a required set. */
export async function danglingRelations(src = SRC, setRoot = process.env.SET_ROOT, registryFile = undefined) {
  const files = await rules(src);
  const declared = new Set();
  const sources = [];
  for (const url of files) {
    const source = await readFile(url, 'utf8');
    sources.push([url, source]);
    // Две записи: SF.RuleLoader['name'] и SF.RuleLoader.name.
    for (const match of source.matchAll(/SF\.RuleLoader(?:\[['"]([^'"]+)['"]\]|\.([A-Za-z_$][\w$]*))\s*=/g)) declared.add(match[1] || match[2]);
  }
  const fromRequiredSets = requiredSetRules(setRoot, registryFile);
  const fromSetCore = setCoreRules(setRoot);
  const dangling = [];
  for (const [url, source] of sources) {
    for (const block of source.matchAll(/relation:\s*\[([^\]]*)\]/g)) {
      for (const name of block[1].matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
        if (!declared.has(name[1]) && !fromRequiredSets.has(name[1]) && !fromSetCore.has(name[1])) dangling.push(`${url.pathname.slice(url.pathname.indexOf('/src/') + 5)} -> ${name[1]}`);
      }
    }
  }
  return {declared, dangling};
}

test('loader: every related group a rule names exists as a rule, here, in the set core or in a required set', async () => {
  const {declared, dangling} = await danglingRelations();
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

test('loader: a relation to the set core counts only for the core the set declares', async () => {
  const {mkdtempSync, writeFileSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const scratch = mkdtempSync(join(tmpdir(), 'loader-relations-core-'));
  try {
    assert.deepEqual([...setCoreRules('')], [], 'no SET_ROOT: the tree alone');
    assert.deepEqual([...setCoreRules(scratch)], [], 'no package.json: the tree alone');
    writeFileSync(join(scratch, 'package.json'), JSON.stringify({name: 'chart', simai: {base: 'dist/smart'}}));
    assert.deepEqual([...setCoreRules(scratch)], [], 'no simai.core: no core rule');
    writeFileSync(join(scratch, 'package.json'), JSON.stringify({name: 'chart', simai: {core: {folder: 'chart-core', abi: 1}}}));
    const core = setCoreRules(scratch);
    assert.deepEqual([...core], ['cl-chart-core'], 'the name ui-builder writes: cl-<folder>');
    assert.ok(!core.has('cl-other-core'), 'a relation to an undeclared core stays dangling');
    assert.ok(!core.has('cl-chart'), 'only the core rule, not a component rule');
    // The whole check over a set tree: a component relates to the core it declares.
    const {mkdirSync} = await import('node:fs');
    const {pathToFileURL} = await import('node:url');
    const src = join(scratch, 'src');
    mkdirSync(join(src, 'smart', 'chart-line'), {recursive: true});
    writeFileSync(join(src, 'smart', 'chart-line', 'rule.js'), "SF.RuleLoader['cl-chart-line'] = {tags: ['sf-chart-line'], relation: [{name: 'cl-chart-core'}]};\n");
    const srcUrl = pathToFileURL(src + '/');
    assert.deepEqual((await danglingRelations(srcUrl, scratch)).dangling, [], 'the declared core: not dangling');
    assert.deepEqual((await danglingRelations(srcUrl, '')).dangling, ['smart/chart-line/rule.js -> cl-chart-core'], 'no SET_ROOT: the core is not there');
    writeFileSync(join(scratch, 'package.json'), JSON.stringify({name: 'chart', simai: {core: {folder: 'other-core', abi: 1}}}));
    assert.deepEqual((await danglingRelations(srcUrl, scratch)).dangling, ['smart/chart-line/rule.js -> cl-chart-core'], 'a relation to an undeclared core: still dangling');
    writeFileSync(join(scratch, 'package.json'), JSON.stringify({name: 'chart', simai: {core: {folder: '../x', abi: 1}}}));
    assert.throws(() => setCoreRules(scratch), /not a folder name/);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});

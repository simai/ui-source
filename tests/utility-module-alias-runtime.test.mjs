import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const code = fs.readFileSync(new URL('../src/core/js/utilityModuleAliases.js', import.meta.url), 'utf8');
const {resolveUtilityModule} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const contract = JSON.parse(fs.readFileSync(new URL('../src/core/contracts/utility-module-aliases.v1.json', import.meta.url)));
const rules = Object.fromEntries([...Object.keys(contract.aliases), ...Object.values(contract.aliases)].map(name => [name, /gap-/]));
test('only verified exact legacy module identifiers resolve to the same-condition canonical owner', () => {
  for (const [from, to] of Object.entries(contract.aliases)) {
    assert.equal(resolveUtilityModule(from, contract.aliases, rules), to);
    assert.equal(resolveUtilityModule(to, contract.aliases, rules), to);
    assert.equal(resolveUtilityModule(`x-${from}`, contract.aliases, rules), `x-${from}`);
    assert.equal(resolveUtilityModule(from, contract.aliases, rules, true), from);
  }
});
test('missing rules, cycles, mismatched conditions and component targets preserve legacy routing', () => {
  const from = 'column-gap/default';
  assert.equal(resolveUtilityModule(from, contract.aliases, {}), from);
  assert.equal(resolveUtilityModule(from, contract.aliases, {...rules, 'gap/default': {type: 'component'}}), from);
  assert.equal(resolveUtilityModule(from, {[from]: 'gap/md'}, rules), from);
  assert.equal(resolveUtilityModule(from, {...contract.aliases, 'gap/default': from}, rules), from);
  assert.equal(resolveUtilityModule(from, {[from]: '../gap/default'}, rules), from);
});
test('setExistCookie records only canonical module during discovery, but preserves pinned plans', () => {
  const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
  const begin = source.indexOf('SFLoaderPlugin.prototype.setExistCookie =');
  const end = source.indexOf('SFLoaderPlugin.prototype.setRelation =', begin);
  function SFLoaderPlugin() {this.findPlugins = rules; this.recorded = [];}
  SFLoaderPlugin.prototype.setModule = function(name) {this.recorded.push(name);};
  SFLoaderPlugin.prototype.getPluginName = name => name;
  // Utility rules belong to no package; the package check is loader-packages.contract.test.mjs's.
  SFLoaderPlugin.prototype.isPluginResolvable = () => true;
  vm.runInNewContext(source.slice(begin, end), {SFLoaderPlugin, resolveUtilityModule, utilityModuleAliases: contract});
  const loader = new SFLoaderPlugin();
  loader.setExistCookie('column-gap/default');
  assert.deepEqual(loader.recorded, ['gap/default']);
  loader.productionPlanActive = true;
  loader.setExistCookie('column-gap/default');
  assert.deepEqual(loader.recorded, ['gap/default', 'column-gap/default']);
});

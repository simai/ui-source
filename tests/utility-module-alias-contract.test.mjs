import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {validateAliasGraph, verifyAliasModules} from '../scripts/utility-module-alias-contract.mjs';
const contract = JSON.parse(fs.readFileSync(new URL('../src/core/contracts/utility-module-aliases.v1.json', import.meta.url)));
const simple = {version: 1, aliases: {'column-gap/default': 'gap/default'}};
const record = {selector: '.col-gap-1', classes: ['col-gap-1'], conditions: [['layer', 'sf.utilities']], declarations: [['column-gap', 'var(--sf-space-1)', false]]};
function fixture() {
  return new Map([
    ['column-gap/default', {records: [structuredClone(record)], dependencies: [], sideEffects: false}],
    ['gap/default', {records: [{...record, selector: '.gap-1', classes: ['gap-1']}, structuredClone(record)], dependencies: [], sideEffects: false}],
  ]);
}
test('alias profile retains every responsive CSS URL and forbids cycles or condition changes', () => {
  assert.equal(Object.keys(validateAliasGraph(contract)).length, 6);
  for (const aliases of [
    {'a/default': 'a/default'}, {'a/default': 'b/default', 'b/default': 'a/default'},
    {'a/default': 'b/md'}, {'../a/default': 'b/default'}, {'a/default': 1},
  ]) assert.throws(() => validateAliasGraph({version: 1, aliases}));
});
test('equivalent grouped selectors may use a larger canonical CSS module', () => {
  assert.equal(verifyAliasModules(simple, fixture())[0].selectors, 1);
});
test('declarations, conditions, layer, importance, ordering and dependencies must remain equivalent', () => {
  for (const mutate of [
    module => {module.records[1].declarations[0][1] = 'var(--sf-space-2)';},
    module => {module.records[1].declarations[0][2] = true;},
    module => {module.records[1].conditions.push(['media', '(min-width:1rem)']);},
    module => {module.records[1].conditions[0][1] = 'sf.components';},
    module => {module.records.push(structuredClone(record));},
    module => {module.records.push({...structuredClone(record), selector: 'div.col-gap-1'});},
    module => {module.dependencies.push({name: 'other/default'});},
    module => {module.sideEffects = true;},
    module => {module.records = [];},
  ]) {
    const modules = fixture(); mutate(modules.get('gap/default'));
    assert.throws(() => verifyAliasModules(simple, modules));
  }
  assert.throws(() => verifyAliasModules(simple, new Map()));
});

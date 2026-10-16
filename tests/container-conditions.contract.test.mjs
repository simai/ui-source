import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {profile, projections} from '../scripts/generate-container-conditions.mjs';

test('container profile projections are fresh and deterministic', () => {
  for (const [name, expected] of projections()) assert.equal(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'), expected, name);
  assert.deepEqual(projections(), projections());
});

test('query rules accept finite named/unnamed conditions and reject extensions', () => {
  const context = {SF: {RuleLoader: {}}};
  for (const [name, source] of projections()) if (name.endsWith('rule.js')) vm.runInNewContext(source, context);
  const query = context.SF.RuleLoader['query-layout/default'];
  const container = context.SF.RuleLoader['query-container/default'];
  for (const name of ['query-container', 'query-container/sidebar']) assert.equal(container.test(name), true);
  for (const name of ['query-container/other', 'query-container-invalid', 'x-query-container']) assert.equal(container.test(name), false);
  for (const condition of ['sm', 'md', 'lg', 'xl']) for (const name of ['', '/sidebar'])
    for (const utility of ['flex-row', 'gap-1/2', 'grid-col-subgrid', 'content-main-center', 'items-cross-start'])
      assert.equal(query.test(`cq-${condition}${name}:${utility}`), true);
  for (const name of ['cq-sm/other:flex-row', 'cq-xs:flex-row', 'cq-sm:hover:flex-row', 'hover:cq-sm:flex-row', 'cq-sm:gap-999', 'cq-sm:flex-row-invalid', 'xcq-sm:flex-row', 'cq-sm:flex-row\n'])
    assert.equal(query.test(name), false, name);
});

test('invalid or reordered profile inputs fail closed', () => {
  for (const patch of [{names: ['none']}, {names: ['sidebar', 'sidebar']}, {names: ['bad/name']}, {breakpoints: ['md', 'sm']}, {version: 2}])
    assert.throws(() => projections({...profile, ...patch}));
  const empty = projections({...profile, names: []});
  assert.ok(empty.get('src/utility/query-container/default/scss/_sf_profile.scss').includes('$query-names: ();'));
});

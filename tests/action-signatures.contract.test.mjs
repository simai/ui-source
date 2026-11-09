// The generated reference names an action's method as the element takes it
// (standard §4.4: the `with` parameters arrive as one object). One argument,
// args, whose schema is the `with` fields; x-registry.action-calls says where
// the element's own code also takes the value alone ("object|<type>") or takes
// the fields in declared order and not the object ("positional").
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

import {argumentsOf} from '../scripts/generate-component-files.mjs';

const root = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const camel = (name) => name.replace(/-([a-z])/gu, (_, c) => c.toUpperCase());
const folders = readdirSync(resolve(root, 'src/smart')).filter((folder) => existsSync(resolve(root, `src/smart/${folder}/component.json`)));

test('every action with parameters is one args object in the manifest, unless the element takes the fields in order', () => {
  let objects = 0;
  let positional = 0;
  for (const folder of folders) {
    const component = json(`src/smart/${folder}/component.json`);
    const calls = component['x-registry']?.['action-calls'] ?? {};
    const manifest = json(`src/smart/${folder}/smart.manifest.json`);
    for (const [name, spec] of Object.entries(component.actions ?? {})) {
      const fields = Object.keys(spec?.with ?? {});
      const method = manifest.methods[camel(name)];
      if (!fields.length) { assert.deepEqual(method.arguments, [], `${folder}.${name}`); continue; }
      if (calls[name] === 'positional') {
        positional++;
        assert.deepEqual(method.arguments.map((one) => one.name), fields.map(camel), `${folder}.${name}`);
        continue;
      }
      objects++;
      assert.equal(method.arguments.length, 1, `${folder}.${name}`);
      const [args] = method.arguments;
      assert.equal(args.name, 'args');
      assert.equal(args.type, calls[name] ?? 'object', `${folder}.${name}`);
      assert.deepEqual(Object.keys(args.schema.properties), fields.map(camel), `${folder}.${name}`);
    }
  }
  assert.ok(objects >= 60 && positional >= 15, `${objects} object, ${positional} positional`);
});

test('the forms read off the elements', () => {
  const methods = (folder) => json(`src/smart/${folder}/smart.manifest.json`).methods;
  assert.equal(methods('progress-run').chunk.arguments[0].type, 'object|string');
  assert.deepEqual(methods('progress-run').chunk.arguments[0].schema, {type: 'object', properties: {text: {type: 'string'}}, required: ['text']});
  assert.equal(methods('progress-run').step.arguments[0].type, 'object');
  assert.equal(methods('progress-bar').chunk.arguments[0].type, 'object');
  assert.equal(methods('accordion').open.arguments[0].type, 'object|string');
  assert.equal(methods('confirm').answer.arguments[0].type, 'object');
  assert.equal(methods('gallery').open.arguments[0].required, false);
  assert.deepEqual(methods('tabs').setData.arguments.map((one) => one.name), ['data', 'reason']);
  assert.deepEqual(methods('menu-context').openFor.arguments.map((one) => one.name), ['anchor', 'options']);
  assert.equal(methods('editor-overlay').setNodes.arguments.length, 2);
});

test('an action-calls entry is one of the two forms and names an action with parameters', () => {
  const component = {tag: 'sf-x', actions: {go: {with: {to: 'string'}}}, 'x-registry': {'action-calls': {go: 'string'}}};
  assert.throws(() => argumentsOf(component, 'go', component.actions.go), /positional/u);
  assert.deepEqual(argumentsOf({tag: 'sf-x'}, 'go', {with: {to: {type: 'string', optional: true}}}),
    [{name: 'args', type: 'object', required: false, schema: {type: 'object', properties: {to: {type: 'string'}}}}]);
});

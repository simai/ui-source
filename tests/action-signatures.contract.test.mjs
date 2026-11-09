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
  // Since core.runtime 1.43.0 the runtime gives a class-written method that
  // takes its fields in order the object form too (elementFromManifest's
  // positional): no element is positional only (action-call defects, 2026-11-09).
  assert.ok(objects >= 80 && positional === 0, `${objects} object, ${positional} positional`);
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
  assert.deepEqual(Object.keys(methods('tabs').setData.arguments[0].schema.properties), ['data', 'reason']);
  assert.deepEqual(methods('tabs').setData.arguments[0].schema.required, ['data']);
  assert.deepEqual(Object.keys(methods('menu-context').openFor.arguments[0].schema.properties), ['anchor', 'options']);
  assert.equal(methods('menu-context').openFor.returns.type, 'Promise<object>');
  assert.equal(methods('editor-overlay').setNodes.arguments.length, 1);
  // The fields the elements read as optional (2026-11-09): close() and show() take no argument.
  for (const folder of ['drawer', 'modal', 'popover']) assert.equal(methods(folder).close.arguments[0].required, false, folder);
  assert.equal(methods('toast').show.arguments[0].required, false);
  assert.equal(methods('toast').show.arguments[0].schema.required, undefined);
});

test('an action-calls entry is one of the two forms and names an action with parameters', () => {
  const component = {tag: 'sf-x', actions: {go: {with: {to: 'string'}}}, 'x-registry': {'action-calls': {go: 'string'}}};
  assert.throws(() => argumentsOf(component, 'go', component.actions.go), /positional/u);
  assert.deepEqual(argumentsOf({tag: 'sf-x'}, 'go', {with: {to: {type: 'string', optional: true}}}),
    [{name: 'args', type: 'object', required: false, schema: {type: 'object', properties: {to: {type: 'string'}}}}]);
});

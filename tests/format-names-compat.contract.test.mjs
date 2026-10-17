import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {checkEffectManifest} from '../src/core/js/effects.js';
import {checkFragmentDescriptor} from '../src/core/js/composition/fragments.mjs';
import {createPortRegistry} from '../src/core/js/composition/routing.mjs';
import {BUILTIN_EDITOR_MANIFESTS, createRegistry, resolveRecipe, validate, validateEditorManifest} from '../src/core/js/composition/index.mjs';
import {BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS} from '../src/core/js/composition/builtins.mjs';

// Names carry no version (owner, 2026-10-11; journal record
// format-names-without-version). Through the compatibility window every reader
// takes a format in both forms: the older label `simai.<name>.v1`, and
// `simai.<name>` with `schema_version: 1` beside it. The new form without a
// schema_version, or with another major, is refused.
const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const unversioned = (document, name) => {
  const {schema, ...rest} = clone(document);
  return {schema: name, schema_version: 1, ...rest};
};
const forms = (document, name) => ({
  old: clone(document),
  current: unversioned(document, name),
  missing: (({schema_version, ...rest}) => rest)(unversioned(document, name)),
  other: {...unversioned(document, name), schema_version: 2},
  disagreeing: {...clone(document), schema_version: 2},
});

test('an effect manifest is read in both forms', () => {
  const read = forms(json('tests/fixtures/effect-sample/effect.json'), 'simai.effect');
  assert.deepEqual(checkEffectManifest(read.old), []);
  assert.deepEqual(checkEffectManifest(read.current), []);
  for (const refused of [read.missing, read.other, read.disagreeing]) assert.match(checkEffectManifest(refused).join(), /schema/u);
});

test('a fragment descriptor is read in both forms', () => {
  const descriptor = {
    schema: 'simai.interface-fragment.v1', id: 'larena.file-manager', element: 'sf-file-manager', regions: ['content'],
    port: {standard: 'simai.composite-host-port', version: '1.0.3'},
    outputs: {moved: {value: 'files-moved.v1', summary: 'Files the person moved.'}},
    inputs: {changed: {value: 'collection-changed.v1', summary: 'Read the folder again.'}},
    operation: 'files.read', url_state: ['folder'], budget: {kb: 40, first_answer_ms: 300},
  };
  const read = forms(descriptor, 'simai.interface-fragment');
  assert.deepEqual(checkFragmentDescriptor(read.old), []);
  assert.deepEqual(checkFragmentDescriptor(read.current), []);
  for (const refused of [read.missing, read.other, read.disagreeing]) assert.match(checkFragmentDescriptor(refused).join(), /schema/u);
});

test('a type manifest and a port manifest register in both forms', () => {
  const type = forms(BUILTIN_TYPE_MANIFESTS[0], 'simai.composition.type-manifest');
  assert.ok(createRegistry([type.old]).types.has(BUILTIN_TYPE_MANIFESTS[0].type));
  assert.ok(createRegistry([type.current]).types.has(BUILTIN_TYPE_MANIFESTS[0].type));
  for (const refused of [type.missing, type.other, type.disagreeing]) assert.throws(() => createRegistry([refused]), /composition_manifest_invalid/u);

  const port = forms(BUILTIN_PORT_MANIFESTS[0], 'simai.composition.port-manifest');
  assert.doesNotThrow(() => createPortRegistry([port.old]));
  assert.doesNotThrow(() => createPortRegistry([port.current]));
  for (const refused of [port.missing, port.other, port.disagreeing]) assert.throws(() => createPortRegistry([refused]), /composition_port_manifest_invalid/u);
});

test('a Composition document is read in both forms', () => {
  const document = {schema: 'simai.composition.document.v1', id: 'p', profile: 'ui-layout', root: {id: 'p', type: 'content.paragraph', data: {content: [{type: 'text', value: 'Текст'}]}}};
  const read = forms(document, 'simai.composition.document');
  assert.deepEqual(validate(read.old), {valid: true, diagnostics: []});
  assert.deepEqual(validate(read.current), {valid: true, diagnostics: []});
  for (const refused of [read.missing, read.other, read.disagreeing]) {
    assert.ok(validate(refused).diagnostics.some(({code}) => code === 'schema_unknown'), JSON.stringify(refused.schema_version));
  }
});

test('an editor manifest is read in both forms', () => {
  const editor = BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === 'layout.section');
  const type = BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === 'layout.section');
  const options = {propertyTypes: [{type: 'string', version: 2}, {type: 'integer', version: 1}]};
  const read = forms(editor, 'simai.composition.editor-manifest');
  assert.equal(validateEditorManifest(read.old, type, options).valid, true);
  assert.deepEqual(validateEditorManifest(read.current, type, options).diagnostics, []);
  for (const refused of [read.missing, read.other, read.disagreeing]) {
    assert.ok(validateEditorManifest(refused, type, options).diagnostics.some(({code}) => code === 'editor_schema_unknown'));
  }
});

test('a recipe, its inputs and a template manifest are read in both forms', async () => {
  const recipe = {
    schema: 'simai.composition.recipe.v1', id: 'demo.follow', profile: 'ui-layout',
    root: {id: 'page', ref: {kind: 'template', owner: 'example/library', ref: 'page', policy: 'follow-published', pointer: 'published'}},
  };
  const source = {
    schema: 'simai.composition.recipe-manifest.v1', id: 'page',
    body: {id: 'shell', node: {type: 'layout.page', slots: {default: [{id: 'heading', node: {type: 'content.heading', data: {level: {literal: 1}, content: {literal: [{type: 'text', value: 'Заголовок'}]}}}}]}}},
  };
  const inputs = {schema: 'simai.composition.inputs.v1', scope: 'site-1', values: {}};
  const resolve = (recipeForm, sourceForm, inputsForm) => resolveRecipe(recipeForm, {
    trustedContext: {scope: 'site-1'},
    inputs: inputsForm,
    executionContract: {contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer'},
    ports: {readReference: async () => ({source: sourceForm, revision: 'r2', generation: 'g7'})},
  });
  const recipes = forms(recipe, 'simai.composition.recipe');
  const sources = forms(source, 'simai.composition.recipe-manifest');
  const envelopes = forms(inputs, 'simai.composition.inputs');

  const old = await resolve(recipes.old, sources.old, envelopes.old);
  assert.deepEqual(old.diagnostics, []);
  const current = await resolve(recipes.current, sources.current, envelopes.current);
  assert.deepEqual(current.diagnostics, []);
  assert.deepEqual(current.document.root, old.document.root, 'the form of the label changes nothing it builds');

  for (const form of ['missing', 'other', 'disagreeing']) {
    assert.equal((await resolve(recipes[form], sources.old, envelopes.old)).document, null, `recipe ${form}`);
    assert.equal((await resolve(recipes.old, sources[form], envelopes.old)).document, null, `template manifest ${form}`);
    assert.equal((await resolve(recipes.old, sources.old, envelopes[form])).document, null, `inputs ${form}`);
  }
});

// The live JSON Schemas take both forms: `schema` is one of the two labels, and
// the bare name needs `schema_version` equal to the major (`anyOf`, read by the
// Draft 2020-12 validators these schemas are written for; no small Framework
// validator reads them). The frozen copies a published standard pins keep the
// bytes they were published with.
const LIVE = {
  'contracts/schema/change-journal.v1.schema.json': 'simai.change-journal',
  'src/core/contracts/public-variables.v1.schema.json': 'simai.framework.public-variables',
  'src/core/contracts/interface-fragment.v1.schema.json': 'simai.interface-fragment',
  'src/core/contracts/composition-editor-manifest.v1.schema.json': 'simai.composition.editor-manifest',
  'src/core/contracts/composition-type-manifest.v1.schema.json': 'simai.composition.type-manifest',
  'src/core/contracts/composite-host-port.v1.schema.json': 'simai.composite.host-port',
  'src/core/contracts/composition-editor-field-kind.v1.schema.json': 'simai.composition.editor-field-kind',
  'src/core/contracts/effect.v1.schema.json': 'simai.effect',
  'src/core/contracts/composition-port-manifest.v1.schema.json': 'simai.composition.port-manifest',
  'src/core/contracts/composition-document.v1.schema.json': 'simai.composition.document',
};

test('every live schema of a versioned format takes both forms of its name', () => {
  for (const [path, name] of Object.entries(LIVE)) {
    const schema = json(path);
    const label = `${name}.v1`;
    assert.deepEqual(schema.properties.schema.enum, [label, name], `${path}: schema`);
    assert.deepEqual(schema.properties.schema_version, {const: 1}, `${path}: schema_version`);
    assert.deepEqual(schema.anyOf, [{properties: {schema: {const: label}}}, {required: ['schema_version']}], `${path}: the bare name needs its major`);
    assert.ok(schema.required.includes('schema') && !schema.required.includes('schema_version'), `${path}: the older form stays valid`);
  }
});

test('the frozen copies published standards pin keep the older label alone', () => {
  for (const [path, label] of [
    ['contracts/standards/pinned/interface-fragment.v1.schema.json', 'simai.interface-fragment.v1'],
    ['contracts/standards/pinned/effect.v1.schema.json', 'simai.effect.v1'],
    ['contracts/standards/pinned/composite-host-port.v1.schema.json', 'simai.composite.host-port.v1'],
    ['contracts/standards/pinned/change-journal-1.0.0.schema.json', 'simai.change-journal.v1'],
  ]) {
    const schema = json(path);
    assert.deepEqual(schema.properties.schema, {const: label}, path);
    assert.equal(schema.anyOf, undefined, path);
  }
});

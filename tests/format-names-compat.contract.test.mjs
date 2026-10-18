import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import test from 'node:test';

import {checkEffectManifest} from '../src/core/js/effects.js';
import {checkFragmentDescriptor} from '../src/core/js/composition/fragments.mjs';
import {createPortRegistry} from '../src/core/js/composition/routing.mjs';
import {BUILTIN_EDITOR_MANIFESTS, compositionTypeFromSmartManifest, createRegistry, resolveRecipe, validate, validateEditorManifest} from '../src/core/js/composition/index.mjs';
import {BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS} from '../src/core/js/composition/builtins.mjs';
import {BUILTIN_FIELD_KINDS, fieldKindRegistry} from '../src/core/js/composition/fields.mjs';

// Names carry no version (owner, 2026-10-11; journal record
// format-names-without-version). Through the compatibility window every reader
// takes a format in both forms: the older label `simai.<name>.v1`, and
// `simai.<name>` with `schema_version: 1` beside it. The new form without a
// schema_version, or with another major, is refused.
const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const unversioned = (document, name) => {
  const {schema, schema_version, ...rest} = clone(document);
  return {schema: name, schema_version: 1, ...rest};
};
const versioned = (document, name) => {
  const {schema, schema_version, ...rest} = clone(document);
  return {schema: `${name}.v1`, ...rest};
};
// The builtins and the sample effect are written in the new form now; the
// older form each reader still takes is built from them here.
const forms = (document, name) => ({
  old: versioned(document, name),
  current: unversioned(document, name),
  missing: (({schema_version, ...rest}) => rest)(unversioned(document, name)),
  other: {...unversioned(document, name), schema_version: 2},
  disagreeing: {...versioned(document, name), schema_version: 2},
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

// Writers emit the new form (step 2 of the decision, journal record
// format-names-without-version), and the repository's own data files carry it.
// The formats below keep the older label on purpose: a reader outside
// ui-source compares it, or a published artifact pins the bytes by digest.
const KEPT = {
  'simai.smart-component-contract-registry.v2': 'ui-studio reads it by this label',
  'simai.composite.host-port.v1': 'published port editions, pinned by digest',
  'simai.composite.host-port.conformance.v1': 'published port kits, pinned by digest',
  'simai.composition.capability-contract-lock.v1': 'ui-builder packages the normative files by this label',
  'simai.smart-component-fixture.v2': 'ui-studio validates it by const',
  'simai.smart-component-scenario.v1': 'ui-studio validates it by const',
  'simai.smart.sources-local-map.v1': 'ui-studio reads it by this label',
};
// Directories whose bytes a published contract pins: the frozen standard
// copies, every host-port edition with its kit, and Recipe 1.0.1, whose lock
// (pinned again under contracts/standards/pinned) digests its schemas and
// fixtures.
const PINNED = ['contracts/standards/', 'src/core/contracts/ports/', 'src/core/contracts/composition-recipe-v1/'];
const VERSIONED_LABEL = /^simai\.[a-z0-9.-]+\.v[0-9]+$/u;

function jsonFiles(directory) {
  return readdirSync(new URL(`../${directory}`, import.meta.url), {withFileTypes: true}).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : jsonFiles(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

function declaredLabels(value, found = []) {
  if (Array.isArray(value)) value.forEach((entry) => declaredLabels(entry, found));
  else if (value && typeof value === 'object') {
    for (const key of ['schema', 'schema_id']) if (typeof value[key] === 'string' && VERSIONED_LABEL.test(value[key])) found.push(value[key]);
    Object.values(value).forEach((entry) => declaredLabels(entry, found));
  }
  return found;
}

test('no data file in src/ or contracts/ declares a versioned format name, outside the formats kept on purpose', () => {
  const offenders = [];
  let read = 0;
  for (const path of [...jsonFiles('src'), ...jsonFiles('contracts')]) {
    if (PINNED.some((prefix) => path.startsWith(prefix))) continue;
    const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    if (!text.trim()) continue;
    read += 1;
    for (const label of declaredLabels(JSON.parse(text))) if (!(label in KEPT)) offenders.push(`${path}: ${label}`);
  }
  assert.ok(read > 100, `read ${read} files`);
  assert.deepEqual(offenders, []);
});

test('every format kept in the older form is named in the journal record with its reason', () => {
  const record = json('contracts/changes/journal.json').records.find(({id}) => id === 'format-names-without-version');
  for (const label of Object.keys(KEPT)) assert.ok(record.summary.includes(label), label);
});

test('the runtime writers emit the new form', async () => {
  const isNew = (document, name) => document.schema === name && document.schema_version === 1;
  for (const manifest of BUILTIN_TYPE_MANIFESTS) assert.ok(isNew(manifest, 'simai.composition.type-manifest'), manifest.type);
  for (const manifest of BUILTIN_PORT_MANIFESTS) assert.ok(isNew(manifest, 'simai.composition.port-manifest'), manifest.element);
  for (const manifest of BUILTIN_EDITOR_MANIFESTS) assert.ok(isNew(manifest, 'simai.composition.editor-manifest'), manifest.type);
  for (const kind of BUILTIN_FIELD_KINDS) assert.ok(isNew(kind, 'simai.composition.editor-field-kind'), kind.kind);
  assert.ok(isNew(fieldKindRegistry(), 'simai.composition.editor-field-kind-registry'));
  assert.ok(isNew(compositionTypeFromSmartManifest(json('src/smart/buttons/smart.manifest.json')), 'simai.composition.type-manifest'));
  for (const [path, name] of [
    ['src/core/contracts/composition-types.v1.json', 'simai.composition.type-registry'],
    ['src/core/contracts/composition-ports.v1.json', 'simai.composition.port-registry'],
    ['src/core/contracts/composition-editor-field-kinds.v1.json', 'simai.composition.editor-field-kind-registry'],
  ]) assert.ok(isNew(json(path), name), path);
  const editors = json('src/core/contracts/composition-editor-manifests.v1.json');
  assert.ok(isNew(editors, 'simai.composition.editor-manifest-registry'), 'the editor manifest registry');
  for (const entry of editors.entries) assert.ok(isNew(entry, 'simai.composition.editor-manifest'), `its entries: ${entry.type}`);

  // A Document and its receipt take the recipe's form: Recipe 1.0.1 fixes the
  // older one for a recipe in the older form, by published bytes.
  const recipe = {
    schema: 'simai.composition.recipe', schema_version: 1, id: 'demo.inline', profile: 'ui-layout',
    root: {id: 'page', node: {type: 'layout.page', slots: {default: [{id: 'heading', node: {type: 'content.heading', data: {level: {literal: 1}, content: {literal: [{type: 'text', value: 'Заголовок'}]}}}}]}}},
  };
  const resolve = (form) => resolveRecipe(form, {
    trustedContext: {scope: 'site-1'},
    executionContract: {contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer'},
    ports: {readReference: async () => { throw new Error('no references'); }},
  });
  const named = await resolve(recipe);
  assert.deepEqual(named.diagnostics, []);
  assert.ok(isNew(named.document, 'simai.composition.document'));
  assert.ok(isNew(named.dependencyReceipt, 'simai.composition.dependencies'));
  const older = await resolve(versioned(recipe, 'simai.composition.recipe'));
  assert.deepEqual(older.diagnostics, []);
  assert.equal(older.document.schema, 'simai.composition.document.v1');
  assert.equal(older.document.schema_version, undefined);
  assert.equal(older.dependencyReceipt.schema, 'simai.composition.dependencies.v1');
  assert.equal(older.dependencyReceipt.schema_version, undefined);
  assert.deepEqual(older.document.root, named.document.root);
});

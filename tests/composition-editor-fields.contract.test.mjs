import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BUILTIN_EDITOR_MANIFESTS,
  createRegistry,
  projectDocumentEditorFields,
  projectEditorFields,
  render,
  validateEditorManifest,
} from '../src/core/js/composition/index.mjs';
import { BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const propertyTypes = [{ type: 'string', version: 2 }, { type: 'integer', version: 1 }];
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixture = async () => JSON.parse(await readFile(path.resolve(root, 'tests/fixtures/composition/editor-fields.json'), 'utf8'));
const cases = async () => JSON.parse(await readFile(path.resolve(root, 'tests/fixtures/composition/editor-manifest-cases.json'), 'utf8'));
const type = (key) => BUILTIN_TYPE_MANIFESTS.find((entry) => entry.type === key);
const editor = (key) => BUILTIN_EDITOR_MANIFESTS.find((entry) => entry.type === key);

test('declares preset, basic and real advanced fields through exact Property identities without changing Recipe or Document', () => {
  const section = validateEditorManifest(editor('layout.section'), type('layout.section'), { propertyTypes });
  const columns = validateEditorManifest(editor('layout.columns'), type('layout.columns'), { propertyTypes });
  const heading = validateEditorManifest(editor('content.heading'), type('content.heading'), { propertyTypes });
  assert.equal(section.valid, true);
  assert.equal(columns.valid, true);
  assert.equal(heading.valid, true);
  assert.deepEqual(editor('layout.section').fields[0].choices, ['surface', 'contrast']);
  assert.deepEqual(editor('layout.columns').fields[0].constraints, { min: 1, max: 12 });
  assert.equal(editor('layout.section').fields[0].property.version, 2);
  assert.equal(editor('layout.columns').fields[0].property.version, 1);
  assert.equal(editor('layout.section').fields[0].help_key, 'sf.composition.layout_section.surface_help');
  assert.equal(editor('layout.section').fields[0].visibility, 'visible');
  assert.deepEqual(editor('layout.section').fields[0].capability_hints, ['composition.presentation.preset']);
  assert.deepEqual(editor('layout.section').fields[0].permission_hints, ['composition.node.update']);
  assert.deepEqual(editor('content.heading').fields[0], {
    key: 'level',
    plane: 'data',
    target: 'level',
    property: { type: 'integer', version: 1 },
    constraints: { min: 1, max: 6 },
    group: 'advanced',
    visibility: 'collapsed',
    default: 2,
    label_key: 'sf.composition.content_heading.level',
    help_key: 'sf.composition.content_heading.level_help',
    capability_hints: ['composition.data.level'],
    permission_hints: ['composition.node.update'],
    owner: 'simai/framework',
  });
  assert.equal('value' in editor('layout.section').fields[0], false);
  assert.equal('value' in editor('content.heading').fields[0], false);
});

test('accepts positive manifest fixtures and rejects every bounded negative fixture', async () => {
  const fixtureCases = await cases();
  for (const entry of fixtureCases.positive) {
    const manifest = clone(editor(entry.type));
    Object.assign(manifest.fields[0], entry.field_patch || {});
    const result = validateEditorManifest(manifest, type(entry.type), { propertyTypes });
    assert.equal(result.valid, true, `${entry.id}: ${JSON.stringify(result.diagnostics)}`);
    for (const [key, value] of Object.entries(entry.expected || {})) assert.deepEqual(manifest.fields[0][key], value, `${entry.id}.${key}`);
  }
  for (const entry of fixtureCases.negative) {
    const manifest = clone(editor(entry.type));
    Object.assign(manifest.fields[0], entry.field_patch || {});
    if (entry.duplicate_field) manifest.fields.push({ ...clone(manifest.fields[0]), key: `${manifest.fields[0].key}_alias` });
    const result = validateEditorManifest(manifest, type(entry.type), { propertyTypes });
    assert.ok(result.diagnostics.some(({ code }) => code === entry.expected_code), `${entry.id}: ${JSON.stringify(result.diagnostics)}`);
  }
});

test('projects two same-type instances and a nested component without sharing values', async () => {
  const document = await fixture();
  const projected = projectDocumentEditorFields(document, createRegistry(), BUILTIN_EDITOR_MANIFESTS, { propertyTypes });
  assert.equal(projected.valid, true);
  assert.deepEqual(projected.instances.map(({ id }) => id), ['surface-a', 'heading-a', 'columns-nested', 'nested-copy', 'heading-nested', 'surface-b', 'heading-b']);
  assert.deepEqual(projected.instances.filter(({ type: key }) => key === 'layout.section').map(({ fields }) => fields[0].value), ['surface', 'contrast', 'contrast']);
  assert.equal(projected.instances.find(({ id }) => id === 'columns-nested').fields[0].value, 3);
  assert.deepEqual(projected.instances.filter(({ type: key }) => key === 'content.heading').map(({ fields }) => fields[0].value), [2, 4, 3]);
  const surface = projected.instances.find(({ id }) => id === 'surface-a').fields[0];
  assert.equal(surface.help_key, 'sf.composition.layout_section.surface_help');
  assert.equal(surface.visibility, 'visible');
  assert.deepEqual(surface.capability_hints, ['composition.presentation.preset']);
  assert.deepEqual(surface.permission_hints, ['composition.node.update']);
  const advanced = projected.instances.find(({ id }) => id === 'heading-nested').fields[0];
  assert.equal(advanced.group, 'advanced');
  assert.equal(advanced.visibility, 'collapsed');
  assert.deepEqual(advanced.constraints, { min: 1, max: 6 });
});

test('advanced heading level is existing renderer behavior and invalid levels fail closed', async () => {
  const document = await fixture();
  const rendered = await render(document);
  assert.equal(rendered.diagnostics.length, 0);
  assert.match(rendered.html, /<h2 data-sf-composition-id="heading-a">Primary heading<\/h2>/u);
  assert.match(rendered.html, /<h4 data-sf-composition-id="heading-nested">Nested heading<\/h4>/u);
  assert.match(rendered.html, /<h3 data-sf-composition-id="heading-b">Secondary heading<\/h3>/u);

  const invalid = clone(document);
  invalid.root.slots.default[0].slots.default[0].data.level = 7;
  const rejected = await render(invalid);
  assert.equal(rejected.html, '');
  assert.ok(rejected.diagnostics.some(({ code }) => code === 'schema_maximum'));
});

test('rejects unknown fields, Property type/version and duplicate destinations', () => {
  const unknown = clone(editor('layout.section'));
  unknown.fields[0].unexpected = true;
  const property = clone(editor('layout.section'));
  property.fields[0].property = { type: 'unknown', version: 9 };
  const duplicate = clone(editor('layout.section'));
  duplicate.fields.push({ ...clone(duplicate.fields[0]), key: 'surface_alias' });
  assert.ok(validateEditorManifest(unknown, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_unknown_field'));
  assert.ok(validateEditorManifest(property, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_property_registration_unknown'));
  assert.ok(validateEditorManifest(duplicate, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_destination_duplicate'));
});

test('rejects unknown registered choices, current values and executable or secret metadata', () => {
  const choice = clone(editor('layout.section'));
  choice.fields[0].choices.push('neon');
  const executable = clone(editor('layout.section'));
  executable.fields[0].constraints = { handler: 'Product\\Handler' };
  const secret = clone(editor('layout.section'));
  secret.fields[0].target = 'secret';
  assert.ok(validateEditorManifest(choice, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_presentation_choice_unknown'));
  assert.ok(validateEditorManifest(executable, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_executable_or_secret_field_forbidden'));
  assert.ok(validateEditorManifest(secret, type('layout.section'), { propertyTypes }).diagnostics.some(({ code }) => code === 'editor_executable_or_secret_field_forbidden'));

  const projected = projectEditorFields(editor('layout.section'), type('layout.section'), { id: 'bad', type: 'layout.section', presentation: { preset: 'neon' } }, { propertyTypes });
  assert.ok(projected.diagnostics.some(({ code }) => code === 'editor_choice_unknown'));
});

test('keeps SSR and Smart hydration independent from authoring metadata', async () => {
  const document = await fixture();
  const before = await render(document);
  const projected = projectDocumentEditorFields(document, createRegistry(), BUILTIN_EDITOR_MANIFESTS, { propertyTypes });
  const after = await render(document);
  assert.equal(projected.valid, true);
  assert.equal(after.html, before.html);
  assert.deepEqual(after.hydration, before.hydration);
  assert.equal(after.digest, before.digest);
});

test('publishes editor projection on the existing Composition API', () => {
  assert.equal(typeof globalThis.SF.Composition.validateEditorManifest, 'function');
  assert.equal(typeof globalThis.SF.Composition.projectEditorFields, 'function');
  assert.equal(typeof globalThis.SF.Composition.projectDocumentEditorFields, 'function');
});

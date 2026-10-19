#!/usr/bin/env node
// Records exact conformance expectations for Composition capabilities v1.
// Case sources state intent (valid/invalid); this script records the exact
// diagnostics, digest and HTML produced by the owner runtime and refuses any
// case whose outcome contradicts its declared intent. --check compares only.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import {
  applyFieldValue,
  createRegistry,
  describeRegions,
  normalize,
  parseFieldSubmission,
  projectEditorFields,
  render,
  renderFieldFallback,
  resolveFieldKind,
  stableStringify,
  validate,
  validateEditorManifest,
  validateFieldKinds,
} from '../src/core/js/composition/index.mjs';
import { schemaFields } from '../src/core/js/composition/schema-name.mjs';
import { FIELD_FALLBACK_CASES, FIELD_MANIFEST_CASES, FIELD_MESSAGES, FIELD_SUBMISSION_CASES } from '../tests/fixtures/composition-capabilities/cases/fields.mjs';
import { REGION_CASES } from '../tests/fixtures/composition-capabilities/cases/regions.mjs';
import { ROUTING_CASES, ROUTING_PORT_BINDINGS, ROUTING_RENDERERS, ROUTING_TYPES } from '../tests/fixtures/composition-capabilities/cases/routing.mjs';
import {
  VALUE_TYPE_NAME_ALL_TYPES,
  VALUE_TYPE_NAME_CASES,
  VALUE_TYPE_NAME_EFFECTS,
  VALUE_TYPE_NAME_PORT_MANIFESTS,
  VALUE_TYPE_NAME_SCHEMA_CASES,
  VALUE_TYPE_NAME_TYPES,
} from '../tests/fixtures/composition-capabilities/cases/value-type-names.mjs';
import { VALUE_TYPES, checkPortValue, createPortRegistry, valueTypeName } from '../src/core/js/composition/routing.mjs';
import { checkFragmentDescriptor } from '../src/core/js/composition/fragments.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contracts = resolve(root, 'src/core/contracts');

const serialize = (value) => `${JSON.stringify(JSON.parse(stableStringify(value)), null, 2)}\n`;

async function documentCase(entry, setup = {}) {
  const registry = setup.registry;
  const options = setup.options || {};
  const checked = validate(entry.document, registry, options);
  const codes = [...new Set(checked.diagnostics.map(({ code }) => code))].sort();
  if ((entry.expect === 'valid') !== checked.valid) {
    throw new Error(`case ${entry.id} expected ${entry.expect} but produced ${JSON.stringify(checked.diagnostics)}`);
  }
  const result = { id: entry.id, expect: entry.expect, document: entry.document, diagnostics: codes };
  if (checked.valid) {
    const normalized = await normalize(entry.document, registry, options);
    const rendered = await render(entry.document, { registry, options });
    if (rendered.diagnostics.length) throw new Error(`case ${entry.id} failed to render ${JSON.stringify(rendered.diagnostics)}`);
    result.digest = `sha256:${normalized.digest}`;
    result.canonical = stableStringify(normalized.document);
    result.html = rendered.html;
    const regions = await describeRegions(normalized.document);
    if (regions.length) result.regions = regions.map(({ layout, node, name, landmark, placement, digest }) => ({ layout, node, name, landmark, placement, digest }));
    if (rendered.hydration.length) result.hydration = rendered.hydration;
  }
  return result;
}

async function build() {
  const outputs = {};
  outputs['composition-regions-v1/fixtures/regions.json'] = serialize({
    ...schemaFields('simai.composition.capability-fixtures', 1),
    capability: 'layout.regions',
    cases: await Promise.all(REGION_CASES.map(documentCase)),
  });
  const routingSetup = {
    registry: createRegistry([...BUILTIN_TYPE_MANIFESTS, ...ROUTING_TYPES], ROUTING_RENDERERS),
    options: { ports: { manifests: BUILTIN_PORT_MANIFESTS, bindings: ROUTING_PORT_BINDINGS } },
  };
  outputs['composition-routing-v1/fixtures/routing.json'] = serialize({
    ...schemaFields('simai.composition.capability-fixtures', 1),
    capability: 'layout.scope',
    setup: {
      types: ROUTING_TYPES,
      port_bindings: ROUTING_PORT_BINDINGS,
      registered_renderers: { 'example.product-list': '<sf-table aria-label="Товары" table-settings-key="example.products" data-sf-endpoint="{endpoint}"></sf-table>' },
    },
    cases: await Promise.all(ROUTING_CASES.map((entry) => documentCase(entry, routingSetup))),
  });
  // Value types named without a version (value-types-without-version): a
  // corpus of its own, so routing.json keeps the bytes Routing 1.0.0 fixed.
  const namesSetup = {
    registry: createRegistry([...BUILTIN_TYPE_MANIFESTS, ...VALUE_TYPE_NAME_ALL_TYPES], ROUTING_RENDERERS),
    options: { ports: { manifests: [...BUILTIN_PORT_MANIFESTS, ...VALUE_TYPE_NAME_PORT_MANIFESTS], bindings: ROUTING_PORT_BINDINGS } },
  };
  const schemaCases = VALUE_TYPE_NAME_SCHEMA_CASES.map((entry) => {
    let valid;
    if (entry.schema === 'interface-fragment.v1.schema.json') valid = checkFragmentDescriptor(entry.document).length === 0;
    else {
      try { createPortRegistry([entry.document]); valid = true; } catch { valid = false; }
    }
    if (valid !== (entry.expect === 'valid')) throw new Error(`case ${entry.id} expected ${entry.expect} of the runtime`);
    return entry;
  });
  const effects = VALUE_TYPE_NAME_EFFECTS.map(({ type, value }) => {
    const label = Object.keys(VALUE_TYPES).find((name) => valueTypeName(name) === type);
    const checked = checkPortValue(type, value);
    if (stableStringify(checkPortValue(label, value)) !== stableStringify(checked)) throw new Error(`effect ${type} differs from ${label}`);
    return { types: [type, label], port: valueTypeName(label), value: checked };
  });
  outputs['composition-routing-v1/fixtures/value-type-names.json'] = serialize({
    ...schemaFields('simai.composition.capability-fixtures', 1),
    capability: 'layout.scope',
    value_type_names: Object.fromEntries(Object.keys(VALUE_TYPES).map((label) => [valueTypeName(label), label])),
    setup: {
      types: VALUE_TYPE_NAME_TYPES,
      port_manifests: VALUE_TYPE_NAME_PORT_MANIFESTS,
      port_bindings: ROUTING_PORT_BINDINGS,
    },
    cases: await Promise.all(VALUE_TYPE_NAME_CASES.map((entry) => documentCase(entry, namesSetup))),
    schema_cases: schemaCases,
    effects,
  });
  const types = createRegistry().types;
  const hostPropertyTypes = [{ type: 'string', version: 1 }, { type: 'string', version: 2 }, { type: 'integer', version: 1 }, { type: 'boolean', version: 1 }];
  const submissions = FIELD_SUBMISSION_CASES.map((entry) => {
    const parsed = parseFieldSubmission(entry.field, entry.raw);
    const accepted = !parsed.error;
    if (accepted !== (entry.expect === 'accepted')) throw new Error(`case ${entry.id} expected ${entry.expect} but produced ${JSON.stringify(parsed)}`);
    const manifest = BUILTIN_EDITOR_MANIFESTS.find((candidate) => candidate.fields.includes(entry.field));
    const node = entry.node || { id: 'node', type: manifest.type, [entry.field.plane]: {} };
    return {
      id: entry.id,
      type: manifest.type,
      field: entry.field.key,
      kind: resolveFieldKind(entry.field).kind,
      // Ill-formed UTF-16 cannot travel as JSON text; record its code units.
      ...(typeof entry.raw === 'string' && !entry.raw.isWellFormed()
        ? { raw_code_units: [...entry.raw].flatMap((character) => Array.from({ length: character.length }, (_, index) => character.charCodeAt(index).toString(16).padStart(4, '0'))) }
        : { raw: entry.raw }),
      expect: entry.expect,
      result: parsed.error ? { error: parsed.error.code } : parsed.unset ? { unset: true } : { value: parsed.value },
      ...(accepted ? { node, applied: applyFieldValue(node, entry.field, parsed) } : {}),
    };
  });
  const manifests = FIELD_MANIFEST_CASES.map((entry) => {
    const manifest = entry.manifest || JSON.parse(JSON.stringify(BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === 'layout.region')));
    entry.mutate?.(manifest);
    const checked = validateEditorManifest(manifest, types.get(manifest.type), { propertyTypes: hostPropertyTypes });
    const codes = [...new Set([...checked.diagnostics, ...validateFieldKinds(manifest)].map(({ code }) => code))].sort();
    if ((codes.length === 0) !== (entry.expect === 'valid')) throw new Error(`case ${entry.id} expected ${entry.expect} but produced ${codes}`);
    return { id: entry.id, expect: entry.expect, manifest, diagnostics: codes, kinds: manifest.fields.map((field) => resolveFieldKind(field)?.kind ?? null) };
  });
  const fallbacks = FIELD_FALLBACK_CASES.map((entry) => {
    const manifest = JSON.parse(JSON.stringify(BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === entry.type)));
    for (const field of manifest.fields) if (field.key === entry.hide) field.visibility = 'hidden';
    const projected = projectEditorFields(manifest, types.get(entry.type), entry.node, { propertyTypes: hostPropertyTypes });
    if (!projected.valid) throw new Error(`case ${entry.id} failed to project`);
    const messages = entry.messages ?? FIELD_MESSAGES;
    return { id: entry.id, instance: entry.instance, node: entry.node, messages, html: projected.fields.map((field) => renderFieldFallback(field, { instance: entry.instance, messages })).join('') };
  });
  outputs['composition-editor-fields-v1/fixtures/field-kinds.json'] = serialize({
    ...schemaFields('simai.composition.capability-fixtures', 1),
    capability: 'editor.field-kinds',
    setup: { host_property_types: hostPropertyTypes, messages: FIELD_MESSAGES },
    submissions,
    manifests,
    fallbacks,
  });
  return outputs;
}

const outputs = await build();
let drift = false;
for (const [relative, content] of Object.entries(outputs)) {
  const path = resolve(contracts, relative);
  if (process.argv.includes('--check')) {
    let current = null;
    try { current = readFileSync(path, 'utf8'); } catch { current = null; }
    if (current !== content) {
      drift = true;
      process.stderr.write(`composition_capability_fixture_drift:${relative}\n`);
    }
  } else {
    writeFileSync(path, content);
    process.stdout.write(`${path}\n`);
  }
}
if (drift) process.exitCode = 1;
else if (process.argv.includes('--check')) process.stdout.write('composition capability fixtures are current\n');

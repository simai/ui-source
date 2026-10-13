import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BUILTIN_EDITOR_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import {
  BUILTIN_FIELD_KINDS,
  applyFieldValue,
  createRegistry,
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const regionEditor = BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === 'layout.region');
const field = (key) => regionEditor.fields.find((entry) => entry.key === key);
const hostPropertyTypes = [{ type: 'string', version: 1 }, { type: 'string', version: 2 }, { type: 'integer', version: 1 }, { type: 'boolean', version: 1 }];

test('publishes four kinds and maps every published field to exactly one', () => {
  assert.deepEqual(BUILTIN_FIELD_KINDS.map(({ kind, status }) => `${kind}:${status}`), ['choice:formalized-existing', 'integer:formalized-existing', 'text:new', 'toggle:new']);
  for (const manifest of BUILTIN_EDITOR_MANIFESTS) {
    for (const entry of manifest.fields) assert.ok(resolveFieldKind(entry), `${manifest.type}.${entry.key}`);
    assert.deepEqual(validateFieldKinds(manifest), [], manifest.type);
  }
  assert.deepEqual(regionEditor.fields.map((entry) => resolveFieldKind(entry).kind), ['choice', 'text', 'choice', 'toggle']);
});

test('region editor manifest binds the exact registered type and host Property identities', () => {
  const type = createRegistry().types.get('layout.region');
  assert.deepEqual(validateEditorManifest(regionEditor, type, { propertyTypes: hostPropertyTypes }), { valid: true, diagnostics: [] });
  const withoutBoolean = validateEditorManifest(regionEditor, type, { propertyTypes: hostPropertyTypes.slice(0, 3) });
  assert.ok(withoutBoolean.diagnostics.some(({ code }) => code === 'editor_property_registration_unknown'));
  assert.equal(regionEditor.fields.some(({ key }) => key === 'name'), false, 'structural region identity is not editable');
});

test('field-kind fixtures reproduce submissions, manifest checks and fallback markup', async () => {
  const fixture = await readJson('src/core/contracts/composition-editor-fields-v1/fixtures/field-kinds.json');
  const types = createRegistry().types;
  for (const entry of fixture.submissions) {
    const manifest = BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === entry.type);
    const target = manifest.fields.find(({ key }) => key === entry.field);
    const raw = entry.raw_code_units ? String.fromCharCode(...entry.raw_code_units.map((unit) => Number.parseInt(unit, 16))) : entry.raw;
    const parsed = parseFieldSubmission(target, raw);
    const result = parsed.error ? { error: parsed.error.code } : parsed.unset ? { unset: true } : { value: parsed.value };
    assert.deepEqual(result, entry.result, entry.id);
    if (entry.applied) assert.equal(stableStringify(applyFieldValue(entry.node, target, parsed)), stableStringify(entry.applied), entry.id);
  }
  for (const entry of fixture.manifests) {
    const checked = validateEditorManifest(entry.manifest, types.get(entry.manifest.type), { propertyTypes: fixture.setup.host_property_types });
    assert.deepEqual([...new Set([...checked.diagnostics, ...validateFieldKinds(entry.manifest)].map(({ code }) => code))].sort(), entry.diagnostics, entry.id);
  }
  for (const entry of fixture.fallbacks) {
    const manifest = JSON.parse(JSON.stringify(BUILTIN_EDITOR_MANIFESTS.find(({ type }) => type === entry.node.type)));
    if (entry.id === 'fallback.hidden-field-omitted') manifest.fields.find(({ key }) => key === 'sticky').visibility = 'hidden';
    const projected = projectEditorFields(manifest, types.get(entry.node.type), entry.node, { propertyTypes: hostPropertyTypes });
    assert.equal(projected.fields.map((projectedField) => renderFieldFallback(projectedField, { instance: entry.instance, messages: entry.messages })).join(''), entry.html, entry.id);
  }
});

test('applying values never mutates the source node and keeps documents valid', async () => {
  const document = await readJson('tests/fixtures/composition/regions.json');
  const aside = document.root.slots.regions[3];
  const before = JSON.stringify(aside);
  const sticky = applyFieldValue(aside, field('sticky'), parseFieldSubmission(field('sticky'), 'true'));
  const moved = applyFieldValue(sticky, field('placement'), parseFieldSubmission(field('placement'), 'start'));
  const renamed = applyFieldValue(moved, field('label'), parseFieldSubmission(field('label'), 'Похожие товары'));
  assert.equal(JSON.stringify(aside), before);
  document.root.slots.regions[3] = renamed;
  // Placement start after center violates the declared visual order, so the
  // owner validator rejects this edit instead of rendering a mismatched order.
  assert.ok(validate(document).diagnostics.some(({ code }) => code === 'region_order_invalid'));
  document.root.slots.regions[3] = applyFieldValue(renamed, field('placement'), parseFieldSubmission(field('placement'), 'end'));
  assert.deepEqual(validate(document), { valid: true, diagnostics: [] });
  const html = (await render(document)).html;
  assert.match(html, /<aside [^>]*data-sf-region="aside" data-sf-region-placement="end" data-sf-region-sticky="" aria-label="Похожие товары">/u);
  const cleared = applyFieldValue(document.root.slots.regions[3], field('sticky'), parseFieldSubmission(field('sticky'), null));
  assert.equal('sticky' in cleared.props, false);
  document.root.slots.regions[3] = cleared;
  const reverted = await readJson('tests/fixtures/composition/regions.json');
  reverted.root.slots.regions[3].props.label = 'Похожие товары';
  assert.equal((await normalize(document)).digest, (await normalize(reverted)).digest, 'toggle off returns to the same digest as never set');
});

test('fallback markup escapes values and exposes names, descriptions and roles', () => {
  const projected = projectEditorFields(regionEditor, createRegistry().types.get('layout.region'),
    { id: 'x', type: 'layout.region', props: { name: 'x', landmark: 'region', label: '<b>"x"</b>' } }, { propertyTypes: hostPropertyTypes });
  const html = projected.fields.map((entry) => renderFieldFallback(entry, { instance: 'x', messages: {} })).join('');
  assert.match(html, /value="&lt;b&gt;&quot;x&quot;&lt;\/b&gt;"/u);
  assert.doesNotMatch(html, /<b>/u);
  assert.match(html, /role="switch"/u);
  assert.match(html, /<details class="sf-editor-field-disclosure"><summary>sf\.composition\.layout_region\.landmark<\/summary>/u);
  assert.equal((html.match(/aria-describedby="/gu) || []).length, 4);
  assert.equal((html.match(/<label for="/gu) || []).length, 4);
  assert.throws(() => renderFieldFallback({ ...field('sticky'), property: { type: 'date', version: 1 } }, { instance: 'x' }), /field_kind_unknown/u);
});

test('applyFieldValue refuses unsuccessful parse results', () => {
  const node = { id: 'x', type: 'layout.region', props: { name: 'x', landmark: 'none' } };
  assert.throws(() => applyFieldValue(node, field('label'), parseFieldSubmission(field('label'), 'a\nb')), TypeError);
  assert.throws(() => applyFieldValue(node, field('label'), {}), TypeError);
});

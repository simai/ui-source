import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  Composition,
  compositionTypeFromSmartManifest,
  createRegistry,
  normalize,
  render,
  stableStringify,
  validate,
} from '../src/core/js/composition/index.mjs';
import { BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = async (name) => JSON.parse(await readFile(resolve(root, 'tests/fixtures/composition', name), 'utf8'));

test('validates, normalizes and renders the catalog fixture without changing it', async () => {
  const document = await fixture('catalog-page.json');
  const before = JSON.stringify(document);
  assert.deepEqual(validate(document), { valid: true, diagnostics: [] });
  const first = await normalize(document);
  const second = await normalize(first.document);
  assert.equal(JSON.stringify(document), before);
  assert.equal(first.digest, second.digest);
  assert.equal(first.digest.length, 64);
  assert.deepEqual(first.dependencies.assets, []);
  assert.deepEqual(first.dependencies.bindings, [{ owner: 'larena/storage', ref: 'catalog.products', revision: '42', target: 'products' }]);
  const output = await render(document, { resolveBinding: async () => [{ id: 1 }] });
  assert.equal(output.diagnostics.length, 0);
  assert.match(output.html, /<h1[^>]*>Каталог товаров<\/h1>/u);
  assert.match(output.html, /<strong>карточки<\/strong>/u);
  assert.match(output.html, /href="\/catalog\/help\/"/u);
});

test('renders columns and deduplicates logical assets', async () => {
  const document = await fixture('columns.json');
  const output = await render(document);
  assert.deepEqual(output.assets, ['composition/layout']);
  assert.equal((output.html.match(/sf-composition-column/gu) || []).length, 3);
  assert.match(output.html, /data-composition-columns="2"/u);
  assert.match(output.html, /Слева/u);
  assert.match(output.html, /Справа/u);
});

test('keeps an omitted column count distinct from an explicit value', async () => {
  const document = await fixture('columns.json');
  delete document.root.props.columns;
  const output = await render(document);
  assert.doesNotMatch(output.html, /data-composition-columns=/u);
  assert.equal((output.html.match(/sf-composition-column/gu) || []).length, 3);
});

test('escapes text and rejects unsafe links', async () => {
  const document = await fixture('catalog-page.json');
  document.root.slots.default[0].slots.default[0].data.content[0].value = '<img src=x onerror=alert(1)>';
  document.root.slots.default[0].slots.default[1].data.content[3].href = 'javascript:alert(1)';
  const checked = validate(document);
  assert.equal(checked.valid, false);
  assert.ok(checked.diagnostics.some(({ code }) => code === 'unsafe_url'));
  document.root.slots.default[0].slots.default[1].data.content[3].href = '#safe';
  const output = await render(document);
  assert.match(output.html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.doesNotMatch(output.html, /<img/u);
});

test('rejects unknown fields, executable data, duplicate ids and limits', async () => {
  const document = await fixture('catalog-page.json');
  document.root.unexpected = true;
  document.root.data = { script: 'alert(1)' };
  document.root.slots.default[0].id = 'page';
  const checked = validate(document);
  for (const code of ['unknown_field', 'executable_or_secret_field_forbidden', 'node_id_duplicate']) {
    assert.ok(checked.diagnostics.some((entry) => entry.code === code), `missing ${code}`);
  }
  assert.ok(validate(await fixture('catalog-page.json'), undefined, { limits: { maxNodes: 1 } }).diagnostics.some(({ code }) => code === 'node_limit'));
});

test('rejects unknown profiles, depth, byte limits and cyclic documents', async () => {
  const profile = await fixture('catalog-page.json');
  profile.profile = 'email';
  assert.ok(validate(profile).diagnostics.some(({ code }) => code === 'profile_unknown'));

  const deep = await fixture('catalog-page.json');
  assert.ok(validate(deep, undefined, { limits: { maxDepth: 1 } }).diagnostics.some(({ code }) => code === 'depth_limit'));
  assert.ok(validate(deep, undefined, { limits: { maxDocumentBytes: 32 } }).diagnostics.some(({ code }) => code === 'document_too_large'));

  const cyclic = await fixture('catalog-page.json');
  cyclic.self = cyclic;
  assert.ok(validate(cyclic).diagnostics.some(({ code }) => code === 'document_not_json'));
});

test('an unknown profile is one diagnostic, whatever the size of the Document', () => {
  const paragraph = (index) => ({ id: `p${index}`, type: 'content.paragraph', data: { content: [{ type: 'text', value: `Line ${index}.` }] } });
  const documentOf = (profile, count) => ({
    schema: 'simai.composition.document', schema_version: 1, id: 'sized', profile,
    root: { id: 'root', type: 'content.document', slots: { default: Array.from({ length: count - 1 }, (_, index) => paragraph(index)) } },
  });
  for (const count of [1, 10, 500]) {
    const checked = validate(documentOf('page', count));
    assert.deepEqual(checked.diagnostics.map(({ code, path }) => [code, path]), [['profile_unknown', '$.profile']], `${count} nodes`);
    // A known profile is unchanged: content.document is structured content only.
    assert.equal(validate(documentOf('structured-content', count)).valid, true, `${count} nodes, structured-content`);
    const layout = validate(documentOf('ui-layout', count)).diagnostics;
    assert.deepEqual(layout.map(({ code, path }) => [code, path]), [['type_profile_unsupported', '$.root.type']], `${count} nodes, ui-layout`);
  }
});

test('rejects arbitrary classes, ready queries and unsupported required extensions', async () => {
  const document = await fixture('catalog-page.json');
  document.root.props = { class: 'hidden' };
  document.root.data = { query: 'select * from products' };
  document.extensions['project.example:feature'] = { required: true };
  const checked = validate(document);
  assert.ok(checked.diagnostics.filter(({ code }) => code === 'executable_or_secret_field_forbidden').length >= 2);
  assert.ok(checked.diagnostics.some(({ code }) => code === 'extension_required_unknown'));
  const supported = validate(document, undefined, { supportedExtensions: ['project.example:feature'] });
  assert.ok(!supported.diagnostics.some(({ code }) => code === 'extension_required_unknown'));
});

test('rejects unknown types, views, modifiers, slots and forbidden children', async () => {
  const unknown = await fixture('columns.json');
  unknown.root.type = 'unknown.type';
  assert.ok(validate(unknown).diagnostics.some(({ code }) => code === 'type_unknown'));

  const invalid = await fixture('columns.json');
  invalid.root.presentation = { view: 'cards', modifiers: ['wide'] };
  invalid.root.slots.extra = [];
  invalid.root.slots.columns[0].type = 'layout.page';
  const checked = validate(invalid);
  for (const code of ['view_unknown', 'modifier_unknown', 'slot_unknown']) {
    assert.ok(checked.diagnostics.some((entry) => entry.code === code), `missing ${code}`);
  }
});

test('unknown: placeholder draws an unknown block as a placeholder and the rest of the page (G-32)', async () => {
  const document = await fixture('columns.json');
  document.root.slots.columns[0] = { id: 'left', type: 'vendor.quote', data: { text: '<b>kept</b>' }, slots: { default: [{ id: 'inner', type: 'content.paragraph', data: { content: [] } }] } };
  const before = stableStringify(document);
  // The default stays strict: the whole Document is refused.
  const strict = await render(document);
  assert.equal(strict.html, '');
  assert.deepEqual(strict.diagnostics.map(({ code }) => code), ['type_unknown']);
  assert.deepEqual(validate(document).diagnostics.map(({ code, path }) => [code, path]), [['type_unknown', '$.root.slots.columns[0].type']]);
  // Placeholder: valid, the unknown node is a notice and a placeholder.
  const checked = validate(document, undefined, { unknown: 'placeholder' });
  assert.equal(checked.valid, true);
  assert.deepEqual(checked.notices.map(({ code, path }) => [code, path]), [['type_unknown', '$.root.slots.columns[0].type']]);
  const drawn = await render(document, { options: { unknown: 'placeholder' } });
  assert.deepEqual(drawn.diagnostics, []);
  assert.deepEqual(drawn.notices.map(({ code, path }) => [code, path]), [['type_unknown', '$.root.slots.columns[0].type']]);
  assert.match(drawn.html, /<div class="sf-composition-unknown" role="note" data-sf-composition-type="vendor\.quote" data-sf-composition-id="left">vendor\.quote<\/div>/u);
  assert.match(drawn.html, /Справа/u, 'the rest of the page is drawn');
  assert.doesNotMatch(drawn.html, /kept|data-sf-composition-id="inner"/u, 'nothing of its data or slots');
  assert.equal(stableStringify(document), before, 'the Document is kept unchanged');
  assert.equal(drawn.digest, (await normalize(document, undefined, { unknown: 'placeholder' })).digest);
  // Other problems still refuse, and an unknown mode is a programming error.
  const broken = JSON.parse(before);
  broken.root.slots.columns[1].id = 'left';
  assert.equal((await render(broken, { options: { unknown: 'placeholder' } })).html, '');
  assert.throws(() => validate(document, undefined, { unknown: 'draw' }), /composition_unknown_mode_invalid:draw/u);
  // A node with no type at all is not a block to stand in for.
  const typeless = JSON.parse(before);
  delete typeless.root.slots.columns[0].type;
  assert.equal(validate(typeless, undefined, { unknown: 'placeholder' }).valid, false);
});

test('keeps namespaced extensions and rejects unqualified extension names', async () => {
  const document = await fixture('catalog-page.json');
  const normalized = await normalize(document);
  assert.equal(normalized.document.extensions['example.org:editor-note'], 'control fixture');
  document.extensions.note = true;
  assert.ok(validate(document).diagnostics.some(({ code }) => code === 'extension_name_invalid'));
});

test('adapts one real Smart manifest without exposing arbitrary classes', async () => {
  const smart = JSON.parse(await readFile(resolve(root, 'src/smart/button/smart.manifest.json'), 'utf8'));
  const type = compositionTypeFromSmartManifest(smart);
  assert.equal(type.type, 'smart.button');
  assert.equal(type.renderer.name, 'sf-button');
  assert.equal(type.props_schema.properties['root-class'], undefined);
  const registry = createRegistry([...BUILTIN_TYPE_MANIFESTS, type]);
  const document = {
    schema: 'simai.composition.document.v1', id: 'smart', profile: 'ui-layout',
    root: { id: 'button', type: 'smart.button', props: { text: 'Купить', scheme: 'primary' } },
  };
  const output = await render(document, { registry });
  assert.equal(output.diagnostics.length, 0);
  assert.match(output.html, /^<sf-button/u);
  assert.deepEqual(output.assets, ['smart/button']);
  assert.deepEqual(output.hydration, [{ id: 'button', type: 'smart.button', element: 'sf-button' }]);
});

test('renders a separate composite Smart type with a named slot', async () => {
  const smart = {
    version: '1.0.0',
    inputs: { properties: { label: { type: 'string' } } },
    composition: {
      declarative: {
        type: 'smart.test-panel', mode: 'composite', profiles: ['ui-layout'], props: ['label'],
        slots: { content: { min: 1, max: 10, categories: ['content'] } },
        presentation: { views: ['default'], presets: [], modifiers: [] },
        renderer: { kind: 'custom-element', name: 'sf-test-panel' }, assets: ['smart/test-panel'],
      },
    },
  };
  const registry = createRegistry([...BUILTIN_TYPE_MANIFESTS, compositionTypeFromSmartManifest(smart)]);
  const document = {
    schema: 'simai.composition.document.v1', id: 'smart-composite', profile: 'ui-layout',
    root: {
      id: 'panel', type: 'smart.test-panel', props: { label: 'Товары' },
      slots: { content: [{ id: 'text', type: 'content.paragraph', data: { content: [{ type: 'text', value: 'Карточки товаров' }] } }] },
    },
  };
  const output = await render(document, { registry });
  assert.equal(output.diagnostics.length, 0);
  assert.match(output.html, /^<sf-test-panel label="Товары"><p/u);
  assert.deepEqual(output.assets, ['smart/test-panel']);
  assert.deepEqual(output.hydration, [{ id: 'panel', type: 'smart.test-panel', element: 'sf-test-panel' }]);
});

test('reports a missing registered renderer instead of dropping content silently', async () => {
  const custom = {
    schema: 'simai.composition.type-manifest.v1', type: 'test.missing', version: '1.0.0', category: 'component', mode: 'leaf',
    profiles: ['ui-layout'], data_schema: { type: 'object', additionalProperties: false, properties: {} },
    props_schema: { type: 'object', additionalProperties: false, properties: {} },
    presentation: { views: ['default'], presets: [], modifiers: [] }, slots: {},
    renderer: { kind: 'registered', name: 'test.missing' }, assets: [], capabilities: ['html'],
  };
  const output = await render({ schema: 'simai.composition.document.v1', id: 'missing', profile: 'ui-layout', root: { id: 'node', type: 'test.missing' } }, { registry: createRegistry([custom]) });
  assert.ok(output.diagnostics.some(({ code }) => code === 'renderer_unavailable'));
  assert.equal(output.html, '');
});

test('publishes the same ESM API on SF.Composition', () => {
  assert.equal(globalThis.SF.Composition, Composition);
  assert.equal(typeof Composition.validate, 'function');
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('a data binding without its contract is refused', () => {
  const smart = {
    version: '1.0.0', inputs: { properties: {} }, contracts: {},
    composition: { declarative: {
      type: 'smart.broken', mode: 'leaf', profiles: ['ui-layout'], props: [],
      data: { rows: { contract: 'rows' } },
      renderer: { kind: 'custom-element', name: 'sf-broken' }, assets: [],
    } },
  };
  assert.throws(() => compositionTypeFromSmartManifest(smart), /composition_data_contract_missing:smart\.broken:rows/);
});

// A product adds its types to the built-in ones; the built-ins are public so a
// product can see what it is adding to (documentation trial, 2026-10-12).
test('extendRegistry keeps the built-in types and adds a product type', async () => {
  const composition = await import('../src/core/js/composition/index.mjs');
  assert.ok(Array.isArray(composition.BUILTIN_TYPE_MANIFESTS) && composition.BUILTIN_TYPE_MANIFESTS.length > 0);
  assert.equal(composition.Composition.BUILTIN_TYPE_MANIFESTS, composition.BUILTIN_TYPE_MANIFESTS);
  const product = { ...composition.BUILTIN_TYPE_MANIFESTS[0], type: 'product.card' };
  const registry = composition.Composition.extendRegistry([product]);
  for (const { type } of composition.BUILTIN_TYPE_MANIFESTS) assert.ok(registry.types.has(type), type);
  assert.ok(registry.types.has('product.card'));
  assert.equal(composition.createRegistry([product]).types.size, 1, 'createRegistry still takes the list as the whole registry');
});

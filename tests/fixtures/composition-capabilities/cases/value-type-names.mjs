// Conformance case sources for value types named without a version (owner,
// 2026-10-19; journal record value-types-without-version). A port manifest, a
// fragment descriptor, a rendered route and a page effect name a value type by
// its bare name (record-removed) or by the older label (record-removed.v1);
// both are the same type. The cases of fixtures/routing.json, all in the older
// form, keep the bytes and digests Routing 1.0.0 fixed.
import { ROUTING_TYPES } from './routing.mjs';

// A published element that names its value types without the version.
export const VALUE_TYPE_NAME_PORT_MANIFESTS = [
  {
    schema: 'simai.composition.port-manifest',
    schema_version: 1,
    element: 'sf-example-picker',
    version: '1.0.0',
    component: 'example.picker',
    component_version: '1.0.0',
    outputs: {
      picked: { value: 'record-ids', summary: 'The records the person picked.' },
      query: { value: 'text', summary: 'The words the person searches by.' },
    },
    inputs: {
      context: { value: 'record-ids', summary: 'Restricts the picker to records related to these identities.' },
    },
  },
];

export const VALUE_TYPE_NAME_TYPES = [
  {
    schema: 'simai.composition.type-manifest',
    schema_version: 1,
    type: 'example.picker',
    version: '1.0.0',
    category: 'smart',
    mode: 'leaf',
    profiles: ['ui-layout'],
    data_schema: { type: 'object', additionalProperties: false, properties: {} },
    props_schema: { type: 'object', additionalProperties: false, properties: { 'aria-label': { type: 'string', minLength: 1, maxLength: 120 } } },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'custom-element', name: 'sf-example-picker' },
    assets: [],
    capabilities: ['html', 'hydration'],
  },
];

export const VALUE_TYPE_NAME_ALL_TYPES = [...ROUTING_TYPES, ...VALUE_TYPE_NAME_TYPES];

const endpoint = (name) => ({ extensions: { 'simai.composition:endpoint': { name } } });
const table = (id, label) => ({ id, type: 'example.records', props: { 'aria-label': label, 'table-settings-key': `example.${id}` }, ...endpoint(id) });
const picker = (id, label) => ({ id, type: 'example.picker', props: { 'aria-label': label }, ...endpoint(id) });
const route = (id, from, fromPort, to, toPort) => ({ id, from: { endpoint: from, port: fromPort }, to: { endpoint: to, port: toPort } });
const scope = (id, routes, children) => ({ id, type: 'layout.scope', props: { routes }, slots: { default: children } });
const documentOf = (root) => ({ schema: 'simai.composition.document', schema_version: 1, id: 'value-type-names', profile: 'ui-layout', root });

export const VALUE_TYPE_NAME_CASES = [
  {
    id: 'positive.bare-output-feeds-older-input',
    expect: 'valid',
    document: documentOf(scope('picked', [route('picked-orders', 'picker', 'picked', 'orders', 'context')], [picker('picker', 'Выбор'), table('orders', 'Заказы')])),
  },
  {
    id: 'positive.older-output-feeds-bare-input',
    expect: 'valid',
    document: documentOf(scope('selected', [route('orders-picker', 'orders', 'selection', 'picker', 'context')], [table('orders', 'Заказы'), picker('picker', 'Выбор')])),
  },
  {
    id: 'positive.bare-output-feeds-bare-input',
    expect: 'valid',
    document: documentOf(scope('chain', [route('first-second', 'first', 'picked', 'second', 'context')], [picker('first', 'Первый'), picker('second', 'Второй')])),
  },
  {
    id: 'negative.bare-names-still-type-routes',
    expect: 'invalid',
    document: documentOf(scope('mismatch', [route('query-orders', 'picker', 'query', 'orders', 'context')], [picker('picker', 'Выбор'), table('orders', 'Заказы')])),
  },
];

// Schema cases: the published port-manifest and descriptor schemas take either
// form of every value type and nothing else.
const descriptor = (outputs, inputs) => ({
  schema: 'simai.interface-fragment',
  schema_version: 1,
  id: 'example.files',
  element: 'sf-example-files',
  regions: ['content'],
  port: { standard: 'simai.composite-host-port', version: '1.0.4' },
  outputs,
  inputs,
  operation: 'files.read',
  url_state: ['folder'],
  budget: { kb: 40, first_answer_ms: 300 },
});
const manifest = (value) => ({ ...VALUE_TYPE_NAME_PORT_MANIFESTS[0], outputs: { picked: { value, summary: 'x' } }, inputs: {} });

export const VALUE_TYPE_NAME_SCHEMA_CASES = [
  { id: 'port-manifest.bare-names', schema: 'composition-port-manifest.v1.schema.json', expect: 'valid', document: VALUE_TYPE_NAME_PORT_MANIFESTS[0] },
  { id: 'port-manifest.older-label', schema: 'composition-port-manifest.v1.schema.json', expect: 'valid', document: manifest('record-ids.v1') },
  { id: 'port-manifest.another-version', schema: 'composition-port-manifest.v1.schema.json', expect: 'invalid', document: manifest('record-ids.v2') },
  { id: 'port-manifest.unknown-name', schema: 'composition-port-manifest.v1.schema.json', expect: 'invalid', document: manifest('records') },
  { id: 'port-manifest.capital', schema: 'composition-port-manifest.v1.schema.json', expect: 'invalid', document: manifest('Record-ids') },
  {
    id: 'descriptor.bare-names',
    schema: 'interface-fragment.v1.schema.json',
    expect: 'valid',
    document: descriptor({ moved: { value: 'files-moved', summary: 'Files the person moved.' } }, { changed: { value: 'collection-changed', summary: 'Read the folder again.' } }),
  },
  {
    id: 'descriptor.both-forms',
    schema: 'interface-fragment.v1.schema.json',
    expect: 'valid',
    document: descriptor({ moved: { value: 'files-moved.v1', summary: 'Files the person moved.' } }, { removed: { value: 'record-removed', summary: 'Drop the record.' } }),
  },
  {
    id: 'descriptor.another-version',
    schema: 'interface-fragment.v1.schema.json',
    expect: 'invalid',
    document: descriptor({ moved: { value: 'files-moved.v2', summary: 'Files the person moved.' } }, {}),
  },
];

// Page effects: a port answer's effect named either way is published on the
// same output of sf-page-host with the same checked value.
export const VALUE_TYPE_NAME_EFFECTS = [
  { type: 'record-changed', value: { collection: 'news', id: 5, revision: 'r2', fields: ['title'] } },
  { type: 'record-removed', value: { collection: 'news', id: 'a-1' } },
  { type: 'collection-changed', value: { collection: 'files', reason: 'imported' } },
  { type: 'files-moved', value: { ids: [1, 'b'], from: null, to: 'f-2' } },
  { type: 'counter', value: { key: 'notifications', value: 3 } },
  { type: 'navigation', value: { url: '/admin/files?folder=2', region: 'content' } },
  { type: 'preference-changed', value: { key: 'sf-table/news' } },
];

export default VALUE_TYPE_NAME_CASES;

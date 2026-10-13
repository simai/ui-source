// Conformance case sources for generic cross-composite routing. A product
// type is bound to published element ports through the registry only; the
// Document never names methods, endpoints, actions or transformations.
export const ROUTING_TYPES = [
  {
    schema: 'simai.composition.type-manifest.v1',
    type: 'example.records',
    version: '1.0.0',
    category: 'smart',
    mode: 'leaf',
    profiles: ['ui-layout'],
    data_schema: { type: 'object', additionalProperties: false, properties: {} },
    props_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        'aria-label': { type: 'string', minLength: 1, maxLength: 120 },
        'table-settings-key': { type: 'string', minLength: 1, maxLength: 120 },
      },
    },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'custom-element', name: 'sf-table' },
    assets: ['smart/table'],
    capabilities: ['html', 'hydration'],
  },
  {
    schema: 'simai.composition.type-manifest.v1',
    type: 'example.product-list',
    version: '1.0.0',
    category: 'smart',
    mode: 'leaf',
    profiles: ['ui-layout'],
    data_schema: { type: 'object', additionalProperties: false, properties: {} },
    props_schema: { type: 'object', additionalProperties: false, properties: {} },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'registered', name: 'example.product-list' },
    assets: [],
    capabilities: ['html', 'hydration'],
  },
];

export const ROUTING_PORT_BINDINGS = { 'example.product-list': 'sf-table' };

// A product renderer for a bound type must put data-sf-endpoint on the element
// that implements the published ports; nothing else is prescribed.
export const ROUTING_RENDERERS = {
  'example.product-list': ({ endpoint }) => `<sf-table aria-label="Товары" table-settings-key="example.products"${endpoint ? ` data-sf-endpoint="${endpoint}"` : ''}></sf-table>`,
};

const list = (id, endpoint, label) => ({
  id,
  type: 'example.records',
  props: { 'aria-label': label, 'table-settings-key': `example.${id}` },
  ...(endpoint ? { extensions: { 'simai.composition:endpoint': { name: endpoint } } } : {}),
});
const route = (id, from, to, fromPort = 'selection', toPort = 'context') => ({ id, from: { endpoint: from, port: fromPort }, to: { endpoint: to, port: toPort } });
const scope = (id, routes, children) => ({ id, type: 'layout.scope', props: { routes }, slots: { default: children } });
const documentOf = (root) => ({ schema: 'simai.composition.document.v1', id: 'routing-case', profile: 'ui-layout', root });
const master = () => scope('orders-scope', [route('order-lines', 'orders', 'lines')], [list('orders', 'orders', 'Заказы'), list('lines', 'lines', 'Строки заказа')]);
const mutate = (update) => { const root = master(); update(root); return documentOf(root); };

export const ROUTING_CASES = [
  { id: 'positive.master-detail', expect: 'valid', document: documentOf(master()) },
  {
    id: 'positive.chain-and-fan-out',
    expect: 'valid',
    document: documentOf(scope('chain', [route('a-b', 'a', 'b'), route('b-c', 'b', 'c'), route('a-d', 'a', 'd')],
      [list('a', 'a', 'A'), list('b', 'b', 'B'), list('c', 'c', 'C'), list('d', 'd', 'D')])),
  },
  {
    id: 'positive.endpoints-inside-regions',
    expect: 'valid',
    document: documentOf(scope('shell-scope', [route('pick', 'orders', 'lines')], [{
      id: 'shell', type: 'layout.regions', slots: { regions: [
        { id: 'r-list', type: 'layout.region', props: { name: 'list', landmark: 'region', label: 'Список', placement: 'center' }, slots: { default: [list('orders', 'orders', 'Заказы')] } },
        { id: 'r-detail', type: 'layout.region', props: { name: 'detail', landmark: 'complementary', label: 'Детали', placement: 'end' }, slots: { default: [list('lines', 'lines', 'Строки')] } },
      ] },
    }])),
  },
  {
    id: 'positive.nested-scopes-are-encapsulated',
    expect: 'valid',
    document: documentOf(scope('outer', [route('outer-route', 'orders', 'lines')], [
      list('orders', 'orders', 'Заказы'),
      list('lines', 'lines', 'Строки'),
      scope('inner', [route('inner-route', 'orders', 'lines')], [list('inner-orders', 'orders', 'Внутренние заказы'), list('inner-lines', 'lines', 'Внутренние строки')]),
    ])),
  },
  {
    id: 'positive.product-type-bound-to-published-ports',
    expect: 'valid',
    document: documentOf(scope('bound', [route('bound-route', 'products', 'lines')], [
      { id: 'products', type: 'example.product-list', extensions: { 'simai.composition:endpoint': { name: 'products' } } },
      list('lines', 'lines', 'Строки'),
    ])),
  },
  { id: 'negative.unknown-endpoint', expect: 'invalid', document: mutate((root) => { root.props.routes[0].to.endpoint = 'missing'; }) },
  { id: 'negative.unknown-port', expect: 'invalid', document: mutate((root) => { root.props.routes[0].from.port = 'rows'; }) },
  { id: 'negative.wrong-direction', expect: 'invalid', document: mutate((root) => { root.props.routes[0].from.port = 'context'; }) },
  { id: 'negative.self-route', expect: 'invalid', document: mutate((root) => { root.props.routes[0].to.endpoint = 'orders'; }) },
  {
    id: 'negative.cycle',
    expect: 'invalid',
    document: mutate((root) => { root.props.routes.push(route('back', 'lines', 'orders')); }),
  },
  {
    id: 'negative.input-conflict',
    expect: 'invalid',
    document: mutate((root) => {
      root.slots.default.push(list('customers', 'customers', 'Клиенты'));
      root.props.routes.push(route('second', 'customers', 'lines'));
    }),
  },
  { id: 'negative.duplicate-route-id', expect: 'invalid', document: mutate((root) => {
    root.slots.default.push(list('extra', 'extra', 'Ещё'));
    root.props.routes.push(route('order-lines', 'orders', 'extra'));
  }) },
  { id: 'negative.duplicate-endpoint', expect: 'invalid', document: mutate((root) => { root.slots.default[1].extensions['simai.composition:endpoint'].name = 'orders'; }) },
  { id: 'negative.invalid-endpoint-extension', expect: 'invalid', document: mutate((root) => { root.slots.default[1].extensions['simai.composition:endpoint'] = { name: 'lines', method: 'reload' }; }) },
  { id: 'negative.endpoint-inside-nested-scope', expect: 'invalid', document: mutate((root) => {
    const lines = root.slots.default.pop();
    root.slots.default.push(scope('inner', [route('inner', 'x', 'lines')], [list('x', 'x', 'X'), lines]));
  }) },
  { id: 'negative.unported-type', expect: 'invalid', document: mutate((root) => {
    root.slots.default.push({ id: 'text', type: 'content.paragraph', data: { content: [] }, extensions: { 'simai.composition:endpoint': { name: 'text' } } });
    root.props.routes[0].to.endpoint = 'text';
  }) },
  { id: 'negative.arbitrary-action-field', expect: 'invalid', document: mutate((root) => { root.props.routes[0].action = 'delete'; }) },
  { id: 'negative.endpoint-url-field', expect: 'invalid', document: mutate((root) => { root.props.routes[0].to.endpoint_url = '/api/lines'; }) },
  { id: 'negative.executable-field', expect: 'invalid', document: mutate((root) => { root.props.routes[0].to.handler = 'reload()'; }) },
  { id: 'negative.query-field', expect: 'invalid', document: mutate((root) => { root.props.query = 'select * from lines'; }) },
  { id: 'negative.empty-routes', expect: 'invalid', document: mutate((root) => { root.props.routes = []; }) },
  {
    id: 'negative.route-limit',
    expect: 'invalid',
    document: documentOf(scope('many', Array.from({ length: 33 }, (_, index) => route(`r-${index}`, 'a', `t-${index}`)),
      [list('a', 'a', 'A'), ...Array.from({ length: 33 }, (_, index) => list(`t-${index}`, `t-${index}`, `T${index}`))])),
  },
  {
    id: 'negative.fan-out-limit',
    expect: 'invalid',
    document: documentOf(scope('fan', Array.from({ length: 9 }, (_, index) => route(`f-${index}`, 'a', `t-${index}`)),
      [list('a', 'a', 'A'), ...Array.from({ length: 9 }, (_, index) => list(`t-${index}`, `t-${index}`, `T${index}`))])),
  },
  {
    id: 'negative.scope-nesting-limit',
    expect: 'invalid',
    document: (() => {
      let inner = scope('s-5', [route('r', 'a', 'b')], [list('a-5', 'a', 'A'), list('b-5', 'b', 'B')]);
      for (let level = 4; level >= 1; level -= 1) inner = scope(`s-${level}`, [route('r', 'a', 'b')], [list(`a-${level}`, 'a', 'A'), list(`b-${level}`, 'b', 'B'), inner]);
      return documentOf(inner);
    })(),
  },
  { id: 'negative.unknown-type', expect: 'invalid', document: mutate((root) => { root.slots.default[0].type = 'example.unknown'; }) },
  { id: 'negative.prototype-port-name', expect: 'invalid', document: mutate((root) => { root.props.routes[0].from.port = 'constructor'; root.props.routes[0].to.port = 'constructor'; }) },
  { id: 'negative.endpoint-extension-outside-scope', expect: 'invalid', document: documentOf({ id: 'page', type: 'layout.section', slots: { default: [{ ...list('orphan', null, 'Сирота'), extensions: { 'simai.composition:endpoint': { name: { value: 'x' }, extra: 1 } } }] } }) },
  { id: 'negative.endpoint-extension-on-scope', expect: 'invalid', document: mutate((root) => { root.extensions = { 'simai.composition:endpoint': 'scope' }; }) },
];

export default ROUTING_CASES;

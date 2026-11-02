import { inlineComponentSchemas } from './inline-model.mjs';
import { REGION_ACCEPTS, REGION_LANDMARKS, REGION_PLACEMENTS } from './regions.mjs';
import { schemaFields } from './schema-name.mjs';

// Text runs, links of text runs, and since content.heading and
// content.paragraph 1.1.0 the inline component atoms: one shape per declared
// name, never inside a link and without marks.
const inlineContentSchema = {
  type: 'array',
  items: {
    oneOf: [
      {
        type: 'object',
        required: ['type', 'value'],
        additionalProperties: false,
        properties: {
          type: { const: 'text' },
          value: { type: 'string', maxLength: 100000 },
          marks: {
            type: 'array',
            uniqueItems: true,
            items: { enum: ['strong', 'em', 'code'] },
          },
        },
      },
      {
        type: 'object',
        required: ['type', 'href', 'children'],
        additionalProperties: false,
        properties: {
          type: { const: 'link' },
          href: { type: 'string', minLength: 1, maxLength: 2048 },
          children: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['type', 'value'],
              additionalProperties: false,
              properties: {
                type: { const: 'text' },
                value: { type: 'string', maxLength: 100000 },
                marks: {
                  type: 'array',
                  uniqueItems: true,
                  items: { enum: ['strong', 'em', 'code'] },
                },
              },
            },
          },
        },
      },
      ...inlineComponentSchemas(),
    ],
  },
};

const routeEnd = {
          type: 'object',
          required: ['endpoint', 'port'],
          additionalProperties: false,
          properties: {
            endpoint: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' },
            port: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' },
          },
        };

const emptyObjectSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

// The first edition of the structured-content types (owner's decision
// 2026-10-31, the content standard's step 3). Where a SIMAI Framework
// component already has a word, the type uses it (content.alert takes status
// and appearance as sf-alert does); elsewhere Docara's parameter names stand
// (details open and layout, figure ratio and fit, code lang and title, steps
// current and layout, grid columns and gap, card variant, media side and
// ratio). A type's renderer draws the existing display parts; card, figure
// and the numbered procedure are CSS components of their own.

// The blocks a content container holds: any content type, or a Smart type.
// The item types (content.list-item, content.tab, content.step) are content
// too; Document validation keeps each inside its own parent.
const contentSlot = (min, max) => ({ min, max, categories: ['content', 'smart'] });
const contentManifest = (type, fields) => ({
  ...schemaFields('simai.composition.type-manifest', 1),
  type,
  version: '1.0.0',
  category: 'content',
  profiles: ['ui-layout', 'structured-content'],
  data_schema: emptyObjectSchema,
  props_schema: emptyObjectSchema,
  presentation: { views: ['default'], presets: [], modifiers: [] },
  slots: {},
  renderer: { kind: 'builtin', name: type },
  assets: [],
  capabilities: ['html'],
  ...fields,
});
const closed = (properties, required = []) => ({
  type: 'object',
  ...(required.length ? { required } : {}),
  additionalProperties: false,
  properties,
});
// A link target or an image source: the Document's URL rule (relative, a
// fragment, http(s), mailto, tel) is applied by validate on top of this.
const urlSchema = { type: 'string', minLength: 1, maxLength: 2048 };
const plainText = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const sourceText = { type: 'string', maxLength: 200000 };
const imageData = {
  src: urlSchema,
  // The empty text marks an image that only decorates.
  alt: { type: 'string', maxLength: 1000 },
  width: { type: 'integer', minimum: 1, maximum: 100000 },
  height: { type: 'integer', minimum: 1, maximum: 100000 },
};
export const CONTENT_RATIOS = Object.freeze(['1/1', '4/3', '3/2', '16/9', '21/9']);
export const CONTENT_ALERT_STATUSES = Object.freeze(['neutral', 'info', 'success', 'warning', 'error']);
export const CONTENT_ALERT_APPEARANCES = Object.freeze(['default', 'outlined', 'flat']);
// A media type in its lowercase form: type/subtype, no parameters.
export const CONTENT_FILE_MIME = '^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$';
export const CONTENT_TABLE_HEADERS = Object.freeze(['row', 'column', 'both', 'none']);
// Which parent an item type stands in; validate reports any other place.
export const CONTENT_ITEM_PARENTS = Object.freeze({
  'content.list-item': 'content.list',
  'content.tab': 'content.tabs',
  'content.step': 'content.steps',
});

export const BUILTIN_TYPE_MANIFESTS = Object.freeze([
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.page',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: emptyObjectSchema,
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {
      default: { min: 0, max: 500, categories: ['layout', 'content', 'smart'] },
    },
    renderer: { kind: 'builtin', name: 'layout.page' },
    assets: [],
    capabilities: ['html'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.section',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: emptyObjectSchema,
    presentation: {
      views: ['default'],
      presets: ['surface', 'contrast'],
      modifiers: ['contained', 'spacious'],
    },
    slots: {
      default: { min: 0, max: 500, categories: ['layout', 'content', 'smart'] },
    },
    renderer: { kind: 'builtin', name: 'layout.section' },
    assets: [],
    capabilities: ['html'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.columns',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        columns: { type: 'integer', minimum: 1, maximum: 12 },
      },
    },
    presentation: { views: ['default'], presets: [], modifiers: ['equal', 'responsive'] },
    slots: {
      columns: { min: 1, max: 12, categories: ['layout', 'content', 'smart'] },
    },
    renderer: { kind: 'builtin', name: 'layout.columns' },
    assets: ['composition/layout'],
    capabilities: ['html'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'content.heading',
    version: '1.1.0',
    category: 'content',
    mode: 'leaf',
    profiles: ['ui-layout', 'structured-content'],
    data_schema: {
      type: 'object',
      required: ['content'],
      additionalProperties: false,
      properties: {
        level: { type: 'integer', minimum: 1, maximum: 6 },
        content: inlineContentSchema,
      },
    },
    props_schema: emptyObjectSchema,
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'builtin', name: 'content.heading' },
    assets: [],
    capabilities: ['html', 'rich-text'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'content.paragraph',
    version: '1.1.0',
    category: 'content',
    mode: 'leaf',
    profiles: ['ui-layout', 'structured-content'],
    data_schema: {
      type: 'object',
      required: ['content'],
      additionalProperties: false,
      properties: { content: inlineContentSchema },
    },
    props_schema: emptyObjectSchema,
    presentation: { views: ['default'], presets: [], modifiers: ['lead', 'muted'] },
    slots: {},
    renderer: { kind: 'builtin', name: 'content.paragraph' },
    assets: [],
    capabilities: ['html', 'rich-text'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.regions',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: emptyObjectSchema,
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {
      regions: { min: 1, max: 12, types: ['layout.region'] },
    },
    renderer: { kind: 'builtin', name: 'layout.regions' },
    assets: [],
    capabilities: ['html', 'regions'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.region',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: {
      type: 'object',
      required: ['name', 'landmark'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,31}$' },
        landmark: { enum: [...REGION_LANDMARKS] },
        placement: { enum: [...REGION_PLACEMENTS] },
        label: { type: 'string', minLength: 1, maxLength: 120 },
        sticky: { type: 'boolean' },
        accepts: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: [...REGION_ACCEPTS] } },
        min_items: { type: 'integer', minimum: 0, maximum: 500 },
        max_items: { type: 'integer', minimum: 0, maximum: 500 },
      },
    },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {
      default: { min: 0, max: 500, categories: ['layout', 'content', 'smart'] },
    },
    renderer: { kind: 'builtin', name: 'layout.region' },
    assets: [],
    capabilities: ['html', 'regions'],
  },  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.scope',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: {
      type: 'object',
      required: ['routes'],
      additionalProperties: false,
      properties: {
        routes: {
          type: 'array',
          minItems: 1,
          maxItems: 32,
          items: {
            type: 'object',
            required: ['id', 'from', 'to'],
            additionalProperties: false,
            properties: {
              id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
              from: routeEnd,
              to: routeEnd,
            },
          },
        },
      },
    },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {
      default: { min: 1, max: 500, categories: ['layout', 'content', 'smart'] },
    },
    renderer: { kind: 'builtin', name: 'layout.scope' },
    assets: [],
    capabilities: ['html', 'hydration', 'routing'],
  },
  // The root of a structured-content Document: the page's blocks in order,
  // under the page's title (the accepted content editor prototype writes
  // this root).
  contentManifest('content.document', {
    mode: 'composite',
    profiles: ['structured-content'],
    data_schema: closed({ title: { type: 'string', maxLength: 300 } }),
    slots: { default: contentSlot(0, 500) },
  }),
  contentManifest('content.list', {
    mode: 'composite',
    props_schema: closed({
      ordered: { type: 'boolean' },
      start: { type: 'integer', minimum: 1, maximum: 1000000 },
    }),
    slots: { items: { min: 1, max: 500, types: ['content.list-item'] } },
  }),
  contentManifest('content.list-item', {
    mode: 'composite',
    data_schema: closed({ content: inlineContentSchema }, ['content']),
    // A nested list, or more paragraphs and code under the item's own line.
    slots: { default: contentSlot(0, 50) },
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.quote', {
    mode: 'composite',
    slots: { default: contentSlot(1, 100) },
  }),
  contentManifest('content.code', {
    mode: 'leaf',
    data_schema: closed({ code: sourceText }, ['code']),
    props_schema: closed({
      lang: { type: 'string', pattern: '^[a-z0-9][a-z0-9+#._-]{0,31}$' },
      title: plainText(200),
      numbers: { type: 'boolean' },
    }),
    assets: ['component/highlight'],
  }),
  contentManifest('content.divider', {
    mode: 'leaf',
    assets: ['component/contentDivider'],
  }),
  contentManifest('content.table', {
    mode: 'leaf',
    data_schema: closed({
      caption: inlineContentSchema,
      rows: {
        type: 'array',
        minItems: 1,
        maxItems: 1000,
        items: { type: 'array', minItems: 1, maxItems: 50, items: inlineContentSchema },
      },
    }, ['rows']),
    props_schema: closed({
      header: { enum: [...CONTENT_TABLE_HEADERS] },
      align: { type: 'array', maxItems: 50, items: { enum: ['start', 'center', 'end'] } },
    }),
    assets: ['utility/table-frame'],
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.figure', {
    mode: 'leaf',
    data_schema: closed({ ...imageData, caption: inlineContentSchema }, ['src', 'alt']),
    props_schema: closed({
      ratio: { enum: ['auto', ...CONTENT_RATIOS] },
      fit: { enum: ['cover', 'contain'] },
    }),
    assets: ['component/figure'],
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.alert', {
    mode: 'composite',
    data_schema: closed({ title: inlineContentSchema }),
    props_schema: closed({
      status: { enum: [...CONTENT_ALERT_STATUSES] },
      appearance: { enum: [...CONTENT_ALERT_APPEARANCES] },
    }),
    slots: { default: contentSlot(0, 100) },
    assets: ['component/alerts'],
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.details', {
    mode: 'composite',
    data_schema: closed({ summary: inlineContentSchema }, ['summary']),
    props_schema: closed({
      open: { type: 'boolean' },
      layout: { enum: ['surface', 'lines'] },
    }),
    slots: { default: contentSlot(0, 100) },
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.tabs', {
    mode: 'composite',
    // The accessible name of the row of tabs.
    data_schema: closed({ label: plainText(120) }),
    slots: { tabs: { min: 1, max: 20, types: ['content.tab'] } },
    assets: ['component/tabs'],
  }),
  contentManifest('content.tab', {
    mode: 'composite',
    data_schema: closed({ label: plainText(120) }, ['label']),
    slots: { default: contentSlot(0, 100) },
  }),
  contentManifest('content.steps', {
    mode: 'composite',
    props_schema: closed({
      current: { type: 'integer', minimum: 1, maximum: 100 },
      layout: { enum: ['timeline', 'list'] },
    }),
    slots: { steps: { min: 1, max: 100, types: ['content.step'] } },
    assets: ['component/procedure'],
  }),
  contentManifest('content.step', {
    mode: 'composite',
    data_schema: closed({ title: inlineContentSchema }),
    slots: { default: contentSlot(0, 100) },
    capabilities: ['html', 'rich-text'],
  }),
  contentManifest('content.grid', {
    mode: 'composite',
    props_schema: closed({
      columns: { type: 'integer', minimum: 1, maximum: 4 },
      gap: { type: 'integer', minimum: 0, maximum: 4 },
    }),
    slots: { default: contentSlot(1, 48) },
  }),
  contentManifest('content.card', {
    mode: 'composite',
    props_schema: closed({ variant: { enum: ['default', 'plain'] } }),
    slots: { default: contentSlot(0, 100) },
    assets: ['component/card'],
  }),
  contentManifest('content.media', {
    mode: 'composite',
    data_schema: closed({ ...imageData }, ['src', 'alt']),
    props_schema: closed({
      side: { enum: ['left', 'right'] },
      ratio: { enum: [...CONTENT_RATIOS] },
    }),
    slots: { default: contentSlot(0, 100) },
    assets: ['component/figure'],
  }),
  // A file to download, not to play in the page (content.media plays). Its
  // data is the shape the SIMAI Framework already uses for a stored file (the
  // property-view file type, sf-image-field's value): value the host's
  // reference, href the address it is fetched from, label the name shown
  // (else the address's last part), mime and size in bytes, both optional.
  // The renderer draws sf-download-file's row as a plain <a download>.
  contentManifest('content.file', {
    mode: 'leaf',
    data_schema: closed({
      value: { type: 'string', minLength: 1, maxLength: 2048 },
      href: urlSchema,
      label: plainText(300),
      mime: { type: 'string', maxLength: 255, pattern: CONTENT_FILE_MIME },
      size: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    }, ['href']),
    assets: ['component/download-file'],
  }),
  // The escape hatch: markup in the html@1 subset of sf-rich-text, cleaned at
  // render by that subset's one rule. The key is not "html": that word is
  // refused anywhere in a Document.
  contentManifest('content.html', {
    mode: 'leaf',
    data_schema: closed({ markup: sourceText }, ['markup']),
  }),
  // Diagram and math draw with a runtime the SIMAI Framework does not carry
  // (a diagram engine, a TeX typesetter). They are registered types whose
  // renderer a host supplies -- createRegistry(manifests, {'content.diagram':
  // render}) -- and whose assets it loads on demand; without one, render
  // reports renderer_unavailable for the node.
  contentManifest('content.diagram', {
    mode: 'leaf',
    data_schema: closed({ source: sourceText }, ['source']),
    props_schema: closed({
      engine: { enum: ['mermaid'] },
      title: plainText(200),
    }),
    renderer: { kind: 'registered', name: 'content.diagram' },
    assets: ['composition/diagram'],
  }),
  contentManifest('content.math', {
    mode: 'leaf',
    data_schema: closed({ source: sourceText }, ['source']),
    props_schema: closed({ label: plainText(200) }),
    renderer: { kind: 'registered', name: 'content.math' },
    assets: ['composition/math'],
  }),
  // Where a layout puts the page's content: a layout document holds one, and
  // render(layout, {content: document}) draws the structured-content document
  // in its place. layout.region names an area whose nodes are the layout's
  // own; nothing in it stands for a document that comes from elsewhere.
  contentManifest('content.outlet', {
    mode: 'leaf',
    profiles: ['ui-layout'],
  }),
]);

// Published typed ports. Framework owns the element protocol; the product owns
// what a request means, data access and authorization.
//
// sf-table answers this port and lives in the SIMAI Framework Pro package since
// 2026-10-11 (the component folder in simai/ui-pro, package pro). The port stays
// here: it is a public contract of the free Framework (composition-ports.v1.json,
// the routing contract lock), and the package's tests read it from this file in
// their overlay of ui-source.
export const BUILTIN_PORT_MANIFESTS = Object.freeze([
  {
    ...schemaFields('simai.composition.port-manifest', 1),
    element: 'sf-table',
    version: '1.0.0',
    component: 'smart.data-view',
    component_version: '1.2.0',
    outputs: {
      selection: {
        value: 'record-ids.v1',
        summary: 'Explicit current-result selection of this instance, emitted once per change, including clearing.',
      },
    },
    inputs: {
      context: {
        value: 'record-ids.v1',
        effect: 'request',
        summary: 'Restricts this collection to records related to the given identities. The table clears its selection, enters loading and emits sf-table-query-intent with the route sequence; the host resolves the relation and access and answers with applyQueryResult.',
        request_event: 'sf-table-query-intent',
        result_method: 'applyQueryResult',
      },
    },
  },
]);



// One editor field of a first-edition content type: the label and help keys
// follow the type and the key, the owner is the SIMAI Framework.
const contentField = (type, key, plane, kind, fields) => {
  const name = type.replace('content.', 'content_').replaceAll('-', '_');
  const property = kind === 'choice' || kind === 'text' ? { type: 'string', version: 2 }
    : kind === 'integer' ? { type: 'integer', version: 1 } : { type: 'boolean', version: 1 };
  return {
    key,
    plane,
    target: key,
    property,
    constraints: kind === 'toggle' ? {} : kind === 'choice' ? { min_length: 1, max_length: 16 } : {},
    group: 'basic',
    visibility: 'visible',
    label_key: `sf.composition.${name}.${key}`,
    help_key: `sf.composition.${name}.${key}_help`,
    capability_hints: [`composition.${plane}.${key}`],
    permission_hints: ['composition.node.update'],
    owner: 'simai/framework',
    ...fields,
  };
};
const contentEditor = (type, fields) => ({
  ...schemaFields('simai.composition.editor-manifest', 1),
  type,
  type_version: '1.0.0',
  fields,
});
const advanced = { group: 'advanced', visibility: 'collapsed' };

export const BUILTIN_EDITOR_MANIFESTS = Object.freeze([
  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'layout.section',
    type_version: '1.0.0',
    fields: [
      {
        key: 'surface',
        plane: 'presentation',
        target: 'preset',
        property: { type: 'string', version: 2 },
        constraints: { min_length: 1, max_length: 32 },
        group: 'preset',
        visibility: 'visible',
        choices: ['surface', 'contrast'],
        default: 'surface',
        label_key: 'sf.composition.layout_section.surface',
        help_key: 'sf.composition.layout_section.surface_help',
        capability_hints: ['composition.presentation.preset'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
    ],
  },
  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'layout.columns',
    type_version: '1.0.0',
    fields: [
      {
        key: 'columns',
        plane: 'props',
        target: 'columns',
        property: { type: 'integer', version: 1 },
        constraints: { min: 1, max: 12 },
        group: 'basic',
        visibility: 'visible',
        default: 2,
        label_key: 'sf.composition.layout_columns.columns',
        help_key: 'sf.composition.layout_columns.columns_help',
        capability_hints: ['composition.props.columns'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
    ],
  },
  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'content.heading',
    type_version: '1.1.0',
    fields: [
      {
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
      },
    ],
  },  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'layout.region',
    type_version: '1.0.0',
    fields: [
      {
        key: 'placement',
        plane: 'props',
        target: 'placement',
        property: { type: 'string', version: 2 },
        constraints: { min_length: 1, max_length: 16 },
        group: 'basic',
        visibility: 'visible',
        choices: [...REGION_PLACEMENTS],
        default: 'block',
        label_key: 'sf.composition.layout_region.placement',
        help_key: 'sf.composition.layout_region.placement_help',
        capability_hints: ['composition.props.placement'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
      {
        key: 'label',
        plane: 'props',
        target: 'label',
        property: { type: 'string', version: 2 },
        constraints: { min_length: 1, max_length: 120 },
        group: 'basic',
        visibility: 'visible',
        label_key: 'sf.composition.layout_region.label',
        help_key: 'sf.composition.layout_region.label_help',
        capability_hints: ['composition.props.label'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
      {
        key: 'landmark',
        plane: 'props',
        target: 'landmark',
        property: { type: 'string', version: 2 },
        constraints: { min_length: 1, max_length: 16 },
        group: 'advanced',
        visibility: 'collapsed',
        choices: [...REGION_LANDMARKS],
        label_key: 'sf.composition.layout_region.landmark',
        help_key: 'sf.composition.layout_region.landmark_help',
        capability_hints: ['composition.props.landmark'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
      {
        key: 'sticky',
        plane: 'props',
        target: 'sticky',
        property: { type: 'boolean', version: 1 },
        constraints: {},
        group: 'advanced',
        visibility: 'collapsed',
        default: false,
        label_key: 'sf.composition.layout_region.sticky',
        help_key: 'sf.composition.layout_region.sticky_help',
        capability_hints: ['composition.props.sticky'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
    ],
  },
  contentEditor('content.list', [
    contentField('content.list', 'ordered', 'props', 'toggle', { default: false }),
    contentField('content.list', 'start', 'props', 'integer', { ...advanced, constraints: { min: 1, max: 1000000 }, default: 1 }),
  ]),
  contentEditor('content.code', [
    contentField('content.code', 'lang', 'props', 'text', { constraints: { min_length: 1, max_length: 32 }, default: 'text' }),
    contentField('content.code', 'title', 'props', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('content.code', 'numbers', 'props', 'toggle', { ...advanced, default: false }),
  ]),
  contentEditor('content.table', [
    contentField('content.table', 'header', 'props', 'choice', { choices: ['row', 'column', 'both', 'none'], default: 'row' }),
  ]),
  contentEditor('content.figure', [
    contentField('content.figure', 'alt', 'data', 'text', { constraints: { min_length: 1, max_length: 1000 } }),
    contentField('content.figure', 'ratio', 'props', 'choice', { choices: ['auto', '1/1', '4/3', '3/2', '16/9', '21/9'], default: 'auto' }),
    contentField('content.figure', 'fit', 'props', 'choice', { choices: ['cover', 'contain'], default: 'cover' }),
  ]),
  contentEditor('content.alert', [
    contentField('content.alert', 'status', 'props', 'choice', { choices: ['neutral', 'info', 'success', 'warning', 'error'], default: 'neutral' }),
    contentField('content.alert', 'appearance', 'props', 'choice', { choices: ['default', 'outlined', 'flat'], default: 'default' }),
  ]),
  contentEditor('content.details', [
    contentField('content.details', 'open', 'props', 'toggle', { default: false }),
    contentField('content.details', 'layout', 'props', 'choice', { choices: ['surface', 'lines'], default: 'surface' }),
  ]),
  contentEditor('content.tabs', [
    contentField('content.tabs', 'label', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 120 } }),
  ]),
  contentEditor('content.tab', [
    contentField('content.tab', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 120 } }),
  ]),
  contentEditor('content.steps', [
    contentField('content.steps', 'current', 'props', 'integer', { constraints: { min: 1, max: 100 } }),
    contentField('content.steps', 'layout', 'props', 'choice', { choices: ['timeline', 'list'], default: 'timeline' }),
  ]),
  contentEditor('content.grid', [
    contentField('content.grid', 'columns', 'props', 'integer', { constraints: { min: 1, max: 4 }, default: 3 }),
    contentField('content.grid', 'gap', 'props', 'integer', { ...advanced, constraints: { min: 0, max: 4 }, default: 2 }),
  ]),
  contentEditor('content.card', [
    contentField('content.card', 'variant', 'props', 'choice', { choices: ['default', 'plain'], default: 'default' }),
  ]),
  contentEditor('content.media', [
    contentField('content.media', 'alt', 'data', 'text', { constraints: { min_length: 1, max_length: 1000 } }),
    contentField('content.media', 'side', 'props', 'choice', { choices: ['left', 'right'], default: 'right' }),
    contentField('content.media', 'ratio', 'props', 'choice', { choices: ['1/1', '4/3', '3/2', '16/9', '21/9'], default: '16/9' }),
  ]),
  contentEditor('content.file', [
    contentField('content.file', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 300 } }),
    contentField('content.file', 'href', 'data', 'text', { constraints: { min_length: 1, max_length: 2048 } }),
  ]),
  contentEditor('content.diagram', [
    contentField('content.diagram', 'title', 'props', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('content.diagram', 'engine', 'props', 'choice', { ...advanced, choices: ['mermaid'], default: 'mermaid' }),
  ]),
  contentEditor('content.math', [
    contentField('content.math', 'label', 'props', 'text', { constraints: { min_length: 1, max_length: 200 } }),
  ]),
]);

export default BUILTIN_TYPE_MANIFESTS;

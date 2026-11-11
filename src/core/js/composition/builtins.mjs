import { INLINE_EXTENSION_KEY, inlineComponentSchemas } from './inline-model.mjs';
import { REGION_ACCEPTS, REGION_LANDMARKS, REGION_PLACEMENTS } from './regions.mjs';
import { schemaFields } from './schema-name.mjs';
import { parameterSetFields } from './parameter-sets.mjs';

const SECTION_SETS = Object.freeze(['background', 'spacing', 'width', 'grid', 'alignment', 'breakout', 'visibility']);
// A heading's and a paragraph's own parameters (2026-11-04): how the text lines
// up and on which screens it shows, per screen.
const TEXT_SETS = Object.freeze(['alignment', 'visibility']);
// What a section prints when the Document leaves it unset (layout.section
// 1.2.0, visual parity 2026-11-04, as the accepted prototype draws it): space
// above and below (p-y-8) and the page container (width normal: frame
// container m-inline-auto), so in the default theme no text touches the
// page's edge. A section that sets its own values keeps them.
const SECTION_DEFAULTS = Object.freeze({ width: 'normal', padding_y: 8 });
// A layout grid keeps its columns on every screen, as the accepted prototype's
// features and cards grids do on the phone (layout.grid 1.1.0, 2026-11-04;
// measured there at 380: three columns, gap 20, its gap m). A Document sets
// the phone's own value where one column is wanted.
const GRID_DEFAULTS = Object.freeze({ columns: 3, gap: 5 });
const CONTAINER_DEFAULTS = Object.freeze({ width: 'narrow' });
const catalogueWord = (type) => `sf.composition.catalogue.type.${type.replace('.', '_').replaceAll('-', '_')}`;
const variantWord = (type, id) => `sf.composition.catalogue.variant.${type.replace('.', '_').replaceAll('-', '_')}.${id.replaceAll('-', '_')}`;

// Text runs, links of text runs, and since content.heading and
// content.paragraph 1.1.0 the inline component atoms: one shape per declared
// name, never inside a link and without marks.
// Inline model 1.2.0 (2026-11-10): a soft line break {type: 'break', marks?}
// in every inline field and inside a link, and the mark strike.
export const CONTENT_FOREIGN_SOURCES = Object.freeze(['markdown', 'editorjs', 'html']);
const inlineMarksSchema = {
  type: 'array',
  uniqueItems: true,
  items: { enum: ['strong', 'em', 'code', 'strike'] },
};
const inlineTextSchema = {
  type: 'object',
  required: ['type', 'value'],
  additionalProperties: false,
  // Extension keys (a newer producer's lang, title, ...): kept by the inline model.
  patternProperties: { [INLINE_EXTENSION_KEY]: {} },
  properties: {
    type: { const: 'text' },
    value: { type: 'string', maxLength: 100000 },
    marks: inlineMarksSchema,
  },
};
const inlineBreakSchema = {
  type: 'object',
  required: ['type'],
  additionalProperties: false,
  patternProperties: { [INLINE_EXTENSION_KEY]: {} },
  properties: {
    type: { const: 'break' },
    marks: inlineMarksSchema,
  },
};
const inlineContentSchema = {
  type: 'array',
  items: {
    oneOf: [
      inlineTextSchema,
      inlineBreakSchema,
      {
        type: 'object',
        required: ['type', 'href', 'children'],
        additionalProperties: false,
        patternProperties: { [INLINE_EXTENSION_KEY]: {} },
        properties: {
          type: { const: 'link' },
          href: { type: 'string', minLength: 1, maxLength: 2048 },
          children: {
            type: 'array',
            minItems: 1,
            items: { oneOf: [inlineTextSchema, inlineBreakSchema] },
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

// A SIMAI Framework icon name (Material Symbols): what sf-icon draws.
const iconName = { type: 'string', pattern: '^[a-z0-9][a-z0-9_]{0,63}$' };
// What a form field submits under: a form control name.
const fieldName = { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_.\\[\\]-]{0,63}$' };
// A layout type of the one block editor: a ui-layout block with parameter sets.
const layoutManifest = (type, fields) => ({
  ...schemaFields('simai.composition.type-manifest', 1),
  type,
  version: '1.0.0',
  category: 'layout',
  mode: 'composite',
  profiles: ['ui-layout'],
  data_schema: emptyObjectSchema,
  props_schema: emptyObjectSchema,
  presentation: { views: ['default'], presets: [], modifiers: [] },
  renderer: { kind: 'builtin', name: type },
  assets: [],
  capabilities: ['html'],
  ...fields,
});
// An element type: one smart element, printed from its inputs.
const elementManifest = (type, asset, fields) => ({
  ...schemaFields('simai.composition.type-manifest', 1),
  type,
  version: '1.0.0',
  category: 'smart',
  mode: 'leaf',
  profiles: ['ui-layout'],
  presentation: { views: ['default'], presets: [], modifiers: [] },
  slots: {},
  renderer: { kind: 'builtin', name: type },
  assets: [asset],
  capabilities: ['html'],
  ...fields,
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
    // 1.1.0 (2026-11-03): the parameter sets of the one block editor --
    // background, spacing, width, columns, alignment, edge to edge and
    // visibility, all SIMAI Framework utilities (parameter-sets.mjs).
    // 1.2.0 (2026-11-04): the section prints its spacing and width by default
    // (parameter_defaults: p-y-8, the page container), and offers variants.
    // A Document that sets them keeps its own values.
    // 1.3.0 (2026-11-04): the accent variant is the primary role's own fill
    // with on-primary text (background accent), as the prototype draws it,
    // not the primary container's light tint.
    version: '1.3.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: emptyObjectSchema,
    parameter_sets: SECTION_SETS,
    parameter_defaults: SECTION_DEFAULTS,
    variants: [
      { id: 'plain', label_key: variantWord('layout.section', 'plain') },
      { id: 'soft', label_key: variantWord('layout.section', 'soft'), props: { background: 'container' } },
      { id: 'accent', label_key: variantWord('layout.section', 'accent'), props: { background: 'accent' } },
      { id: 'text', label_key: variantWord('layout.section', 'text'), props: { width: 'narrow' }, slots: { default: [{ id: 'area', type: 'layout.area' }] } },
      { id: 'two-columns', label_key: variantWord('layout.section', 'two-columns'), props: { columns: { xs: 1, md: 2 }, gap: 6 } },
    ],
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
    // 1.1.0: columns and gap take a value per screen and print SIMAI Framework
    // grid utilities (one block editor, owner 2026-11-03); a 1.0.0 value (one
    // integer for every screen, no gap) stays valid.
    version: '1.1.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        columns: { type: 'integer', minimum: 1, maximum: 12, default: 1, 'x-simai-utility': { class: 'grid-col-{value}', responsive: true } },
        gap: { type: 'integer', minimum: 0, maximum: 8, 'x-simai-utility': { class: 'gap-{value}', responsive: true } },
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
    // 1.2.0 (2026-11-04, visual parity): alignment and visibility per screen,
    // the SIMAI Framework sets a section takes (text-*, hidden/block).
    // 1.3.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
    version: '1.3.0',
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
    parameter_sets: TEXT_SETS,
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'builtin', name: 'content.heading' },
    assets: [],
    capabilities: ['html', 'rich-text'],
  },
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'content.paragraph',
    // 1.3.0 (2026-11-04): alignment and visibility per screen, as the heading.
    // 1.4.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
    version: '1.4.0',
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
    parameter_sets: TEXT_SETS,
    // G-39 (1.2.0): the prototype's lead is 19/30 px in the variant ink; the
    // SIMAI Framework's large body text role (20/28 px, 16/24 on the phone) in
    // on-surface-variant. Muted is the variant ink alone.
    presentation: { views: ['default'], presets: [], modifiers: ['lead', 'muted'], modifier_utilities: { lead: ['text-large', 'color-on-surface-variant'], muted: ['color-on-surface-variant'] } },
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
  // A text area of a layout (one block editor, owner 2026-11-03): where an
  // author writes. A page may hold several; the rest of the layout is the
  // designer's, and the host grants the rights. Its padding and visibility are
  // SIMAI Framework utilities per screen (x-simai-utility, utilities.mjs),
  // never inline styles.
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'layout.area',
    version: '1.0.0',
    category: 'layout',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: emptyObjectSchema,
    props_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        padding: { type: 'integer', minimum: 0, maximum: 8, 'x-simai-utility': { class: 'p-{value}', responsive: true } },
        hidden: { type: 'boolean', default: false, 'x-simai-utility': { values: { true: 'hidden', false: 'block' }, responsive: true } },
      },
    },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {
      default: { min: 0, max: 500, categories: ['content', 'smart'], label_key: 'sf.composition.layout_area.content', empty_key: 'sf.composition.layout_area.empty' },
    },
    renderer: { kind: 'builtin', name: 'layout.area' },
    assets: [],
    capabilities: ['html', 'content-area'],
  },
  // Layout types of the one block editor (visual parity, 2026-11-04; G-21):
  // a container that holds part of a section in its own width, a grid of
  // equal cells, and an empty space. Each prints SIMAI Framework utilities
  // only, through its parameter sets and props.
  layoutManifest('layout.container', {
    parameter_sets: ['width', 'spacing', 'background', 'visibility'],
    parameter_defaults: CONTAINER_DEFAULTS,
    slots: { default: { min: 0, max: 500, categories: ['layout', 'content', 'smart'] } },
    catalogue: { group: 'layout', icon: 'width_normal', label_key: catalogueWord('layout.container'), keywords: { en: ['container', 'width', 'wrapper'], ru: ['контейнер', 'ширина', 'обёртка'] }, order: 140 },
    variants: [
      { id: 'narrow', label_key: variantWord('layout.container', 'narrow') },
      { id: 'normal', label_key: variantWord('layout.container', 'normal'), props: { width: 'normal' } },
      { id: 'soft', label_key: variantWord('layout.container', 'soft'), props: { background: 'container', padding_y: 4, padding_x: 4 } },
    ],
  }),
  layoutManifest('layout.grid', {
    // 1.1.0 (2026-11-04): its columns hold on the phone (three, gap 5), and
    // its card variants keep theirs, as the prototype draws them at 380.
    version: '1.1.0',
    parameter_sets: ['grid', 'visibility'],
    parameter_defaults: GRID_DEFAULTS,
    slots: { default: { min: 0, max: 48, categories: ['layout', 'content', 'smart'] } },
    catalogue: { group: 'layout', icon: 'grid_on', label_key: catalogueWord('layout.grid'), keywords: { en: ['grid', 'tiles', 'gallery', 'cells'], ru: ['сетка', 'плитка', 'галерея', 'ячейки'] }, order: 150 },
    variants: [2, 3, 4].map((count) => ({
      id: `cards-${count}`,
      label_key: variantWord('layout.grid', `cards-${count}`),
      props: { columns: count },
      slots: { default: Array.from({ length: count }, (_, index) => ({ id: `card-${index + 1}`, type: 'content.card' })) },
    })),
  }),
  layoutManifest('layout.spacer', {
    mode: 'leaf',
    props_schema: closed({
      size: { type: 'integer', minimum: 1, maximum: 8, 'x-simai-utility': { class: 'p-top-{value}', responsive: true } },
    }),
    parameter_sets: ['visibility'],
    parameter_defaults: { size: 6 },
    slots: {},
    catalogue: { group: 'layout', icon: 'height', label_key: catalogueWord('layout.spacer'), keywords: { en: ['spacer', 'space', 'gap'], ru: ['пустое место', 'отступ', 'промежуток'] }, order: 160 },
  }),
  // Elements (visual parity, 2026-11-04; G-20): the smart elements a block
  // prints, each a type of its own so an author places it anywhere a block
  // goes. Its parameters are the element's inputs (smart.manifest.json, held
  // by elements.print); the type's defaults are the prototype's.
  elementManifest('element.button', 'smart/button', {
    // Unset, the button reads «Button» in the Document's language until the
    // author writes. With an address it is a link with the button's look
    // (sf-button 1.4.0 href); the Document's URL rule holds it.
    data_schema: closed({ text: plainText(200), href: urlSchema }),
    props_schema: closed({
      appearance: { enum: ['default', 'tonal', 'outline', 'link', 'surface'], default: 'default' },
      scheme: { enum: ['primary', 'secondary', 'on-surface', 'on-surface-variant'], default: 'primary' },
      size: { enum: ['1/2', '1', '2'], default: '1' },
      icon: iconName,
      icon_position: { enum: ['start', 'end'], default: 'start' },
    }),
    catalogue: { group: 'elements', icon: 'smart_button', label_key: catalogueWord('element.button'), keywords: { en: ['button', 'link', 'call to action', 'cta'], ru: ['кнопка', 'ссылка', 'призыв'] }, order: 100 },
    variants: [
      { id: 'plain', label_key: variantWord('element.button', 'plain') },
      { id: 'icon', label_key: variantWord('element.button', 'icon'), props: { icon: 'arrow_forward', icon_position: 'end' } },
      { id: 'outline', label_key: variantWord('element.button', 'outline'), props: { appearance: 'outline' } },
    ],
  }),
  elementManifest('element.button-icon', 'smart/button-icon', {
    // The label is what a screen reader says: an icon button has no words.
    // Unset, it says «Button» in the Document's language.
    data_schema: closed({ label: plainText(120) }),
    props_schema: closed({
      icon: { ...iconName, default: 'favorite' },
      appearance: { enum: ['default', 'tonal', 'outline', 'surface', 'ghost'], default: 'tonal' },
      scheme: { enum: ['primary', 'secondary', 'on-surface', 'on-surface-variant'], default: 'primary' },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'elements', icon: 'add_circle', label_key: catalogueWord('element.button-icon'), keywords: { en: ['icon button', 'icon', 'button'], ru: ['кнопка-значок', 'значок', 'иконка', 'кнопка'] }, order: 110 },
  }),
  elementManifest('element.badge', 'smart/badge', {
    data_schema: closed({ text: plainText(120) }),
    props_schema: closed({
      appearance: { enum: ['main', 'tonal', 'outline'], default: 'tonal' },
      scheme: { enum: ['neutral', 'primary', 'secondary', 'tertiary'], default: 'primary' },
      size: { enum: ['1/3', '1/2', '1'], default: '1/2' },
      icon: iconName,
    }),
    catalogue: { group: 'elements', icon: 'label', label_key: catalogueWord('element.badge'), keywords: { en: ['badge', 'tag', 'status', 'label'], ru: ['метка', 'бейдж', 'тег', 'статус'] }, order: 120 },
  }),
  elementManifest('element.icon', 'smart/icon', {
    // The label names the icon for a screen reader; without it the icon only decorates.
    data_schema: closed({ label: plainText(120) }),
    props_schema: closed({
      icon: { ...iconName, default: 'star' },
      size: { enum: ['1', '2', '3', '4', '5'], default: '2' },
    }),
    catalogue: { group: 'elements', icon: 'star', label_key: catalogueWord('element.icon'), keywords: { en: ['icon', 'symbol', 'pictogram'], ru: ['значок', 'иконка', 'пиктограмма'] }, order: 130 },
  }),
  // Forms (2026-11-04; the ui-editor host's G-20): a form and its fields,
  // each field one SIMAI Framework Smart element printed from its inputs
  // (sf-input, sf-input-textarea, sf-checkbox, sf-switch, sf-dropdown,
  // sf-button with native-type submit). The form is a <form> around them;
  // where it is sent is the host's (action), checked by the Document's URL
  // rule. A field names what it submits (name); without a label, a field
  // whose name is a common one (name, phone, email, message) reads its word
  // in the Document's language, any other «Field»; so the variants carry
  // names, not words of one language.
  {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: 'form.form',
    version: '1.0.0',
    category: 'smart',
    mode: 'composite',
    profiles: ['ui-layout'],
    data_schema: closed({ action: urlSchema }),
    props_schema: closed({ method: { enum: ['post', 'get'], default: 'post' } }),
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: { default: { min: 0, max: 50, categories: ['content', 'smart'] } },
    renderer: { kind: 'builtin', name: 'form.form' },
    assets: [],
    capabilities: ['html'],
    catalogue: { group: 'forms', icon: 'contact_mail', label_key: catalogueWord('form.form'), keywords: { en: ['form', 'request', 'contact', 'feedback'], ru: ['форма', 'заявка', 'обратная связь', 'контакты'] }, order: 100 },
    variants: [
      {
        id: 'request',
        label_key: variantWord('form.form', 'request'),
        slots: { default: [
          { id: 'name', type: 'form.input', data: { name: 'name' } },
          { id: 'phone', type: 'form.input', data: { name: 'phone' }, props: { input_type: 'tel' } },
          { id: 'send', type: 'form.button-submit' },
        ] },
      },
      {
        id: 'message',
        label_key: variantWord('form.form', 'message'),
        slots: { default: [
          { id: 'name', type: 'form.input', data: { name: 'name' } },
          { id: 'email', type: 'form.input', data: { name: 'email' }, props: { input_type: 'email' } },
          { id: 'text', type: 'form.textarea', data: { name: 'message' } },
          { id: 'send', type: 'form.button-submit' },
        ] },
      },
    ],
  },
  elementManifest('form.input', 'smart/input', {
    data_schema: closed({ label: plainText(200), placeholder: plainText(200), hint: plainText(300), name: fieldName }),
    props_schema: closed({
      input_type: { enum: ['text', 'email', 'tel', 'url'], default: 'text' },
      required: { type: 'boolean', default: false },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'input', label_key: catalogueWord('form.input'), keywords: { en: ['field', 'input', 'text field', 'email', 'phone'], ru: ['поле', 'ввод', 'текстовое поле', 'почта', 'телефон'] }, order: 110 },
  }),
  elementManifest('form.textarea', 'smart/input-textarea', {
    data_schema: closed({ label: plainText(200), placeholder: plainText(200), hint: plainText(300), name: fieldName }),
    props_schema: closed({
      rows: { type: 'integer', minimum: 2, maximum: 12, default: 3 },
      required: { type: 'boolean', default: false },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'notes', label_key: catalogueWord('form.textarea'), keywords: { en: ['text area', 'message', 'comment', 'multiline'], ru: ['многострочное поле', 'сообщение', 'комментарий'] }, order: 120 },
  }),
  elementManifest('form.checkbox', 'smart/checkbox', {
    data_schema: closed({ label: plainText(300), hint: plainText(300), name: fieldName }),
    props_schema: closed({
      checked: { type: 'boolean', default: false },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'check_box', label_key: catalogueWord('form.checkbox'), keywords: { en: ['checkbox', 'agree', 'consent', 'tick'], ru: ['флажок', 'галочка', 'согласие'] }, order: 130 },
  }),
  elementManifest('form.switch', 'smart/switch', {
    data_schema: closed({ label: plainText(300), hint: plainText(300), name: fieldName }),
    props_schema: closed({
      checked: { type: 'boolean', default: false },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'toggle_on', label_key: catalogueWord('form.switch'), keywords: { en: ['switch', 'toggle', 'on off'], ru: ['переключатель', 'вкл выкл'] }, order: 140 },
  }),
  elementManifest('form.select', 'smart/dropdown', {
    // The options are words, one after another, separated by commas: what an
    // author writes in one field. Each option submits its own words.
    data_schema: closed({ label: plainText(200), placeholder: plainText(200), options: plainText(2000), name: fieldName }),
    props_schema: closed({
      required: { type: 'boolean', default: false },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'arrow_drop_down_circle', label_key: catalogueWord('form.select'), keywords: { en: ['select', 'dropdown', 'choice', 'list'], ru: ['список', 'выбор', 'выпадающий список'] }, order: 150 },
  }),
  elementManifest('form.button-submit', 'smart/button', {
    // Unset, it reads «Send» in the Document's language.
    data_schema: closed({ text: plainText(200) }),
    props_schema: closed({
      appearance: { enum: ['default', 'tonal', 'outline'], default: 'default' },
      size: { enum: ['1/2', '1', '2'], default: '1' },
    }),
    catalogue: { group: 'forms', icon: 'send', label_key: catalogueWord('form.button-submit'), keywords: { en: ['submit', 'send', 'button'], ru: ['отправить', 'кнопка отправки', 'кнопка'] }, order: 160 },
  }),
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
  // 1.1.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
  contentManifest('content.list-item', {
    version: '1.1.0',
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
  // 1.0.1 (2026-11-10): a column's alignment is the text-align utility class on
  // its cells, not a style attribute; it looks the same. 1.1.0: inline model
  // 1.2.0 in its caption and cells (the break, the mark strike).
  contentManifest('content.table', {
    version: '1.1.0',
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
  // 1.1.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
  contentManifest('content.figure', {
    version: '1.1.0',
    mode: 'leaf',
    data_schema: closed({ ...imageData, caption: inlineContentSchema }, ['src', 'alt']),
    props_schema: closed({
      ratio: { enum: ['auto', ...CONTENT_RATIOS] },
      fit: { enum: ['cover', 'contain'] },
    }),
    assets: ['component/figure'],
    capabilities: ['html', 'rich-text'],
  }),
  // 1.1.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
  contentManifest('content.alert', {
    version: '1.1.0',
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
  // 1.1.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
  contentManifest('content.details', {
    version: '1.1.0',
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
  // 1.1.0 (2026-11-10): inline model 1.2.0, the break and the mark strike.
  contentManifest('content.step', {
    version: '1.1.0',
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
  // A block from another source kept as it came (2026-11-10, F2.2): the source
  // format and its text, never parsed into markup and never drawn on a public
  // page; an editor draws an inert placeholder naming the source. hash is
  // sha256:<hex> of raw as UTF-8: validate checks its form, normalize
  // recomputes it, and a mismatch keeps the block and draws nothing
  // (foreign_hash_mismatch). It goes back only to its own source format.
  contentManifest('content.foreign', {
    mode: 'leaf',
    data_schema: closed({
      source: { enum: [...CONTENT_FOREIGN_SOURCES] },
      raw: { type: 'string', maxLength: 200000 },
      hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    }, ['source', 'raw']),
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
// The list port is answered by sf-view-table (formerly sf-table), which lives
// in the SIMAI Framework Pro package since 2026-10-11 (the component folder in
// simai/ui-pro, package pro). The port stays here: it is a public contract of
// the free Framework (composition-ports.v1.json, the routing contract lock), and
// the package's tests read it from this file in their overlay of ui-source.

// The list port as the routing contract 1.0.0 published it, under the former
// tag. Frozen: its bytes are pinned by the lock (port:sf-table@1.0.0), so a
// consumer that pinned 1.0.0 stays valid. Not registered by default.
export const PORT_MANIFEST_SF_TABLE_1_0_0 = Object.freeze({
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
});

// 1.1.0 (2026-11-07): the same ports under the element's own tag sf-view-table
// (sf-view-table 1.14.0, rename plan R2) and its query event; values and
// effects unchanged.
export const BUILTIN_PORT_MANIFESTS = Object.freeze([
  {
    ...schemaFields('simai.composition.port-manifest', 1),
    element: 'sf-view-table',
    version: '1.1.0',
    component: 'smart.view-table',
    component_version: '1.14.0',
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
        summary: 'Restricts this collection to records related to the given identities. The table clears its selection, enters loading and emits sf-view-table-query with the route sequence; the host resolves the relation and access and answers with applyQueryResult.',
        request_event: 'sf-view-table-query',
        result_method: 'applyQueryResult',
      },
    },
  },
]);

// Former port element names (routing.mjs PORT_ELEMENT_ALIASES): a binding to
// sf-table finds the sf-view-table manifest until the record's remove_after.
export { PORT_ELEMENT_ALIASES as BUILTIN_PORT_ELEMENT_ALIASES } from './routing.mjs';



// One editor field of a first-edition content type: the label and help keys
// follow the type and the key, the owner is the SIMAI Framework.
const contentField = (type, key, plane, kind, fields) => {
  const name = type.replace('.', '_').replaceAll('-', '_');
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
    type_version: '1.3.0',
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
      // 1.1.0: the fields of its parameter sets; 1.2.0: width and the space
      // above and below default to what the section prints unset.
      ...parameterSetFields({ parameter_sets: SECTION_SETS, parameter_defaults: SECTION_DEFAULTS }),
    ],
  },
  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'layout.columns',
    type_version: '1.1.0',
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
      {
        key: 'gap',
        plane: 'props',
        target: 'gap',
        property: { type: 'integer', version: 1 },
        constraints: { min: 0, max: 8 },
        group: 'basic',
        visibility: 'visible',
        default: 4,
        label_key: 'sf.composition.layout_columns.gap',
        help_key: 'sf.composition.layout_columns.gap_help',
        capability_hints: ['composition.props.gap'],
        permission_hints: ['composition.node.update'],
        owner: 'simai/framework',
      },
    ],
  },
  {
    ...schemaFields('simai.composition.editor-manifest', 1),
    type: 'content.heading',
    type_version: '1.3.0',
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
      ...parameterSetFields({ parameter_sets: TEXT_SETS }),
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
  contentEditor('layout.area', [
    contentField('layout.area', 'padding', 'props', 'integer', { constraints: { min: 0, max: 8 } }),
    contentField('layout.area', 'hidden', 'props', 'toggle', { default: false }),
  ]),
  // The layout and element types of the one block editor (2026-11-04).
  { ...contentEditor('content.paragraph', parameterSetFields({ parameter_sets: TEXT_SETS })), type_version: '1.4.0' },
  contentEditor('layout.container', parameterSetFields({ parameter_sets: ['width', 'spacing', 'background', 'visibility'], parameter_defaults: CONTAINER_DEFAULTS })),
  { ...contentEditor('layout.grid', parameterSetFields({ parameter_sets: ['grid', 'visibility'], parameter_defaults: GRID_DEFAULTS })), type_version: '1.1.0' },
  contentEditor('layout.spacer', [
    contentField('layout.spacer', 'size', 'props', 'integer', { constraints: { min: 1, max: 8 }, default: 6 }),
    ...parameterSetFields({ parameter_sets: ['visibility'] }),
  ]),
  contentEditor('element.button', [
    contentField('element.button', 'text', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('element.button', 'href', 'data', 'text', { constraints: { min_length: 1, max_length: 2048 } }),
    contentField('element.button', 'appearance', 'props', 'choice', { choices: ['default', 'tonal', 'outline', 'link', 'surface'], default: 'default' }),
    contentField('element.button', 'size', 'props', 'choice', { choices: ['1/2', '1', '2'], default: '1' }),
    contentField('element.button', 'icon', 'props', 'text', { constraints: { min_length: 1, max_length: 64 } }),
    contentField('element.button', 'icon_position', 'props', 'choice', { choices: ['start', 'end'], default: 'start' }),
    contentField('element.button', 'scheme', 'props', 'choice', { ...advanced, choices: ['primary', 'secondary'], default: 'primary' }),
  ]),
  contentEditor('element.button-icon', [
    contentField('element.button-icon', 'icon', 'props', 'text', { constraints: { min_length: 1, max_length: 64 }, default: 'favorite' }),
    contentField('element.button-icon', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 120 } }),
    contentField('element.button-icon', 'appearance', 'props', 'choice', { choices: ['default', 'tonal', 'outline', 'surface', 'ghost'], default: 'tonal' }),
    contentField('element.button-icon', 'size', 'props', 'choice', { choices: ['1/2', '1', '2'], default: '1' }),
    contentField('element.button-icon', 'scheme', 'props', 'choice', { ...advanced, choices: ['primary', 'secondary'], default: 'primary' }),
  ]),
  contentEditor('element.badge', [
    contentField('element.badge', 'text', 'data', 'text', { constraints: { min_length: 1, max_length: 120 } }),
    contentField('element.badge', 'appearance', 'props', 'choice', { choices: ['main', 'tonal', 'outline'], default: 'tonal' }),
    contentField('element.badge', 'scheme', 'props', 'choice', { choices: ['neutral', 'primary', 'secondary', 'tertiary'], default: 'primary' }),
    contentField('element.badge', 'size', 'props', 'choice', { choices: ['1/3', '1/2', '1'], default: '1/2' }),
    contentField('element.badge', 'icon', 'props', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
  ]),
  contentEditor('element.icon', [
    contentField('element.icon', 'icon', 'props', 'text', { constraints: { min_length: 1, max_length: 64 }, default: 'star' }),
    contentField('element.icon', 'size', 'props', 'choice', { choices: ['1', '2', '3', '4', '5'], default: '2' }),
    contentField('element.icon', 'label', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 120 } }),
  ]),
  // Forms (2026-11-04).
  contentEditor('form.form', [
    contentField('form.form', 'action', 'data', 'text', { constraints: { min_length: 1, max_length: 2048 } }),
    contentField('form.form', 'method', 'props', 'choice', { ...advanced, choices: ['post', 'get'], default: 'post' }),
  ]),
  contentEditor('form.input', [
    contentField('form.input', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.input', 'placeholder', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.input', 'input_type', 'props', 'choice', { choices: ['text', 'email', 'tel', 'url'], default: 'text' }),
    contentField('form.input', 'required', 'props', 'toggle', { default: false }),
    contentField('form.input', 'hint', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.input', 'name', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
    contentField('form.input', 'size', 'props', 'choice', { ...advanced, choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('form.textarea', [
    contentField('form.textarea', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.textarea', 'placeholder', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.textarea', 'rows', 'props', 'integer', { constraints: { min: 2, max: 12 }, default: 3 }),
    contentField('form.textarea', 'required', 'props', 'toggle', { default: false }),
    contentField('form.textarea', 'hint', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.textarea', 'name', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
    contentField('form.textarea', 'size', 'props', 'choice', { ...advanced, choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('form.checkbox', [
    contentField('form.checkbox', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.checkbox', 'hint', 'data', 'text', { constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.checkbox', 'checked', 'props', 'toggle', { default: false }),
    contentField('form.checkbox', 'name', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
    contentField('form.checkbox', 'size', 'props', 'choice', { ...advanced, choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('form.switch', [
    contentField('form.switch', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.switch', 'hint', 'data', 'text', { constraints: { min_length: 1, max_length: 300 } }),
    contentField('form.switch', 'checked', 'props', 'toggle', { default: false }),
    contentField('form.switch', 'name', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
    contentField('form.switch', 'size', 'props', 'choice', { ...advanced, choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('form.select', [
    contentField('form.select', 'label', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.select', 'options', 'data', 'text', { constraints: { min_length: 1, max_length: 2000 } }),
    contentField('form.select', 'placeholder', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.select', 'required', 'props', 'toggle', { default: false }),
    contentField('form.select', 'name', 'data', 'text', { ...advanced, constraints: { min_length: 1, max_length: 64 } }),
    contentField('form.select', 'size', 'props', 'choice', { ...advanced, choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('form.button-submit', [
    contentField('form.button-submit', 'text', 'data', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('form.button-submit', 'appearance', 'props', 'choice', { choices: ['default', 'tonal', 'outline'], default: 'default' }),
    contentField('form.button-submit', 'size', 'props', 'choice', { choices: ['1/2', '1', '2'], default: '1' }),
  ]),
  contentEditor('content.list', [
    contentField('content.list', 'ordered', 'props', 'toggle', { default: false }),
    contentField('content.list', 'start', 'props', 'integer', { ...advanced, constraints: { min: 1, max: 1000000 }, default: 1 }),
  ]),
  contentEditor('content.code', [
    contentField('content.code', 'lang', 'props', 'text', { constraints: { min_length: 1, max_length: 32 }, default: 'text' }),
    contentField('content.code', 'title', 'props', 'text', { constraints: { min_length: 1, max_length: 200 } }),
    contentField('content.code', 'numbers', 'props', 'toggle', { ...advanced, default: false }),
  ]),
  { ...contentEditor('content.table', [
    contentField('content.table', 'header', 'props', 'choice', { choices: ['row', 'column', 'both', 'none'], default: 'row' }),
  ]), type_version: '1.1.0' },
  // src is the one field the type requires besides alt: a host draws a
  // complete form from the manifest alone (simai/ui-source#64). The address
  // is a text field; validate applies the Document's URL rule on top.
  { ...contentEditor('content.figure', [
    contentField('content.figure', 'src', 'data', 'text', { constraints: { min_length: 1, max_length: 2048 } }),
    contentField('content.figure', 'alt', 'data', 'text', { constraints: { min_length: 1, max_length: 1000 } }),
    contentField('content.figure', 'ratio', 'props', 'choice', { choices: ['auto', '1/1', '4/3', '3/2', '16/9', '21/9'], default: 'auto' }),
    contentField('content.figure', 'fit', 'props', 'choice', { choices: ['cover', 'contain'], default: 'cover' }),
  ]), type_version: '1.1.0' },
  { ...contentEditor('content.alert', [
    contentField('content.alert', 'status', 'props', 'choice', { choices: ['neutral', 'info', 'success', 'warning', 'error'], default: 'neutral' }),
    contentField('content.alert', 'appearance', 'props', 'choice', { choices: ['default', 'outlined', 'flat'], default: 'default' }),
  ]), type_version: '1.1.0' },
  { ...contentEditor('content.details', [
    contentField('content.details', 'open', 'props', 'toggle', { default: false }),
    contentField('content.details', 'layout', 'props', 'choice', { choices: ['surface', 'lines'], default: 'surface' }),
  ]), type_version: '1.1.0' },
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
    contentField('content.media', 'src', 'data', 'text', { constraints: { min_length: 1, max_length: 2048 } }),
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

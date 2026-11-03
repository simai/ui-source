// Parameter sets: reusable groups of layout parameters a type manifest names
// instead of declaring them again (one block editor, 2026-11-03; ui-control
// control/ui-editor/UNIFIED-BLOCK-EDITOR.md, owner questions of the third
// review). Each set is props_schema properties with their SIMAI Framework
// utilities (x-simai-utility, utilities.mjs), the editor fields that set them
// and the inner elements (parts) a renderer draws for them.
//
// A type names its sets in `parameter_sets`; a registry (createRegistry,
// extendRegistry) adds their properties to the type's props_schema, so
// validation, the form and the output read them as the type's own. The stored
// manifest keeps only the names.
//
// Width is not one class on one element. Measured on the built sheet
// (2026-11-03): `.container` sets no inline margins, so a container is
// centred only with `m-inline-auto`; `max-container-N` widens a `.container`
// that is its descendant (`.max-container-N .container`, from the desktop
// breakpoint), never one on the same element; and `container max-w-prose` on
// one element is decided by which sheet comes later, which the Loader does
// not fix. So width reaches three elements: the block's own (wide:
// max-container-7), its `frame` part (the centred container) and its
// `content` part (the measure of a narrow block, around the slots).

import { canonical, isPlainObject } from './canonical.mjs';

export const PARAMETER_SETS_FIELD = 'parameter_sets';
// The values a type prints when a node does not set them (type manifest
// 1.5.0, visual parity 2026-11-04): a section stands in the page container
// with space above and below unless the Document says otherwise. Keyed by a
// props_schema property that prints a utility (a set's or the type's own); a
// node's own value, scalar or per screen, replaces it whole.
export const PARAMETER_DEFAULTS_FIELD = 'parameter_defaults';
export const PARAMETER_SET_OWNER = 'simai/framework';

// A background is named by its role; the class is the role's container fill.
const BACKGROUND_CLASSES = {
  surface: 'bg-surface',
  container: 'bg-surface-container',
  primary: 'bg-primary-container',
  secondary: 'bg-secondary-container',
  tertiary: 'bg-tertiary-container',
};
const BACKGROUNDS = Object.keys(BACKGROUND_CLASSES);
const step = (maximum) => ({ type: 'integer', minimum: 0, maximum });

/**
 * The sets, by name. `properties` join the type's props_schema; `parts` are
 * the inner elements a renderer must draw (`data-sf-composition-part`);
 * `fields` are editor manifest fields (key, kind and the field's own extras).
 */
export const PARAMETER_SETS = Object.freeze({
  background: {
    version: '1.0.0',
    summary: 'The block\'s fill: a surface or container colour role.',
    properties: {
      background: { type: 'string', enum: BACKGROUNDS, 'x-simai-utility': { values: BACKGROUND_CLASSES } },
    },
    parts: [],
    fields: [{ key: 'background', kind: 'choice', choices: BACKGROUNDS }],
  },
  spacing: {
    version: '1.0.0',
    summary: 'Space inside the block, above and below, and at the sides, per screen.',
    properties: {
      padding_y: { ...step(8), 'x-simai-utility': { class: 'p-y-{value}', responsive: true } },
      padding_x: { ...step(8), 'x-simai-utility': { class: 'p-x-{value}', responsive: true } },
    },
    parts: [],
    fields: [{ key: 'padding_y', kind: 'integer' }, { key: 'padding_x', kind: 'integer' }],
  },
  width: {
    version: '1.0.0',
    summary: 'How wide the block\'s content stands: a text measure, the page container, a wider container or the full width.',
    properties: {
      // Without a width the block draws as it always did: no container, the
      // width of where it stands (full).
      width: {
        type: 'string',
        enum: ['narrow', 'normal', 'wide', 'full'],
        default: 'full',
        'x-simai-utility': [
          { values: { wide: 'max-container-7' } },
          { part: 'frame', values: { narrow: 'container m-inline-auto', normal: 'container m-inline-auto', wide: 'container m-inline-auto' } },
          { part: 'content', values: { narrow: 'max-w-prose m-inline-auto' } },
        ],
      },
    },
    parts: ['frame', 'content'],
    fields: [{ key: 'width', kind: 'choice', choices: ['narrow', 'normal', 'wide', 'full'], default: 'full' }],
  },
  grid: {
    version: '1.0.0',
    summary: 'The block\'s children in columns, with a gap, per screen.',
    properties: {
      columns: { type: 'integer', minimum: 1, maximum: 12, default: 1, 'x-simai-utility': { part: 'content', class: 'grid grid-col-{value}', responsive: true } },
      gap: { ...step(8), 'x-simai-utility': { part: 'content', class: 'gap-{value}', responsive: true } },
    },
    parts: ['content'],
    fields: [{ key: 'columns', kind: 'integer', default: 1 }, { key: 'gap', kind: 'integer', default: 4 }],
  },
  alignment: {
    version: '1.0.0',
    summary: 'How the block\'s text lines up, per screen.',
    properties: {
      align: { type: 'string', enum: ['start', 'center', 'end'], 'x-simai-utility': { class: 'text-{value}', responsive: true } },
    },
    parts: [],
    fields: [{ key: 'align', kind: 'choice', choices: ['start', 'center', 'end'] }],
  },
  breakout: {
    version: '1.0.0',
    summary: 'The block leaves its container and spans the page\'s width (container-breakout).',
    properties: {
      breakout: { type: 'boolean', default: false, 'x-simai-utility': { values: { true: 'container-breakout', false: '' } } },
    },
    parts: [],
    fields: [{ key: 'breakout', kind: 'toggle', default: false }],
  },
  visibility: {
    version: '1.0.0',
    summary: 'The block is hidden on the screens where it is set.',
    properties: {
      hidden: { type: 'boolean', default: false, 'x-simai-utility': { values: { true: 'hidden', false: 'block' }, responsive: true } },
    },
    parts: [],
    fields: [{ key: 'hidden', kind: 'toggle', default: false }],
  },
});

export const PARAMETER_SET_NAMES = Object.freeze(Object.keys(PARAMETER_SETS));

/** The set names a type manifest takes, as stored (an empty list when none). */
export function parameterSetsOf(manifest) {
  const names = manifest?.[PARAMETER_SETS_FIELD];
  return Array.isArray(names) ? names.filter((name) => typeof name === 'string') : [];
}

/** The values a type prints for the properties a node leaves unset (an empty object when none). */
export function parameterDefaultsOf(manifest) {
  const defaults = manifest?.[PARAMETER_DEFAULTS_FIELD];
  return isPlainObject(defaults) ? defaults : {};
}

/** A node's props with its type's parameter defaults under them: what the node prints. */
export function effectiveProps(node, manifest) {
  const own = isPlainObject(node?.props) ? node.props : {};
  const defaults = parameterDefaultsOf(manifest);
  return Object.keys(defaults).length ? { ...defaults, ...own } : own;
}

/** The parts a type's renderer draws for its sets. */
export function parameterSetParts(manifest) {
  return [...new Set(parameterSetsOf(manifest).flatMap((name) => PARAMETER_SETS[name]?.parts || []))];
}

/**
 * The type manifest with its sets' properties in props_schema (a copy; the
 * manifest itself is not touched). A property the type declares itself wins;
 * validateParameterSets reports the clash. Unknown names are left out.
 */
export function expandParameterSets(manifest) {
  const names = parameterSetsOf(manifest);
  if (!names.length || !isPlainObject(manifest)) return manifest;
  const own = isPlainObject(manifest.props_schema?.properties) ? manifest.props_schema.properties : {};
  const added = {};
  for (const name of names) {
    for (const [key, schema] of Object.entries(PARAMETER_SETS[name]?.properties || {})) if (!(key in own) && !(key in added)) added[key] = schema;
  }
  if (!Object.keys(added).length) return manifest;
  return canonical({
    ...manifest,
    props_schema: {
      type: 'object',
      additionalProperties: false,
      ...manifest.props_schema,
      properties: { ...own, ...added },
    },
  });
}

/** The problems of a type's `parameter_sets`. */
export function validateParameterSets(manifest) {
  const diagnostics = [];
  if (!(PARAMETER_SETS_FIELD in (manifest || {}))) return diagnostics;
  const names = manifest[PARAMETER_SETS_FIELD];
  const at = `$.${PARAMETER_SETS_FIELD}`;
  if (!Array.isArray(names)) return [{ code: 'parameter_sets_invalid', path: at, message: 'parameter_sets is a list of set names' }];
  const own = isPlainObject(manifest.props_schema?.properties) ? manifest.props_schema.properties : {};
  const taken = new Map();
  names.forEach((name, index) => {
    if (!Object.hasOwn(PARAMETER_SETS, name)) {
      diagnostics.push({ code: 'parameter_set_unknown', path: `${at}[${index}]`, message: `No parameter set ${String(name)}; the sets are ${PARAMETER_SET_NAMES.join(', ')}` });
      return;
    }
    if (names.indexOf(name) !== index) {
      diagnostics.push({ code: 'parameter_set_duplicate', path: `${at}[${index}]`, message: `${name} is named twice` });
      return;
    }
    for (const key of Object.keys(PARAMETER_SETS[name].properties)) {
      if (key in own) diagnostics.push({ code: 'parameter_set_conflict', path: `$.props_schema.properties.${key}`, message: `${key} is a parameter of the set ${name}; the type declares it too` });
      else if (taken.has(key) && taken.get(key) !== name) diagnostics.push({ code: 'parameter_set_conflict', path: `${at}[${index}]`, message: `${key} is in both ${taken.get(key)} and ${name}` });
      taken.set(key, name);
    }
  });
  if (manifest.mode === 'leaf' && parameterSetParts(manifest).length) {
    diagnostics.push({ code: 'parameter_set_parts_leaf', path: at, message: 'A set with parts (width, grid) arranges children: the type is composite' });
  }
  return diagnostics;
}

// The field's default: the type's parameter default when it gives one (its
// phone value when it differs per screen), else the set's.
function fieldDefault(field, defaults) {
  if (!Object.hasOwn(defaults, field.key)) return 'default' in field ? { default: field.default } : {};
  const value = defaults[field.key];
  if (!isPlainObject(value)) return { default: value };
  if ('xs' in value) return { default: value.xs };
  return 'default' in field ? { default: field.default } : {};
}

function setField(name, field, defaults = {}) {
  const property = field.kind === 'choice' ? { type: 'string', version: 2 }
    : field.kind === 'integer' ? { type: 'integer', version: 1 } : { type: 'boolean', version: 1 };
  const schema = PARAMETER_SETS[name].properties[field.key];
  const constraints = field.kind === 'integer' ? { min: schema.minimum, max: schema.maximum }
    : field.kind === 'choice' ? { min_length: 1, max_length: 32 } : {};
  return canonical({
    key: field.key,
    plane: 'props',
    target: field.key,
    property,
    constraints,
    group: 'basic',
    visibility: 'visible',
    ...(field.choices ? { choices: field.choices } : {}),
    ...fieldDefault(field, defaults),
    label_key: `sf.composition.set_${name}.${field.key}`,
    help_key: `sf.composition.set_${name}.${field.key}_help`,
    capability_hints: [`composition.props.${field.key}`],
    permission_hints: ['composition.node.update'],
    owner: PARAMETER_SET_OWNER,
  });
}

/** The editor fields of a type's sets, in set order. */
export function parameterSetFields(manifest) {
  const defaults = parameterDefaultsOf(manifest);
  return parameterSetsOf(manifest).filter((name) => Object.hasOwn(PARAMETER_SETS, name)).flatMap((name) => PARAMETER_SETS[name].fields.map((field) => setField(name, field, defaults)));
}

/**
 * An editor manifest with the fields of its type's sets added after its own;
 * a field the manifest already has for that target is kept as it is.
 */
export function withParameterSetFields(editorManifest, typeManifest) {
  if (!isPlainObject(editorManifest)) return editorManifest;
  const fields = Array.isArray(editorManifest.fields) ? editorManifest.fields : [];
  const have = new Set(fields.filter((field) => field?.plane === 'props').map((field) => field.target));
  const added = parameterSetFields(typeManifest).filter((field) => !have.has(field.target));
  return added.length ? { ...editorManifest, fields: [...fields, ...added] } : editorManifest;
}

/** The sets as a table for a host without JavaScript (composition-blocks.v1.json). */
export function parameterSetTable() {
  return Object.fromEntries(Object.entries(PARAMETER_SETS).map(([name, { version, summary, properties, parts, fields }]) => [name, {
    version,
    summary,
    properties,
    parts,
    fields: fields.map((field) => setField(name, field)),
  }]));
}

/**
 * The problems of a type's `parameter_defaults`, read on the manifest with its
 * sets expanded: each key a property that prints a utility, each value one it
 * takes (`fits(value, schema)`), scalar or per screen.
 */
export function validateParameterDefaults(manifest, fits = () => true) {
  if (!(PARAMETER_DEFAULTS_FIELD in (manifest || {}))) return [];
  const at = `$.${PARAMETER_DEFAULTS_FIELD}`;
  const defaults = manifest[PARAMETER_DEFAULTS_FIELD];
  if (!isPlainObject(defaults)) return [{ code: 'parameter_defaults_invalid', path: at, message: 'parameter_defaults is an object of property values' }];
  const properties = isPlainObject(expandParameterSets(manifest)?.props_schema?.properties) ? expandParameterSets(manifest).props_schema.properties : {};
  const diagnostics = [];
  for (const [key, value] of Object.entries(defaults)) {
    const schema = properties[key];
    if (!schema || !schema['x-simai-utility']) diagnostics.push({ code: 'parameter_default_unknown', path: `${at}.${key}`, message: `${key} is no property of the type that prints a utility` });
    else if (!fits(value, schema)) diagnostics.push({ code: 'parameter_default_invalid', path: `${at}.${key}`, message: `${key} does not take this value` });
  }
  return diagnostics;
}

export default { PARAMETER_SETS, expandParameterSets, parameterSetFields, validateParameterSets, withParameterSetFields };

// The block catalogue: groups, tabs and variants of the types a registry holds
// (one block editor, owner 2026-11-03; ui-control
// control/ui-editor/UNIFIED-BLOCK-EDITOR.md, section 3). Additive to the type
// manifest: `catalogue` places a type in the catalogue, `variants` names its
// starting states, and a slot may say which groups it accepts.
//
// Three levels keep the catalogue small: a type is code (data, parameters,
// renderer), a variant is a named starting state of a type (parameters, child
// blocks, a preview), a saved block is a site's snapshot (the host's, not a
// manifest's). A new kind of header is a variant, not a type.

import { canonical, isPlainObject } from './canonical.mjs';

/**
 * The fixed groups, in catalogue order. A product adds its own group by its
 * namespace. Since the visual parity pass (2026-11-04) Elements (smart
 * elements a block prints) and Layout (sections, containers, grids) replace
 * Structure, which said nothing to an author.
 */
export const CATALOGUE_GROUPS = Object.freeze(['text', 'media', 'elements', 'layout', 'page-parts', 'marketing', 'data', 'forms']);
/** Former group names a type may still give, and the group each now means (dated aliases). */
export const CATALOGUE_GROUP_ALIASES = Object.freeze({ structure: Object.freeze({ group: 'layout', until: '2027-01-01' }) });
/**
 * Each fixed group's icon (a SIMAI Framework icon name) and word
 * (sf.composition.catalogue.group.<group>, editor-words.mjs): the catalogue's
 * sections draw an icon and a name from here.
 */
export const CATALOGUE_GROUP_TABLE = Object.freeze({
  text: Object.freeze({ icon: 'notes', label_key: 'sf.composition.catalogue.group.text' }),
  media: Object.freeze({ icon: 'image', label_key: 'sf.composition.catalogue.group.media' }),
  elements: Object.freeze({ icon: 'interests', label_key: 'sf.composition.catalogue.group.elements' }),
  layout: Object.freeze({ icon: 'view_quilt', label_key: 'sf.composition.catalogue.group.layout' }),
  'page-parts': Object.freeze({ icon: 'web', label_key: 'sf.composition.catalogue.group.page_parts' }),
  marketing: Object.freeze({ icon: 'campaign', label_key: 'sf.composition.catalogue.group.marketing' }),
  data: Object.freeze({ icon: 'dataset', label_key: 'sf.composition.catalogue.group.data' }),
  forms: Object.freeze({ icon: 'edit_square', label_key: 'sf.composition.catalogue.group.forms' }),
});
/** The two tabs the catalogue opens on: what is written into a text flow, and what a page is built from. */
export const CATALOGUE_TABS = Object.freeze(['text', 'blocks']);
const TEXT_TAB_GROUPS = new Set(['text', 'media']);
const CATALOGUE_FIELDS = new Set(['group', 'tab', 'label_key', 'help_key', 'keywords', 'preview', 'order', 'icon']);
const ICON_NAME = /^[a-z0-9][a-z0-9_]{0,63}$/u;
const VARIANT_FIELDS = new Set(['id', 'label_key', 'preview', 'props', 'data', 'presentation', 'slots']);
const SLOT_EXTRA_FIELDS = new Set(['label_key', 'empty_key', 'groups']);
const STABLE_KEY = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/u;
const VARIANT_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;

// The SIMAI Framework's own types in the catalogue. Their manifests carry no
// `catalogue` (their identities are pinned by the capability locks); a type
// listed as null stands only inside its parent or as a root and is not offered.
export const BUILTIN_CATALOGUE = Object.freeze({
  'layout.page': null,
  'layout.section': 'layout',
  'layout.columns': 'layout',
  'layout.area': 'layout',
  'layout.container': 'layout',
  'layout.grid': 'layout',
  'layout.spacer': 'layout',
  'layout.regions': null,
  'layout.region': null,
  'layout.scope': null,
  'content.document': null,
  'content.heading': 'text',
  'content.paragraph': 'text',
  'content.list': 'text',
  'content.list-item': null,
  'content.quote': 'text',
  'content.code': 'text',
  'content.divider': 'elements',
  'content.alert': 'text',
  'content.math': 'text',
  'content.table': 'data',
  'content.figure': 'media',
  'content.media': 'media',
  'content.file': 'media',
  'content.html': 'media',
  'content.diagram': 'media',
  'content.details': 'text',
  'content.tabs': 'text',
  'content.tab': null,
  'content.steps': 'text',
  'content.step': null,
  'content.grid': 'layout',
  'content.card': 'elements',
  'content.outlet': null,
  'element.button': 'elements',
  'element.button-icon': 'elements',
  'element.badge': 'elements',
  'element.icon': 'elements',
});

// The icon of each offered built-in type (a SIMAI Framework icon name, as the
// prototype draws the catalogue; a type's own catalogue.icon wins).
export const BUILTIN_CATALOGUE_ICONS = Object.freeze({
  'layout.section': 'crop_landscape',
  'layout.columns': 'view_column',
  'layout.area': 'edit_note',
  'layout.container': 'width_normal',
  'layout.grid': 'grid_on',
  'layout.spacer': 'height',
  'content.heading': 'title',
  'content.paragraph': 'notes',
  'content.list': 'format_list_bulleted',
  'content.quote': 'format_quote',
  'content.code': 'code',
  'content.divider': 'horizontal_rule',
  'content.alert': 'info',
  'content.math': 'function',
  'content.table': 'table',
  'content.figure': 'image',
  'content.media': 'art_track',
  'content.file': 'download',
  'content.html': 'html',
  'content.diagram': 'schema',
  'content.details': 'expand_circle_down',
  'content.tabs': 'tab',
  'content.steps': 'format_list_numbered',
  'content.grid': 'grid_view',
  'content.card': 'crop_portrait',
  'element.button': 'smart_button',
  'element.button-icon': 'add_circle',
  'element.badge': 'label',
  'element.icon': 'star',
});

// Documents and manifests are JSON: a copy through JSON is a deep copy.
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const diagnostic = (code, path, message) => ({ code, path, message });
const namespaceOf = (type) => String(type || '').split('.')[0];

/** Whether a group name may stand in a type's catalogue entry: a fixed group, or the type's own namespace. */
export function groupAllowed(group, type) {
  return CATALOGUE_GROUPS.includes(group) || Object.hasOwn(CATALOGUE_GROUP_ALIASES, group) || (typeof group === 'string' && group === namespaceOf(type));
}

/** The group a name stands for now: a dated alias gives its new group. */
export function catalogueGroup(group) {
  return typeof group === 'string' && Object.hasOwn(CATALOGUE_GROUP_ALIASES, group) ? CATALOGUE_GROUP_ALIASES[group].group : group;
}

/**
 * A type's catalogue entry, or null when the type is not offered:
 * {type, group, tab, icon?, label_key?, help_key?, keywords, preview?, order, variants}.
 * A product type without `catalogue` falls into its namespace's group.
 */
export function catalogueEntry(manifest) {
  if (!isPlainObject(manifest)) return null;
  const own = isPlainObject(manifest.catalogue) ? manifest.catalogue : null;
  let group = own?.group;
  if (group === undefined) {
    if (Object.hasOwn(BUILTIN_CATALOGUE, manifest.type)) group = BUILTIN_CATALOGUE[manifest.type];
    else group = namespaceOf(manifest.type);
  }
  if (!group) return null;
  group = catalogueGroup(group);
  const icon = own?.icon ?? BUILTIN_CATALOGUE_ICONS[manifest.type];
  const tab = own?.tab ?? (TEXT_TAB_GROUPS.has(group) ? 'text' : 'blocks');
  return canonical({
    type: manifest.type,
    version: manifest.version,
    group,
    tab,
    ...(icon ? { icon } : {}),
    ...(own?.label_key ? { label_key: own.label_key } : {}),
    ...(own?.help_key ? { help_key: own.help_key } : {}),
    keywords: isPlainObject(own?.keywords) ? own.keywords : {},
    ...(own?.preview ? { preview: own.preview } : {}),
    order: Number.isInteger(own?.order) ? own.order : 500,
    variants: (Array.isArray(manifest.variants) ? manifest.variants : []).map((variant) => ({
      id: variant.id,
      label_key: variant.label_key,
      ...(variant.preview ? { preview: variant.preview } : {}),
    })),
  });
}

/**
 * The catalogue of a registry: every offered type, by tab and group, in order.
 * With `{parent, slot}` only the types that place accepts (hidden, not
 * greyed: a mail column accepts no video); a tab with nothing is left out.
 */
export function catalogue(registry, place = {}) {
  const types = registry?.types instanceof Map ? [...registry.types.values()] : [];
  let entries = types.map(catalogueEntry).filter(Boolean);
  if (place.parent) {
    const parent = registry.types.get(place.parent);
    entries = entries.filter((entry) => slotAccepts(registry, parent, place.slot ?? 'default', entry.type));
  }
  if (place.profile) entries = entries.filter((entry) => registry.types.get(entry.type).profiles.includes(place.profile));
  entries.sort((left, right) => left.order - right.order || left.type.localeCompare(right.type));
  const tabs = {};
  for (const entry of entries) {
    tabs[entry.tab] ||= {};
    (tabs[entry.tab][entry.group] ||= []).push(entry);
  }
  return { entries, tabs };
}

/**
 * Whether a slot of a type accepts a child type: its `types`, its
 * `categories` and, when it declares them, its catalogue `groups`.
 */
export function slotAccepts(registry, parentManifest, slotName, childType) {
  const slot = parentManifest?.slots?.[slotName];
  const child = registry?.types instanceof Map ? registry.types.get(childType) : undefined;
  if (!slot || !child) return false;
  if (parentManifest.mode === 'leaf') return false;
  if (slot.types && !slot.types.includes(childType)) return false;
  if (slot.categories && !slot.categories.includes(child.category)) return false;
  if (slot.groups) {
    const entry = catalogueEntry(child);
    if (!entry || !slot.groups.map(catalogueGroup).includes(entry.group)) return false;
  }
  return true;
}

/** The named places of a type: each slot with what it accepts and its words. */
export function slotPlaces(manifest) {
  return Object.entries(isPlainObject(manifest?.slots) ? manifest.slots : {}).map(([name, slot]) => canonical({
    name,
    min: slot.min,
    max: slot.max,
    ...(slot.types ? { types: slot.types } : {}),
    ...(slot.categories ? { categories: slot.categories } : {}),
    ...(slot.groups ? { groups: slot.groups } : {}),
    ...(slot.label_key ? { label_key: slot.label_key } : {}),
    ...(slot.empty_key ? { empty_key: slot.empty_key } : {}),
  }));
}

function cloneWithIds(node, map, makeId) {
  const next = { ...node, id: makeId(node.id) };
  map.set(node.id, next.id);
  if (isPlainObject(node.slots)) {
    next.slots = Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [name, (children || []).map((child) => cloneWithIds(child, map, makeId))]));
  }
  return next;
}

function rewriteLinks(node, map) {
  if (Array.isArray(node.bindings)) {
    node.bindings = node.bindings.map((binding) => {
      if (binding.owner !== 'section' || typeof binding.ref !== 'string') return binding;
      const [from, state] = binding.ref.split('#');
      return map.has(from) ? { ...binding, ref: `${map.get(from)}#${state}` } : binding;
    });
  }
  for (const children of Object.values(node.slots || {})) for (const child of children) rewriteLinks(child, map);
}

/**
 * A node made from a type's variant, ready to insert: the variant's props,
 * data, presentation and child blocks, every child with a new id
 * (`<id>-<variant child id>` unless `makeId` says otherwise) and the runtime
 * links between them rewritten to the new ids.
 */
export function instantiateVariant(manifest, variantId, options = {}) {
  const variant = (manifest?.variants || []).find((entry) => entry.id === variantId);
  if (!variant) throw new TypeError(`composition_variant_unknown:${manifest?.type}:${variantId}`);
  const id = options.id ?? `${namespaceOf(manifest.type)}-${variantId}`;
  const makeId = options.makeId ?? ((childId) => `${id}-${childId}`);
  const source = clone({
    id,
    type: manifest.type,
    ...(variant.props ? { props: variant.props } : {}),
    ...(variant.data ? { data: variant.data } : {}),
    ...(variant.presentation ? { presentation: variant.presentation } : {}),
    ...(variant.slots ? { slots: variant.slots } : {}),
  });
  const map = new Map();
  const node = { ...source };
  if (isPlainObject(source.slots)) {
    node.slots = Object.fromEntries(Object.entries(source.slots).map(([name, children]) => [name, children.map((child) => cloneWithIds(child, map, makeId))]));
  }
  rewriteLinks(node, map);
  return node;
}

/** The problems of a type manifest's catalogue, variants and slot words (validate decides whether each variant is a valid node). */
export function validateCatalogueFields(manifest) {
  const diagnostics = [];
  if (manifest.catalogue !== undefined) {
    const entry = manifest.catalogue;
    if (!isPlainObject(entry)) diagnostics.push(diagnostic('catalogue_invalid', '$.catalogue', 'catalogue is an object'));
    else {
      for (const key of Object.keys(entry)) if (!CATALOGUE_FIELDS.has(key)) diagnostics.push(diagnostic('catalogue_invalid', `$.catalogue.${key}`, `Unknown catalogue field ${key}`));
      if (!groupAllowed(entry.group, manifest.type)) diagnostics.push(diagnostic('catalogue_group_unknown', '$.catalogue.group', `A group is one of ${CATALOGUE_GROUPS.join(', ')}, or the type's namespace ${namespaceOf(manifest.type)}`));
      if (entry.tab !== undefined && !CATALOGUE_TABS.includes(entry.tab)) diagnostics.push(diagnostic('catalogue_tab_unknown', '$.catalogue.tab', 'A tab is text or blocks'));
      for (const key of ['label_key', 'help_key']) if (entry[key] !== undefined && !STABLE_KEY.test(entry[key])) diagnostics.push(diagnostic('catalogue_word_invalid', `$.catalogue.${key}`, 'A word is a stable key'));
      if (entry.keywords !== undefined && (!isPlainObject(entry.keywords) || Object.entries(entry.keywords).some(([locale, words]) => !/^[a-z]{2,8}$/u.test(locale) || !Array.isArray(words) || words.length > 20 || words.some((word) => typeof word !== 'string' || !word || word.length > 60)))) {
        diagnostics.push(diagnostic('catalogue_keywords_invalid', '$.catalogue.keywords', 'keywords are up to 20 words per locale'));
      }
      if (entry.order !== undefined && (!Number.isInteger(entry.order) || entry.order < 0 || entry.order > 1000)) diagnostics.push(diagnostic('catalogue_order_invalid', '$.catalogue.order', 'order is 0 to 1000'));
      if (entry.icon !== undefined && (typeof entry.icon !== 'string' || !ICON_NAME.test(entry.icon))) diagnostics.push(diagnostic('catalogue_icon_invalid', '$.catalogue.icon', 'icon is a SIMAI Framework icon name'));
      if (entry.preview !== undefined && (typeof entry.preview !== 'string' || !entry.preview || entry.preview.length > 2048)) diagnostics.push(diagnostic('catalogue_preview_invalid', '$.catalogue.preview', 'preview is an image address'));
    }
  }
  if (manifest.variants !== undefined) {
    if (!Array.isArray(manifest.variants) || manifest.variants.length > 50) diagnostics.push(diagnostic('variants_invalid', '$.variants', 'variants is a list of up to 50'));
    else {
      const ids = new Set();
      manifest.variants.forEach((variant, index) => {
        const at = `$.variants[${index}]`;
        if (!isPlainObject(variant)) return diagnostics.push(diagnostic('variant_invalid', at, 'A variant is an object'));
        for (const key of Object.keys(variant)) if (!VARIANT_FIELDS.has(key)) diagnostics.push(diagnostic('variant_invalid', `${at}.${key}`, `Unknown variant field ${key}`));
        if (!VARIANT_ID.test(variant.id ?? '')) diagnostics.push(diagnostic('variant_id_invalid', `${at}.id`, 'A variant id is lowercase words joined by hyphens'));
        else if (ids.has(variant.id)) diagnostics.push(diagnostic('variant_id_duplicate', `${at}.id`, `Duplicate variant ${variant.id}`));
        else ids.add(variant.id);
        if (!STABLE_KEY.test(variant.label_key ?? '')) diagnostics.push(diagnostic('variant_word_invalid', `${at}.label_key`, 'A variant names its word'));
        if (variant.preview !== undefined && (typeof variant.preview !== 'string' || !variant.preview)) diagnostics.push(diagnostic('variant_preview_invalid', `${at}.preview`, 'preview is an image address'));
        const childIds = new Set();
        const visit = (node, path) => {
          if (!isPlainObject(node) || !NODE_ID.test(node.id ?? '')) return diagnostics.push(diagnostic('variant_child_invalid', path, 'A child block is a node with an id'));
          if (childIds.has(node.id)) diagnostics.push(diagnostic('variant_child_id_duplicate', `${path}.id`, `Duplicate child id ${node.id}`));
          childIds.add(node.id);
          for (const [name, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) (children || []).forEach((child, at2) => visit(child, `${path}.slots.${name}[${at2}]`));
          return undefined;
        };
        for (const [name, children] of Object.entries(isPlainObject(variant.slots) ? variant.slots : {})) (Array.isArray(children) ? children : []).forEach((child, at2) => visit(child, `${at}.slots.${name}[${at2}]`));
      });
    }
  }
  for (const [name, slot] of Object.entries(isPlainObject(manifest.slots) ? manifest.slots : {})) {
    if (!isPlainObject(slot)) continue;
    for (const key of ['label_key', 'empty_key']) if (slot[key] !== undefined && !STABLE_KEY.test(slot[key])) diagnostics.push(diagnostic('slot_word_invalid', `$.slots.${name}.${key}`, 'A word is a stable key'));
    if (slot.groups !== undefined && (!Array.isArray(slot.groups) || !slot.groups.length || slot.groups.some((group) => typeof group !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(group)))) diagnostics.push(diagnostic('slot_groups_invalid', `$.slots.${name}.groups`, 'groups is a list of catalogue groups'));
  }
  return diagnostics;
}

export { SLOT_EXTRA_FIELDS };

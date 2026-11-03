// Site blocks: a type made of existing blocks (one block editor, owner
// 2026-11-03; ui-control control/ui-editor/UNIFIED-BLOCK-EDITOR.md, section 6).
//
// The block builder composes a tree of existing blocks, marks the parameters
// an author may set (`exposed`: a key, the path of a node in the tree and the
// target there), and saves it as a type with a version (`site.*` in a site's
// catalogue). On a page the block is closed: an instance is its type, the
// version it was written against, and what differs -- the exposed values in
// `props` and the texts by path in `data.texts`. A new version of the type
// reaches every instance, because the tree is read from the type; the
// author's texts and values stay. upgradeComposed moves an instance to the
// current version and reports what the new version no longer has.
//
// Nothing here is a new Document format: an instance is a node of
// composition-document v1 and the type is a type manifest with two more
// fields (`composed`, `exposed`).

import { canonical, isPlainObject } from './canonical.mjs';
import { schemaFields } from './schema-name.mjs';

export const COMPOSED_EXTENSION = 'simai.composition:composed';
export const COMPOSED_RENDERER = 'composed';
export const MAX_COMPOSED_DEPTH = 8;
const KEY = /^[a-z][a-z0-9_]{0,31}$/u;
const TEXT_PATH = /^([A-Za-z0-9][A-Za-z0-9._:-]{0,119})\/([a-z][a-z0-9_]{0,31})$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;

// The inline text of the SIMAI Framework's types, by field: what an author
// writes in a site block. A product type's text is any data field holding
// inline content (an array of the inline model's entries).
const TEXT_FIELDS = Object.freeze({
  'content.heading': ['content'],
  'content.paragraph': ['content'],
  'content.list-item': ['content'],
  'content.alert': ['title'],
  'content.step': ['title'],
  'content.details': ['summary'],
  'content.figure': ['caption'],
});

// Documents and manifests are JSON: a copy through JSON is a deep copy.
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const diagnostic = (code, path, message, details = {}) => ({ code, path, message, ...details });

export const isComposed = (manifest) => isPlainObject(manifest?.composed) && isPlainObject(manifest.composed.root);

/** The text fields of a type: inline content an author writes. */
export function textFields(manifest) {
  if (!manifest) return [];
  if (Object.hasOwn(TEXT_FIELDS, manifest.type)) return TEXT_FIELDS[manifest.type];
  const properties = manifest.data_schema?.properties || {};
  return Object.keys(properties).filter((key) => properties[key]?.type === 'array' && Array.isArray(properties[key]?.items?.oneOf));
}

function walk(node, visit, path = []) {
  if (!isPlainObject(node)) return;
  visit(node, path);
  for (const [slot, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
    (Array.isArray(children) ? children : []).forEach((child, index) => walk(child, visit, [...path, slot, index]));
  }
}

function nodeById(root, id) {
  let found = null;
  walk(root, (node) => { if (!found && node.id === id) found = node; });
  return found;
}

/** Every text path of a site block: `<node id>/<field>`, in tree order. */
export function composedTextPaths(manifest, registry) {
  if (!isComposed(manifest)) return [];
  const paths = [];
  walk(manifest.composed.root, (node) => {
    for (const field of textFields(registry?.types?.get(node.type))) paths.push(`${node.id}/${field}`);
  });
  return paths;
}

/** The version a node of a site block was written against, or null when it says none. */
export function instanceVersion(node) {
  const entry = isPlainObject(node?.extensions) ? node.extensions[COMPOSED_EXTENSION] : undefined;
  return isPlainObject(entry) && typeof entry.version === 'string' ? entry.version : null;
}

const compareVersions = (left, right) => {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  return 0;
};

/**
 * Makes the type manifest of a site block from what the builder saved:
 * {type, version, category?, profiles, catalogue?, root, exposed}. The
 * parameters an author sees take the schema of their target; their default is
 * the value the tree holds. `validateDocument(document, registry)` checks the
 * tree as a Document. Returns {manifest, diagnostics}.
 */
export function defineComposedType(definition, registry, validateDocument) {
  const diagnostics = [];
  const push = (code, path, message) => diagnostics.push(diagnostic(code, path, message));
  if (!isPlainObject(definition)) return { manifest: null, diagnostics: [diagnostic('composed_definition_invalid', '$', 'A site block is an object')] };
  const { type, version, root } = definition;
  if (typeof type !== 'string' || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(type)) push('composed_type_invalid', '$.type', 'A type is <owner>.<name>');
  if (registry?.types?.has(type) && !isComposed(registry.types.get(type))) push('composed_type_taken', '$.type', `${type} is a type of code, not a site block`);
  if (typeof version !== 'string' || !VERSION.test(version)) push('composed_version_invalid', '$.version', 'A version is major.minor.patch');
  const profiles = Array.isArray(definition.profiles) && definition.profiles.length ? definition.profiles : ['ui-layout'];
  const category = definition.category ?? 'layout';
  if (!['layout', 'content', 'component', 'smart'].includes(category)) push('composed_category_invalid', '$.category', 'A category is layout, content, component or smart');
  if (!isPlainObject(root)) push('composed_root_missing', '$.root', 'A site block is a tree of blocks');
  if (diagnostics.length) return { manifest: null, diagnostics };

  const tree = clone(root);
  walk(tree, (node, path) => {
    if (node.type === type) push('composed_cycle', `$.root${path.length ? `.slots.${path.join('.')}` : ''}`, 'A site block cannot hold itself');
  });
  const probe = { ...schemaFields('simai.composition.document', 1), id: 'composed-probe', profile: profiles[0], root: tree };
  if (typeof validateDocument === 'function') {
    const checked = validateDocument(probe, registry);
    for (const entry of checked.diagnostics) diagnostics.push({ ...entry, path: entry.path.replace(/^\$\.root/u, '$.root') });
  }

  const exposed = Array.isArray(definition.exposed) ? definition.exposed : [];
  const properties = {};
  const keys = new Set();
  if (exposed.length > 50) push('composed_exposed_limit', '$.exposed', 'A site block exposes at most 50 parameters');
  exposed.forEach((entry, index) => {
    const at = `$.exposed[${index}]`;
    if (!isPlainObject(entry)) return push('composed_exposed_invalid', at, 'An exposed parameter is {key, path, target}');
    for (const field of Object.keys(entry)) if (!['key', 'path', 'target', 'label_key'].includes(field)) push('composed_exposed_invalid', `${at}.${field}`, `Unknown field ${field}`);
    if (!KEY.test(entry.key ?? '')) return push('composed_exposed_key_invalid', `${at}.key`, 'A key is a lowercase name');
    if (keys.has(entry.key)) return push('composed_exposed_key_duplicate', `${at}.key`, `Duplicate key ${entry.key}`);
    keys.add(entry.key);
    const node = nodeById(tree, entry.path);
    if (!node) return push('composed_exposed_path_unknown', `${at}.path`, `No block ${entry.path} in the tree`);
    const match = /^(props|data)\.([a-z][a-z0-9_]*)$/u.exec(entry.target ?? '');
    if (!match) return push('composed_exposed_target_invalid', `${at}.target`, 'A target is props.<name> or data.<name>');
    const target = registry?.types?.get(node.type);
    const schema = target?.[match[1] === 'props' ? 'props_schema' : 'data_schema']?.properties?.[match[2]];
    if (!schema) return push('composed_exposed_target_unknown', `${at}.target`, `${node.type} has no ${entry.target}`);
    const current = node[match[1]]?.[match[2]];
    properties[entry.key] = canonical({ ...schema, ...(current !== undefined && typeof current !== 'object' ? { default: current } : {}) });
    return undefined;
  });
  if (diagnostics.length) return { manifest: null, diagnostics };

  const assets = new Set(definition.assets || []);
  walk(tree, (node) => { for (const asset of registry?.types?.get(node.type)?.assets || []) assets.add(asset); });
  const manifest = canonical({
    ...schemaFields('simai.composition.type-manifest', 1),
    type,
    version,
    category,
    mode: 'leaf',
    profiles,
    data_schema: { type: 'object', additionalProperties: false, properties: { texts: { type: 'object' } } },
    props_schema: { type: 'object', additionalProperties: false, properties },
    presentation: { views: ['default'], presets: [], modifiers: [] },
    slots: {},
    renderer: { kind: 'builtin', name: COMPOSED_RENDERER },
    assets: [...assets].sort(),
    capabilities: ['html', 'composed'],
    ...(definition.catalogue ? { catalogue: definition.catalogue } : {}),
    composed: { root: tree },
    exposed: exposed.map(({ key, path, target, label_key: label }) => ({ key, path, target, ...(label ? { label_key: label } : {}) })),
  });
  return { manifest, diagnostics };
}

/** A new instance of a site block: its type and version, nothing that differs yet. */
export function composedInstance(manifest, id) {
  return { id, type: manifest.type, extensions: { [COMPOSED_EXTENSION]: { version: manifest.version } } };
}

/**
 * The problems of an instance's texts and the notices of what the current
 * version no longer has. `checkInline(content, path, diagnostics)` holds a
 * text to the inline model and the Document's URL rule.
 */
export function validateComposedInstance(node, manifest, registry, path, checkInline) {
  const diagnostics = [];
  const notices = [];
  const texts = isPlainObject(node.data?.texts) ? node.data.texts : {};
  const known = new Set(composedTextPaths(manifest, registry));
  for (const [key, content] of Object.entries(texts)) {
    const at = `${path}.data.texts.${key}`;
    if (!TEXT_PATH.test(key)) {
      diagnostics.push(diagnostic('composed_text_path_invalid', at, 'A text is keyed <node id>/<field>'));
      continue;
    }
    checkInline(content, at, diagnostics);
    if (!known.has(key)) notices.push(diagnostic('composed_text_orphaned', at, `${manifest.type} ${manifest.version} has no text ${key}; it is kept and not drawn`));
  }
  const version = instanceVersion(node);
  const entry = isPlainObject(node.extensions) ? node.extensions[COMPOSED_EXTENSION] : undefined;
  if (entry !== undefined && (!isPlainObject(entry) || !VERSION.test(entry.version ?? ''))) diagnostics.push(diagnostic('composed_version_invalid', `${path}.extensions.${COMPOSED_EXTENSION}`, 'An instance names the version it was written against'));
  else if (version && compareVersions(version, manifest.version) > 0) notices.push(diagnostic('composed_version_newer', `node:${node.id}`, `Written against ${manifest.type} ${version}; this site has ${manifest.version}`));
  else if (version && version !== manifest.version) notices.push(diagnostic('composed_version_behind', `node:${node.id}`, `Written against ${version}; drawn with ${manifest.version} (upgradeComposed moves it)`));
  return { diagnostics, notices };
}

/**
 * The tree an instance draws: the type's current tree, with the instance's
 * exposed values and texts in place. The root takes the instance's id; every
 * other block `<instance id>:<tree id>`, so an editor maps a click back to a
 * text path and the instance stays one node in the Document.
 */
export function expandComposed(node, manifest) {
  const tree = clone(manifest.composed.root);
  const ids = new Map();
  walk(tree, (child) => { ids.set(child, child.id); });
  const props = isPlainObject(node.props) ? node.props : {};
  for (const entry of manifest.exposed || []) {
    if (!(entry.key in props)) continue;
    const target = nodeById(tree, entry.path);
    const [plane, name] = entry.target.split('.');
    if (target) target[plane] = { ...(target[plane] || {}), [name]: clone(props[entry.key]) };
  }
  const texts = isPlainObject(node.data?.texts) ? node.data.texts : {};
  for (const [key, content] of Object.entries(texts)) {
    const match = TEXT_PATH.exec(key);
    const target = match && nodeById(tree, match[1]);
    if (target) target.data = { ...(target.data || {}), [match[2]]: clone(content) };
  }
  const drawnId = (id) => (id === manifest.composed.root.id ? node.id : `${node.id}:${id}`);
  walk(tree, (child) => {
    child.id = drawnId(ids.get(child));
    // A runtime link inside the block follows the ids (data.mjs: owner section).
    if (Array.isArray(child.bindings)) {
      child.bindings = child.bindings.map((binding) => {
        if (binding?.owner !== 'section' || typeof binding.ref !== 'string' || !binding.ref.includes('#')) return binding;
        const [from, state] = binding.ref.split('#');
        return [...ids.values()].includes(from) ? { ...binding, ref: `${drawnId(from)}#${state}` } : binding;
      });
    }
  });
  if (node.extensions) {
    const rest = Object.fromEntries(Object.entries(node.extensions).filter(([key]) => key !== COMPOSED_EXTENSION));
    if (Object.keys(rest).length) tree.extensions = { ...(tree.extensions || {}), ...rest };
  }
  return tree;
}

/** The tree id and text path a drawn id of an instance stands for: {instance, node, root}. */
export function composedPart(drawnId) {
  const at = String(drawnId).indexOf(':');
  return at === -1 ? { instance: drawnId, node: null, root: true } : { instance: drawnId.slice(0, at), node: drawnId.slice(at + 1), root: false };
}

/**
 * Moves every instance of a site block in a Document to the type's current
 * version: texts whose block is gone and values the version no longer takes
 * are dropped and reported; everything else stays. `checkValue(value,
 * schema)` says whether a value fits a schema. Returns {document, changes}.
 */
export function upgradeComposed(document, registry, checkValue) {
  const next = clone(document);
  const changes = [];
  const visit = (node) => {
    const manifest = registry.types.get(node.type);
    if (isComposed(manifest)) {
      const from = instanceVersion(node);
      const dropped = { texts: [], values: [] };
      const known = new Set(composedTextPaths(manifest, registry));
      if (isPlainObject(node.data?.texts)) {
        for (const key of Object.keys(node.data.texts)) if (!known.has(key)) { dropped.texts.push(key); delete node.data.texts[key]; }
        if (!Object.keys(node.data.texts).length) delete node.data.texts;
        if (node.data && !Object.keys(node.data).length) delete node.data;
      }
      if (isPlainObject(node.props)) {
        for (const [key, value] of Object.entries(node.props)) {
          const schema = manifest.props_schema.properties[key];
          if (!schema || !checkValue(value, schema)) { dropped.values.push(key); delete node.props[key]; }
        }
        if (!Object.keys(node.props).length) delete node.props;
      }
      if (from !== manifest.version || dropped.texts.length || dropped.values.length) {
        node.extensions = { ...(node.extensions || {}), [COMPOSED_EXTENSION]: { version: manifest.version } };
        changes.push({ id: node.id, type: node.type, from, to: manifest.version, dropped });
      }
    }
    for (const children of Object.values(node.slots || {})) for (const child of children) visit(child);
  };
  if (isPlainObject(next.root)) visit(next.root);
  return { document: next, changes };
}

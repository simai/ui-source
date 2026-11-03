// Data for blocks: shapes, host bindings, the source port and runtime links
// (one block editor, owner 2026-11-03; ui-control
// control/ui-editor/UNIFIED-BLOCK-EDITOR.md, section 5).
//
// The rule: a block never fetches. A type says which shape of data it takes
// (`data_bindings` in its manifest); the host says where the data comes from.
// The node's `bindings` (composition-document v1) carry {owner, ref, target,
// revision}; what the host needs beside them (the shape, the field mapping,
// filter, sort, limit, the page parameter, the empty text) is the node's
// extension `simai.composition:data`, keyed by the binding's target, and only
// the host reads the query. A list and its pagination are linked by a runtime
// binding: owner `section`, ref `<list node id>#<state>`, resolved by the
// runtime inside the same section, never by the host.

import { canonical, isPlainObject, stableStringify } from './canonical.mjs';
import { schemaFields } from './schema-name.mjs';

export const DATA_EXTENSION = 'simai.composition:data';
export const RUNTIME_OWNER = 'section';
/** What a data block draws: the host's answer is on its way, empty, failed, real, or demo data in the editor. */
export const BINDING_STATES = Object.freeze(['loading', 'empty', 'error', 'ready', 'preview']);
const SETTINGS_FIELDS = new Set(['shape', 'preset', 'mapping', 'filter', 'sort', 'limit', 'page_param', 'params', 'empty_text']);
const PARAM_SOURCES = new Set(['url', 'context', 'route']);
const NAME = /^[a-z][a-z0-9_]{0,31}$/u;
const MAX_FILTER_BYTES = 4000;

const text = (maxLength, minLength = 0) => ({ type: 'string', ...(minLength ? { minLength } : {}), maxLength });
const closed = (properties, required = []) => ({ type: 'object', ...(required.length ? { required } : {}), additionalProperties: false, properties });
const image = closed({ src: text(2048, 1), alt: text(1000) }, ['src']);
const item = closed({
  id: text(120, 1),
  title: text(500, 1),
  text: text(5000),
  url: text(2048, 1),
  image,
  date: text(40, 1),
  badge: text(60, 1),
}, ['title']);
const link = closed({ label: text(200, 1), url: text(2048, 1), active: { type: 'boolean' } }, ['label', 'url']);

// The data shapes of the SIMAI Framework: small named contracts a block takes
// and a host answers with (bx-simai.layout calls them view types). A host
// adds its own in its namespace (`larena.product`); it never changes these.
export const DATA_SHAPES = Object.freeze({
  item: {
    summary: 'One record: a title, and optionally a text, an address, a picture, a date and a badge.',
    schema: item,
  },
  cards: {
    summary: 'A list of records for cards, with the page it is when the host pages it.',
    schema: closed({
      items: { type: 'array', maxItems: 500, items: item },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      pages: { type: 'integer', minimum: 0 },
      per_page: { type: 'integer', minimum: 1, maximum: 500 },
    }, ['items']),
    list: 'items',
  },
  gallery: {
    summary: 'Pictures with their captions.',
    schema: closed({
      items: { type: 'array', maxItems: 500, items: closed({ src: text(2048, 1), alt: text(1000), caption: text(1000) }, ['src']) },
    }, ['items']),
    list: 'items',
  },
  section_title: {
    summary: 'The title of a section and a line under it.',
    schema: closed({ title: text(500, 1), subtitle: text(1000) }, ['title']),
  },
  menu: {
    summary: 'Links of a menu, one level of children under each.',
    schema: closed({
      items: { type: 'array', maxItems: 200, items: closed({ ...link.properties, children: { type: 'array', maxItems: 100, items: link } }, ['label', 'url']) },
    }, ['items']),
    list: 'items',
  },
  pagination: {
    summary: 'Where a paged list is: the page, how many there are, and the total. A runtime state a list publishes.',
    schema: closed({
      page: { type: 'integer', minimum: 1 },
      pages: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
      per_page: { type: 'integer', minimum: 1, maximum: 500 },
    }, ['page', 'pages']),
  },
});

const diagnostic = (code, path, message, details = {}) => ({ code, path, message, ...details });

/** The shape registry: the SIMAI Framework's shapes and a host's own (namespaced: `<owner>.<name>`). */
export function createShapeRegistry(extra = {}) {
  const shapes = new Map(Object.entries(DATA_SHAPES));
  for (const [name, shape] of Object.entries(extra || {})) {
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/u.test(name)) throw new TypeError(`composition_shape_name_invalid:${name}`);
    if (!isPlainObject(shape?.schema)) throw new TypeError(`composition_shape_invalid:${name}`);
    shapes.set(name, canonical(shape));
  }
  return shapes;
}

let defaultShapes = null;
export function normalizeShapes(shapes) {
  if (shapes instanceof Map) return shapes;
  if (isPlainObject(shapes)) return createShapeRegistry(shapes);
  defaultShapes ||= createShapeRegistry();
  return defaultShapes;
}

/** The fields of a shape a mapping may name: the record's fields for a list shape, else the shape's own. */
export function shapeFields(shape) {
  if (!shape) return [];
  const own = shape.schema?.properties || {};
  const listed = shape.list ? own[shape.list]?.items?.properties : null;
  return Object.keys(listed || own);
}

/** The settings a node keeps for the binding of one target, or undefined. */
export function bindingSettings(node, target) {
  const entry = isPlainObject(node?.extensions) ? node.extensions[DATA_EXTENSION] : undefined;
  return isPlainObject(entry) && isPlainObject(entry[target]) ? entry[target] : undefined;
}

const declaredBindings = (manifest) => (isPlainObject(manifest?.data_bindings) ? manifest.data_bindings : null);
const declaredRuntime = (manifest) => (isPlainObject(manifest?.runtime) ? manifest.runtime : null);
/** Whether a type takes data through bindings (host or runtime). */
export const takesData = (manifest) => Boolean(declaredBindings(manifest) || declaredRuntime(manifest)?.accepts);

/** The problems of a manifest's data_bindings and runtime declarations. */
export function validateDataDeclarations(manifest, shapes) {
  const diagnostics = [];
  const registry = normalizeShapes(shapes);
  const bindings = manifest.data_bindings;
  if (bindings !== undefined) {
    if (!isPlainObject(bindings) || !Object.keys(bindings).length) diagnostics.push(diagnostic('data_bindings_invalid', '$.data_bindings', 'data_bindings names each data key a host fills'));
    else for (const [target, entry] of Object.entries(bindings)) {
      const at = `$.data_bindings.${target}`;
      if (!NAME.test(target)) diagnostics.push(diagnostic('data_binding_target_invalid', at, 'A target is a data key'));
      if (!isPlainObject(entry) || !Array.isArray(entry.shapes) || !entry.shapes.length) {
        diagnostics.push(diagnostic('data_binding_invalid', at, 'A binding names the shapes it takes'));
        continue;
      }
      for (const key of Object.keys(entry)) if (!['shapes', 'required', 'empty_key'].includes(key)) diagnostics.push(diagnostic('data_binding_invalid', `${at}.${key}`, `Unknown binding field ${key}`));
      for (const shape of entry.shapes) if (!registry.has(shape)) diagnostics.push(diagnostic('data_shape_unknown', `${at}.shapes`, `${shape} is not a data shape`));
    }
  }
  const runtime = manifest.runtime;
  if (runtime !== undefined) {
    if (!isPlainObject(runtime)) diagnostics.push(diagnostic('runtime_invalid', '$.runtime', 'runtime is {publishes, accepts}'));
    else {
      for (const key of Object.keys(runtime)) if (!['publishes', 'accepts'].includes(key)) diagnostics.push(diagnostic('runtime_invalid', `$.runtime.${key}`, `Unknown runtime field ${key}`));
      for (const [state, entry] of Object.entries(isPlainObject(runtime.publishes) ? runtime.publishes : {})) {
        const at = `$.runtime.publishes.${state}`;
        if (!NAME.test(state)) diagnostics.push(diagnostic('runtime_state_invalid', at, 'A state is a lowercase name'));
        if (!registry.has(entry?.shape)) diagnostics.push(diagnostic('data_shape_unknown', `${at}.shape`, `${entry?.shape} is not a data shape`));
        if (entry?.binding !== undefined && !Object.hasOwn(declaredBindings(manifest) || {}, entry.binding)) diagnostics.push(diagnostic('runtime_binding_unknown', `${at}.binding`, 'A state is taken from one of the type\'s own bindings'));
      }
      for (const [target, entry] of Object.entries(isPlainObject(runtime.accepts) ? runtime.accepts : {})) {
        const at = `$.runtime.accepts.${target}`;
        if (!NAME.test(target)) diagnostics.push(diagnostic('runtime_state_invalid', at, 'A target is a data key'));
        if (!registry.has(entry?.shape)) diagnostics.push(diagnostic('data_shape_unknown', `${at}.shape`, `${entry?.shape} is not a data shape`));
      }
    }
  }
  return diagnostics;
}

function validateSettings(settings, target, shapeNames, registry, path, diagnostics) {
  if (!isPlainObject(settings)) {
    diagnostics.push(diagnostic('data_settings_invalid', path, 'The settings of a binding are an object'));
    return;
  }
  for (const key of Object.keys(settings)) if (!SETTINGS_FIELDS.has(key)) diagnostics.push(diagnostic('data_settings_invalid', `${path}.${key}`, `Unknown binding setting ${key}`));
  const shapeName = settings.shape ?? (shapeNames.length === 1 ? shapeNames[0] : undefined);
  if (settings.shape !== undefined && !shapeNames.includes(settings.shape)) diagnostics.push(diagnostic('data_shape_not_taken', `${path}.shape`, `${target} takes ${shapeNames.join(', ')}`));
  if (shapeName === undefined) diagnostics.push(diagnostic('data_shape_required', `${path}.shape`, `${target} takes several shapes; the binding names one`));
  if (settings.preset !== undefined && (typeof settings.preset !== 'string' || !/^[a-z][a-z0-9._-]{0,63}$/u.test(settings.preset))) diagnostics.push(diagnostic('data_settings_invalid', `${path}.preset`, 'A preset is the host\'s mapping preset name'));
  if (settings.mapping !== undefined) {
    const fields = new Set(shapeFields(registry.get(shapeName)));
    if (!isPlainObject(settings.mapping)) diagnostics.push(diagnostic('data_mapping_invalid', `${path}.mapping`, 'A mapping maps shape fields to source fields'));
    else for (const [field, source] of Object.entries(settings.mapping)) {
      if (!fields.has(field)) diagnostics.push(diagnostic('data_mapping_field_unknown', `${path}.mapping.${field}`, `${field} is no field of ${shapeName}`));
      if (typeof source !== 'string' || !source || source.length > 120) diagnostics.push(diagnostic('data_mapping_invalid', `${path}.mapping.${field}`, 'A source field is a name'));
    }
  }
  if (settings.filter !== undefined && (!isPlainObject(settings.filter) || stableStringify(settings.filter).length > MAX_FILTER_BYTES)) diagnostics.push(diagnostic('data_filter_invalid', `${path}.filter`, `A filter is an object of at most ${MAX_FILTER_BYTES} bytes, read by the host only`));
  if (settings.sort !== undefined && (!Array.isArray(settings.sort) || settings.sort.length > 5 || settings.sort.some((entry) => !isPlainObject(entry) || typeof entry.field !== 'string' || !entry.field || !['asc', 'desc'].includes(entry.direction ?? 'asc') || Object.keys(entry).some((key) => !['field', 'direction'].includes(key))))) {
    diagnostics.push(diagnostic('data_sort_invalid', `${path}.sort`, 'sort is up to 5 {field, direction: asc | desc}'));
  }
  if (settings.limit !== undefined && (!Number.isInteger(settings.limit) || settings.limit < 1 || settings.limit > 500)) diagnostics.push(diagnostic('data_limit_invalid', `${path}.limit`, 'limit is 1 to 500'));
  if (settings.page_param !== undefined && (typeof settings.page_param !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/u.test(settings.page_param))) diagnostics.push(diagnostic('data_settings_invalid', `${path}.page_param`, 'page_param is the URL parameter the host pages by'));
  if (settings.params !== undefined) {
    if (!isPlainObject(settings.params)) diagnostics.push(diagnostic('data_params_invalid', `${path}.params`, 'params name URL and context values'));
    else for (const [name, param] of Object.entries(settings.params)) {
      if (!NAME.test(name) || !isPlainObject(param) || !PARAM_SOURCES.has(param.from) || typeof param.key !== 'string' || !param.key || param.key.length > 64 || Object.keys(param).some((key) => !['from', 'key'].includes(key))) {
        diagnostics.push(diagnostic('data_params_invalid', `${path}.params.${name}`, 'A parameter is {from: url | context | route, key}'));
      }
    }
  }
  if (settings.empty_text !== undefined && (typeof settings.empty_text !== 'string' || settings.empty_text.length > 500)) diagnostics.push(diagnostic('data_settings_invalid', `${path}.empty_text`, 'empty_text is up to 500 characters'));
}

/**
 * The data rules of a Document, for the types that declare data: each host
 * binding fills a declared target with a shape the type takes, its settings
 * are well formed, and each runtime binding names a publisher in the same
 * section with a state of the shape the target takes.
 */
export function validateDataRules(root, registry, shapes, diagnostics) {
  const shapeRegistry = normalizeShapes(shapes);
  const sections = new Map();
  const nodes = new Map();
  const visit = (node, path, section) => {
    if (!isPlainObject(node)) return;
    const here = node.type === 'layout.section' ? node.id : section;
    nodes.set(node.id, { node, path, section: here });
    for (const [slot, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (Array.isArray(children)) children.forEach((child, index) => visit(child, `${path}.slots.${slot}[${index}]`, here));
    }
  };
  visit(root, '$.root', '$root');
  for (const { node, path, section } of nodes.values()) {
    sections.set(node.id, section);
    const manifest = registry.types.get(node.type);
    if (!manifest) continue;
    const declared = declaredBindings(manifest);
    const accepts = declaredRuntime(manifest)?.accepts;
    const extension = isPlainObject(node.extensions) ? node.extensions[DATA_EXTENSION] : undefined;
    if (extension !== undefined && !declared) diagnostics.push(diagnostic('data_binding_undeclared', `${path}.extensions.${DATA_EXTENSION}`, `${node.type} takes no data from a host`));
    if (!declared && !accepts) continue;
    const bound = new Set();
    (Array.isArray(node.bindings) ? node.bindings : []).forEach((binding, index) => {
      const at = `${path}.bindings[${index}]`;
      if (!isPlainObject(binding)) return;
      if (binding.owner === RUNTIME_OWNER) {
        if (!accepts || !Object.hasOwn(accepts, binding.target)) return diagnostics.push(diagnostic('runtime_target_undeclared', `${at}.target`, `${node.type} accepts no runtime state at ${binding.target}`));
        const [from, state, extra] = String(binding.ref).split('#');
        if (!from || !state || extra !== undefined) return diagnostics.push(diagnostic('runtime_ref_invalid', `${at}.ref`, 'A runtime binding names <node id>#<state>'));
        const publisher = nodes.get(from);
        if (!publisher || publisher.section !== section) return diagnostics.push(diagnostic('runtime_publisher_missing', `${at}.ref`, `${from} is not in the same section`));
        const published = declaredRuntime(registry.types.get(publisher.node.type))?.publishes?.[state];
        if (!published) return diagnostics.push(diagnostic('runtime_state_unknown', `${at}.ref`, `${publisher.node.type} publishes no ${state}`));
        if (published.shape !== accepts[binding.target].shape) diagnostics.push(diagnostic('runtime_shape_mismatch', `${at}.ref`, `${state} is ${published.shape}; ${binding.target} takes ${accepts[binding.target].shape}`));
        return undefined;
      }
      if (!declared || !Object.hasOwn(declared, binding.target)) return diagnostics.push(diagnostic('binding_target_undeclared', `${at}.target`, `${node.type} takes no host data at ${binding.target}`));
      if (bound.has(binding.target)) diagnostics.push(diagnostic('binding_target_duplicate', `${at}.target`, `${binding.target} is bound twice`));
      bound.add(binding.target);
      return undefined;
    });
    for (const [target, entry] of Object.entries(declared || {})) {
      if (entry.required === true && !bound.has(target)) diagnostics.push(diagnostic('binding_required', `${path}.bindings`, `${target} needs a source`));
    }
    if (isPlainObject(extension)) {
      for (const [target, settings] of Object.entries(extension)) {
        const at = `${path}.extensions.${DATA_EXTENSION}.${target}`;
        if (!Object.hasOwn(declared || {}, target)) diagnostics.push(diagnostic('binding_target_undeclared', at, `${node.type} takes no host data at ${target}`));
        else validateSettings(settings, target, declared[target].shapes, shapeRegistry, at, diagnostics);
      }
    } else if (extension !== undefined) diagnostics.push(diagnostic('data_settings_invalid', `${path}.extensions.${DATA_EXTENSION}`, 'The data settings are an object keyed by binding target'));
  }
}

// ------------------------------------------------------------- at render

function isEmpty(data, shape) {
  if (data === null) return true;
  if (shape?.list) return Array.isArray(data?.[shape.list]) && data[shape.list].length === 0;
  return false;
}

/**
 * Resolves the data of the nodes whose types declare it, before drawing: each
 * host binding through `context.resolveBinding`, with its state; then each
 * runtime binding from its publisher. A failure stays inside its block: the
 * state is `error` and the page still draws. Returns {byNode: Map(id ->
 * {values, states}), links, diagnostics}.
 */
export async function resolveData(root, registry, context, check) {
  const shapes = normalizeShapes(context.options?.shapes);
  const byNode = new Map();
  const diagnostics = [];
  const links = [];
  const pending = [];
  const walk = (node) => {
    const manifest = registry.types.get(node.type);
    if (manifest && takesData(manifest)) pending.push({ node, manifest });
    for (const children of Object.values(node.slots || {})) for (const child of children) walk(child);
  };
  walk(root);
  for (const { node, manifest } of pending) {
    const entry = { values: {}, states: {} };
    byNode.set(node.id, entry);
    for (const binding of node.bindings || []) {
      if (binding.owner === RUNTIME_OWNER || !declaredBindings(manifest)?.[binding.target]) continue;
      const settings = bindingSettings(node, binding.target) || {};
      const shapeName = settings.shape ?? declaredBindings(manifest)[binding.target].shapes[0];
      const shape = shapes.get(shapeName);
      let data;
      try {
        data = typeof context.resolveBinding === 'function'
          ? await context.resolveBinding(binding, { node, shape: shapeName, settings })
          : undefined;
      } catch (error) {
        entry.states[binding.target] = 'error';
        diagnostics.push(diagnostic('binding_failed', `node:${node.id}`, `The source of ${binding.target} failed: ${String(error?.message || error).slice(0, 200)}`));
        continue;
      }
      if (data === undefined) {
        entry.states[binding.target] = 'loading';
        continue;
      }
      const problems = [];
      check(data, shape?.schema, `node:${node.id}.${binding.target}`, problems);
      if (problems.length) {
        entry.states[binding.target] = 'error';
        diagnostics.push(diagnostic('binding_shape_mismatch', `node:${node.id}`, `The host's answer for ${binding.target} is not ${shapeName}: ${problems.map((item) => `${item.code} at ${item.path}`).slice(0, 5).join('; ')}`));
        continue;
      }
      entry.values[binding.target] = data;
      entry.states[binding.target] = isEmpty(data, shape) ? 'empty' : context.preview === true ? 'preview' : 'ready';
    }
    for (const target of Object.keys(declaredBindings(manifest) || {})) if (!(target in entry.states)) entry.states[target] = 'empty';
  }
  // Runtime bindings read what their publisher holds now.
  for (const { node, manifest } of pending) {
    const entry = byNode.get(node.id);
    for (const binding of node.bindings || []) {
      if (binding.owner !== RUNTIME_OWNER || !declaredRuntime(manifest)?.accepts?.[binding.target]) continue;
      const [from, state] = String(binding.ref).split('#');
      const publisher = byNode.get(from);
      const publisherManifest = publisher && registry.types.get(pending.find((item) => item.node.id === from)?.node.type);
      const published = declaredRuntime(publisherManifest)?.publishes?.[state];
      links.push({ from, state, to: node.id, target: binding.target });
      if (!publisher || !published) {
        entry.states[binding.target] = 'empty';
        continue;
      }
      const sourceState = published.binding ? publisher.states[published.binding] : 'ready';
      const source = published.binding ? publisher.values[published.binding] : undefined;
      const fields = Object.keys(shapes.get(published.shape)?.schema?.properties || {});
      const value = isPlainObject(source) ? Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]])) : undefined;
      const problems = [];
      if (value !== undefined) check(value, shapes.get(published.shape)?.schema, `node:${node.id}.${binding.target}`, problems);
      if (value === undefined || problems.length) {
        entry.states[binding.target] = sourceState === 'loading' || sourceState === 'error' ? sourceState : 'empty';
        continue;
      }
      entry.values[binding.target] = value;
      entry.states[binding.target] = sourceState;
    }
  }
  return { byNode, links, diagnostics };
}

// ----------------------------------------------------------- the source port

// The three things an editor asks a host about data. The host answers; the
// editor never knows about iblocks, models or merge data. Bitrix, Larena and
// the mail editor each implement it.
export const SOURCE_PORT = Object.freeze({
  ...schemaFields('simai.composition.source-port', 1),
  requests: {
    sources: { summary: 'Which sources give this shape: [{id, label, shapes, presets?}].', input: ['shape'] },
    fields: { summary: 'Which fields a source has: [{key, label, type?}].', input: ['source'] },
    preview: { summary: 'Data for a binding to show in the editor, in the binding\'s shape (demo data when the source is not reachable).', input: ['binding', 'settings', 'shape'] },
  },
});

const SOURCE_FIELDS = new Set(['id', 'label', 'shapes', 'presets', 'revision']);
const PRESET_FIELDS = new Set(['id', 'label', 'shape', 'mapping']);

/** The problems of a host's answer to one source-port request. */
export function checkSourceAnswer(request, answer, options = {}) {
  const diagnostics = [];
  const shapes = normalizeShapes(options.shapes);
  const push = (code, path, message) => diagnostics.push(diagnostic(code, path, message));
  if (request === 'sources') {
    if (!Array.isArray(answer) || answer.length > 200) push('source_answer_invalid', '$', 'sources is a list of up to 200');
    else answer.forEach((source, index) => {
      const at = `$[${index}]`;
      if (!isPlainObject(source)) return push('source_answer_invalid', at, 'A source is an object');
      for (const key of Object.keys(source)) if (!SOURCE_FIELDS.has(key)) push('source_answer_invalid', `${at}.${key}`, `Unknown source field ${key}`);
      if (typeof source.id !== 'string' || !source.id || source.id.length > 200) push('source_answer_invalid', `${at}.id`, 'A source has an id');
      if (typeof source.label !== 'string' || !source.label) push('source_answer_invalid', `${at}.label`, 'A source has a label');
      if (!Array.isArray(source.shapes) || source.shapes.some((shape) => !shapes.has(shape))) push('source_shape_unknown', `${at}.shapes`, 'A source names the shapes it gives');
      for (const [presetIndex, preset] of (Array.isArray(source.presets) ? source.presets : []).entries()) {
        const presetAt = `${at}.presets[${presetIndex}]`;
        if (!isPlainObject(preset) || Object.keys(preset).some((key) => !PRESET_FIELDS.has(key)) || typeof preset.id !== 'string' || !isPlainObject(preset.mapping)) { push('source_preset_invalid', presetAt, 'A preset is {id, label, shape, mapping}'); continue; }
        const fields = new Set(shapeFields(shapes.get(preset.shape)));
        for (const field of Object.keys(preset.mapping)) if (!fields.has(field)) push('source_preset_invalid', `${presetAt}.mapping.${field}`, `${field} is no field of ${preset.shape}`);
      }
      return undefined;
    });
  } else if (request === 'fields') {
    if (!Array.isArray(answer) || answer.length > 500) push('source_answer_invalid', '$', 'fields is a list of up to 500');
    else answer.forEach((field, index) => {
      if (!isPlainObject(field) || typeof field.key !== 'string' || !field.key || typeof field.label !== 'string' || Object.keys(field).some((key) => !['key', 'label', 'type'].includes(key))) push('source_answer_invalid', `$[${index}]`, 'A field is {key, label, type?}');
    });
  } else if (request === 'preview') {
    const shape = shapes.get(options.shape);
    if (!shape) push('source_shape_unknown', '$', `${options.shape} is not a data shape`);
    else if (typeof options.check === 'function') {
      const problems = [];
      options.check(answer, shape.schema, '$', problems);
      diagnostics.push(...problems);
    }
  } else push('source_request_unknown', '$', `${request} is not a request of the source port`);
  return diagnostics;
}

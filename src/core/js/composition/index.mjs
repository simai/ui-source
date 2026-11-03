import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS, CONTENT_ITEM_PARENTS } from './builtins.mjs';
import { EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER, editorFieldMessages } from './editor-words.mjs';
import { sanitizeRichText } from './html-subset.mjs';
import { fileNameFromAddress, fileSizeUnits, formatFileSize } from './file-size.mjs';
import { canonical, isPlainObject, stableStringify } from './canonical.mjs';
import { isSchema, schemaFields } from './schema-name.mjs';
import { projectDocumentEditorFields, projectEditorFields, validateEditorManifest } from './editor.mjs';
import {
  BUILTIN_FIELD_KINDS,
  applyFieldValue,
  parseFieldSubmission,
  renderFieldFallback,
  resolveFieldKind,
  validateFieldKinds,
  validateFieldValue,
} from './fields.mjs';
import { Recipe, parseRecipeJson, recipeDigest, recipeNodeId, resolveRecipe } from './recipe.mjs';
import { REGION_ELEMENTS, describeRegions, validateRegionRules } from './regions.mjs';
import { INLINE_MARKS, inlineComponentView, inlineText, marksIn, normalizeInline, replaceRange, setLink, toggleMark } from './inline-model.mjs';
import {
  ENDPOINT_EXTENSION,
  VALUE_TYPES,
  checkPortValue,
  createPortRegistry,
  defineCompositionScope,
  endpointName,
  resolveRoutes,
  routesAttribute,
} from './routing.mjs';
import { FRAGMENT_DESCRIPTOR_SCHEMA, checkFragmentDescriptor, defineFragmentBoundary, definePageHost, publishEffects } from './fragments.mjs';

const DOCUMENT_SCHEMA = 'simai.composition.document.v1';

// The editor surfaces (sf-editor-overlay, sf-sortable, sf-editor-inline)
// are Smart components loaded on demand, so pages that only render stay small.
// startInlineEdit keeps its Core name and delegates to the loaded editor.
function startInlineEdit(element, options) {
  const editor = globalThis.SF?.InlineEditor;
  if (typeof editor?.startInlineEdit !== 'function') throw new TypeError('inline_editor_not_loaded');
  return editor.startInlineEdit(element, options);
}
const PROFILES = new Set(['ui-layout', 'structured-content']);
const DOCUMENT_FIELDS = new Set(['schema', 'schema_version', 'id', 'profile', 'locale', 'root', 'extensions']);
const NODE_FIELDS = new Set(['id', 'type', 'data', 'props', 'slots', 'presentation', 'bindings', 'extensions']);
const PRESENTATION_FIELDS = new Set(['view', 'preset', 'modifiers']);
const BINDING_FIELDS = new Set(['owner', 'ref', 'target', 'revision']);
const FORBIDDEN_KEYS = new Set([
  'html', 'innerhtml', 'script', 'javascript', 'php', 'eval', 'function',
  'expression', 'query', 'sql', 'graphql', 'class', 'classname', 'rootclass',
  'cssclass', 'secret', 'password', 'token', 'cookie', 'authorization', 'request',
]);
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const DEFAULT_LIMITS = Object.freeze({
  maxDocumentBytes: 1024 * 1024,
  maxDepth: 32,
  maxNodes: 2000,
  maxChildrenPerSlot: 500,
});

function diagnostic(code, path, message, details = {}) {
  return { code, path, message, ...details };
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('composition_crypto_unavailable');
  const bytes = new globalThis.TextEncoder().encode(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pushUnknownFields(value, allowed, path, diagnostics) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) diagnostics.push(diagnostic('unknown_field', `${path}.${key}`, `Unknown field ${key}`));
  }
}

function scanForbiddenKeys(value, path, diagnostics) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenKeys(entry, `${path}[${index}]`, diagnostics));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll('-', '');
    if (FORBIDDEN_KEYS.has(normalized)) {
      diagnostics.push(diagnostic('executable_or_secret_field_forbidden', `${path}.${key}`, `Field ${key} is not portable composition data`));
    }
    scanForbiddenKeys(entry, `${path}.${key}`, diagnostics);
  }
}

function validateExtensions(value, path, diagnostics, supported = new Set()) {
  if (!isPlainObject(value)) {
    diagnostics.push(diagnostic('extensions_invalid', path, 'Extensions must be an object'));
    return;
  }
  for (const key of Object.keys(value)) {
    if (!/^[a-z][a-z0-9.-]*:[a-z][a-z0-9._-]*$/u.test(key)) {
      diagnostics.push(diagnostic('extension_name_invalid', `${path}.${key}`, 'Extension keys must be namespaced'));
    }
    if (isPlainObject(value[key]) && value[key].required === true && !supported.has(key)) {
      diagnostics.push(diagnostic('extension_required_unknown', `${path}.${key}`, `Required extension ${key} is not supported`));
    }
  }
}

function validateJsonSchema(value, schema, path, diagnostics) {
  if (!schema) return;
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => {
      const local = [];
      validateJsonSchema(value, candidate, path, local);
      return local.length === 0;
    });
    if (matches.length !== 1) diagnostics.push(diagnostic('schema_one_of', path, 'Value must match exactly one allowed shape'));
    return;
  }
  if (schema.const !== undefined && value !== schema.const) {
    diagnostics.push(diagnostic('schema_const', path, `Value must equal ${schema.const}`));
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    diagnostics.push(diagnostic('schema_enum', path, 'Value is not in the allowed list'));
    return;
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.type) {
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value === 'number' ? 'number' : typeof value;
    if (!types.includes(actual) && !(actual === 'integer' && types.includes('number')) && !(actual === 'object' && !isPlainObject(value))) {
      diagnostics.push(diagnostic('schema_type', path, `Expected ${types.join(' or ')}`));
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) diagnostics.push(diagnostic('schema_min_length', path, 'String is too short'));
    if (schema.maxLength !== undefined && value.length > schema.maxLength) diagnostics.push(diagnostic('schema_max_length', path, 'String is too long'));
    if (schema.pattern && !(new RegExp(schema.pattern, 'u')).test(value)) diagnostics.push(diagnostic('schema_pattern', path, 'String has an invalid format'));
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) diagnostics.push(diagnostic('schema_minimum', path, 'Number is too small'));
    if (schema.maximum !== undefined && value > schema.maximum) diagnostics.push(diagnostic('schema_maximum', path, 'Number is too large'));
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) diagnostics.push(diagnostic('schema_min_items', path, 'Array has too few items'));
    if (schema.maxItems !== undefined && value.length > schema.maxItems) diagnostics.push(diagnostic('schema_max_items', path, 'Array has too many items'));
    if (schema.uniqueItems && new Set(value.map(stableStringify)).size !== value.length) diagnostics.push(diagnostic('schema_unique_items', path, 'Array items must be unique'));
    if (schema.items) value.forEach((entry, index) => validateJsonSchema(entry, schema.items, `${path}[${index}]`, diagnostics));
  }
  if (isPlainObject(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) diagnostics.push(diagnostic('schema_required', `${path}.${key}`, `Required field ${key} is missing`));
    }
    if (schema.additionalProperties === false) {
      const properties = schema.properties || {};
      for (const key of Object.keys(value)) {
        if (!(key in properties)) diagnostics.push(diagnostic('schema_additional_property', `${path}.${key}`, `Field ${key} is not allowed`));
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) validateJsonSchema(value[key], childSchema, `${path}.${key}`, diagnostics);
    }
  }
}

function validUrl(value) {
  // Browsers read "/\\host" like "//host": backslashes never form a local link.
  if (/^(?:\/|\.?\.\/|#)/u.test(value)) return !value.startsWith('//') && !value.includes('\\');
  try {
    return SAFE_SCHEMES.has(new globalThis.URL(value).protocol);
  } catch {
    return false;
  }
}

function validateInlineContent(value, path, diagnostics) {
  if (!Array.isArray(value)) return;
  for (let index = 0; index < value.length; index += 1) {
    const inline = value[index];
    if (inline?.type === 'link' && !validUrl(inline.href)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}[${index}].href`, 'Link protocol is not allowed'));
    }
  }
}

// Every inline content of a node, with its path: the link rule applies to all
// of them, wherever a type keeps text.
function inlineFields(node, path) {
  const data = isPlainObject(node.data) ? node.data : {};
  const at = (key) => (Array.isArray(data[key]) ? [[data[key], `${path}.data.${key}`]] : []);
  switch (node.type) {
    case 'content.heading':
    case 'content.paragraph':
    case 'content.list-item':
      return at('content');
    case 'content.alert':
    case 'content.step':
      return at('title');
    case 'content.details':
      return at('summary');
    case 'content.figure':
      return at('caption');
    case 'content.table':
      return [
        ...at('caption'),
        ...(Array.isArray(data.rows) ? data.rows : []).flatMap((row, rowIndex) => (Array.isArray(row) ? row : [])
          .map((cell, cellIndex) => [cell, `${path}.data.rows[${rowIndex}][${cellIndex}]`])),
      ];
    default:
      return [];
  }
}

// Content rules beyond a type's own schema: links and image sources follow the
// Document's URL rule, an item type stands only in its own parent, and a
// layout holds at most one outlet.
function validateContentRules(root, diagnostics) {
  let outlets = 0;
  const visit = (node, path, parentType) => {
    if (!isPlainObject(node)) return;
    for (const [content, contentPath] of inlineFields(node, path)) validateInlineContent(content, contentPath, diagnostics);
    if ((node.type === 'content.figure' || node.type === 'content.media') && typeof node.data?.src === 'string' && !validUrl(node.data.src)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}.data.src`, 'Image source protocol is not allowed'));
    }
    if (node.type === 'content.file' && typeof node.data?.href === 'string' && !validUrl(node.data.href)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}.data.href`, 'File address protocol is not allowed'));
    }
    const parent = CONTENT_ITEM_PARENTS[node.type];
    if (parent && parentType !== parent) diagnostics.push(diagnostic('content_parent_invalid', path, `${node.type} must be a direct child of ${parent}`));
    if (node.type === 'content.outlet') {
      outlets += 1;
      if (outlets > 1) diagnostics.push(diagnostic('outlet_duplicate', path, 'A layout holds the page content in one place'));
    }
    for (const [slotName, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (Array.isArray(children)) children.forEach((child, index) => visit(child, `${path}.slots.${slotName}[${index}]`, node.type));
    }
  };
  visit(root, '$.root', null);
}

let defaultPorts = null;

function normalizePorts(ports) {
  if (ports?.elements instanceof Map) return ports;
  if (Array.isArray(ports)) return createPortRegistry(ports);
  if (ports && Array.isArray(ports.manifests)) return createPortRegistry(ports.manifests, { bindings: ports.bindings });
  defaultPorts = defaultPorts || createPortRegistry(BUILTIN_PORT_MANIFESTS);
  return defaultPorts;
}

function normalizeRegistry(registry) {
  if (registry?.types instanceof Map) return registry;
  return createRegistry(Array.isArray(registry) ? registry : BUILTIN_TYPE_MANIFESTS);
}

export function createRegistry(manifests = BUILTIN_TYPE_MANIFESTS, renderers = {}) {
  const types = new Map();
  for (const manifest of manifests) {
    // Either form of the format name (schema-name.mjs).
    if (!isPlainObject(manifest) || !isSchema(manifest, 'simai.composition.type-manifest', 1)) throw new TypeError('composition_manifest_invalid');
    if (types.has(manifest.type)) throw new TypeError(`composition_manifest_duplicate:${manifest.type}`);
    types.set(manifest.type, canonical(manifest));
  }
  return { types, renderers: new Map(Object.entries(renderers)) };
}

// A registry of the built-in types plus a product's own. createRegistry(list)
// takes the list as the whole registry, which is what a test of one type wants
// and what a product adding a type does not: the built-in layout types were
// gone from every registry made from a product's list alone, and they were not
// exported to add back (documentation trial, 2026-10-12).
export function extendRegistry(manifests = [], renderers = {}) {
  return createRegistry([...BUILTIN_TYPE_MANIFESTS, ...manifests], renderers);
}

export function compositionTypeFromSmartManifest(manifest) {
  const declaration = manifest?.composition?.declarative;
  if (!declaration) return null;
  const inputs = manifest.inputs?.properties || {};
  // Structure and request-bound data travel in separate channels: props are the
  // structure a document holds, data is what a host answers with. Both are
  // closed and both come from the component's own declared inputs.
  const pick = (names) => Object.fromEntries(Object.entries(inputs).filter(([key]) => new Set(names || []).has(key)));
  // Request-bound data is described by the component's own declared contracts,
  // not by attributes: rows and columns arrive from a host, not from markup.
  const dataProperties = Object.fromEntries(Object.entries(declaration.data || {}).map(([key, binding]) => {
    const schema = manifest.contracts?.[binding.contract];
    if (!schema) throw new TypeError(`composition_data_contract_missing:${declaration.type}:${key}`);
    return [key, schema];
  }));
  const events = Object.fromEntries((declaration.events || [])
    .filter((name) => manifest.events?.[name])
    .map((name) => [name, { summary: manifest.events[name].summary, payload: manifest.events[name].payload }]));
  const persistence = manifest.persistence
    ? {
      mode: manifest.persistence.mode,
      source_of_truth: manifest.persistence.source_of_truth,
      network_owner: manifest.persistence.network_owner,
      settings_key_prop: declaration.persistence?.settings_key_prop ?? null,
      revision_prop: declaration.persistence?.revision_prop ?? null,
    }
    : undefined;
  return {
    ...schemaFields('simai.composition.type-manifest', 1),
    type: declaration.type,
    version: manifest.version,
    category: 'smart',
    mode: declaration.mode,
    profiles: declaration.profiles,
    data_schema: { type: 'object', additionalProperties: false, properties: dataProperties },
    props_schema: { type: 'object', additionalProperties: false, properties: pick(declaration.props) },
    presentation: declaration.presentation || { views: ['default'], presets: [], modifiers: [] },
    slots: declaration.slots || {},
    renderer: declaration.renderer,
    assets: declaration.assets || [],
    capabilities: ['html', 'hydration'],
    ...(Object.keys(events).length ? { events } : {}),
    ...(persistence ? { persistence } : {}),
  };
}

export function validate(document, registry = undefined, options = {}) {
  const diagnostics = [];
  const resolvedRegistry = normalizeRegistry(registry);
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const supportedExtensions = new Set([ENDPOINT_EXTENSION, ...(options.supportedExtensions || [])]);
  let serialized;
  try {
    serialized = JSON.stringify(document);
  } catch {
    return { valid: false, diagnostics: [diagnostic('document_not_json', '$', 'Document must be JSON serializable')] };
  }
  if (new globalThis.TextEncoder().encode(serialized).byteLength > limits.maxDocumentBytes) diagnostics.push(diagnostic('document_too_large', '$', 'Document exceeds the byte limit'));
  if (!isPlainObject(document)) return { valid: false, diagnostics: [diagnostic('document_invalid', '$', 'Document must be an object')] };
  pushUnknownFields(document, DOCUMENT_FIELDS, '$', diagnostics);
  if (!isSchema(document, 'simai.composition.document', 1)) diagnostics.push(diagnostic('schema_unknown', '$.schema', `Expected ${DOCUMENT_SCHEMA}, or simai.composition.document with schema_version 1`));
  if (typeof document.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u.test(document.id)) diagnostics.push(diagnostic('document_id_invalid', '$.id', 'Document id is invalid'));
  if (!PROFILES.has(document.profile)) diagnostics.push(diagnostic('profile_unknown', '$.profile', 'Profile is not supported'));
  if (document.locale !== undefined && (typeof document.locale !== 'string' || !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(document.locale))) diagnostics.push(diagnostic('locale_invalid', '$.locale', 'Locale is invalid'));
  if (document.extensions !== undefined) validateExtensions(document.extensions, '$.extensions', diagnostics, supportedExtensions);
  scanForbiddenKeys(document, '$', diagnostics);

  const ids = new Set();
  let nodeCount = 0;
  const visit = (node, path, depth) => {
    nodeCount += 1;
    if (nodeCount > limits.maxNodes) return;
    if (depth > limits.maxDepth) diagnostics.push(diagnostic('depth_limit', path, 'Composition is too deeply nested'));
    if (!isPlainObject(node)) {
      diagnostics.push(diagnostic('node_invalid', path, 'Node must be an object'));
      return;
    }
    pushUnknownFields(node, NODE_FIELDS, path, diagnostics);
    if (typeof node.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u.test(node.id)) diagnostics.push(diagnostic('node_id_invalid', `${path}.id`, 'Node id is invalid'));
    else if (ids.has(node.id)) diagnostics.push(diagnostic('node_id_duplicate', `${path}.id`, `Duplicate node id ${node.id}`));
    else ids.add(node.id);
    const manifest = resolvedRegistry.types.get(node.type);
    if (!manifest) {
      diagnostics.push(diagnostic('type_unknown', `${path}.type`, `Unknown type ${node.type || ''}`));
      return;
    }
    if (!manifest.profiles.includes(document.profile)) diagnostics.push(diagnostic('type_profile_unsupported', `${path}.type`, `${node.type} does not support ${document.profile}`));
    validateJsonSchema(node.data || {}, manifest.data_schema, `${path}.data`, diagnostics);
    validateJsonSchema(node.props || {}, manifest.props_schema, `${path}.props`, diagnostics);
    if (node.presentation !== undefined) {
      if (!isPlainObject(node.presentation)) diagnostics.push(diagnostic('presentation_invalid', `${path}.presentation`, 'Presentation must be an object'));
      else {
        pushUnknownFields(node.presentation, PRESENTATION_FIELDS, `${path}.presentation`, diagnostics);
        const contract = manifest.presentation || {};
        if (node.presentation.view && !(contract.views || []).includes(node.presentation.view)) diagnostics.push(diagnostic('view_unknown', `${path}.presentation.view`, 'View is not registered'));
        if (node.presentation.preset && !(contract.presets || []).includes(node.presentation.preset)) diagnostics.push(diagnostic('preset_unknown', `${path}.presentation.preset`, 'Preset is not registered'));
        if (node.presentation.modifiers !== undefined) {
          if (!Array.isArray(node.presentation.modifiers)) diagnostics.push(diagnostic('modifiers_invalid', `${path}.presentation.modifiers`, 'Modifiers must be an array'));
          else for (const modifier of node.presentation.modifiers) if (!(contract.modifiers || []).includes(modifier)) diagnostics.push(diagnostic('modifier_unknown', `${path}.presentation.modifiers`, `Modifier ${modifier} is not registered`));
        }
      }
    }
    if (node.extensions !== undefined) validateExtensions(node.extensions, `${path}.extensions`, diagnostics, supportedExtensions);
    if (node.bindings !== undefined) {
      if (!Array.isArray(node.bindings)) diagnostics.push(diagnostic('bindings_invalid', `${path}.bindings`, 'Bindings must be an array'));
      else node.bindings.forEach((binding, index) => {
        const bindingPath = `${path}.bindings[${index}]`;
        if (!isPlainObject(binding)) diagnostics.push(diagnostic('binding_invalid', bindingPath, 'Binding must be an object'));
        else {
          pushUnknownFields(binding, BINDING_FIELDS, bindingPath, diagnostics);
          for (const key of ['owner', 'ref', 'target']) if (typeof binding[key] !== 'string' || !binding[key]) diagnostics.push(diagnostic('binding_field_invalid', `${bindingPath}.${key}`, `${key} is required`));
          if (binding.revision !== undefined && (typeof binding.revision !== 'string' || !binding.revision)) diagnostics.push(diagnostic('binding_revision_invalid', `${bindingPath}.revision`, 'Revision must be a non-empty string'));
        }
      });
    }
    const slots = node.slots || {};
    if (!isPlainObject(slots)) {
      diagnostics.push(diagnostic('slots_invalid', `${path}.slots`, 'Slots must be an object'));
      return;
    }
    if (manifest.mode === 'leaf' && Object.keys(slots).length) diagnostics.push(diagnostic('leaf_slots_forbidden', `${path}.slots`, 'Leaf type cannot contain slots'));
    for (const [slotName, children] of Object.entries(slots)) {
      const slot = manifest.slots?.[slotName];
      if (!slot) {
        diagnostics.push(diagnostic('slot_unknown', `${path}.slots.${slotName}`, `Slot ${slotName} is not registered`));
        continue;
      }
      if (!Array.isArray(children)) {
        diagnostics.push(diagnostic('slot_children_invalid', `${path}.slots.${slotName}`, 'Slot children must be an array'));
        continue;
      }
      if (children.length > limits.maxChildrenPerSlot || children.length > slot.max || children.length < slot.min) diagnostics.push(diagnostic('slot_cardinality', `${path}.slots.${slotName}`, 'Slot child count is outside the allowed range'));
      children.forEach((child, index) => {
        const childManifest = resolvedRegistry.types.get(child?.type);
        if (childManifest && slot.types && !slot.types.includes(child.type)) diagnostics.push(diagnostic('slot_child_type_forbidden', `${path}.slots.${slotName}[${index}]`, `${child.type} is not allowed in this slot`));
        if (childManifest && slot.categories && !slot.categories.includes(childManifest.category)) diagnostics.push(diagnostic('slot_child_category_forbidden', `${path}.slots.${slotName}[${index}]`, `${childManifest.category} is not allowed in this slot`));
        visit(child, `${path}.slots.${slotName}[${index}]`, depth + 1);
      });
    }
    for (const [slotName, slot] of Object.entries(manifest.slots || {})) {
      if (slot.min > 0 && !(slotName in slots)) diagnostics.push(diagnostic('slot_required', `${path}.slots.${slotName}`, `Slot ${slotName} is required`));
    }
  };
  visit(document.root, '$.root', 1);
  if (nodeCount > limits.maxNodes) diagnostics.push(diagnostic('node_limit', '$.root', 'Composition has too many nodes'));
  else {
    validateRegionRules(document.root, resolvedRegistry, diagnostics);
    validateContentRules(document.root, diagnostics);
    resolveRoutes(document.root, resolvedRegistry, normalizePorts(options.ports), diagnostics);
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

function collectDependencies(node, manifest, output) {
  for (const asset of manifest.assets || []) output.assets.add(asset);
  for (const binding of node.bindings || []) output.bindings.set(`${binding.owner}:${binding.ref}:${binding.target}:${binding.revision || ''}`, canonical(binding));
}

export async function normalize(document, registry = undefined, options = {}) {
  const resolvedRegistry = normalizeRegistry(registry);
  const result = validate(document, resolvedRegistry, options);
  if (!result.valid) return { document: null, digest: null, dependencies: { assets: [], bindings: [] }, diagnostics: result.diagnostics };
  const normalized = canonical(JSON.parse(JSON.stringify(document)));
  const dependencies = { assets: new Set(), bindings: new Map() };
  const visit = (node) => {
    collectDependencies(node, resolvedRegistry.types.get(node.type), dependencies);
    Object.values(node.slots || {}).flat().forEach(visit);
  };
  visit(normalized.root);
  return {
    document: normalized,
    digest: await sha256(stableStringify(normalized)),
    dependencies: {
      assets: [...dependencies.assets].sort(),
      bindings: [...dependencies.bindings.values()].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    },
    diagnostics: [],
  };
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function renderInline(content) {
  return (content || []).map((inline) => {
    if (inline.type === 'link') return `<a href="${escapeHtml(inline.href)}">${renderInline(inline.children)}</a>`;
    if (inline.type !== 'text') {
      // An atom draws its own element, its props escaped as text; anything
      // else (validation refuses it) draws nothing rather than "undefined".
      const view = inlineComponentView(inline);
      if (!view) return '';
      const attributes = view.attributes.map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`)).join('');
      return `<${view.tag}${attributes}>${escapeHtml(view.text)}</${view.tag}>`;
    }
    let output = escapeHtml(inline.value);
    for (const mark of inline.marks || []) output = mark === 'strong' ? `<strong>${output}</strong>` : mark === 'em' ? `<em>${output}</em>` : `<code>${output}</code>`;
    return output;
  }).join('');
}

const id = (node) => ` data-sf-composition-id="${escapeHtml(node.id)}"`;
// Docara's ratio words and the figure's modifier: 16/9 is sf-figure--ratio-16x9.
const ratioClass = (ratio) => (ratio && ratio !== 'auto' ? ` sf-figure--ratio-${ratio.replace('/', 'x')}` : '');
const ALERT_ICONS = { neutral: 'info', info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
const GRID_COLUMNS = {
  1: 'grid-col-1',
  2: 'grid-col-1 md:grid-col-2',
  3: 'grid-col-1 md:grid-col-2 lg:grid-col-3',
  4: 'grid-col-1 md:grid-col-2 lg:grid-col-4',
};

function renderImage(data) {
  const size = ['width', 'height'].filter((key) => Number.isInteger(data[key])).map((key) => ` ${key}="${data[key]}"`).join('');
  return `<img src="${escapeHtml(data.src)}" alt="${escapeHtml(data.alt)}"${size} loading="lazy" decoding="async">`;
}

// The icon of a file's kind, by its media type: sf-download-file's own glyph
// when the type says nothing a reader would recognise.
const FILE_ICONS = [
  [/^application\/pdf$/u, 'picture_as_pdf'],
  [/^image\//u, 'image'],
  [/^video\//u, 'movie'],
  [/^audio\//u, 'audio_file'],
  [/^application\/(?:zip|x-zip-compressed|x-7z-compressed|x-rar-compressed|vnd\.rar|x-tar|gzip|x-gzip)$/u, 'folder_zip'],
  [/^(?:text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.[a-z.]+|application\/vnd\.oasis\.opendocument\.spreadsheet)$/u, 'table_chart'],
  [/^(?:application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.[a-z.]+|application\/vnd\.oasis\.opendocument\.presentation)$/u, 'slideshow'],
  [/^(?:text\/|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.[a-z.]+$|application\/vnd\.oasis\.opendocument\.text$|application\/rtf$)/u, 'description'],
];
function fileIcon(mime) {
  if (typeof mime !== 'string' || !mime) return 'download';
  return FILE_ICONS.find(([pattern]) => pattern.test(mime))?.[1] ?? 'download';
}

// sf-download-file's row, drawn as a plain link: it downloads with no script,
// the name falls back to the address's last part, and the size reads in the
// Document's language.
function renderFile(node, locale) {
  const { href, label, mime, size } = node.data;
  const name = label || fileNameFromAddress(href) || href;
  const type = mime ? ` type="${escapeHtml(mime)}"` : '';
  const sizeText = Number.isInteger(size) ? formatFileSize(size, fileSizeUnits(locale), locale) : '';
  const sizePart = sizeText ? `<span class="sf-download-file__size sf-download-file-file-size">${escapeHtml(sizeText)}</span>` : '';
  return `<a class="sf-download-file" href="${escapeHtml(href)}" download${type}${id(node)}><span class="sf-download-file__body sf-download-file-wrap"><span class="sf-download-file__main sf-download-file-container"><i class="sf-download-file__icon sf-icon" aria-hidden="true">${fileIcon(mime)}</i><span class="sf-download-file__name sf-download-file-file-name">${escapeHtml(name)}</span></span>${sizePart}</span></a>`;
}

function renderTable(node) {
  const { rows } = node.data;
  const header = node.props?.header ?? 'row';
  const headRow = header === 'row' || header === 'both';
  const headColumn = header === 'column' || header === 'both';
  const align = Array.isArray(node.props?.align) ? node.props.align : [];
  // The frame sets every cell to the start; a column set otherwise says so on
  // its cells, with one of two fixed values.
  const cellStyle = (index) => (align[index] === 'center' || align[index] === 'end' ? ` style="text-align: ${align[index]}"` : '');
  const cell = (content, index, tag, scope) => `<${tag}${scope ? ` scope="${scope}"` : ''}${cellStyle(index)}>${renderInline(content)}</${tag}>`;
  const row = (cells, inHead) => `<tr>${cells.map((content, index) => (inHead
    ? cell(content, index, 'th', 'col')
    : headColumn && index === 0 ? cell(content, index, 'th', 'row') : cell(content, index, 'td', null))).join('')}</tr>`;
  const caption = Array.isArray(node.data.caption) ? `<caption>${renderInline(node.data.caption)}</caption>` : '';
  const head = headRow ? `<thead>${row(rows[0], true)}</thead>` : '';
  const body = (headRow ? rows.slice(1) : rows).map((cells) => row(cells, false)).join('');
  return `<div class="table-frame"${id(node)}><table class="table">${caption}${head}${body ? `<tbody>${body}</tbody>` : ''}</table></div>`;
}

function renderCode(node) {
  const lang = node.props?.lang;
  const language = lang ? ` class="language-${escapeHtml(lang)}" data-lang="${escapeHtml(lang)}"` : '';
  const lines = node.props?.numbers === true ? ' data-lines' : '';
  const code = `<div class="sf-highlight"${node.props?.title ? '' : id(node)}><pre><code${language}${lines}>${escapeHtml(node.data.code)}</code></pre></div>`;
  if (!node.props?.title) return code;
  return `<figure class="flex flex-col gap-1/2 m-0"${id(node)}><figcaption class="text-1/2 weight-5 color-on-surface-variant">${escapeHtml(node.props.title)}</figcaption>${code}</figure>`;
}

function renderTabs(node, slots) {
  const tabs = node.slots.tabs;
  const panels = slots.tabsList || [];
  const label = node.data?.label ? ` aria-label="${escapeHtml(node.data.label)}"` : '';
  // The first tab is selected; the tabs runtime adds roles, ids and keys.
  const buttons = tabs.map((tab, index) => `<button type="button" class="sf-button sf-button--default sf-button--primary sf-button--size-1${index === 0 ? ' selected' : ''}"><span class="sf-button-text-container">${escapeHtml(tab.data.label)}</span></button>`).join('');
  const bodies = tabs.map((tab, index) => `<div class="sf-tabs-main-tab${index === 0 ? ' selected' : ''}"${id(tab)}${index === 0 ? '' : ' hidden'}>${panels[index] || ''}</div>`).join('');
  return `<div class="sf-tabs sf-tabs--underline flex flex-col"${id(node)}><div class="sf-tabs-top-container"><div class="sf-tabs-top flex"${label}>${buttons}</div></div><div class="sf-tabs-main-container">${bodies}</div></div>`;
}

function renderSteps(node, slots) {
  const steps = node.slots.steps;
  const items = slots.stepsList || [];
  const current = Number.isInteger(node.props?.current) ? node.props.current : null;
  const layout = node.props?.layout === 'list' ? ' sf-procedure--list' : '';
  return `<ol class="sf-procedure${layout}"${id(node)}>${steps.map((step, index) => {
    const number = index + 1;
    const state = current === null ? '' : number < current ? ' sf-procedure-step--complete' : number === current ? ' sf-procedure-step--current' : '';
    return `<li class="sf-procedure-step${state}"${id(step)}${current === number ? ' aria-current="step"' : ''}>${items[index] || ''}</li>`;
  }).join('')}</ol>`;
}

function renderMedia(node, slots) {
  const figure = `<figure class="sf-figure${ratioClass(node.props?.ratio ?? '16/9')}"><div class="sf-figure-media">${renderImage(node.data)}</div></figure>`;
  const text = `<div class="min-w-0">${slots.default || ''}</div>`;
  const parts = node.props?.side === 'left' ? figure + text : text + figure;
  return `<div class="grid grid-col-1 md:grid-col-2 gap-3 items-cross-center"${id(node)}>${parts}</div>`;
}

const BUILTIN_RENDERERS = {
  'layout.page': ({ node, slots }) => `<main data-sf-composition-id="${escapeHtml(node.id)}">${slots.default || ''}</main>`,
  'layout.section': ({ node, slots }) => `<section data-sf-composition-id="${escapeHtml(node.id)}">${slots.default || ''}</section>`,
  'layout.columns': ({ node, slots }) => {
    const columns = Number.isInteger(node.props?.columns) ? ` data-composition-columns="${node.props.columns}"` : '';
    return `<div class="sf-composition-columns" data-sf-composition-id="${escapeHtml(node.id)}"${columns}>${(slots.columnsList || []).map((child) => `<div class="sf-composition-column">${child}</div>`).join('')}</div>`;
  },
  'content.heading': ({ node }) => `<h${node.data.level || 2} data-sf-composition-id="${escapeHtml(node.id)}">${renderInline(node.data.content)}</h${node.data.level || 2}>`,
  'content.paragraph': ({ node }) => `<p data-sf-composition-id="${escapeHtml(node.id)}">${renderInline(node.data.content)}</p>`,
  'layout.regions': ({ node, slots }) => `<div class="sf-composition-regions" data-sf-composition-id="${escapeHtml(node.id)}"><div class="sf-composition-regions-grid">${slots.regions || ''}</div></div>`,
  'layout.region': ({ node, slots }) => {
    const props = node.props;
    const element = REGION_ELEMENTS[props.landmark];
    const sticky = props.sticky === true ? ' data-sf-region-sticky=""' : '';
    const label = props.label !== undefined ? ` aria-label="${escapeHtml(props.label)}"` : '';
    return `<${element} class="sf-composition-region" data-sf-composition-id="${escapeHtml(node.id)}" data-sf-region="${escapeHtml(props.name)}" data-sf-region-placement="${escapeHtml(props.placement ?? 'block')}"${sticky}${label}>${slots.default || ''}</${element}>`;
  },
  'layout.scope': ({ node, slots, routes }) => `<sf-composition-scope data-sf-composition-id="${escapeHtml(node.id)}" data-sf-routes="${escapeHtml(routesAttribute(routes || []))}">${slots.default || ''}</sf-composition-scope>`,
  'content.document': ({ node, slots }) => `<article${id(node)}>${node.data?.title ? `<h1>${escapeHtml(node.data.title)}</h1>` : ''}${slots.default || ''}</article>`,
  'content.list': ({ node, slots }) => {
    const ordered = node.props?.ordered === true;
    const start = ordered && Number.isInteger(node.props?.start) && node.props.start !== 1 ? ` start="${node.props.start}"` : '';
    return `<${ordered ? 'ol' : 'ul'}${start}${id(node)}>${slots.items || ''}</${ordered ? 'ol' : 'ul'}>`;
  },
  'content.list-item': ({ node, slots }) => `<li${id(node)}>${renderInline(node.data.content)}${slots.default || ''}</li>`,
  'content.quote': ({ node, slots }) => `<blockquote${id(node)}>${slots.default || ''}</blockquote>`,
  'content.code': ({ node }) => renderCode(node),
  'content.divider': ({ node }) => `<hr class="sf-divider sf-divider-horizontal"${id(node)}>`,
  'content.table': ({ node }) => renderTable(node),
  'content.figure': ({ node }) => {
    const fit = node.props?.fit === 'contain' ? ' sf-figure--contain' : '';
    const caption = Array.isArray(node.data.caption) ? `<figcaption class="sf-figure-caption">${renderInline(node.data.caption)}</figcaption>` : '';
    return `<figure class="sf-figure${ratioClass(node.props?.ratio)}${fit}"${id(node)}><div class="sf-figure-media">${renderImage(node.data)}</div>${caption}</figure>`;
  },
  'content.alert': ({ node, slots }) => {
    const status = node.props?.status ?? 'neutral';
    const appearance = node.props?.appearance ?? 'default';
    const title = Array.isArray(node.data?.title) ? `<div class="sf-alert-text">${renderInline(node.data.title)}</div>` : '';
    const body = slots.default ? `<div class="sf-alert-supporting-text">${slots.default}</div>` : '';
    return `<div class="sf-alert sf-alert--${status} sf-alert--${appearance} flex items-start"${id(node)}><i class="sf-icon" aria-hidden="true">${ALERT_ICONS[status]}</i><div class="sf-alert-wrap flex flex-col flex-1"><div class="sf-alert-content flex flex-col flex-1">${title}${body}</div></div></div>`;
  },
  // Native details: it opens and closes with no script.
  'content.details': ({ node, slots }) => {
    const lines = node.props?.layout === 'lines';
    const frame = lines ? 'border-bottom-1 border-bottom-solid border-outline-variant p-y-1' : 'bg-surface-0 border-1 border-solid border-outline-variant radius-2 p-2';
    return `<details class="${frame}"${id(node)}${node.props?.open === true ? ' open' : ''}><summary class="weight-5 cursor-pointer">${renderInline(node.data.summary)}</summary><div class="p-top-1">${slots.default || ''}</div></details>`;
  },
  'content.tabs': ({ node, slots }) => renderTabs(node, slots),
  // A tab is drawn by its tabs: the panel is theirs, the content its own.
  'content.tab': ({ slots }) => slots.default || '',
  'content.steps': ({ node, slots }) => renderSteps(node, slots),
  // A step is drawn by its steps: the item is theirs, title and content its own.
  'content.step': ({ node, slots }) => {
    const title = Array.isArray(node.data?.title) ? `<div class="sf-procedure-title">${renderInline(node.data.title)}</div>` : '';
    return `${title}<div class="sf-procedure-content">${slots.default || ''}</div>`;
  },
  'content.grid': ({ node, slots }) => {
    const columns = GRID_COLUMNS[node.props?.columns ?? 3];
    const gap = Number.isInteger(node.props?.gap) ? node.props.gap : 2;
    return `<div class="grid ${columns} gap-${gap}"${id(node)}>${(slots.defaultList || []).map((child) => `<div class="min-w-0">${child}</div>`).join('')}</div>`;
  },
  'content.card': ({ node, slots }) => `<div class="sf-card${node.props?.variant === 'plain' ? ' sf-card--plain' : ''}"${id(node)}>${slots.default || ''}</div>`,
  'content.media': ({ node, slots }) => renderMedia(node, slots),
  'content.file': ({ node, locale }) => renderFile(node, locale),
  // Cleaned at render by the html@1 subset's one rule: no script, no style, no
  // attribute but a safe href survives.
  'content.html': ({ node }) => `<div${id(node)}>${sanitizeRichText(node.data.markup)}</div>`,
  'content.outlet': ({ node, outlet }) => `<div data-sf-outlet=""${id(node)}>${outlet || ''}</div>`,
};

export async function render(document, context = {}) {
  const registry = normalizeRegistry(context.registry);
  const normalized = await normalize(document, registry, context.options || {});
  if (!normalized.document) return { html: '', assets: [], hydration: [], diagnostics: normalized.diagnostics, digest: null };
  const diagnostics = [];
  const hydration = [];
  const routes = resolveRoutes(normalized.document.root, registry, normalizePorts(context.options?.ports), []);
  // The page's content for a layout's content.outlet: a structured-content
  // Document, rendered with the same registry; its assets and diagnostics
  // join the layout's.
  let outlet = '';
  const outletAssets = [];
  if (context.content !== undefined) {
    if (context.content?.profile !== 'structured-content') {
      diagnostics.push(diagnostic('outlet_content_invalid', '$.content', 'The page content must be a structured-content Document'));
    } else {
      const { content, ...rest } = context;
      const page = await render(content, rest);
      outlet = page.html;
      outletAssets.push(...page.assets);
      hydration.push(...page.hydration);
      diagnostics.push(...page.diagnostics.map((entry) => ({ ...entry, path: `$.content${entry.path.startsWith('$') ? entry.path.slice(1) : `:${entry.path}`}` })));
    }
  }
  const renderNode = async (node) => {
    const manifest = registry.types.get(node.type);
    const slots = {};
    for (const [name, children] of Object.entries(node.slots || {})) {
      const rendered = [];
      for (const child of children) rendered.push(await renderNode(child));
      slots[name] = rendered.join('');
      slots[`${name}List`] = rendered;
    }
    const resolvedBindings = {};
    for (const binding of node.bindings || []) {
      if (context.resolveBinding) resolvedBindings[binding.target] = await context.resolveBinding(binding, { document: normalized.document, node });
    }
    let renderer = registry.renderers.get(manifest.renderer.name) || BUILTIN_RENDERERS[manifest.renderer.name];
    if (!renderer && manifest.renderer.kind === 'custom-element' && manifest.renderer.name) {
      renderer = ({ node: current, slots: currentSlots, endpoint }) => {
        const endpointAttribute = endpoint ? ` data-sf-endpoint="${escapeHtml(endpoint)}"` : '';
        const attributes = Object.entries(current.props || {}).map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value)}"`).join('') + endpointAttribute;
        hydration.push({ id: current.id, type: current.type, element: manifest.renderer.name });
        return `<${manifest.renderer.name}${attributes}>${Object.values(currentSlots).filter((value) => typeof value === 'string').join('')}</${manifest.renderer.name}>`;
      };
    }
    if (!renderer) {
      diagnostics.push(diagnostic('renderer_unavailable', `node:${node.id}`, `Renderer ${manifest.renderer.name} is unavailable`));
      return '';
    }
    if (node.type === 'layout.scope') hydration.push({ id: node.id, type: node.type, element: 'sf-composition-scope' });
    return renderer({ node, slots, context, resolvedBindings, manifest, routes: routes.get(node.id), endpoint: endpointName(node), outlet: node.type === 'content.outlet' ? outlet : undefined, locale: normalized.document.locale ?? 'en' });
  };
  const html = await renderNode(normalized.document.root);
  const assets = outletAssets.length ? [...new Set([...normalized.dependencies.assets, ...outletAssets])].sort() : normalized.dependencies.assets;
  return { html, assets, hydration, diagnostics, digest: normalized.digest };
}

export const Composition = Object.freeze({
  BUILTIN_EDITOR_MANIFESTS,
  BUILTIN_FIELD_KINDS,
  BUILTIN_PORT_MANIFESTS,
  EDITOR_FIELD_WORDS,
  EDITOR_WORDS_OWNER,
  Recipe,
  applyFieldValue,
  editorFieldMessages,
  parseFieldSubmission,
  renderFieldFallback,
  resolveFieldKind,
  validateFieldKinds,
  validateFieldValue,
  VALUE_TYPES,
  checkPortValue,
  checkFragmentDescriptor,
  FRAGMENT_DESCRIPTOR_SCHEMA,
  publishEffects,
  createPortRegistry,
  defineCompositionScope,
  startInlineEdit,
  normalizeInline,
  inlineText,
  BUILTIN_TYPE_MANIFESTS,
  createRegistry,
  extendRegistry,
  compositionTypeFromSmartManifest,
  describeRegions,
  normalize,
  projectDocumentEditorFields,
  projectEditorFields,
  render,
  resolveRecipe,
  parseRecipeJson,
  stableStringify,
  validate,
  validateEditorManifest,
});

if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  globalThis.SF.Composition = Composition;
  defineCompositionScope();
  definePageHost();
  defineFragmentBoundary();
}

export default Composition;

export { Recipe, parseRecipeJson, recipeDigest, recipeNodeId, resolveRecipe };
export { BUILTIN_EDITOR_MANIFESTS, EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER, editorFieldMessages, projectDocumentEditorFields, projectEditorFields, validateEditorManifest };
export { BUILTIN_TYPE_MANIFESTS };
export { describeRegions, stableStringify };
export { BUILTIN_PORT_MANIFESTS, VALUE_TYPES, checkPortValue, createPortRegistry, defineCompositionScope };
export { FRAGMENT_DESCRIPTOR_SCHEMA, checkFragmentDescriptor, defineFragmentBoundary, definePageHost, publishEffects };
export { INLINE_MARKS, inlineText, marksIn, normalizeInline, replaceRange, setLink, startInlineEdit, toggleMark };
export { BUILTIN_FIELD_KINDS, applyFieldValue, parseFieldSubmission, renderFieldFallback, resolveFieldKind, validateFieldKinds, validateFieldValue };

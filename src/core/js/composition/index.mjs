import { BUILTIN_EDITOR_MANIFESTS, BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS, CONTENT_ITEM_PARENTS } from './builtins.mjs';
import { EDITOR_FIELD_WORDS, EDITOR_WORDS_OWNER, editorFieldMessages } from './editor-words.mjs';
import { sanitizeRichText } from './html-subset.mjs';
import { fileIcon, fileNameFromAddress, fileSizeUnits, formatFileSize } from './file-size.mjs';
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
import {
  MODIFIERS_EXTENSION,
  UTILITY_BREAKPOINTS,
  checkModifiers,
  checkResponsiveProps,
  isBreakpointValue,
  isResponsive,
  modifierNotices,
  ownModifiers,
  utilityClassSpace,
  utilityClasses,
  utilityPartClasses,
  validateUtilityDeclarations,
  withPartClasses,
  valueSchema,
  valuesByBreakpoint,
  withClasses,
} from './utilities.mjs';
import {
  BUILTIN_CATALOGUE,
  BUILTIN_CATALOGUE_ALSO_IN,
  BUILTIN_CATALOGUE_ICONS,
  CATALOGUE_GROUPS,
  CATALOGUE_GROUP_ALIASES,
  CATALOGUE_GROUP_TABLE,
  CATALOGUE_TABS,
  catalogue,
  catalogueEntry,
  catalogueGroup,
  entryGroups,
  instantiateVariant,
  slotAccepts,
  slotPlaces,
  validateCatalogueFields,
} from './catalogue.mjs';
import { PRINTED_ELEMENTS, checkPrintedElements as checkPrintedElementsWith, elementInputs, printElement as printElementWith } from './elements.mjs';
import {
  PARAMETER_SETS,
  PARAMETER_SET_NAMES,
  effectiveProps,
  expandParameterSets,
  parameterSetFields,
  parameterSetParts,
  validateParameterDefaults,
  validateParameterSets,
  withParameterSetFields,
} from './parameter-sets.mjs';
import {
  COMPOSED_EXTENSION,
  MAX_COMPOSED_DEPTH,
  composedEditorManifest as composedEditorManifestWith,
  composedInstance,
  composedPart,
  composedTextPaths,
  defineComposedType as defineComposed,
  expandComposed,
  isComposed,
  upgradeComposed as upgradeComposedWith,
  validateComposedInstance,
} from './composed.mjs';
import {
  BINDING_STATES,
  DATA_EXTENSION,
  DATA_SHAPES,
  RUNTIME_OWNER,
  SOURCE_PORT,
  bindingSettings,
  checkSourceAnswer as checkSourceAnswerWith,
  createShapeRegistry,
  demoData,
  resolveData,
  takesData,
  validateDataDeclarations,
  validateDataRules,
} from './data.mjs';

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
  'cssclass', 'style', 'secret', 'password', 'token', 'cookie', 'authorization', 'request',
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
    // patternProperties: a key matching a pattern is declared by it (the
    // inline model's extension keys, 2026-11-11).
    const patterns = Object.entries(schema.patternProperties || {}).map(([pattern, childSchema]) => [new RegExp(pattern, 'u'), childSchema]);
    if (schema.additionalProperties === false) {
      const properties = schema.properties || {};
      for (const key of Object.keys(value)) {
        if (!(key in properties) && !patterns.some(([pattern]) => pattern.test(key))) diagnostics.push(diagnostic('schema_additional_property', `${path}.${key}`, `Field ${key} is not allowed`));
      }
    }
    for (const [pattern, childSchema] of patterns) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties || {})) && pattern.test(key)) validateJsonSchema(value[key], childSchema, `${path}.${key}`, diagnostics);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) validateJsonSchema(value[key], childSchema, `${path}.${key}`, diagnostics);
    }
  }
}

// The inline model as content.paragraph holds it: what a site block's text is.
const INLINE_SCHEMA = BUILTIN_TYPE_MANIFESTS.find(({ type }) => type === 'content.paragraph').data_schema.properties.content;
function checkInline(content, path, diagnostics) {
  validateJsonSchema(content, INLINE_SCHEMA, path, diagnostics);
  validateInlineContent(content, path, diagnostics);
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

// A picture the host keeps in the browser (IndexedDB, before a server store)
// is shown from an object URL. Such an address is only ever one a host's
// resolveSource gave at render (simai/ui-source#71), never one a Document
// stores, and only of the page's own origin: a blob: address is the page's.
function hostBlobUrl(value) {
  const match = /^blob:(https?:\/\/[^/]+)\//u.exec(String(value));
  if (!match) return false;
  const origin = globalThis.location?.origin;
  return !origin || origin === 'null' || origin === match[1];
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
function validateContentRules(root, diagnostics, { hostSources = false } = {}) {
  let outlets = 0;
  const visit = (node, path, parentType) => {
    if (!isPlainObject(node)) return;
    for (const [content, contentPath] of inlineFields(node, path)) validateInlineContent(content, contentPath, diagnostics);
    // With a host source resolver the stored name is the host's (media:<id>),
    // and the address it resolves to is checked where it is drawn.
    if ((node.type === 'content.figure' || node.type === 'content.media') && typeof node.data?.src === 'string' && !hostSources && !validUrl(node.data.src)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}.data.src`, 'Image source protocol is not allowed'));
    }
    if (node.type === 'element.button' && typeof node.data?.href === 'string' && !validUrl(node.data.href)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}.data.href`, 'Link protocol is not allowed'));
    }
    if (node.type === 'form.form' && typeof node.data?.action === 'string' && !validUrl(node.data.action)) {
      diagnostics.push(diagnostic('unsafe_url', `${path}.data.action`, 'Form address protocol is not allowed'));
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
    // A type's parameter sets join its props (parameter-sets.mjs).
    types.set(manifest.type, canonical(expandParameterSets(manifest)));
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

// How a node of an unregistered type is met: 'refuse' (the default, type_unknown
// makes the Document invalid) or 'placeholder' (G-32).
const UNKNOWN_MODES = new Set(['refuse', 'placeholder']);
function unknownAsPlaceholder(options) {
  const mode = options?.unknown ?? 'refuse';
  if (!UNKNOWN_MODES.has(mode)) throw new TypeError(`composition_unknown_mode_invalid:${String(mode)}`);
  return mode === 'placeholder';
}

// options.embedded (simai/ui-source#60): the Document is drawn inside a host
// page that holds its own main landmark -- an editor's canvas. layout.page and
// a main layout.region are drawn as plain elements marked
// data-sf-composition-landmark="main", so the page keeps one main. The default,
// false, is what a publishing host keeps; anything but a boolean throws.
function renderEmbedded(options) {
  const embedded = options?.embedded === undefined ? false : options.embedded;
  if (typeof embedded !== 'boolean') throw new TypeError(`composition_embedded_invalid:${String(embedded)}`);
  return embedded;
}

// The placeholder of a node whose type the host does not know: its type as
// text, its id kept for the editor's selection, nothing of its data or slots.
const unknownPlaceholder = (node) => `<div class="sf-composition-unknown" role="note" data-sf-composition-type="${escapeHtml(node.type)}" data-sf-composition-id="${escapeHtml(node.id)}">${escapeHtml(node.type)}</div>`;

export function validate(document, registry = undefined, options = {}) {
  const diagnostics = [];
  const notices = [];
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
  const knownProfile = PROFILES.has(document.profile);
  if (!knownProfile) diagnostics.push(diagnostic('profile_unknown', '$.profile', 'Profile is not supported'));
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
      // unknown: 'placeholder' (G-32, for an editor's canvas): a node of a
      // type this host does not know is a notice, not a refusal; render draws
      // it as a placeholder and the rest of the page. Its own data and slots
      // are left unread. The default stays strict: a publishing host refuses.
      const unknown = diagnostic('type_unknown', `${path}.type`, `Unknown type ${node.type || ''}`);
      if (unknownAsPlaceholder(options) && typeof node.type === 'string' && node.type) notices.push(unknown);
      else diagnostics.push(unknown);
      return;
    }
    // An unknown profile is one diagnostic ($.profile): no type lists it, so a
    // per-node check would repeat it once for every node of the Document.
    if (knownProfile && !manifest.profiles.includes(document.profile)) diagnostics.push(diagnostic('type_profile_unsupported', `${path}.type`, `${node.type} does not support ${document.profile}`));
    validateJsonSchema(node.data || {}, manifest.data_schema, `${path}.data`, diagnostics);
    // A layout parameter may hold a value per breakpoint (utilities.mjs): each
    // value is checked on its own, the rest of the props as before.
    const responsive = checkResponsiveProps(node.props || {}, manifest.props_schema, `${path}.props`, validateJsonSchema);
    diagnostics.push(...responsive.diagnostics);
    validateJsonSchema(responsive.props, responsive.schema || manifest.props_schema, `${path}.props`, diagnostics);
    // A block's own modifiers never refuse a Document: a class no utility rule
    // knows is left out of the HTML and reported.
    notices.push(...modifierNotices(node, { rules: options.utilityRules }).notices);
    if (isComposed(manifest)) {
      const instance = validateComposedInstance(node, manifest, resolvedRegistry, path, checkInline);
      diagnostics.push(...instance.diagnostics);
      notices.push(...instance.notices);
      const depth = (options.composedDepth || 0) + 1;
      if (depth > MAX_COMPOSED_DEPTH) diagnostics.push(diagnostic('composed_depth_limit', path, 'Site blocks are nested too deeply'));
      else {
        const expanded = validate({ ...document, root: expandComposed(node, manifest) }, resolvedRegistry, { ...options, composedDepth: depth });
        // The Document's own profile diagnostic is already reported once.
        diagnostics.push(...expanded.diagnostics.filter(({ code }) => code !== 'profile_unknown').map((entry) => ({ ...entry, path: `${path}.composed${entry.path.replace(/^\$\.root/u, '').replace(/^\$/u, '')}` })));
        notices.push(...(expanded.notices || []));
      }
    }
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
        if (childManifest && slot.groups && !entryGroups(catalogueEntry(childManifest)).some((group) => slot.groups.map(catalogueGroup).includes(group))) diagnostics.push(diagnostic('slot_child_group_forbidden', `${path}.slots.${slotName}[${index}]`, `${child.type} is not in a group this place accepts (${slot.groups.join(', ')})`));
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
    validateContentRules(document.root, diagnostics, { hostSources: typeof options.resolveSource === 'function' });
    resolveRoutes(document.root, resolvedRegistry, normalizePorts(options.ports), diagnostics);
    validateDataRules(document.root, resolvedRegistry, options.shapes, diagnostics);
  }
  return { valid: diagnostics.length === 0, diagnostics, ...(notices.length ? { notices } : {}) };
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
  const visit = (node, depth = 0) => {
    const manifest = resolvedRegistry.types.get(node.type);
    if (!manifest) return;
    collectDependencies(node, manifest, dependencies);
    // A site block needs what the blocks of its tree need.
    if (isComposed(manifest) && depth < MAX_COMPOSED_DEPTH) visit(expandComposed(node, manifest), depth + 1);
    Object.values(node.slots || {}).flat().forEach((child) => visit(child, depth));
  };
  visit(normalized.root);
  const notices = [...(result.notices || []), ...await settleForeignHashes(normalized.root)];
  return {
    ...(notices.length ? { notices } : {}),
    document: normalized,
    digest: await sha256(stableStringify(normalized)),
    dependencies: {
      assets: [...dependencies.assets].sort(),
      bindings: [...dependencies.bindings.values()].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    },
    diagnostics: [],
  };
}

// content.foreign (F2.2): the hash of raw is written where it is missing and
// checked where it is present. A mismatch keeps the block as it is, is
// reported, and the block is not drawn.
async function settleForeignHashes(root) {
  const notices = [];
  const visit = async (node, path) => {
    if (!isPlainObject(node)) return;
    if (node.type === 'content.foreign' && isPlainObject(node.data) && typeof node.data.raw === 'string') {
      const hash = `sha256:${await sha256(node.data.raw)}`;
      if (node.data.hash === undefined) node.data.hash = hash;
      else if (node.data.hash !== hash) notices.push(diagnostic('foreign_hash_mismatch', `${path}.data.hash`, 'The hash does not match raw; the block is kept and not drawn', { id: node.id }));
    }
    for (const [name, children] of Object.entries(isPlainObject(node.slots) ? node.slots : {})) {
      if (Array.isArray(children)) for (const [index, child] of children.entries()) await visit(child, `${path}.slots.${name}[${index}]`);
    }
  };
  await visit(root, '$.root');
  return notices;
}

const FOREIGN_SOURCE_NAMES = Object.freeze({ markdown: 'Markdown', editorjs: 'Editor.js', html: 'HTML' });
// The editor's view of a foreign block: inert, its source and, for an
// Editor.js block, the tool's name, as escaped text. raw is never markup.
function foreignPlaceholder(node) {
  let tool = '';
  if (node.data.source === 'editorjs') {
    try {
      const parsed = JSON.parse(node.data.raw);
      if (typeof parsed?.type === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(parsed.type)) tool = parsed.type;
    } catch { /* not a block: the source alone */ }
  }
  const label = `${FOREIGN_SOURCE_NAMES[node.data.source] || node.data.source}${tool ? ` · ${tool}` : ''}`;
  return `<div class="sf-composition-unknown" role="note" data-sf-composition-type="content.foreign" data-sf-composition-id="${escapeHtml(node.id)}">${escapeHtml(label)}</div>`;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const MARK_ELEMENTS = Object.freeze({ strong: 'strong', em: 'em', code: 'code', strike: 's' });
function renderInline(content) {
  return (content || []).map((inline) => {
    if (inline.type === 'link') return `<a href="${escapeHtml(inline.href)}">${renderInline(inline.children)}</a>`;
    // A soft line break (inline model 1.2.0) inside the marks it carries.
    // Its extension keys (inline model) draw nothing.
    if (inline.type === 'break' && (inline.marks === undefined || Array.isArray(inline.marks))) {
      return (inline.marks || []).reduce((output, mark) => (MARK_ELEMENTS[mark] ? `<${MARK_ELEMENTS[mark]}>${output}</${MARK_ELEMENTS[mark]}>` : output), '<br>');
    }
    if (inline.type !== 'text') {
      // An atom draws its own element, its props escaped as text; anything
      // else (validation refuses it) draws nothing rather than "undefined".
      const view = inlineComponentView(inline);
      if (!view) return '';
      const attributes = view.attributes.map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`)).join('');
      return `<${view.tag}${attributes}>${escapeHtml(view.text)}</${view.tag}>`;
    }
    let output = escapeHtml(inline.value);
    // A mark outside the closed list (validation refuses it) draws no element.
    for (const mark of inline.marks || []) output = MARK_ELEMENTS[mark] ? `<${MARK_ELEMENTS[mark]}>${output}</${MARK_ELEMENTS[mark]}>` : output;
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
  // its cells with the text-align utility class, never a style attribute, so
  // the rendered HTML stays within a strict CSP (2026-11-10 review, P8).
  const cellClass = (index) => (align[index] === 'center' || align[index] === 'end' ? ` class="text-${align[index]}"` : '');
  const cell = (content, index, tag, scope) => `<${tag}${scope ? ` scope="${scope}"` : ''}${cellClass(index)}>${renderInline(content)}</${tag}>`;
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

// The words an element prints until the author writes its own, in the
// Document's language (English when there is none for it).
const ELEMENT_PLACEHOLDERS = Object.freeze({
  en: { button: 'Button', badge: 'Badge', send: 'Send', field: 'Field', option: 'Option', name: 'Name', phone: 'Phone', email: 'Email', message: 'Message' },
  ru: { button: 'Кнопка', badge: 'Метка', send: 'Отправить', field: 'Поле', option: 'Вариант', name: 'Имя', phone: 'Телефон', email: 'Почта', message: 'Сообщение' },
});
// The fields whose name has a word of its own when they have no label (forms, 2026-11-04).
const NAMED_FIELDS = new Set(['name', 'phone', 'email', 'message']);
const fieldLabel = (node, locale) => node.data?.label || placeholder(locale, NAMED_FIELDS.has(node.data?.name) ? node.data.name : 'field');
// A form field fills its column (a block, not the element block's flex row).
const fieldBlock = (node, html) => (html ? `<div${id(node)}>${html}</div>` : '');
// The options of a select: the words an author wrote, separated by commas.
const optionList = (text) => [...new Set(String(text ?? '').split(',').map((word) => word.trim()).filter(Boolean))];
const placeholder = (locale, key) => (ELEMENT_PLACEHOLDERS[String(locale || 'en').toLowerCase().split('-')[0]] || ELEMENT_PLACEHOLDERS.en)[key];
const defined = (inputs) => Object.fromEntries(Object.entries(inputs).filter(([, value]) => value !== undefined && value !== ''));
// An element stands in a block of its own: the editor selects and the
// utilities reach the block (sf-button's host is display: contents), the
// element draws inside it. The block is a flex row, so an element keeps its
// own width (the prototype's inline button) instead of the column's.
const elementBlock = (node, html) => (html ? `<div class="flex"${id(node)}>${html}</div>` : '');

// The space between the blocks of a section or a container (visual parity,
// 2026-11-04): the prototype's 24 px at the desktop, space-3 of the SIMAI
// Framework ladder (16 px on the phone). Blocks in a column stand one rhythm
// apart (space-y-*, their own margins collapse into it); a gap the Document
// sets is the rhythm, per screen. Columns make the content a grid, whose gap
// the grid set prints: no rhythm then.
const BLOCK_RHYTHM = 3;
function rhythm(props) {
  if (props.columns !== undefined) return '';
  const values = valuesByBreakpoint(props.gap ?? BLOCK_RHYTHM);
  const classes = [];
  let previous;
  UTILITY_BREAKPOINTS.forEach((breakpoint) => {
    const value = values[breakpoint];
    if (value !== previous && Number.isInteger(value)) classes.push(`${breakpoint === 'xs' ? '' : `${breakpoint}:`}space-y-${value}`);
    previous = value;
  });
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}

const BUILTIN_RENDERERS = {
  // A page is the document's main landmark; drawn embedded (options.embedded,
  // a host's canvas inside the host's own main) it is a plain element that
  // names the landmark it stands for (simai/ui-source#60).
  'layout.page': ({ node, slots, context }) => (renderEmbedded(context?.options)
    ? `<div data-sf-composition-landmark="main" data-sf-composition-id="${escapeHtml(node.id)}">${slots.default || ''}</div>`
    : `<main data-sf-composition-id="${escapeHtml(node.id)}">${slots.default || ''}</main>`),
  'layout.section': ({ node, slots, manifest }) => {
    // 1.1.0: a section given a width or columns draws the frame and content
    // parts its parameter sets place classes on. 1.2.0: its width defaults to
    // the page container (parameter_defaults), so a section draws them unless
    // the Document sets its width full and gives no columns.
    const props = effectiveProps(node, manifest);
    const framed = (props.width !== undefined && props.width !== 'full') || ['columns', 'gap'].some((key) => props[key] !== undefined);
    const inner = framed ? `<div data-sf-composition-part="frame"><div${rhythm(props)} data-sf-composition-part="content">${slots.default || ''}</div></div>` : (slots.default || '');
    return `<section data-sf-composition-id="${escapeHtml(node.id)}">${inner}</section>`;
  },
  'layout.columns': ({ node, slots }) => {
    const columns = Number.isInteger(node.props?.columns) ? ` data-composition-columns="${node.props.columns}"` : '';
    // A grid of one column on the phone unless columns says otherwise; the
    // columns and gap utilities are added from the props (1.1.0). No gap given
    // keeps the type's own gap.
    const gap = node.props?.gap === undefined ? ' gap-4' : '';
    return `<div class="sf-composition-columns grid${gap}" data-sf-composition-id="${escapeHtml(node.id)}"${columns}>${(slots.columnsList || []).map((child) => `<div class="sf-composition-column">${child}</div>`).join('')}</div>`;
  },
  'content.heading': ({ node }) => `<h${node.data.level || 2} data-sf-composition-id="${escapeHtml(node.id)}">${renderInline(node.data.content)}</h${node.data.level || 2}>`,
  'content.paragraph': ({ node }) => `<p data-sf-composition-id="${escapeHtml(node.id)}">${renderInline(node.data.content)}</p>`,
  'layout.regions': ({ node, slots }) => `<div class="sf-composition-regions" data-sf-composition-id="${escapeHtml(node.id)}"><div class="sf-composition-regions-grid">${slots.regions || ''}</div></div>`,
  'layout.region': ({ node, slots, context }) => {
    const props = node.props;
    // Embedded, the main region is a plain element too: the host's page holds the one main.
    const embeddedMain = props.landmark === 'main' && renderEmbedded(context?.options);
    const element = embeddedMain ? 'div' : REGION_ELEMENTS[props.landmark];
    const landmark = embeddedMain ? ' data-sf-composition-landmark="main"' : '';
    const sticky = props.sticky === true ? ' data-sf-region-sticky=""' : '';
    const label = props.label !== undefined ? ` aria-label="${escapeHtml(props.label)}"` : '';
    return `<${element} class="sf-composition-region" data-sf-composition-id="${escapeHtml(node.id)}" data-sf-region="${escapeHtml(props.name)}" data-sf-region-placement="${escapeHtml(props.placement ?? 'block')}"${landmark}${sticky}${label}>${slots.default || ''}</${element}>`;
  },
  'layout.scope': ({ node, slots, routes }) => `<sf-composition-scope data-sf-composition-id="${escapeHtml(node.id)}" data-sf-routes="${escapeHtml(routesAttribute(routes || []))}">${slots.default || ''}</sf-composition-scope>`,
  'layout.area': ({ node, slots }) => `<div data-sf-composition-area=""${id(node)}>${slots.default || ''}</div>`,
  // The layout and element types of the one block editor (2026-11-04): the
  // block's own element, its parts, and SIMAI Framework utilities only.
  'layout.container': ({ node, slots, manifest }) => `<div${id(node)}><div data-sf-composition-part="frame"><div${rhythm(effectiveProps(node, manifest))} data-sf-composition-part="content">${slots.default || ''}</div></div></div>`,
  'layout.grid': ({ node, slots }) => `<div${id(node)}><div class="grid" data-sf-composition-part="content">${(slots.defaultList || []).map((child) => `<div class="min-w-0">${child}</div>`).join('')}</div></div>`,
  'layout.spacer': ({ node }) => `<div aria-hidden="true"${id(node)}></div>`,
  'element.button': ({ node, elements, locale }) => {
    const props = node.props || {};
    return elementBlock(node, elements.print('sf-button', defined({
      text: node.data?.text || placeholder(locale, 'button'),
      // A button with an address is a link with the button's look (sf-button 1.4.0).
      href: node.data?.href,
      appearance: props.appearance,
      scheme: props.scheme,
      size: props.size,
      icon: props.icon,
      'icon-position': props.icon ? props.icon_position : undefined,
    })));
  },
  'element.button-icon': ({ node, elements, locale }) => {
    const props = node.props || {};
    return elementBlock(node, elements.print('sf-button-icon', defined({
      icon: props.icon ?? 'favorite',
      'aria-label': node.data?.label || placeholder(locale, 'button'),
      appearance: props.appearance ?? 'tonal',
      scheme: props.scheme,
      size: props.size,
    })));
  },
  'element.badge': ({ node, elements, locale }) => {
    const props = node.props || {};
    return elementBlock(node, elements.print('sf-badge', defined({
      text: node.data?.text || placeholder(locale, 'badge'),
      appearance: props.appearance ?? 'tonal',
      scheme: props.scheme ?? 'primary',
      size: props.size ?? '1/2',
      icon: props.icon,
    })));
  },
  'element.icon': ({ node, elements }) => {
    const props = node.props || {};
    return elementBlock(node, elements.print('sf-icon', defined({ icon: props.icon ?? 'star', size: props.size ?? '2', label: node.data?.label })));
  },
  // Forms (2026-11-04): a <form> around its fields, its blocks one rhythm
  // apart; each field one Smart element printed from its inputs.
  'form.form': ({ node, slots }) => {
    const action = node.data?.action ? ` action="${escapeHtml(node.data.action)}"` : '';
    return `<form class="grid gap-4" method="${node.props?.method === 'get' ? 'get' : 'post'}"${action}${id(node)}>${slots.default || ''}</form>`;
  },
  'form.input': ({ node, elements, locale }) => {
    const props = node.props || {};
    return fieldBlock(node, elements.print('sf-input', defined({
      label: fieldLabel(node, locale),
      placeholder: node.data?.placeholder,
      hint: node.data?.hint,
      name: node.data?.name,
      'input-type': props.input_type,
      autocomplete: { email: 'email', tel: 'tel', url: 'url' }[props.input_type],
      required: props.required === true || undefined,
      size: props.size,
    })));
  },
  'form.textarea': ({ node, elements, locale }) => {
    const props = node.props || {};
    return fieldBlock(node, elements.print('sf-input-textarea', defined({
      label: fieldLabel(node, locale),
      placeholder: node.data?.placeholder,
      hint: node.data?.hint,
      name: node.data?.name,
      rows: props.rows,
      required: props.required === true || undefined,
      size: props.size,
    })));
  },
  'form.checkbox': ({ node, elements, locale }) => {
    const props = node.props || {};
    return fieldBlock(node, elements.print('sf-checkbox', defined({
      label: fieldLabel(node, locale),
      description: node.data?.hint,
      name: node.data?.name,
      checked: props.checked === true || undefined,
      size: props.size,
    })));
  },
  'form.switch': ({ node, elements, locale }) => {
    const props = node.props || {};
    return fieldBlock(node, elements.print('sf-switch', defined({
      label: fieldLabel(node, locale),
      description: node.data?.hint,
      name: node.data?.name,
      checked: props.checked === true || undefined,
      size: props.size,
    })));
  },
  'form.select': ({ node, elements, locale }) => {
    const props = node.props || {};
    const options = optionList(node.data?.options);
    return fieldBlock(node, elements.print('sf-dropdown', defined({
      label: fieldLabel(node, locale),
      placeholder: node.data?.placeholder,
      name: node.data?.name,
      options: JSON.stringify(options.length ? options : [placeholder(locale, 'option')]),
      required: props.required === true || undefined,
      size: props.size,
    })));
  },
  'form.button-submit': ({ node, elements, locale }) => {
    const props = node.props || {};
    return elementBlock(node, elements.print('sf-button', defined({
      text: node.data?.text || placeholder(locale, 'send'),
      'native-type': 'submit',
      appearance: props.appearance,
      size: props.size,
    })));
  },
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
  // Nothing on a public page; an editor (unknown: 'placeholder') draws the
  // inert placeholder.
  'content.foreign': ({ node, context }) => (context?.options?.unknown === 'placeholder' ? foreignPlaceholder(node) : ''),
};

// context.resolveSource(src, {node}) → address: a host that keeps pictures
// itself names them in content.figure and content.media (media:<id>) and gives
// the address to draw at render, which may be a blob: address of the page's
// origin (simai/ui-source#71). The address is held to the Document's URL rule
// with that one addition; one that fails it draws nothing and is reported.
const HOST_SOURCE_TYPES = new Set(['content.figure', 'content.media']);

export async function render(document, context = {}) {
  const registry = normalizeRegistry(context.registry);
  renderEmbedded(context.options);
  const resolveSource = typeof context.resolveSource === 'function' ? context.resolveSource : null;
  const normalized = await normalize(document, registry, { ...(context.options || {}), ...(resolveSource ? { resolveSource } : {}) });
  if (!normalized.document) return { html: '', assets: [], hydration: [], diagnostics: normalized.diagnostics, digest: null };
  const diagnostics = [];
  // A foreign block whose hash does not match is kept and not drawn: what
  // drawing found, so a diagnostic of the render (F2.2).
  const mismatched = new Set((normalized.notices || []).filter(({ code }) => code === 'foreign_hash_mismatch').map((entry) => entry.id));
  diagnostics.push(...(normalized.notices || []).filter(({ code }) => code === 'foreign_hash_mismatch').map(({ id: _id, ...entry }) => entry));
  const notices = [...(normalized.notices || [])].filter((entry) => !entry.code.startsWith('modifier') && entry.code !== 'foreign_hash_mismatch');
  const hydration = [];
  const routes = resolveRoutes(normalized.document.root, registry, normalizePorts(context.options?.ports), []);
  // The data of the blocks that declare it, resolved before drawing (data.mjs).
  const data = await resolveData(normalized.document.root, registry, context, validateJsonSchema);
  diagnostics.push(...data.diagnostics);
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
  // `inside`: an ancestor already stands in a centred container (its frame
  // part prints `container`). A frame inside one takes container-flush, so a
  // container in a section has no second gutter; a breakout leaves the
  // container and its own frame keeps the gutter (2026-11-04).
  const renderNode = async (given, depth = 0, inside = false) => {
    let node = given;
    if (resolveSource && HOST_SOURCE_TYPES.has(node.type) && typeof node.data?.src === 'string') {
      const address = await resolveSource(node.data.src, { node });
      if (typeof address !== 'string' || !(validUrl(address) || hostBlobUrl(address))) {
        diagnostics.push(diagnostic('unsafe_url', `node:${node.id}.data.src`, 'The resolved image source is not allowed'));
        return '';
      }
      node = { ...node, data: { ...node.data, src: address } };
    }
    const manifest = registry.types.get(node.type);
    // Only reached under unknown: 'placeholder' (validate's notice says
    // which node); normalize refused the Document otherwise.
    if (!manifest) return unknownPlaceholder(node);
    if (node.type === 'content.foreign' && mismatched.has(node.id)) return '';
    // A site block draws its type's current tree with the instance's values
    // and texts (composed.mjs); the instance stays one node of the Document.
    if (isComposed(manifest)) {
      if (depth >= MAX_COMPOSED_DEPTH) return '';
      const expanded = expandComposed(node, manifest);
      const inner = await resolveData(expanded, registry, context, validateJsonSchema);
      for (const [id, entry] of inner.byNode) data.byNode.set(id, entry);
      data.links.push(...inner.links);
      diagnostics.push(...inner.diagnostics);
      return renderNode(expanded, depth + 1, inside);
    }
    const byPart = utilityPartClasses(node, manifest);
    const ownFrame = (byPart.frame || []).includes('container');
    const outer = inside && !(byPart[''] || []).includes('container-breakout');
    if (outer && ownFrame) byPart.frame.push('container-flush');
    const slots = {};
    for (const [name, children] of Object.entries(node.slots || {})) {
      const rendered = [];
      for (const child of children) rendered.push(await renderNode(child, depth, outer || ownFrame));
      slots[name] = rendered.join('');
      slots[`${name}List`] = rendered;
    }
    const resolvedBindings = {};
    let bindingStates;
    if (takesData(manifest)) {
      const entry = data.byNode.get(node.id) || { values: {}, states: {} };
      Object.assign(resolvedBindings, entry.values);
      bindingStates = entry.states;
    } else {
      for (const binding of node.bindings || []) {
        if (context.resolveBinding) resolvedBindings[binding.target] = await context.resolveBinding(binding, { document: normalized.document, node });
      }
    }
    // Layout parameters and the block's own modifiers become SIMAI Framework
    // utilities on the block's element (utilities.mjs).
    const own = modifierNotices(node, { rules: context.options?.utilityRules });
    notices.push(...own.notices);
    const utilities = [...new Set([...(byPart[''] || []), ...modifierUtilities(node, manifest), ...own.kept])];
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
    // The smart elements a block may print, held to their manifests (elements.mjs).
    const elements = {
      print: (name, inputs) => {
        const printed = printElementWith(name, inputs, validateJsonSchema, `node:${node.id}`);
        diagnostics.push(...printed.diagnostics);
        return printed.html;
      },
    };
    const html = await renderer({ node, slots, context, elements, resolvedBindings, ...(bindingStates ? { bindingStates } : {}), utilities, manifest, routes: routes.get(node.id), endpoint: endpointName(node), outlet: node.type === 'content.outlet' ? outlet : undefined, locale: normalized.document.locale ?? 'en' });
    let drawn = withClasses(html, node.id, utilities);
    // A parameter that reaches an inner element (a set's part): the renderer
    // marks it data-sf-composition-part; classes for a part it did not draw
    // are reported, never placed elsewhere.
    for (const [part, classes] of Object.entries(byPart)) {
      if (part === '' || !classes.length) continue;
      const placed = withPartClasses(drawn, node.id, part, classes);
      if (placed.found) drawn = placed.html;
      else notices.push(diagnostic('utility_part_missing', `node:${node.id}`, `${node.type} draws no ${part} part; ${classes.join(' ')} is left out`, { part }));
    }
    return drawn;
  };
  const html = await renderNode(normalized.document.root);
  const assets = outletAssets.length ? [...new Set([...normalized.dependencies.assets, ...outletAssets])].sort() : normalized.dependencies.assets;
  return {
    html,
    assets,
    hydration,
    diagnostics,
    digest: normalized.digest,
    ...(notices.length ? { notices } : {}),
    ...(data.links.length ? { runtime: data.links } : {}),
  };
}

// ------------------------------------------------- one block editor (2026-11-03)

const fits = (value, schema) => {
  const problems = [];
  const responsive = isResponsive(schema) && isBreakpointValue(value);
  if (responsive) for (const entry of Object.values(value)) validateJsonSchema(entry, valueSchema(schema), '$', problems);
  else validateJsonSchema(value, schema, '$', problems);
  return problems.length === 0;
};

/**
 * The problems of a type manifest's additive fields (catalogue, variants,
 * slot words and groups, layout utilities, data bindings, runtime states, a
 * site block's tree): {valid, diagnostics}. Each variant is made into a node
 * and validated as a Document of the type's first profile.
 */
export function validateTypeManifest(manifest, registry = undefined, options = {}) {
  const diagnostics = [];
  if (!isPlainObject(manifest) || !isSchema(manifest, 'simai.composition.type-manifest', 1)) return { valid: false, diagnostics: [diagnostic('composition_manifest_invalid', '$', 'A type manifest is simai.composition.type-manifest with schema_version 1')] };
  diagnostics.push(...validateCatalogueFields(manifest));
  diagnostics.push(...validateParameterSets(manifest));
  diagnostics.push(...validateParameterDefaults(manifest, fits));
  diagnostics.push(...validateModifierUtilities(manifest));
  diagnostics.push(...validateUtilityDeclarations(expandParameterSets(manifest)));
  diagnostics.push(...validateDataDeclarations(manifest, options.shapes));
  let resolved = normalizeRegistry(registry);
  if (resolved.types.get(manifest.type) !== manifest) {
    const others = [...resolved.types.values()].filter((entry) => entry.type !== manifest.type);
    resolved = { types: new Map([...others, expandParameterSets(manifest)].map((entry) => [entry.type, entry])), renderers: resolved.renderers };
  }
  if (isComposed(manifest)) {
    const again = defineComposed({ ...manifest, root: manifest.composed.root }, resolved, (document, current) => validate(document, current, options));
    diagnostics.push(...again.diagnostics.map((entry) => ({ ...entry, path: entry.path.startsWith('$.root') ? `$.composed${entry.path.slice(1)}` : entry.path })));
    if (again.manifest && stableStringify(again.manifest.props_schema) !== stableStringify(manifest.props_schema)) diagnostics.push(diagnostic('composed_schema_drift', '$.props_schema', 'The exposed parameters do not match the tree: make the manifest with defineComposedType'));
    if (manifest.renderer?.kind !== 'builtin' || manifest.renderer?.name !== 'composed') diagnostics.push(diagnostic('composed_renderer_invalid', '$.renderer', 'A site block is drawn by the builtin renderer composed'));
  } else if (manifest.exposed !== undefined) diagnostics.push(diagnostic('composed_exposed_without_tree', '$.exposed', 'Only a site block (composed) exposes parameters'));
  if (Array.isArray(manifest.variants) && !diagnostics.some((entry) => entry.code.startsWith('variant'))) {
    for (const variant of manifest.variants) {
      const node = instantiateVariant(manifest, variant.id, { id: `variant-${variant.id}` });
      const checked = validate({ ...schemaFields('simai.composition.document', 1), id: 'variant-probe', profile: manifest.profiles[0], root: node }, resolved, options);
      diagnostics.push(...checked.diagnostics.map((entry) => ({ ...entry, path: `$.variants.${variant.id}${entry.path.replace(/^\$\.root/u, '')}` })));
    }
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

// presentation.modifier_utilities (type manifest 1.5.0, G-39 2026-11-04): the
// SIMAI Framework classes a declared modifier prints on the block's element. A
// modifier with no entry prints nothing, as before.
const MODIFIER_CLASS = /^[a-z0-9][a-z0-9:/_.-]{0,99}$/u;
function modifierUtilities(node, manifest) {
  const table = manifest?.presentation?.modifier_utilities;
  if (!isPlainObject(table) || !Array.isArray(node?.presentation?.modifiers)) return [];
  return node.presentation.modifiers.flatMap((modifier) => (Array.isArray(table[modifier]) ? table[modifier] : []));
}
function validateModifierUtilities(manifest) {
  const table = manifest?.presentation?.modifier_utilities;
  if (table === undefined) return [];
  if (!isPlainObject(table)) return [diagnostic('modifier_utilities_invalid', '$.presentation.modifier_utilities', 'Modifier utilities are an object of class lists')];
  const declared = manifest.presentation.modifiers || [];
  const diagnostics = [];
  for (const [modifier, classes] of Object.entries(table)) {
    if (!declared.includes(modifier)) diagnostics.push(diagnostic('modifier_utilities_unknown', `$.presentation.modifier_utilities.${modifier}`, `Modifier ${modifier} is not declared`));
    if (!Array.isArray(classes) || !classes.every((value) => typeof value === 'string' && MODIFIER_CLASS.test(value))) diagnostics.push(diagnostic('modifier_utilities_invalid', `$.presentation.modifier_utilities.${modifier}`, 'A modifier prints a list of classes'));
  }
  return diagnostics;
}

/** A site block's type manifest from what the block builder saved (composed.mjs). */
export function defineComposedType(definition, registry = undefined, options = {}) {
  return defineComposed(definition, normalizeRegistry(registry), (document, current) => validate(document, current, options));
}

/**
 * A site block's parameter form: its exposed list with the target types'
 * editor fields (composed.mjs composedEditorManifest). With an instance it
 * also projects the instance's values, as projectEditorFields does for a type
 * of code: {manifest, origins, fields, diagnostics, valid}.
 */
export function composedEditorFields(manifest, instance = undefined, options = {}) {
  const registry = normalizeRegistry(options.registry);
  const editors = [...BUILTIN_EDITOR_MANIFESTS, ...(options.editorManifests || [])];
  const made = composedEditorManifestWith(manifest, registry, editors);
  if (!made.manifest) return { valid: false, manifest: null, origins: {}, fields: [], diagnostics: made.diagnostics };
  const projected = projectEditorFields(made.manifest, manifest, instance || { id: '', type: manifest.type }, options);
  const diagnostics = [...made.diagnostics, ...projected.diagnostics];
  return { valid: diagnostics.length === 0, manifest: made.manifest, origins: made.origins, fields: projected.fields, diagnostics };
}

/** Every instance of a site block moved to its type's current version; what the new version no longer has is reported. */
export function upgradeComposed(document, registry = undefined) {
  return upgradeComposedWith(document, normalizeRegistry(registry), fits);
}

/** The markup of a smart element a block prints, from its manifest inputs: {html, diagnostics} (elements.mjs). */
export function printElement(name, inputs = {}) {
  return printElementWith(name, inputs, validateJsonSchema);
}

/** The problems of the smart elements in HTML a renderer wrote: attributes their manifests do not take (elements.mjs). */
export function checkPrintedElements(html) {
  return checkPrintedElementsWith(html, validateJsonSchema);
}

/** The problems of a host's answer to one source-port request. */
export function checkSourceAnswer(request, answer, options = {}) {
  return checkSourceAnswerWith(request, answer, { ...options, check: validateJsonSchema });
}

/**
 * The source port over a host's three functions {sources(shape),
 * fields(source), preview(binding, {settings, shape})}: each answer is checked
 * before an editor reads it. resolveBinding draws the editor's preview through
 * the port: render(document, {resolveBinding: port.resolveBinding, preview: true}).
 */
export function createSourcePort(host, options = {}) {
  if (!host || ['sources', 'fields', 'preview'].some((name) => typeof host[name] !== 'function')) throw new TypeError('composition_source_port_incomplete');
  const answered = async (request, answer, extra = {}) => {
    const problems = checkSourceAnswer(request, answer, { ...options, ...extra });
    if (problems.length) {
      const error = new TypeError(`composition_source_answer_invalid:${request}`);
      error.diagnostics = problems;
      throw error;
    }
    return answer;
  };
  return Object.freeze({
    sources: async (shape) => answered('sources', await host.sources(shape)),
    fields: async (source) => answered('fields', await host.fields(source)),
    preview: async (binding, { settings = {}, shape } = {}) => answered('preview', await host.preview(binding, { settings, shape }), { shape }),
    resolveBinding: async (binding, { shape, settings } = {}) => host.preview(binding, { settings: settings || {}, shape }),
  });
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
  // One block editor (2026-11-03): catalogue, layout utilities, own
  // modifiers, site blocks, named places and data.
  BINDING_STATES,
  BUILTIN_CATALOGUE,
  BUILTIN_CATALOGUE_ALSO_IN,
  BUILTIN_CATALOGUE_ICONS,
  CATALOGUE_GROUPS,
  CATALOGUE_GROUP_ALIASES,
  CATALOGUE_GROUP_TABLE,
  CATALOGUE_TABS,
  DATA_SHAPES,
  SOURCE_PORT,
  UTILITY_BREAKPOINTS,
  bindingSettings,
  catalogue,
  catalogueEntry,
  entryGroups,
  checkModifiers,
  checkSourceAnswer,
  composedEditorFields,
  composedInstance,
  composedPart,
  composedTextPaths,
  createShapeRegistry,
  createSourcePort,
  defineComposedType,
  demoData,
  PARAMETER_SETS,
  PRINTED_ELEMENTS,
  checkPrintedElements,
  elementInputs,
  effectiveProps,
  expandParameterSets,
  parameterSetFields,
  printElement,
  withParameterSetFields,
  expandComposed,
  instantiateVariant,
  ownModifiers,
  slotAccepts,
  slotPlaces,
  upgradeComposed,
  utilityClasses,
  utilityClassSpace,
  utilityPartClasses,
  validateTypeManifest,
  valuesByBreakpoint,
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
export { MODIFIERS_EXTENSION, UTILITY_BREAKPOINTS, checkModifiers, ownModifiers, utilityClassSpace, utilityClasses, valuesByBreakpoint };
export { BUILTIN_CATALOGUE, BUILTIN_CATALOGUE_ALSO_IN, BUILTIN_CATALOGUE_ICONS, CATALOGUE_GROUPS, CATALOGUE_GROUP_ALIASES, CATALOGUE_GROUP_TABLE, CATALOGUE_TABS, catalogue, catalogueEntry, entryGroups, instantiateVariant, slotAccepts, slotPlaces };
export { COMPOSED_EXTENSION, composedInstance, composedPart, composedTextPaths, expandComposed };
export { BINDING_STATES, DATA_EXTENSION, DATA_SHAPES, RUNTIME_OWNER, SOURCE_PORT, bindingSettings, createShapeRegistry, demoData };
export { PARAMETER_SETS, PARAMETER_SET_NAMES, effectiveProps, expandParameterSets, parameterSetFields, parameterSetParts, utilityPartClasses, validateParameterSets, withParameterSetFields };
export { PRINTED_ELEMENTS, elementInputs };

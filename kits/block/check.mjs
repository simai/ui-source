#!/usr/bin/env node
// The SIMAI Framework block author kit: the conformance check of one block
// (docs/developer/block-author-guide.md). A block is a folder of files in the
// formats the SIMAI Framework already has, nothing new:
//
//   type.json      the type manifest (simai.composition.type-manifest, v1)
//   editor.json    its editor manifest (simai.composition.editor-manifest, v1)
//   renderer.mjs   the renderer a host registers: export default ({node, slots, locale}) => html
//   words.json     the words of its fields (simai.composition.editor-words, v1)
//   cases/*.json   what it draws (simai.composition.structured-content-conformance-case, v1)
//
// The check runs the SIMAI Framework's own Composition runtime over it: the one
// that validates and draws a Document on a page. The cases and the HTML
// comparison rule are those of the structured-content conformance kit
// (contracts/conformance/structured-content/README.md).
//
//   node kits/block/check.mjs <block folder> [--framework <dir>] [--json] [--update]
//
// --framework names the folder that holds core/js/composition/ (this
// checkout's src/ by default, or distr/ of a released simai/ui); --update
// writes each case's expect from what the renderer draws now, for review.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { canonicalHtml, diagnosticKeys, parseFragment, sameHtml } from '../../contracts/conformance/structured-content/normalize-html.mjs';

const KIT = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FRAMEWORK = resolve(KIT, '../../src');

// The first segment of a type names its owner. These are the SIMAI Framework's
// own (layout.*, content.*, and smart.* of its Smart components); a product
// block takes its product's name.
export const RESERVED_NAMESPACES = Object.freeze(['content', 'layout', 'smart', 'sf']);
const CASE_SCHEMA = 'simai.composition.structured-content-conformance-case';
const WORDS_SCHEMA = 'simai.composition.editor-words';
// The keywords the Composition validator enforces on a node's data and props
// (validateJsonSchema in src/core/js/composition/index.mjs); a keyword it does
// not read would let a Document through that the author meant to refuse.
const SCHEMA_KEYWORDS = new Set([
  'type', 'const', 'enum', 'oneOf', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum',
  'minItems', 'maxItems', 'uniqueItems', 'items', 'required', 'additionalProperties', 'properties',
  'title', 'description', 'default', 'examples', '$comment',
]);
const GROUPS = Object.freeze([
  ['manifest', 'the type and editor manifests are valid'],
  ['renderer', 'the renderer is registered and draws the block'],
  ['form', 'the parameter form builds from the editor manifest'],
  ['output', 'JSON to HTML gives the expected output, and the output is safe'],
  ['unknown', 'an unknown type stays safe, the block is kept byte for byte'],
]);
// Hostile values put into every text the schemas let through.
const HOSTILE_MARKUP = '"\'><script>alert(1)</script><img src=x onerror=alert(1)>&amp;';
const HOSTILE_URL = 'javascript:alert(1)';
const FORBIDDEN_ELEMENTS = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'meta', 'link', 'style', 'form', 'noscript', 'template']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'cite', 'xlink:href', 'background', 'ping']);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameJson = (left, right, stable) => stable(left) === stable(right);

/** Loads the SIMAI Framework the block is checked against. */
export async function loadFramework(root = DEFAULT_FRAMEWORK) {
  const at = (path) => join(root, 'core', path);
  const index = at('js/composition/index.mjs');
  if (!existsSync(index)) throw new Error(`block_check_framework_missing: no core/js/composition/index.mjs under ${root}`);
  const composition = await import(pathToFileURL(index).href);
  const canonical = await import(pathToFileURL(at('js/composition/canonical.mjs')).href);
  return {
    root,
    composition,
    stable: canonical.stableStringify,
    typeSchema: readJson(at('contracts/composition-type-manifest.v1.schema.json')),
  };
}

// --------------------------------------------------------------- a JSON Schema

// The keywords the type manifest's own schema uses (2020-12 subset): enough to
// hold a manifest to the published schema without a dependency.
function schemaProblems(value, schema, root, path, out, stable) {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//u, '').split('/').reduce((node, key) => node?.[key], root);
    return schemaProblems(value, target, root, path, out, stable);
  }
  const push = (code, message) => out.push({ code, path, message });
  if (schema.anyOf && !schema.anyOf.some((branch) => { const local = []; schemaProblems(value, branch, root, path, local, stable); return local.length === 0; })) push('manifest_schema_any_of', 'Matches none of the allowed forms');
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && ![].concat(schema.type).some((type) => type === actual || (type === 'number' && actual === 'integer'))) return push('manifest_schema_type', `Expected ${[].concat(schema.type).join(' or ')}`);
  if ('const' in schema && stable(value) !== stable(schema.const)) push('manifest_schema_const', `Must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((entry) => stable(entry) === stable(value))) push('manifest_schema_enum', `Must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) push('manifest_schema_min_length', 'Too short');
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) push('manifest_schema_pattern', `Must match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) push('manifest_schema_minimum', 'Too small');
    if (schema.maximum !== undefined && value > schema.maximum) push('manifest_schema_maximum', 'Too large');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) push('manifest_schema_min_items', 'Too few items');
    if (schema.uniqueItems && new Set(value.map(stable)).size !== value.length) push('manifest_schema_unique_items', 'Items must be unique');
    if (schema.items) value.forEach((entry, index) => schemaProblems(entry, schema.items, root, `${path}[${index}]`, out, stable));
  }
  if (isObject(value)) {
    for (const key of schema.required || []) if (!(key in value)) push('manifest_schema_required', `${key} is required`);
    for (const [key, entry] of Object.entries(value)) {
      const child = schema.properties?.[key];
      if (child) schemaProblems(entry, child, root, `${path}.${key}`, out, stable);
      else if (schema.additionalProperties === false) out.push({ code: 'manifest_schema_additional_property', path: `${path}.${key}`, message: `${key} is not a field of the format` });
      else if (isObject(schema.additionalProperties)) schemaProblems(entry, schema.additionalProperties, root, `${path}.${key}`, out, stable);
    }
  }
  return undefined;
}

// Every keyword of a data or props schema, and every property name in it.
function walkSchema(schema, path, visit) {
  if (!isObject(schema)) return;
  visit(schema, path);
  for (const [key, child] of Object.entries(schema.properties || {})) walkSchema(child, `${path}.properties.${key}`, visit);
  if (schema.items) walkSchema(schema.items, `${path}.items`, visit);
  (schema.oneOf || []).forEach((branch, index) => walkSchema(branch, `${path}.oneOf[${index}]`, visit));
}

// ------------------------------------------------------------------- the block

function readBlock(folder) {
  const file = (name) => join(folder, name);
  const problems = [];
  const json = (name, required) => {
    if (!existsSync(file(name))) {
      if (required) problems.push({ group: 'manifest', code: 'block_file_missing', path: name, message: `${name} is missing` });
      return undefined;
    }
    try {
      return readJson(file(name));
    } catch (error) {
      problems.push({ group: 'manifest', code: 'block_file_not_json', path: name, message: error.message });
      return undefined;
    }
  };
  const casesFolder = file('cases');
  const cases = existsSync(casesFolder)
    ? readdirSync(casesFolder).filter((name) => name.endsWith('.json')).sort().map((name) => {
      try {
        return { file: `cases/${name}`, entry: readJson(join(casesFolder, name)) };
      } catch (error) {
        problems.push({ group: 'output', code: 'case_not_json', path: `cases/${name}`, message: error.message });
        return null;
      }
    }).filter(Boolean)
    : [];
  return {
    folder,
    type: json('type.json', true),
    editor: json('editor.json', false),
    words: json('words.json', false),
    rendererPath: existsSync(file('renderer.mjs')) ? file('renderer.mjs') : null,
    cases,
    problems,
  };
}

// The nodes of one type in a Document, with their JSON paths.
function nodesOfType(root, type, path = '$.root', out = []) {
  if (!isObject(root)) return out;
  if (root.type === type) out.push({ node: root, path });
  for (const [slot, children] of Object.entries(isObject(root.slots) ? root.slots : {})) {
    if (Array.isArray(children)) children.forEach((child, index) => nodesOfType(child, type, `${path}.slots.${slot}[${index}]`, out));
  }
  return out;
}

// The node at a JSON path of the form nodesOfType writes.
function nodeAt(document, path) {
  let node = document.root;
  for (const [, slot, index] of path.matchAll(/\.slots\.([^.[]+)\[(\d+)\]/gu)) node = node.slots[slot][Number(index)];
  return node;
}

function setNodeAt(document, path, node) {
  const steps = [...path.matchAll(/\.slots\.([^.[]+)\[(\d+)\]/gu)];
  if (!steps.length) {
    document.root = node;
    return;
  }
  const [, slot, index] = steps.pop();
  let parent = document.root;
  for (const [, name, at] of steps) parent = parent.slots[name][Number(at)];
  parent.slots[slot][Number(index)] = node;
}

// What makes drawn HTML unsafe on a page: a script or a frame, a handler, an
// address that runs code, a style that loads one.
function unsafeOutput(html) {
  const found = [];
  const visit = (node, trail) => {
    if (node.type !== 'element') return;
    const here = node.name === '#fragment' ? trail : `${trail} > ${node.name}`;
    if (FORBIDDEN_ELEMENTS.has(node.name)) found.push({ code: 'output_element_forbidden', path: here, message: `<${node.name}> is never drawn by a block` });
    for (const [name, value] of node.attributes) {
      // A browser drops control characters and spaces from an address before it reads the scheme.
      const scheme = [...value].filter((character) => character.codePointAt(0) > 32).join('').toLowerCase();
      if (name.startsWith('on')) found.push({ code: 'output_event_handler', path: `${here}[${name}]`, message: 'An event handler attribute is drawn' });
      else if (URL_ATTRIBUTES.has(name) && /^(?:javascript|vbscript|data):/u.test(scheme) && !(name === 'src' && scheme.startsWith('data:image/'))) found.push({ code: 'output_unsafe_url', path: `${here}[${name}]`, message: `${name} holds an address that runs code` });
      else if (name === 'style' && /url\s*\(|expression\s*\(|javascript:/iu.test(value)) found.push({ code: 'output_unsafe_style', path: `${here}[style]`, message: 'A style attribute loads or runs something' });
    }
    node.children.forEach((child) => visit(child, here));
  };
  visit(parseFragment(html), 'html');
  return found;
}

const countIds = (html, id) => {
  let count = 0;
  const visit = (node) => {
    if (node.type !== 'element') return;
    if (node.attributes.some(([name, value]) => name === 'data-sf-composition-id' && value === id)) count += 1;
    node.children.forEach(visit);
  };
  visit(parseFragment(html));
  return count;
};

/**
 * Checks one block folder. Returns {type, version, ok, groups: [{id, title, ok,
 * problems}], cases, warnings}; a problem is {code, path, message}.
 */
export async function checkBlock(folder, options = {}) {
  const framework = options.framework?.composition ? options.framework : await loadFramework(options.framework);
  const { composition, stable, typeSchema } = framework;
  const block = readBlock(resolve(folder));
  const problems = [...block.problems];
  const warnings = [];
  const add = (group, code, path, message) => problems.push({ group, code, path, message });
  const warn = (group, code, path, message) => warnings.push({ group, code, path, message });
  // A group that could not run says why instead of passing.
  const skipped = new Map();
  const skip = (group, reason) => { if (!skipped.has(group)) skipped.set(group, reason); };
  const { type, editor } = block;
  const result = (extra = {}) => {
    const groups = GROUPS.map(([id, title]) => {
      const own = problems.filter((entry) => entry.group === id).map((entry) => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'group')));
      const status = own.length ? 'fail' : skipped.has(id) ? 'skip' : 'pass';
      return { id, title, ok: own.length === 0, status, ...(status === 'skip' ? { skipped: skipped.get(id) } : {}), problems: own };
    });
    return { folder: block.folder, type: type?.type ?? null, version: type?.version ?? null, ok: problems.length === 0 && groups.every((group) => group.status === 'pass'), groups, warnings, cases: block.cases.length, ...extra };
  };
  if (!isObject(type)) {
    for (const [id] of GROUPS.slice(1)) skip(id, 'type.json is missing');
    return result();
  }

  // ------------------------------------------------------------- 1. manifest
  const manifestProblems = [];
  schemaProblems(type, typeSchema, typeSchema, '$', manifestProblems, stable);
  manifestProblems.forEach(({ code, path, message }) => add('manifest', code, `type.json ${path}`, message));
  const namespace = String(type.type || '').split('.')[0];
  if (RESERVED_NAMESPACES.includes(namespace) && !options.allowReservedNamespace) add('manifest', 'type_namespace_reserved', 'type.json $.type', `${namespace}.* belongs to the SIMAI Framework; a product block is <product>.<name>`);
  if (composition.BUILTIN_TYPE_MANIFESTS.some((entry) => entry.type === type.type)) add('manifest', 'type_taken', 'type.json $.type', `${type.type} is a SIMAI Framework type`);
  if (type.renderer?.kind === 'builtin') add('manifest', 'renderer_kind_builtin', 'type.json $.renderer.kind', 'Only the SIMAI Framework draws builtin types; a block is registered or a custom element');
  for (const plane of ['data_schema', 'props_schema']) {
    const schema = type[plane];
    if (!isObject(schema)) continue;
    if (schema.type !== 'object' || schema.additionalProperties !== false) add('manifest', 'schema_not_closed', `type.json $.${plane}`, `${plane} must be a closed object: type object, additionalProperties false`);
    walkSchema(schema, `$.${plane}`, (entry, path) => {
      for (const key of Object.keys(entry)) if (!SCHEMA_KEYWORDS.has(key)) add('manifest', 'schema_keyword_unsupported', `type.json ${path}.${key}`, `The Composition validator does not read ${key}; a Document it should refuse would pass`);
      if ('additionalProperties' in entry && entry.additionalProperties !== false) add('manifest', 'schema_keyword_unsupported', `type.json ${path}.additionalProperties`, 'Only additionalProperties: false is read');
      // A name the Document format refuses anywhere (html, script, class,
      // token, ...): asked of the validator itself, not of a copy of its list.
      for (const key of Object.keys(entry.properties || {})) {
        const probe = composition.validate({ schema: 'simai.composition.document', schema_version: 1, id: 'probe', profile: 'structured-content', root: { id: 'root', type: 'content.document', data: { [key]: 'x' } } });
        if (probe.diagnostics.some((item) => item.code === 'executable_or_secret_field_forbidden')) add('manifest', 'schema_key_forbidden', `type.json ${path}.properties.${key}`, `A Document never holds a key named ${key}`);
      }
    });
  }
  let registryProblem = null;
  try {
    composition.extendRegistry([type], {});
  } catch (error) {
    registryProblem = error.message;
    add('manifest', 'type_not_registrable', 'type.json', error.message);
  }
  if (editor !== undefined) {
    const checked = composition.validateEditorManifest(editor, type);
    checked.diagnostics.forEach(({ code, path, message }) => add('manifest', code, `editor.json ${path}`, message));
    composition.validateFieldKinds(editor).forEach(({ code, path, message }) => add('manifest', code, `editor.json ${path}`, message));
    (Array.isArray(editor.fields) ? editor.fields : []).forEach((field, index) => {
      if (field?.owner === 'simai/framework') add('manifest', 'editor_owner_foreign', `editor.json $.fields[${index}].owner`, 'simai/framework owns the built-in fields; a block names its own owner');
    });
  }

  // ------------------------------------------------------------- 2. renderer
  let renderer = null;
  const calls = { mutated: [], notString: [] };
  if (type.renderer?.kind === 'registered') {
    if (!block.rendererPath) add('renderer', 'renderer_file_missing', 'renderer.mjs', 'A registered type brings its renderer: renderer.mjs');
    else {
      try {
        const module = await import(`${pathToFileURL(block.rendererPath).href}?check=${Date.now()}`);
        renderer = typeof module.default === 'function' ? module.default : null;
        if (!renderer) add('renderer', 'renderer_not_function', 'renderer.mjs', 'renderer.mjs must export default a function ({node, slots, locale}) => html');
      } catch (error) {
        add('renderer', 'renderer_not_loaded', 'renderer.mjs', error.message);
      }
    }
  }
  // Every call is watched: the result is a string and the node is left as it came.
  const watched = renderer && (async (input) => {
    const before = stable(input.node);
    const html = await renderer(input);
    if (stable(input.node) !== before) calls.mutated.push(input.node.id);
    if (typeof html !== 'string') calls.notString.push(input.node.id);
    return typeof html === 'string' ? html : '';
  });
  const renderers = watched && type.renderer?.name ? { [type.renderer.name]: watched } : {};
  const registry = registryProblem ? null : composition.extendRegistry([type], renderers);
  const caseEntries = block.cases.filter(({ entry }) => isObject(entry?.input?.document));
  const validCase = registry && caseEntries.find(({ entry }) => composition.validate(entry.input.document, registry).valid && nodesOfType(entry.input.document.root, type.type).length);
  if (!caseEntries.length) add('output', 'cases_missing', 'cases/', 'A block brings at least one case: a Document holding it and what it draws');
  else if (registry && !validCase) add('output', 'cases_no_valid_block', 'cases/', `No case holds a valid Document with ${type.type}`);
  const noCase = registry ? `no valid case holds ${type.type}` : 'the type cannot be registered';
  if (!registry || !validCase) for (const id of ['renderer', 'form', 'unknown']) skip(id, noCase);
  if (registry && validCase) {
    const { document } = validCase.entry.input;
    const [first] = nodesOfType(document.root, type.type);
    if (type.renderer?.kind === 'registered') {
      // Unregistered, the type draws nothing and says so: what draws it is the registration.
      const bare = await composition.render(document, { registry: composition.extendRegistry([type], {}) });
      if (!bare.diagnostics.some((entry) => entry.code === 'renderer_unavailable' && entry.path === `node:${first.node.id}`)) add('renderer', 'renderer_name_taken', 'type.json $.renderer.name', `${type.renderer.name} is drawn without the block's registration: a SIMAI Framework renderer has that name`);
    }
    const drawn = await composition.render(document, { registry });
    drawn.diagnostics.filter((entry) => entry.code === 'renderer_unavailable').forEach((entry) => add('renderer', 'renderer_unavailable', entry.path, entry.message));
    if (!drawn.diagnostics.some((entry) => entry.code === 'renderer_unavailable')) {
      for (const { node } of nodesOfType(document.root, type.type)) {
        if (countIds(drawn.html, node.id) !== 1) add('renderer', 'renderer_node_id_missing', `node:${node.id}`, 'The block draws one element with data-sf-composition-id="<node id>": editors find a node by it');
        for (const children of Object.values(node.slots || {})) {
          for (const child of children) if (countIds(drawn.html, child.id) === 0) add('renderer', 'renderer_slot_dropped', `node:${child.id}`, 'A child in a slot is not drawn: the renderer must place slots.<name>');
        }
      }
    }
  }

  // ----------------------------------------------------------------- 3. form
  const dataProperties = type.data_schema?.properties || {};
  const propsProperties = type.props_schema?.properties || {};
  const scalar = (schema) => Boolean(schema?.enum) || ['string', 'integer', 'boolean', 'number'].includes(schema?.type);
  const requiredScalars = (type.data_schema?.required || []).filter((key) => scalar(dataProperties[key]));
  const fields = Array.isArray(editor?.fields) ? editor.fields : [];
  const fieldFor = (plane, key) => fields.find((field) => field.plane === plane && field.target === key);
  if (editor === undefined) {
    if (requiredScalars.length || Object.keys(propsProperties).length) add('form', 'editor_manifest_missing', 'editor.json', 'A block with parameters brings an editor manifest');
  } else {
    for (const key of requiredScalars) if (!fieldFor('data', key)) add('form', 'form_required_field_missing', `editor.json data.${key}`, `data.${key} is required and has no field: a form drawn from the manifest alone cannot make the block`);
    for (const key of Object.keys(propsProperties)) if (!fieldFor('props', key)) warn('form', 'form_prop_without_field', `editor.json props.${key}`, `props.${key} has no field`);
  }
  const words = block.words;
  let messages = {};
  if (editor !== undefined && fields.length) {
    if (words === undefined) warn('form', 'words_missing', 'words.json', 'No words: the form shows the label keys');
    else if (!isObject(words) || words.schema !== WORDS_SCHEMA || words.schema_version !== 1 || !isObject(words.words) || !isObject(words.words.en)) add('form', 'words_invalid', 'words.json', `words.json is ${WORDS_SCHEMA} with schema_version 1 and words.en`);
    else {
      messages = words.words.en;
      const wanted = fields.flatMap((field) => [field.label_key, field.help_key, ...(field.choices || []).filter((choice) => typeof choice === 'string' && /^[a-z][a-z0-9_]*$/u.test(choice)).map((choice) => `${field.label_key}.${choice}`)]).filter(Boolean);
      for (const [locale, entries] of Object.entries(words.words)) for (const key of wanted) if (!isObject(entries) || typeof entries[key] !== 'string') warn('form', 'word_missing', `words.json words.${locale}`, `${key} has no word`);
    }
  }
  const manifestOk = !problems.some((entry) => entry.group === 'manifest');
  if (editor !== undefined && !manifestOk) skip('form', 'the manifests are not valid');
  if (registry && editor !== undefined && manifestOk) {
    for (const { entry } of caseEntries) {
      const { document } = entry.input;
      if (!composition.validate(document, registry).valid) continue;
      for (const { node, path } of nodesOfType(document.root, type.type)) {
        const projected = composition.projectEditorFields(editor, type, node);
        projected.diagnostics.forEach((item) => add('form', item.code, `${entry.id} ${item.path}`, item.message));
        for (const field of projected.fields) {
          let control = '';
          try {
            control = composition.renderFieldFallback(field, { instance: node.id, messages });
          } catch (error) {
            add('form', 'form_control_not_built', `${entry.id} node:${node.id} ${field.key}`, error.message);
          }
          if (field.visibility !== 'hidden' && !control) add('form', 'form_control_not_built', `${entry.id} node:${node.id} ${field.key}`, 'The field draws no control');
        }
        // Every value the form offers makes a Document that still validates.
        const offered = (field) => {
          const kind = composition.resolveFieldKind(field)?.kind;
          if (kind === 'choice') return field.choices.map(String);
          if (kind === 'toggle') return ['true', null];
          if (kind === 'integer') return [field.constraints?.min, field.constraints?.max].filter(Number.isInteger).map(String);
          const current = node[field.plane]?.[field.target];
          return typeof current === 'string' ? [current] : [];
        };
        for (const field of fields.filter((item) => item.plane !== 'presentation')) {
          for (const raw of offered(field)) {
            const parsed = composition.parseFieldSubmission(field, raw);
            if (parsed.error) {
              add('form', 'form_value_refused', `${entry.id} node:${node.id} ${field.key}=${raw}`, parsed.error.message);
              continue;
            }
            const next = structuredClone(document);
            setNodeAt(next, path, composition.applyFieldValue(nodeAt(next, path), field, parsed));
            const checked = composition.validate(next, registry);
            if (!checked.valid) add('form', 'form_value_breaks_document', `${entry.id} node:${node.id} ${field.key}=${raw}`, checked.diagnostics.map((item) => `${item.code} at ${item.path}`).join('; '));
          }
        }
      }
    }
  }

  // --------------------------------------------------------------- 4. output
  const updates = [];
  if (registry) {
    for (const { file, entry } of block.cases) {
      if (!isObject(entry) || entry.schema !== CASE_SCHEMA || entry.schema_version !== 1 || !isObject(entry.input?.document) || !isObject(entry.expect)) {
        add('output', 'case_invalid', file, `A case is ${CASE_SCHEMA} with schema_version 1, input.document and expect`);
        continue;
      }
      const { document, content } = entry.input;
      const valid = composition.validate(document, registry).valid;
      const drawn = await composition.render(document, content === undefined ? { registry } : { registry, content });
      const actual = { valid, html: drawn.html, diagnostics: drawn.diagnostics.map(({ code, path }) => ({ code, path })), assets: [...drawn.assets].sort() };
      if (options.update) {
        updates.push(file);
        writeFileSync(join(block.folder, file), `${JSON.stringify({ ...entry, expect: actual }, null, 2)}\n`);
        continue;
      }
      if (valid !== entry.expect.valid) add('output', 'case_valid_mismatch', file, `valid is ${valid}, the case expects ${entry.expect.valid}${valid ? '' : `: ${actual.diagnostics.map((item) => `${item.code} at ${item.path}`).join('; ')}`}`);
      if (typeof entry.expect.html !== 'string' || !sameHtml(drawn.html, entry.expect.html)) add('output', 'case_html_mismatch', file, `drawn:    ${canonicalHtml(drawn.html)}\n           expected: ${typeof entry.expect.html === 'string' ? canonicalHtml(entry.expect.html) : '(none)'}`);
      if (!Array.isArray(entry.expect.diagnostics) || !sameJson(diagnosticKeys(drawn.diagnostics), diagnosticKeys(entry.expect.diagnostics), stable)) add('output', 'case_diagnostics_mismatch', file, `drawn ${JSON.stringify(diagnosticKeys(drawn.diagnostics))}, expected ${JSON.stringify(diagnosticKeys(entry.expect.diagnostics || []))}`);
      if (!Array.isArray(entry.expect.assets) || !sameJson(actual.assets, [...entry.expect.assets].sort(), stable)) add('output', 'case_assets_mismatch', file, `drawn ${JSON.stringify(actual.assets)}, expected ${JSON.stringify(entry.expect.assets)}`);
      if (!valid && drawn.html !== '') add('output', 'case_invalid_drawn', file, 'An invalid Document drew something');
      unsafeOutput(drawn.html).forEach((item) => add('output', item.code, `${file} ${item.path}`, item.message));
    }
    if (!options.update && caseEntries.length && !caseEntries.some(({ entry }) => entry.expect?.valid === false)) warn('output', 'cases_no_invalid', 'cases/', 'No case shows a Document the block refuses');
    // Every choice of every parameter is drawn by some case; a parameter left
    // out is its field's default, as a Document writes only what differs.
    const seen = new Set();
    for (const { entry } of caseEntries) {
      for (const { node } of nodesOfType(entry.input.document.root, type.type)) {
        for (const key of Object.keys(propsProperties)) {
          const value = node.props && key in node.props ? node.props[key] : fieldFor('props', key)?.default;
          if (value !== undefined) seen.add(`${key}=${value}`);
        }
      }
    }
    if (validCase) for (const [key, schema] of Object.entries(propsProperties)) for (const choice of schema.enum || []) if (!seen.has(`${key}=${choice}`)) warn('output', 'case_coverage', `props.${key}`, `No case draws ${key} ${JSON.stringify(choice)}`);
    // Hostile text in every string the schemas let through: the renderer escapes it.
    if (validCase && renderer) {
      const { document } = validCase.entry.input;
      for (const { node, path } of nodesOfType(document.root, type.type)) {
        for (const [plane, properties] of [['data', dataProperties], ['props', propsProperties]]) {
          for (const [key, schema] of Object.entries(properties)) {
            const probes = schema?.type === 'string' && !schema.enum ? [['markup', HOSTILE_MARKUP], ['a javascript: address', HOSTILE_URL]]
              : schema?.type === 'array' && schema.items?.oneOf ? [['an inline link to javascript:', [{ type: 'link', href: HOSTILE_URL, children: [{ type: 'text', value: HOSTILE_MARKUP }] }]]] : [];
            for (const [label, value] of probes) {
              const next = structuredClone(document);
              const target = nodeAt(next, path);
              target[plane] = { ...(target[plane] || {}), [key]: value };
              if (!composition.validate(next, registry).valid) continue;
              const drawn = await composition.render(next, { registry });
              unsafeOutput(drawn.html).forEach((item) => add('output', item.code, `node:${node.id} ${plane}.${key} holding ${label}: ${item.path}`, `${item.message}; the renderer must escape text and check addresses (the Document's URL rule does not reach a product type's own data)`));
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------- 5. unknown
  if (registry && validCase) {
    const { document } = validCase.entry.input;
    // A host that does not know the block refuses the Document whole: it is
    // never half drawn, and an editor keeps the node as it came.
    const checked = composition.validate(document);
    const paths = nodesOfType(document.root, type.type).map(({ path }) => `${path}.type`);
    if (!paths.every((path) => checked.diagnostics.some((entry) => entry.code === 'type_unknown' && entry.path === path))) add('unknown', 'unknown_not_refused', 'cases/', `A host without the block does not report type_unknown at ${paths.join(', ')}`);
    const blind = await composition.render(document);
    if (blind.html !== '') add('unknown', 'unknown_drawn', 'cases/', 'A host without the block drew the Document');
    // A type the block does not know, inside the block, is refused the same way.
    const [first] = nodesOfType(document.root, type.type);
    const slot = Object.keys(type.slots || {})[0];
    if (slot) {
      const next = structuredClone(document);
      const target = nodeAt(next, first.path);
      const stranger = { id: 'kit-unknown', type: 'kit.unknown-type', data: { kept: 'byte for byte' } };
      target.slots = { ...(target.slots || {}), [slot]: [...(target.slots?.[slot] || []), stranger] };
      const inner = composition.validate(next, registry);
      if (!inner.diagnostics.some((entry) => entry.code === 'type_unknown')) add('unknown', 'unknown_child_accepted', `node:${first.node.id} slots.${slot}`, 'An unknown type inside the block is not refused');
      const drawn = await composition.render(next, { registry });
      if (drawn.html !== '') add('unknown', 'unknown_child_drawn', `node:${first.node.id} slots.${slot}`, 'A Document with an unknown type inside the block was drawn');
      if (!sameJson(nodeAt(next, first.path).slots[slot].at(-1), stranger, stable)) add('unknown', 'unknown_child_changed', `node:${first.node.id}`, 'The unknown node was changed');
    }
  }
  if (calls.mutated.length) add('unknown', 'renderer_mutates_node', [...new Set(calls.mutated)].map((id) => `node:${id}`).join(', '), 'The renderer changed the node it was given: the Document must come out byte for byte');
  if (calls.notString.length) add('renderer', 'renderer_not_string', [...new Set(calls.notString)].map((id) => `node:${id}`).join(', '), 'The renderer returned something that is not a string');

  if (!registry) skip('output', 'the type cannot be registered');
  return result({ updated: updates });
}

/** The report as a developer reads it in a terminal. */
export function formatReport(report, cwd = process.cwd()) {
  const lines = [`SIMAI Framework block check: ${report.type ?? '(no type)'} ${report.version ?? ''} (${relative(cwd, report.folder) || '.'})`];
  for (const group of report.groups) {
    lines.push(`  ${group.status.toUpperCase()}  ${group.id.padEnd(9)} ${group.title}${group.skipped ? ` (not run: ${group.skipped})` : ''}`);
    for (const problem of group.problems) lines.push(`        ${problem.code} at ${problem.path}: ${problem.message}`);
  }
  for (const warning of report.warnings) lines.push(`  WARN  ${warning.group.padEnd(9)} ${warning.code} at ${warning.path}: ${warning.message}`);
  if (report.updated?.length) lines.push(`  wrote expect of ${report.updated.join(', ')}: review the diff`);
  const failed = report.groups.reduce((sum, group) => sum + group.problems.length, 0);
  lines.push(report.ok
    ? `BLOCK_CHECK_PASS ${report.type}@${report.version} groups=${report.groups.length} cases=${report.cases} warnings=${report.warnings.length}`
    : `BLOCK_CHECK_FAIL ${report.type ?? basename(report.folder)}@${report.version ?? '-'} problems=${failed} skipped=${report.groups.filter((group) => group.status === 'skip').length} warnings=${report.warnings.length}`);
  return lines.join('\n');
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at === -1) return undefined;
    const [, value] = args.splice(at, 2);
    return value;
  };
  const flag = (name) => {
    const at = args.indexOf(name);
    if (at !== -1) args.splice(at, 1);
    return at !== -1;
  };
  const framework = take('--framework');
  const json = flag('--json');
  const update = flag('--update');
  if (flag('--help') || args.length !== 1) {
    process.stdout.write('node kits/block/check.mjs <block folder> [--framework <dir holding core/>] [--json] [--update]\n');
    return args.length === 1 ? 0 : 2;
  }
  const report = await checkBlock(args[0], { framework: framework && resolve(framework), update });
  process.stdout.write(`${json ? JSON.stringify(report, null, 2) : formatReport(report)}\n`);
  return report.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}

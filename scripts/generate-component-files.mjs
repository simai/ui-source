#!/usr/bin/env node
// The files of a Smart component that standard simai.smart-component 1.4 makes
// from the five a person writes (component.json, examples.json, index.js,
// lang/<locale>.json, docs.md):
//
//   rule.js              component.json tag, relations, styles
//   aliases.json         component.json aliases
//   meta.mjs             component.json settings (+ base settings, host attributes, alias settings)
//   studio.fixture.json  examples.json, the example marked "studio"
//   studio.scenario.json examples.json, that example's studio.scenario
//   probe.json           examples.json, the page example with "checks"
//   smart.manifest.json  component.json (+ x-registry), lang/en.json, the aliases
//                        and the build stamp (provenance, runtime pair)
//
// Phase 1 (this script): the folders are still standard 1.3.10 folders, so the
// generator first reads a 1.4 view of the folder in memory. Where the five
// files do not carry a fact yet it takes it from today's files (the bridge,
// listed per component in the report, removed in phase B):
//
//   relations       <- rule.js (relation list and the comments inside it; regex/css overrides)
//   aliases         <- aliases.json
//   setting words   <- meta.mjs and smart.manifest.json inputs (only where component.json has no summary)
//   x-registry      <- smart.manifest.json (what only the registry says)
//   studio          <- studio.fixture.json / studio.scenario.json (what differs from the derivation)
//   pages           <- probe.json
//   stamp           <- smart.manifest.json provenance and compatibility.runtime_pair (a build computes it)
//
// Nothing in a component folder changes unless --write is given.
//
// Usage:
//   node scripts/generate-component-files.mjs --check [--bytes] [--component <name>]... [--package <root>]... [--json <file>]
//   node scripts/generate-component-files.mjs --write [--component <name>]... [--package <root>]
//   node scripts/generate-component-files.mjs --convert --component <name>... [--package <root>]
//
//   --convert    phase A: rewrite a 1.3.10 folder's component.json and examples.json in
//                the 1.4 form (then --write the generated files from them)
//
//   --check      compare generated with committed; exit 1 when a committed file differs
//                (semantically: JSON with sorted keys, rule.js as the evaluated rule,
//                meta.mjs as its default export); --bytes also fails on byte differences
//   --write      write the generated files into the component folders
//   --component  limit to these folders (repeatable)
//   --file       limit the check (and --write) to these generated files (repeatable)
//   --package    a package root holding src/smart/<name>/ (repeatable; default: this repository).
//                ui-pro runs it over its own folders: --package ../ui-pro/components
//   --json       write the full result (every difference by path) to a file
//   --quiet      print only the summary line
import {Buffer} from 'node:buffer';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const GENERATED = ['rule.js', 'aliases.json', 'meta.mjs', 'studio.fixture.json', 'studio.scenario.json', 'probe.json', 'smart.manifest.json'];
export const AUTHORED = ['component.json', 'examples.json', 'index.js', 'lang', 'docs.md'];
export const GENERATOR = 'scripts/generate-component-files.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const camel = (name) => String(name).replace(/-([a-z0-9])/gu, (_, c) => c.toUpperCase());
const short = (tag) => tag.replace(/^sf-/u, '');
export const sortKeys = (value) => Array.isArray(value) ? value.map(sortKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])) : value;
export const canon = (value) => JSON.stringify(sortKeys(value));
const same = (a, b) => canon(a) === canon(b);

// ======================================================================
// The generators: a 1.4 view {component, examples, lang, files, folder} -> files

// ---------------------------------------------------------------- aliases.json

export const ALIAS_ROW_ORDER = ['from', 'to', 'kind', 'setting', 'component', 'since', 'remove_after', 'mode', 'cancelable', 'manifest', 'section', 'note', 'when'];
// Fields of a row that only the generators read (never shipped to the shim).
const ALIAS_AUTHOR_ONLY = new Set(['summary', 'values', 'default', 'signature']);

export function aliasRows(component) {
  const a = component.aliases;
  if (!a) return [];
  return a.rows.map((row) => {
    const full = {...row};
    full.component ??= component.tag;
    full.since ??= a.since;
    full.remove_after ??= a['remove-after'];
    // An event row's manifest names: the old DOM name and the new verb.
    if (full.kind === 'event' && full.manifest === true) {
      full.manifest = {from: full.from, to: String(full.to).replace(`sf-${short(component.tag)}-`, '')};
    }
    return full;
  });
}

export function genAliases(component) {
  const a = component.aliases;
  if (!a) return null;
  const rows = aliasRows(component).map((row) => {
    const out = {};
    for (const key of ALIAS_ROW_ORDER) if (key in row) out[key] = row[key];
    for (const key of Object.keys(row)) if (!(key in out) && !ALIAS_AUTHOR_ONLY.has(key)) out[key] = row[key];
    return out;
  });
  const head = {};
  head.$comment = a.$comment ?? `Dated aliases of ${component.tag}, generated from component.json "aliases" by ${GENERATOR}; read by core/js/alias-table.js and the shim. Do not edit.`;
  head.component = component.tag;
  head.since = a.since;
  head.remove_after = a['remove-after'];
  for (const [key, value] of Object.entries(a['x-head'] ?? {})) head[key] = value;
  head.aliases = rows;
  return head;
}

// --------------------------------------------------------------------- rule.js

export function ruleObject(component, folderFiles = []) {
  const extra = component['x-rule'] ?? {};
  const rule = {tags: [component.tag], type: 'smart', mode: 'smart', js: true};
  const hasCss = Boolean(component.styles) || folderFiles.some((file) => file.endsWith('.css') || file.endsWith('.scss'));
  // x-rule.css (phase 1 bridge): true/false as rule.js writes it, null when
  // rule.js names no css although the folder holds a sheet.
  if ('css' in extra) { if (extra.css !== null) rule.css = extra.css; } else if (hasCss) rule.css = true;
  if ('regex' in extra) rule.regex = extra.regex;
  rule.relation = (component.relations ?? []).map((relation) => {
    const out = {name: relation.name};
    if (relation.lazy) out.lazy = true;
    return out;
  });
  return rule;
}

export function genRule(component, folderFiles = []) {
  const name = `cl-${component.folder ?? short(component.tag)}`;
  const rule = ruleObject(component, folderFiles);
  const q = (value) => `'${String(value).replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;
  const lines = [];
  if (component.relations && !component['x-bridged']) lines.push(`// Generated from component.json by ${GENERATOR}; do not edit.`);
  for (const line of component['x-rule']?.$comment ?? []) lines.push(line ? `// ${line}` : '//');
  lines.push(`SF.RuleLoader[${q(name)}] = {`, `  tags: [${rule.tags.map(q).join(', ')}],`);
  // x-rule.regex is the Loader's regular expression literal, written as text.
  if ('regex' in rule) lines.push(`  regex: ${isRegExp(rule.regex) || /^\/.+\/[a-z]*$/u.test(String(rule.regex)) ? String(rule.regex) : JSON.stringify(rule.regex)},`);
  lines.push(`  type: 'smart',`, `  mode: 'smart',`, `  js: true,`);
  if ('css' in rule) lines.push(`  css: ${rule.css},`);
  lines.push('  relation: [');
  for (const relation of component.relations ?? []) {
    for (const line of relation.$comment ?? []) lines.push(line ? `    // ${line}` : '    //');
    lines.push(`    { name: ${q(relation.name)}${relation.lazy ? ', lazy: true' : ''} },`);
  }
  lines.push('  ],', '};');
  const after = component['x-rule']?.['$comment-after'] ?? [];
  if (after.length) lines.push('', ...after.map((line) => (line ? `// ${line}` : '//')));
  lines.push('');
  return lines.join('\n');
}

const isRegExp = (value) => Object.prototype.toString.call(value) === '[object RegExp]';

// -------------------------------------------------------------------- meta.mjs

const BASE_TEMPLATE_DESCRIPTION = 'Template variant name for SfBaseElement external templates.';

// One reading of the interface for tools: settings, the base settings, the
// host's aria-label and the dated alias settings, with their words.
export function attributesOf(component, lang = {}) {
  const reg = component['x-registry'] ?? {};
  const extra = reg.inputs ?? {};
  const settings = component.settings ?? {};
  const out = {};
  // The base interface (§4.1): every element takes these three.
  out.template = {kind: 'custom', valueType: 'string', default: 'default', description: BASE_TEMPLATE_DESCRIPTION};
  out['root-class'] = {kind: 'custom', valueType: 'string', default: ''};
  out['root-style'] = {kind: 'custom', valueType: 'string', default: ''};
  // A default taken from the words (default-from runtime.<key>) is the page
  // language's word, read at run time: the registry names no fixed default.
  const word = (spec) => spec;
  for (const [name, spec] of Object.entries(settings)) {
    if (['list', 'object', 'state'].includes(spec.type)) continue;
    out[name] = attributeOf(word(spec));
  }
  for (const [name, spec] of Object.entries(component.values ?? {})) {
    if (name.startsWith('effective-') || out[name]) continue;
    if (spec?.default === undefined && !spec?.['default-from']) continue;
    if (['list', 'object', 'state'].includes(spec.type)) continue;
    out[name] = attributeOf(spec);
  }
  if ((component.accessibility?.name?.from ?? []).includes('aria-label')) {
    out['aria-label'] = {kind: 'custom', valueType: 'string', default: ''};
  }
  for (const row of aliasRows(component)) {
    if (!settingAlias(row)) continue;
    const target = settings[row.to];
    if (!target) continue;
    const attribute = attributeOf(target);
    if (attribute.kind === 'enum') attribute.values = row.values ?? aliasValues(component, row.to);
    // An inverted boolean (unclose for dismissible): present means the target is false.
    if (row.mode === 'inverted' && attribute.kind === 'boolean') attribute.default = 'false';
    if ('default' in row) attribute.default = row.default;
    attribute.description = row.summary ?? `Dated alias of ${row.to} until ${row.remove_after}${row.mode === 'inverted' ? ', inverted' : ''}.`;
    delete attribute.examples;
    if (target.examples) attribute.examples = target.examples;
    out[row.from] = attribute;
  }
  const structured = (name) => ['list', 'object', 'state'].includes((settings[name] ?? component.values?.[name])?.type);
  for (const [name, fields] of Object.entries(extra)) {
    if (structured(name)) continue;
    out[name] ??= {kind: 'custom', valueType: 'string', default: ''};
    if (fields.description) out[name].description = fields.description;
    if ('default' in fields) out[name].default = fields.default;
  }
  for (const attribute of Object.values(out)) if (attribute.description === undefined) delete attribute.description;
  return out;
}

// A dated alias of a setting: a setting row, or an attribute row (the
// attribute alone is renamed) that is neither a host attribute nor retired.
export function settingAlias(row) {
  if (!row.to) return false;
  if (row.kind === 'setting') return true;
  return row.kind === 'attribute' && !['host-attribute', 'retired', 'page-trigger'].includes(row.mode);
}

function attributeOf(spec) {
  const out = {};
  if (spec.type === 'boolean') Object.assign(out, {kind: 'boolean', values: ['true', 'false'], default: spec.default === true ? 'true' : 'false'});
  else if (spec.type === 'enum') Object.assign(out, {kind: 'enum', values: [...spec.values], default: spec.default ?? ''});
  else Object.assign(out, {kind: 'custom', valueType: spec.type === 'number' ? (spec.integer ? 'integer' : 'number') : 'string', default: spec.default ?? (spec.type === 'number' || spec['default-from'] ? undefined : '')});
  if (spec.min !== undefined) out.minimum = spec.min;
  if (spec.max !== undefined) out.maximum = spec.max;
  if (out.default === undefined) delete out.default;
  if (spec.summary) out.description = spec.summary;
  if (spec.examples) out.examples = spec.examples;
  return out;
}

// An alias setting offers what its target offers: the target's former values
// are aliases of the target (compatibility.aliases), not values of either name.
function aliasValues(component, setting) {
  return [...(component.settings?.[setting]?.values ?? [])];
}

export function metaObject(component, lang = {}) {
  return {tag: component.tag, source: `src/smart/${component.folder ?? short(component.tag)}/component.json`, attributes: attributesOf(component, lang)};
}

export function genMeta(component, lang = {}) {
  const name = `sf${camel(`-${short(component.tag)}`)}Meta`;
  return [
    `// Generated from component.json by ${GENERATOR}; do not edit.`,
    `const ${name} = ${JSON.stringify(metaObject(component, lang), null, 2)};`,
    '',
    `export {${name}};`,
    `export default ${name};`,
    '',
  ].join('\n');
}

// ------------------------------------------------------------ examples → Studio

export function studioExample(examples) {
  return (examples.examples ?? []).find((example) => example.studio);
}

export function genFixture(component, examples, lang) {
  const example = studioExample(examples);
  if (!example) return null;
  const s = example.studio;
  const title = lang.en?.title ?? component.tag;
  return {
    schema: 'simai.smart-component-fixture.v2',
    id: s.id ?? example.name,
    component: component.id,
    title: s.title ?? `${title} reference`,
    summary: s.summary ?? `Deterministic reference fixture for ${component.tag}.`,
    locale: s.locale ?? 'ru',
    props: s.props ?? {...(example.settings ?? {}), ...(example.attributes ?? {})},
    children: s.children ?? [],
    state: s.state ?? 'default',
    ...(s['x-extra'] ?? {}),
  };
}

export const DEFAULT_ASSERTIONS = ['upgraded', 'visible', 'no-console-error', 'no-network'];

export function genScenario(component, examples) {
  const example = studioExample(examples);
  if (!example || !example.studio.scenario) return null;
  const s = example.studio.scenario;
  return {
    schema: 'simai.smart-component-scenario.v1',
    id: s.id ?? 'smoke',
    component: component.id,
    fixture: example.studio.id ?? example.name,
    viewport: s.viewport ?? 'desktop',
    actions: (s.steps ?? []).map((step) => step.raw ?? ({type: 'invoke', method: step.invoke, arguments: step.with ?? []})),
    assertions: (s.assertions ?? DEFAULT_ASSERTIONS).map((type) => (typeof type === 'string' ? {type} : type)),
    ...(s['x-extra'] ?? {}),
  };
}

export const DEFAULT_PROBE_FORMAT = 'stands/15-scenarios (A4 modal: a page, probes in steps); the runner is tests/browser/manifest-probes.browser.mjs';

export function genProbe(component, examples) {
  const raw = (examples.pages ?? []).find((item) => item['x-probe']);
  if (raw) return raw['x-probe'];
  const example = [...(examples.pages ?? []), ...(examples.examples ?? [])].find((item) => item.checks && item.page);
  if (!example) return null;
  return {
    component: component.tag,
    probe: example.title,
    format: example.format ?? DEFAULT_PROBE_FORMAT,
    page: example.page,
    probes: example.checks,
    ...(example['x-extra'] ?? {}),
  };
}

// --------------------------------------------------------- smart.manifest.json

const jsonType = (type) => ({boolean: 'boolean', number: 'number', list: 'array', object: 'object'}[type] ?? 'string');

export function inputsOf(component, lang = {}) {
  const attributes = attributesOf(component, lang);
  const properties = {};
  for (const [name, attribute] of Object.entries(attributes)) {
    const property = {type: attribute.kind === 'boolean' ? 'boolean' : attribute.valueType ?? 'string'};
    if (attribute.default !== undefined) property.default = attribute.kind === 'boolean' ? attribute.default === 'true' : attribute.default;
    if (attribute.description) property.description = attribute.description;
    if (attribute.kind === 'enum') property.enum = [...attribute.values];
    if (attribute.examples) property.examples = attribute.examples;
    if (attribute.minimum !== undefined) property.minimum = attribute.minimum;
    if (attribute.maximum !== undefined) property.maximum = attribute.maximum;
    properties[name] = property;
  }
  // Lists and objects are properties only: they are inputs, not attributes.
  for (const [name, spec] of [...Object.entries(component.settings ?? {}), ...Object.entries(component.values ?? {})]) {
    if (!['list', 'object'].includes(spec.type) || properties[name]) continue;
    if (component.values?.[name] && spec.default === undefined && !spec['default-from']) continue;
    const property = {type: jsonType(spec.type)};
    if (spec.default !== undefined) property.default = spec.default;
    if (spec.entries) property.items = {type: 'object'};
    if (spec.summary) property.description = spec.summary;
    if (spec.examples) property.examples = spec.examples;
    properties[name] = property;
  }
  // The inputs a trait brings (phase 1: carried from the registry; a trait
  // contract will give them).
  for (const [name, property] of Object.entries(component['x-registry']?.['trait-inputs'] ?? {})) properties[name] ??= property;
  // Constraints of a base setting or a host attribute that only the registry says.
  for (const [name, fields] of Object.entries(component['x-registry']?.inputs ?? {})) {
    properties[name] ??= {type: 'string'};
    for (const [field, value] of Object.entries(fields)) if (field !== 'description' && field !== 'default') properties[name][field] = value;
  }
  return properties;
}

// The DOM name of an event (core/js/element-manifest.js eventName, §8): the
// verb itself for "carries": "native" and for change/input (unless
// "x-native": false), `sf-<verb>` for an event a trait brings ("shared":
// "<trait>"), otherwise <tag>-<verb>.
const NATIVE_EVENTS = new Set(['change', 'input']);
export function domEvent(component, verb) {
  const declared = component.events?.[verb];
  if (declared?.carries === 'native') return verb;
  // An event a trait brings is one event for the whole family -- a form hears
  // it once for every field -- so its name holds no tag: the verb names the
  // trait's event in full (`field-reset` -> `sf-field-reset`, §8, §20.2). It
  // had no form in component.json at all, so six fields described the event
  // under its retired name and declared no current one (standard 1.3.13).
  if (declared?.shared) return `sf-${verb}`;
  if (NATIVE_EVENTS.has(verb) && declared?.['x-native'] !== false) return verb;
  return `${component.tag}-${verb}`;
}
const valueAliases = (rows) => rows.filter((row) => row.kind === 'value' && row.setting);

// A carried field or a parameter as JSON Schema: §4.2 types, values, nullable,
// and the field's words (summary) and extra constraints (schema).
export function fieldSchema(spec) {
  const t = typeof spec === 'string' ? {type: spec} : (spec ?? {});
  let out = {};
  if (t.type === 'enum') out = t.values.length === 1 ? {const: t.values[0]} : {enum: [...t.values, ...(t.nullable && !t.values.includes(null) ? [null] : [])]};
  else if (t.type === 'id') out = {};
  else if (t.type === 'number' && t.integer) out = {type: 'integer'};
  else out = {type: jsonType(t.type)};
  if (t.nullable && out.type) out.type = [out.type, 'null'];
  if (t.summary) out.description = t.summary;
  if (t.schema) Object.assign(out, t.schema);
  return out;
}

export function eventsOf(component) {
  const out = {};
  for (const [verb, spec] of Object.entries(component.events ?? {})) {
    // A native name with a detail (x-detail: dropdown, quantity) describes that detail.
    const detail = spec?.carries === 'native' && spec['x-detail'] && typeof spec['x-detail'] === 'object' ? spec['x-detail'] : null;
    const carries = detail ?? (spec?.carries && typeof spec.carries === 'object' ? spec.carries : {});
    const properties = {};
    for (const [field, type] of Object.entries(carries)) properties[camel(field)] = fieldSchema(type);
    const required = Object.entries(carries).filter(([, type]) => !(type && typeof type === 'object' && type.optional)).map(([field]) => camel(field));
    // A native event (§8) is the browser's Event: it has no detail.
    const payload = spec?.carries === 'native' && !detail ? {type: 'null', description: 'A native Event: there is no detail.'} : {type: 'object', required, properties, additionalProperties: true};
    out[domEvent(component, verb)] = {summary: spec?.summary ?? `${verb} (vocabulary).`, payload};
  }
  for (const [name, fields] of Object.entries(component['x-registry']?.['event-fields'] ?? {})) if (out[name]) Object.assign(out[name], fields);
  // The events of the vocabulary, before the dated names are added: what
  // follows may not call one of these an alias of something else.
  const vocabulary = new Set(Object.keys(out));
  // A former event name as the registry described it (its detail, alias_of):
  // phase A keeps it until the alias ends.
  for (const [name, event] of Object.entries(component['x-registry']?.['alias-events'] ?? {})) out[name] = event;
  for (const row of aliasRows(component)) {
    if (row.kind !== 'event' || out[row.from]) continue;
    out[row.from] = {summary: row.summary ?? `Dated alias of ${row.to} until ${row.remove_after} (${row.mode ?? 'same-detail'}).`, payload: {type: 'object'}};
  }
  // Which event a dated name is the alias of, and which event is the name to
  // bind. Neither block above writes either -- the registry's entries predate
  // the fields, and an invented entry had only a summary -- so a retired name
  // read as an event of its own: sf-pagination printed sixteen events where it
  // has eight and eight retired names, each pair looking equally current
  // (ui-doc ef9e3e6f). The target is named by its own key in this map, because
  // that is what the manifest schema asks for (an alias_of points at a
  // canonical event of the same manifest) and what lets the documentation find
  // its detail (ui-doc build-smart-reference.mjs). A trait's event is declared
  // like any other -- "shared": "<trait>", so sf-field:reset -> sf-field-reset
  // finds its target -- which is what the six fields lacked: they described the
  // event under its retired name and declared no current one (1.3.13).
  for (const row of aliasRows(component)) {
    if (row.kind !== 'event' || !row.to || vocabulary.has(row.from)) continue;
    const event = out[row.from];
    if (!event || event.alias_of) continue;
    const name = out[row.to] ? row.to : (out[domEvent(component, row.to)] ? domEvent(component, row.to) : null);
    if (!name) continue;
    event.alias_of = name;
    out[name].canonical = true;
  }
  return out;
}

export function methodsOf(component) {
  const out = {};
  for (const [name, spec] of Object.entries(component.actions ?? {})) {
    out[camel(name)] = {
      summary: spec?.summary ?? `The action ${name}.`,
      arguments: Object.entries(spec?.with ?? {}).map(([field, type]) => ({name: camel(field), schema: fieldSchema(type)})),
      // An action answers with an outcome (an object); x-returns in words is
      // that object's description.
      returns: typeof spec?.['x-returns'] === 'string' ? {type: 'object', description: spec['x-returns']} : spec?.['x-returns'] ?? {type: 'object'},
    };
  }
  return {...out, ...(component['x-registry']?.methods ?? {})};
}

// The registry id of a Loader relation: cl-<folder> is a Smart element, a
// name with a slash is a utility (no registry entry), any other a class
// component bundle.
export function usesOf(component) {
  const ids = new Set();
  for (const {name} of component.relations ?? []) {
    if (name.includes('/')) continue;
    ids.add(name.startsWith('cl-') ? `smart.${name.slice(3)}` : `component.${name}`);
  }
  return [...ids].sort();
}

export const MANIFEST_DEFAULTS = {
  kind: 'smart', reuse_mode: 'whole', lifecycle: 'experimental',
  capabilities: ['render', 'theme', 'responsive'],
  persistence: {mode: 'none', source_of_truth: 'component', network_owner: 'none', revision_field: null},
  adapter: {kind: 'generic', protocol: 'simai.smart-studio-adapter.v1', module: null},
  readiness: {level: 'described', required_checks: ['manifest', 'fixture', 'runtime-upgrade', 'scenario-smoke']},
};

export function genManifest(component, lang, stamp = {}) {
  const reg = component['x-registry'] ?? {};
  const pick = (key) => (key in reg ? reg[key] : MANIFEST_DEFAULTS[key]);
  const folder = component.folder ?? short(component.tag);
  const aliases = aliasRows(component);
  const composition = {uses: usesOf(component), public_parts: reg['public-parts'] ?? []};
  if (reg['composition-declarative']) composition.declarative = declarativeOf(component, reg['composition-declarative'], lang);
  const manifest = {
    schema_version: 2,
    id: component.id,
    version: component.version,
    title: lang.en?.title ?? folder,
    summary: component['x-summary'] ?? '',
    kind: pick('kind'),
    reuse_mode: pick('reuse_mode'),
    lifecycle: pick('lifecycle'),
    tags: reg.tags ?? [folder],
    capabilities: pick('capabilities'),
    custom_element: component.tag,
    templates: Object.keys(component.templates ?? {default: {}}),
    exported_parts: reg['exported-parts'] ?? [],
    composition,
    inputs: {type: 'object', ...(reg['inputs-required'] ? {required: reg['inputs-required']} : {}), properties: inputsOf(component, lang), additionalProperties: false},
    item_contract: reg.item_contract ?? {},
    contracts: reg.contracts ?? {},
    methods: methodsOf(component),
    events: eventsOf(component),
    state: reg.state ?? {machines: {}, visual_states: ['default']},
    persistence: pick('persistence'),
    ownership: reg.ownership,
    ...(reg.backend ? {backend: reg.backend} : {}),
    security: reg.security,
    accessibility: {
      role: component.accessibility?.role ?? null,
      accessible_name: reg.accessibility?.accessible_name ?? 'recommended',
      keyboard: reg.accessibility?.keyboard ?? Object.keys(component.accessibility?.keys ?? {Tab: 'reach'}),
      focus: reg.accessibility?.focus ?? 'Keep visible focus on the active control.',
    },
    presentation: reg.presentation,
    adapter: pick('adapter'),
    artifacts: reg.artifacts ?? {fixtures: ['studio.fixture.json'], scenarios: ['studio.scenario.json']},
    readiness: pick('readiness'),
    compatibility: {
      contract_schema: {id: 'https://simai.io/contracts/smart-component-manifest.v2.schema.json', version: 2},
      runtime_pair: stamp.runtime_pair ?? null,
      aliases: [...(reg.compatibility?.aliases ?? []), ...valueAliases(aliases).map((row) => `${row.setting}=${row.from}`)],
      // A deprecation names the component version the alias came with: only
      // when component.json says it (aliases["since-version"]).
      deprecations: [...(reg.compatibility?.deprecations ?? []), ...(component.aliases?.['since-version'] ? valueAliases(aliases).map((row) => ({path: `${row.setting}=${row.from}`, since: component.aliases['since-version'], replacement: `${row.setting}=${row.to}`})) : [])],
      replacement: reg.compatibility?.replacement ?? null,
      migrations: reg.compatibility?.migrations ?? [],
    },
    provenance: stamp.provenance ?? null,
    ai_guidance: reg.ai_guidance,
  };
  for (const [key, value] of Object.entries(reg.other ?? {})) manifest[key] = value;
  return manifest;
}

// The composition document's descriptor: the interface parts are derived, the
// rest (standard, profiles, data, persistence, presentation) is carried.
function declarativeOf(component, carried, lang) {
  const out = {...carried};
  const attributes = attributesOf(component, lang);
  const aliasNames = new Set(aliasRows(component).filter(settingAlias).map((row) => row.from));
  // A document sets the interface, never arbitrary classes or styles: the base
  // settings root-class and root-style stay out of the props a document holds.
  if ('props' in carried) out.props = Object.keys(attributes).filter((name) => !aliasNames.has(name) && !['root-class', 'root-style'].includes(name));
  if ('events' in carried) out.events = Object.keys(component.events ?? {}).map((verb) => domEvent(component, verb));
  if ('renderer' in carried) out.renderer = {kind: 'custom-element', name: component.tag};
  if ('assets' in carried) out.assets = [`smart/${component.folder ?? short(component.tag)}`];
  if ('host_port' in carried && component.port) {
    out.host_port = {port: component.port.id, version: component.port.version, path: component.port.contract,
      sha256: component['x-port']?.sha256 ?? carried.host_port?.sha256, supported_versions: component['x-port']?.supports ?? carried.host_port?.supported_versions};
  }
  return out;
}

// A 1.4 view -> {file: text}. Only the files the view gives (an aliases
// block, a studio example, a page with checks); meta.mjs only where the
// component keeps one (phase 1: no new files in a folder).
export function generateFiles(view, {stamp = {}, withMeta = true} = {}) {
  const {component, examples, lang, files} = view;
  const out = {'rule.js': genRule(component, files)};
  const aliases = genAliases(component);
  if (aliases) out['aliases.json'] = json(aliases);
  if (withMeta) out['meta.mjs'] = genMeta(component, lang);
  const fixture = genFixture(component, examples, lang);
  if (fixture) out['studio.fixture.json'] = json(fixture);
  const scenario = genScenario(component, examples);
  if (scenario) out['studio.scenario.json'] = json(scenario);
  const probe = genProbe(component, examples);
  if (probe) out['probe.json'] = json(probe);
  out['smart.manifest.json'] = json(genManifest(component, lang, stamp));
  return out;
}

// ======================================================================
// The bridge: a 1.3.10 folder -> its 1.4 view in memory (stand 26 convert.mjs)

function listFiles(root, base = root) {
  const out = [];
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (entry.name === 'static' || entry.name === 'node_modules') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

export function evalRule(text) {
  const sandbox = {SF: {RuleLoader: Object.create(null)}};
  vm.runInContext(text, vm.createContext(sandbox));
  return sandbox.SF.RuleLoader;
}

const plainRule = (rules) => JSON.parse(JSON.stringify(rules, (key, value) => (isRegExp(value) ? {regex: String(value)} : value)));

// Phase 1 reads meta.mjs as data; a meta.mjs exports one object literal.
async function importModule(file) {
  return import(`${pathToFileURL(file).href}?read=${Date.now()}`);
}

// The inputs a trait brings. The trait is code (src/smart/helpers/
// inherited-value.js) with no contract file yet; until one exists the bridge
// takes these inputs from the registry.
const TRAIT_INPUTS = {'field-inherit@1': ['inherited-value', 'inherited-text', 'reset-label']};

export async function viewOfToday(folder) {
  const read = (file) => readJson(path.join(folder, file));
  const has = (file) => existsSync(path.join(folder, file));
  // conflicts: the interface said twice, differently (the report classifies
  // them); identity: a bridged file that names another component, fixture or tag.
  const log = {bridge: [], decisions: [], dropped: [], conflicts: [], identity: []};
  const note = (what) => log.decisions.push(what);
  const component = read('component.json');
  const name = path.basename(folder);
  if (short(component.tag) !== name) component.folder = name;
  const manifest = has('smart.manifest.json') ? read('smart.manifest.json') : null;
  const tagShort = short(component.tag);
  const files = listFiles(folder);

  // ------------------------------------------------------------ rule.js → relations
  const ruleText = readFileSync(path.join(folder, 'rule.js'), 'utf8');
  const rules = evalRule(ruleText);
  const ruleNames = Object.keys(rules);
  if (ruleNames.length !== 1 || ruleNames[0] !== `cl-${name}`) throw new Error(`rule.js writes ${ruleNames.join(', ')}, not cl-${name}`);
  const rule = rules[ruleNames[0]];
  const relations = rule.relation.map((relation) => ({...relation}));
  log.bridge.push('relations <- rule.js');
  {
    // Comments right before a relation inside the list are its $comment;
    // comments before the rule are the rule's (x-rule.$comment), comments
    // after it x-rule.$comment-after; any other comment is listed as dropped.
    const lines = ruleText.split('\n');
    const start = lines.findIndex((line) => line.startsWith('SF.RuleLoader['));
    const end = lines.findIndex((line, i) => i > start && /^\};?\s*$/u.test(line));
    const comment = (line) => line.trim().replace(/^\/\/ ?/u, '');
    const head = lines.slice(0, start).filter((line) => line.trim().startsWith('//')).map(comment);
    const tail = lines.slice(end + 1).filter((line) => line.trim().startsWith('//')).map(comment);
    const xRuleComments = {};
    if (head.length) { xRuleComments.$comment = head; log.bridge.push('x-rule.$comment <- rule.js (the comment before the rule)'); }
    if (tail.length) { xRuleComments['$comment-after'] = tail; log.bridge.push('x-rule.$comment-after <- rule.js (the comment after the rule)'); }
    if (Object.keys(xRuleComments).length) component['x-rule'] = xRuleComments;
    let pending = [];
    let index = 0;
    let inside = false;
    for (const line of lines.slice(start, end)) {
      const trimmed = line.trim();
      if (!inside && trimmed.startsWith('relation:')) inside = true;
      if (!inside) { if (trimmed.startsWith('//')) log.dropped.push({file: 'rule.js', what: 'comment inside the rule, outside the relation list', text: comment(line)}); continue; }
      if (trimmed.startsWith('//')) { pending.push(comment(line)); continue; }
      for (const match of trimmed.matchAll(/\{\s*name:\s*['"]([^'"]+)['"][^}]*\}/gu)) {
        if (relations[index]?.name !== match[1]) throw new Error(`rule.js relation order: ${match[1]}`);
        if (pending.length) relations[index].$comment = pending;
        pending = [];
        index += 1;
      }
      if (/^\]\s*,?/u.test(trimmed) || trimmed.endsWith('],')) break;
    }
    if (index !== relations.length) throw new Error(`rule.js: read ${index} of ${relations.length} relations from the text`);
    if (pending.length) log.dropped.push({file: 'rule.js', what: 'comment after the last relation', text: pending.join(' ')});
  }
  const extraRuleKeys = Object.keys(rule).filter((key) => !['tags', 'type', 'mode', 'js', 'css', 'relation'].includes(key));
  const xRule = component['x-rule'] ?? {};
  for (const key of extraRuleKeys) {
    if (key === 'regex') { xRule.regex = isRegExp(rule.regex) ? String(rule.regex) : rule.regex; log.bridge.push('x-rule.regex <- rule.js'); } else throw new Error(`rule.js has ${key}: not derivable`);
  }
  const cssFiles = files.filter((file) => /\.s?css$/u.test(file));
  const derivedCss = Boolean(component.styles) || cssFiles.length > 0;
  if (rule.css !== undefined && !(rule.css === true && derivedCss)) { xRule.css = rule.css; log.bridge.push(`x-rule.css ${rule.css} <- rule.js (the folder ${cssFiles.length ? 'holds' : 'holds no'} sheet)`); }
  if (rule.css === undefined && derivedCss) { xRule.css = null; log.bridge.push(`x-rule.css null <- rule.js (no css although the folder holds ${cssFiles.join(', ')})`); }
  if (Object.keys(xRule).length) component['x-rule'] = xRule;
  component.relations = relations;
  Object.defineProperty(component, 'x-bridged', {value: true, enumerable: false});

  // --------------------------------------------------------------- aliases.json
  if (has('aliases.json')) {
    const aliasesIn = read('aliases.json');
    log.bridge.push('aliases <- aliases.json');
    const rows = aliasesIn.aliases.map((row) => {
      const r = {...row};
      if (r.component === aliasesIn.component) delete r.component;
      if (r.since === aliasesIn.since) delete r.since;
      if (r.remove_after === aliasesIn.remove_after) delete r.remove_after;
      if (r.kind === 'event' && r.manifest && r.manifest.from === r.from && `sf-${tagShort}-${r.manifest.to}` === r.to) r.manifest = true;
      return r;
    });
    const xHead = Object.fromEntries(Object.entries(aliasesIn).filter(([key]) => !['$comment', 'component', 'since', 'remove_after', 'aliases'].includes(key)));
    component.aliases = {$comment: aliasesIn.$comment, since: aliasesIn.since, 'remove-after': aliasesIn.remove_after, rows};
    if (Object.keys(xHead).length) component.aliases['x-head'] = xHead;
  }

  // ---------------------------------------------- words: meta.mjs and the manifest
  let meta = null;
  if (has('meta.mjs')) { meta = (await importModule(path.join(folder, 'meta.mjs'))).default; log.bridge.push('setting words <- meta.mjs'); }
  const described = {};
  for (const [key, property] of Object.entries(manifest?.inputs?.properties ?? {})) described[key] = {description: property.description, examples: property.examples};
  for (const [key, attribute] of Object.entries(meta?.attributes ?? {})) {
    described[key] = {description: attribute.description ?? described[key]?.description, examples: attribute.examples ?? described[key]?.examples, values: attribute.values, default: attribute.default, kind: attribute.kind};
  }
  const settings = component.settings ?? {};
  for (const [key, words] of Object.entries(described)) {
    const setting = settings[key] ?? component.values?.[key];
    if (!setting) continue;
    if (words.description && !setting.summary) { setting.summary = words.description; note(`settings.${key}.summary from ${meta?.attributes?.[key]?.description ? 'meta.mjs' : 'smart.manifest.json'}`); }
    else if (words.description && setting.summary !== words.description) log.dropped.push({file: 'smart.manifest.json/meta.mjs', what: `inputs.${key}.description (component.json summary kept)`, text: words.description});
    if (words.examples && !setting.examples) { setting.examples = words.examples; note(`settings.${key}.examples (tools' suggestions)`); }
  }
  for (const [key, property] of Object.entries(manifest?.inputs?.properties ?? {})) {
    const setting = settings[key];
    if (!setting || setting.type !== 'number') continue;
    if (property.type === 'integer' && !setting.integer) { setting.integer = true; note(`settings.${key}.integer from smart.manifest.json`); }
    if (property.minimum !== undefined && setting.min === undefined) { setting.min = property.minimum; note(`settings.${key}.min from smart.manifest.json`); }
    if (property.maximum !== undefined && setting.max === undefined) { setting.max = property.maximum; note(`settings.${key}.max from smart.manifest.json`); }
  }
  for (const [key, spec] of Object.entries(component.actions ?? {})) {
    const words = manifest?.methods?.[camel(key)]?.summary;
    if (words && spec && !spec.summary) { spec.summary = words; note(`actions.${key}.summary from smart.manifest.json methods.${camel(key)}`); }
  }
  for (const [verb, spec] of Object.entries(component.events ?? {})) {
    const words = manifest?.events?.[domEvent(component, verb)]?.summary;
    if (words && spec && !spec.summary) { spec.summary = words; note(`events.${verb}.summary from smart.manifest.json`); }
  }
  // A carried field or parameter takes the manifest's words and constraints.
  // A field only one side has is a conflict: the code decides, not the bridge.
  function enrich(fields, schemaProps, required, where) {
    for (const [field, type] of Object.entries(fields ?? {})) {
      const property = schemaProps?.[camel(field)];
      if (!property) { if (schemaProps) log.conflicts.push(`${where}: ${field} in component.json only`); continue; }
      const spec = typeof type === 'string' ? {type} : {...type};
      const extra = {};
      for (const [key, value] of Object.entries(property)) {
        if (key === 'description') spec.summary = value;
        else if (key === 'type' && Array.isArray(value) && value.includes('null')) spec.nullable = true;
        else if (key === 'type' && value === 'integer' && spec.type === 'number') spec.integer = true;
        else if (key === 'enum' && value.includes(null) && !(spec.values ?? []).includes(null)) spec.nullable = true;
        else if (key === 'type' || key === 'enum' || key === 'const') continue;
        else extra[key] = value;
      }
      if (Object.keys(extra).length) spec.schema = extra;
      if (Array.isArray(required) && !required.includes(camel(field))) spec.optional = true;
      if (JSON.stringify(spec) !== JSON.stringify(typeof type === 'string' ? {type} : type)) fields[field] = spec;
    }
    for (const key of Object.keys(schemaProps ?? {})) {
      if (!Object.keys(fields ?? {}).some((field) => camel(field) === key)) log.conflicts.push(`${where}: ${key} in smart.manifest.json only`);
    }
  }
  for (const [verb, spec] of Object.entries(component.events ?? {})) {
    const payload = manifest?.events?.[domEvent(component, verb)]?.payload;
    if (payload && spec?.carries && typeof spec.carries === 'object') enrich(spec.carries, payload.properties ?? {}, payload.required, `events.${verb}.carries`);
    if (payload && spec?.carries === 'native' && spec['x-detail'] && typeof spec['x-detail'] === 'object') enrich(spec['x-detail'], payload.properties ?? {}, payload.required, `events.${verb}.x-detail`);
  }
  for (const [key, spec] of Object.entries(component.actions ?? {})) {
    const method = manifest?.methods?.[camel(key)];
    if (!method || !spec) continue;
    const props = Object.fromEntries((method.arguments ?? []).filter((arg) => arg.schema).map((arg) => [arg.name, arg.schema]));
    if (Object.keys(props).length) { spec.with ??= {}; enrich(spec.with, props, null, `actions.${key}.with`); }
    if (method.returns && JSON.stringify(method.returns) !== JSON.stringify({type: 'object'})) { spec['x-returns'] = method.returns; note(`actions.${key}.x-returns: the manifest's return (not an outcome)`); }
  }
  for (const row of component.aliases?.rows ?? []) {
    if (row.kind !== 'event') continue;
    const old = manifest?.events?.[row.from];
    if (old?.summary) row.summary = old.summary;
    if (old?.payload && Object.keys(old.payload).length > 1) log.dropped.push({file: 'smart.manifest.json', what: `events.${row.from}.payload (the old event's detail schema; it ends with the alias)`, text: JSON.stringify(old.payload).slice(0, 200)});
  }
  if (component.aliases) {
    for (const row of component.aliases.rows) {
      if (row.kind !== 'setting') continue;
      const words = described[row.from];
      if (words?.description) row.summary = words.description;
    }
    const derived = attributesOf(component);
    for (const row of component.aliases.rows) {
      if (row.kind !== 'setting' || !meta?.attributes?.[row.from]) continue;
      const want = meta.attributes[row.from];
      const got = derived[row.from];
      if (want.kind === 'enum' && JSON.stringify(want.values) !== JSON.stringify(got?.values)) { row.values = want.values; note(`aliases ${row.from}: values ${JSON.stringify(want.values)} kept`); }
      if (want.default !== got?.default) { row.default = want.default; note(`aliases ${row.from}: default ${JSON.stringify(want.default)} kept`); }
    }
  }

  // ------------------------------------------------- smart.manifest.json residue
  const registry = {};
  const xKept = component['x-kept'];
  delete component['x-kept'];
  let stamp = {};
  const lang = {};
  for (const file of readdirSync(path.join(folder, 'lang'))) if (file.endsWith('.json')) lang[path.basename(file, '.json')] = readJson(path.join(folder, 'lang', file));
  if (manifest) {
    log.bridge.push('x-registry <- smart.manifest.json');
    const draft = genManifest({...component, 'x-registry': {}}, lang, {});
    const carry = (key, value, why) => { registry[key] = value; note(`x-registry.${key}: ${why}`); };
    for (const key of ['kind', 'reuse_mode', 'lifecycle', 'capabilities', 'persistence', 'adapter', 'readiness']) {
      if (!same(manifest[key], draft[key])) carry(key, manifest[key], 'registry-only, differs from the default');
    }
    if (!same(manifest.tags, [name])) carry('tags', manifest.tags, 'registry-only');
    if ((manifest.exported_parts ?? []).length) carry('exported-parts', manifest.exported_parts, 'registry-only');
    if ((manifest.composition?.public_parts ?? []).length) carry('public-parts', manifest.composition.public_parts, 'registry-only');
    if (manifest.composition?.declarative) carry('composition-declarative', {...manifest.composition.declarative}, 'the composition descriptor; props, events, renderer, assets and host_port are derived over it');
    for (const key of ['item_contract', 'contracts', 'state', 'backend']) {
      if (manifest[key] && Object.keys(manifest[key]).length && !(key === 'state' && same(manifest.state, draft.state))) carry(key, manifest[key], 'registry-only');
    }
    if (manifest.artifacts && !same(manifest.artifacts, draft.artifacts)) carry('artifacts', manifest.artifacts, 'registry-only');
    for (const key of ['ownership', 'security', 'presentation', 'ai_guidance']) {
      if (manifest[key] !== undefined) {
        carry(key, manifest[key], xKept?.[key] ? 'was x-kept (a copy); the manifest\'s value carried' : 'registry-only');
        if (xKept?.[key] && !same(xKept[key], manifest[key])) log.dropped.push({file: 'component.json', what: `x-kept.${key} differed from smart.manifest.json ${key}; the manifest's value is kept`, text: JSON.stringify(xKept[key]).slice(0, 200)});
      }
    }
    const a11y = {};
    if (manifest.accessibility?.accessible_name !== draft.accessibility.accessible_name) a11y.accessible_name = manifest.accessibility?.accessible_name;
    if (!same(manifest.accessibility?.keyboard, draft.accessibility.keyboard)) a11y.keyboard = manifest.accessibility?.keyboard;
    if (manifest.accessibility?.focus !== draft.accessibility.focus) a11y.focus = manifest.accessibility?.focus;
    if (Object.keys(a11y).length) carry('accessibility', a11y, 'registry-only words of the manifest accessibility');
    const compat = {};
    const derivedAliases = new Set(draft.compatibility.aliases);
    const extraAliases = (manifest.compatibility?.aliases ?? []).filter((entry) => !derivedAliases.has(entry));
    if (extraAliases.length) compat.aliases = extraAliases;
    const versions = [...new Set((manifest.compatibility?.deprecations ?? []).map((entry) => entry.since))];
    if (versions.length === 1 && component.aliases) { component.aliases['since-version'] = versions[0]; note(`aliases.since-version ${versions[0]}`); }
    const derivedPaths = new Set(versions.length === 1 ? genManifest({...component, 'x-registry': {}}, {}, {}).compatibility.deprecations.map((entry) => entry.path) : []);
    const extraDeprecations = (manifest.compatibility?.deprecations ?? []).filter((entry) => !derivedPaths.has(entry.path));
    if (extraDeprecations.length) compat.deprecations = extraDeprecations;
    if (manifest.compatibility?.replacement) compat.replacement = manifest.compatibility.replacement;
    if ((manifest.compatibility?.migrations ?? []).length) compat.migrations = manifest.compatibility.migrations;
    if (Object.keys(compat).length) carry('compatibility', compat, 'what the aliases do not give');
    const eventFields = {};
    for (const [eventName, event] of Object.entries(manifest.events ?? {})) {
      const extra = Object.fromEntries(Object.entries(event).filter(([key]) => !['summary', 'payload', 'alias_of'].includes(key)));
      if (Object.keys(extra).length && draft.events[eventName]) eventFields[eventName] = extra;
    }
    if (Object.keys(eventFields).length) carry('event-fields', eventFields, 'registry-only fields of an event (canonical)');
    const aliasNames = new Set((component.aliases?.rows ?? []).filter((row) => row.kind === 'event').map((row) => row.from));
    const aliasEvents = Object.fromEntries(Object.entries(manifest.events ?? {}).filter(([eventName, event]) => !draft.events[eventName]?.payload?.properties && (aliasNames.has(eventName) || event.alias_of)));
    if (Object.keys(aliasEvents).length) carry('alias-events', aliasEvents, `former event names as the registry describes them: ${Object.keys(aliasEvents).join(', ')}`);
    const derivedMethods = methodsOf({...component, 'x-registry': {}});
    const legacy = Object.fromEntries(Object.entries(manifest.methods ?? {}).filter(([key]) => !derivedMethods[key]));
    if (Object.keys(legacy).length) carry('methods', legacy, `public methods the manifest names and component.json does not declare: ${Object.keys(legacy).join(', ')}`);
    const inputs = {};
    const draftInputs = draft.inputs.properties;
    for (const [key, property] of Object.entries(manifest.inputs?.properties ?? {})) {
      const fields = {};
      const base = settings[key] || component.values?.[key];
      for (const [field, value] of Object.entries(property)) {
        if (['type', 'enum', 'examples', 'minimum', 'maximum'].includes(field)) continue;
        if (base && (field === 'description' || field === 'default')) continue;
        if (!same(value, draftInputs[key]?.[field])) fields[field] = value;
      }
      if (Object.keys(fields).length && (base || ['template', 'root-class', 'root-style', 'aria-label'].includes(key))) inputs[key] = fields;
    }
    if (Object.keys(inputs).length) carry('inputs', inputs, 'words and constraints of a base setting, a host attribute, or a constraint §4.2 has no field for');
    const traitInputs = {};
    for (const trait of component.traits ?? []) {
      for (const key of TRAIT_INPUTS[trait] ?? []) if (manifest.inputs?.properties?.[key] && !settings[key] && !component.values?.[key]) traitInputs[key] = manifest.inputs.properties[key];
    }
    if (Object.keys(traitInputs).length) carry('trait-inputs', traitInputs, `inputs of ${component.traits.join(', ')}; no trait contract gives them yet`);
    if (manifest.inputs?.required) carry('inputs-required', manifest.inputs.required, 'inputs a page must give (§4.2 has no "required")');
    const known = new Set([...Object.keys(draft), 'backend']);
    const other = Object.fromEntries(Object.entries(manifest).filter(([key]) => !known.has(key)));
    if (Object.keys(other).length) carry('other', other, `top-level fields schema v2 allows beyond the derived ones: ${Object.keys(other).join(', ')}`);
    if (Object.keys(registry).length) component['x-registry'] = registry;
    stamp = {provenance: manifest.provenance, runtime_pair: manifest.compatibility?.runtime_pair};
    log.bridge.push('stamp <- smart.manifest.json provenance, runtime_pair');
  }

  // ---------------------------------------------------------------- examples.json
  // examples.json is {examples: [...]}; seven folders write a bare list (read
  // as the list of examples by the instance-scope probe, not by the snapshot).
  const examplesIn = has('examples.json') ? read('examples.json') : {examples: []};
  const examples = Array.isArray(examplesIn) ? {examples: examplesIn} : examplesIn;
  if (Array.isArray(examplesIn)) note('examples.json: a bare list becomes {examples: [...]}');
  examples.examples ??= [];
  if (has('studio.fixture.json')) {
    log.bridge.push('studio <- studio.fixture.json');
    const fixture = read('studio.fixture.json');
    let example = examples.examples.find((item) => item.name === fixture.id);
    if (!example) {
      example = examples.examples[0];
      if (!example) { example = {name: fixture.id}; examples.examples.push(example); note(`examples: no example; the fixture "${fixture.id}" becomes one (phase A must add it to examples.json)`); }
      else note(`examples ${example.name}: the fixture "${fixture.id}" names no example; marked on the first`);
    }
    example.studio = {};
    const derived = genFixture(component, {examples: [{...example, studio: {}}]}, lang);
    for (const key of ['id', 'title', 'summary', 'locale', 'props', 'children', 'state']) {
      if (!same(fixture[key], derived[key])) { example.studio[key] = fixture[key]; note(`examples ${example.name}.studio.${key}: the fixture differs from the derivation`); }
    }
    const fixtureExtra = Object.fromEntries(Object.entries(fixture).filter(([key]) => !['schema', 'id', 'component', 'title', 'summary', 'locale', 'props', 'children', 'state'].includes(key)));
    if (Object.keys(fixtureExtra).length) example.studio['x-extra'] = fixtureExtra;
    if (fixture.component !== component.id) log.identity.push(`studio.fixture.json component ${fixture.component} is not ${component.id}`);
    if (has('studio.scenario.json')) {
      log.bridge.push('studio.scenario <- studio.scenario.json');
      const scenario = read('studio.scenario.json');
      const s = {};
      if (scenario.id !== 'smoke') s.id = scenario.id;
      if (scenario.viewport !== 'desktop') s.viewport = scenario.viewport;
      if ((scenario.actions ?? []).length) {
        s.steps = scenario.actions.map((action) => (action.type === 'invoke' && Object.keys(action).length === 3 ? {invoke: action.method, with: action.arguments} : {raw: action}));
      }
      const assertions = (scenario.assertions ?? []).map((assertion) => (Object.keys(assertion).length === 1 ? assertion.type : assertion));
      if (!same(assertions, DEFAULT_ASSERTIONS)) s.assertions = assertions;
      const scenarioExtra = Object.fromEntries(Object.entries(scenario).filter(([key]) => !['schema', 'id', 'component', 'fixture', 'viewport', 'actions', 'assertions'].includes(key)));
      if (Object.keys(scenarioExtra).length) s['x-extra'] = scenarioExtra;
      example.studio.scenario = s;
      if (scenario.component !== component.id || scenario.fixture !== fixture.id) log.identity.push('studio.scenario.json names another component or fixture');
    }
  }
  if (has('probe.json')) {
    log.bridge.push('pages[conformance] <- probe.json');
    const probe = read('probe.json');
    if (probe.component !== undefined && probe.component !== component.tag) log.identity.push(`probe.json component ${probe.component} is not ${component.tag}`);
    // Two shapes are committed: {component, probe, format, page, probes}
    // (stand 15) and {probe, page, format, checks} (the 1.3.8 field probes).
    let page;
    if (Array.isArray(probe.probes) && probe.page) {
      page = {name: 'conformance', title: probe.probe};
      if (probe.format !== DEFAULT_PROBE_FORMAT) page.format = probe.format;
      page.page = probe.page;
      page.checks = probe.probes;
      const probeExtra = Object.fromEntries(Object.entries(probe).filter(([key]) => !['component', 'probe', 'format', 'page', 'probes'].includes(key)));
      if (Object.keys(probeExtra).length) page['x-extra'] = probeExtra;
    } else {
      page = {name: 'conformance', 'x-probe': probe};
      note(`pages[conformance]: probe.json is not in the stand-15 shape (keys ${Object.keys(probe).join(', ')}); carried whole`);
    }
    examples.pages = [...(examples.pages ?? []), page];
  }

  return {component, examples, lang, files, folder: name, stamp, log, hasMeta: has('meta.mjs')};
}

// A folder in the 1.4 form (component.json has "relations"): its five files
// are the whole source; only the build stamp still comes from the committed
// registry (provenance, runtime pair: a build computes them, never a person).
export async function viewOf(folder) {
  const component = readJson(path.join(folder, 'component.json'));
  if (!Array.isArray(component.relations)) return viewOfToday(folder);
  const name = path.basename(folder);
  if (short(component.tag) !== name) component.folder = name;
  const log = {bridge: [], decisions: [], dropped: [], conflicts: [], identity: [], form: '1.4'};
  const examples = existsSync(path.join(folder, 'examples.json')) ? readJson(path.join(folder, 'examples.json')) : {examples: []};
  const lang = {};
  for (const file of readdirSync(path.join(folder, 'lang'))) if (file.endsWith('.json')) lang[path.basename(file, '.json')] = readJson(path.join(folder, 'lang', file));
  let stamp = {};
  const manifestPath = path.join(folder, 'smart.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    stamp = {provenance: manifest.provenance, runtime_pair: manifest.compatibility?.runtime_pair};
    log.bridge.push('stamp <- smart.manifest.json provenance, runtime_pair');
  }
  return {component, examples, lang, files: listFiles(folder), folder: name, stamp, log, hasMeta: existsSync(path.join(folder, 'meta.mjs'))};
}

// Phase A: write a 1.3.10 folder's component.json and examples.json in the
// 1.4 form (relations, aliases, x-rule, x-registry; the studio example and the
// conformance page). component.json keeps its key order: relations go before
// templates, aliases before the first x- field, x-rule and x-registry last;
// x-kept goes (x-registry carries its blocks).
export async function convertFolder(folder) {
  const original = readJson(path.join(folder, 'component.json'));
  if (Array.isArray(original.relations)) return {component: path.basename(folder), skipped: 'already 1.4'};
  const view = await viewOfToday(folder);
  const c = view.component;
  const out = {};
  const place = (key) => { if (key in c && !(key in out) && c[key] !== undefined) out[key] = c[key]; };
  for (const key of Object.keys(original)) {
    if (key === 'x-kept') continue;
    if (key === 'templates') place('relations');
    if (key.startsWith('x-')) { place('relations'); place('aliases'); }
    place(key);
  }
  place('relations');
  place('aliases');
  for (const key of Object.keys(c)) if (key !== 'folder') place(key);
  writeFileSync(path.join(folder, 'component.json'), json(out));
  writeFileSync(path.join(folder, 'examples.json'), json(view.examples));
  return {component: path.basename(folder), log: view.log};
}

// ======================================================================
// Comparison

const clip = (value) => { const text = JSON.stringify(value); return text === undefined ? 'absent' : text.length > 200 ? `${text.slice(0, 197)}...` : text; };

// Every difference by path; the full values ride along as a non-enumerable
// `raw` ({committed, generated, keys}) for classifiers, and stay out of --json.
export function diff(a, b, at = [], out = []) {
  if (canon(a) === canon(b)) return out;
  const objects = a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b);
  if (objects) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], [...at, key], out);
    return out;
  }
  const entry = {path: at.join('.'), committed: clip(a), generated: clip(b)};
  if (Array.isArray(a) && Array.isArray(b) && a.every((x) => typeof x !== 'object') && b.every((x) => typeof x !== 'object')) {
    const removed = a.filter((x) => !b.includes(x));
    const added = b.filter((x) => !a.includes(x));
    Object.assign(entry, removed.length || added.length ? {only_committed: removed, only_generated: added} : {order_only: true});
  }
  Object.defineProperty(entry, 'raw', {value: {committed: a, generated: b, keys: at}, enumerable: false});
  out.push(entry);
  return out;
}

async function metaValue(text) {
  const module = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
  return {value: JSON.parse(JSON.stringify(module.default)), named: Object.keys(module).filter((key) => key !== 'default')};
}

export async function compareFile(file, committedText, generatedText) {
  if (committedText === generatedText) return {status: 'identical'};
  let a; let b; const extra = {};
  if (file === 'rule.js') { a = plainRule(evalRule(committedText)); b = plainRule(evalRule(generatedText)); }
  else if (file === 'meta.mjs') {
    const ma = await metaValue(committedText); const mb = await metaValue(generatedText);
    a = ma.value; b = mb.value;
    const dropped = ma.named.filter((key) => !mb.named.includes(key));
    if (dropped.length) extra.named_exports_dropped = dropped;
  } else { a = JSON.parse(committedText); b = JSON.parse(generatedText); }
  const differences = diff(a, b);
  return {status: differences.length ? 'differs' : 'semantic', ...extra, ...(differences.length ? {differences} : {})};
}

export function componentFolders(packageRoot) {
  const smart = path.join(packageRoot, 'src', 'smart');
  return readdirSync(smart).filter((name) => existsSync(path.join(smart, name, 'component.json'))).sort().map((name) => path.join(smart, name));
}

// One component: its view, the generated files and their comparison.
export async function checkComponent(folder) {
  const name = path.basename(folder);
  let view;
  try { view = await viewOf(folder); } catch (error) {
    return {component: name, error: String(error.message ?? error), files: {}};
  }
  const generated = generateFiles(view, {stamp: view.stamp, withMeta: view.hasMeta});
  const files = {};
  for (const file of GENERATED) {
    const committedPath = path.join(folder, file);
    const committed = existsSync(committedPath) ? readFileSync(committedPath, 'utf8') : null;
    const text = generated[file] ?? null;
    if (committed === null && text === null) continue;
    if (committed === null) { files[file] = {status: 'new'}; continue; }
    if (text === null) { files[file] = {status: 'not-generated'}; continue; }
    try { files[file] = await compareFile(file, committed, text); } catch (error) { files[file] = {status: 'differs', error: String(error.message ?? error)}; }
  }
  return {component: name, files, log: view.log, view, generated};
}

export const passes = (result, {bytes = false} = {}) => !result.error && Object.values(result.files)
  .every((entry) => entry.status === 'identical' || entry.status === 'new' || (!bytes && entry.status === 'semantic'));

// ======================================================================
// CLI

function parseArgs(argv) {
  const options = {convert: false, check: false, write: false, bytes: false, quiet: false, components: [], files: [], packages: [], json: null};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--convert') options.convert = true;
    else if (arg === '--bytes') options.bytes = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--component') options.components.push(argv[++i]);
    else if (arg.startsWith('--component=')) options.components.push(arg.slice(12));
    else if (arg === '--file') options.files.push(argv[++i]);
    else if (arg === '--package') options.packages.push(path.resolve(argv[++i]));
    else if (arg.startsWith('--package=')) options.packages.push(path.resolve(arg.slice(10)));
    else if (arg === '--json') options.json = path.resolve(argv[++i]);
    else throw new Error(`unknown argument ${arg}`);
  }
  if ([options.check, options.write, options.convert].filter(Boolean).length !== 1) throw new Error('give exactly one of --check, --write, --convert');
  if (options.convert && !options.components.length) throw new Error('--convert takes the components by name (--component)');
  if (!options.packages.length) options.packages.push(repositoryRoot);
  for (const file of options.files) if (!GENERATED.includes(file)) throw new Error(`--file ${file}: not a generated file (${GENERATED.join(', ')})`);
  for (const name of options.components) if (!/^[a-z][a-z0-9-]*$/u.test(name ?? '')) throw new Error(`invalid component name ${name}`);
  return options;
}

export async function run(options) {
  const results = [];
  for (const packageRoot of options.packages) {
    let folders = componentFolders(packageRoot);
    if (options.components.length) {
      folders = folders.filter((folder) => options.components.includes(path.basename(folder)));
      const missing = options.components.filter((name) => !folders.some((folder) => path.basename(folder) === name));
      if (missing.length && options.packages.length === 1) throw new Error(`no component ${missing.join(', ')} under ${packageRoot}/src/smart`);
    }
    for (const folder of folders) {
      const result = await checkComponent(folder);
      if (options.files?.length) {
        result.files = Object.fromEntries(Object.entries(result.files).filter(([file]) => options.files.includes(file)));
        if (result.generated) result.generated = Object.fromEntries(Object.entries(result.generated).filter(([file]) => options.files.includes(file)));
      }
      result.package = packageRoot;
      results.push(result);
    }
  }
  return results;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(String(error.message)); process.exit(2); }
  if (options.convert) {
    for (const packageRoot of options.packages) {
      for (const folder of componentFolders(packageRoot).filter((item) => options.components.includes(path.basename(item)))) {
        const result = await convertFolder(folder);
        console.log(`${result.component}: ${result.skipped ?? `component.json and examples.json in the 1.4 form (${result.log.bridge.length} facts moved)`}`);
      }
    }
    return;
  }
  const results = await run(options);
  if (options.write) {
    for (const result of results) {
      if (result.error) { console.error(`${result.component}: ${result.error}`); process.exitCode = 1; continue; }
      const folder = path.join(result.package, 'src', 'smart', result.component);
      for (const [file, text] of Object.entries(result.generated)) writeFileSync(path.join(folder, file), text);
      if (!options.quiet) console.log(`${result.component}: wrote ${Object.keys(result.generated).join(', ')}`);
    }
    return;
  }
  let failing = 0;
  for (const result of results) {
    const ok = passes(result, options);
    if (!ok) failing += 1;
    if (options.quiet) continue;
    if (result.error) { console.log(`✗ ${result.component}: not readable as 1.4 (${result.error})`); continue; }
    const line = Object.entries(result.files).map(([file, entry]) => `${file} ${entry.status}${entry.differences ? `(${entry.differences.length})` : ''}`).join(', ');
    console.log(`${ok ? '✓' : '✗'} ${result.component}: ${line}`);
  }
  console.log(`generate-component-files --check: ${results.length - failing}/${results.length} components generate their committed files${options.bytes ? ' byte for byte' : ''}`);
  if (options.json) {
    const plain = results.map(({component, package: pkg, error, files, log}) => ({component, package: path.relative(repositoryRoot, pkg) || '.', error, files, log}));
    writeFileSync(options.json, json(plain));
  }
  if (failing) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

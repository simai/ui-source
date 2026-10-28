#!/usr/bin/env node
// The equivalence report of standard 1.4 phase 1: for every Smart component
// and every generated file, is the generated file identical, semantically
// identical or different from the committed one; and for smart.manifest.json
// and meta.mjs, every difference classified:
//
//   a1-fact   the committed file is stale against component.json, lang/ or
//             rule.js: the generator is right (a version, a title, an event or
//             a setting component.json declares and the registry lacks)
//   a1-words  the same, for words (a summary, a description): component.json's
//             text is taken; review it in the phase A diff
//   a2-rule   one rule for all: the committed files apply a form unevenly (the
//             base settings, an argument's schema form, a payload's
//             additionalProperties, former values as aliases, ...)
//   c         a real conflict: both sides say something different and neither
//             file is the obvious source; the code decides (where it is given)
//
// and (b) what only smart.manifest.json holds, carried as x-registry, by key.
//
// Writes docs/developer/component-files-1.4-report.json and the generated part
// of docs/developer/component-files-1.4-report.md (between the markers; the
// rest of the file is written by people).
//
// Usage: node scripts/report-component-files.mjs [--package <root>]... [--check]
//   --package  more package roots (ui-pro: ../ui-pro/components); this repository is always first
//   --check    fail when the committed report differs from a fresh one (only meaningful with the same packages)
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {GENERATED, aliasRows, camel, domEvent, run} from './generate-component-files.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_MD = path.join(repositoryRoot, 'docs/developer/component-files-1.4-report.md');
const REPORT_JSON = path.join(repositoryRoot, 'docs/developer/component-files-1.4-report.json');
const START = '<!-- generated:start (scripts/report-component-files.mjs) -->';
const END = '<!-- generated:end -->';
const BASE = new Set(['template', 'root-class', 'root-style', 'aria-label']);
const BASE_DETAIL = new Set(['component', 'tagName', 'template']);

const args = process.argv.slice(2);
const packages = [repositoryRoot];
for (let i = 0; i < args.length; i += 1) if (args[i] === '--package') packages.push(path.resolve(args[++i]));
const checkOnly = args.includes('--check');

// The Git tree of src/smart the report read (stable across commits that do not
// touch the components, so --check stays meaningful), and whether the working
// tree differs from it.
const treeOf = (root) => {
  try {
    const tree = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD:./src/smart'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', 'src/smart'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim() !== '';
    return dirty ? `${tree}+dirty` : tree;
  } catch { return null; }
};
const repositoryOf = (root) => { try { return execFileSync('git', ['-C', root, 'config', '--get', 'remote.origin.url'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim().replace(/^.*[:/]([^/]+\/[^/]+?)(\.git)?$/u, '$1'); } catch { return path.basename(root); } };

// The component's code (index.js, js/**): the evidence a conflict is read against.
function codeOf(folder) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'static' && entry.name !== 'node_modules') walk(full); } else if (/\.(m?js)$/u.test(entry.name) && !['rule.js', 'meta.mjs'].includes(entry.name)) out.push(readFileSync(full, 'utf8'));
    }
  };
  if (existsSync(path.join(folder, 'index.js'))) out.push(readFileSync(path.join(folder, 'index.js'), 'utf8'));
  if (existsSync(path.join(folder, 'js'))) walk(path.join(folder, 'js'));
  return out.join('\n');
}
const quoted = (code, name) => [`'${name}'`, `"${name}"`, `\`${name}\``].some((needle) => code.includes(needle));

// The line of a sequence of keys in a JSON text ("events", "sf-x", "field").
function lineOf(text, keys) {
  const lines = text.split('\n');
  let from = 0;
  for (const key of keys) {
    const needle = `"${key}"`;
    const at = lines.findIndex((line, i) => i >= from && line.includes(needle));
    if (at < 0) return from ? from + 1 : null;
    from = at;
  }
  return from + 1;
}

// ------------------------------------------------------------- classification

function classifyManifest(result, folder) {
  const entries = [];
  const component = result.view.component;
  const settings = {...(component.values ?? {}), ...(component.settings ?? {})};
  const rows = aliasRows(component);
  const aliasSettings = new Set(rows.filter((row) => row.kind === 'setting').map((row) => row.from));
  const formerValues = (setting) => new Set(rows.filter((row) => row.kind === 'value' && row.setting === setting).map((row) => row.from));
  const declaredEvents = new Map(Object.keys(component.events ?? {}).map((verb) => [domEvent(component, verb), verb]));
  const aliasEvents = new Set(rows.filter((row) => row.kind === 'event').map((row) => row.from));
  const code = codeOf(folder);
  const shortTag = component.tag.replace(/^sf-/u, '');
  const manifestText = readFileSync(path.join(folder, 'smart.manifest.json'), 'utf8');
  const committedManifest = JSON.parse(manifestText);
  const componentText = readFileSync(path.join(folder, 'component.json'), 'utf8');
  const rel = (file) => `${path.relative(path.dirname(path.dirname(path.dirname(folder))), folder)}/${file}`;
  const at = (manifestKeys, componentKeys) => {
    const where = [];
    const m = lineOf(manifestText, manifestKeys);
    if (m) where.push(`${rel('smart.manifest.json')}:${m}`);
    if (componentKeys) { const c = lineOf(componentText, componentKeys); if (c) where.push(`${rel('component.json')}:${c}`); }
    return where;
  };
  const push = (cls, kind, d, why, where = []) => entries.push({class: cls, kind, path: d.path, committed: d.committed, generated: d.generated, why, ...(where.length ? {where} : {})});

  for (const d of result.files['smart.manifest.json'].differences ?? []) {
    const p = d.raw.keys;
    const {committed, generated} = d.raw;
    const head = p[0];
    if (head === 'version') { push('a1-fact', 'version', d, 'component.json version is the component\'s version'); continue; }
    if (head === 'title') { push('a1-fact', 'title', d, 'lang/en.json title'); continue; }
    if (head === 'summary') { push('a1-words', 'summary', d, 'component.json x-summary'); continue; }
    if (head === 'item_contract' || head === 'contracts') { push('a2-rule', 'empty-block', d, 'an empty block is written by one rule'); continue; }
    if (head === 'accessibility') {
      if (p[1] === 'role' && typeof committed === 'string') push('a1-words', 'accessibility.role-words', d, 'the registry describes the role in words; component.json names it');
      else push('a1-fact', `accessibility.${p[1]}`, d, 'component.json accessibility');
      continue;
    }
    if (head === 'compatibility') { push('a1-fact', `compatibility.${p[1]}`, d, 'aliases.json value rows (former values) are the compatibility aliases'); continue; }
    if (head === 'composition' && p[1] === 'uses') {
      if ((d.only_generated ?? []).length) push('a1-fact', 'uses-missing', {...d, committed: d.committed, generated: JSON.stringify(d.only_generated)}, 'rule.js loads it: the registry\'s dependency list lacks it');
      if ((d.only_committed ?? []).length) push('c', 'uses-not-loaded', {...d, generated: d.generated, committed: JSON.stringify(d.only_committed)}, 'the registry names a use rule.js does not load', at(['composition', 'uses']));
      if (d.order_only) push('a2-rule', 'order', d, 'sorted');
      continue;
    }
    if (head === 'composition' && p[1] === 'declarative') {
      const field = p[2];
      if (field === 'host_port') { push('c', 'host-port', d, 'component.json port and the registry\'s host_port differ', at(['host_port', p[3]], ['port'])); continue; }
      if (field === 'assets' || field === 'renderer') { push('a2-rule', `declarative.${field}`, d, 'derived from the folder and tag'); continue; }
      const onlyCommitted = (d.only_committed ?? []).filter((name) => (field === 'events' ? quoted(code, name) : false));
      if (onlyCommitted.length) push('c', `declarative.${field}`, d, `the registry lists ${onlyCommitted.join(', ')}, which the code still names, and component.json does not declare`, at(['declarative', field]));
      else push('a1-fact', `declarative.${field}`, d, 'derived from component.json settings and events');
      continue;
    }
    if (head === 'inputs' && p[1] === 'properties') {
      const name = p[2];
      const field = p[3];
      const spec = settings[name];
      if (!field) {
        if (committed === undefined) {
          if (BASE.has(name)) push('a2-rule', 'base-setting', d, 'every element takes template, root-class, root-style (§4.1); aria-label where the name comes from it');
          else if (aliasSettings.has(name)) push('a1-fact', 'alias-setting-missing', d, 'aliases.json lists the former setting name');
          else push('a1-fact', 'setting-missing', d, 'component.json declares the setting; the registry lacks it');
        } else if (generated === undefined) {
          const camelName = camel(name);
          if (name === 'role') push('a2-rule', 'host-attribute', d, 'role is a host attribute (§3.1), not an input');
          else if (quoted(code, name) || quoted(code, camelName)) push('c', 'input-undeclared', d, `the code reads ${name}; component.json does not declare it`, at(['inputs', name]));
          else push('a1-fact', 'input-stale', d, 'the code does not read it and component.json does not declare it');
        }
        continue;
      }
      if (field === 'description' || field === 'examples') {
        push(BASE.has(name) || aliasSettings.has(name) ? 'a2-rule' : 'a1-words', `input.${field}`, d, BASE.has(name) || aliasSettings.has(name) ? 'base and alias settings get their words by one rule' : 'component.json summary');
        continue;
      }
      if (field === 'default') {
        if (spec?.['default-from'] || (committed === null && generated === '') || BASE.has(name) || aliasSettings.has(name)) push('a2-rule', 'input.default', d, spec?.['default-from'] ? 'a default from the words is the source language\'s word (default-from)' : 'the empty default is ""');
        else push('a1-fact', 'input.default', d, 'component.json default (the element takes it)');
        continue;
      }
      if (field === 'type') {
        if (spec?.type === 'number' && /^(number|integer|string)$/u.test(String(committed))) push('a1-fact', 'input.type', d, `component.json says number${spec.integer ? ' (integer)' : ''}`);
        else push('a1-fact', 'input.type', d, `component.json type ${spec?.type ?? '?'}`);
        continue;
      }
      if (field === 'enum') {
        if (generated === undefined && spec?.type === 'number') { push('a2-rule', 'input.enum-as-range', d, 'a number setting is min/max, not an enum of strings'); continue; }
        if (generated === undefined && name === 'template') { push('a2-rule', 'template-open', d, 'the template input is open (manifest-template-open)'); continue; }
        if (committed === undefined) { push('a1-fact', 'input.enum-missing', d, 'component.json values'); continue; }
        const former = formerValues(name);
        const onlyCommitted = (d.only_committed ?? []).filter((value) => value !== '');
        const unexplained = onlyCommitted.filter((value) => !former.has(value));
        if ((d.only_generated ?? []).length) push('a1-fact', 'input.enum-values-missing', {...d, generated: JSON.stringify(d.only_generated)}, 'component.json takes these values; the registry refuses them');
        if (onlyCommitted.length && !unexplained.length) push('a2-rule', 'input.enum-former', {...d, committed: JSON.stringify(onlyCommitted)}, 'former values are aliases (aliases.json), not enum values');
        if (unexplained.length) push('c', 'input.enum-extra', {...d, committed: JSON.stringify(unexplained)}, 'the registry accepts values component.json neither takes nor lists as former', at(['inputs', name, 'enum'], ['settings', name]));
        if (!(d.only_generated ?? []).length && !onlyCommitted.length) push('a2-rule', 'input.enum-form', d, 'the empty value and the order');
        continue;
      }
      if (field === 'minimum' || field === 'maximum') { push('a1-fact', `input.${field}`, d, 'component.json min/max'); continue; }
      if (field === 'items') { push('a2-rule', 'input.items', d, 'a list\'s entries are {type: object}'); continue; }
      push('a1-fact', `input.${field}`, d, 'component.json');
      continue;
    }
    if (head === 'events') {
      const name = p[1];
      const rest = p.slice(2);
      const isAlias = aliasEvents.has(name);
      if (!rest.length) {
        if (committed === undefined) push('a1-fact', isAlias ? 'alias-event-missing' : 'event-missing', d, isAlias ? 'aliases.json sends the old name too' : `component.json declares ${declaredEvents.get(name) ?? name}; the registry lacks it${quoted(code, declaredEvents.get(name) ?? name) || quoted(code, name) ? '' : ' (the verb is not quoted in the code: check how it is sent)'}`);
        else if (quoted(code, name)) push('c', 'event-undeclared', d, `the code still names ${name}; neither component.json nor aliases.json declares it`, at(['events', name]));
        else push('a1-fact', 'event-stale', d, 'neither the code nor component.json nor aliases.json names it');
        continue;
      }
      if (rest[0] === 'summary') { push('a1-words', 'event.summary', d, 'component.json summary'); continue; }
      if (rest[0] === 'alias_of') { push('a2-rule', 'event.alias_of', d, 'an alias is a row of aliases.json'); continue; }
      if (rest[0] !== 'payload') { push('a1-fact', `event.${rest[0]}`, d, 'component.json'); continue; }
      if (isAlias && !declaredEvents.has(name)) { push('a2-rule', 'old-event-payload', d, 'an old name sends the new detail; its own schema ends with the alias'); continue; }
      const committedPayload = committedManifest.events?.[name]?.payload;
      if (committedPayload?.$ref) { push('a2-rule', 'payload-ref', d, `the registry points at ${committedPayload.$ref}; the payload is written in place`); continue; }
      const sub = rest[1];
      if (['additionalProperties', 'required', 'type', '$ref', 'description'].includes(sub)) {
        if (sub === 'type' && committed === 'null' && generated === 'object') push('a1-fact', 'payload-null', d, 'the registry says detail is null; component.json carries an object (sfEmit sends one)');
        else push('a2-rule', `payload.${sub}`, d, {additionalProperties: 'a payload allows more fields', required: 'a carried field is required unless optional', type: 'a payload is an object', $ref: 'the payload is written in place', description: 'payload words'}[sub]);
        continue;
      }
      if (sub === 'properties' && rest.length === 2) {
        const a = committed ?? {};
        const b = generated ?? {};
        const onlyC = Object.keys(a).filter((key) => !(key in b));
        const onlyG = Object.keys(b).filter((key) => !(key in a));
        for (const field of onlyC.filter((key) => BASE_DETAIL.has(key) || key === shortTag)) push('a2-rule', 'base-detail-field', {path: `${d.path}.${field}`, committed: JSON.stringify(a[field]), generated: 'absent'}, 'the emitting element (component/tagName/template): base fields, said once, not per event');
        const registryHasFields = Object.keys(a).filter((key) => !BASE_DETAIL.has(key) && key !== shortTag).length > 0;
        for (const field of (registryHasFields ? [] : onlyG)) push('a1-fact', 'payload-fields-missing', {path: `${d.path}.${field}`, committed: 'absent', generated: JSON.stringify(b[field])}, 'the registry describes no fields of this detail; component.json does');
        if (!registryHasFields) onlyG.length = 0;
        for (const field of onlyC.filter((key) => !BASE_DETAIL.has(key) && key !== shortTag)) push('c', 'payload-field', {path: `${d.path}.${field}`, committed: JSON.stringify(a[field]), generated: 'absent'}, `${field} only in the registry`, at(['events', name, field], ['events', declaredEvents.get(name) ?? name]));
        for (const field of onlyG) push('c', 'payload-field', {path: `${d.path}.${field}`, committed: 'absent', generated: JSON.stringify(b[field])}, `${field} only in component.json`, at(['events', name], ['events', declaredEvents.get(name) ?? name, field]));
        continue;
      }
      if (sub === 'properties') {
        const field = rest[2];
        const attr = rest[3];
        if (!attr) {
          const registryFields = Object.keys(committedPayload?.properties ?? {}).filter((key) => !BASE_DETAIL.has(key) && key !== shortTag);
          if (committed !== undefined && (BASE_DETAIL.has(field) || field === shortTag)) { push('a2-rule', 'base-detail-field', d, 'the emitting element (component/tagName/template): base fields, said once, not per event'); continue; }
          if (committed === undefined && !registryFields.length) { push('a1-fact', 'payload-fields-missing', d, 'the registry describes no fields of this detail; component.json does'); continue; }
          push('c', 'payload-field', d, `${field} only in ${committed === undefined ? 'component.json' : 'the registry'}`, committed === undefined ? at(['events', name], ['events', declaredEvents.get(name) ?? name, field]) : at(['events', name, field], ['events', declaredEvents.get(name) ?? name]));
          continue;
        }
        if (attr === 'description') { push('a1-words', 'payload-field.description', d, 'component.json field summary'); continue; }
        const values = (x) => (Array.isArray(x) ? x : x === undefined ? [] : [x]);
        if (attr === 'enum' || attr === 'const') {
          const siblings = (result.files['smart.manifest.json'].differences ?? []).filter((other) => other.path.startsWith(`events.${name}.payload.properties.${field}.`));
          const all = (side) => siblings.flatMap((other) => (['enum', 'const'].includes(other.raw.keys.at(-1)) ? values(other.raw[side]) : []));
          const same = JSON.stringify([...new Set(all('committed'))].sort()) === JSON.stringify([...new Set(all('generated'))].sort());
          if (same) push('a2-rule', 'payload-field.enum-form', d, 'one value is a const');
          else push('c', 'payload-field.values', d, 'the values differ', at(['events', name, field], ['events', declaredEvents.get(name) ?? name, field]));
          continue;
        }
        if (attr === 'type') { push('a2-rule', 'payload-field.type-form', d, 'an id has no JSON type; an enum carries no type; integer/number/null forms'); continue; }
        push('c', `payload-field.${attr}`, d, 'the field\'s schema differs', at(['events', name, field]));
        continue;
      }
      push('a2-rule', 'payload', d, 'payload form');
      continue;
    }
    if (head === 'methods') {
      const name = p[1];
      const field = p[2];
      if (!field) { push('a1-fact', committed === undefined ? 'method-missing' : 'method-stale', d, 'component.json actions'); continue; }
      if (field === 'summary') { push('a1-words', 'method.summary', d, 'component.json action summary'); continue; }
      if (field === 'arguments') {
        const names = (list) => (Array.isArray(list) ? list.map((arg) => arg.name) : []);
        const a = names(committed); const b = names(generated);
        if (JSON.stringify(a) === JSON.stringify(b)) push('a2-rule', 'method.arguments-form', d, 'arguments in the schema form');
        else push('c', 'method.arguments', d, `arguments differ: registry ${JSON.stringify(a)}, component.json ${JSON.stringify(b)}`, at(['methods', name, 'arguments'], ['actions']));
        continue;
      }
      if (field === 'returns') { push('a1-words', 'method.returns', d, 'component.json x-returns'); continue; }
      push('c', `method.${field}`, d, 'method field', at(['methods', name]));
      continue;
    }
    push('unclassified', head, d, '');
  }
  // A field the registry spells request-id or base_revision and component.json
  // (camelCased by the generator) requestId: one field, two spellings. Which
  // one the detail carries is the code's: count each spelling in it.
  const norm = (key) => key.replace(/[-_]([a-z0-9])/gu, (_, c) => c.toUpperCase());
  const count = (name) => (code.match(new RegExp(`(^|[^A-Za-z0-9_-])${name}(?![A-Za-z0-9_-])`, 'gu')) ?? []).length;
  const fieldEntries = entries.filter((item) => item.kind === 'payload-field');
  const merged = new Set();
  for (const a of fieldEntries) {
    if (merged.has(a) || a.committed === 'absent') continue;
    const event = a.path.split('.payload.')[0];
    const field = a.path.split('.').pop();
    const b = fieldEntries.find((other) => !merged.has(other) && other !== a && other.generated !== 'absent' && other.committed === 'absent'
      && other.path.split('.payload.')[0] === event && norm(other.path.split('.').pop()) === norm(field));
    if (!b) continue;
    merged.add(a); merged.add(b);
    const other = b.path.split('.').pop();
    entries.push({class: 'c', kind: 'payload-field.spelling', path: `${event}.payload.properties.${field}|${other}`, committed: field, generated: other,
      why: `one field, two spellings: the registry ${field}, component.json (camelCased) ${other}; the code names ${field} ${count(field)}×, ${other} ${count(other)}×`, where: a.where});
  }
  return entries.filter((item) => !merged.has(item));
}

function classifyMeta(result) {
  const entries = [];
  const component = result.view.component;
  const rows = aliasRows(component);
  for (const d of result.files['meta.mjs'].differences ?? []) {
    const p = d.raw.keys;
    const {committed, generated} = d.raw;
    const push = (cls, kind, why) => entries.push({class: cls, kind, path: d.path, committed: d.committed, generated: d.generated, why});
    if (p[0] === 'source') { push('a2-rule', 'source', 'the source is component.json'); continue; }
    if (p[0] === 'tag') { push('a1-fact', 'tag', 'component.json tag'); continue; }
    if (p[0] !== 'attributes') { push('unclassified', p[0], ''); continue; }
    const name = p[1];
    const field = p[2];
    if (!field) {
      if (committed === undefined) push('a2-rule', 'partial', 'the committed meta.mjs describes only some attributes (it was an override of the studio generator); the generated one describes all');
      else push('c', 'attribute-undeclared', 'the committed meta.mjs describes an attribute component.json does not declare');
      continue;
    }
    if (field === 'values') {
      const former = new Set(rows.filter((row) => row.kind === 'value' && row.setting === name).map((row) => row.from));
      const extra = (d.only_committed ?? []).filter((value) => value !== '' && !former.has(value));
      if (extra.length) push('c', 'values-extra', `the committed meta lists ${extra.join(', ')}, neither a value nor a former value`);
      else if ((d.only_generated ?? []).filter((value) => value !== '').length) push('a1-fact', 'values-missing', 'component.json values');
      else push('a2-rule', 'values-form', 'former values are aliases; the empty value');
      continue;
    }
    if (field === 'description' || field === 'examples') { push('a1-words', field, 'component.json summary'); continue; }
    if (field === 'default') { push(committed === undefined || generated === undefined ? 'a2-rule' : 'a1-fact', 'default', 'component.json default'); continue; }
    push('a1-fact', field, 'component.json');
  }
  return entries;
}

// --------------------------------------------------------- x-registry homes

const HOMES = {
  methods: 'dated `method` aliases in component.json, or retired (§4.4: no reader methods)',
  contracts: 'the port contract (src/core/contracts/ports) or the change journal: it restates them',
  item_contract: 'the port contract or the setting\'s `of` (§4.2)',
  persistence: 'the port contract (persistence is the host\'s)',
  backend: 'the port contract',
  compatibility: 'the change journal (contracts/changes): migrations, replacement, extra deprecations',
  state: 'component.json `host-states` / `entry-state` (state machines are the standard\'s)',
  capabilities: 'one small `registry` block in component.json, or dropped in manifest schema v3',
  tags: 'one small `registry` block, or dropped in schema v3',
  lifecycle: 'one small `registry` block (stable/experimental is a release fact)',
  readiness: 'one small `registry` block, or derived from the gates a release ran',
  adapter: 'one small `registry` block',
  kind: 'one small `registry` block',
  reuse_mode: 'one small `registry` block',
  ownership: 'one `registry` block (already copied in component.json x-kept)',
  security: 'one `registry` block (already copied in component.json x-kept)',
  presentation: 'one `registry` block (already copied in component.json x-kept)',
  ai_guidance: 'one `registry` block (already copied in component.json x-kept)',
  accessibility: 'component.json `accessibility` (focus, accessible_name, keyboard words: one field each)',
  'composition-declarative': 'derived except standard/profiles/data/persistence/presentation: generate it',
  inputs: 'base/host words and constraints §4.2 has no field for (minLength, required): add them to §4.2 or drop',
  'inputs-required': '§4.2 `required` on a setting',
  'trait-inputs': 'a trait contract (field-inherit@1) the generator expands; today the trait is code only (src/smart/helpers/inherited-value.js)',
  'event-fields': 'component.json events (`canonical`: one flag per event)',
  'exported-parts': 'component.json `parts` (§4.2) — exported parts are its public parts',
  'public-parts': 'component.json `parts`',
  artifacts: 'derived (studio.fixture.json / studio.scenario.json names)',
  other: 'schema v2 extra top-level fields',
};

// ------------------------------------------------------------------- the run

const results = await run({packages, components: []});
const report = {
  schema: 'simai.component-files-1.4-report.v1',
  standard: 'simai.smart-component 1.4 (phase 1: check only)',
  generator: 'scripts/generate-component-files.mjs',
  packages: packages.map((root) => ({repository: repositoryOf(root), root: path.relative(repositoryRoot, root) || '.', smart_tree: treeOf(root)})),
  generated_files: GENERATED,
  totals: {},
  manifest_classes: {},
  manifest_kinds: {},
  meta_classes: {},
  registry_keys: {},
  conflicts: [],
  meta_conflicts: [],
  unclassified: [],
  components: [],
};
for (const file of GENERATED) report.totals[file] = {identical: 0, semantic: 0, differs: 0, new: 0, 'not-generated': 0};
const allManifest = [];
for (const result of results) {
  const pkg = report.packages[packages.indexOf(result.package)].repository;
  const folder = path.join(result.package, 'src', 'smart', result.component);
  const entry = {component: result.component, package: pkg, files: {}};
  if (result.error) { entry.error = result.error; report.components.push(entry); continue; }
  for (const [file, value] of Object.entries(result.files)) {
    report.totals[file][value.status] += 1;
    entry.files[file] = value.status;
  }
  entry.bridge = result.log.bridge;
  entry.bridge_conflicts = result.log.conflicts;
  const manifest = result.files['smart.manifest.json']?.differences ? classifyManifest(result, folder) : [];
  const counts = {};
  for (const item of manifest) {
    counts[item.class] = (counts[item.class] ?? 0) + 1;
    report.manifest_classes[item.class] = (report.manifest_classes[item.class] ?? 0) + 1;
    const kindKey = `${item.class} ${item.kind}`;
    report.manifest_kinds[kindKey] ??= {count: 0, components: []};
    report.manifest_kinds[kindKey].count += 1;
    if (!report.manifest_kinds[kindKey].components.includes(result.component)) report.manifest_kinds[kindKey].components.push(result.component);
    if (item.class === 'c') report.conflicts.push({component: result.component, package: pkg, ...item});
    if (item.class === 'unclassified') report.unclassified.push({component: result.component, ...item});
  }
  entry.manifest = counts;
  allManifest.push(...manifest.map((item) => ({component: result.component, package: pkg, ...item})));
  const meta = result.files['meta.mjs']?.differences ? classifyMeta(result) : [];
  if (meta.length) {
    entry.meta = {};
    for (const item of meta) {
      entry.meta[item.class] = (entry.meta[item.class] ?? 0) + 1;
      report.meta_classes[item.class] = (report.meta_classes[item.class] ?? 0) + 1;
      if (item.class === 'c') report.meta_conflicts.push({component: result.component, ...item});
    }
  }
  const registry = result.view.component['x-registry'] ?? {};
  entry.registry = Object.fromEntries(Object.entries(registry).map(([key, value]) => [key, JSON.stringify(value, null, 2).split('\n').length]));
  for (const [key, lines] of Object.entries(entry.registry)) {
    report.registry_keys[key] ??= {components: 0, lines: 0, home: HOMES[key] ?? '?', in: []};
    report.registry_keys[key].components += 1;
    report.registry_keys[key].lines += lines;
    report.registry_keys[key].in.push(result.component);
  }
  report.components.push(entry);
}

// A component is ready for phase A's --check gate file by file: the files
// already semantically equal. Fully ready: every file but the manifest/meta.
const isEqual = (status) => status === 'identical' || status === 'semantic';
report.ready = {
  by_file: Object.fromEntries(GENERATED.map((file) => [file, report.components.filter((c) => isEqual(c.files[file])).map((c) => `${c.package === 'simai/ui-source' ? '' : `${c.package}:`}${c.component}`)])),
};

// ------------------------------------------------------------- consumers
// What a reader of the committed smart.manifest.json (in the distribution:
// distr/smart/<folder>/smart.manifest.json) sees wrong today, by the fields it
// reads. Wrong = a1-fact (stale against component.json), the base and alias
// settings the registry lacks (a2 base-setting: a valid attribute it does not
// know), and the conflicts in the fields it reads.
const CONSUMERS = [
  {id: 'ui-doc', reads: 'summary, inputs (type, default, enum, description), methods, events (ui-doc scripts/build-smart-reference.mjs → the public Smart reference on ui.simai.io)',
    fields: ['summary', 'inputs', 'methods', 'events']},
  {id: 'ui-studio', reads: 'title, summary, version, inputs as the props schema (additionalProperties: false), methods, events, ai_guidance (packages/mcp catalog-service: public_abi for agents; scripts/lib/owner-sources.mjs)',
    fields: ['title', 'summary', 'version', 'inputs', 'methods', 'events', 'accessibility', 'composition']},
  {id: 'ui-vscode', reads: 'inputs (name, type, default, description, enum, examples), summary, compatibility.deprecations/replacement, lifecycle (src/generate/buildFramework.ts: IntelliSense)',
    fields: ['summary', 'inputs', 'compatibility']},
  {id: 'ui registry (ui-builder bind-generated-runtime-contracts.py)', reads: 'title and lifecycle, once, when an entry is added to ui contracts/owners/smart-component.manifest.json',
    fields: ['title']},
];
const wrongFor = (consumer) => allManifest.filter((item) => consumer.fields.includes(item.path.split('.')[0])
  && (item.class === 'a1-fact' || item.class === 'c' || (item.class === 'a2-rule' && item.kind === 'base-setting')));
report.consumers = CONSUMERS.map((consumer) => {
  const facts = wrongFor(consumer);
  const kinds = {};
  for (const item of facts) {
    const key = `${item.class} ${item.kind}`;
    kinds[key] ??= {count: 0, components: []};
    kinds[key].count += 1;
    if (!kinds[key].components.includes(item.component)) kinds[key].components.push(item.component);
  }
  return {consumer: consumer.id, reads: consumer.reads, wrong_facts: facts.length, components: [...new Set(facts.map((item) => item.component))].length, kinds};
});
// The facts a reader acts on, by name: per component, what the registry lacks
// or names wrongly.
const HEADLINE = ['event-missing', 'alias-event-missing', 'method-missing', 'setting-missing', 'alias-setting-missing', 'input.enum-values-missing', 'input.enum-missing', 'input-undeclared', 'event-undeclared', 'title', 'version', 'accessibility.role'];
report.headline = {};
for (const kind of HEADLINE) {
  const items = allManifest.filter((item) => item.kind === kind);
  if (!items.length) continue;
  const byName = {};
  for (const item of items) {
    const key = `${item.package === 'simai/ui-source' ? '' : 'pro '}${item.component}`;
    const what = ['title', 'version', 'accessibility.role'].includes(kind) ? `${item.committed} → ${item.generated}`
      : kind.startsWith('input.enum') ? `${item.raw_path ?? item.path.split('.')[2]} ${item.generated}` : item.path.split('.').slice(-1)[0];
    (byName[key] ??= []).push(what);
  }
  report.headline[kind] = byName;
}

// ------------------------------------------------------------------ markdown

const md = [];
const pct = (n, of) => (of ? `${Math.round((100 * n) / of)} %` : '–');
md.push(START, '');
md.push(`Inputs (Git tree of src/smart): ${report.packages.map((pkg) => `${pkg.repository} ${pkg.smart_tree?.slice(0, 12) ?? '?'}`).join(', ')}. Components: ${report.components.length} (${report.packages.map((pkg) => `${report.components.filter((c) => c.package === pkg.repository).length} ${pkg.repository}`).join(', ')}).`, '');
md.push('### Per generated file', '');
md.push('| File | identical (bytes) | semantically identical | differs | committed, not generated | generated, not committed |');
md.push('|:---|---:|---:|---:|---:|---:|');
for (const [file, t] of Object.entries(report.totals)) md.push(`| ${file} | ${t.identical} | ${t.semantic} | ${t.differs} | ${t['not-generated']} | ${t.new} |`);
md.push('');
md.push('### smart.manifest.json differences by class', '');
const totalManifest = Object.values(report.manifest_classes).reduce((n, v) => n + v, 0);
md.push('| Class | Differences | Share |', '|:---|---:|---:|');
for (const cls of ['a1-fact', 'a1-words', 'a2-rule', 'c', 'unclassified']) if (report.manifest_classes[cls]) md.push(`| ${cls} | ${report.manifest_classes[cls]} | ${pct(report.manifest_classes[cls], totalManifest)} |`);
md.push(`| total | ${totalManifest} | |`, '');
md.push('### smart.manifest.json differences by kind', '');
md.push('| Class | Kind | Differences | Components |', '|:---|:---|---:|:---|');
for (const [key, value] of Object.entries(report.manifest_kinds).sort((a, b) => a[0].localeCompare(b[0]) || b[1].count - a[1].count)) {
  const [cls, kind] = key.split(' ');
  const list = value.components.length > 8 ? `${value.components.slice(0, 8).join(', ')} … (${value.components.length})` : value.components.join(', ');
  md.push(`| ${cls} | ${kind} | ${value.count} | ${list} |`);
}
md.push('');
md.push('### (c) Conflicts, by component', '');
const byComponent = {};
for (const item of report.conflicts) (byComponent[`${item.package === 'simai/ui-source' ? '' : `${item.package} `}${item.component}`] ??= []).push(item);
for (const [name, items] of Object.entries(byComponent).sort((a, b) => b[1].length - a[1].length)) {
  md.push(`**${name}** (${items.length})`, '');
  for (const item of items) md.push(`- \`${item.path}\` — ${item.why}; registry ${item.committed}, generated ${item.generated}${item.where ? ` (${item.where.join(', ')})` : ''}`);
  md.push('');
}
md.push('### (b) What only smart.manifest.json holds (x-registry), by key', '');
md.push('| Key | Components | Lines | Belongs in 1.4 |', '|:---|---:|---:|:---|');
for (const [key, value] of Object.entries(report.registry_keys).sort((a, b) => b[1].lines - a[1].lines)) md.push(`| ${key} | ${value.components} | ${value.lines} | ${value.home} |`);
md.push('');
md.push('### What each consumer of smart.manifest.json sees wrong today', '');
md.push('| Consumer | Reads | Wrong facts | Components |', '|:---|:---|---:|---:|');
for (const c of report.consumers) md.push(`| ${c.consumer} | ${c.reads} | ${c.wrong_facts} | ${c.components} |`);
md.push('');
for (const c of report.consumers) {
  md.push(`**${c.consumer}**`, '', '| Class | Kind | Facts | Components |', '|:---|:---|---:|:---|');
  for (const [key, value] of Object.entries(c.kinds).sort((a, b) => b[1].count - a[1].count)) {
    const [cls, kind] = key.split(' ');
    const list = value.components.length > 10 ? `${value.components.slice(0, 10).join(', ')} … (${value.components.length})` : value.components.join(', ');
    md.push(`| ${cls} | ${kind} | ${value.count} | ${list} |`);
  }
  md.push('');
}
md.push('### The facts by name', '', 'What the committed registry lacks or names wrongly, per component (`registry → component.json` where a value).', '');
for (const [kind, byName] of Object.entries(report.headline)) {
  md.push(`**${kind}** (${Object.values(byName).flat().length})`, '');
  md.push(Object.entries(byName).map(([name, list]) => `${name}: ${list.join(', ')}`).join('; '), '');
}
md.push('### meta.mjs differences by class', '');
md.push('| Class | Differences |', '|:---|---:|');
for (const [cls, n] of Object.entries(report.meta_classes)) md.push(`| ${cls} | ${n} |`);
md.push('');
if (report.meta_conflicts.length) {
  md.push('meta.mjs conflicts:', '');
  for (const item of report.meta_conflicts) md.push(`- ${item.component} \`${item.path}\` — ${item.why}`);
  md.push('');
}
md.push('### Per component', '');
md.push('| Component | rule | aliases | meta | fixture | scenario | probe | manifest a1-fact / a1-words / a2 / c | x-registry lines |');
md.push('|:---|:---|:---|:---|:---|:---|:---|:---|---:|');
const mark = (status) => ({identical: '=', semantic: '≈', differs: '≠', new: '+', 'not-generated': '!'}[status] ?? '–');
for (const c of report.components) {
  if (c.error) { md.push(`| ${c.component} | not readable: ${c.error} | | | | | | | |`); continue; }
  const m = c.manifest;
  const reg = Object.values(c.registry).reduce((n, v) => n + v, 0);
  md.push(`| ${c.package === 'simai/ui-source' ? '' : 'pro '}${c.component} | ${mark(c.files['rule.js'])} | ${mark(c.files['aliases.json'])} | ${mark(c.files['meta.mjs'])} | ${mark(c.files['studio.fixture.json'])} | ${mark(c.files['studio.scenario.json'])} | ${mark(c.files['probe.json'])} | ${m['a1-fact'] ?? 0} / ${m['a1-words'] ?? 0} / ${m['a2-rule'] ?? 0} / ${m.c ?? 0} | ${reg} |`);
}
md.push('', '`=` byte-identical, `≈` semantically identical, `≠` differs, `!` committed but not generated, `–` neither.', '');
md.push(END);

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const previous = existsSync(REPORT_MD) ? readFileSync(REPORT_MD, 'utf8') : `# Component files 1.4: equivalence report\n\n${START}\n${END}\n`;
const startAt = previous.indexOf(START);
const endAt = previous.indexOf(END);
if (startAt < 0 || endAt < 0) throw new Error(`${REPORT_MD}: the generated markers are missing`);
const mdText = `${previous.slice(0, startAt)}${md.join('\n')}${previous.slice(endAt + END.length)}`;
if (checkOnly) {
  const ok = existsSync(REPORT_JSON) && readFileSync(REPORT_JSON, 'utf8') === jsonText && previous === mdText;
  console.log(ok ? 'component files report is current' : 'component files report is stale: run node scripts/report-component-files.mjs');
  if (!ok) process.exitCode = 1;
} else {
  writeFileSync(REPORT_JSON, jsonText);
  writeFileSync(REPORT_MD, mdText);
  console.log(`wrote ${path.relative(repositoryRoot, REPORT_MD)} and ${path.relative(repositoryRoot, REPORT_JSON)}`);
  console.log(JSON.stringify({totals: report.totals, manifest: report.manifest_classes, meta: report.meta_classes, conflicts: report.conflicts.length, unclassified: report.unclassified.length}));
}

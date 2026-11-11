import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {findRegion, loadCases, runKit} from '../src/core/contracts/ports/simai.document-port/1.0.0/kit/run.mjs';

// simai.document-port 1.0.0 (draft 2): the host storage seam of a composition
// document. One storage element per site, section or page level, a value per
// language, one revision for every language (owner decision 2026-11-10, item 7),
// no record lock (item 4), areas inherited by the Recipe rule. The port is
// modelled on simai.mail-port (ui-mail) and the Framework's chat port; the seven
// intents are bx-simai.layout's seven document actions.
const root = resolve(import.meta.dirname, '..');
const at = join(root, 'src/core/contracts/ports/simai.document-port/1.0.0');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const port = read(join(at, 'port.json'));
const schema = read(join(at, 'document-port.schema.json'));
const manifest = read(join(at, 'kit/manifest.json'));
const cases = loadCases(join(at, 'kit'));
const ANSWERS = ['applied', 'conflict', 'refused', 'unavailable'];
const BASE = 'https://simai.io/contracts/ports/simai.document-port/1.0.0/';

// ui-source has no dependencies: a strict validator of the keywords these
// schemas use, refusing any other (as scripts/manifest-schema.mjs does).
const SCHEMAS = new Map();
const KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'propertyNames', 'items', 'minItems', 'maxItems', 'uniqueItems',
  'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'minProperties', 'maxProperties', '$ref', 'oneOf', 'anyOf', 'allOf', 'format',
  '$schema', '$id', 'title', 'description', '$defs', 'x-simai-version', 'if', 'then', 'else', 'not']);
const kindOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value);
function validator(schema, base) {
  const errors = [];
  const resolveRef = (ref, from) => {
    const [file, fragment = ''] = ref.split('#');
    const url = file ? new URL(file, from).href : from;
    const document = SCHEMAS.get(url);
    if (!document) throw new Error(`schema ${url} is not known`);
    const target = fragment ? fragment.split('/').slice(1).reduce((node, key) => node?.[key], document) : document;
    if (!target) throw new Error(`no ${ref} from ${from}`);
    return [target, url];
  };
  const check = (node, data, path, from) => {
    for (const keyword of Object.keys(node)) if (!KEYWORDS.has(keyword)) throw new Error(`keyword ${keyword} is not supported`);
    const before = errors.length;
    if (node.$ref) { const [target, url] = resolveRef(node.$ref, from); check(target, data, path, url); }
    if (node.type !== undefined) {
      const types = [].concat(node.type);
      if (!types.some((type) => type === kindOf(data) || (type === 'number' && kindOf(data) === 'integer'))) { errors.push(`${path} must be ${types.join('|')}`); return; }
    }
    if (node.const !== undefined && JSON.stringify(node.const) !== JSON.stringify(data)) errors.push(`${path} must be ${JSON.stringify(node.const)}`);
    if (node.enum && !node.enum.some((one) => JSON.stringify(one) === JSON.stringify(data))) errors.push(`${path} must be one of ${node.enum.join(', ')}`);
    if (typeof data === 'number') {
      if (node.minimum !== undefined && data < node.minimum) errors.push(`${path} below ${node.minimum}`);
      if (node.maximum !== undefined && data > node.maximum) errors.push(`${path} above ${node.maximum}`);
    }
    if (typeof data === 'string') {
      if (node.minLength !== undefined && [...data].length < node.minLength) errors.push(`${path} too short`);
      if (node.maxLength !== undefined && [...data].length > node.maxLength) errors.push(`${path} too long`);
      if (node.pattern && !new RegExp(node.pattern, 'u').test(data)) errors.push(`${path} must match ${node.pattern}`);
    }
    if (Array.isArray(data)) {
      if (node.minItems !== undefined && data.length < node.minItems) errors.push(`${path} needs ${node.minItems} items`);
      if (node.maxItems !== undefined && data.length > node.maxItems) errors.push(`${path} has over ${node.maxItems} items`);
      if (node.uniqueItems && new Set(data.map((one) => JSON.stringify(one))).size !== data.length) errors.push(`${path} repeats an item`);
      if (node.items) data.forEach((one, index) => check(node.items, one, `${path}/${index}`, from));
    }
    if (kindOf(data) === 'object') {
      const keys = Object.keys(data);
      if (node.minProperties !== undefined && keys.length < node.minProperties) errors.push(`${path} needs ${node.minProperties} keys`);
      if (node.maxProperties !== undefined && keys.length > node.maxProperties) errors.push(`${path} has over ${node.maxProperties} keys`);
      for (const name of node.required ?? []) if (!Object.hasOwn(data, name)) errors.push(`${path} must have ${name}`);
      for (const [name, value] of Object.entries(data)) {
        if (node.propertyNames) check(node.propertyNames, name, `${path}/${name}`, from);
        if (node.properties && Object.hasOwn(node.properties, name)) check(node.properties[name], value, `${path}/${name}`, from);
        else if (node.additionalProperties === false) errors.push(`${path}/${name} is not declared`);
        else if (node.additionalProperties && node.additionalProperties !== true) check(node.additionalProperties, value, `${path}/${name}`, from);
      }
    }
    for (const part of node.allOf ?? []) check(part, data, path, from);
    const passes = (part) => { const mark = errors.length; check(part, data, path, from); const ok = errors.length === mark; errors.length = mark; return ok; };
    if (node.if) { if (passes(node.if)) { if (node.then) check(node.then, data, path, from); } else if (node.else) check(node.else, data, path, from); }
    if (node.not && passes(node.not)) errors.push(`${path} must not match not`);
    if (node.oneOf && node.oneOf.filter(passes).length !== 1) errors.push(`${path} must match exactly one of oneOf`);
    if (node.anyOf && !node.anyOf.some(passes)) errors.push(`${path} must match one of anyOf`);
    return errors.length === before;
  };
  const validate = (data) => { errors.length = 0; check(schema, data, '', base); validate.errors = [...errors]; return errors.length === 0; };
  return validate;
}
const register = (document) => SCHEMAS.set(document.$id, document);
register(read(join(root, 'src/core/contracts/composition-document.v1.schema.json')));
register(schema);
const compile = (fragment, name) => validator(fragment, `${BASE}${name}`);
const ajv = {compile: (document) => { register(document); return validator(document, document.$id); }, getSchema: (id) => validator(SCHEMAS.get(id), id)};

test('the port is a composite host port of sf-editor, a draft 1.0.0 with no previous major', () => {
  const validate = ajv.compile(read(join(root, 'src/core/contracts/composite-host-port.v1.schema.json')));
  assert.ok(validate(port), JSON.stringify(validate.errors));
  assert.equal(port.port, 'simai.document-port');
  assert.equal(port.version, '1.0.0');
  assert.equal(port.component, 'smart.editor');
  assert.equal(port.element, 'sf-editor');
  assert.equal(port.compatibility.previous_major, null);
  assert.deepEqual(port.answer.schema.properties.answer.enum, ANSWERS);
  assert.doesNotMatch(JSON.stringify(port) + JSON.stringify(schema), /sf5/u);
});

test('seven intents, the seven document actions; writes carry their revision or client_key', () => {
  assert.deepEqual(Object.keys(port.intents), ['document.load', 'document.resolve', 'document.save', 'history.list', 'document.restore', 'document.publish', 'document.rollback']);
  for (const [name, intent] of Object.entries(port.intents)) {
    assert.match(intent.event, /^document-port:[a-z-]+$/u, name);
    assert.equal(intent.payload.additionalProperties, false, `${name}: a closed payload`);
    assert.ok(intent.capability === null || intent.capability in port.capabilities, `${name}: ${intent.capability}`);
    compile(intent.payload, `payload-${name}`);
    compile(intent.answer_data, `answer-${name}`);
  }
  for (const [name, capability] of Object.entries(port.capabilities)) {
    for (const intent of capability.intents ?? []) assert.equal(port.intents[intent].capability, name, `${name} names ${intent}`);
    for (const key of capability.data ?? []) assert.ok(key in port.data, `${name}: data ${key}`);
  }
  for (const name of ['document.save', 'document.restore', 'document.publish', 'document.rollback']) {
    assert.equal(port.intents[name].carries_revision, true, name);
    assert.ok(port.intents[name].answers.includes('conflict'), `${name}: conflict`);
  }
  assert.ok(port.intents['document.save'].payload.required.includes('expected_revision'));
  for (const name of ['document.restore', 'document.publish', 'document.rollback']) assert.ok(port.intents[name].payload.required.includes('client_key'), name);
  assert.equal(Object.keys(port.intents).some((name) => /lock/u.test(name)), false, 'no record lock (owner 2026-11-10, item 4)');
  assert.equal(schema.$defs.limits.properties.max_nodes.maximum, 200);
  assert.equal(schema.$defs.limits.properties.max_bytes.maximum, 262144);
  assert.deepEqual(schema.$defs.area_state.enum, ['inherited', 'replaced', 'cleared']);
});

test('the kit: every case a file, payloads valid, all four answers exercised, the digest pinned', () => {
  assert.equal(manifest.schema, 'simai.composite.host-port.conformance.v1');
  assert.equal(manifest.port, port.port);
  assert.equal(manifest.version, port.version);
  assert.deepEqual(manifest.answers, ANSWERS);
  assert.equal(port.conformance.cases, manifest.cases.length);
  assert.deepEqual(readdirSync(join(at, 'kit/cases')).sort(), manifest.cases.map((id) => `${id}.json`).sort());
  assert.ok(existsSync(join(at, 'kit/README.md')));
  const seen = new Set();
  const covered = new Set();
  for (const kase of cases) {
    assert.equal(kase.when.intent, kase.intent, kase.id);
    assert.ok(/[.]$/u.test(kase.summary) && kase.summary.length > 20, `${kase.id}: a summary in words`);
    seen.add(kase.then.answer);
    const intent = port.intents[kase.intent];
    if (!intent) { assert.equal(kase.then.answer, 'refused', `${kase.id}: an undeclared intent is refused`); continue; }
    covered.add(kase.intent);
    // A case carries its intent's capability, or (for an intent every host has)
    // the capability whose behaviour it checks; it applies to the hosts that announce it.
    if (intent.capability) assert.equal(kase.capability, intent.capability, `${kase.id}: the intent's capability`);
    else assert.ok(kase.capability === null || (kase.capability in port.capabilities && kase.given.capabilities.includes(kase.capability)), `${kase.id}: ${kase.capability}`);
    assert.ok(intent.answers.includes(kase.then.answer), `${kase.id}: ${kase.then.answer}`);
    const validate = compile(intent.payload, `case-${kase.id}`);
    // A case that tests the host's own validation sends what the host must refuse.
    if (kase.id !== 'save-refused-as-invalid-changes-nothing') assert.ok(validate(kase.when.payload), `${kase.id}: ${JSON.stringify(validate.errors)}`);
    for (const key of kase.then.data_must_include ?? []) assert.ok(key in port.data, `${kase.id}: data ${key}`);
    for (const key of kase.then.answer_must_include ?? []) assert.ok(key in port.answer.schema.properties, `${kase.id}: answer ${key}`);
    if (intent.capability && kase.then.answer !== 'refused') assert.ok(kase.given.capabilities.includes(intent.capability), `${kase.id}: the host announces ${intent.capability}`);
  }
  assert.deepEqual([...seen].sort(), ANSWERS);
  assert.deepEqual([...covered].sort(), Object.keys(port.intents).sort(), 'every intent has a case');
});

// ---------------------------------------------------------------------------
// A reference host in memory: the kit is answerable, and the runner reads it.

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const countNodes = (node) => (node && typeof node === 'object' ? 1 + Object.values(node.slots ?? {}).flat().reduce((sum, child) => sum + countNodes(child), 0) : 0);
const regionsOf = (document) => {
  const shell = (document?.root?.slots?.default ?? []).find((node) => node.type === 'layout.regions');
  return shell?.slots?.regions ?? [];
};
const stateOf = (region) => (region ? (region.slots?.default?.length ? 'replaced' : 'cleared') : 'inherited');
const validDocument = ajv.getSchema('https://simai.io/contracts/composition-document.v1.schema.json');
// Equal, key order aside (the round-trip rule).
const canonical = (value) => (Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value);
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const unmarked = (region) => {
  const copy = structuredClone(region);
  if (copy.extensions) { delete copy.extensions['simai:area']; if (!Object.keys(copy.extensions).length) delete copy.extensions; }
  return copy;
};
const stripMarks = (document) => {
  const copy = structuredClone(document);
  for (const region of regionsOf(copy)) if (region.extensions) { delete region.extensions['simai:area']; if (!Object.keys(region.extensions).length) delete region.extensions; }
  return copy;
};

function memoryHost() {
  let state;
  let counter;
  const ok = (data) => ({answer: 'applied', data});
  const refused = (reason, data) => ({answer: 'refused', reason, message: `refused: ${reason}`, ...(data ? {data} : {})});
  const has = (capability) => state.capabilities.includes(capability);
  const published = () => state.publications.find((one) => one.id === state.published) ?? null;
  const current = () => ({revision: state.revision, values: structuredClone(state.values), published: published(), ...(has('levels') ? resolveAll(state.values) : {})});
  const rights = () => state.rights ?? {save: true, publish: has('publish')};
  const mayWrite = (language) => rights().save && (!rights().languages || rights().languages.includes(language));
  const conflict = (reason) => ({answer: 'conflict', reason, message: reason, current_revision: state.revision, current: current()});
  const chain = () => [state.target, ...(state.target.parents ?? [])];
  const valuesOf = (level, values) => (level.ref === state.target.ref ? values : state.parents?.[level.ref]?.values ?? {});
  const lockedAbove = (name) => (state.target.parents ?? []).find((level) => state.parents?.[level.ref]?.locked?.includes(name));
  function resolveAll(values) {
    const resolved = {};
    const areas = {};
    const names = [...new Set(chain().slice().reverse().flatMap((level) => Object.values(valuesOf(level, values)).flatMap((document) => regionsOf(document).map((region) => region.props.name))))];
    for (const [language, own] of Object.entries(values)) {
      const document = structuredClone(chain().at(-1).ref === state.target.ref ? own : state.parents[chain().at(-1).ref].values[language] ?? own);
      document.id = own.id;
      const shell = regionsOf(document);
      for (const name of names) {
        const origin = chain().find((level) => regionsOf(valuesOf(level, values)[language]).some((region) => region.props.name === name));
        const source = regionsOf(valuesOf(origin, values)[language]).find((region) => region.props.name === name);
        const locked = Boolean(lockedAbove(name));
        const mark = {origin: origin.level, origin_ref: origin.ref, state: origin.ref === state.target.ref ? stateOf(source) : 'inherited', locked};
        const region = structuredClone(source);
        region.extensions = {...(region.extensions ?? {}), 'simai:area': mark};
        const index = shell.findIndex((one) => one.props.name === name);
        if (index >= 0) shell[index] = region; else shell.push(region);
        areas[name] = mark;
      }
      resolved[language] = document;
    }
    return {resolved, areas};
  }
  // The parent's area a region marked inherited stands for, in one language.
  const parentArea = (language, name) => {
    for (const level of state.target.parents ?? []) {
      const region = regionsOf(state.parents?.[level.ref]?.values?.[language]).find((one) => one.props.name === name);
      if (region) return region;
    }
    return null;
  };
  // A save of a resolved document: inherited regions are not stored (refused would-lose when edited); the
  // simai:area key goes, every other extensions key stays.
  function levelValue(language, document) {
    const copy = structuredClone(document);
    const shell = (copy.root?.slots?.default ?? []).find((node) => node.type === 'layout.regions');
    const diagnostics = [];
    if (shell?.slots?.regions) {
      shell.slots.regions = shell.slots.regions.filter((region, index) => {
        if (region.extensions?.['simai:area']?.state !== 'inherited') return true;
        const bare = unmarked(region);
        if (!same(bare, parentArea(language, region.props?.name))) diagnostics.push({code: 'inherited-area-changed', severity: 'error', path: `/root/slots/default/0/slots/regions/${index}`, language});
        return false;
      });
    }
    return diagnostics.length ? {diagnostics} : {value: stripMarks(copy)};
  }
  function checkValues(values, writing = false) {
    for (const [language, document] of Object.entries(values)) {
      if (!state.languages.includes(language)) return refused('unknown-language');
      if (writing && !mayWrite(language)) return refused('access-denied');
      if (document === null) { if (writing && language === state.languages[0]) return refused('invalid', {diagnostics: [{code: 'main-language-removed', severity: 'error', path: `/values/${language}`, language}]}); continue; }
      if (document.locale !== undefined && document.locale !== language) return refused('structure-mismatch');
      if (!validDocument(document)) return refused('invalid', {diagnostics: [{code: 'schema', severity: 'error', path: validDocument.errors?.[0]?.instancePath ?? '', language}]});
      if (countNodes(document.root) > state.limits.max_nodes || bytes(stripMarks(document)) > state.limits.max_bytes) return refused('too-large');
    }
    return null;
  }
  const load = () => ok({target: state.target, revision: state.revision, languages: state.languages, values: structuredClone(state.values),
    rights: rights(), limits: state.limits,
    ...(has('levels') ? resolveAll(state.values) : {}), ...(has('publish') ? {published: published()} : {})});
  const remembered = (key, params) => {
    const seen = state.keys.get(key);
    if (!seen) return null;
    return JSON.stringify(seen.params) === JSON.stringify(params) ? structuredClone(seen.answer) : conflict('idempotency-conflict');
  };
  const remember = (key, params, answer) => { state.keys.set(key, {params, answer: structuredClone(answer)}); return answer; };
  const draft = (values, extra = {}) => {
    state.drafts.unshift({revision: state.revision, at: state.at, languages: Object.keys(state.values), values: state.values});
    counter += 1;
    state.revision = String(counter);
    state.at = new Date(Date.UTC(2026, 10, 11, 10, counter)).toISOString();
    state.values = values;
    state.drafts.unshift({revision: state.revision, at: state.at, languages: Object.keys(values), values, ...extra});
    state.drafts.shift();
    state.current = extra;
    return ok({revision: state.revision, values: structuredClone(values), ...(has('levels') ? resolveAll(values) : {})});
  };
  const publish = (revision, languages, from) => {
    for (const one of state.publications) if (one.state === 'published') one.state = 'superseded';
    const publication = {id: `p${state.publications.length + 1}`, revision, state: 'published', at: new Date(Date.UTC(2026, 10, 11, 12, state.publications.length)).toISOString(), languages, ...(from ? {from} : {})};
    state.publications.unshift(publication);
    state.published = publication.id;
    return publication;
  };
  const valuesAt = (revision) => (revision === state.revision ? state.values : state.drafts.find((one) => one.revision === revision)?.values);
  const handlers = {
    'document.load': load,
    'document.resolve': ({values}) => checkValues(values) ?? ok(resolveAll(Object.fromEntries(Object.entries(values).map(([language, document]) => [language, stripMarks(document)])))),
    'document.save': (payload) => {
      const {values, expected_revision: expected, client_key: key} = payload;
      if (key) { const again = remembered(key, payload); if (again) return again; }
      if (!rights().save) return refused('access-denied');
      if (expected !== state.revision) return conflict('stale-revision');
      const refusal = checkValues(values, true);
      if (refusal) return refusal;
      const next = structuredClone(state.values);
      for (const [language, document] of Object.entries(values)) {
        if (document === null) { delete next[language]; continue; }
        const level = levelValue(language, document);
        if (level.diagnostics) return refused('would-lose', {diagnostics: level.diagnostics});
        next[language] = level.value;
      }
      if (has('levels') || state.parents) {
        const shapes = Object.values(next).map((document) => JSON.stringify(regionsOf(document).map((region) => [region.props.name, stateOf(region)]).sort()));
        if (new Set(shapes).size > 1) return refused('structure-mismatch');
        for (const region of regionsOf(Object.values(next)[0] ?? {})) if (lockedAbove(region.props.name)) return refused('area-locked');
      }
      const answer = draft(next);
      return key ? remember(key, payload, answer) : answer;
    },
    'history.list': ({limit = 20, before, before_publication: beforePublication} = {}) => {
      const drafts = [{revision: state.revision, at: state.at, languages: Object.keys(state.values), ...(state.current ?? {})}, ...state.drafts.map(({values, ...entry}) => entry)];
      const publications = state.publications.map((one) => ({...one}));
      const from = (list, at, key) => {
        if (at === undefined) return 0;
        const index = list.findIndex((one) => one[key] === at);
        return index < 0 ? -1 : index + 1;
      };
      const d = from(drafts, before, 'revision');
      const p = from(publications, beforePublication, 'id');
      if (d < 0 || p < 0) return refused('not-found');
      return ok({drafts: drafts.slice(d, d + limit), publications: publications.slice(p, p + limit),
        more: {drafts: drafts.length > d + limit, publications: publications.length > p + limit}});
    },
    'document.restore': (payload) => {
      const again = remembered(payload.client_key, payload);
      if (again) return again;
      if (!rights().save) return refused('access-denied');
      if (payload.expected_revision !== state.revision) return conflict('stale-revision');
      const values = valuesAt(payload.revision);
      if (!values) return refused('not-found');
      return remember(payload.client_key, payload, draft(structuredClone(values), {restored_from: payload.revision}));
    },
    'document.publish': (payload) => {
      const again = remembered(payload.client_key, payload);
      if (again) return again;
      if (payload.at && !has('scheduled-publish')) return refused('capability-not-provided');
      if (!rights().publish) return refused('access-denied');
      if (payload.expected_published !== state.published) return conflict('environment-changed');
      if (payload.revision !== state.revision) return conflict('stale-revision');
      for (const language of payload.languages ?? []) {
        if (!state.languages.includes(language)) return refused('unknown-language');
        if (!(language in state.values)) return refused('missing-translation');
      }
      const languages = (payload.languages ?? state.languages).filter((language) => language in state.values);
      return remember(payload.client_key, payload, ok({publication: {...publish(payload.revision, languages), client_key: payload.client_key}}));
    },
    'document.rollback': (payload) => {
      const again = remembered(payload.client_key, payload);
      if (again) return again;
      if (!rights().publish) return refused('access-denied');
      if (payload.expected_published !== state.published) return conflict('environment-changed');
      const from = state.publications.find((one) => one.id === payload.publication);
      if (!from) return refused('not-found');
      return remember(payload.client_key, payload, ok({publication: {...publish(from.revision, from.languages, from.id), client_key: payload.client_key}}));
    },
  };
  return {
    async setup(given) {
      state = {publications: [], drafts: [], published: null, parents: null, ...given, keys: new Map()};
      for (const one of state.publications) if (one.client_key) state.keys.set(one.client_key, {params: {revision: one.revision, client_key: one.client_key}, answer: ok({publication: one})});
      counter = 100;
    },
    async send(intent, payload) {
      if (!(intent in port.intents)) return refused('unknown-intent');
      const capability = port.intents[intent].capability;
      if (capability && !state.capabilities.includes(capability)) return refused('capability-not-provided');
      if (state.fault === 'session-expired') return refused('session-expired');
      if (state.fault) return {answer: 'unavailable', reason: state.fault, message: `unavailable: ${state.fault}`, retry_after: 30};
      return handlers[intent](payload);
    },
  };
}

test('the kit passes on a reference host in memory, so every case is answerable as written', async () => {
  const report = await runKit(memoryHost());
  const failed = report.results.filter((one) => !one.ok).map((one) => `${one.id}: ${one.failures.join('; ')}`);
  assert.deepEqual(failed, []);
  assert.equal(report.passed, manifest.cases.length);
});

test('the answers of the reference host fit the declared data, and marks never reach a stored value', async () => {
  const host = memoryHost();
  const data = Object.fromEntries(Object.entries(port.data).map(([key, entry]) => [key, compile(entry.schema, `data-${key}`)]));
  for (const kase of cases) {
    await host.setup(structuredClone(kase.given));
    const answer = await host.send(kase.when.intent, structuredClone(kase.when.payload));
    for (const [key, value] of Object.entries(answer.data ?? {})) assert.ok(data[key]?.(value), `${kase.id}: data.${key} ${JSON.stringify(data[key]?.errors)}`);
    for (const document of Object.values(answer.data?.values ?? {})) for (const region of regionsOf(document)) assert.equal(region.extensions?.['simai:area'], undefined, `${kase.id}: no mark in a stored value`);
  }
  assert.ok(findRegion(cases[0].given.values.ru, 'main'));
});

test('the port edition pins its kit, the runner included', () => {
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const lines = [];
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      if (entry.isDirectory()) walk(join(directory, entry.name), `${prefix}${entry.name}/`);
      else lines.push(`${prefix}${entry.name} ${sha(readFileSync(join(directory, entry.name)))}\n`);
    }
  };
  walk(join(at, 'kit'));
  lines.sort();
  assert.ok(lines.some((line) => line.startsWith('run.mjs ')));
  assert.equal(sha(lines.join('')), port.conformance.sha256);
});

// ---------------------------------------------------------------------------
// Draft 2: the answer schema, and the kit catching the hosts the review named.

const answerOf = compile(port.answer.schema, 'answer');
const watched = (host, seen) => ({
  setup: (given) => host.setup(given),
  async send(intent, payload) { const answer = await host.send(intent, payload); seen.push([intent, answer]); return answer; },
});

test('every answer of the reference host, after steps included, fits the answer schema', async () => {
  const seen = [];
  await runKit(watched(memoryHost(), seen));
  assert.ok(seen.length > cases.length);
  for (const [intent, answer] of seen) assert.ok(answerOf(answer), `${intent}: ${JSON.stringify(answerOf.errors)} ${JSON.stringify(answer).slice(0, 200)}`);
  assert.equal(answerOf({answer: 'conflict', reason: 'stale-revision', current_revision: '8', current: {revision: '8'}}), false, 'a stale-revision conflict carries current.values');
  assert.equal(answerOf({answer: 'refused', reason: 'area_locked'}), false, 'reasons are hyphenated codes, matched exactly');
  assert.equal(answerOf({answer: 'applied', reason: 'invalid'}), false, 'an applied answer carries no reason');
  assert.ok(answerOf({answer: 'unavailable', reason: 'storage-unavailable', retry_after: 30}));
});

// A host that wraps the reference host and changes what it stores.
function altered(change) {
  const host = memoryHost();
  return {
    setup: (given) => host.setup(given),
    send: (intent, payload) => host.send(intent, intent === 'document.save' ? change(structuredClone(payload)) : payload),
  };
}
const failing = async (adapter, ids) => (await runKit(adapter, {only: ids})).results.filter((one) => !one.ok).map((one) => one.id);

test('the kit refuses a host that drops what it does not know (M1)', async () => {
  // Validates against its own registry: unknown node types go, unknown props and extensions keys go.
  const known = (node) => {
    if (node.props) node.props = Object.fromEntries(Object.entries(node.props).filter(([key]) => !key.startsWith('x-') && key !== 'cover'));
    delete node.extensions; delete node.bindings; delete node.presentation;
    for (const [slot, list] of Object.entries(node.slots ?? {})) node.slots[slot] = list.filter((child) => !child.type.startsWith('vendor.')).map(known);
    return node;
  };
  const lossy = altered((payload) => { for (const document of Object.values(payload.values)) if (document) known(document.root); return payload; });
  assert.deepEqual(await failing(lossy, ['save-keeps-unknown-content-through-load-history-and-restore']), ['save-keeps-unknown-content-through-load-history-and-restore']);
});

test('the kit refuses a host that stores a resolved document as replaced areas (M2)', async () => {
  // Strips the marks and stores every region: inherited areas silently become replaced.
  const stripOnly = altered((payload) => {
    for (const document of Object.values(payload.values)) for (const region of regionsOf(document ?? {})) if (region.extensions?.['simai:area']) region.extensions['simai:area'].state = 'replaced';
    return payload;
  });
  const ids = ['save-of-a-resolved-document-keeps-inherited-areas-inherited', 'save-of-an-edited-inherited-area-is-refused'];
  assert.deepEqual(await failing(stripOnly, ids), ids);
});

test('reasons are matched exactly: a host answering area_locked fails', async () => {
  const host = memoryHost();
  const underscored = {setup: (given) => host.setup(given), async send(intent, payload) { const answer = await host.send(intent, payload); return answer.reason ? {...answer, reason: answer.reason.replaceAll('-', '_')} : answer; }};
  assert.deepEqual(await failing(underscored, ['save-into-a-locked-area-is-refused']), ['save-into-a-locked-area-is-refused']);
});

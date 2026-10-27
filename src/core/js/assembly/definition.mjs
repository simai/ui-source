// An assembly's manifest compiled once per tag (standard simai.smart-component
// 1.3.8 §7, §9): its keys with their one writer and the order of its derived
// keys, its roles and their bindings, its rules indexed by what they hear, its
// layouts and its words. Problems found here are the load-time half of gates 4
// and 5: they are reported, and what they touch does not run.
//
// The interfaces of the parts are kept in one registry on the shared global:
// a part's interface is what the runtime checks a role against, wires and
// asks, whatever class the element is (§4).

import {keysOf} from './logic.mjs';
import {camel, clone, fits, isObject, own, typeOf} from './values.mjs';
import {createWords} from './words.mjs';

const REGISTRY = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfAssemblyInterfaces';
  if (!root[key]) root[key] = {parts: new Map(), traits: new Map(), assemblies: new Map()};
  return root[key];
})();

const PARTS = ['settings', 'values', 'events', 'actions'];

/** An interface in one shape: `{tag, version, settings, values, events, actions, port, implements, layer}`. */
export function normaliseInterface(tag, source = {}) {
  const iface = {tag, version: source.version ?? null, port: source.port ?? null, layer: source.layer ?? null,
    implements: [...(source.implements ?? [])], traits: [...(source.traits ?? [])], words: [...(source.words ?? [])]};
  for (const part of PARTS) iface[part] = Object.fromEntries(own(source[part]));
  // A part's word settings are listed apart, by name (§15.1): they are string settings all the same (§7.2).
  for (const name of iface.words) if (!(name in iface.settings)) iface.settings[name] = {type: 'string', word: true};
  for (const trait of iface.traits) {
    const brought = REGISTRY.traits.get(trait);
    if (!brought) continue;
    for (const part of PARTS) for (const [name, def] of own(brought[part])) if (!(name in iface[part])) iface[part][name] = def;
  }
  return iface;
}

export const interfaces = {
  /** Register a part's interface: its manifest, or the registry entry the build writes (§4). */
  register(tag, source) {
    const name = String(tag).toLowerCase();
    REGISTRY.parts.set(name, normaliseInterface(name, source));
    return this;
  },
  registerAll(map = {}) {
    for (const [tag, source] of own(map)) this.register(tag, source);
    return this;
  },
  /** Register a trait's interface slice, `<name>@<major>` (§20). */
  registerTrait(name, source) {
    REGISTRY.traits.set(String(name), source);
    return this;
  },
  /** The interface of a tag: registered, declared by its class, or an assembly's own (§7.4). */
  of(tag) {
    const name = String(tag).toLowerCase();
    if (REGISTRY.parts.has(name)) return REGISTRY.parts.get(name);
    if (REGISTRY.assemblies.has(name)) return REGISTRY.assemblies.get(name);
    const declared = globalThis.customElements?.get?.(name)?.sfInterface;
    if (declared) {
      const iface = normaliseInterface(name, declared);
      REGISTRY.parts.set(name, iface);
      return iface;
    }
    return null;
  },
  has(tag) { return Boolean(this.of(tag)); },
  forget(tag) {
    if (tag) REGISTRY.parts.delete(String(tag).toLowerCase());
    else REGISTRY.parts.clear();
    return this;
  },
};

/** A trigger `<head>.<rest>`: `outside.x`, `data.x` or `<role>.<event>`. */
export function splitTrigger(on) {
  const text = String(on);
  const dot = text.indexOf('.');
  return dot < 0 ? [text, ''] : [text.slice(0, dot), text.slice(dot + 1)];
}

const triggersOf = (rule) => (Array.isArray(rule.on) ? rule.on : [rule.on]).filter((on) => typeof on === 'string');

/** Every `from` reading of a rule, first field only: what its triggers must carry (§9, gate 5). */
function fromFields(node, into = new Set()) {
  if (Array.isArray(node)) { for (const one of node) fromFields(one, into); return into; }
  if (!isObject(node)) return into;
  if (typeof node.from === 'string') into.add(node.from.split('.')[0]);
  for (const [field, inner] of Object.entries(node)) if (field !== 'value' && typeof inner === 'object') fromFields(inner, into);
  return into;
}

function bindingOf(left, target) {
  const [side, ...rest] = String(left).split('.');
  const member = rest.join('.');
  const key = isObject(target) ? target.key : target;
  const debounce = isObject(target) ? Number(target.debounce) || 0 : 0;
  if (typeof key !== 'string') return null;
  if (key.startsWith('entry.')) return {side, member, entryField: key.slice(6), debounce};
  return {side, member, key, debounce};
}

const flagKey = (flag) => (typeof flag === 'string' ? flag.replace(/^!/, '') : null);

/**
 * Compile a manifest. `options.layouts` maps a layout name to its HTML,
 * `options.lang` a locale to its language file.
 */
export function compile(manifest, options = {}) {
  const problems = [];
  const notes = [];
  const problem = (section, text, data = {}) => problems.push({section, text, ...data});
  const slots = new Map(own(manifest.slots));
  const tag = String(manifest?.tag ?? '').toLowerCase();
  if (!tag.includes('-')) throw new TypeError(`an assembly needs a custom element tag, got "${manifest?.tag}"`);

  // Keys (§7.1), with what form.aggregates adds (§17.4).
  const keys = new Map(own(manifest.keys).map(([name, def]) => [name, {...def}]));
  if (manifest.form?.aggregates === true) {
    if (!keys.has('valid')) keys.set('valid', {type: 'boolean', writer: 'derived', aggregate: 'valid'});
    if (!keys.has('value')) keys.set('value', {type: 'object', writer: 'derived', aggregate: 'value'});
  }
  const roles = new Map(own(manifest.roles));
  for (const [name, def] of keys) {
    if (!def.writer) problem('§7.1', `key "${name}" has no writer`);
    else if (!['parent', 'logic', 'derived'].includes(def.writer) && !roles.has(def.writer)) problem('§7.1', `key "${name}" is written by "${def.writer}", which is not a role`);
    if (def.writer === 'logic' && !('initial' in def)) problem('§7.1', `key "${name}" (writer logic) has no initial value`);
    if (def.writer === 'logic' && 'initial' in def && !fits(def, def.initial)) problem('§7.1', `the initial value of "${name}" is not a ${typeOf(def)}`);
    if (def.writer === 'derived' && !def.from && !def.aggregate) problem('§7.1.2', `derived key "${name}" has no from`);
  }

  // Derived keys in the order they are computed; a cycle fails gate 4 (§7.1.2).
  const deps = new Map();
  for (const [name, def] of keys) if (def.writer === 'derived' && def.from) deps.set(name, [...keysOf(def.from)].filter((key) => keys.has(key)));
  const order = [];
  const state = new Map();
  const cycle = new Set();
  const visit = (name, trail) => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'busy') { for (const one of trail.slice(trail.indexOf(name))) cycle.add(one); return; }
    state.set(name, 'busy');
    for (const dep of deps.get(name) ?? []) if (deps.has(dep)) visit(dep, [...trail, name]);
    state.set(name, 'done');
    order.push(name);
  };
  for (const name of deps.keys()) visit(name, []);
  if (cycle.size) problem('§7.1.2', `derived keys form a cycle: ${[...cycle].join(' → ')}`, {gate: 4});
  const derived = order.filter((name) => !cycle.has(name));
  const dependents = new Map(); // key → derived keys reading it, in computing order
  for (const name of derived) for (const dep of deps.get(name)) {
    if (!dependents.has(dep)) dependents.set(dep, []);
    dependents.get(dep).push(name);
  }
  const aggregates = [...keys].filter(([, def]) => def.writer === 'derived' && def.aggregate).map(([name, def]) => [name, def.aggregate]);

  // Roles and bindings (§7.2).
  const compiledRoles = new Map();
  const readers = new Map(); // key → [{role, member, debounce}]
  for (const [name, def] of roles) {
    const [partTag, major] = String(def.part ?? '').split('@');
    const role = {name, def, tag: partTag.toLowerCase(), major: major ? Number(major) : null, accepts: def.accepts ?? null,
      each: def.each ?? null, start: def.start ?? 'now', if: def.if ?? null, hidden: def.hidden ?? null,
      constants: Object.fromEntries(own(def.settings)), binds: [], entryBinds: [], valueBinds: new Map()};
    if (!role.tag) problem('§7.2', `role "${name}" names no part`);
    if (!['now', 'visible', 'opened'].includes(role.start)) problem('§7.2.1', `role "${name}" has start "${role.start}"`);
    if (role.each) {
      const list = keys.get(role.each);
      if (!list) problem('§7.2.3', `role "${name}" repeats per "${role.each}", which is not a key`);
      else if (typeOf(list) !== 'list') problem('§7.2.3', `role "${name}" repeats per "${role.each}", which is not a list`);
    }
    for (const flag of [role.if, role.hidden]) {
      const key = flagKey(flag);
      if (key && typeOf(keys.get(key)) !== 'boolean') problem('§7.2.2', `role "${name}" reads "${flag}", which is not a boolean key`);
    }
    for (const [left, target] of own(def.bind)) {
      const binding = bindingOf(left, target);
      if (!binding || !['settings', 'values'].includes(binding.side)) { problem('§7.2', `role "${name}": "${left}" is not a binding`); continue; }
      if (binding.entryField !== undefined) {
        if (binding.side !== 'settings' || !role.each) problem('§7.2.3', `role "${name}": "${left}" reads an entry, but the role is not per entry`);
        else role.entryBinds.push(binding);
        continue;
      }
      if (!keys.has(binding.key)) { problem('§7.2', `role "${name}" binds "${left}" to "${binding.key}", which is not a key`); continue; }
      if (binding.side === 'values') {
        const owner = keys.get(binding.key).writer;
        if (owner !== name) problem('§7.1', `role "${name}" writes "${binding.key}", whose writer is ${owner}`);
        role.valueBinds.set(binding.member, binding.key);
        continue;
      }
      role.binds.push(binding);
      if (!readers.has(binding.key)) readers.set(binding.key, []);
      readers.get(binding.key).push({role: name, member: binding.member, debounce: binding.debounce});
    }
    compiledRoles.set(name, role);
  }

  // Rules (§9), indexed by what they hear; a rule hears each trigger once.
  const rules = [];
  const byTrigger = new Map();
  const ids = new Set();
  for (const rule of Array.isArray(manifest.rules) ? manifest.rules : []) {
    if (!rule || typeof rule !== 'object') continue;
    if (!rule.id) problem('§9', 'a rule has no id');
    else if (ids.has(rule.id)) problem('§9', `two rules have the id "${rule.id}"`);
    ids.add(rule.id);
    const triggers = triggersOf(rule);
    if (!triggers.length) problem('§9', `rule "${rule.id}" hears nothing`);
    if (new Set(triggers).size !== triggers.length) problem('§9', `rule "${rule.id}" names a trigger twice`);
    if (rule.concurrency === 'latest' && ruleWrites(rule)) problem('§10.7', `rule "${rule.id}" waits on a write and may not be latest`, {gate: 5});
    const compiled = {...rule, triggers, reads: fromFields([rule.if, rule.steps, rule.otherwise])};
    rules.push(compiled);
    for (const on of new Set(triggers)) {
      const [head, rest] = splitTrigger(on);
      if (head === 'outside') {
        if (!(rest in (manifest.actions ?? {})) && keys.get(rest)?.writer !== 'parent') problem('§9', `rule "${rule.id}" hears ${on}: not an action or a setting of the assembly`, {gate: 5});
      } else if (head === 'data') {
        if (!keys.has(rest)) problem('§9', `rule "${rule.id}" hears ${on}: not a key`, {gate: 5});
        else if (keys.get(rest).writer === 'parent') problem('§9', `rule "${rule.id}" hears ${on}: a parent's key is heard as outside.${rest}`, {gate: 5});
      } else if (slots.get(head)?.accepts) {
        notes.push({section: '§4.5.1', text: `rule "${rule.id}" hears ${on}: a part in slot "${head}" is not wired by this runtime`});
      } else if (!compiledRoles.has(head)) problem('§9', `rule "${rule.id}" hears ${on}: "${head}" is not a role`, {gate: 5});
      if (!byTrigger.has(on)) byTrigger.set(on, []);
      byTrigger.get(on).push(compiled);
    }
  }

  // The assembly's own interface (§7.4): what a parent sees.
  const values = own(manifest.values).map(([name, def]) => [name, def.value]);
  for (const [name, key] of values) if (!keys.has(key)) problem('§7.4', `value "${name}" names "${key}", which is not a key`);
  for (const [name] of own(manifest.settings)) if (keys.get(name)?.writer !== 'parent') problem('§7.4', `setting "${name}" has no key with writer parent`);
  const iface = normaliseInterface(tag, {...manifest, events: manifest.events, actions: manifest.actions});
  REGISTRY.assemblies.set(tag, iface);

  return {
    tag, manifest, problems, notes, keys, derived, dependents, aggregates, roles: compiledRoles, readers, rules, byTrigger, values, iface,
    layouts: {...(options.layouts ?? {})},
    words: createWords(options.lang ?? {}, options.sourceLocale ?? null),
    persisted: [...keys].filter(([, def]) => def.persist).map(([name, def]) => [name, def.persist]),
    settingProps: own(manifest.settings).map(([name, def]) => ({name, def, prop: camel(name)})),
    initial(name) { return clone(keys.get(name)?.initial ?? null); },
  };
}

/** Whether a rule waits on a write (vocabulary §5.3): such a rule is never `latest` (§10.7). */
export function ruleWrites(rule) {
  const writes = new Set(['save', 'delete', 'create', 'rename', 'archive', 'restore', 'move', 'apply', 'submit', 'retry', 'attach', 'detach', 'answer', 'rate', 'read']);
  return [...(rule.steps ?? []), ...(rule.otherwise ?? [])].some((step) => typeof step?.do === 'string' && writes.has(step.do.split('.').pop()));
}

/**
 * Check a role against the interface of the part placed in it (§7.2, §4.10
 * gate 5 at load). Answers `null` when it fits, else `{reason, text}` with a
 * reason of §4.5.1.
 */
export function checkRole(definition, role, iface) {
  if (!iface) return {reason: 'no-interface', text: `${role.tag} has no interface registered`};
  const major = (version) => (version ? Number(String(version).split('.')[0]) : null);
  if (role.major !== null && iface.version && major(iface.version) !== role.major) {
    return {reason: 'major-mismatch', text: `role "${role.name}" asks ${role.tag}@${role.major}, the part is ${iface.version}`};
  }
  if (role.accepts) {
    const [name, wanted] = String(role.accepts).split('@');
    const offered = iface.implements.find((one) => one.split('@')[0] === name);
    if (!offered) return {reason: iface.implements.length ? 'other-interface' : 'no-interface', text: `${role.tag} does not implement ${role.accepts}`};
    if (offered.split('@')[1] !== wanted) return {reason: 'major-mismatch', text: `${role.tag} implements ${offered}, the role asks ${role.accepts}`};
  }
  for (const binding of [...role.binds, ...role.entryBinds]) {
    if (!(binding.member in iface.settings) && !(binding.member in iface.values)) return {reason: 'missing-setting', text: `${role.tag} has no setting "${binding.member}" (role "${role.name}")`};
  }
  for (const member of role.valueBinds.keys()) {
    if (!(member in iface.values)) return {reason: 'missing-setting', text: `${role.tag} has no value "${member}" (role "${role.name}")`};
  }
  for (const [name, value] of Object.entries(role.constants)) {
    const def = iface.settings[name] ?? iface.values[name];
    if (!def) return {reason: 'missing-setting', text: `${role.tag} has no setting "${name}" (role "${role.name}", a constant)`};
    if (!fits(def, value)) return {reason: 'carries-mismatch', text: `the constant ${name} of role "${role.name}" is not a ${typeOf(def)}`};
  }
  for (const rule of definition.rules) {
    const heard = rule.triggers.filter((on) => splitTrigger(on)[0] === role.name);
    for (const on of heard) {
      const event = iface.events[splitTrigger(on)[1]];
      if (!event) return {reason: 'missing-event', text: `rule "${rule.id}" hears ${on}, but ${role.tag} has no event "${splitTrigger(on)[1]}"`};
      if (event.carries === 'native' || !rule.reads.size) continue;
      const carries = isObject(event.carries) ? event.carries : {};
      for (const field of rule.reads) {
        if (!(field in carries)) return {reason: 'carries-mismatch', text: `rule "${rule.id}" reads "${field}" from ${on}, which does not carry it`};
      }
    }
  }
  return null;
}

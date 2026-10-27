// The bus of one assembly instance (standard simai.smart-component 1.3.8 §7,
// §9, §10): keys with one writer, derived keys, parts in roles and their
// bindings, rules and turns. It knows nothing of the DOM: what it needs of the
// page — a part's element, a layout, the address — it asks of its view
// (host.mjs on a page; a plain object in tests and in Node).
//
// A part joins through a link (link.mjs): set a setting, read a value, ask an
// action, hand a port, start, dispose. The part answers through its context:
// report its values, emit its events, say its words. A nested assembly is a
// part like any other: its frame is its parent's context.

import {checkRole, interfaces, splitTrigger} from './definition.mjs';
import {assemblyLink} from './link.mjs';
import {journalOn, record} from './journal.mjs';
import {createReader} from './logic.mjs';
import {say} from './words.mjs';
import {BASE_ACTIONS, CAUSE_CHAIN_DEPTH, WRITE_VERBS, clone, fits, isObject, outcomeOf, own, same, show, typeOf} from './values.mjs';

const ACTIVITY = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfAssemblyActivity';
  if (!root[key]) root[key] = {turns: 0, waiting: 0, timers: 0, seq: 0, idle: new Set()};
  return root[key];
})();

/** What the buses of the page are doing: turns running, steps waiting, debounce timers pending. */
export const activity = () => ({turns: ACTIVITY.turns, waiting: ACTIVITY.waiting, timers: ACTIVITY.timers});

const settleIdle = () => {
  if (ACTIVITY.turns || ACTIVITY.waiting || ACTIVITY.timers) return;
  for (const resolve of [...ACTIVITY.idle]) resolve(true);
  ACTIVITY.idle.clear();
};
const count = (field, by) => {
  ACTIVITY[field] += by;
  if (by < 0) settleIdle();
};

/** A promise that settles when no bus has a turn, a wait or a timer (tests, probes, the Studio). */
export function whenIdle() {
  if (!ACTIVITY.turns && !ACTIVITY.waiting && !ACTIVITY.timers) return Promise.resolve(true);
  return new Promise((resolve) => ACTIVITY.idle.add(resolve));
}

const thenable = (value) => value !== null && typeof value === 'object' && typeof value.then === 'function';
const then = (value, next) => (thenable(value) ? value.then(next) : next(value));
const STREAM_FACTS = new Set(['begun', 'chunk', 'completed', 'failed', 'cancelled']);
const STREAM_ENDS = new Set(['completed', 'failed', 'cancelled']);

/** A controller aborted with any of the given signals, and on its own. */
function linked(...signals) {
  const controller = new globalThis.AbortController();
  const parents = signals.filter(Boolean);
  for (const parent of parents) if (parent.aborted) { controller.abort(parent.reason); return {controller, signal: controller.signal}; }
  if (typeof globalThis.AbortSignal.any === 'function') return {controller, signal: globalThis.AbortSignal.any([controller.signal, ...parents])};
  const abort = (event) => controller.abort(event?.target?.reason);
  for (const parent of parents) parent.addEventListener('abort', abort, {once: true, signal: controller.signal});
  return {controller, signal: controller.signal};
}

/** An answer, raced against an abort (cancelled) and a timeout (unavailable, reason timeout) (§10.3, §10.7). */
function race(promise, signal, timeout, onLate) {
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = (outcome) => {
      if (done) return;
      done = true;
      if (timer) globalThis.clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      resolve(outcome);
    };
    const aborted = () => finish({answer: 'cancelled', reason: String(signal.reason?.message ?? signal.reason ?? 'aborted')});
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener('abort', aborted, {once: true});
    if (timeout > 0) timer = globalThis.setTimeout(() => finish({answer: 'unavailable', reason: 'timeout', message: ''}), timeout);
    Promise.resolve(promise).then(
      (value) => { if (done) onLate?.(outcomeOf(value)); else finish(outcomeOf(value)); },
      (error) => { if (done) onLate?.({answer: 'refused', reason: 'error'}); else finish({answer: 'refused', reason: 'error', message: String(error?.message ?? error)}); },
    );
  });
}

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal.aborted) { resolve(false); return; }
  const timer = globalThis.setTimeout(() => { signal.removeEventListener('abort', stop); resolve(true); }, ms);
  const stop = () => { globalThis.clearTimeout(timer); resolve(false); };
  signal.addEventListener('abort', stop, {once: true});
});

/**
 * A view that has no page (Node, tests, a worker): a leaf's link comes from
 * `createLink(rec, context)`; a nested assembly whose definition is in
 * `definitions` runs as a headless bus of its own.
 */
export function headlessView({createLink = null, definitions = null, locale = 'en'} = {}) {
  const view = {
    interfaceOf: (tag) => interfaces.of(tag),
    isAssembly: (tag) => Boolean(definitions?.has(tag)),
    roleFlags: () => [],
    locale: () => locale,
    createPart(rec, context) {
      const child = definitions?.get(rec.def.tag);
      if (!child) return createLink?.(rec, context) ?? null;
      const core = new AssemblyCore(child, {
        instanceId: rec.instanceId, signal: context.signal, view: headlessView({createLink, definitions, locale}),
        frame: {report: (values) => context.report(values), emit: (verb, detail, options) => context.emit(verb, detail, options)},
      });
      rec.child = core;
      return assemblyLink(core);
    },
  };
  return view;
}

export class AssemblyCore {
  /**
   * @param definition compiled manifest (definition.mjs)
   * @param options.instanceId  the instance's role path (§7.1.1)
   * @param options.frame       what is outside: `report(values, {origin})`, `emit(verb, detail, {chain})`
   * @param options.view        the page side (host.mjs) or headlessView()
   * @param options.signal      the scope of the parent, if any (§7.7)
   * @param options.settings    the first values of the settings (writer parent)
   */
  constructor(definition, options = {}) {
    this.def = definition;
    this.id = options.instanceId ?? `page/${definition.tag}`;
    this.frame = options.frame ?? {report() {}, emit() {}};
    this.view = options.view ?? headlessView({createLink: options.createLink, definitions: options.definitions});
    this.chainLimit = options.chainLimit ?? CAUSE_CHAIN_DEPTH;
    this.scope = linked(options.signal);
    this.keys = Object.create(null);
    this.out = Object.create(null);
    this.roles = new Map(); // role → {role, parts: Map(entry id | '' → rec), flags: [...]}
    this.ports = new Map();
    this.runs = new Map(); // rule id → {active: Set(run), tail}
    this.calls = new Map(); // outside action → {active: Set, tail}
    this.turns = 0;
    this.waiting = 0;
    this.running = false;
    this.disposed = false;
    this.initialSettings = options.settings ?? {};
  }

  // ---------- the journal and errors ----------
  log(kind, text, data, level) { return record(this.id, kind, text, data, level); }
  error(kind, text, data = {}) {
    record(this.id, kind, text, data, 'error');
    this.view.error?.(kind, text, data);
  }

  // ---------- start (§7, §7.2.1) ----------
  start() {
    if (this.running || this.disposed) return this;
    this.running = true;
    for (const problem of this.def.problems) this.error('definition', `${problem.section}: ${problem.text}`, problem);
    for (const note of this.def.notes ?? []) this.log('warn', `${note.section}: ${note.text}`, note, 'warn');
    for (const [name, def] of this.def.keys) {
      if (def.writer === 'logic') this.keys[name] = this.def.initial(name);
      else if (def.writer === 'parent') {
        const given = this.initialSettings[name];
        const value = given !== undefined ? given : clone(this.def.manifest.settings?.[name]?.default ?? null);
        this.keys[name] = fits(def, value) ? value : null;
        if (!fits(def, value)) this.error('type', `setting "${name}" (${typeOf(def)}) refused ${show(value)}`);
      } else this.keys[name] = null;
    }
    this.view.build?.(this);
    for (const [name, value] of this.view.restore?.(this.def.persisted) ?? []) {
      if (fits(this.def.keys.get(name), value)) this.keys[name] = value;
    }
    for (const [name, role] of this.def.roles) {
      this.roles.set(name, {role, parts: new Map(), flags: [role.if, ...(this.view.roleFlags?.(name) ?? [])].filter(Boolean)});
    }
    this.computeDerived(null);
    this.computeAggregates();
    this.log('start', `${this.def.tag} starts as ${this.id}`, {tag: this.def.tag});
    for (const [name, state] of this.roles) {
      if (state.role.each) this.syncEach(name);
      else this.placePart(state, null);
    }
    this.syncShown(null);
    this.computeAggregates();
    const first = {};
    for (const [name, key] of this.def.values) {
      this.out[name] = this.keys[key];
      if (this.keys[key] !== null) first[name] = this.keys[key];
    }
    if (Object.keys(first).length) this.frame.report(first, {origin: 'start'});
    this.view.started?.(this);
    return this;
  }

  // ---------- parts (§7.2) ----------
  placePart(state, entry) {
    const {role} = state;
    const entryId = entry ? String(entry.id) : '';
    const instanceId = `${this.id}/${role.name}${entry ? `[${entryId}]` : ''}`;
    const iface = this.view.interfaceOf?.(role.tag) ?? null;
    const refusal = checkRole(this.def, role, iface);
    if (refusal) {
      this.error('refused', `role "${role.name}" refuses its part: ${refusal.text}`, {role: role.name, reason: refusal.reason});
      this.view.refuse?.(role.name, refusal.reason, refusal.text);
      return null;
    }
    const scope = linked(this.scope.signal);
    const rec = {
      role: role.name, def: role, entry, entryId, instanceId, iface, scope, link: null,
      started: false, closed: false, passed: new Map(), pending: new Map(), timers: new Map(),
      calls: new Map(), causes: [], streams: new Map(), isAssembly: Boolean(this.view.isAssembly?.(role.tag)),
    };
    const core = this;
    rec.context = {
      get instanceId() { return rec.instanceId; },
      role: role.name,
      get entry() { return rec.entry; },
      signal: scope.signal,
      iface,
      get started() { return rec.started; },
      report: (values, options) => core.reportFromPart(rec, values, options),
      emit: (verb, detail, options) => core.emitFromPart(rec, verb, detail, options),
      word: (path, n) => core.word(rec, path, n),
      journal: (kind, text, data, level) => record(rec.instanceId, kind, text, data, level),
      id: (local) => `${rec.instanceId.replace(/\W+/g, '-')}--${local}`,
    };
    rec.link = this.view.createPart(rec, rec.context);
    if (!rec.link) {
      this.error('part', `role "${role.name}": part ${role.tag} could not be placed`, {role: role.name});
      scope.controller.abort('not placed');
      return null;
    }
    state.parts.set(entryId, rec);
    if (entry) this.log('entry', `${role.name}[${entryId}] placed`, {role: role.name, entry: entryId});
    if (role.start === 'now') this.startPart(rec, 'now');
    else this.view.awaitStart?.(rec, role.start);
    return rec;
  }

  /** The assembly starts a part, never the part itself (§7.2.1). */
  startPart(rec, why = 'now') {
    if (rec.started || this.disposed || rec.scope.signal.aborted) return;
    rec.started = true;
    record(rec.instanceId, 'start', `${rec.instanceId} starts${why !== 'now' ? ` (${why})` : ''}`, {role: rec.role, mode: rec.def.start, why});
    this.view.startPart?.(rec);
    rec.pending.clear(); // superseded: the part reads the current values now
    this.pushAll(rec);
    for (const port of this.ports.values()) if (rec.isAssembly || rec.iface.port?.id === port.id) rec.link.connectPort?.(port);
    rec.link.start?.();
  }

  /** Everything a part reads: its constants, its words, its entry and its keys. */
  pushAll(rec) {
    const {def: role} = rec;
    for (const [name, value] of Object.entries(role.constants)) this.pushSetting(rec, name, this.withListWords(rec, name, value));
    for (const [name, value] of this.wordSettings(rec)) this.pushSetting(rec, name, value);
    for (const binding of role.entryBinds) this.pushSetting(rec, binding.member, rec.entry?.[binding.entryField] ?? null);
    for (const binding of role.binds) {
      if (this.keys[binding.key] === null) continue; // unset is not passed to a new part
      this.pushSetting(rec, binding.member, this.keys[binding.key]);
    }
  }

  /** The constant word settings of a role from the language file: `roles.<role>.settings.<setting>` (§7.2, §11). */
  wordSettings(rec) {
    const out = [];
    const locale = this.view.locale?.(rec) ?? 'en';
    const settings = this.def.words.find(locale, `roles.${rec.role}.settings`).word;
    if (!isObject(settings)) return out;
    for (const [name, word] of Object.entries(settings)) {
      if (!(name in rec.iface.settings)) continue; // a word the part does not take: the part asks it by word()
      if (typeof word === 'string') out.push([name, word]);
    }
    return out;
  }

  /** The words of a constant list's entries: `roles.<role>.items.<value>`, `roles.<role>.columns.<key>` (§11.3). */
  withListWords(rec, name, value) {
    if (!Array.isArray(value) || !value.some(isObject)) return value;
    const locale = this.view.locale?.(rec) ?? 'en';
    const field = rec.iface.settings[name]?.of?.text !== undefined && rec.iface.settings[name]?.of?.label === undefined ? 'text' : 'label';
    const columns = name === 'columns';
    return value.map((entry) => {
      if (!isObject(entry) || entry[field] !== undefined) return entry;
      const id = columns ? entry.key : (entry.value ?? entry.id);
      if (id === undefined) return entry;
      const word = this.def.words.text(locale, `roles.${rec.role}.${columns ? 'columns' : 'items'}.${id}`);
      return word === null ? entry : {...entry, [field]: word};
    });
  }

  /** The language changed: constant words are given again (§11.1). */
  relanguage() {
    for (const state of this.roles.values()) for (const rec of state.parts.values()) {
      if (!rec.started) continue;
      for (const [name, value] of Object.entries(rec.def.constants)) this.pushSetting(rec, name, this.withListWords(rec, name, value));
      for (const [name, value] of this.wordSettings(rec)) this.pushSetting(rec, name, value);
    }
  }

  /** A setting carried to a part (§7.2): checked, debounced, deferred, and never passed twice. */
  pushSetting(rec, member, value, debounce = 0) {
    if (rec.scope.signal.aborted) return;
    if (debounce > 0) {
      if (rec.timers.has(member)) { globalThis.clearTimeout(rec.timers.get(member)); count('timers', -1); }
      count('timers', 1);
      rec.timers.set(member, globalThis.setTimeout(() => {
        rec.timers.delete(member);
        count('timers', -1);
        this.pushSetting(rec, member, value, 0);
      }, debounce));
      return;
    }
    const def = rec.iface.settings[member] ?? rec.iface.values[member];
    if (!fits(def, value)) { this.error('type', `${rec.instanceId}: setting "${member}" (${typeOf(def)}) refused ${show(value)}`, {role: rec.role}); return; }
    if (!rec.started || rec.closed) { // §7.2.1: not started yet, or its container is closed: one read when it opens
      if (rec.started && (!rec.passed.has(member) || !same(rec.passed.get(member), value))) {
        rec.pending.set(member, value);
        this.view.busy?.(rec, true);
      } else if (!rec.started) rec.pending.set(member, value);
      else rec.pending.delete(member);
      return;
    }
    if (rec.passed.has(member) && same(rec.passed.get(member), value)) return;
    rec.passed.set(member, value);
    rec.link.set(member, value);
    return true;
  }

  /** A started part's container closed or opened again (§7.2.1): reads wait until it opens. */
  setClosed(rec, closed) {
    if (rec.closed === closed) return;
    rec.closed = closed;
    if (closed || !rec.started) {
      if (closed) this.log('defer', `${rec.instanceId}: its container closed; the reads its bindings cause wait`, {role: rec.role});
      return;
    }
    const pending = [...rec.pending];
    rec.pending.clear();
    if (pending.length) this.log('defer', `${rec.instanceId}: its container opened; one read with ${pending.map(([name]) => name).join(', ')}`, {role: rec.role});
    for (const [member, value] of pending) this.pushSetting(rec, member, value);
    this.view.busy?.(rec, false);
  }

  /** Keys read back from where they persist (the address after Back, §7.5): one turn of writes. */
  restore(values) {
    const turn = this.newTurn('persist', {}, {fromAddress: true});
    for (const [name, value] of values) {
      const def = this.def.keys.get(name);
      if (def && (def.writer === 'logic' || def.writer === 'parent')) turn.writes.set(name, {value, writer: def.writer});
    }
    this.log('turn', `turn ${turn.n} · the address changed: ${[...turn.writes.keys()].join(', ') || 'nothing'}`, {turn: turn.n, on: 'persist'});
    return this.endTurn(turn);
  }

  partsOf(name) { return [...(this.roles.get(name)?.parts.values() ?? [])]; }

  /** A key read as a flag, `<key>` or `!<key>` (§7.2.2). */
  flag(name) {
    const negate = name.startsWith('!');
    const value = this.keys[name.slice(negate ? 1 : 0)] === true;
    return negate ? !value : value;
  }
  present(name) {
    const state = this.roles.get(name);
    return !state || state.flags.every((flag) => this.flag(flag));
  }
  hidden(name) {
    const hidden = this.roles.get(name)?.role.hidden;
    return typeof hidden === 'string' ? this.flag(hidden) : false;
  }

  /** `if` and `hidden` of every role reading a changed key (§7.2.2). */
  syncShown(changed) {
    for (const [name, state] of this.roles) {
      const flags = [...state.flags, state.role.hidden].filter(Boolean).map((flag) => flag.replace(/^!/, ''));
      if (!flags.length || (changed && !flags.some((key) => changed.has(key)))) continue;
      const present = this.present(name);
      const hidden = this.hidden(name);
      if (state.shownAs && state.shownAs.present === present && state.shownAs.hidden === hidden) continue;
      if (state.shownAs) this.log('shown', `${name} ${!present ? 'leaves the DOM, the form value and the validity' : hidden ? 'is hidden, its controls disabled' : 'is shown'}`, {role: name, present, hidden});
      state.shownAs = {present, hidden};
      this.view.show?.(name, present, hidden);
    }
  }

  /** A role per entry: one part per entry, kept by id, in entry order (§7.2.3). */
  syncEach(name) {
    const state = this.roles.get(name);
    const list = Array.isArray(this.keys[state.role.each]) ? this.keys[state.role.each] : [];
    const seen = new Set();
    const ordered = [];
    for (const entry of list) {
      if (!isObject(entry) || entry.id === undefined || entry.id === null) { this.error('each', `an entry of ${state.role.each} has no id`, {role: name}); continue; }
      const id = String(entry.id);
      if (seen.has(id)) { this.error('each', `two entries of ${state.role.each} have the id ${id}`, {role: name}); continue; }
      seen.add(id);
      let rec = state.parts.get(id);
      if (!rec) rec = this.placePart(state, entry);
      else if (!same(rec.entry, entry)) {
        rec.entry = entry;
        for (const binding of rec.def.entryBinds) this.pushSetting(rec, binding.member, entry[binding.entryField] ?? null);
      }
      if (rec) ordered.push(rec);
    }
    for (const [id, rec] of state.parts) if (!seen.has(id)) {
      state.parts.delete(id);
      this.disposePart(rec);
      this.log('entry', `${name}[${id}] removed; its scope ends`, {role: name, entry: id});
    }
    this.view.order?.(name, ordered);
  }

  disposePart(rec) {
    for (const [id, state] of rec.streams) if (state === 'open') this.log('stream', `${rec.instanceId}: stream ${id} ends cancelled with its scope`, {role: rec.role});
    for (const timer of rec.timers.values()) { globalThis.clearTimeout(timer); count('timers', -1); }
    rec.timers.clear();
    rec.scope.controller.abort('removed');
    try { rec.link.dispose?.(); } catch (error) { this.error('part', `${rec.instanceId}: dispose failed: ${error?.message ?? error}`); }
    this.view.removePart?.(rec);
  }

  // ---------- derived keys and aggregates (§7.1.2, §17.4) ----------
  computeDerived(dirty) {
    const changed = [];
    if (!this.def.derived.length) return changed;
    const reader = createReader({key: (name) => this.keys[name], from: {}, fail: (text) => this.error('reading', text)});
    const due = dirty ? new Set() : null;
    if (dirty) for (const key of dirty) for (const name of this.def.dependents.get(key) ?? []) due.add(name);
    for (const name of this.def.derived) {
      if (due && !due.has(name)) continue;
      const def = this.def.keys.get(name);
      const value = reader.read(def.from) ?? null;
      if (!fits(def, value)) { this.error('type', `derived "${name}" (${typeOf(def)}) computed ${show(value)}`); continue; }
      if (same(this.keys[name], value)) continue;
      changed.push([name, this.keys[name]]);
      this.keys[name] = value;
      if (due) for (const next of this.def.dependents.get(name) ?? []) due.add(next);
    }
    return changed;
  }

  computeAggregates() {
    const changed = [];
    if (!this.def.aggregates.length) return changed;
    const value = {};
    let valid = true;
    for (const [name, state] of this.roles) {
      if (!this.present(name) || this.hidden(name)) continue;
      for (const rec of state.parts.values()) {
        const values = rec.iface.values;
        if (!('value' in values) && !('checked' in values)) continue; // not a form control
        if (rec.link.valid?.() === false) valid = false;
        value[rec.entry ? `${name}[${rec.entryId}]` : name] = rec.link.get?.('value' in values ? 'value' : 'checked') ?? null;
      }
    }
    for (const [name, which] of this.def.aggregates) {
      const next = which === 'valid' ? valid : value;
      if (same(this.keys[name], next)) continue;
      changed.push([name, this.keys[name]]);
      this.keys[name] = next;
    }
    return changed;
  }

  // ---------- turns (§10) ----------
  newTurn(on, payload, options = {}) {
    const parent = options.signal ?? this.scope.signal;
    return {
      n: ++ACTIVITY.seq, on, payload: payload ?? {}, chain: options.chain ?? [], entry: options.entry ?? null,
      source: options.source ?? null, writes: new Map((options.preset ?? []).map(([key, value, writer]) => [key, {value, writer}])),
      after: [], refused: null, cancel: options.cancel ?? null, origin: options.origin ?? null, parentSignal: parent, ownScope: null,
      get scope() { return this.ownScope ?? (this.ownScope = linked(this.parentSignal)); },
      fromAddress: Boolean(options.fromAddress),
    };
  }

  /**
   * One turn: one event and every rule hearing it, in list order; the writes
   * apply together at its end (§10.1, §10.2). Runs synchronously until the
   * first step that waits, so a `refuse` reaches a cancelable request in time.
   */
  fire(on, payload = {}, options = {}) {
    if (this.disposed) return Promise.resolve(null);
    const turn = this.newTurn(on, payload, options);
    const rules = this.def.byTrigger.get(on) ?? [];
    this.log('turn', `turn ${turn.n} · ${on}${Object.keys(turn.payload).length ? ` ${show(turn.payload)}` : ''}${rules.length ? '' : ' — no rules'}`, {turn: turn.n, on, chain: turn.chain.length});
    if (turn.chain.length >= this.chainLimit) {
      this.error('cut', `the cause chain is cut at depth ${this.chainLimit} in ${this.id} (§10.5)`, {turn: turn.n, chain: turn.chain});
      return Promise.resolve(turn);
    }
    const [head] = splitTrigger(on);
    if (rules.length && this.roles.has(head) && !this.present(head)) {
      this.log('skip', `${head} is out under if; its rules do not run`, {turn: turn.n});
      return this.endTurn(turn);
    }
    if (this.waiting > 0) this.log('overlap', `turn ${turn.n} starts while ${this.waiting} step(s) of this bus wait`, {turn: turn.n});
    this.turns += 1;
    count('turns', 1);
    let result;
    try {
      result = this.runRules(turn, rules, 0);
    } catch (error) {
      this.error('turn', `turn ${turn.n} failed: ${error?.message ?? error}`);
    }
    const finish = () => {
      this.turns -= 1;
      count('turns', -1);
      return this.endTurn(turn);
    };
    return thenable(result)
      ? result.catch((error) => this.error('turn', `turn ${turn.n} failed: ${error?.message ?? error}`)).then(finish)
      : finish();
  }

  endTurn(turn) {
    this.commit(turn);
    turn.ownScope?.controller.abort('turn ended');
    const after = turn.after.splice(0);
    let chain = null;
    for (const next of after) chain = chain ? chain.then(next) : then(null, next);
    return Promise.resolve(chain).then(() => turn, (error) => { this.error('turn', `after turn ${turn.n}: ${error?.message ?? error}`); return turn; });
  }

  runRules(turn, rules, index) {
    for (let i = index; i < rules.length; i += 1) {
      const result = this.runRule(turn, rules[i]);
      if (thenable(result)) return result.then(() => this.runRules(turn, rules, i + 1));
    }
    return null;
  }

  readerFor(turn, run) {
    return createReader({
      key: (name) => (turn.writes.has(name) ? turn.writes.get(name).value : this.keys[name]),
      from: turn.payload,
      entry: turn.entry,
      get outcome() { return run?.inOtherwise ? run.outcome : null; },
      fail: (text) => this.error('reading', `${run?.rule.id ?? 'rule'}: ${text}`, {turn: turn.n}),
    });
  }

  runRule(turn, rule) {
    const tag = `${this.id}:${rule.id}`;
    if (turn.chain.includes(tag)) { this.error('cut', `${rule.id} already ran for this cause (a loop, §10.5)`, {turn: turn.n, rule: rule.id}); return null; }
    if (turn.chain.length + 1 > this.chainLimit) { this.error('cut', `the cause chain is cut at depth ${this.chainLimit} at ${tag} (§10.5)`, {turn: turn.n, rule: rule.id}); return null; }
    if (rule.if && !this.readerFor(turn, null).test(rule.if)) { this.log('skip', `${rule.id}: if does not hold`, {turn: turn.n, rule: rule.id}); return null; }
    const policy = rule.concurrency ?? 'parallel';
    let state = this.runs.get(rule.id);
    if (!state) { state = {active: new Set(), tail: null}; this.runs.set(rule.id, state); }
    if (state.active.size) {
      if (policy === 'drop') {
        this.log('concurrency', `${rule.id}: dropped while a run waits (drop)`, {turn: turn.n, rule: rule.id, policy});
        if (!turn.refused) { turn.refused = 'busy'; turn.cancel?.('busy'); }
        return null;
      }
      if (policy === 'latest') {
        this.log('concurrency', `${rule.id}: replaces the run that waits (latest); its step answers cancelled`, {turn: turn.n, rule: rule.id, policy});
        for (const earlier of state.active) earlier.scope.controller.abort('latest');
      }
      if (policy === 'queue') this.log('concurrency', `${rule.id}: queued behind the run that waits (queue)`, {turn: turn.n, rule: rule.id, policy});
      if (policy === 'parallel') this.log('concurrency', `${rule.id}: runs beside the run that waits (parallel)`, {turn: turn.n, rule: rule.id, policy});
    }
    const run = {rule, cause: [...turn.chain, tag], scope: linked(turn.scope.signal), waited: false, outcome: null, inOtherwise: false};
    run.read = this.readerFor(turn, run);
    const go = () => {
      this.log('rule', `${rule.id} runs`, {turn: turn.n, rule: rule.id, tag: this.def.tag});
      let result;
      try {
        result = this.runSteps(run, turn, rule.steps ?? [], 0);
      } catch (error) {
        this.error('rule', `${rule.id} failed: ${error?.message ?? error}`, {rule: rule.id});
        result = 'stop';
      }
      return then(result, (ended) => {
        if (ended !== 'fail' || !Array.isArray(rule.otherwise)) return ended;
        run.inOtherwise = true;
        this.log('otherwise', `${rule.id}: otherwise runs (${run.outcome?.answer})`, {turn: turn.n, rule: rule.id, tag: this.def.tag});
        return this.runSteps(run, turn, rule.otherwise, 0);
      });
    };
    const settle = () => { state.active.delete(run); run.scope.controller.abort('run ended'); };
    let result;
    if (state.active.size && policy === 'queue') {
      const before = state.tail;
      result = Promise.resolve(before).then(go);
    } else {
      result = go();
    }
    state.active.add(run);
    if (!thenable(result)) { settle(); return null; }
    const tail = result.catch((error) => this.error('rule', `${rule.id} failed: ${error?.message ?? error}`)).then(settle);
    state.tail = tail;
    return tail;
  }

  runSteps(run, turn, steps, index) {
    for (let i = index; i < steps.length; i += 1) {
      const step = steps[i];
      const result = this.step(run, turn, step);
      if (thenable(result)) {
        return result.then((answer) => {
          this.log('stepped', run.rule.id, {rule: run.rule.id, tag: this.def.tag, step: stepKind(step), otherwise: run.inOtherwise});
          return answer === 'go' ? this.runSteps(run, turn, steps, i + 1) : answer;
        });
      }
      this.log('stepped', run.rule.id, {rule: run.rule.id, tag: this.def.tag, step: stepKind(step), otherwise: run.inOtherwise});
      if (result !== 'go') return result;
    }
    return 'go';
  }

  /** One step: 'go' on, 'stop' (a check failed, cancelled, an error) or 'fail' (otherwise runs) (§9, §10.3). */
  step(run, turn, step) {
    const {rule} = run;
    if (!isObject(step)) { this.error('step', `${rule.id}: ${JSON.stringify(step)} is not a step`); return 'stop'; }
    const read = run.read.read;
    if ('set' in step) return this.writeLogic(turn, step.set, read(step.to), rule, run.cause);
    if ('add' in step) {
      const now = read({key: step.add});
      const by = read(step.by);
      return this.writeLogic(turn, step.add, Number(now ?? 0) + Number(by ?? 0), rule, run.cause);
    }
    if ('reset' in step) return this.writeLogic(turn, step.reset, this.def.initial(step.reset), rule, run.cause);
    if ('append' in step) {
      const list = read({key: step.append});
      const item = read(step.item);
      if (!isObject(item) || item.id === undefined || item.id === null) { this.error('append', `${rule.id}: the appended entry has no id`); return 'stop'; }
      return this.writeLogic(turn, step.append, [...(Array.isArray(list) ? list : []), item], rule, run.cause);
    }
    if ('remove' in step) {
      const list = read({key: step.remove});
      const id = read(step.id);
      return this.writeLogic(turn, step.remove, (Array.isArray(list) ? list : []).filter((one) => String(one?.id) !== String(id)), rule, run.cause);
    }
    if ('emit' in step) return this.emitStep(run, turn, step);
    if ('check' in step) {
      if (run.read.test(step.check)) return 'go';
      this.log('check', `${rule.id}: a check does not hold; the rule ends`, {turn: turn.n, rule: rule.id});
      return 'stop';
    }
    if ('refuse' in step) {
      if (run.waited) { this.error('refuse', `${rule.id}: refuse after a wait reaches no request (§9)`, {rule: rule.id}); return 'stop'; }
      const reason = read(step.refuse?.reason ?? {value: ''});
      turn.refused = reason ?? '';
      this.log('refuse', `${rule.id} refuses: ${show(turn.refused)}`, {turn: turn.n, rule: rule.id});
      turn.cancel?.(turn.refused);
      return 'go';
    }
    if ('do' in step || 'ask' in step) return this.callStep(run, turn, step);
    this.error('step', `${rule.id}: ${JSON.stringify(step)} is not a step (gate 5)`);
    return 'stop';
  }

  argsOf(run, step) {
    const args = {};
    for (const [name, reading] of own(step.with)) args[name] = run.read.read(reading);
    return args;
  }

  writeLogic(turn, key, value, rule, cause = null) {
    const def = this.def.keys.get(key);
    if (!def) { this.error('write', `${rule.id} writes the undeclared key "${key}"`, {rule: rule.id}); return 'stop'; }
    if (def.writer !== 'logic') { this.error('write', `${rule.id} writes "${key}", whose writer is ${def.writer}`, {rule: rule.id}); return 'stop'; }
    if (!fits(def, value)) { this.error('type', `${rule.id}: "${key}" (${typeOf(def)}) refused ${show(value)}`, {rule: rule.id}); return 'stop'; }
    turn.writes.set(key, {value, writer: 'logic', cause});
    return 'go';
  }

  emitStep(run, turn, step) {
    const {rule} = run;
    const event = this.def.manifest.events?.[step.emit];
    if (!event) { this.error('emit', `${rule.id} emits "${step.emit}", not an event of ${this.def.tag}`, {rule: rule.id}); return 'stop'; }
    const args = this.argsOf(run, step);
    if (isObject(event.carries)) for (const field of Object.keys(event.carries)) if (!(field in args)) this.error('emit', `${rule.id}: ${step.emit} does not carry "${field}"`, {rule: rule.id});
    const cause = run.cause;
    turn.after.push(() => {
      this.log('cross', `⇡ event ${step.emit} goes out of ${this.id}`, {emit: step.emit});
      return this.frame.emit(step.emit, args, {chain: cause});
    });
    return 'go';
  }

  /** The part of a role a step asks: a role per entry is asked through the entry that sent the event (§7.2.3). */
  partFor(name, turn) {
    const state = this.roles.get(name);
    if (!state) return {problem: `"${name}" is not a role`};
    if (!state.role.each) return {rec: state.parts.get('') ?? null};
    const [head] = splitTrigger(turn.on);
    if (head === name && turn.source) return {rec: turn.source};
    return {problem: `"${name}" is a role per entry; only an event of one of its parts says which entry to ask`};
  }

  callStep(run, turn, step) {
    const {rule} = run;
    const asking = 'ask' in step;
    const target = String(asking ? step.ask : step.do);
    const dot = target.indexOf('.');
    const roleName = target.slice(0, dot);
    const action = target.slice(dot + 1);
    const found = this.partFor(roleName, turn);
    if (found.problem) { this.error('do', `${rule.id}: ${found.problem}`, {rule: rule.id}); return 'stop'; }
    const rec = found.rec;
    const fail = (answer, reason) => {
      run.outcome = {answer, reason, message: ''};
      this.log('answer', `${target} → ${answer} (${reason})`, {turn: turn.n, rule: rule.id, answer, reason});
      return 'fail';
    };
    if (!rec) return fail('unavailable', 'part-refused');
    if (!this.present(roleName)) return fail('unavailable', 'not-present');
    const def = rec.iface.actions[action] ?? (BASE_ACTIONS.has(action) ? {} : null);
    if (!def) { this.error('do', `${rule.id}: ${rec.def.tag} has no action "${action}"`, {rule: rule.id}); return fail('refused', 'no-action'); }
    const args = this.argsOf(run, step);
    const timeout = Number(def.timeout ?? rule.timeout) || 0;
    const retry = def.retry ?? rule.retry ?? null;
    const waits = asking || rec.isAssembly || Boolean(def.waits) || WRITE_VERBS.has(action) || Boolean(rec.iface.port) || Boolean(def.concurrency) || timeout > 0;
    if (waits && turn.writes.size) { // §10.2: a waiting step first applies the writes made so far
      this.log('step', `${rule.id}: applies the turn's writes before it waits`, {turn: turn.n, rule: rule.id});
      this.commit(turn);
    }
    if (rec.iface.port && action !== 'connect-port' && !this.ports.has(rec.iface.port.id)) return fail('unavailable', 'port-not-connected');
    if (!rec.started) this.log('warn', `${rule.id}: ${target} asks a part that has not started`, {rule: rule.id}, 'warn');
    if (waits) run.waited = true;
    this.log('step', `${rule.id}: ${asking ? 'ask' : 'do'} ${target} ${show(args)}`, {turn: turn.n, rule: rule.id});
    const answer = this.invoke(rec, action, args, {run, def, timeout, retry});
    return then(answer, (outcome) => this.settle(run, turn, step, target, outcome));
  }

  settle(run, turn, step, target, outcome) {
    const {rule} = run;
    if (outcome.answer === 'cancelled') {
      this.log('answer', `${target} → cancelled: an act, not a failure; no otherwise (§10.3)`, {turn: turn.n, rule: rule.id, answer: 'cancelled'});
      return 'stop';
    }
    if (outcome.answer !== 'applied') {
      run.outcome = {answer: outcome.answer, reason: outcome.reason ?? '', message: outcome.message ?? ''};
      this.log('answer', `${target} → ${outcome.answer}${outcome.reason ? ` (${outcome.reason})` : ''}${outcome.message ? `: ${outcome.message}` : ''}`, {turn: turn.n, rule: rule.id, answer: outcome.answer, reason: outcome.reason ?? ''});
      return 'fail';
    }
    if ('ask' in step) {
      if (!step.answer) return 'go';
      return this.writeLogic(turn, step.answer, outcome.value ?? null, rule, run.cause);
    }
    return 'go';
  }

  /** Ask a part's action under its policy: concurrency, timeout, retry (§10.7). */
  invoke(rec, action, args, {run, def, timeout, retry}) {
    const policy = def.concurrency ?? 'parallel';
    let state = rec.calls.get(action);
    if (!state) { state = {active: new Set(), tail: null}; rec.calls.set(action, state); }
    if (state.active.size) {
      if (policy === 'drop') { this.log('concurrency', `${rec.instanceId}.${action}: dropped while a call waits (drop)`, {role: rec.role}); return {answer: 'refused', reason: 'busy', message: ''}; }
      if (policy === 'latest') {
        this.log('concurrency', `${rec.instanceId}.${action}: replaces the call that waits (latest)`, {role: rec.role});
        for (const earlier of state.active) earlier.controller.abort('latest');
      }
    }
    const call = linked(run.scope.signal, rec.scope.signal);
    state.active.add(call);
    const write = WRITE_VERBS.has(action);
    const attempt = (left) => then(this.callOnce(rec, action, args, call.signal, timeout, run.cause), (outcome) => {
      const repeatable = outcome.answer === 'unavailable' && left > 0 && (!write || args['client-key'] !== undefined);
      if (!repeatable) return outcome;
      this.log('retry', `${rec.instanceId}.${action}: unavailable; tries again (${left} left)`, {role: rec.role});
      count('waiting', 1);
      return sleep(Number(retry?.delay) || 0, call.signal).then((slept) => {
        count('waiting', -1);
        return slept ? attempt(left - 1) : {answer: 'cancelled', reason: 'aborted'};
      });
    });
    const go = () => attempt(Number(retry?.times) || 0);
    const done = (outcome) => { state.active.delete(call); call.controller.abort('call ended'); return outcome; };
    const result = state.active.size > 1 && policy === 'queue' ? Promise.resolve(state.tail).then(go) : go();
    if (!thenable(result)) return done(result);
    const tail = result.then(done, (error) => done({answer: 'refused', reason: 'error', message: String(error?.message ?? error)}));
    state.tail = tail;
    return tail;
  }

  callOnce(rec, action, args, signal, timeout, chain) {
    rec.causes.push(chain);
    const release = () => { const at = rec.causes.lastIndexOf(chain); if (at >= 0) rec.causes.splice(at, 1); };
    let raw;
    try {
      raw = rec.link.act(action, args, {signal, chain});
    } catch (error) {
      release();
      this.error('action', `${rec.instanceId}.${action} threw: ${error?.message ?? error}`, {role: rec.role});
      return {answer: 'refused', reason: 'error', message: String(error?.message ?? error)};
    }
    if (!thenable(raw)) { release(); return outcomeOf(raw); }
    this.waiting += 1;
    count('waiting', 1);
    return race(raw, signal, timeout, (late) => this.log('late', `${rec.instanceId}.${action}: a late answer ${late.answer} is dropped`, {role: rec.role})).then((outcome) => {
      release();
      this.waiting -= 1;
      count('waiting', -1);
      return outcome;
    });
  }

  // ---------- what parts say (§7.2, §8, §10.6, §10.8) ----------
  /** A part's values changed: written by its role, one turn of writes (§7.1). */
  reportFromPart(rec, values, options = {}) {
    if (this.disposed || rec.scope.signal.aborted || !isObject(values)) return;
    const turn = this.newTurn(`${rec.role}.values`, {}, {origin: options.origin ?? null});
    for (const [name, value] of Object.entries(values)) {
      if (!(name in rec.iface.values)) { this.error('value', `${rec.instanceId}: ${rec.def.tag} has no value "${name}"`, {role: rec.role}); continue; }
      const key = rec.def.valueBinds.get(name);
      if (key) turn.writes.set(key, {value, writer: rec.role});
    }
    if (!turn.writes.size && !this.def.aggregates.length) return;
    this.endTurn(turn);
  }

  /** A part's event: a turn of this bus; it stops at the frame (§7.4). */
  emitFromPart(rec, verb, detail = {}, options = {}) {
    if (this.disposed || rec.scope.signal.aborted) return Promise.resolve({refused: null});
    const event = rec.iface.events[verb];
    if (!event) { this.error('event', `${rec.instanceId}: ${rec.def.tag} has no event "${verb}"`, {role: rec.role}); return Promise.resolve({refused: null}); }
    if (!rec.started) { this.log('skip', `${rec.instanceId} has not started; its event ${verb} is not queued (§7.2.1)`, {role: rec.role}); return Promise.resolve({refused: null}); }
    const payload = isObject(detail) ? detail : {};
    if (isObject(event.carries)) for (const field of Object.keys(event.carries)) if (!(field in payload)) this.error('event', `${rec.instanceId}: ${verb} does not carry "${field}"`, {role: rec.role});
    if (STREAM_FACTS.has(verb) && payload.id !== undefined) this.watchStream(rec, verb, String(payload.id));
    const chain = options.chain ?? rec.causes.at(-1) ?? []; // an answer carries the chain of the turn that asked (§10.6)
    return this.fire(`${rec.role}.${verb}`, payload, {chain, entry: rec.entry, source: rec, cancel: options.cancel ?? null})
      .then((turn) => ({refused: turn?.refused ?? null}));
  }

  /** The lifecycle of a stream: begun, chunks, exactly one end (§10.8). */
  watchStream(rec, fact, id) {
    const now = rec.streams.get(id);
    if (fact === 'begun') {
      if (now === 'open') this.error('stream', `${rec.instanceId}: stream ${id} began twice`, {role: rec.role});
      rec.streams.set(id, 'open');
      return;
    }
    if (now !== 'open') { this.error('stream', `${rec.instanceId}: ${fact} of stream ${id}, which ${now ? 'has ended' : 'never began'}`, {role: rec.role}); return; }
    if (STREAM_ENDS.has(fact)) rec.streams.set(id, 'ended');
    if (rec.streams.size > 256) for (const [key, state] of rec.streams) { if (state === 'ended') rec.streams.delete(key); if (rec.streams.size <= 128) break; }
  }

  /** A word of the assembly's language file for a part (§11.2). */
  word(rec, path, n) {
    const locale = this.view.locale?.(rec) ?? 'en';
    const full = `roles.${rec.role}.${path}`;
    const found = this.def.words.find(locale, full);
    if (found.word === null) { this.log('warn', `no word ${full} in the language files of ${this.def.tag}`, {role: rec.role}, 'warn'); return null; }
    if (found.fallback) this.log('warn', `${full} falls back to ${found.from}`, {role: rec.role}, 'warn');
    return say(found.word, n, locale);
  }

  // ---------- commit (§10.2) ----------
  commit(turn) {
    const changed = [];
    const causes = new Map();
    for (const [key, {value, writer, cause}] of turn.writes) {
      const def = this.def.keys.get(key);
      if (!def) { this.error('write', `a write of the undeclared key "${key}"`, {turn: turn.n}); continue; }
      if (def.writer !== writer) { this.error('write', `${writer} writes "${key}", whose writer is ${def.writer}`, {turn: turn.n}); continue; }
      if (!fits(def, value)) { this.error('type', `"${key}" (${typeOf(def)}) refused ${show(value)}`, {turn: turn.n}); continue; }
      if (same(this.keys[key], value)) continue;
      changed.push([key, this.keys[key]]);
      if (cause) causes.set(key, cause);
      this.keys[key] = value;
    }
    turn.writes = new Map();
    const dirty = new Set(changed.map(([key]) => key));
    const derived = this.computeDerived(dirty);
    for (const [key] of derived) dirty.add(key);
    if (dirty.size) {
      for (const [name, state] of this.roles) if (state.role.each && dirty.has(state.role.each)) this.syncEach(name);
      this.syncShown(dirty);
    }
    const aggregated = this.computeAggregates();
    for (const [key] of aggregated) dirty.add(key);
    const all = [...changed, ...derived, ...aggregated];
    if (!all.length) return;
    this.log('commit', `applied ${all.map(([key]) => `${key} = ${show(this.keys[key])}`).join(', ')}`, {
      turn: turn.n, keys: all.map(([key]) => key), derived: [...derived, ...aggregated].map(([key]) => key), tag: this.def.tag,
      snapshot: journalOn() ? JSON.stringify(this.keys) : undefined,
    });
    this.view.persist?.(this, dirty, turn.fromAddress);
    const carried = [];
    for (const key of dirty) {
      let parts = 0;
      for (const reader of this.def.readers.get(key) ?? []) {
        for (const rec of this.roles.get(reader.role)?.parts.values() ?? []) if (this.pushSetting(rec, reader.member, this.keys[key], reader.debounce)) parts += 1;
      }
      if (parts) carried.push(`${key} → ${parts}`);
    }
    if (carried.length) this.log('carry', `bindings carry ${carried.join(', ')} part(s)`, {turn: turn.n});
    this.view.keysChanged?.(this, dirty);
    const out = {};
    let any = false;
    for (const [name, key] of this.def.values) {
      if (!dirty.has(key)) continue;
      this.out[name] = this.keys[key];
      out[name] = this.keys[key];
      any = true;
    }
    if (any) {
      this.log('cross', `⇡ values ${Object.keys(out).join(', ')} go out of ${this.id}`, {values: Object.keys(out)});
      this.frame.report(out, {origin: turn.origin});
    }
    for (const [key, previous] of all) {
      if (this.def.keys.get(key).writer === 'parent') continue;
      const on = `data.${key}`;
      if (!this.def.byTrigger.has(on)) continue;
      const value = this.keys[key];
      // the turn of data.<key> carries the chain of the rule that wrote the key, or of a derived key's turn (§10.5)
      const chain = causes.get(key) ?? (derived.some(([name]) => name === key) ? [...new Set([...turn.chain, ...causes.values()].flat())] : turn.chain);
      turn.after.push(() => this.fire(on, {value, previous}, {chain}));
    }
  }

  // ---------- the frame: settings, values, actions, ports (§7.4, §4.9) ----------
  setSetting(name, value) {
    const def = this.def.keys.get(name);
    if (!def || def.writer !== 'parent') { this.error('setting', `${this.def.tag} has no setting "${name}"`); return Promise.resolve(null); }
    if (!fits(def, value)) { this.error('type', `setting "${name}" (${typeOf(def)}) refused ${show(value)}`); return Promise.resolve(null); }
    if (!this.running) { this.initialSettings[name] = value; return Promise.resolve(null); }
    if (same(this.keys[name], value)) return Promise.resolve(null);
    this.log('cross', `⇣ setting ${name} = ${show(value)} comes into ${this.id}`, {setting: name});
    return this.fire(`outside.${name}`, {value, previous: this.keys[name]}, {preset: [[name, value, 'parent']], origin: 'outside'});
  }

  value(name) { return this.out[name]; }

  /** An action asked from outside: only rules handle it; an unhandled one is reported, not passed up (§7.4). */
  act(action, args = {}, options = {}) {
    if (action === 'connect-port') return this.connectPort(args?.port ?? args);
    if (action === 'focus' || action === 'blur') { this.view.focus?.(action); return {answer: 'applied'}; }
    const on = `outside.${action}`;
    const handled = this.def.byTrigger.has(on);
    if (!handled && this.def.aggregates.length && (action === 'check-validity' || action === 'reset')) {
      if (action === 'check-validity') return this.keys.valid === false ? {answer: 'refused', reason: 'invalid'} : {answer: 'applied'};
      return {answer: 'applied'};
    }
    const def = this.def.manifest.actions?.[action];
    if (!def) { this.error('action', `${this.def.tag} has no action "${action}"`); return {answer: 'refused', reason: 'no-action'}; }
    if (!handled) { this.error('unhandled', `action "${action}" is handled by no rule: reported, not passed up (§7.4)`); return {answer: 'refused', reason: 'unhandled'}; }
    const policy = def.concurrency ?? 'parallel';
    let state = this.calls.get(action);
    if (!state) { state = {active: new Set(), tail: null}; this.calls.set(action, state); }
    if (state.active.size && policy === 'drop') { this.log('concurrency', `outside.${action}: dropped while it runs (drop)`); return {answer: 'refused', reason: 'busy'}; }
    if (state.active.size && policy === 'latest') for (const earlier of state.active) earlier.controller.abort('latest');
    const scope = linked(options.signal ?? this.scope.signal);
    state.active.add(scope);
    this.log('cross', `⇣ action ${action} comes into ${this.id}`, {action});
    const go = () => this.fire(on, isObject(args) ? args : {}, {chain: options.chain ?? [], origin: 'outside', signal: scope.signal});
    const turn = state.active.size > 1 && policy === 'queue' ? Promise.resolve(state.tail).then(go) : go();
    const result = turn.then((ended) => {
      state.active.delete(scope);
      scope.controller.abort('done');
      if (ended?.refused !== null && ended?.refused !== undefined) return {answer: 'refused', reason: ended.refused};
      return {answer: 'applied'};
    });
    state.tail = result;
    return result;
  }

  /** `connect-port`: kept, and handed to every part that declares the port, at any depth, later ones too (§4.9). */
  connectPort(port) {
    if (!isObject(port) || !port.id) { this.error('port', 'connect-port needs a port with an id'); return {answer: 'refused', reason: 'no-port'}; }
    this.ports.set(port.id, port);
    let handed = 0;
    for (const state of this.roles.values()) for (const rec of state.parts.values()) {
      if (!rec.started) continue;
      if (rec.isAssembly || rec.iface.port?.id === port.id) { rec.link.connectPort?.(port); if (!rec.isAssembly) handed += 1; }
    }
    this.log('port', `connect-port ${port.id}: handed to ${handed} part(s) of ${this.id}`, {port: port.id, handed});
    return {answer: 'applied'};
  }

  /** The keys, their writers and readers (§14 «a map of keys»). */
  keyMap() {
    const map = {};
    for (const [name, def] of this.def.keys) {
      map[name] = {writer: def.writer, type: def.type, value: this.keys[name], readers: (this.def.readers.get(name) ?? []).map((one) => `${one.role}.${one.member}`)};
    }
    return map;
  }

  /** The scope ends: everything the instance started is cancelled at once (§7.7). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const state of this.roles.values()) for (const rec of state.parts.values()) this.disposePart(rec);
    this.roles.clear();
    this.scope.controller.abort('removed');
    this.view.dispose?.(this);
    this.log('dispose', `${this.id} is removed; its scope ends`);
  }
}

const stepKind = (step) => (isObject(step) ? Object.keys(step).find((field) => field !== 'with' && field !== '$comment') : 'step');


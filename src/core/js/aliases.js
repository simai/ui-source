// Dated aliases on an element (standard simai.smart-component 1.3.8 §16.20,
// §8, §16 items 6, 7, 13, 26, 32, 41; vocabulary 1.1.5 §9). When a component
// renames an event, a setting, an attribute, an action or a value, the old
// name keeps working until its `remove_after` day, and each use of it is
// noted in SF.deprecations with its dates, so a person, a probe or an AI can
// read off a running page which old names it still leans on.
//
//   const handle = SF.aliases.install(element, table, {signal});
//   SF.aliases.dispatch(element, 'sf-menu-navigate', {detail, cancelable: true});
//   handle.uninstall();   // or abort `signal`
//
// The table is a component's aliases.json (core/js/alias-table.js reads it).
// What an installed element does:
//
// Events.
//   - One dispatch sends the new name first, then each open old name, with
//     the same `detail` object and the same bubbles / composed / cancelable.
//   - Cancel is shared: preventDefault() on any of them cancels all at once,
//     so a listener that runs later on the other name already sees
//     defaultPrevented, and the dispatch answers false.
//   - stopPropagation() is not shared: the names have different listeners.
//   - It works for today's components without a change in them: the element's
//     own dispatchEvent is wrapped, so a component that still sends the old
//     name (sf-accordion:toggle) sends the new one first through the shim, and
//     a component that sends the new name has the old ones follow. The event
//     object the component made is the one dispatched under its name, so a
//     component that reads its own event's defaultPrevented sees the shared
//     cancel.
//   - A use is a listener that touches the old event (its detail, target,
//     currentTarget, composedPath, preventDefault or the stop methods). It is
//     noted once per dispatch, into one record per name. An old event that
//     nobody listens to is not a use, so a page that moved is not reported.
//     No global prototype is patched to learn this.
//   - `detail-adds` sends the new, larger detail to the old name too: the old
//     fields are all there. `when` sends an old name only for a matching
//     detail (two old names folded into one new name). `split` needs an
//     adapter that makes the old detail from the new one; without it the row
//     is refused. A component that sends the old name of a `detail-adds` or
//     `split` row is not promoted: its old detail cannot make the new one.
//
// Settings and attributes. Writing the old attribute writes the new one (the
// component hears the new one); writing the new one updates the old one when
// the page still has it, so getAttribute(old) stays true. Equal values are
// never written again, which is what ends a round. A setting also gets its
// property: the old property reads and writes the new one.
//
// Actions. The old method calls the new one with the same arguments.
//
// Values. An attribute set to an old value is written with the new one.
//
// A name that the browser's own element owns (title, blur, spellcheck,
// remove, …) is not shadowed as a property or a method unless the component
// already overrides it: the attribute alias still works.
//
// Expiry (decision, §16.20 "after that date the old name is expired"). After
// `remove_after` an old name is `expired`: it is still delivered in 1.x, its
// record carries `expired: true` and a console warning is printed once
// whatever the page opted into. A date passing in a running page must not
// break it between two deploys, and dropping a name inside a major is the
// sweep's job: the release that deletes the row is the removal, under the
// change journal. A page or a host that wants to rehearse the sweep sets
// strict mode, <html data-sf-aliases="strict"> or SF.aliases.strict = true:
// an expired old name is then not delivered — its events are not sent, its
// attribute is not mapped, its property reads undefined, its method throws.
//
// Every bundle carries its own copy of this module, so all state lives on the
// shared global (SF.__aliases, not enumerable) and the first copy's API stays
// on SF.aliases; nothing else is added to the page. Per element state is in a
// WeakMap, the wrappers are own properties of the element and leave with
// uninstall(), and the only listener is on the caller's AbortSignal, itself
// removed by an AbortController of the install.
import {noteDeprecated} from './deprecations.js';
import {aliasExpired, propertyOf, readAliasTable} from './alias-table.js';

export {readAliasTable, aliasExpired} from './alias-table.js';

const VERSION = 1;
const WRAPPED = ['dispatchEvent', 'setAttribute', 'removeAttribute', 'toggleAttribute'];
const TOUCH_GETTERS = ['detail', 'target', 'currentTarget', 'srcElement'];
const TOUCH_METHODS = ['composedPath', 'preventDefault', 'stopPropagation', 'stopImmediatePropagation'];

function shared() {
  const SF = (globalThis.SF = globalThis.SF || {});
  if (!SF.__aliases || typeof SF.__aliases !== 'object') {
    Object.defineProperty(SF, '__aliases', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: {elements: new WeakMap(), ours: new WeakSet(), now: () => Date.now()},
    });
  }
  return SF.__aliases;
}

// A test or a sweep rehearsal sets the clock; null puts the real one back.
export function setAliasClock(clock) {
  shared().now = typeof clock === 'function' ? clock : () => Date.now();
}

export function aliasesStrict() {
  return globalThis.document?.documentElement?.dataset?.sfAliases === 'strict' || globalThis.SF?.aliases?.strict === true;
}

function life(row) {
  const expired = aliasExpired(row, shared().now());
  return {expired, usable: !expired || !aliasesStrict()};
}

function note(row, expired) {
  const attribute = row.kind === 'value' ? row.setting : (row.kind === 'setting' || row.kind === 'attribute') ? row.from : '';
  noteDeprecated({
    component: row.tag,
    tag: row.tag,
    kind: row.kind,
    attribute,
    from: row.from,
    to: row.to,
    since: row.since,
    remove_after: row.remove_after,
    ...(expired ? {expired: true} : {}),
  });
}

// --- events ---------------------------------------------------------------

const eventGet = (name) => Object.getOwnPropertyDescriptor(globalThis.Event.prototype, name)?.get;
const nativePrevent = () => globalThis.Event.prototype.preventDefault;

function flagsOf(event) {
  return {
    bubbles: eventGet('bubbles').call(event),
    cancelable: eventGet('cancelable').call(event),
    composed: eventGet('composed').call(event),
  };
}

function detailOf(event) {
  const get = globalThis.CustomEvent && Object.getOwnPropertyDescriptor(globalThis.CustomEvent.prototype, 'detail')?.get;
  return get && event instanceof globalThis.CustomEvent ? get.call(event) : null;
}

function matches(detail, when) {
  if (!when) return true;
  if (!detail || typeof detail !== 'object') return false;
  return Object.entries(when).every(([field, value]) => detail[field] === value);
}

function makeEvent(element, type, detail, flags) {
  const Custom = element.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  return new Custom(type, {...flags, detail});
}

// The first touch of an old event by a listener is a use of the old name.
function instrument(event, row, expired, detail) {
  let used = false;
  const use = () => {
    if (used) return;
    used = true;
    note(row, expired);
  };
  for (const name of TOUCH_GETTERS) {
    const get = name === 'detail' ? () => detail : eventGet(name);
    if (!get) continue;
    Object.defineProperty(event, name, {configurable: true, get() { use(); return get.call(this); }});
  }
  for (const name of TOUCH_METHODS) {
    const method = event[name];
    if (typeof method !== 'function') continue;
    Object.defineProperty(event, name, {configurable: true, writable: true, value(...args) { use(); return method.apply(this, args); }});
  }
}

function shareCancel(events) {
  const cancel = nativePrevent();
  for (const event of events) {
    Object.defineProperty(event, 'preventDefault', {
      configurable: true,
      writable: true,
      value() { for (const one of events) cancel.call(one); },
    });
  }
}

// The old events that go with one new event: open (or expired outside strict)
// rows whose `when` matches, made from the same detail, or from the adapter's
// detail for a split row. `own` is the component's own event when it sent an
// old name: it is reused under that name.
function oldEventsFor(state, element, newType, detail, flags, own) {
  const out = [];
  const names = new Set();
  for (const row of state.byNew.get(newType) ?? []) {
    if (names.has(row.from) || !matches(detail, row.when)) continue;
    const {expired, usable} = life(row);
    if (!usable) continue;
    let oldDetail = detail;
    if (row.mode === 'split') {
      oldDetail = state.adapters[row.from]?.(detail, newType);
      if (oldDetail === undefined) continue;
    }
    names.add(row.from);
    const event = own && own.type === row.from && oldDetail === detail ? own : makeEvent(element, row.from, oldDetail, flags);
    out.push({event, row, expired, detail: oldDetail});
  }
  return out;
}

// Sends the new event, then the old ones, with one cancel. The cancel is
// shared first and the old events instrumented after, so a listener's
// preventDefault() on an old name both cancels all and counts as a use.
function deliver(state, element, first, olds, alsoCancel = []) {
  const ours = shared().ours;
  const events = [first, ...olds.map((one) => one.event)];
  const all = [...events, ...alsoCancel.filter((event) => !events.includes(event))];
  if (all.some((event) => eventGet('cancelable').call(event))) shareCancel(all);
  for (const one of olds) instrument(one.event, one.row, one.expired, one.detail);
  for (const event of events) {
    ours.add(event);
    state.native.dispatchEvent.call(element, event);
  }
  const prevented = eventGet('defaultPrevented');
  return !all.some((event) => prevented.call(event));
}

function wrappedDispatch(state, element, event) {
  const native = state.native.dispatchEvent;
  if (!event || shared().ours.has(event)) return native.call(element, event);
  const type = event.type;
  if (state.byNew.has(type)) {
    const detail = detailOf(event);
    return deliver(state, element, event, oldEventsFor(state, element, type, detail, flagsOf(event), null));
  }
  const rows = state.byOld.get(type);
  if (!rows) return native.call(element, event);
  const detail = detailOf(event);
  const flags = flagsOf(event);
  // An old name with one plain new name is promoted: the new name first.
  const targets = new Set(rows.filter((row) => row.mode === 'same-detail' && !row.when).map((row) => row.to));
  if (targets.size === 1 && rows.every((row) => row.mode === 'same-detail' && !row.when)) {
    const [to] = targets;
    const fresh = makeEvent(element, to, detail, flags);
    const olds = oldEventsFor(state, element, to, detail, flags, event);
    // A strict page whose old name expired still has the component's own
    // event in the cancel group, though it is not sent.
    return deliver(state, element, fresh, olds, [event]);
  }
  // Not promotable (detail-adds, split, folded): delivered as it is, a use
  // noted when touched.
  const {expired, usable} = life(rows[0]);
  if (!usable) return true;
  instrument(event, rows[0], expired, detail);
  shared().ours.add(event);
  return native.call(element, event);
}

// --- attributes, values -----------------------------------------------------

function mapValue(state, attribute, value, {quiet = false} = {}) {
  const row = state.values.get(attribute)?.get(String(value));
  if (!row) return value;
  const {expired, usable} = life(row);
  if (!quiet) note(row, expired);
  return usable ? row.to : value;
}

function writeIfDifferent(state, element, name, value) {
  const text = String(value);
  if (state.native.getAttribute.call(element, name) !== text) state.native.setAttribute.call(element, name, text);
}

function removeIfPresent(state, element, name) {
  if (state.native.hasAttribute.call(element, name)) state.native.removeAttribute.call(element, name);
}

function wrappedSet(state, element, name, value) {
  const attribute = String(name).toLowerCase();
  const row = state.attrByOld.get(attribute);
  if (row) {
    const {expired, usable} = life(row);
    note(row, expired);
    state.native.setAttribute.call(element, attribute, value);
    if (usable) writeIfDifferent(state, element, row.to, mapValue(state, row.to, value));
    return;
  }
  const mapped = mapValue(state, attribute, value);
  state.native.setAttribute.call(element, attribute, mapped);
  for (const old of state.attrByNew.get(attribute) ?? []) {
    if (state.native.hasAttribute.call(element, old.from)) writeIfDifferent(state, element, old.from, mapped);
  }
}

function wrappedRemove(state, element, name) {
  const attribute = String(name).toLowerCase();
  const row = state.attrByOld.get(attribute);
  state.native.removeAttribute.call(element, attribute);
  if (row) {
    const {expired, usable} = life(row);
    note(row, expired);
    if (usable) removeIfPresent(state, element, row.to);
    return;
  }
  for (const old of state.attrByNew.get(attribute) ?? []) removeIfPresent(state, element, old.from);
}

function wrappedToggle(state, element, name, force) {
  const attribute = String(name).toLowerCase();
  const has = state.native.hasAttribute.call(element, attribute);
  const want = force === undefined ? !has : Boolean(force);
  if (want && !has) wrappedSet(state, element, attribute, '');
  if (!want && has) wrappedRemove(state, element, attribute);
  return want;
}

// Changes that did not come through the element's own methods (the parser,
// an Attr node, a framework that calls the prototype): the later change of
// each name wins, and only differing values are written.
function reconcile(state, element, records) {
  const last = new Map();
  records.forEach((record, order) => last.set(record.attributeName, order));
  const names = [...last.keys()].sort((a, b) => last.get(a) - last.get(b));
  const has = (name) => state.native.hasAttribute.call(element, name);
  const get = (name) => state.native.getAttribute.call(element, name);
  for (const name of names) {
    const row = state.attrByOld.get(name);
    if (row) {
      const {expired, usable} = life(row);
      if (!usable) continue;
      if (has(name)) {
        if (get(row.to) !== mapValue(state, row.to, get(name), {quiet: true})) {
          note(row, expired);
          writeIfDifferent(state, element, row.to, mapValue(state, row.to, get(name)));
        }
      } else {
        removeIfPresent(state, element, row.to);
      }
      continue;
    }
    if (state.values.has(name) && has(name)) {
      const mapped = mapValue(state, name, get(name));
      if (mapped !== get(name)) writeIfDifferent(state, element, name, mapped);
    }
    for (const old of state.attrByNew.get(name) ?? []) {
      // The old name changed after this one: its own turn decides.
      if (!has(old.from) || (last.get(old.from) ?? -1) > last.get(name)) continue;
      if (has(name)) writeIfDifferent(state, element, old.from, get(name));
      else state.native.removeAttribute.call(element, old.from);
    }
  }
}

// What the markup already holds: an old attribute is a use and fills the new
// one when that is absent (a new one the page also wrote wins); an old value
// is rewritten.
function adopt(state, element) {
  const has = (name) => state.native.hasAttribute.call(element, name);
  const get = (name) => state.native.getAttribute.call(element, name);
  for (const [name, row] of state.attrByOld) {
    if (!has(name)) continue;
    const {expired, usable} = life(row);
    note(row, expired);
    if (usable && !has(row.to)) writeIfDifferent(state, element, row.to, mapValue(state, row.to, get(name)));
  }
  for (const name of state.values.keys()) {
    if (has(name)) writeIfDifferent(state, element, name, mapValue(state, name, get(name)));
  }
}

// --- members -----------------------------------------------------------------

function nativePrototypes() {
  const protos = new Set([Object.prototype]);
  for (let proto = globalThis.HTMLElement?.prototype; proto; proto = Object.getPrototypeOf(proto)) protos.add(proto);
  if (globalThis.EventTarget) protos.add(globalThis.EventTarget.prototype);
  return protos;
}

// May `name` be defined on the element? Not when the browser's element owns
// it and the component does not override it.
function ownableMember(element, name) {
  const natives = nativePrototypes();
  for (let proto = Object.getPrototypeOf(element); proto; proto = Object.getPrototypeOf(proto)) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) return !natives.has(proto);
  }
  return true;
}

function defineOwn(state, element, name, descriptor) {
  const before = Object.getOwnPropertyDescriptor(element, name);
  state.restore.push(() => {
    delete element[name];
    if (before) Object.defineProperty(element, name, before);
  });
  Object.defineProperty(element, name, {configurable: true, enumerable: false, ...descriptor});
  return before;
}

function writable(element, name) {
  for (let object = element; object; object = Object.getPrototypeOf(object)) {
    const own = Object.getOwnPropertyDescriptor(object, name);
    if (own) return Boolean(own.set) || own.writable === true;
  }
  return true;
}

// Today's Smart base exposes a setting as a read-only property over its
// attribute; such a setting is written through the attribute.
function writeSetting(state, element, row, property, value) {
  if (writable(element, property)) {
    element[property] = value;
  } else if (value === null || value === undefined || value === false) {
    removeIfPresent(state, element, row.to);
  } else {
    writeIfDifferent(state, element, row.to, value === true ? '' : typeof value === 'object' ? JSON.stringify(value) : value);
  }
}

function installProperty(state, element, row, refuse) {
  const from = propertyOf(row.from);
  const to = propertyOf(row.to);
  if (!ownableMember(element, from)) return refuse(row, 'native-member');
  if (!(to in element)) return refuse(row, 'no-new-property');
  const before = defineOwn(state, element, from, {
    get() {
      const {expired, usable} = life(row);
      note(row, expired);
      return usable ? element[to] : undefined;
    },
    set(value) {
      const {expired, usable} = life(row);
      note(row, expired);
      if (usable) writeSetting(state, element, row, to, value);
    },
  });
  // A value the page set before the element was installed moves to the new name.
  if (before && 'value' in before && before.value !== undefined) element[from] = before.value;
  return true;
}

function installAction(state, element, row, refuse) {
  if (!ownableMember(element, row.from)) return refuse(row, 'native-member');
  if (typeof element[row.to] !== 'function') return refuse(row, 'no-new-action');
  defineOwn(state, element, row.from, {
    writable: true,
    value(...args) {
      const {expired, usable} = life(row);
      note(row, expired);
      if (!usable) throw new TypeError(`[SIMAI Framework] ${row.tag || element.localName}: ${row.from}() was removed after ${row.remove_after}; call ${row.to}().`);
      return element[row.to](...args);
    },
  });
  return true;
}

// --- install ----------------------------------------------------------------

export function uninstallAliases(element) {
  const store = shared();
  const state = element && store.elements.get(element);
  if (!state) return false;
  store.elements.delete(element);
  state.observer?.disconnect();
  state.controller.abort();
  for (const restore of state.restore.reverse()) restore();
  return true;
}

export function installAliases(element, table, {signal, adapters = {}, tag} = {}) {
  if (!element || typeof element.dispatchEvent !== 'function') throw new TypeError('[SIMAI Framework] SF.aliases.install needs an element');
  uninstallAliases(element);
  const read = readAliasTable(table, {tag: tag || element.localName || ''});
  const refused = [...read.refused];
  const handle = {installed: 0, refused, uninstall: () => uninstallAliases(element)};
  if (signal?.aborted) return handle;
  const state = {
    rows: read.rows,
    adapters,
    byNew: new Map(),
    byOld: new Map(),
    attrByOld: new Map(),
    attrByNew: new Map(),
    values: new Map(),
    restore: [],
    controller: new AbortController(),
    observer: null,
    native: {},
  };
  for (const name of [...WRAPPED, 'getAttribute', 'hasAttribute']) state.native[name] = element[name];
  const refuse = (row, reason) => { refused.push({index: -1, from: row.from, to: row.to, kind: row.kind, reason}); return false; };
  const push = (map, key, row) => map.set(key, [...(map.get(key) ?? []), row]);

  for (const row of read.rows) {
    if (row.kind === 'event') {
      if (row.mode === 'split' && typeof adapters[row.from] !== 'function') { refuse(row, 'needs-adapter'); continue; }
      push(state.byNew, row.to, row);
      push(state.byOld, row.from, row);
      handle.installed += 1;
    } else if (row.kind === 'setting' || row.kind === 'attribute') {
      if (typeof state.native.setAttribute !== 'function') { refuse(row, 'no-attributes'); continue; }
      state.attrByOld.set(row.from, row);
      push(state.attrByNew, row.to, row);
      handle.installed += 1;
      if (row.kind === 'setting') installProperty(state, element, row, refuse);
    } else if (row.kind === 'value') {
      if (!state.values.has(row.setting)) state.values.set(row.setting, new Map());
      state.values.get(row.setting).set(row.from, row);
      handle.installed += 1;
    } else if (row.kind === 'action' && installAction(state, element, row, refuse)) {
      handle.installed += 1;
    }
  }

  if (state.byNew.size) {
    defineOwn(state, element, 'dispatchEvent', {writable: true, value: (event) => wrappedDispatch(state, element, event)});
  }
  const attributes = state.attrByOld.size || state.values.size;
  if (attributes) {
    defineOwn(state, element, 'setAttribute', {writable: true, value: (name, value) => wrappedSet(state, element, name, value)});
    defineOwn(state, element, 'removeAttribute', {writable: true, value: (name) => wrappedRemove(state, element, name)});
    if (typeof state.native.toggleAttribute === 'function') {
      defineOwn(state, element, 'toggleAttribute', {writable: true, value: (name, force) => wrappedToggle(state, element, name, force)});
    }
    adopt(state, element);
    const Observer = element.ownerDocument?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (typeof Observer === 'function') {
      const filter = [...new Set([...state.attrByOld.keys(), ...state.attrByNew.keys(), ...state.values.keys()])];
      state.observer = new Observer((records) => reconcile(state, element, records));
      state.observer.observe(element, {attributes: true, attributeFilter: filter});
    }
  }

  shared().elements.set(element, state);
  signal?.addEventListener?.('abort', () => uninstallAliases(element), {once: true, signal: state.controller.signal});
  return handle;
}

// For code that sends an event by name: through the element's aliases when
// it has them, a plain dispatch when it has none. Answers false when cancelled.
export function dispatchAliased(element, name, {detail = null, bubbles = true, composed = true, cancelable = false} = {}) {
  return element.dispatchEvent(makeEvent(element, name, detail, {bubbles, composed, cancelable}));
}

export function aliasesOf(element) {
  return [...(shared().elements.get(element)?.rows ?? [])];
}

// The first copy's API stays; every copy shares the state.
if (typeof globalThis !== 'undefined') {
  globalThis.SF = globalThis.SF || {};
  const current = globalThis.SF.aliases;
  if (!current || typeof current.install !== 'function') {
    globalThis.SF.aliases = {
      version: VERSION,
      strict: current?.strict === true,
      install: installAliases,
      uninstall: uninstallAliases,
      dispatch: dispatchAliased,
      of: aliasesOf,
      read: readAliasTable,
      expired: (row, now) => aliasExpired(row, now ?? shared().now()),
    };
  }
}

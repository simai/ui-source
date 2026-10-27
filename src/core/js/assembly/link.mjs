// How a part joins an assembly (standard simai.smart-component 1.3.8 §4, §7.2).
//
// The runtime never depends on a part's base class. It talks to a part through
// a link with six members:
//
//   set(name, value)                 a setting, or a value writable as one (§4)
//   get(name)                        a value the part holds
//   act(action, args, {signal})      an action; answers an outcome (§4.4)
//   connectPort(port)                the port it declares (§4.9)
//   start()                          the assembly started it (§7.2.1)
//   dispose()                        its scope ended (§7.7)
//
// and the part answers through the context the runtime gives it: `report`
// for its values, `emit` for its events, `word` for its words, `signal` for its
// scope.
//
// A part that speaks this protocol itself returns its link from
// `element[PART_LINK](context)`. Every other element — the SIMAI Framework's
// components today — is wired by `adaptElement` from its declared interface:
// settings as properties (lists and objects) or attributes, values read from
// its properties, events as DOM events (`<tag>-<verb>`, or the native name for
// a native event, §8), actions as its methods.

import {camel, isObject, outcomeOf, portOfParams, same, typeOf} from './values.mjs';

export const PART_LINK = Symbol.for('sf.assembly.part-link');

/** How long an action waits for a part whose module has not arrived (the quality profile's slot wait, §4.5.1). */
export const DEFINITION_WAIT_MS = 1500;

const RE_READ = ['change', 'input', 'sf-props-change'];

/** The DOM names of a declared event: the native name, or `<tag>-<verb>` and its dated aliases (§8). */
export function domNames(tag, verb, def = {}) {
  if (def.carries === 'native') return [verb];
  return [def.dom ?? `${tag}-${verb}`, ...(Array.isArray(def.aliases) ? def.aliases : [])];
}

/** A link for any element: its own, or one adapted from its interface; deferred until its tag is defined. */
export function createLink(element, iface, context) {
  const registry = globalThis.customElements;
  const tag = element.localName;
  if (!registry || registry.get(tag)) return linkOf(element, iface, context);
  return lateLink(element, iface, context, registry);
}

function linkOf(element, iface, context) {
  if (typeof element[PART_LINK] === 'function') return element[PART_LINK](context);
  return adaptElement(element, iface, context);
}

/** A link that queues what it is told until the part's module arrives (§7.2.1: the module is fetched on start). */
function lateLink(element, iface, context, registry) {
  let real = null;
  let started = false;
  let port = null;
  const settings = new Map();
  const tag = element.localName;
  const ready = registry.whenDefined(tag).then(() => {
    if (context.signal.aborted) return null;
    registry.upgrade?.(element);
    real = linkOf(element, iface, context);
    for (const [name, value] of settings) real.set(name, value);
    settings.clear();
    if (port) real.connectPort?.(port);
    if (started) real.start?.();
    return real;
  });
  return {
    set(name, value) { if (real) real.set(name, value); else settings.set(name, value); },
    get(name) { return real ? real.get(name) : undefined; },
    valid() { return real?.valid?.(); },
    act(action, args, options = {}) {
      if (real) return real.act(action, args, options);
      return new Promise((resolve) => {
        const timer = globalThis.setTimeout(() => resolve({answer: 'unavailable', reason: 'not-defined', message: ''}), DEFINITION_WAIT_MS);
        ready.then((link) => {
          globalThis.clearTimeout(timer);
          resolve(link ? link.act(action, args, options) : {answer: 'cancelled', reason: 'removed'});
        });
      });
    },
    connectPort(given) { if (real) real.connectPort?.(given); else port = given; },
    start() { if (real) real.start?.(); else started = true; },
    dispose() { real?.dispose?.(); },
  };
}

/** The interface adapter for today's components (§4): attributes, properties, DOM events, methods. */
export function adaptElement(element, iface, context) {
  const signal = context.signal;
  const known = new Map();
  const values = Object.keys(iface.values ?? {});
  const tag = element.localName;

  const readValues = (origin = null) => {
    let changes = null;
    for (const name of values) {
      const value = element[camel(name)];
      if (value === undefined || (known.has(name) && same(known.get(name), value))) continue;
      known.set(name, value);
      (changes ??= {})[name] = value;
    }
    if (changes) context.report(changes, {origin});
  };

  const heard = new Set();
  for (const [verb, def] of Object.entries(iface.events ?? {})) {
    for (const name of domNames(tag, verb, def)) {
      heard.add(name);
      element.addEventListener(name, (event) => {
        if (event.target !== element) return; // an event of a component inside the part is not the part's
        readValues();
        const detail = def.carries === 'native' || !isObject(event.detail) ? {} : event.detail;
        context.emit(verb, detail, {cancel: event.cancelable ? () => event.preventDefault() : null});
      }, {signal});
    }
  }
  if (values.length) {
    for (const name of RE_READ) {
      if (heard.has(name)) continue;
      element.addEventListener(name, (event) => { if (event.target === element) readValues(); }, {signal});
    }
  }

  const write = (name, value) => {
    const def = iface.settings?.[name] ?? iface.values?.[name];
    const prop = camel(name);
    const type = typeOf(def);
    if (name in (iface.values ?? {})) known.set(name, value); // a value set from outside is not reported back (§8)
    if (type === 'list' || type === 'object' || prop in element) { element[prop] = value; return; }
    if (value === null || value === undefined) { element.removeAttribute(name); return; }
    if (type === 'boolean') {
      if (value === true) element.setAttribute(name, '');
      else if (def?.optional || def?.default === true) element.setAttribute(name, 'false'); // off, not the default on
      else element.removeAttribute(name);
      return;
    }
    element.setAttribute(name, String(value));
  };

  return {
    set: write,
    get: (name) => element[camel(name)],
    valid: () => (element.validity ? element.validity.valid : undefined),
    act(action, args = {}, options = {}) {
      if (action === 'connect-port') return this.connectPort(portOfParams(args));
      const method = element[camel(action)];
      if (typeof method !== 'function') {
        if (action === 'focus' || action === 'blur') { element[action]?.(); return {answer: 'applied'}; }
        return {answer: 'refused', reason: 'no-action', message: ''};
      }
      let given = isObject(args) ? args : {};
      // §11.2: a part asked with a code says the assembly's word for it; today's components take text.
      // The word by code wins over the host's message; the message is said only when the code has no word
      // (dispatcher decision 2026-10-27).
      if (typeof given.code === 'string') {
        const word = context.word(`words.${given.code}`, given.count);
        if (word !== null) given = {...given, text: word};
      }
      const answer = method.call(element, given, {signal: options.signal});
      return answer && typeof answer.then === 'function' ? answer.then(outcomeOf) : outcomeOf(answer);
    },
    // The part's base action connect-port (§4.1, §4.9): an element made by
    // elementFromManifest or on the Smart base keeps the port and runs its
    // hook; an older element without it is handed the port by setHostPort.
    connectPort(port) {
      const connect = typeof element.connectPort === 'function' ? element.connectPort : element.setHostPort;
      if (typeof connect !== 'function') return {answer: 'refused', reason: 'no-action', message: ''};
      return outcomeOf(connect.call(element, port));
    },
    start: () => readValues('start'), // the part's first values are not a person's change (§8)
    dispose() {},
  };
}

/** The link to a nested assembly: an ordinary part (§7.4). */
export function assemblyLink(core) {
  return {
    set: (name, value) => { core.setSetting(name, value); },
    get: (name) => core.value(name),
    valid: () => (core.keys.valid === false ? false : undefined),
    act: (action, args, options = {}) => core.act(action, args, options),
    connectPort: (port) => { core.connectPort(port); },
    start: () => { core.start(); },
    dispose: () => { core.dispose(); },
  };
}

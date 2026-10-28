// SF.EarlyPort: the port declared on the element, its first query sent by
// Core (standard simai.smart-component §4.9 proposal, stand 27 variant c).
//
// A page that knows the first call a port-fed element will send declares it
// in the element, as a JSON island:
//
//   <sf-data-view id="list" …>
//     <script type="application/json" data-sf-port>{
//       "port": "simai.dataview-port", "version": "1.12.0",
//       "url": "/admin/catalog/port", "capabilities": ["row-actions", …],
//       "first": {"intent": "query.change", "payload": {"query": {…}}}
//     }</script>
//     …
//   </sf-data-view>
//
// Core reads the island when it runs (DOMContentLoaded at the latest, before
// any component's code), sends `first` once, and keeps the answer's promise
// for the element. When the element is defined, Core hands it the port with
// the base action connect-port, in the task that defines it; the port's first
// call of that intent with the same payload takes the kept answer instead of
// asking again. One request, while the component's code is still loading.
//
// The island stays where it is: the element reads its capabilities and its
// first query from it (sf-data-view 1.5.0), so the first draw is final.
//
// Where the port comes from:
//   url        Core's own adapter on the standard wire: POST {intent, payload,
//              page} to `url`, same-origin with cookies, JSON answer;
//   no url     the page's port registry: SF.EarlyPort.register(id, adapter)
//              with an adapter {port, version, capabilities, raise(intent,
//              payload, {signal})}; the early call is that adapter's raise.
// `"connect": false` starts the call only: the page connects its own adapter
// and asks SF.EarlyPort.take({port, version, url, intent, payload}) first
// (Larena's bridge). `first.body` is then the request body sent as is, and
// `"csrf": "meta:<name>"` names a <meta> whose content goes in X-CSRF-TOKEN.
//
// The matching rule (one early answer per port, taken once):
//   - the port id, the port's version, the intent and the canonical payload
//     (without the asker's `sequence` and `reason`) are the same;
//   - the call started less than `ttl` ms ago (10 s) and the page was not
//     restored from the back/forward cache;
//   - taken once, matched or not: a later call never meets an old answer; a
//     call that does not match aborts the early one if it is still running;
//   - the answer carries the asker's `sequence`;
//   - an early call that failed is asked again, never reported as the
//     element's failure.
// A malformed island is warned about and left alone: the element falls back
// to the port the page connects, as without the island.
//
// The state lives on a shared global: a second copy of this module (a page
// with two Cores) finds the first one's and adds nothing.

const STATE = Symbol.for('simai.sf.early-port');
const DEFAULT_TTL = 10000;
const ISLAND = 'script[type="application/json"][data-sf-port]';

/** A value as canonical JSON: object keys sorted, undefined as null. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** What identifies a call: never the asker's sequence or reason. */
export function callKey({port = '', version = '', intent = '', payload = {}} = {}) {
  const rest = {...(payload && typeof payload === 'object' ? payload : {})};
  delete rest.sequence;
  delete rest.reason;
  return [port || '', version || '', intent || '', canonical(rest)].join('|');
}

const endpointKey = (port, url) => `${port || ''} ${url || ''}`;

const isIsland = (node) => node?.localName === 'script'
  && node.hasAttribute?.('data-sf-port')
  && /^application\/json$/iu.test(node.type || node.getAttribute?.('type') || '');

/** The island an element holds as its own child, or null. */
export function islandOf(element) {
  for (const child of Array.from(element?.children ?? [])) if (isIsland(child)) return child;
  return null;
}

/**
 * Installs SF.EarlyPort on `win` (a window) and returns it. The second call,
 * or a page whose SF.EarlyPort is already there, returns the one in place.
 */
export function installEarlyPort(win = globalThis) {
  const SF = (win.SF = win.SF || {});
  if (win[STATE]?.api) {
    if (!SF.EarlyPort) SF.EarlyPort = win[STATE].api;
    return win[STATE].api;
  }
  const doc = win.document;
  const now = () => (win.performance?.now ? win.performance.now() : Date.now());
  const warn = (...args) => win.console?.warn?.('[SIMAI Framework] early port:', ...args);

  const state = {
    entries: new Map(),       // endpoint key -> entry (take by spec)
    byElement: new WeakMap(), // element -> declaration
    declared: new Set(),      // declarations whose element may still be waiting
    islands: new WeakSet(),   // islands already read
    registry: new Map(),      // port id -> adapter (the page's port registry)
    preferred: new Set(),     // tags the Loader asks to define first
    log: [],
    api: null,
  };
  Object.defineProperty(win, STATE, {value: state, configurable: true});

  const note = (what, detail = {}) => {
    state.log.push({what, t: Math.round(now()), ...detail});
    if (state.log.length > 200) state.log.shift();
  };

  // ---------- the call ----------

  const csrfOf = (spec) => {
    const name = /^meta:(.+)$/u.exec(String(spec.csrf || ''))?.[1];
    if (!name || !doc) return null;
    return doc.querySelector?.(`meta[name="${name.replace(/["\\]/gu, '')}"]`)?.getAttribute?.('content') ?? null;
  };

  // The standard wire: POST {intent, payload, page} to the port's url.
  const post = (spec, intent, payload, {signal, body} = {}) => {
    const headers = {'content-type': 'application/json', accept: 'application/json'};
    const csrf = csrfOf(spec);
    if (csrf) headers['x-csrf-token'] = csrf;
    return win.fetch(spec.url, {
      method: 'POST', credentials: 'same-origin', signal, headers,
      body: JSON.stringify(body ?? {intent, payload, page: win.location?.pathname ?? ''}),
    }).then((response) => response.json());
  };

  /**
   * Sends a call now and keeps its promise under the port's endpoint.
   * `spec`: {port, version, url, intent, payload, ttl, body, csrf} -- payload
   * without sequence and reason. `send` (optional) sends it another way and
   * returns a promise of the answer. Resolves with the answer, or null when
   * the call failed.
   */
  function start(spec, send = null) {
    const controller = typeof win.AbortController === 'function' ? new win.AbortController() : null;
    const entry = {
      key: callKey(spec), endpoint: endpointKey(spec.port, spec.url), t: now(),
      ttl: Number.isFinite(spec.ttl) && spec.ttl > 0 ? spec.ttl : DEFAULT_TTL,
      settled: false, taken: false, controller,
    };
    const payload = {...(spec.payload || {}), sequence: 0};
    let sent;
    try {
      sent = send ? send(payload, controller?.signal) : post(spec, spec.intent, payload, {signal: controller?.signal, body: spec.body});
    } catch (error) {
      sent = Promise.reject(error);
    }
    entry.promise = Promise.resolve(sent).then(
      (answer) => { entry.settled = true; return answer && typeof answer === 'object' ? answer : null; },
      () => { entry.settled = true; return null; },
    );
    // A second start for the same endpoint replaces the first, which nobody
    // can take any more.
    const previous = state.entries.get(entry.endpoint);
    if (previous && !previous.taken && !previous.settled) previous.controller?.abort();
    state.entries.set(entry.endpoint, entry);
    note('start', {endpoint: entry.endpoint});
    return entry.promise;
  }

  /**
   * The port's call asks for the early answer of its endpoint. Returns a
   * promise of the answer (with the asker's sequence) when the call is the
   * early one, else null and the caller asks the port itself. Taken once.
   */
  function take(spec) {
    const endpoint = endpointKey(spec?.port, spec?.url);
    const entry = state.entries.get(endpoint);
    if (!entry) return null;
    state.entries.delete(endpoint);
    entry.taken = true;
    const same = entry.key === callKey(spec);
    const fresh = now() - entry.t <= entry.ttl;
    note(same && fresh ? 'adopt' : same ? 'too-old' : 'mismatch', {endpoint, settled: entry.settled});
    if (!same || !fresh) {
      // Nobody will read it: a request still running is let go.
      if (!entry.settled) entry.controller?.abort();
      return null;
    }
    const sequence = spec.payload?.sequence;
    return entry.promise.then((answer) => (answer && sequence !== undefined ? {...answer, sequence} : answer));
  }

  // ---------- the adapter ----------

  // The port as the element gets it: its first matching call takes the early
  // answer; an early call that failed (null) is asked again.
  function adapterFor(declaration) {
    const {spec} = declaration;
    const own = declaration.provider;
    const raise = async (intent, payload = {}, options = {}) => {
      const adopted = take({port: spec.port, version: spec.version, url: spec.url, intent, payload});
      if (adopted) {
        const answer = await adopted;
        if (answer) return answer;
      }
      if (own) return own.raise(intent, payload, options);
      try {
        return await post(spec, intent, payload, {signal: options.signal});
      } catch (error) {
        if (options.signal?.aborted) throw error;
        return {answer: 'unavailable', reason: 'network'};
      }
    };
    return {
      port: spec.port,
      version: own?.version ?? spec.version,
      capabilities: Array.isArray(own?.capabilities) ? own.capabilities : (Array.isArray(spec.capabilities) ? spec.capabilities : []),
      raise,
    };
  }

  // ---------- the declaration ----------

  const portHeld = (element) => Boolean(element.sfPort ?? element.hostPort);

  // Hands the port to the element once it is defined: in the task that
  // defines it (customElements.whenDefined resolves in its microtasks). A
  // port the page connected first is left alone.
  function connectWhenDefined(declaration) {
    const {element} = declaration;
    const registry = win.customElements;
    if (!registry || declaration.spec.connect === false || declaration.connecting) return;
    declaration.connecting = true;
    const connect = () => {
      state.declared.delete(declaration);
      if (!element.isConnected || portHeld(element)) { note('connect-skipped', {tag: element.localName}); return; }
      const adapter = adapterFor(declaration);
      declaration.adapter = adapter;
      try {
        if (typeof element.connectPort === 'function') element.connectPort({port: adapter});
        else if (typeof element.setHostPort === 'function') element.setHostPort(adapter);
        else { warn(`${element.localName} has no connect-port; the page connects its port`); return; }
        note('connect', {tag: element.localName});
      } catch (error) {
        warn(`${element.localName} refused its declared port`, error);
      }
    };
    if (registry.get(element.localName)) connect();
    else registry.whenDefined(element.localName).then(connect);
  }

  // The early call of a declaration, once its port can be asked.
  function startFirst(declaration) {
    const {spec} = declaration;
    if (declaration.started || !spec.first) return;
    const {intent, payload = {}, body} = spec.first;
    if (declaration.provider) {
      declaration.started = true;
      start({...spec, intent, payload}, (sent, signal) => declaration.provider.raise(intent, sent, {signal}));
    } else if (spec.url) {
      declaration.started = true;
      start({...spec, intent, payload, body});
    }
  }

  function parse(island) {
    let spec;
    try {
      spec = JSON.parse(island.textContent || '');
    } catch (error) {
      warn(`the data-sf-port island of ${island.parentElement?.localName ?? 'an element'} is not JSON; the element falls back to the port the page connects`, error);
      return null;
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      warn('a data-sf-port island is not an object; ignored');
      return null;
    }
    if (typeof spec.port !== 'string' || !spec.port) {
      warn('a data-sf-port island names no port; ignored');
      return null;
    }
    if (spec.url !== undefined && (typeof spec.url !== 'string' || !spec.url)) {
      warn(`the data-sf-port island of ${spec.port} has a url that is not one; ignored`);
      return null;
    }
    if (spec.first !== undefined && (!spec.first || typeof spec.first !== 'object'
      || typeof spec.first.intent !== 'string' || !spec.first.intent
      || (spec.first.payload !== undefined && (typeof spec.first.payload !== 'object' || spec.first.payload === null || Array.isArray(spec.first.payload))))) {
      warn(`the data-sf-port island of ${spec.port} has a first call without an intent and an object payload; its port is declared, no early call is sent`);
      spec = {...spec};
      delete spec.first;
    }
    return spec;
  }

  /** Reads the element's island, if it has one and it was not read yet. */
  function declareIn(element) {
    const island = islandOf(element);
    if (!island || state.islands.has(island)) return state.byElement.get(element) ?? null;
    state.islands.add(island);
    const spec = parse(island);
    if (!spec) return null;
    const provider = spec.url ? null : state.registry.get(spec.port) ?? null;
    if (provider && spec.version && provider.version && provider.version !== spec.version) {
      warn(`${spec.port}: the page's adapter is ${provider.version}, the island declares ${spec.version}; no early call`);
      return null;
    }
    const declaration = {element, spec, provider, started: false, connecting: false, adapter: null};
    state.byElement.set(element, declaration);
    state.declared.add(declaration);
    note('declare', {tag: element.localName, port: spec.port});
    startFirst(declaration);
    if (spec.url || provider) connectWhenDefined(declaration);
    // Neither a url nor an adapter yet: register() starts and connects it.
    return declaration;
  }

  /** Reads every island under `root` (the document by default). */
  function scan(root = doc) {
    const found = [];
    const islands = root?.querySelectorAll ? Array.from(root.querySelectorAll(ISLAND)) : [];
    for (const island of islands) {
      const element = island.parentElement;
      if (!element || !element.localName?.includes('-')) continue;
      const declaration = declareIn(element);
      if (declaration) found.push(declaration);
    }
    return found;
  }

  /**
   * The page's port registry: an adapter for a port id, for islands that name
   * the port without a url. A declaration waiting for it starts now.
   */
  function register(id, adapter) {
    if (typeof id !== 'string' || !id || !adapter || typeof adapter.raise !== 'function') {
      warn('register(id, adapter) needs a port id and an adapter with raise()');
      return false;
    }
    state.registry.set(id, adapter);
    for (const declaration of state.declared) {
      if (declaration.spec.port !== id || declaration.spec.url || declaration.provider) continue;
      if (declaration.spec.version && adapter.version && adapter.version !== declaration.spec.version) {
        warn(`${id}: the page's adapter is ${adapter.version}, the island declares ${declaration.spec.version}; no early call`);
        continue;
      }
      declaration.provider = adapter;
      startFirst(declaration);
      connectWhenDefined(declaration);
    }
    return true;
  }

  /** The elements holding a declared port whose definition has not come yet. */
  function waiting() {
    const elements = [];
    for (const declaration of state.declared) {
      const {element} = declaration;
      if (element.isConnected && !win.customElements?.get(element.localName)) elements.push(element);
    }
    return elements;
  }

  /**
   * The tags to define first: each waiting element's own and those of the
   * undefined sf- elements inside it (its parts). The Loader adds the tags of
   * their relations (SF.EarlyPort.preferTags).
   */
  function firstTags() {
    const tags = new Set(state.preferred);
    for (const element of waiting()) {
      tags.add(element.localName);
      for (const inner of Array.from(element.querySelectorAll?.('*') ?? [])) {
        if (inner.localName?.startsWith('sf-') && !win.customElements?.get(inner.localName)) tags.add(inner.localName);
      }
    }
    return tags;
  }
  const preferTags = (tags) => { for (const tag of tags || []) if (typeof tag === 'string' && tag) state.preferred.add(tag); };

  // A page restored from the back/forward cache keeps no early answer.
  win.addEventListener?.('pageshow', (event) => {
    if (!event.persisted) return;
    for (const entry of state.entries.values()) if (!entry.settled) entry.controller?.abort();
    state.entries.clear();
  });

  const api = Object.freeze({
    start, take, register, scan, declareIn, waiting, firstTags, preferTags,
    adapterOf: (element) => state.byElement.get(element)?.adapter ?? null,
    canonical, callKey,
    get log() { return state.log.slice(); },
  });
  state.api = api;
  SF.EarlyPort = api;

  // DOMContentLoaded or earlier: what is parsed now, then the whole page.
  if (doc) {
    scan(doc);
    if (doc.readyState === 'loading') doc.addEventListener?.('DOMContentLoaded', () => scan(doc), {once: true});
  }
  return api;
}

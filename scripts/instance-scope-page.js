// The page side of gate 36, the instance's scope (tests/browser/instance-scope.browser.mjs;
// standard simai.smart-component 1.3.9 §7.7, §13 gate 36). Loaded as a classic
// script before core.js, it counts what the page's code keeps alive, by owner:
//
//   listeners  addEventListener on window, the document, any node still in
//              the page outside <head>, and any other target (a MediaQueryList,
//              the visual viewport); a listener given an aborted signal,
//              removed, or a `once` listener that fired is not alive;
//   timers     setTimeout until it fires or is cleared, setInterval until it
//              is cleared, requestAnimationFrame and requestIdleCallback
//              until they run or are cancelled;
//   observers  ResizeObserver, MutationObserver, IntersectionObserver with
//              at least one target observed;
//   requests   fetch that has not settled and whose signal is not aborted;
//   nodes      elements in <body> outside the stage (portals, layers);
//   page       the attributes of <html> and <body> (a page lock, a mark);
//   registries the layer stack, the open surfaces, the language's listeners
//              and the [lang] watch.
//
// It also mounts the example (the host, its island, children and slots, or
// the example's markup), removes it and places it again, and runs the
// example's script. No dependency: it runs in the browser as is.
(() => {
  const OWN = Symbol('sf-scope-probe');
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;

  // Who started it: the first frame of a script under /distr/, read as the
  // bundle (smart/<folder>, core/...). The probe's own frames are skipped.
  const owner = () => {
    const stack = String(new Error().stack || '').split('\n').slice(2);
    for (const line of stack) {
      const match = /\/distr\/([^\s)?#]+?)(?:\?[^\s):]*)?:(\d+):\d+/u.exec(line);
      if (match) return `${match[1].replace(/\/(?:index|bundle)?\.?m?js$/u, '').replace(/\.m?js$/u, '')}:${match[2]}`;
    }
    return 'page';
  };

  // ---------- listeners ----------
  const listeners = new Set();
  const byTarget = new WeakMap();
  const captureOf = (options) => (typeof options === 'boolean' ? options : Boolean(options && options.capture));
  const keyOf = (type, options) => `${type}|${captureOf(options)}`;
  const drop = (entry) => {
    listeners.delete(entry);
    const byKey = byTarget.get(entry.target);
    const one = byKey && byKey.get(entry.key);
    if (one && one.get(entry.listener) === entry) one.delete(entry.listener);
  };
  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    const result = add.call(this, type, listener, options);
    if (!listener || (listener && listener[OWN])) return result;
    const signal = options && typeof options === 'object' ? options.signal : null;
    if (signal && signal.aborted) return result;
    let byKey = byTarget.get(this);
    if (!byKey) byTarget.set(this, (byKey = new Map()));
    const key = keyOf(type, options);
    let one = byKey.get(key);
    if (!one) byKey.set(key, (one = new Map()));
    if (one.has(listener)) return result;
    const entry = {target: this, type, key, listener, owner: owner()};
    one.set(listener, entry);
    listeners.add(entry);
    if (signal) add.call(signal, 'abort', () => drop(entry), {once: true});
    if (options && typeof options === 'object' && options.once) {
      // Runs in the same dispatch as the listener, after it.
      const gone = () => drop(entry);
      gone[OWN] = true;
      add.call(this, type, gone, {once: true, capture: captureOf(options)});
    }
    return result;
  };
  EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
    const result = remove.call(this, type, listener, options);
    const one = byTarget.get(this)?.get(keyOf(type, options));
    const entry = one && one.get(listener);
    if (entry) drop(entry);
    return result;
  };

  // ---------- timers ----------
  const timers = new Map();
  const nativeTimeout = window.setTimeout.bind(window);
  const wrapTimer = (setName, clearName, kind, {repeats = false} = {}) => {
    const set = window[setName];
    const clear = window[clearName];
    if (typeof set !== 'function') return;
    window[setName] = function timer(callback, ...rest) {
      let id = 0;
      const run = typeof callback === 'function'
        ? function scoped(...args) {
          if (!repeats) timers.delete(`${kind}:${id}`);
          return callback.apply(this, args);
        }
        : callback;
      id = set.call(window, run, ...rest);
      timers.set(`${kind}:${id}`, {kind, owner: owner(), delay: kind === 'timeout' || kind === 'interval' ? Number(rest[0]) || 0 : 0});
      return id;
    };
    window[clearName] = function clearTimer(id) {
      timers.delete(`${kind}:${id}`);
      return clear.call(window, id);
    };
  };
  wrapTimer('setTimeout', 'clearTimeout', 'timeout');
  wrapTimer('setInterval', 'clearInterval', 'interval', {repeats: true});
  wrapTimer('requestAnimationFrame', 'cancelAnimationFrame', 'frame');
  wrapTimer('requestIdleCallback', 'cancelIdleCallback', 'idle');

  // ---------- observers ----------
  const observers = new Set();
  for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const Native = window[name];
    if (typeof Native !== 'function') continue;
    const Counted = class extends Native {
      constructor(...args) {
        super(...args);
        this.__sfProbe = {kind: name, owner: owner(), targets: new Set()};
        observers.add(this);
      }
      observe(target, ...rest) {
        this.__sfProbe.targets.add(target);
        return super.observe(target, ...rest);
      }
      unobserve(target) {
        this.__sfProbe.targets.delete(target);
        return super.unobserve(target);
      }
      disconnect() {
        this.__sfProbe.targets.clear();
        return super.disconnect();
      }
    };
    Object.defineProperty(Counted, 'name', {value: name});
    window[name] = Counted;
  }

  // ---------- requests ----------
  const requests = new Set();
  const nativeFetch = window.fetch;
  window.fetch = function fetch(input, init) {
    const entry = {url: String(input && input.url ? input.url : input), signal: (init && init.signal) || (input && input.signal) || null, owner: owner()};
    requests.add(entry);
    const done = () => requests.delete(entry);
    const answer = nativeFetch.call(this, input, init);
    answer.then(done, done);
    return answer;
  };

  // ---------- the example ----------
  let spec = null;
  let hosts = [];
  let places = [];
  // Every host the page has had, removed ones too.
  const everHosts = [];

  function build(input) {
    spec = input || spec;
    const stage = document.getElementById('stage');
    stage.replaceChildren();
    const holds = spec.markup && new RegExp(`<${spec.tag}[\\s>]`, 'u').test(spec.markup);
    if (holds) {
      stage.innerHTML = spec.markup;
    } else {
      let container = stage;
      if (spec.markup) stage.innerHTML = spec.markup;
      if (spec.parent) {
        stage.insertAdjacentHTML('beforeend', spec.parent);
        container = stage.lastElementChild;
      }
      const el = document.createElement(spec.tag);
      for (const [name, value] of spec.attributes) el.setAttribute(name, value);
      if (Object.keys(spec.island).length) {
        const island = document.createElement('script');
        island.type = 'application/json';
        island.setAttribute('data-sf-settings', '');
        island.textContent = JSON.stringify(spec.island);
        el.append(island);
      }
      if (spec.children) {
        const template = document.createElement('template');
        template.innerHTML = spec.children;
        el.append(template.content);
      }
      for (const [slot, markup] of spec.slots) {
        const template = document.createElement('template');
        template.innerHTML = markup;
        for (const child of template.content.children) child.setAttribute('slot', slot);
        el.append(template.content);
      }
      container.append(el);
    }
    hosts = [...stage.querySelectorAll(spec.tag)].filter((one) => !one.parentElement.closest(spec.tag));
    if (!hosts.length) throw new Error(`no <${spec.tag}> in the example`);
    everHosts.push(...hosts);
    // Where each host was placed: a host that takes itself out (a closed
    // alert) is placed there again.
    places = hosts.map((host) => ({host, parent: host.parentNode, next: host.nextSibling}));
    return hosts.length;
  }

  // Drawn: defined, rendered (or started, for a closed overlay).
  function drawn() {
    return hosts.length > 0 && hosts.every((host) => customElements.get(host.localName)
      && (!('isRendered' in host) || host.isRendered === true || host.hasAttribute('data-sf-started')));
  }

  function removeHosts() {
    places = places.map((place) => (place.host.parentNode
      ? {host: place.host, parent: place.host.parentNode, next: place.host.nextSibling} : place));
    for (const {host} of places) host.remove();
    return places.length;
  }

  function placeAgain() {
    for (const {host, parent, next} of places) parent.insertBefore(host, next && next.parentNode === parent ? next : null);
    return hosts.length;
  }

  // What re-placing must give back: an open scope and a drawn element.
  function placedAgainProblems(before) {
    const problems = [];
    hosts.forEach((host, index) => {
      if (host.sfScope && host.sfScope.aborted) problems.push('its scope stays ended after it is placed again');
      const size = (host.shadowRoot ? host.shadowRoot.childNodes.length : 0) + host.childNodes.length;
      if (before[index] > 0 && size === 0) problems.push('it draws nothing when placed again');
    });
    return problems;
  }
  const sizes = () => hosts.map((host) => (host.shadowRoot ? host.shadowRoot.childNodes.length : 0) + host.childNodes.length);

  const resolveValue = (value) => {
    if (typeof value === 'string' && /^[#.][\w-]/u.test(value)) return document.querySelector(value) || value;
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v)]));
    return value;
  };
  const actionOf = (host, name) => (host.constructor.sfManifest?.actions ?? []).find((one) => one.name === name) || null;
  const call = (host, name, params) => {
    const action = actionOf(host, name);
    if (!action || typeof host[action.method] !== 'function') return false;
    try {
      const answer = params === undefined ? host[action.method]() : host[action.method](resolveValue(params));
      if (answer && typeof answer.then === 'function') answer.then(null, () => {});
    } catch { /* an action that refuses is not what this counts */ }
    return true;
  };
  const OPEN = ['open', 'show', 'open-panel', 'open-dropdown'];
  const CLOSE = ['close', 'close-panel', 'close-dropdown'];
  const TOGGLE = ['toggle', 'toggle-panel', 'toggle-dropdown'];

  // The minimal use: the example's script, else open (and close) what opens;
  // a focus and a pointer passing over it.
  function interact({close}) {
    for (const host of hosts) {
      if (!host.isConnected) continue;
      const focusable = host.matches('button, input, textarea, select, a[href], [tabindex]')
        ? host : host.querySelector('button, input, textarea, select, a[href], [tabindex]');
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) host.dispatchEvent(new PointerEvent(type, {bubbles: type.endsWith('over'), composed: true}));
      try { focusable?.focus?.(); } catch { /* not focusable */ }
      const script = spec.script || [];
      for (const step of script) {
        if (step.act) call(host, step.act, step.with);
        else if (step.press) (host.querySelector(step.press) || document.querySelector(step.press))?.click?.();
        else if (step.key) {
          const at = host.contains(document.activeElement) ? document.activeElement : host;
          at.dispatchEvent(new KeyboardEvent('keydown', {key: step.key, bubbles: true, composed: true}));
          at.dispatchEvent(new KeyboardEvent('keyup', {key: step.key, bubbles: true, composed: true}));
        }
      }
      if (!script.length) {
        const opened = OPEN.some((name) => call(host, name)) || TOGGLE.some((name) => call(host, name));
        if (opened && close) CLOSE.some((name) => call(host, name)) || TOGGLE.some((name) => call(host, name));
      }
    }
  }

  // ---------- the count ----------
  const STAGE = () => document.getElementById('stage');
  const alive = (target) => !(target instanceof Node) || target.isConnected;
  const describeTarget = (target) => {
    if (target === window) return 'window';
    if (target === document) return 'document';
    if (target instanceof Element) return target === document.body ? 'body' : target === document.documentElement ? 'html' : `<${target.localName}${target.id ? `#${target.id}` : ''}>`;
    return target?.constructor?.name || 'target';
  };
  function count() {
    const out = [];
    for (const entry of listeners) {
      // The Loader's <link> and <script> in <head> are the page's assets,
      // loaded once whichever element asked first.
      if (!alive(entry.target) || (entry.target instanceof Node && document.head.contains(entry.target))) continue;
      out.push({kind: 'listener', what: `${describeTarget(entry.target)} ${entry.type}`, owner: entry.owner});
    }
    for (const [, entry] of timers) out.push({kind: 'timer', what: entry.kind + (entry.kind === 'timeout' || entry.kind === 'interval' ? ` ${entry.delay}ms` : ''), owner: entry.owner});
    // An observer is left behind when it still observes the page or the
    // removed element. One on a node of the instance's own that was never in
    // the page (the base's author-style holder) goes with the instance.
    const ofRemoved = (target) => everHosts.some((host) => host === target || host.contains(target) || Boolean(host.shadowRoot && host.shadowRoot.contains(target)));
    for (const observer of observers) {
      const probe = observer.__sfProbe;
      const watched = [...probe.targets].filter((target) => !(target instanceof Node) || target.isConnected || ofRemoved(target));
      if (watched.length) out.push({kind: 'observer', what: `${probe.kind} (${watched.length})`, owner: probe.owner});
    }
    for (const entry of requests) {
      if (!entry.signal || !entry.signal.aborted) out.push({kind: 'request', what: entry.url.replace(location.origin, ''), owner: entry.owner});
    }
    const stage = STAGE();
    // Every element outside the stage, under the child of <body> that holds it.
    const name = (el) => `<${el.localName}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/u)[0]}` : ''}>`;
    for (const top of document.body.children) {
      if (top === stage || top.localName === 'script') continue;
      for (const el of [top, ...top.querySelectorAll('*')]) out.push({kind: 'node', what: el === top ? name(top) : `${name(top)} ${name(el)}`, owner: 'page'});
    }
    const attrs = (el) => [...el.attributes].flatMap((a) => (a.name === 'class' ? [...el.classList].map((one) => `class=${one}`) : [`${a.name}=${a.value.replace(/\s+/gu, '')}`])).sort().join(' ');
    out.push({kind: 'page', what: `html[${attrs(document.documentElement)}] body[${attrs(document.body)}]`, owner: 'page', single: true});
    const layers = globalThis[Symbol.for('sf.layerStack')]?.layers ?? [];
    for (const layer of layers) out.push({kind: 'registry', what: `layer stack: ${layer.kind || 'layer'} <${layer.owner?.localName || '?'}>`, owner: 'core'});
    const surfaces = globalThis[Symbol.for('sf.openSurfaceLayers')] ?? [];
    for (const one of surfaces) out.push({kind: 'registry', what: `open surface <${one?.localName || '?'}>`, owner: 'core'});
    for (let i = 0; i < (globalThis.__sfPageLanguage?.listeners?.size ?? 0); i += 1) out.push({kind: 'registry', what: 'language listener', owner: 'core'});
    for (let i = 0; i < (globalThis.__sfLanguageWatch?.elements?.size ?? 0); i += 1) out.push({kind: 'registry', what: '[lang] watch', owner: 'core'});
    return out;
  }

  // Settled: no one-shot timer of a second or less, frame or idle callback is
  // pending (a debounce, a closing animation's end). A loop keeps re-arming
  // and is still there after `limit` ms: it is counted.
  function quiet(limit = 3000) {
    const short = () => [...timers.values()].some((one) => one.kind === 'frame' || one.kind === 'idle' || (one.kind === 'timeout' && one.delay <= 1000));
    const until = performance.now() + limit;
    return new Promise((done) => {
      const look = () => (!short() || performance.now() > until ? done(short()) : nativeTimeout(look, 25));
      nativeTimeout(look, 0);
    });
  }

  window.__sfScopeProbe = {quiet, build, drawn, removeHosts, placeAgain, placedAgainProblems, sizes, interact, count};
})();

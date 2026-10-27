// The page side of an assembly (standard simai.smart-component 1.3.8 §7):
// the custom element an assembly's tag defines, and the view its bus asks for
// what lives in the DOM — the layout and its `<x-role>` places (§7.3), a
// panel repeated per entry (§7.2.3), `if` and `hidden` (§7.2.2), when a part
// starts and when a closed container defers its reads (§7.2.1), keys kept in
// the address (§7.5), the live region (§7.4.1), and errors as the base event
// `sf-component-error` (§4.1).
//
// CSP: no eval, no inline handlers, no style attributes; a layout is parsed by
// a <template> and only text is written from keys.

import {pageLocale, language} from '../page-language.js';
import {AssemblyCore} from './core.mjs';
import {interfaces} from './definition.mjs';
import {record} from './journal.mjs';
import {PART_LINK, assemblyLink, createLink, domNames} from './link.mjs';
import {camel, fromAttribute, isObject, own, typeOf} from './values.mjs';

const STORE = (() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : {};
  const key = '__sfAssemblyHosts';
  if (!root[key]) root[key] = {definitions: new Map(), instances: new Map()};
  return root[key];
})();

/** The definitions of the page's assembly tags and the running instances by path (§7.1.1). */
export const definitions = STORE.definitions;
export const instances = STORE.instances;

const OWNED = Symbol.for('sf.assembly.owned');
const EARLY = Symbol('sf.assembly.early');
const CONTROLS = 'input, select, textarea, button, fieldset';
const PANELS = '[role="tabpanel"], details, [data-sf-panel]';
const nextFrame = (fn) => (typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(() => fn()) : globalThis.setTimeout(fn, 0));

/** The default way a part's module is fetched when the part starts (§7.2.1): the Loader's. */
function loadByLoader(tag) {
  const loader = globalThis.SF?.Loader;
  if (typeof loader?.ensureSmartElementLoaded === 'function') loader.ensureSmartElementLoaded(tag);
}

class HostView {
  constructor(host, definition, options = {}) {
    this.host = host;
    this.def = definition;
    this.loadPart = options.loadPart ?? loadByLoader;
    this.places = new Map();
    this.repeats = new Map();
    this.ifs = [];
    this.texts = new Map();
    this.deferred = new Set();
    this.watched = new Set();
    this.stopped = new Set();
    this.disabled = new Map();
    this.checkQueued = false;
    this.top = !host[OWNED];
  }

  // ---------- the layout (§7.3) ----------
  build(core) {
    this.core = core;
    const {host} = this;
    host.setAttribute('data-sf-assembly', this.def.tag);
    host.setAttribute('data-sf-instance', core.id);
    const names = Object.keys(this.def.layouts);
    const wanted = host.getAttribute('layout');
    const name = wanted && this.def.layouts[wanted] !== undefined ? wanted : (this.def.layouts.default !== undefined ? 'default' : names[0]);
    if (wanted && name !== wanted) core.error('layout', `${this.def.tag} has no layout "${wanted}"`);
    this.layoutName = name ?? null;
    this.box = this.parse(name);
    this.findPlaces(this.box, Boolean(name));
    this.mountAnnouncer();
    host.append(this.box);
    this.unlanguage = language.onChange(() => core.relanguage());
    core.scope.signal.addEventListener('abort', () => this.unlanguage?.(), {once: true});
  }

  parse(name) {
    const box = globalThis.document.createElement('div');
    box.setAttribute('data-sf-layout', name ?? '');
    const html = name ? this.def.layouts[name] : '';
    if (html) {
      const template = globalThis.document.createElement('template');
      template.innerHTML = html;
      box.append(template.content.cloneNode(true));
    }
    return box;
  }

  findPlaces(box, hasLayout) {
    const all = [...box.querySelectorAll('x-role')];
    for (const [roleName, role] of this.def.roles) {
      let place = all.find((one) => one.getAttribute('name') === roleName);
      if (!place) {
        place = globalThis.document.createElement('x-role');
        place.setAttribute('name', roleName);
        box.append(place);
        if (hasLayout) this.core.log('warn', `the layout has no <x-role name="${roleName}">; the part is placed at the end`, {}, 'warn');
      }
      place.setAttribute('data-sf-place', roleName);
      this.places.set(roleName, place);
      if (role.each) {
        const panel = place.parentElement?.closest(PANELS);
        if (panel && box.contains(panel)) { // §7.2.3: the panel around <x-role> repeats per entry
          const marker = globalThis.document.createComment(`sf-repeat ${roleName}`);
          panel.replaceWith(marker);
          this.repeats.set(roleName, {template: panel, marker});
        }
      }
    }
    for (const element of box.querySelectorAll('[if]')) {
      if (element.localName === 'x-role') continue;
      this.ifs.push({element, flag: element.getAttribute('if'), marker: globalThis.document.createComment(`sf-if ${element.getAttribute('if')}`)});
    }
    this.bindTexts(box);
  }

  /** `{{key}}` in a layout's text: the key's value as text, nothing else (§7.3). */
  bindTexts(box) {
    const walker = globalThis.document.createTreeWalker(box, globalThis.NodeFilter.SHOW_TEXT);
    const found = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.data.includes('{{')) found.push(node);
    for (const node of found) {
      const parts = node.data.split(/(\{\{\s*[\w-]+\s*\}\})/);
      const nodes = parts.map((part) => {
        const match = /^\{\{\s*([\w-]+)\s*\}\}$/.exec(part);
        const text = globalThis.document.createTextNode(match ? '' : part);
        if (match) {
          if (!this.def.keys.has(match[1])) this.core.error('layout', `the layout shows {{${match[1]}}}, which is not a key`);
          if (!this.texts.has(match[1])) this.texts.set(match[1], []);
          this.texts.get(match[1]).push(text);
        }
        return text;
      });
      node.replaceWith(...nodes);
    }
  }

  roleFlags(roleName) {
    const place = this.places.get(roleName);
    return this.ifs.filter(({element}) => element.contains(place)).map(({flag}) => flag);
  }

  mountAnnouncer() {
    const announces = this.def.manifest.accessibility?.announces ?? this.def.manifest.announces;
    if (!isObject(announces)) return;
    this.announces = Object.fromEntries(own(announces));
    this.live = globalThis.document.createElement('div');
    this.live.className = 'sr-only';
    this.live.setAttribute('data-sf-announce', '');
    this.live.setAttribute('aria-live', Object.values(this.announces).includes('assertive') ? 'assertive' : 'polite');
    this.box.append(this.live);
  }

  /** Switching a layout moves the parts with their state (§7.3). */
  useLayout(name) {
    if (this.def.layouts[name] === undefined) { this.core.error('layout', `${this.def.tag} has no layout "${name}"`); return false; }
    const parts = [];
    for (const state of this.core.roles.values()) for (const rec of state.parts.values()) parts.push(rec);
    const oldBox = this.box;
    const oldPlaces = new Map(this.places);
    this.places.clear();
    this.repeats.clear();
    this.ifs = [];
    this.texts.clear();
    this.layoutName = name;
    this.box = this.parse(name);
    this.findPlaces(this.box, true);
    if (this.live) this.box.append(this.live);
    for (const rec of parts) {
      const repeat = this.repeats.get(rec.role);
      if (repeat && rec.entry) {
        const panel = rec.panel ?? this.panelFor(rec, repeat);
        repeat.marker.before(panel);
      } else {
        this.places.get(rec.role).append(rec.element);
        rec.panel?.remove();
        rec.panel = null;
      }
      const old = oldPlaces.get(rec.role);
      if (old?.hidden) this.places.get(rec.role).hidden = true;
    }
    oldBox.replaceWith(this.box);
    for (const [roleName] of this.def.roles) {
      const state = this.core.roles.get(roleName);
      if (state) state.flags = [state.role.if, ...this.roleFlags(roleName)].filter(Boolean);
    }
    this.core.syncShown(null);
    this.keysChanged(this.core, new Set(this.def.keys.keys()));
    this.host.setAttribute('layout', name);
    this.queueCheck();
    return true;
  }

  // ---------- parts ----------
  interfaceOf(tag) { return interfaces.of(tag); }
  isAssembly(tag) { return definitions.has(tag); }

  panelFor(rec, repeat) {
    const panel = repeat.template.cloneNode(true);
    panel.setAttribute('data-entry', rec.entryId);
    if (panel.localName === 'details') panel.open = false; else panel.hidden = true;
    const place = [...panel.querySelectorAll('x-role')].find((one) => one.getAttribute('name') === rec.role) ?? panel;
    place.append(rec.element);
    rec.panel = panel;
    return panel;
  }

  createPart(rec, context) {
    const tag = rec.def.tag;
    const element = globalThis.document.createElement(tag);
    rec.element = element;
    element[OWNED] = true;
    element.setAttribute('data-sf-role', rec.entry ? `${rec.role}[${rec.entryId}]` : rec.role);
    element.setAttribute('data-sf-instance', rec.instanceId);
    if (rec.def.start !== 'now') {
      element.setAttribute('data-sf-start', rec.def.start);
      element.setAttribute('aria-busy', 'true');
    }
    this.stopAtFrame(rec.iface, tag);
    const repeat = this.repeats.get(rec.role);
    if (repeat && rec.entry) repeat.marker.before(this.panelFor(rec, repeat));
    else {
      const place = this.places.get(rec.role);
      if (!rec.entry && place.firstChild) element.append(...place.childNodes); // a container's panels from the layout
      place.append(element);
    }
    if (definitions.has(tag)) {
      const child = adopt(element, definitions.get(tag), {
        instanceId: rec.instanceId,
        signal: context.signal,
        frame: {
          report: (values, options) => context.report(values, options),
          emit: (verb, detail, options) => context.emit(verb, detail, options),
        },
      });
      return child ? assemblyLink(child) : null;
    }
    return createLink(element, rec.iface, context);
  }

  /** A part's events stop at the assembly: the page sees the assembly's own events only (§7.4). */
  stopAtFrame(iface, tag) {
    for (const [verb, def] of Object.entries(iface.events ?? {})) {
      for (const name of domNames(tag, verb, def)) { // native input and change too: nothing crosses by itself
        if (this.stopped.has(name)) continue;
        this.stopped.add(name);
        this.host.addEventListener(name, (event) => { if (event.target !== this.host) event.stopPropagation(); }, {signal: this.core.scope.signal});
      }
    }
  }

  // ---------- when a part starts (§7.2.1) ----------
  awaitStart(rec, mode) {
    this.deferred.add(rec);
    if (mode === 'visible' && !this.visible && typeof globalThis.IntersectionObserver === 'function') {
      this.visible = new globalThis.IntersectionObserver((seen) => {
        for (const one of seen) {
          if (!one.isIntersecting) continue;
          const rec = [...this.deferred].find((candidate) => candidate.element === one.target);
          this.visible.unobserve(one.target);
          if (rec && !this.closed(rec.element)) this.core.startPart(rec, 'visible');
        }
      });
    }
    this.observe();
    this.queueCheck();
  }

  observe() {
    if (this.mutations || typeof globalThis.MutationObserver !== 'function') return;
    this.mutations = new globalThis.MutationObserver(() => this.queueCheck());
    this.mutations.observe(this.host, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open', 'aria-expanded']});
  }

  queueCheck() {
    if (this.checkQueued) return;
    this.checkQueued = true;
    globalThis.queueMicrotask(() => { this.checkQueued = false; this.check(); });
  }

  /** Whether something between the part and the assembly host is closed (§7.2.1). */
  closed(element) {
    if (!element?.isConnected || !this.host.isConnected) return true;
    for (let node = element.parentElement; node && node !== this.host; node = node.parentElement) {
      if (node.hidden || node.getAttribute('aria-expanded') === 'false') return true;
      if ((node.localName === 'details' || node.localName === 'dialog') && !node.open) return true;
    }
    return false;
  }

  check() {
    if (!this.core || this.core.disposed) return;
    for (const rec of [...this.deferred]) {
      if (rec.started) { this.deferred.delete(rec); this.watched.add(rec); continue; }
      if (rec.scope.signal.aborted) { this.deferred.delete(rec); continue; }
      if (rec.def.start === 'opened' && !this.closed(rec.element)) {
        this.deferred.delete(rec);
        this.watched.add(rec);
        this.core.startPart(rec, 'opened');
      } else if (rec.def.start === 'visible' && this.visible && !rec.observed && !this.closed(rec.element)) {
        rec.observed = true;
        this.visible.observe(rec.element);
      }
    }
    for (const rec of [...this.watched]) {
      if (rec.scope.signal.aborted) { this.watched.delete(rec); continue; }
      if (rec.element?.isConnected || !this.host.isConnected) this.core.setClosed(rec, this.closed(rec.element));
    }
  }

  startPart(rec) {
    const element = rec.element;
    element.removeAttribute('aria-busy');
    element.setAttribute('data-sf-started', '');
    if (rec.def.start !== 'now') this.watched.add(rec);
    if (!definitions.has(rec.def.tag) && !globalThis.customElements?.get(rec.def.tag)) this.loadPart(rec.def.tag);
  }

  busy(rec, on) {
    if (on) rec.element?.setAttribute('aria-busy', 'true');
    else rec.element?.removeAttribute('aria-busy');
  }

  // ---------- if, hidden, entries (§7.2.2, §7.2.3) ----------
  show(roleName, present, hidden) {
    const place = this.places.get(roleName);
    if (!place) return;
    place.sfMarker ??= globalThis.document.createComment(`sf-if ${roleName}`);
    if (!present && place.parentNode) place.replaceWith(place.sfMarker);
    if (present && !place.parentNode && place.sfMarker.parentNode) place.sfMarker.replaceWith(place);
    if (place.hidden !== hidden) {
      place.hidden = hidden;
      this.disableControls(roleName, place, hidden);
    }
    this.queueCheck();
  }

  /** A part hidden by `hidden` submits nothing and does not block the submit (§7.2.2). */
  disableControls(roleName, place, hidden) {
    if (hidden) {
      const changed = [];
      for (const control of place.querySelectorAll('*')) {
        const formControl = control.matches(CONTROLS) || control.constructor?.formAssociated === true;
        if (formControl && 'disabled' in control && !control.disabled) { control.disabled = true; changed.push(control); }
      }
      this.disabled.set(roleName, changed);
    } else {
      for (const control of this.disabled.get(roleName) ?? []) control.disabled = false;
      this.disabled.delete(roleName);
    }
  }

  order(roleName, recs) {
    const repeat = this.repeats.get(roleName);
    const nodes = recs.map((rec) => (repeat ? rec.panel : rec.element)).filter(Boolean);
    if (!nodes.length) return;
    const parent = repeat ? repeat.marker.parentNode : this.places.get(roleName);
    if (!parent) return;
    const present = [...parent.childNodes].filter((node) => nodes.includes(node));
    if (present.length === nodes.length && present.every((node, i) => node === nodes[i])) return; // moving a part reconnects it: only when needed
    for (const node of nodes) {
      if (repeat) repeat.marker.before(node);
      else parent.append(node);
    }
  }

  removePart(rec) {
    this.deferred.delete(rec);
    this.watched.delete(rec);
    if (rec.element && this.visible) this.visible.unobserve(rec.element);
    (rec.panel ?? rec.element)?.remove();
  }

  refuse(roleName, reason) {
    const place = this.places.get(roleName);
    place?.setAttribute('data-sf-refused', reason);
  }

  // ---------- keys shown, kept, announced ----------
  keysChanged(core, dirty) {
    for (const key of dirty) {
      for (const node of this.texts.get(key) ?? []) {
        const value = core.keys[key];
        node.data = value === null || value === undefined ? '' : (typeof value === 'object' ? '' : String(value));
      }
    }
    for (const one of this.ifs) {
      const key = one.flag.replace(/^!/, '');
      if (!dirty.has(key) && one.applied !== undefined) continue;
      const on = core.flag(one.flag);
      one.applied = on;
      if (!on && one.element.parentNode) one.element.replaceWith(one.marker);
      if (on && !one.element.parentNode && one.marker.parentNode) one.marker.replaceWith(one.element);
    }
    if (this.announces) this.announce(core, dirty);
    if (this.ifs.length) this.queueCheck();
  }

  announce(core, dirty) {
    const locale = pageLocale(this.host);
    const said = [];
    for (const [name, key] of core.def.values) {
      if (!this.announces[name] || !dirty.has(key)) continue;
      const value = core.keys[key];
      if (value === null || value === undefined) continue;
      const label = core.def.words.text(locale, `values.${name}`);
      const shown = typeOf(core.def.keys.get(key)) === 'state' ? core.def.words.text(locale, `runtime.states.${value}`) : String(value);
      if (shown === null) continue; // a data state is never announced as is (§7.4.1)
      said.push(label ? `${label}: ${shown}` : shown);
    }
    if (said.length) this.live.textContent = said.join('. ');
  }

  /** Keys kept in the address or in the browser (§7.5); read once at start. */
  restore(persisted) {
    const out = [];
    if (!persisted.length) return out;
    if (!this.top) { record(this.core.id, 'warn', 'persist is kept by the top assembly only; a nested one keeps its keys in memory', {}, 'warn'); return out; }
    this.persisted = persisted;
    const url = persisted.filter(([, where]) => where === 'url').map(([name]) => name);
    const local = persisted.filter(([, where]) => where === 'local').map(([name]) => name);
    for (const [name, where] of persisted) if (where !== 'url' && where !== 'local') record(this.core.id, 'warn', `persist "${where}" of "${name}" needs the host; kept in memory`, {}, 'warn');
    out.push(...this.readAddress(url));
    for (const name of local) {
      try {
        const raw = globalThis.localStorage?.getItem(this.storageKey(name));
        if (raw !== null && raw !== undefined) out.push([name, JSON.parse(raw)]);
      } catch {
        // storage blocked: the key starts from its initial value
      }
    }
    this.urlKeys = url;
    if (url.length && typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('popstate', () => { // Back and Forward bring the keys back (§7.5)
        const changed = this.readAddress(url, true);
        if (changed.length) this.core.restore(changed);
      }, {signal: this.core.scope.signal});
    }
    return out;
  }

  storageKey(name) { return `sf-assembly:${this.core.id}:${name}`; }

  readAddress(names, all = false) {
    const out = [];
    if (!names.length) return out;
    let query;
    try { query = new globalThis.URLSearchParams(globalThis.location?.search ?? ''); } catch { return out; }
    for (const name of names) {
      const def = this.def.keys.get(name);
      const raw = query.get(name);
      if (raw === null) { if (all) out.push([name, this.def.initial(name)]); continue; }
      const value = typeOf(def) === 'list' || typeOf(def) === 'object' ? safeJson(raw) : fromAttribute(def, raw);
      out.push([name, value]);
    }
    return out;
  }

  persist(core, dirty, fromAddress) {
    if (!this.persisted || !this.top) return;
    let address = false;
    for (const [name, where] of this.persisted) {
      if (!dirty.has(name)) continue;
      if (where === 'url') address = true;
      if (where === 'local') {
        try { globalThis.localStorage?.setItem(this.storageKey(name), JSON.stringify(core.keys[name])); } catch { /* storage blocked */ }
      }
    }
    if (!address || fromAddress || !globalThis.history?.pushState) return;
    const query = new globalThis.URLSearchParams(globalThis.location.search);
    for (const name of this.urlKeys ?? []) {
      const value = core.keys[name];
      const initial = this.def.keys.get(name).initial ?? null;
      if (value === null || value === undefined || JSON.stringify(value) === JSON.stringify(initial)) query.delete(name);
      else query.set(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const text = query.toString();
    const next = `${globalThis.location.pathname}${text ? `?${text}` : ''}${globalThis.location.hash}`;
    if (next !== `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`) {
      globalThis.history.pushState(globalThis.history.state, '', next);
      core.log('address', `the address is ${next}`);
    }
  }

  // ---------- the rest ----------
  locale(rec) { return pageLocale(rec?.element?.isConnected ? rec.element : this.host); }

  error(kind, text, data = {}) {
    this.host.dispatchEvent(new globalThis.CustomEvent('sf-component-error', {bubbles: true, composed: true, detail: {kind, text, instance: this.core?.id ?? null, ...pick(data)}}));
  }

  focus(which) { this.host[which]?.(); }

  started(core) {
    this.keysChanged(core, new Set(this.def.keys.keys())); // the layout's {{key}} and if from the first values
    this.queueCheck();
  }

  dispose() {
    this.mutations?.disconnect();
    this.visible?.disconnect();
    this.deferred.clear();
    this.watched.clear();
    this.unlanguage?.();
  }
}

const pick = (data) => Object.fromEntries(Object.entries(data).filter(([, value]) => value === null || typeof value !== 'object'));
const safeJson = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

/** Start an assembly element that a parent placed: its parent runs it and ends it (§7.7). */
function adopt(element, definition, options) {
  const registry = globalThis.customElements;
  if (registry && !registry.get(definition.tag)) return null;
  registry?.upgrade?.(element);
  if (typeof element.sfAdopt !== 'function') return null;
  return element.sfAdopt(options);
}

/** The custom element class of an assembly tag (§7.4: an assembly has the same interface as a leaf). */
export function elementClass(definition, options = {}) {
  const Base = globalThis.HTMLElement;
  const scalar = definition.settingProps.filter(({def}) => !['list', 'object'].includes(typeOf(def)));
  const attributes = new Map(scalar.map((one) => [one.name, one]));

  class SfAssembly extends Base {
    static get observedAttributes() { return [...attributes.keys()]; }
    static sfDefinition = definition;
    static sfInterface = definition.iface;

    #core = null;
    #leaving = false;

    get [EARLY]() { return (this._sfEarly ??= Object.create(null)); }

    get sfCore() { return this.#core; }

    connectedCallback() {
      if (this[OWNED]) return; // its parent runs it
      if (this.#core && !this.#core.disposed) { this.#leaving = false; return; }
      this.#startTop();
    }

    disconnectedCallback() {
      if (this[OWNED] || !this.#core) return;
      this.#leaving = true;
      nextFrame(() => { // taken out and not placed again in the same frame: its scope ends (§7.7)
        if (!this.#leaving || this.isConnected) return;
        this.#leaving = false;
        this.#end();
      });
    }

    attributeChangedCallback(name, previous, value) {
      const one = attributes.get(name);
      if (!one || previous === value) return;
      const parsed = fromAttribute(one.def, value);
      if (this.#core) this.#core.setSetting(name, parsed);
      else this[EARLY][name] = parsed;
    }

    /** The parent placed this element in a role: it runs the instance (§7.1.1, §7.4). */
    sfAdopt({instanceId, frame, signal}) {
      if (this.#core) return this.#core;
      this[OWNED] = true;
      const view = new HostView(this, definition, options);
      this.#core = new AssemblyCore(definition, {instanceId, frame, view, signal, settings: {...this[EARLY]}});
      if (instances.has(instanceId)) this.#core.error('instance', `two instances have the path ${instanceId}`);
      instances.set(instanceId, this.#core);
      signal?.addEventListener('abort', () => { if (instances.get(instanceId) === this.#core) instances.delete(instanceId); }, {once: true});
      return this.#core;
    }

    #startTop() {
      let role = this.getAttribute('data-sf-role') || this.id;
      if (!role) {
        const same = [...globalThis.document.querySelectorAll(this.localName)].filter((one) => !one[OWNED]);
        role = `${this.localName}[${same.indexOf(this) + 1}]`;
        record(`page/${role}`, 'warn', `an instance with neither an id nor data-sf-role takes ${role} (§7.1.1)`, {}, 'warn');
      }
      const instanceId = `page/${role}`;
      if (instances.has(instanceId) && instances.get(instanceId) !== this.#core) {
        record(instanceId, 'instance', `two instances have the path ${instanceId}; the second does not start (§7.1.1)`, {}, 'error');
        this.dispatchEvent(new globalThis.CustomEvent('sf-component-error', {bubbles: true, composed: true, detail: {kind: 'instance', text: `two instances have the path ${instanceId}`, instance: instanceId}}));
        return;
      }
      const settings = {...this[EARLY]};
      for (const [name, one] of attributes) if (this.hasAttribute(name)) settings[name] = fromAttribute(one.def, this.getAttribute(name));
      const host = this;
      const frame = {
        report(values, {origin} = {}) {
          if (origin === 'outside' || origin === 'start') return;
          host.dispatchEvent(new globalThis.CustomEvent('change', {bubbles: true, detail: Object.fromEntries(Object.entries(values).map(([name, value]) => [camel(name), value]))}));
        },
        emit(verb, detail) {
          host.dispatchEvent(new globalThis.CustomEvent(`${definition.tag}-${verb}`, {bubbles: true, composed: true, detail: {...detail}}));
        },
      };
      this.#core = new AssemblyCore(definition, {instanceId, frame, view: new HostView(this, definition, options), settings});
      instances.set(instanceId, this.#core);
      this.#core.start();
    }

    #end() {
      const core = this.#core;
      if (!core) return;
      if (instances.get(core.id) === core) instances.delete(core.id);
      core.dispose();
      this.#core = null;
      this.replaceChildren();
    }

    /** Run an action of the assembly (§4.4): `with` arrives as one object. */
    sfAct(action, args = {}) {
      if (!this.#core) return Promise.resolve({answer: 'unavailable', reason: 'not-started'});
      return Promise.resolve(this.#core.act(action, args));
    }

    act(action, args) { return this.sfAct(action, args); }
    connectPort(port) { return this.sfAct('connect-port', {port}); }
    /** The alias of connect-port (§4.1). */
    setHostPort(port) { return this.connectPort(port); }

    get layout() { return this.getAttribute('layout') ?? 'default'; }
    set layout(name) { this.#core?.view.useLayout(name); }

    /** The keys, their writers and readers (§14). */
    sfKeyMap() { return this.#core?.keyMap() ?? null; }
  }

  // Settings, values and actions as properties and methods (§4.2): camelCase, never over a native member.
  const taken = (name) => name in Base.prototype || name in SfAssembly.prototype;
  for (const {name, def, prop} of definition.settingProps) {
    if (taken(prop)) { record(definition.tag, 'warn', `setting "${name}" is no property: ${prop} is a member of HTMLElement`, {}, 'warn'); continue; }
    Object.defineProperty(SfAssembly.prototype, prop, {
      configurable: true,
      get() { return this.sfCore ? this.sfCore.keys[name] : (this[EARLY][name] ?? def.default ?? null); },
      set(value) {
        if (this.sfCore) this.sfCore.setSetting(name, value);
        else this[EARLY][name] = value; // read when the instance starts
      },
    });
  }
  for (const [name] of own(definition.manifest.values)) {
    const prop = camel(name);
    if (taken(prop)) continue;
    Object.defineProperty(SfAssembly.prototype, prop, {configurable: true, get() { return this.sfCore?.value(name); }});
  }
  for (const [name] of own(definition.manifest.actions)) {
    const prop = camel(name);
    if (taken(prop)) continue;
    Object.defineProperty(SfAssembly.prototype, prop, {configurable: true, writable: true, value(args = {}) { return this.sfAct(name, args); }});
  }
  return SfAssembly;
}

export {HostView, OWNED, PART_LINK};

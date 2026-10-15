import { isPlainObject } from './canonical.mjs';
import { VALUE_TYPES } from './routing.mjs';

// The interface fragment descriptor (simai.interface-fragment 1.0.0): checked
// here so a package gate, a page and a test read one rule. Returns the list of
// problems, empty when the descriptor holds; never coerces.
export const FRAGMENT_DESCRIPTOR_SCHEMA = 'simai.interface-fragment.v1';

const FIELDS = ['schema', 'id', 'element', 'regions', 'port', 'outputs', 'inputs', 'operation', 'url_state', 'budget'];
const ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const ELEMENT = /^[a-z][a-z0-9]*-[a-z0-9-]+$/u;
const NAME = /^[a-z][a-z0-9-]{0,31}$/u;
const STANDARD = /^[a-z][a-z0-9.-]*$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const OPERATION = /^[a-z][a-z0-9._:-]{0,127}$/u;
const URL_KEY = /^[a-z][a-z0-9_-]{0,63}$/u;

const closed = (value, allowed) => isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
const uniqueList = (value, max, test) => Array.isArray(value) && value.length <= max
  && new Set(value).size === value.length && value.every(test);

function portProblems(ports, where) {
  if (!isPlainObject(ports)) return [`${where}: not an object`];
  const names = Object.keys(ports);
  const problems = names.length > 16 ? [`${where}: more than 16 ports`] : [];
  for (const name of names) {
    const port = ports[name];
    if (!NAME.test(name)) problems.push(`${where}.${name}: name`);
    if (!closed(port, ['value', 'summary'])) { problems.push(`${where}.${name}: undeclared keys`); continue; }
    if (!Object.hasOwn(VALUE_TYPES, port.value)) problems.push(`${where}.${name}: unknown value type ${port.value}`);
    if (typeof port.summary !== 'string' || !port.summary.trim() || port.summary.length > 1000) problems.push(`${where}.${name}: summary`);
  }
  return problems;
}

export function checkFragmentDescriptor(descriptor) {
  if (!isPlainObject(descriptor)) return ['descriptor: not an object'];
  const problems = [];
  const keys = Object.keys(descriptor);
  for (const field of FIELDS) if (!keys.includes(field)) problems.push(`${field}: required`);
  for (const key of keys) if (!FIELDS.includes(key)) problems.push(`${key}: undeclared`);
  if (descriptor.schema !== FRAGMENT_DESCRIPTOR_SCHEMA) problems.push('schema: not simai.interface-fragment.v1');
  if (typeof descriptor.id !== 'string' || !ID.test(descriptor.id)) problems.push('id: a dotted identity');
  if (typeof descriptor.element !== 'string' || !ELEMENT.test(descriptor.element)) problems.push('element: a custom element name');
  if (!uniqueList(descriptor.regions, 8, (region) => typeof region === 'string' && NAME.test(region)) || !descriptor.regions.length) problems.push('regions: one to eight region names');
  const port = descriptor.port;
  if (!closed(port, ['standard', 'version']) || !STANDARD.test(port?.standard ?? '') || !VERSION.test(port?.version ?? '')) problems.push('port: {standard, version}');
  if ('outputs' in descriptor) problems.push(...portProblems(descriptor.outputs, 'outputs'));
  if ('inputs' in descriptor) problems.push(...portProblems(descriptor.inputs, 'inputs'));
  if (typeof descriptor.operation !== 'string' || !OPERATION.test(descriptor.operation)) problems.push('operation: an access operation token');
  if (!uniqueList(descriptor.url_state, 16, (key) => typeof key === 'string' && URL_KEY.test(key))) problems.push('url_state: up to sixteen query keys');
  const budget = descriptor.budget;
  if (!closed(budget, ['kb', 'first_answer_ms'])
    || !Number.isSafeInteger(budget.kb) || budget.kb < 0 || budget.kb > 2048
    || !Number.isSafeInteger(budget.first_answer_ms) || budget.first_answer_ms < 0 || budget.first_answer_ms > 10000) problems.push('budget: {kb 0-2048, first_answer_ms 0-10000}');
  return problems;
}

// The page host as an endpoint (simai.interface-fragment, host-is-an-endpoint).
// A product's port answers carry `effects` -- [{type: 'record-changed.v1',
// value}, ...] -- and the page publishes them on this element's outputs, one
// output per value type, named by the type without its version
// (record-changed, files-moved ...). The routes the page declares deliver them
// to the fragments that listen; the host never calls a fragment itself.
//
//   <sf-composition-scope data-sf-routes='[{"id": "files-refresh",
//       "from": {"endpoint": "host", "port": "collection-changed", "value": "collection-changed.v1"},
//       "to": {"endpoint": "files", "port": "changed", "value": "collection-changed.v1"}}]'>
//     <sf-page-host data-sf-endpoint="host"></sf-page-host>
//     ...
//   </sf-composition-scope>
const PAGE_EFFECT_TYPES = ['record-changed.v1', 'record-removed.v1', 'collection-changed.v1', 'files-moved.v1', 'counter.v1', 'navigation.v1', 'preference-changed.v1'];
const effectPort = (type) => type.replace(/\.v\d+$/u, '');

export function definePageHost(registry = globalThis.customElements) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-page-host');
  if (existing) return existing;
  class SfPageHost extends globalThis.HTMLElement {
    static sfPorts = Object.freeze({
      outputs: Object.freeze(Object.fromEntries(PAGE_EFFECT_TYPES.map((type) => [effectPort(type), type]))),
      inputs: Object.freeze({}),
    });

    connectedCallback() {
      this.hidden = true;
    }

    // The host takes nothing in: what it says, it says from the product.
    sfPortInput() {
      throw new TypeError('sf-page-host has no inputs');
    }

    // Each effect is checked against its value type and published; one that
    // fails its check, or names a type the host does not publish, is refused
    // and reported, and the others still go.
    publish(effects = []) {
      const published = [];
      const refused = [];
      for (const effect of Array.isArray(effects) ? effects : []) {
        const type = effect?.type;
        if (!PAGE_EFFECT_TYPES.includes(type)) {
          refused.push({type: type ?? null, reason: 'type_not_published'});
          continue;
        }
        let value;
        try {
          value = VALUE_TYPES[type].check(effect.value);
        } catch (error) {
          refused.push({type, reason: 'value_invalid', message: String(error?.message ?? error)});
          continue;
        }
        this.dispatchEvent(new globalThis.CustomEvent('sf-port-output', {bubbles: true, detail: {port: effectPort(type), value}}));
        published.push(type);
      }
      if (refused.length) this.dispatchEvent(new globalThis.CustomEvent('sf-page-host-refused', {bubbles: true, detail: {refused}}));
      return {published, refused};
    }
  }
  registry.define('sf-page-host', SfPageHost);
  return SfPageHost;
}

// Effects from wherever an answer arrived: the page host of the scope the
// origin stands in, or the page's only host when the origin stands in none.
export function publishEffects(effects, {origin = null} = {}) {
  if (!Array.isArray(effects) || !effects.length) return {published: [], refused: []};
  const document = globalThis.document;
  const scope = origin?.closest?.('sf-composition-scope');
  const hosts = scope
    ? [...scope.querySelectorAll('sf-page-host')].filter((host) => host.parentElement?.closest('sf-composition-scope') === scope)
    : [...(document?.querySelectorAll('sf-page-host') ?? [])];
  const host = hosts.length === 1 ? hosts[0] : null;
  if (!host || typeof host.publish !== 'function') return {published: [], refused: effects.map((effect) => ({type: effect?.type ?? null, reason: 'no_page_host'}))};
  return host.publish(effects);
}

// The fragment boundary (simai.interface-fragment, failure-is-contained). A
// fragment that throws while it draws (sf-component-error), or whose element
// does not arrive within its load time, is replaced in its place by the error
// state with a retry; the rest of the page and its routes keep working.
// Retry puts the fragment's own markup back and lets it start again.
//
//   <sf-fragment data-sf-fragment="larena.file-manager" load-timeout="10000">
//     <sf-file-manager ...></sf-file-manager>
//   </sf-fragment>
const FRAGMENT_TEXT = {
  ru: {heading: 'Не удалось показать этот блок'},
  en: {heading: 'This block could not be shown'},
};

export function defineFragmentBoundary(registry = globalThis.customElements) {
  if (!registry || typeof globalThis.HTMLElement !== 'function') return null;
  const existing = registry.get('sf-fragment');
  if (existing) return existing;
  class SfFragment extends globalThis.HTMLElement {
    constructor() {
      super();
      this.markup = null;
      this.failed = null;
      this.timer = null;
      this.onError = (event) => {
        if (this.failed) return;
        event.stopPropagation();
        this.fail(event.detail?.phase ?? 'render', event.detail?.message ?? '');
      };
      this.onAction = (event) => {
        if (!this.failed || event.detail?.id !== 'retry') return;
        event.stopPropagation();
        this.retry();
      };
    }

    connectedCallback() {
      if (this.markup === null) this.markup = this.innerHTML;
      this.addEventListener('sf-component-error', this.onError);
      this.addEventListener('sf-empty-state-action', this.onAction);
      if (!this.failed) this.watchLoad();
    }

    disconnectedCallback() {
      clearTimeout(this.timer);
      this.removeEventListener('sf-component-error', this.onError);
      this.removeEventListener('sf-empty-state-action', this.onAction);
    }

    // The fragment's own element: the first custom element it holds.
    get fragmentElement() {
      return [...this.children].find((child) => child.localName.includes('-')) ?? null;
    }

    watchLoad() {
      clearTimeout(this.timer);
      const element = this.fragmentElement;
      if (!element || globalThis.customElements.get(element.localName)) return;
      const limit = Number(this.getAttribute('load-timeout')) || 10000;
      this.timer = setTimeout(() => {
        if (!globalThis.customElements.get(element.localName) && element.isConnected) this.fail('load', `${element.localName} did not load`);
      }, limit);
    }

    text(key) {
      const lang = (this.closest('[lang]')?.getAttribute('lang') || 'en').slice(0, 2);
      return (FRAGMENT_TEXT[lang] ?? FRAGMENT_TEXT.en)[key];
    }

    fail(phase, message) {
      clearTimeout(this.timer);
      this.failed = {phase, message};
      this.setAttribute('data-sf-fragment-state', 'error');
      // The fragment leaves: its elements are disconnected, so its routes and
      // listeners go with it, and what stands in its place is the error state.
      const state = globalThis.document.createElement('sf-empty-state');
      state.setAttribute('kind', 'error');
      state.setAttribute('title', this.text('heading'));
      this.replaceChildren(state);
      this.dispatchEvent(new globalThis.CustomEvent('sf-fragment-error', {
        bubbles: true, composed: true,
        detail: {fragment: this.getAttribute('data-sf-fragment'), phase, message},
      }));
    }

    retry() {
      this.failed = null;
      this.removeAttribute('data-sf-fragment-state');
      this.innerHTML = this.markup ?? '';
      this.watchLoad();
      this.dispatchEvent(new globalThis.CustomEvent('sf-fragment-retry', {bubbles: true, composed: true, detail: {fragment: this.getAttribute('data-sf-fragment')}}));
    }
  }
  registry.define('sf-fragment', SfFragment);
  return SfFragment;
}

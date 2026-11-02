// sf-include: a part of the page loaded from an address -- the successor of
// the retired class units ajax, ajaxload and lazy-load (ui-control
// control/LEGACY-UNITS-RETIREMENT-AND-NEW-PARTS-2026-11-02.md step 3). The old
// ajaxload polled every element once a second and filled it through
// BX.ajax.post, so it worked on Bitrix alone; this is fetch, and for
// load="view" one IntersectionObserver per element, gone after its sighting.
//
//   <sf-include src="/parts/news/" load="view"></sf-include>
//
// While the part loads the element shows a placeholder (an sf-skeleton, or
// the page's slot="placeholder"); when it arrives, the server's HTML in its
// place, cleaned of scripts (partFrom), and the Loader starts the components
// in it; when it does not, a polite error with Retry. Facts:
// sf-include-loaded, sf-include-load-failed. Action: refresh.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, refresh is the
// action and answers an outcome, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {renderIncludeTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// How near the viewport a load="view" part starts loading.
export const VIEW_MARGIN = '200px';

// A <script> stays only as a data block (a JSON island such as
// data-sf-settings, which the components of the part read); any other type,
// or none, is code and is taken out.
const DATA_BLOCK = /(?:^|[/+])json$/u;
// Attributes that take an address: a javascript: one is code.
const ADDRESS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'data']);
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROLS = /[\u0000- \u007f-\u009f]/gu;

function clean(root) {
  for (const script of root.querySelectorAll('script')) {
    const type = (script.getAttribute('type') || '').trim().toLowerCase();
    if (!DATA_BLOCK.test(type)) script.remove();
  }
  for (const element of root.querySelectorAll('*')) {
    for (const {name, value} of [...element.attributes]) {
      const lower = name.toLowerCase();
      if (lower.startsWith('on')) element.removeAttribute(name);
      else if (ADDRESS.has(lower) && value.replace(CONTROLS, '').toLowerCase().startsWith('javascript:')) element.removeAttribute(name);
    }
    // A nested <template>'s content is a document of its own.
    if (element.localName === 'template' && element.content) clean(element.content);
  }
  return root;
}

/**
 * The part a server answered, as markup the element can draw: parsed inert
 * (a <template>, or for a whole document its body), its executable scripts,
 * inline event handlers and javascript: addresses taken out. Not a sanitizer:
 * the part is the site's own markup (SF.sanitizeHtml is for untrusted HTML).
 */
export function partFrom(text, doc = globalThis.document) {
  const source = String(text ?? '');
  if (/<(?:html|body)[\s>]/iu.test(source) && typeof globalThis.DOMParser === 'function') {
    const body = new globalThis.DOMParser().parseFromString(source, 'text/html').body;
    return clean(body).innerHTML;
  }
  const template = doc.createElement('template');
  template.innerHTML = source;
  clean(template.content);
  return template.innerHTML;
}

// The placeholder's line count, clamped to the setting's range.
export function lineCount(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(20, Math.max(1, number)) : 3;
}

const IncludeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    refresh() { return this.fetchPart(); },
  },
});

class SfInclude extends IncludeElement {
  constructor() {
    super();
    // idle | loading | ready | error (vocabulary §3, without empty).
    this._phase = 'idle';
    this._part = '';
    this._run = 0;
    this._request = null;
    this._sight = null;
    this._sightTarget = null;
    // The first load has settled (arrived or failed): a printed picture is
    // kept until then (sfAwaitingData).
    this._settled = false;
    this._connected = false;
  }

  get address() {
    return String(this.src ?? '').trim();
  }

  onConnected() {
    super.onConnected?.();
    this._connected = true;
    // Taken out while loading, its request was aborted with its scope: it
    // loads again now that it is back.
    if (this._phase === 'loading' && !this._request) this._phase = 'idle';
    this.sfHostState('data-loading', this._phase === 'loading');
    this.sfHostState('data-failed', this._phase === 'error');
    this.arm();
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.unwatch();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (!this._connected || oldValue === newValue) return;
    if (name === 'src') this.restart();
    else if (name === 'load' && this._phase === 'idle') {
      this.unwatch();
      this.arm();
    }
  }

  // A printed first paint stays until the first load settles, then the
  // element draws once: the server's picture never turns into the skeleton
  // and back (§5.4).
  sfAwaitingData() {
    return !this._settled && Boolean(this.address) && this.staticMarkup().length > 0;
  }

  afterRender(changedAttributes) {
    super.afterRender?.(changedAttributes);
    // load="view" watches the region, which exists once drawn (or printed).
    if (this._sight && !this._sightTarget?.isConnected) this.unwatch();
    this.arm();
  }

  // Starts the first load: now, or once the region nears the viewport.
  arm() {
    if (!this.isConnected || this._phase !== 'idle' || !this.address) return;
    const Sight = globalThis.IntersectionObserver;
    if (this.load !== 'view' || typeof Sight !== 'function') {
      void this.fetchPart();
      return;
    }
    if (this._sight) return;
    const target = this.querySelector(':scope > .sf-include');
    if (!target) return;
    this._sightTarget = target;
    this._sight = new Sight((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.unwatch();
      void this.fetchPart();
    }, {rootMargin: `${VIEW_MARGIN} 0px`});
    this._sight.observe(target);
  }

  unwatch() {
    this._sight?.disconnect();
    this._sight = null;
    this._sightTarget = null;
  }

  // A new src: the old part and any load in flight are dropped, and the new
  // one is loaded by the same rule as the first (load now or view).
  restart() {
    this._request?.abort();
    this._request = null;
    this._run += 1;
    this.unwatch();
    this._part = '';
    this.setPhase('idle');
    this.arm();
  }

  setPhase(phase) {
    this._phase = phase;
    this.sfHostState('data-loading', phase === 'loading');
    this.sfHostState('data-failed', phase === 'error');
    this.requestComponentUpdate('phase');
  }

  // Resolves once the element itself has drawn (not a part inside it: their
  // sf-after-render bubbles here too), or when the instance ends.
  drawn(signal) {
    return new Promise((resolve) => {
      const done = (event) => {
        if (event?.type === 'sf-after-render' && event.target !== this) return;
        this.removeEventListener('sf-after-render', done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      this.addEventListener('sf-after-render', done);
      signal.addEventListener('abort', done, {once: true});
    });
  }

  // The action refresh, and every load: one request at a time, the newest
  // wins; the instance's scope (§7.7) aborts it when the element is removed.
  async fetchPart() {
    const src = this.address;
    this.unwatch();
    if (!src) return {outcome: 'refused', reason: 'no-src'};
    this._request?.abort();
    const request = new AbortController();
    this._request = request;
    const run = ++this._run;
    const scope = this.sfScope;
    const end = () => request.abort();
    scope.addEventListener('abort', end, {once: true});
    this.setPhase('loading');
    let response = null;
    let text = '';
    let failure = null;
    try {
      response = await globalThis.fetch(src, {credentials: 'same-origin', headers: {Accept: 'text/html'}, signal: request.signal});
      if (response.ok) text = await response.text();
      else failure = {reason: 'http', status: response.status};
    } catch (error) {
      if (request.signal.aborted || run !== this._run) failure = {reason: 'cancelled'};
      else failure = {reason: 'network', status: null, error};
    } finally {
      scope.removeEventListener('abort', end);
      if (this._request === request) this._request = null;
    }
    if (run !== this._run || request.signal.aborted) return {outcome: 'cancelled'};
    this._settled = true;
    if (failure) {
      this.setPhase('error');
      await this.drawn(scope);
      if (run !== this._run) return {outcome: 'cancelled'};
      this.sfEmit('load-failed', {src, status: failure.status ?? null, reason: failure.reason});
      return {outcome: 'refused', reason: failure.reason, status: failure.status ?? null};
    }
    this._part = partFrom(text, this.ownerDocument);
    this.setPhase('ready');
    await this.drawn(scope);
    if (run !== this._run) return {outcome: 'cancelled'};
    this.startParts();
    this.sfEmit('loaded', {src, status: response.status});
    return {outcome: 'applied', status: response.status};
  }

  // The Loader's MutationObserver scans the inserted markup (utilities,
  // class components, Smart tags) after its debounce; the Smart tags of the
  // part are asked for at once, so they draw without waiting it out.
  startParts() {
    const loader = globalThis.SF?.Loader;
    const rules = loader?.getCustomElementRules?.() ?? {};
    const root = this.querySelector(':scope > .sf-include');
    if (!root || typeof loader?.ensureSmartElementLoaded !== 'function') return;
    const tags = new Set();
    for (const element of root.querySelectorAll('*')) {
      const tag = element.localName;
      if (tag.includes('-') && rules[tag] && !globalThis.customElements?.get(tag)) tags.add(tag);
    }
    for (const tag of tags) loader.ensureSmartElementLoaded(tag);
  }

  // Retry: the region holds focus while the part loads again, so it never
  // falls to the page; a new failure hands it to the new Retry.
  async retry() {
    const root = this.querySelector(':scope > .sf-include');
    const focused = Boolean(root && root.contains(this.ownerDocument.activeElement));
    if (focused) root.focus({preventScroll: true});
    const outcome = await this.refresh();
    if (focused && outcome.outcome === 'refused') {
      this.querySelector(':scope > .sf-include .sf-include-retry button')?.focus({preventScroll: true});
    }
    return outcome;
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      phase: this._phase,
      part: this._part,
      lines: lineCount(this.lines),
      ownPlaceholder: this.getSlotContent('placeholder'),
      words: {
        failed: this.sfWord('failed'),
        retry: this.sfWord('retry'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderIncludeTemplate(this.templateContext());
  }
}

SfInclude.define('sf-include');

export {SfInclude};

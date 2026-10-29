// sf-search: the site search of a SIMAI site -- a window with a large rounded
// field and a separate results card under it, over a light scrim; a
// full-screen sheet on a phone. Variant 1 «Прожектор» of the owner's prototype
// (ui-control prototypes/search-and-settings.html, approved 2026-10-30).
//
// The trigger is the page's: an element in the trigger slot (the default slot)
// or one named by `for`; a key opens the window too (`shortcut`, Command or
// Control+K and / by default). The window is a layer of the shared stack
// (standard simai.smart-component 1.3.13 §19, core/js/layer-stack.js),
// registered the way sf-modal registers: the stack orders it, hands it Escape
// and Tab only while it is the top layer, holds the one page lock and gives
// focus back when it closes. It is drawn into a portal at the end of the body,
// carrying the host's language, direction, theme and public variables, so no
// stacking context of the page (a sticky header) holds it under the page.
//
// The results come from a provider -- a function the page gives, the port of
// this component -- or from the built-in provider over a static JSON index
// (`index`). Requests are debounced and a stale one is aborted.
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, open, close and toggle are the actions and
// answer outcomes, the words are the language files'.
import {render, nothing} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {carryLayerOrigin, closeLayer, isTopLayer, landmarksAround, openLayer, returnLayerFocus} from '../../core/js/layer-stack';
import {renderSearchTemplate, renderSearchWindow} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const DEBOUNCE = 120;
const RECENT_LIMIT = 5;
const RESULT_LIMIT = 50;
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let sequence = 0;

const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});

const isMac = () => /Mac|iPhone|iPad|iPod/u.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '');

// `shortcut`: keys separated by spaces, each `mod+k`, `shift+/`, `/`.
export function parseShortcuts(text) {
  return String(text ?? '').trim().split(/\s+/u).filter(Boolean).map((one) => {
    const parts = one.toLowerCase().split('+');
    const key = parts.pop() || '+';
    return {key, mod: parts.includes('mod'), ctrl: parts.includes('ctrl'), meta: parts.includes('meta'), alt: parts.includes('alt'), shift: parts.includes('shift')};
  }).filter((one) => one.key);
}

const plainKey = (shortcut) => !shortcut.mod && !shortcut.ctrl && !shortcut.meta && !shortcut.alt;

export function matchesShortcut(event, shortcut, mac = isMac()) {
  if (String(event.key ?? '').toLowerCase() !== shortcut.key) return false;
  const ctrl = shortcut.ctrl || (shortcut.mod && !mac);
  const meta = shortcut.meta || (shortcut.mod && mac);
  if (Boolean(event.ctrlKey) !== ctrl || Boolean(event.metaKey) !== meta || Boolean(event.altKey) !== shortcut.alt) return false;
  // A single printable key is typed with whatever Shift its layout needs.
  return plainKey(shortcut) ? true : Boolean(event.shiftKey) === shortcut.shift;
}

// aria-keyshortcuts names the keys as the platform presses them.
function ariaShortcuts(list, mac = isMac()) {
  return list.map((one) => [
    one.ctrl || (one.mod && !mac) ? 'Control' : '',
    one.meta || (one.mod && mac) ? 'Meta' : '',
    one.alt ? 'Alt' : '',
    one.shift ? 'Shift' : '',
    one.key.length === 1 ? one.key.toUpperCase() : one.key,
  ].filter(Boolean).join('+')).join(' ');
}

const editable = (node) => node instanceof Element
  && (node.isContentEditable || Boolean(node.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')));

// ------------------------------------------------------------------ the data

const text = (value) => (value === undefined || value === null ? '' : String(value));

/** A provider's answer, or an index, in one shape (component.json provider). */
export function normalizeAnswer(raw) {
  const groups = (Array.isArray(raw?.groups) ? raw.groups : [])
    .map((group) => (typeof group === 'string' ? {id: group, label: group} : {id: text(group?.id), label: text(group?.label ?? group?.id)}))
    .filter((group) => group.id);
  const source = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const items = source.filter((item) => item && text(item.title)).map((item, index) => ({
    id: text(item.id ?? item.href ?? item.url ?? item.action ?? index),
    group: text(item.group),
    title: text(item.title),
    path: Array.isArray(item.path) ? item.path.map(text).join(' › ') : text(item.path),
    href: text(item.href ?? item.url),
    action: text(item.action),
    icon: text(item.icon),
    shortcut: text(item.shortcut),
    text: text(item.text),
  }));
  const popular = (Array.isArray(raw?.popular) ? raw.popular : []).map(text).filter(Boolean);
  return {groups, items, popular};
}

const terms = (query) => query.toLowerCase().split(/\s+/u).filter(Boolean);

/**
 * The built-in provider's matching over a static index: every term of the
 * query is in the title, the path or the entry's text, case-insensitive; a
 * title that starts with the query comes first, then one that holds it, then
 * one that holds every term, then the rest, each in the index's order. The
 * empty query answers the quick actions and the popular queries.
 */
export function searchIndex(index, query) {
  const data = normalizeAnswer(index);
  const q = text(query).trim().toLowerCase();
  if (!q) return {groups: data.groups, items: data.items.filter((item) => item.action), popular: data.popular};
  const words = terms(q);
  const found = [];
  data.items.forEach((item, order) => {
    const title = item.title.toLowerCase();
    const hay = `${title} ${item.path} ${item.text}`.toLowerCase();
    if (!words.every((word) => hay.includes(word))) return;
    let rank = 3;
    if (title.startsWith(q)) rank = 0;
    else if (title.includes(q)) rank = 1;
    else if (words.every((word) => title.includes(word))) rank = 2;
    found.push({item, rank, order});
  });
  found.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return {groups: data.groups, items: found.slice(0, RESULT_LIMIT).map((entry) => entry.item), popular: data.popular};
}

/** A title cut around the first place a term of the query stands in it. */
export function highlight(title, query) {
  const lower = title.toLowerCase();
  const q = text(query).trim().toLowerCase();
  const candidates = q ? [q, ...terms(q)] : [];
  for (const candidate of candidates) {
    const at = lower.indexOf(candidate);
    if (at >= 0) return [title.slice(0, at), title.slice(at, at + candidate.length), title.slice(at + candidate.length)];
  }
  return [title, '', ''];
}

const SearchElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    open() { return this.runOpen(); },
    close({reason} = {}) { return this.runClose({reason}); },
    toggle() { return this.isOpen ? this.runClose({reason: 'close'}) : this.runOpen(); },
  },
});

class SfSearch extends SearchElement {
  constructor() {
    super();
    this._id = `sf-search-${++sequence}`;
    this.isOpen = false;
    this.query = '';
    this.scope = '';
    this.selected = 0;
    this.status = 'idle';
    this.answer = null;
    this.emptyAnswer = null;
    this.popularList = [];
    this.recentList = [];
    this._portal = null;
    this._controller = null;
    this._timer = 0;
    this._index = null;
    this._onDocumentKeydown = (event) => this.onDocumentKeydown(event);
    this._onDocumentClick = (event) => this.onDocumentClick(event);
    this._onHostClick = (event) => this.onHostClick(event);
  }

  // The trigger is the default slot (component.json): the children the page
  // wrote without a slot attribute, taken live like the named ones.
  onConnected() {
    super.onConnected?.();
    const live = this._liveSlotNodes;
    if (live && !live.has('trigger')) {
      const nodes = Array.from(this.children).filter((child) => !child.hasAttribute('slot') && !child.hasAttribute('data-sf-static')
        && child.localName !== 'script' && child.localName !== 'template');
      if (nodes.length) {
        nodes.forEach((node) => node.remove());
        live.set('trigger', nodes);
      }
    }
    document.addEventListener('keydown', this._onDocumentKeydown);
    document.addEventListener('click', this._onDocumentClick);
    this.addEventListener('click', this._onHostClick);
  }

  disconnectedCallback() {
    if (this.isOpen) this.finishClose({emit: false, restoreFocus: false});
    document.removeEventListener('keydown', this._onDocumentKeydown);
    document.removeEventListener('click', this._onDocumentClick);
    this.removeEventListener('click', this._onHostClick);
    super.disconnectedCallback?.();
  }

  afterRender(changed) {
    super.afterRender?.(changed);
    this.syncTriggers();
  }

  get shortcuts() {
    return parseShortcuts(this.shortcut);
  }

  // The page's elements that open the window: the slot's and those `for` names.
  triggers() {
    const own = [].concat(this._liveSlotNodes?.get('trigger') || []).filter((node) => node instanceof Element);
    const ids = String(this.for || '').split(/\s+/u).filter(Boolean);
    const named = ids.map((id) => document.getElementById(id)).filter(Boolean);
    return [...own, ...named];
  }

  syncTriggers() {
    const keys = ariaShortcuts(this.shortcuts);
    for (const trigger of this.triggers()) {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', String(this.isOpen));
      if (this.isOpen) trigger.setAttribute('aria-controls', `${this._id}-dialog`);
      else trigger.removeAttribute('aria-controls');
      if (keys) trigger.setAttribute('aria-keyshortcuts', keys);
      else trigger.removeAttribute('aria-keyshortcuts');
    }
  }

  focusDelegate() {
    const first = this.triggers()[0];
    return first?.querySelector?.('button') ?? first ?? null;
  }

  onHostClick(event) {
    if (event.defaultPrevented || this.isOpen) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !this.contains(target)) return;
    this.runOpen();
  }

  onDocumentClick(event) {
    if (event.defaultPrevented || this.isOpen) return;
    const ids = String(this.for || '').split(/\s+/u).filter(Boolean);
    if (!ids.length || !(event.target instanceof Element)) return;
    const selector = ids.map((id) => `#${globalThis.CSS?.escape ? CSS.escape(id) : id}`).join(', ');
    if (!event.target.closest(selector)) return;
    event.preventDefault();
    this.runOpen();
  }

  onDocumentKeydown(event) {
    if (event.defaultPrevented || event.isComposing || !this.isConnected) return;
    const hit = this.shortcuts.find((shortcut) => matchesShortcut(event, shortcut));
    if (!hit) return;
    if (plainKey(hit) && editable(event.composedPath?.()[0] ?? event.target)) return;
    // An open window under another layer does not take the key.
    if (this.isOpen && !isTopLayer(this)) return;
    event.preventDefault();
    if (this.isOpen) this.focusField({select: true});
    else this.runOpen();
  }

  // ---------------------------------------------------------- open, close

  get contained() {
    return Boolean(this.closest(OVERLAY_CONTAINER));
  }

  runOpen() {
    if (this.isOpen) {
      this.focusField();
      return applied();
    }
    if (!this.sfEmit('open', {}, {cancelable: true})) return refused('prevented');
    this._returnTo = document.activeElement;
    this._returnAncestors = landmarksAround(this._returnTo);
    this.isOpen = true;
    this.query = '';
    this.scope = '';
    this.selected = 0;
    this.status = 'idle';
    this.answer = null;
    this.recentList = this.readRecent();
    this.sfHostState('data-open', true);
    this.mountPortal();
    const contained = this._contained;
    openLayer(this, {
      kind: 'modal',
      locksPage: !contained,
      trapsFocus: true,
      returnTo: this._returnTo,
      lockPage: () => this.lockPage(),
      root: () => this.dialog(),
      focusIn: () => this.focusField(),
      onEscape: (event) => this.onEscape(event),
      onTab: (event) => this.onTab(event),
      place: ({zIndex}) => this.place(zIndex),
    });
    this.renderWindow();
    this.focusField();
    this.syncTriggers();
    this.load('');
    const settle = () => {
      if (!this.isOpen) return;
      this.focusField();
      this.sfEmit('opened', {});
    };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(settle);
    else Promise.resolve().then(settle);
    return applied();
  }

  runClose({reason = 'api', restoreFocus = true} = {}) {
    if (!this.isOpen) return refused('closed');
    if (!this.sfEmit('close', {reason}, {cancelable: true})) return refused('prevented');
    this.finishClose({reason, restoreFocus});
    return applied();
  }

  finishClose({reason = 'api', emit = true, restoreFocus = true} = {}) {
    this.isOpen = false;
    clearTimeout(this._timer);
    this._controller?.abort();
    this._controller = null;
    this.sfHostState('data-open', false);
    const wasTop = closeLayer(this, {restoreFocus: false});
    this.unmountPortal();
    this.syncTriggers();
    // Focus goes back to what had it when the window opened (§19.2): the
    // trigger, or the page where the key was pressed.
    if (restoreFocus) returnLayerFocus(wasTop, this._returnTo, this._returnAncestors);
    if (emit) this.sfEmit('closed', {reason});
  }

  // The portal at the end of the body, or of the overlay container the host
  // stands in (a documentation example), which then frames the window and
  // whose page is not locked.
  mountPortal() {
    const home = this.closest(OVERLAY_CONTAINER) || document.body;
    const portal = document.createElement('div');
    portal.className = 'sf-search-portal';
    portal.setAttribute('data-sf-search-portal', this._id);
    home.append(portal);
    carryLayerOrigin(portal, this, {prefixes: ['--sf-search-']});
    this._portal = portal;
    this._contained = home !== document.body;
    portal.classList.toggle('sf-search-portal--contained', this._contained);
  }

  unmountPortal() {
    if (!this._portal) return;
    render(nothing, this._portal);
    this._portal.remove();
    this._portal = null;
  }

  place(zIndex) {
    if (!this._portal) return;
    if (zIndex === '' || zIndex === undefined) this._portal.style.removeProperty('z-index');
    else this._portal.style.zIndex = String(zIndex);
  }

  // The one page lock (§19.1), as sf-site-header and sf-drawer take it.
  lockPage() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return () => {};
    const gap = Math.max(0, window.innerWidth - root.clientWidth);
    const kept = {root: root.style.overflow, body: body.style.overflow, padding: body.style.paddingInlineEnd};
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
    return () => {
      root.style.overflow = kept.root;
      body.style.overflow = kept.body;
      body.style.paddingInlineEnd = kept.padding;
    };
  }

  dialog() {
    return this._portal?.querySelector('.sf-search-window') ?? null;
  }

  field() {
    return this._portal?.querySelector('.sf-search-input') ?? null;
  }

  focusField({select = false} = {}) {
    const input = this.field();
    if (!input) return;
    input.focus({preventScroll: true});
    if (select) input.select();
  }

  keepFocus(event) {
    // A press on the card keeps the focus in the field (the rows are options
    // of the field's list, not stops of their own); its buttons still click.
    if (!(event.target instanceof Element) || !event.target.closest('input')) event.preventDefault();
  }

  // Escape: a filled field is cleared first, an empty one closes the window.
  onEscape(event) {
    if (event.defaultPrevented || !this.isOpen || !isTopLayer(this)) return false;
    if (this.query) {
      this.setQuery('');
      return true;
    }
    this.close({reason: 'escape'});
    return true;
  }

  // The X in the field: the same two steps as Escape.
  onClearPress() {
    if (this.query) this.setQuery('');
    else this.close({reason: 'close'});
  }

  onTab(event) {
    if (!this.isOpen) return;
    const root = this.dialog();
    const items = root ? Array.from(root.querySelectorAll(FOCUSABLE)).filter((element) => element.getClientRects().length > 0) : [];
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    const active = document.activeElement;
    if (!root.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ---------------------------------------------------------- the field

  onInput(event) {
    this.query = event.target.value;
    this.selected = 0;
    this.scheduleLoad();
    this.renderWindow();
  }

  onFieldKeydown(event) {
    if (event.isComposing) return;
    const count = this._view?.rowCount ?? 0;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.selected = (this.selected + step + count) % count;
      this.renderWindow({reveal: true});
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (count) this.choose(this.selected);
    }
  }

  setQuery(value) {
    const input = this.field();
    if (input) input.value = value;
    this.query = value;
    this.selected = 0;
    this.scheduleLoad();
    this.renderWindow();
    this.focusField();
  }

  setScope(id) {
    this.scope = id;
    this.selected = 0;
    this.renderWindow();
    this.focusField();
  }

  hover(index) {
    if (this.selected === index) return;
    this.selected = index;
    this.renderWindow();
  }

  // A result chosen: the query is recorded, the window closes, and the page
  // hears navigate; unless it takes it, the browser goes to href.
  choose(index) {
    const row = this._view?.rows[index];
    if (!row) return;
    if (row.kind === 'recent') {
      this.setQuery(row.text);
      return;
    }
    const query = this.query.trim();
    if (query) this.recordRecent(query);
    const {item} = row;
    this.runClose({reason: 'api'});
    const detail = {id: item.id, href: item.href, action: item.action, query, group: item.group};
    const allowed = this.sfEmit('navigate', detail, {cancelable: true});
    if (allowed && item.href && !item.action) globalThis.location?.assign(item.href);
  }

  // ---------------------------------------------------------- recent queries

  readRecent() {
    if (!this.recent) return [];
    try {
      const list = JSON.parse(globalThis.localStorage?.getItem(this.recentKey) || '[]');
      return Array.isArray(list) ? list.filter((entry) => typeof entry === 'string' && entry).slice(0, RECENT_LIMIT) : [];
    } catch {
      return [];
    }
  }

  writeRecent(list) {
    this.recentList = list;
    try {
      if (list.length) globalThis.localStorage?.setItem(this.recentKey, JSON.stringify(list));
      else globalThis.localStorage?.removeItem(this.recentKey);
    } catch {
      // Storage refused (a private window, a sandbox): the list lives as long as the page.
    }
  }

  recordRecent(query) {
    if (!this.recent) return;
    const kept = this.readRecent().filter((entry) => entry.toLowerCase() !== query.toLowerCase());
    this.writeRecent([query, ...kept].slice(0, RECENT_LIMIT));
  }

  removeRecent(query) {
    this.writeRecent(this.recentList.filter((entry) => entry !== query));
    this.selected = 0;
    this.renderWindow();
    this.focusField();
  }

  clearRecent() {
    this.writeRecent([]);
    this.selected = 0;
    this.renderWindow();
    this.focusField();
  }

  // ---------------------------------------------------------- the port

  // The provider the page gave, else the built-in one over `index`.
  resolveProvider() {
    if (typeof this.provider === 'function') return this.provider;
    if (this.provider && typeof this.provider.search === 'function') return (query, options) => this.provider.search(query, options);
    const url = String(this.index || '').trim();
    if (!url) return null;
    return async (query) => searchIndex(await this.readIndex(url), query);
  }

  // The index is read once per address; a failed read is tried again next time.
  readIndex(url) {
    if (this._index?.url === url) return this._index.promise;
    const promise = fetch(url, {credentials: 'same-origin'}).then((response) => {
      if (!response.ok) throw new Error(`index ${response.status}`);
      return response.json();
    });
    this._index = {url, promise};
    promise.catch(() => {
      if (this._index?.promise === promise) this._index = null;
    });
    return promise;
  }

  scheduleLoad() {
    clearTimeout(this._timer);
    const query = this.query.trim();
    if (!query) {
      this._controller?.abort();
      this._controller = null;
      this.status = 'ready';
      return;
    }
    this._timer = setTimeout(() => this.load(query), DEBOUNCE);
  }

  async load(query) {
    this._controller?.abort();
    const provider = this.resolveProvider();
    if (!provider) {
      this.status = 'ready';
      this.renderWindow();
      return;
    }
    const controller = new AbortController();
    this._controller = controller;
    if (query) {
      this.status = 'loading';
      this.renderWindow();
    }
    try {
      const answer = normalizeAnswer(await provider(query, {scope: this.scope, signal: controller.signal}));
      if (controller.signal.aborted || !this.isOpen) return;
      if (query) this.answer = {...answer, query};
      else this.emptyAnswer = answer;
      if (answer.popular.length) this.popularList = answer.popular;
      if (query) this.status = answer.items.length ? 'ready' : 'empty';
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError' || !this.isOpen) return;
      if (query) this.status = 'error';
    }
    if (this._controller === controller) this._controller = null;
    this.renderWindow();
  }

  // ---------------------------------------------------------- drawing

  // What the window shows now: sections of rows, the scopes and a message.
  view() {
    const query = this.query.trim();
    const sections = [];
    const rows = [];
    const add = (row) => {
      row.index = rows.length;
      rows.push(row);
      return row;
    };
    const resultRow = (item) => add({
      kind: 'result',
      item,
      title: highlight(item.title, query),
      path: item.path,
      icon: item.icon || (item.action ? 'bolt' : 'description'),
      shortcut: item.action ? item.shortcut : '',
    });
    let scopes = [];
    let message = '';
    let messagePills = [];
    if (!query) {
      if (this.recent && this.recentList.length) {
        sections.push({kind: 'recent', id: `${this._id}-recent`, label: this.sfWord('recent-label'),
          rows: this.recentList.map((entry) => add({kind: 'recent', text: entry, title: [entry, '', ''], path: '', icon: 'history',
            removeLabel: this.sfWord('recent-remove-label', {vars: {query: entry}})}))});
      }
      if (this.popular && this.popularList.length) sections.push({kind: 'popular', texts: this.popularList});
      const actions = this.actions ? (this.emptyAnswer?.items ?? []).filter((item) => item.action) : [];
      if (actions.length) {
        sections.push({kind: 'actions', id: `${this._id}-actions`, label: this.sfWord('actions-label'), rows: actions.map(resultRow)});
      }
      if (!sections.length) message = this.sfWord('start-text');
    } else {
      const answer = this.answer;
      const items = (answer?.items ?? []).filter((item) => this.actions || !item.action);
      const order = [...(answer?.groups ?? [])];
      for (const item of items) if (!order.some((group) => group.id === item.group)) order.push({id: item.group, label: item.group});
      const present = order.filter((group) => items.some((item) => item.group === group.id));
      if (!present.some((group) => group.id === this.scope)) this.scope = '';
      if (!this.scopes) this.scope = '';
      scopes = [{id: '', label: this.sfWord('all-label'), count: items.length, pressed: this.scope === ''},
        ...present.map((group) => ({id: group.id, label: group.label, count: items.filter((item) => item.group === group.id).length, pressed: this.scope === group.id}))];
      const shown = present.filter((group) => !this.scope || group.id === this.scope);
      const captions = !this.scope && (present.length > 1 || present[0]?.label);
      const groups = shown.map((group, n) => ({
        label: group.label || this.sfWord('results-label'),
        captionId: captions && group.label ? `${this._id}-group-${n}` : '',
        rows: items.filter((item) => item.group === group.id).map(resultRow),
      }));
      if (rows.length) sections.push({kind: 'results', id: `${this._id}-results`, groups});
      if (!answer && this.status === 'loading') message = this.sfWord('loading-text');
      else if (this.status === 'error') message = this.sfWord('error-text');
      else if (!rows.length && answer) {
        message = this.sfWord('empty-text', {vars: {query}});
        if (this.popular) messagePills = this.popularList.slice(0, 3);
      }
    }
    if (this.selected >= rows.length) this.selected = Math.max(0, rows.length - 1);
    return {
      sections,
      rows,
      rowCount: rows.length,
      scopes,
      message,
      messagePills,
      activeId: rows.length ? `${this._id}-option-${this.selected}` : '',
    };
  }

  statusText(view) {
    if (!this.query.trim()) return '';
    if (this.status === 'loading' && !this.answer) return this.sfWord('loading-text');
    if (this.status === 'error') return this.sfWord('error-text');
    if (!view.rowCount) return this.answer ? this.sfWord('empty-text', {vars: {query: this.query.trim()}}) : '';
    return this.sfWord('count-text', {count: view.rowCount});
  }

  renderWindow({reveal = false} = {}) {
    if (!this.isOpen || !this._portal) return;
    const view = this.view();
    this._view = view;
    const words = {
      back: this.sfWord('back-label'),
      clear: this.sfWord('clear-label'),
      close: this.sfWord('close-label'),
      scopes: this.sfWord('scopes-label'),
      results: this.sfWord('results-label'),
      popular: this.sfWord('popular-label'),
      recentClear: this.sfWord('recent-clear-label'),
      keySelect: this.sfWord('key-select-label'),
      keyOpen: this.sfWord('key-open-label'),
      keyClear: this.sfWord('key-clear-label'),
      keyClose: this.sfWord('key-close-label'),
    };
    render(renderSearchWindow({
      component: this,
      ids: {dialog: `${this._id}-dialog`, option: (index) => `${this._id}-option-${index}`},
      query: this.query,
      label: this.label,
      placeholder: this.placeholder,
      selected: this.selected,
      status: this.status,
      statusText: this.statusText(view),
      show: {scopes: this.scopes, path: this.path, keys: this.keys},
      words,
      view,
    }), this._portal);
    if (reveal) this._portal.querySelector('.sf-search-row--selected')?.scrollIntoView?.({block: 'nearest'});
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      slot: (name) => this.getSlotContent(name),
      hasSlot: (name) => name === 'trigger' && this.hasSlotContent(name),
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderSearchTemplate(this.templateContext());
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (oldValue === newValue || !this.isOpen) return;
    if (name === 'index') {
      this.answer = null;
      this.emptyAnswer = null;
      this.load(this.query.trim());
    }
    this.renderWindow();
  }
}

SfSearch.define('sf-search');

export {SfSearch};

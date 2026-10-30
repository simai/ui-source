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
// The panel asks a host through simai.search-port 1.0.0 (§4.9, declared in
// component.json): six intents on one event, one answer envelope, every read
// sequenced. It fetches nothing itself -- the index, the ranking, the access
// and what a command does are the host's. The capability says what is
// possible and the setting says what is wanted: a block whose capability the
// host did not announce is absent, and the setting cannot turn it on (owner's
// delegated envelope, 2026-10-29).
//
// The page hands a host with the base action connect-port (`connectPort`), or
// answers the `sf-host-port-request` this element raises once per connection.
// Where it hands none, the built-in hosts of js/host.js answer: the static
// JSON index of `index`, or the `provider` function -- the two simple paths
// the documentation site and Docara use, written as adapters of the same port.
// Requests are debounced and a stale one is aborted through its signal.
//
// From its component.json (§3, §4, §8): the settings are made by
// core/js/element-manifest.js, open, close and toggle are the actions and
// answer outcomes, the words are the language files'.
import {render, nothing} from 'lit';
import SfBaseElement from '../../core/js/smart-base';
import BundledPreferences from '../../core/js/preferences.js';
import {elementFromManifest} from '../../core/js/element-manifest';
import {carryLayerOrigin, closeLayer, isTopLayer, landmarksAround, openLayer, returnLayerFocus} from '../../core/js/layer-stack';
import {renderSearchTemplate, renderSearchWindow} from './js/templates/default';
import {PORT_ID, RESULT_LIMIT, SUPPORTED_PORT_VERSIONS, builtinSearchHost, indexHost, providerHost, recentStore} from './js/host';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const DEBOUNCE = 120;
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
// The port's three answers (no revision travels here, so nothing conflicts).
const ANSWERS = ['applied', 'refused', 'unavailable'];
// Which capability stands behind an intent (simai.search-port 1.0.0): an
// intent of a capability the host did not announce is never raised.
const INTENT_CAPABILITY = {'result.preview': 'preview', 'action.run': 'actions',
  'recent.forget': 'recent', 'recent.clear': 'recent'};
// Which block a setting wants, and the capability it wants it over; path and
// keys are the panel's own, so they have no capability.
const BLOCK_CAPABILITY = {scopes: 'scopes', recent: 'recent', popular: 'popular', actions: 'actions'};
// The step at which the card has room for the preview pane beside the list:
// the Framework's lg (core/scss/vars/_sf_var__breakpoint.scss), as the sheet's
// own media rule reads it.
const PREVIEW_STEP = '60rem';
let sequence = 0;

const applied = () => ({outcome: 'applied'});
const refused = (reason) => ({outcome: 'refused', reason});

// The built-in hosts keep the recent queries as a view preference of the
// person (SF.Preferences, owner 2026-10-14): in the browser under
// sf-pref:sf-search/<recent-key> and by a host that keeps preferences for its
// user. The registry is the shared one when core has published it (every
// bundle has its own copy).
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;

// `shortcut`: keys separated by spaces, each `mod+k`, `shift+/`, `/`.
export function parseShortcuts(text) {
  return String(text ?? '').trim().split(/\s+/u).filter(Boolean).map((one) => {
    const parts = one.toLowerCase().split('+');
    const key = parts.pop() || '+';
    return {key, mod: parts.includes('mod'), ctrl: parts.includes('ctrl'), meta: parts.includes('meta'), alt: parts.includes('alt'), shift: parts.includes('shift')};
  }).filter((one) => one.key);
}

const plainKey = (shortcut) => !shortcut.mod && !shortcut.ctrl && !shortcut.meta && !shortcut.alt;

// mod is Command or Control, whichever the person presses: Command on a Mac,
// Control elsewhere, and either works on both (the answer, and the page's
// printed first paint, are the same on every platform).
export function matchesShortcut(event, shortcut) {
  if (String(event.key ?? '').toLowerCase() !== shortcut.key) return false;
  const ctrl = Boolean(event.ctrlKey);
  const meta = Boolean(event.metaKey);
  if (shortcut.mod) {
    if (ctrl === meta && !(shortcut.ctrl && shortcut.meta)) return false;
    if ((shortcut.ctrl && !ctrl) || (shortcut.meta && !meta)) return false;
  } else if (ctrl !== shortcut.ctrl || meta !== shortcut.meta) return false;
  if (Boolean(event.altKey) !== shortcut.alt) return false;
  // A single printable key is typed with whatever Shift its layout needs.
  return plainKey(shortcut) ? true : Boolean(event.shiftKey) === shortcut.shift;
}

// aria-keyshortcuts names every way to press them: mod as Control and as Meta.
function ariaShortcuts(list) {
  const name = (one, ctrl, meta) => [
    ctrl ? 'Control' : '',
    meta ? 'Meta' : '',
    one.alt ? 'Alt' : '',
    one.shift ? 'Shift' : '',
    one.key.length === 1 ? one.key.toUpperCase() : one.key,
  ].filter(Boolean).join('+');
  return list.flatMap((one) => (one.mod
    ? [name(one, true, one.meta), name(one, one.ctrl, true)]
    : [name(one, one.ctrl, one.meta)])).join(' ');
}

const editable = (node) => node instanceof Element
  && (node.isContentEditable || Boolean(node.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')));

// ------------------------------------------------------------------ the data

const text = (value) => (value === undefined || value === null ? '' : String(value));
const terms = (query) => query.toLowerCase().split(/\s+/u).filter(Boolean);

// A page result with no url is dropped by the panel, never drawn as a row
// that does nothing (simai.search-port 1.0.0, data.results.url).
const drawable = (result) => Boolean(result && text(result.title))
  && (result.kind === 'action' ? true : Boolean(text(result.url)));

const strings = (list) => (Array.isArray(list) ? list.map(text).filter(Boolean) : null);

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
    this.statusMessage = '';
    this.notice = '';
    this.running = false;
    this.answer = null;
    this.emptyAnswer = null;
    this.popularList = [];
    this.recentList = [];
    this.previewOf = null;
    this._portal = null;
    this._controller = null;
    this._timer = 0;
    // The port: what the page handed (sfPort, the base action) is asked first;
    // the built-in host is made from index/provider/recent-key and remade when
    // one of them changes.
    this._builtin = null;
    this._builtinFor = null;
    this._portRequested = false;
    this._querySequence = 0;
    this._previewSequence = 0;
    this._previewMedia = typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia(`(min-width: ${PREVIEW_STEP})`) : null;
    this._onPreviewMedia = () => this.onPreviewRoomChange();
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
    this._previewMedia?.addEventListener?.('change', this._onPreviewMedia);
    this.requestHostPort();
  }

  disconnectedCallback() {
    if (this.isOpen) this.finishClose({emit: false, restoreFocus: false});
    document.removeEventListener('keydown', this._onDocumentKeydown);
    document.removeEventListener('click', this._onDocumentClick);
    this.removeEventListener('click', this._onHostClick);
    this._previewMedia?.removeEventListener?.('change', this._onPreviewMedia);
    // Once per connection, so an element moved in the page asks again: a
    // portless element and a host that chose not to answer look alike.
    this._portRequested = false;
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
    this.statusMessage = '';
    this.notice = '';
    this.answer = null;
    this.previewOf = null;
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
    // The empty query is a question like any other: it is what answers the
    // blocks the host announced -- the recent queries, the popular ones and
    // the commands -- so the panel asks it rather than drawing them itself.
    this.askQuery('');
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
      this.askPreview();
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

  // A scope pressed is the same question as a keystroke (the port: scope is a
  // field of query.change, never an intent of its own), so the host is asked
  // again; the panel also filters what it holds, so the pills answer at once.
  setScope(id) {
    this.scope = id;
    this.selected = 0;
    this.renderWindow();
    this.focusField();
    this.askQuery(this.query.trim());
  }

  hover(index) {
    if (this.selected === index) return;
    this.selected = index;
    this.renderWindow();
    this.askPreview();
  }

  // A result chosen: a page result is opened (result.open), a command is run
  // by the host (action.run). An applied answer closes the window and the
  // page hears navigate; unless it takes it, the browser goes to the url. A
  // refusal is the host's word that this person may not: the window stays
  // open and says so.
  choose(index) {
    const row = this._view?.rows[index];
    if (!row) return undefined;
    if (row.kind === 'recent') {
      this.setQuery(row.text);
      return undefined;
    }
    const {item} = row;
    return item.kind === 'action' ? this.runAction(item) : this.openResult(item);
  }

  async openResult(item) {
    const query = this.query.trim();
    const answer = await this.raise('result.open', {id: item.id, query, group: text(item.group), url: text(item.url) || null});
    if (!answer) return answer;
    if (answer.answer !== 'applied') {
      this.notice = this.answerWords(answer, 'refused-text');
      this.renderWindow();
      return answer;
    }
    this.takeRecent(answer);
    this.runClose({reason: 'api'});
    const detail = {id: item.id, href: text(item.url), action: '', query, group: text(item.group)};
    const allowed = this.sfEmit('navigate', detail, {cancelable: true});
    if (allowed && detail.href) globalThis.location?.assign(detail.href);
    return answer;
  }

  // Only the host knows what a command does, so the panel never guesses: the
  // card is busy while it waits, an applied answer closes the window and the
  // page hears navigate with the command as `action`.
  async runAction(item) {
    const query = this.query.trim();
    this.running = true;
    this.renderWindow();
    const answer = await this.raise('action.run', {id: item.id, query});
    this.running = false;
    if (!answer) return answer;
    if (answer.answer !== 'applied') {
      this.notice = this.answerWords(answer, 'action-text');
      this.renderWindow();
      return answer;
    }
    this.takeRecent(answer);
    this.runClose({reason: 'api'});
    this.sfEmit('navigate', {id: item.id, href: '', action: text(item.id), query, group: text(item.group)}, {cancelable: true});
    return answer;
  }

  // ---------------------------------------------------------- recent queries

  // The recent queries are the host's data: a removal and a clear are
  // answered with the whole list the host keeps now, and that list is what is
  // drawn -- the panel keeps no history of its own.
  takeRecent(answer) {
    const list = strings(answer?.data?.recent);
    if (list) this.recentList = list;
  }

  async forgetRecent(query) {
    const answer = await this.raise('recent.forget', {query: text(query)});
    this.afterRecent(answer);
    return answer;
  }

  async clearRecent() {
    const answer = await this.raise('recent.clear', {});
    this.afterRecent(answer);
    return answer;
  }

  afterRecent(answer) {
    if (!answer) return;
    if (answer.answer === 'applied') this.takeRecent(answer);
    else this.notice = this.answerWords(answer, 'refused-text');
    this.selected = 0;
    this.renderWindow();
    this.focusField();
  }

  // ---------------------------------------------------------- the port

  /**
   * A component that takes a host port asks for one (§4.9): bubbling and
   * composed, once per connection while it has none, answered with
   * `connectPort` at once or later. Until then the built-in host answers.
   */
  requestHostPort() {
    if (this.sfPort || this._portRequested) return false;
    this._portRequested = true;
    this.dispatchEvent(new CustomEvent('sf-host-port-request', {
      bubbles: true,
      composed: true,
      detail: {component: this, context: {owner: null, record: null, group: null}},
    }));
    return true;
  }

  /**
   * The hook of the base action connect-port: a host of another edition is
   * refused (the base answers `port-unsupported` and keeps the port it had).
   * A new host brings its own capabilities, its own recent queries and its
   * own answers, so nothing of the one before is drawn.
   */
  onPortConnected(port) {
    const version = text(port?.version);
    if (typeof port?.raise !== 'function' || !SUPPORTED_PORT_VERSIONS.includes(version)) {
      throw new TypeError(`sf-search speaks ${PORT_ID} ${SUPPORTED_PORT_VERSIONS.join(', ')}`);
    }
    this.answer = null;
    this.emptyAnswer = null;
    this.recentList = [];
    this.popularList = [];
    this.previewOf = null;
    this.notice = '';
    this.statusMessage = '';
    this.scope = '';
    if (this.isOpen) this.askQuery(this.query.trim());
  }

  /** The host in force: the page's, else the built-in one. */
  host() {
    const connected = this.sfPort;
    if (connected && typeof connected.raise === 'function') return connected;
    return this.builtinHost();
  }

  /**
   * The built-in host (js/host.js): the provider the page gave, else the
   * static index of `index`, else the port's base host, which announces
   * nothing and answers an empty list -- the field, the results and the
   * keyboard, which need no capability.
   */
  builtinHost() {
    const provider = typeof this.provider === 'function' || typeof this.provider?.search === 'function' ? this.provider : null;
    const url = provider ? '' : text(this.index).trim();
    const key = text(this.recentKey).trim();
    const was = this._builtinFor;
    if (this._builtin && was && was.provider === provider && was.url === url && was.key === key) return this._builtin;
    const recent = recentStore({key, preferences});
    this._builtin = provider ? providerHost(provider, {recent})
      : (url ? indexHost(url, {recent}) : builtinSearchHost({recent}));
    this._builtinFor = {provider, url, key};
    return this._builtin;
  }

  /** Whether the host in force announces a capability. */
  hostOffers(capability) {
    return Boolean(this.host()?.capabilities?.includes?.(capability));
  }

  /**
   * Whether a block is drawn: the host announces the capability behind it and
   * the page has not turned the setting off. The capability is the floor and
   * the setting is the veto, so a capability never announced is never drawn
   * as a dead control and a setting cannot turn on what the host cannot do.
   */
  shows(block) {
    const capability = BLOCK_CAPABILITY[block];
    if (capability && !this.hostOffers(capability)) return false;
    return this[block] !== false;
  }

  /** Whether the card has room beside the list and the host has previews. */
  showsPreview() {
    return this.hostOffers('preview') && (this._previewMedia ? this._previewMedia.matches : false);
  }

  onPreviewRoomChange() {
    if (!this.isOpen) return;
    if (!this.showsPreview()) this.previewOf = null;
    this.renderWindow();
    this.askPreview();
  }

  /**
   * One intent, one answer. An intent behind a capability the host did not
   * announce is not raised at all, and a sequenced read whose answer names an
   * older request is dropped (answered null to the caller). Every answer is
   * announced on sf-search-intent, the panel's own included.
   */
  async raise(intent, payload, {signal = null, sequence: asked = null} = {}) {
    const host = this.host();
    const capability = INTENT_CAPABILITY[intent];
    let answer = null;
    if (!host || typeof host.raise !== 'function') answer = {answer: 'unavailable', reason: 'port-not-connected'};
    else if (capability && !this.hostOffers(capability)) answer = {answer: 'unavailable', reason: 'capability-not-provided'};
    else {
      try {
        answer = await host.raise(intent, {...payload}, {signal});
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') return null;
        answer = {answer: 'unavailable', reason: 'host-failed'};
      }
      if (!answer || typeof answer !== 'object' || !ANSWERS.includes(answer.answer)) {
        answer = {answer: 'unavailable', reason: 'answer-not-of-the-port'};
      }
    }
    this.sfEmit('intent', {intent, payload: {...payload}, answer});
    // The sequence rule: a person types faster than a server answers.
    if (asked !== null && answer.sequence !== undefined && answer.sequence !== null && Number(answer.sequence) !== asked) return null;
    return answer;
  }

  /**
   * The words of an answer that is not applied: the host's own sentence when
   * it sent one (the reader's language, shown as text), else the panel's for
   * the reasons the port names, else the fallback asked for.
   */
  answerWords(answer, fallback) {
    const given = text(answer?.text).trim();
    if (given) return given;
    const word = {'query-too-short': 'short-text', forbidden: 'forbidden-text', 'not-found': 'not-found-text'}[text(answer?.reason)];
    if (word) return this.sfWord(word);
    if (answer?.answer === 'unavailable' && fallback !== 'action-text') return this.sfWord('error-text');
    return this.sfWord(fallback);
  }

  // ---------------------------------------------------------- the reads

  scheduleLoad() {
    clearTimeout(this._timer);
    const query = this.query.trim();
    this.notice = '';
    if (!query) {
      // An empty field starts afresh: the next query waits for its own answer
      // rather than showing the last one's under new marks.
      this._controller?.abort();
      this._controller = null;
      this.answer = null;
      this.statusMessage = '';
      this.status = 'ready';
      return;
    }
    this._timer = setTimeout(() => this.askQuery(query), DEBOUNCE);
  }

  /**
   * What matches now (query.change): a keystroke, a scope pressed, a chosen
   * popular or recent query, an accepted correction, and the empty query the
   * window opens with -- one question for all of them. The empty query is the
   * host's chance to answer the blocks (recent, popular, the commands).
   */
  async askQuery(query) {
    this._controller?.abort();
    const controller = new AbortController();
    this._controller = controller;
    const asked = ++this._querySequence;
    if (query) {
      this.status = 'loading';
      this.renderWindow();
    }
    const answer = await this.raise('query.change', {sequence: asked, query,
      scope: this.scope || null, limit: RESULT_LIMIT, offset: 0}, {signal: controller.signal, sequence: asked});
    if (this._controller === controller) this._controller = null;
    if (!answer || controller.signal.aborted || !this.isOpen || asked !== this._querySequence) return answer;
    if (answer.answer === 'applied') {
      const data = answer.data ?? {};
      const results = (Array.isArray(data.results) ? data.results : []).filter(drawable);
      const echo = data.echo ?? {};
      const scopes = (Array.isArray(data.scopes) ? data.scopes : []).filter((scope) => scope && text(scope.id));
      if (query) {
        // The panel draws the question the host answered, not the one the
        // person has since typed (echo).
        this.answer = {
          query: text(echo.query ?? query),
          scope: text(echo.scope),
          results,
          scopes,
          total: Number.isInteger(data.total) ? data.total : null,
          correction: this.hostOffers('spelling') && text(data.correction?.query) ? data.correction : null,
        };
        this.status = results.length ? 'ready' : 'empty';
        this.statusMessage = '';
      } else {
        this.emptyAnswer = {results, scopes};
      }
      const recent = strings(data.recent);
      if (recent) this.recentList = recent;
      const popular = strings(data.popular);
      if (popular?.length) this.popularList = popular;
    } else if (query) {
      this.answer = null;
      this.status = 'error';
      this.statusMessage = this.answerWords(answer, 'refused-text');
    }
    this.renderWindow();
    this.askPreview();
    return answer;
  }

  /**
   * The words of the row the person stands on (result.preview), asked for
   * only where the host announced the capability and the card has room for
   * the pane. Sequenced like the query: an answer for a row the person has
   * left is dropped.
   */
  async askPreview() {
    if (!this.showsPreview()) {
      if (this.previewOf) {
        this.previewOf = null;
        this.renderWindow();
      }
      return null;
    }
    const row = this._view?.rows?.[this.selected];
    const item = row?.kind === 'result' ? row.item : null;
    if (!item) {
      if (this.previewOf) {
        this.previewOf = null;
        this.renderWindow();
      }
      return null;
    }
    if (this.previewOf && this.previewOf.id === item.id) return null;
    const asked = ++this._previewSequence;
    const answer = await this.raise('result.preview', {sequence: asked, id: item.id, query: this.query.trim()}, {sequence: asked});
    if (!answer || !this.isOpen || asked !== this._previewSequence) return answer;
    const preview = answer.answer === 'applied' && answer.data?.preview ? answer.data.preview : null;
    const standing = this._view?.rows?.[this.selected];
    const on = standing?.kind === 'result' ? standing.item : null;
    // A preview that arrives for a row the person has left is dropped.
    if (preview && on && String(preview.id) !== String(on.id)) return answer;
    this.previewOf = preview ? {id: preview.id, title: text(preview.title), path: text(preview.path), text: text(preview.text)} : null;
    this.renderWindow();
    return answer;
  }

  // ---------------------------------------------------------- drawing

  // What the window shows now: sections of rows, the scopes, a correction, a
  // preview and a message. Every block is drawn only where the host
  // announced its capability and the page left its setting on (shows).
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
      path: text(item.path),
      icon: text(item.icon) || (item.kind === 'action' ? 'bolt' : 'description'),
      shortcut: item.kind === 'action' ? text(item.shortcut) : '',
    });
    const commands = this.shows('actions');
    let scopes = [];
    let correction = null;
    let message = '';
    let messagePills = [];
    if (!query) {
      if (this.shows('recent') && this.recentList.length) {
        sections.push({kind: 'recent', id: `${this._id}-recent`, label: this.sfWord('recent-label'),
          rows: this.recentList.map((entry) => add({kind: 'recent', text: entry, title: [entry, '', ''], path: '', icon: 'history',
            removeLabel: this.sfWord('recent-remove-label', {vars: {query: entry}})}))});
      }
      if (this.shows('popular') && this.popularList.length) sections.push({kind: 'popular', texts: this.popularList});
      const actions = commands ? (this.emptyAnswer?.results ?? []).filter((item) => item.kind === 'action') : [];
      if (actions.length) {
        sections.push({kind: 'actions', id: `${this._id}-actions`, label: this.sfWord('actions-label'), rows: actions.map(resultRow)});
      }
      if (!sections.length) message = this.sfWord('start-text');
    } else {
      const answer = this.answer;
      const items = (answer?.results ?? []).filter((item) => commands || item.kind !== 'action');
      // The scopes the host announced, then any group its results name that
      // it did not: the pills follow the host's order, the panel adds nothing
      // of its own to it.
      const order = [];
      if (this.shows('scopes')) {
        for (const scope of answer?.scopes ?? []) order.push(scope);
        // A group the results name that the host did not announce as a scope
        // is a scope too; a result with no group at all is not one (1.0.0
        // drew it as a nameless pill).
        for (const item of items) {
          const id = text(item.group);
          if (id && !order.some((scope) => scope.id === id)) order.push({id, label: id});
        }
      }
      const present = order.filter((scope) => items.some((item) => item.group === scope.id));
      if (!present.some((scope) => scope.id === this.scope)) this.scope = '';
      // The host's count where it sent one (the whole index), else the number
      // the panel holds, so a pill says what pressing it will show.
      const counted = (scope) => (Number.isInteger(scope.count) ? scope.count : items.filter((item) => item.group === scope.id).length);
      if (present.length) {
        scopes = [{id: '', label: this.sfWord('all-label'), count: Number.isInteger(answer?.total) ? answer.total : items.length, pressed: this.scope === ''},
          ...present.map((scope) => ({id: scope.id, label: text(scope.label) || scope.id, count: counted(scope), pressed: this.scope === scope.id}))];
      }
      const chosen = present.filter((scope) => !this.scope || scope.id === this.scope);
      const ungrouped = this.scope ? [] : items.filter((item) => !present.some((scope) => scope.id === item.group));
      const captions = !this.scope && (present.length > 1 || text(present[0]?.label));
      const groups = [
        ...chosen.map((scope, n) => ({
          label: text(scope.label) || scope.id || this.sfWord('results-label'),
          captionId: captions && text(scope.label) ? `${this._id}-group-${n}` : '',
          rows: items.filter((item) => item.group === scope.id).map(resultRow),
        })),
        ...(ungrouped.length ? [{label: this.sfWord('results-label'), captionId: '', rows: ungrouped.map(resultRow)}] : []),
      ].filter((group) => group.rows.length);
      if (groups.length) sections.push({kind: 'results', id: `${this._id}-results`, groups});
      // «Возможно, вы искали …»: offered, never applied -- accepting it is an
      // ordinary query.
      if (answer?.correction) {
        correction = {query: text(answer.correction.query),
          count: Number.isInteger(answer.correction.total) ? answer.correction.total : null,
          text: this.sfWord('correction-text', {vars: {query: text(answer.correction.query)}})};
      }
      if (!answer && this.status === 'loading') message = this.sfWord('loading-text');
      else if (this.status === 'error') message = this.statusMessage || this.sfWord('error-text');
      else if (!rows.length && answer) {
        message = this.sfWord('empty-text', {vars: {query}});
        if (this.shows('popular')) messagePills = this.popularList.slice(0, 3);
      }
    }
    if (this.selected >= rows.length) this.selected = Math.max(0, rows.length - 1);
    const standing = rows[this.selected];
    const preview = this.showsPreview() && this.previewOf && standing?.kind === 'result'
      && String(standing.item.id) === String(this.previewOf.id) ? this.previewOf : null;
    return {
      sections,
      rows,
      rowCount: rows.length,
      scopes,
      correction,
      preview,
      pane: this.showsPreview(),
      notice: this.notice,
      message,
      messagePills,
      activeId: rows.length ? `${this._id}-option-${this.selected}` : '',
    };
  }

  statusText(view) {
    if (!this.query.trim()) return '';
    if (this.status === 'loading' && !this.answer) return this.sfWord('loading-text');
    if (this.status === 'error') return this.statusMessage || this.sfWord('error-text');
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
      preview: this.sfWord('preview-label'),
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
      busy: this.status === 'loading' || this.running,
      statusText: this.statusText(view),
      show: {path: this.path, keys: this.keys},
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
    // A new index or a new key is a new built-in host, with its own
    // capabilities and its own recent queries.
    if (name === 'index' || name === 'recent-key') {
      this._builtin = null;
      this._builtinFor = null;
      this.answer = null;
      this.emptyAnswer = null;
      this.recentList = [];
      this.popularList = [];
      this.askQuery(this.query.trim());
    }
    this.renderWindow();
  }
}

SfSearch.define('sf-search');

export {SfSearch};

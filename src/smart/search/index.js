// sf-search: the one search window of a SIMAI site or app -- pages, records
// and commands (owner decision C162 (1); the admin palette is a host of it).
// One surface over the shared scrim: the field is its frameless head with a
// line under it, then the filters, the rows and, after the first arrow key,
// one line of key hints (owner decision C175, prototype ui-control
// prototypes/search-window-study.html); the whole screen below lg (C162 (7)).
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
// The panel asks a host through simai.search-port 1.1.0 (§4.9, declared in
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
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {breakpointMedia} from '../../core/js/breakpoints.js';
import {carryLayerOrigin, closeLayer, focusablesIn, isTopLayer, landmarksAround, openLayer, returnLayerFocus} from '../../core/js/layer-stack';
import {ALL_SCOPE_KEY, renderSearchTemplate, renderSearchWindow} from './js/templates/default';
import {PORT_ID, RECENT_LIMIT, RECENT_PAGES_LIMIT, RESULT_LIMIT, SUPPORTED_PORT_VERSIONS, builtinSearchHost, indexHost, providerHost, recentStore} from './js/host';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

const DEBOUNCE = 120;
// A search that takes longer than this draws the «Поиск…» line with the
// spinner over the rows it keeps (owner decisions C139 (4), C130 (8): the
// spinner after 1 s, no skeleton); a faster answer replaces the rows at once.
export const WAIT_LINE_DELAY = 1000;
const OVERLAY_CONTAINER = '[data-sf-overlay-container], [data-sf-drawer-container]';
// The port's three answers (no revision travels here, so nothing conflicts).
const ANSWERS = ['applied', 'refused', 'unavailable'];
// Which capability stands behind an intent (simai.search-port 1.0.0): an
// intent of a capability the host did not announce is never raised.
const INTENT_CAPABILITY = {'result.preview': 'preview', 'action.run': 'actions',
  'recent.forget': 'recent', 'recent.clear': 'recent'};
// The rows a group shows in the window (owner decision C175 (9)): the rest is
// on the product's results page, reached by the group's last row.
export const GROUP_ROWS = 5;
// The operators sf-search knows (C175 (8)): their words are the interface
// language's (lang operator-<id>), and the English ids are read too.
export const OPERATORS = ['from', 'subject', 'has', 'date'];
const OPERATOR_ICON = {from: 'person', subject: 'subject', has: 'attach_file', date: 'event'};
// Which block a setting wants, and the capability it wants it over; path and
// keys are the panel's own, so they have no capability.
const BLOCK_CAPABILITY = {scopes: 'scopes', recent: 'recent', popular: 'popular', actions: 'actions'};
// The step at which the card has room for the preview pane beside the list:
// the Framework's lg (core/js/breakpoints.js, the ladder the sheet's own media
// rule reads; reuse audit 2026-11-02, finding 6).
const PREVIEW_STEP = 'lg';
let sequence = 0;


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
    // The «Поиск…» line: its timer and whether it is drawn (C139 (4)).
    this._waitTimer = 0;
    this.waitShown = false;
    // What kind of failure the last query met: error (the host is
    // unavailable, «Повторить»), no-access (forbidden) or a plain refusal.
    this.statusKind = '';
    // The port: what the page handed (sfPort, the base action) is asked first;
    // the built-in host is made from index/provider/recent-key and remade when
    // one of them changes.
    this._builtin = null;
    this._builtinFor = null;
    this._portRequested = false;
    this._querySequence = 0;
    this._previewSequence = 0;
    // The pages last opened (C162 (6)), kept beside the recent queries.
    this.recentPages = [];
    // A command's next steps open in the same window (C175 (7)): the stack of
    // commands entered, each with the words that stood in the field.
    this.steps = [];
    // The operators turned into tags (C175 (8)), the one being typed, and
    // the operators the host reads.
    this.tokens = [];
    this.draft = null;
    this.operatorList = [];
    // The key hints wait for the first arrow key (R252, C175 (11)).
    this.keysUsed = false;
    // A sentence for the screen reader that is not the count: a scope
    // pressed, a step opened, a link copied (SW-20).
    this.announcement = '';
    this._previewMedia = breakpointMedia(PREVIEW_STEP);
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
    this._returnTo = this.opener();
    this._returnAncestors = landmarksAround(this._returnTo);
    this.isOpen = true;
    this.query = '';
    this.scope = '';
    this.selected = 0;
    this.status = 'idle';
    this.statusMessage = '';
    this.statusKind = '';
    this.stopWait();
    this.notice = '';
    this.answer = null;
    this.previewOf = null;
    this.steps = [];
    this.tokens = [];
    this.draft = null;
    this.keysUsed = false;
    this.announcement = '';
    this.sfHostState('data-open', true);
    this.mountPortal();
    const contained = this._contained;
    openLayer(this, {
      kind: 'modal',
      // The stack's default page lock (lockPageScroll), the one every layer takes.
      locksPage: !contained,
      trapsFocus: true,
      returnTo: this._returnTo,
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

  // Where the focus goes back when the window closes (SR-7): what had it when
  // the window opened, or -- when nothing had (a key pressed on the page, the
  // body active) -- the trigger that opens the window, if the person can see
  // it. The body was given back before, and the next Tab started from the
  // top of the page.
  opener() {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return active;
    const trigger = this.focusDelegate();
    // checkVisibility with the property also refuses visibility: hidden.
    const shown = trigger?.isConnected && trigger.checkVisibility?.({visibilityProperty: true})
      && !trigger.closest?.('[inert], [hidden]');
    return shown ? trigger : active;
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
    this.stopWait();
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
    carryLayerOrigin(portal, this, {prefixes: ['--sf-search-'], area: true, except: ['--sf-search-']});
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

  // Escape: from a row's buttons back to the field (C148 (3)); a filled field
  // is cleared first (C153 (6)); in a command's step it goes back a step
  // (C175 (7)); an empty field closes the window.
  onEscape(event) {
    if (event.defaultPrevented || !this.isOpen || !isTopLayer(this)) return false;
    if (document.activeElement?.closest?.('.sf-search-row-actions')) {
      this.focusField();
      return true;
    }
    if (this.query) {
      this.setQuery('');
      return true;
    }
    if (this.steps.length) {
      this.leaveStep();
      return true;
    }
    this.close({reason: 'escape'});
    return true;
  }

  // The X in the field, drawn only while there is something to clear (SW-3):
  // the words, then the operator tags; it is not a Tab stop.
  onClearPress() {
    if (this.query) this.setQuery('');
    else if (this.tokens.length) this.setTokens([]);
    else this.focusField();
  }

  // The arrow at the head's start: back a step, else (on a phone, where it
  // stands for the window's close) close.
  onBackPress() {
    if (this.steps.length) this.leaveStep();
    else this.close({reason: 'close'});
  }

  onTab(event) {
    if (!this.isOpen) return;
    const root = this.dialog();
    // The Tab stops alone: the rows (links), the X and a row's buttons are
    // reached by the arrows, so their tabindex -1 keeps them off the cycle.
    const items = focusablesIn(root).filter((node) => node.tabIndex >= 0);
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
    this.announcement = '';
    this.readDraft();
    this.scheduleLoad();
    this.renderWindow();
  }

  onFieldKeydown(event) {
    if (event.isComposing) return;
    const count = this._view?.rowCount ?? 0;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // The key hints appear with the first arrow and stay until the window
      // closes (R252, C175 (11)).
      if (!this.keysUsed) this.keysUsed = true;
      if (!count) {
        this.renderWindow();
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.selected = (this.selected + step + count) % count;
      this.renderWindow({reveal: true});
      this.askPreview();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!count) return;
      // Ctrl or Command with Enter: a page in a new tab (C175 (6)).
      if (event.ctrlKey || event.metaKey) this.openInNewTab(this.selected);
      else this.choose(this.selected);
    } else if (event.key === 'ArrowRight' && this.atFieldEnd() && this.rowActions().length) {
      // To the selected row's buttons (C148 (3)); ← or Escape comes back.
      event.preventDefault();
      this.rowActions()[0].focus();
    } else if (event.key === 'Backspace' && !event.target.value && event.target.selectionStart === 0) {
      // Backspace on an empty field: back a step, else the last tag goes
      // (C175 (7), (8)).
      if (this.steps.length) {
        event.preventDefault();
        this.leaveStep();
      } else if (this.tokens.length) {
        event.preventDefault();
        this.setTokens(this.tokens.slice(0, -1));
      }
    }
  }

  atFieldEnd() {
    const input = this.field();
    return Boolean(input) && input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
  }

  // The selected row's own buttons (C175 (6), C148 (3)): drawn buttons of the
  // selected row, in order.
  rowActions() {
    const row = this._portal?.querySelector('.sf-search-row--selected');
    return Array.from(row?.querySelectorAll('.sf-search-row-actions button') ?? []);
  }

  // The arrows walk the row's buttons; ← from the first, or Escape, goes back
  // to the field.
  onRowActionsKeydown(event) {
    const buttons = this.rowActions();
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    const rtl = getComputedStyle(this._portal).direction === 'rtl';
    const next = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const previous = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (!next && !previous) return;
    event.preventDefault();
    if (next && at < buttons.length - 1) buttons[at + 1].focus();
    else if (previous && at > 0) buttons[at - 1].focus();
    else if (previous) this.focusField();
  }

  setQuery(value) {
    const input = this.field();
    if (input) input.value = value;
    this.query = value;
    this.selected = 0;
    this.announcement = '';
    this.readDraft();
    this.scheduleLoad();
    this.renderWindow();
    this.focusField();
  }

  // A scope pressed is the same question as a keystroke (the port: scope is a
  // field of query.change, never an intent of its own), so the host is asked
  // again; the panel also filters what it holds, so the tags answer at once.
  // The tags are one sf-tag-group of single choice (C175 (4)): the focus stays
  // on the tag pressed, and the reader hears the scope and its count.
  setScope(id, {focus = true} = {}) {
    this.scope = id;
    this.selected = 0;
    const scope = this._view?.scopes?.find((one) => one.id === id);
    this.announcement = scope ? `${scope.label}: ${this.sfWord('count-text', {count: scope.count})}` : '';
    this.renderWindow();
    if (focus) this.focusField();
    this.askQuery(this.query.trim());
  }

  // sf-tag-group's select: a tag chosen is the scope; the chosen tag cleared
  // is «Все» again, so one tag is always chosen.
  onScopeSelect(event) {
    event.stopPropagation();
    // «Все» is the tag of no scope; a scope released is «Все» again.
    const {id, selected} = event.detail ?? {};
    const key = String(id ?? '');
    this.setScope(selected && key !== ALL_SCOPE_KEY ? key : '', {focus: false});
  }

  // ---------------------------------------------------------- operators

  /** The operators the host reads, with the words that name them. */
  operators() {
    if (!this.hostOffers('operators')) return [];
    const listed = this.operatorList.length ? this.operatorList : OPERATORS.map((id) => ({id, suggest: false}));
    return listed.filter((one) => OPERATORS.includes(one.id)).map((one) => ({
      ...one,
      word: this.sfWord(`operator-${one.id}`),
    }));
  }

  // An operator being typed at the end of the field (C175 (8)): its word in
  // the interface language or in English, a colon, and what follows it.
  readDraft() {
    const known = this.operators();
    this.draft = null;
    if (!known.length) return;
    const match = /(^|\s)([\p{L}]+):\s*([^:]*)$/u.exec(this.query);
    if (!match) return;
    const word = match[2].toLowerCase();
    const operator = known.find((one) => one.word.toLowerCase() === word || one.id === word);
    if (!operator) return;
    this.draft = {id: operator.id, word: operator.word, suggest: Boolean(operator.suggest), value: match[3].trim(),
      before: this.query.slice(0, match.index + match[1].length).trim()};
  }

  setTokens(list) {
    this.tokens = list;
    this.selected = 0;
    this.renderWindow();
    this.focusField();
    this.askQuery(this.query.trim());
  }

  // A value chosen for the operator being typed: it becomes a tag, and the
  // words before the operator stay the query.
  addToken(token) {
    const before = this.draft?.before ?? '';
    this.draft = null;
    this.tokens = [...this.tokens.filter((one) => !(one.id === token.id && one.value === token.value)), token];
    const input = this.field();
    if (input) input.value = before ? `${before} ` : '';
    this.query = input?.value ?? '';
    this.selected = 0;
    this.renderWindow();
    this.focusField();
    this.askQuery(this.query.trim());
  }

  // «Уточнить»: an operator chosen from the empty window starts it in the field.
  startOperator(operator) {
    const now = this.query.trim();
    this.setQuery(`${now ? `${now} ` : ''}${operator.word}: `);
  }

  // ---------------------------------------------------------- steps

  // A command with steps opens its next step in the same window (C175 (7)):
  // its tag in the field, the back arrow, the options as rows.
  enterStep(item) {
    this.steps = [...this.steps, {id: item.id, title: text(item.title), icon: text(item.icon), query: this.query}];
    const input = this.field();
    if (input) input.value = '';
    this.query = '';
    this.draft = null;
    this.answer = null;
    this.scope = '';
    this.selected = 0;
    this.status = 'loading';
    this.renderWindow();
    this.focusField();
    this.askQuery('');
  }

  leaveStep() {
    const left = this.steps.at(-1);
    this.steps = this.steps.slice(0, -1);
    const input = this.field();
    const back = left?.query ?? '';
    if (input) input.value = back;
    this.query = back;
    this.answer = null;
    this.selected = 0;
    this.announcement = '';
    this.renderWindow();
    this.focusField();
    this.askQuery(back.trim());
  }

  // A row whose title or path is cut by its ellipsis shows the whole of them
  // as its tooltip (SR-8, as a list row's C148 (5)): measured when the
  // pointer comes to the row, so a row that is not cut has none.
  markCut(row) {
    if (!(row instanceof Element)) return;
    const title = row.querySelector('.sf-search-row-title');
    const path = row.querySelector('.sf-search-row-path');
    const cut = (el) => Boolean(el) && el.scrollWidth > el.clientWidth + 1;
    const words = (el) => (el?.textContent || '').replace(/\s+/gu, ' ').trim();
    if (cut(title) || cut(path)) row.title = [words(title), words(path)].filter(Boolean).join(' · ');
    else row.removeAttribute('title');
  }

  // «Повторить» of the error state asks the same question again (C120 (5));
  // «Искать во всех» of nothing found in a scope asks it of every scope
  // (C162 (5)).
  onStateAction(event) {
    event.stopPropagation();
    const id = event.detail?.id;
    if (id === 'all') {
      this.setScope('');
      return;
    }
    if (id !== 'retry') return;
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
    if (row.kind === 'refine') {
      this.startOperator(row.operator);
      return undefined;
    }
    if (row.kind === 'token') {
      this.addToken(row.token);
      return undefined;
    }
    if (row.kind === 'more') {
      // «Все результаты: N ›» (C175 (9)): the product's results page, or,
      // where the host named none, the group's own scope in the window.
      if (row.url) this.followLink(row.url, {id: row.scope || 'all', group: row.scope});
      else this.setScope(row.scope);
      return undefined;
    }
    if (row.kind === 'option') return this.runAction(this.steps.at(-1), row.item.id);
    const {item} = row;
    if (item.kind === 'action' && item.steps) {
      this.enterStep(item);
      return undefined;
    }
    return item.kind === 'action' ? this.runAction(item) : this.openResult(item);
  }

  // A press on a row: a page row is a link, so Ctrl, Command or Shift with a
  // press and the middle button are the browser's (a new tab or window); the
  // window stays open behind them (C175 (6)). A plain press chooses the row.
  onRowClick(event, index) {
    if (event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('.sf-search-row-actions')) return;
    const link = event.currentTarget instanceof HTMLAnchorElement && event.currentTarget.href;
    if (link && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    event.preventDefault();
    this.choose(index);
  }

  /** The address of a row, absolute, or empty. */
  rowUrl(index) {
    const row = this._view?.rows[index];
    const url = row?.kind === 'more' ? row.url : text(row?.item?.url);
    if (!url) return '';
    try {
      return new URL(url, globalThis.location?.href).href;
    } catch {
      return '';
    }
  }

  // «Открыть в новой вкладке» and Ctrl/Command+Enter: a page row in a new tab;
  // a command or a step's option runs as Enter would.
  openInNewTab(index) {
    const url = this.rowUrl(index);
    if (!url) return this.choose(index);
    globalThis.open?.(url, '_blank', 'noopener');
    return undefined;
  }

  // «Копировать ссылку»: the row's address on the clipboard, said once.
  async copyLink(index) {
    const url = this.rowUrl(index);
    if (!url) return false;
    let done = false;
    try {
      await globalThis.navigator?.clipboard?.writeText(url);
      done = true;
    } catch {
      done = false;
    }
    this.announcement = this.sfWord(done ? 'copied-text' : 'copy-failed-text');
    this.renderWindow();
    return done;
  }

  followLink(href, {id = '', group = ''} = {}) {
    const query = this.query.trim();
    this.runClose({reason: 'api'});
    const detail = {id, href, action: '', query, group};
    if (this.sfEmit('navigate', detail, {cancelable: true}) && detail.href) globalThis.location?.assign(detail.href);
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
  async runAction(item, value) {
    if (!item) return undefined;
    // In a step, the query recorded is the one the command was found by.
    const query = this.steps.length ? text(this.steps[0].query).trim() : this.query.trim();
    this.running = true;
    this.renderWindow();
    const payload = {id: item.id, query};
    if (value !== undefined) payload.value = value;
    const answer = await this.raise('action.run', payload);
    this.running = false;
    if (!answer) return answer;
    if (answer.answer !== 'applied') {
      this.notice = this.answerWords(answer, 'action-text');
      this.renderWindow();
      return answer;
    }
    this.takeRecent(answer);
    this.runClose({reason: 'api'});
    const detail = {id: item.id, href: '', action: text(item.id), query, group: text(item.group)};
    if (value !== undefined) detail.value = value;
    this.sfEmit('navigate', detail, {cancelable: true});
    return answer;
  }

  // ---------------------------------------------------------- recent queries

  // The recent queries are the host's data: a removal and a clear are
  // answered with the whole list the host keeps now, and that list is what is
  // drawn -- the panel keeps no history of its own.
  // The recent list (1.1.0): strings are queries, objects the pages last
  // opened; up to five of one and three of the other are drawn (C162 (6)).
  takeRecent(answer) {
    const list = answer?.data?.recent;
    if (!Array.isArray(list)) return;
    this.recentList = list.filter((entry) => typeof entry === 'string' && entry).slice(0, RECENT_LIMIT);
    this.recentPages = list.filter((entry) => entry && typeof entry === 'object' && text(entry.title) && text(entry.url))
      .slice(0, RECENT_PAGES_LIMIT);
  }

  async forgetRecent(query) {
    const answer = await this.raise('recent.forget', {query: text(query)});
    this.afterRecent(answer);
    return answer;
  }

  async forgetRecentPage(id) {
    const answer = await this.raise('recent.forget', {id});
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
    this.recentPages = [];
    this.popularList = [];
    this.operatorList = [];
    this.previewOf = null;
    this.notice = '';
    this.statusMessage = '';
    this.scope = '';
    this.tokens = [];
    this.steps = [];
    this.draft = null;
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
    // In a step, with operator tags or while an operator is typed the empty
    // field is a question too: the step's options, the tags alone.
    if (!query && (this.steps.length || this.tokens.length)) {
      this.startWait();
      this._timer = setTimeout(() => this.askQuery(''), DEBOUNCE);
      return;
    }
    if (!query) {
      // An empty field starts afresh: the next query waits for its own answer
      // rather than showing the last one's under new marks.
      this._controller?.abort();
      this._controller = null;
      this.answer = null;
      this.statusMessage = '';
      this.statusKind = '';
      this.status = 'ready';
      this.stopWait();
      return;
    }
    // The wait starts with the keystroke, not after the debounce: the rows on
    // screen stay, a step paler, until the answer replaces them (C139 (4)).
    this.startWait();
    this._timer = setTimeout(() => this.askQuery(query), DEBOUNCE);
  }

  // The wait of a query (C139 (4), C130 (8)): the card keeps the rows it shows
  // a step paler at once, and after WAIT_LINE_DELAY a «Поиск…» line with the
  // spinner stands over them. An answer, a failure or an empty field ends it.
  startWait() {
    this.status = 'loading';
    if (this._waitTimer || this.waitShown) return;
    this._waitTimer = setTimeout(() => {
      this._waitTimer = 0;
      if (!this.isOpen || this.status !== 'loading') return;
      this.waitShown = true;
      this.renderWindow();
    }, WAIT_LINE_DELAY);
  }

  stopWait() {
    clearTimeout(this._waitTimer);
    this._waitTimer = 0;
    this.waitShown = false;
  }

  /**
   * What matches now (query.change): a keystroke, a scope pressed, a chosen
   * popular or recent query, an accepted correction, and the empty query the
   * window opens with -- one question for all of them. The empty query is the
   * host's chance to answer the blocks (recent, popular, the commands).
   */
  // What a question carries besides the words: the step it asks (C175 (7)),
  // the operator tags and the operator being typed (C175 (8)).
  queryPayload(asked, query) {
    const payload = {sequence: asked, query, scope: this.scope || null, limit: RESULT_LIMIT, offset: 0};
    const step = this.steps.at(-1);
    if (step) {
      payload.step = step.id;
      payload.scope = null;
      return payload;
    }
    if (this.hostOffers('operators')) {
      if (this.tokens.length) payload.operators = this.tokens.map(({id, value, label}) => ({id, value: text(value), label: text(label)}));
      if (this.draft?.suggest) {
        payload.query = this.draft.before;
        payload.operator = {id: this.draft.id, value: this.draft.value};
      }
    }
    return payload;
  }

  // Whether the question asked is more than the empty field's blocks.
  asksMore(query) {
    return Boolean(query) || this.steps.length > 0 || this.tokens.length > 0;
  }

  async askQuery(query) {
    this._controller?.abort();
    const controller = new AbortController();
    this._controller = controller;
    const asked = ++this._querySequence;
    const more = this.asksMore(query);
    if (more) {
      this.startWait();
      this.renderWindow();
    }
    // An operator being typed that the host does not suggest for is the
    // person's own words: nothing to ask until it becomes a tag.
    if (this.draft && !this.draft.suggest) {
      this.stopWait();
      this.status = 'ready';
      this.renderWindow();
      return null;
    }
    const answer = await this.raise('query.change', this.queryPayload(asked, query), {signal: controller.signal, sequence: asked});
    if (this._controller === controller) this._controller = null;
    if (!answer || controller.signal.aborted || !this.isOpen || asked !== this._querySequence) return answer;
    if (answer.answer === 'applied') {
      const data = answer.data ?? {};
      const step = this.steps.at(-1);
      // A step's options and an operator's suggestions need no url: they are
      // chosen, not opened.
      const chosen = Boolean(step) || Boolean(this.draft?.suggest);
      const results = (Array.isArray(data.results) ? data.results : []).filter((result) => (chosen ? Boolean(result && text(result.title)) : drawable(result)));
      const echo = data.echo ?? {};
      const scopes = (Array.isArray(data.scopes) ? data.scopes : []).filter((scope) => scope && text(scope.id));
      if (more) {
        // The panel draws the question the host answered, not the one the
        // person has since typed (echo).
        this.answer = {
          query: text(echo.query ?? query),
          scope: text(echo.scope),
          results,
          scopes,
          total: Number.isInteger(data.total) ? data.total : null,
          more: text(data.more),
          step: step ? step.id : null,
          suggest: !step && this.draft?.suggest ? this.draft.id : null,
          correction: this.hostOffers('spelling') && text(data.correction?.query) ? data.correction : null,
        };
        this.status = results.length ? 'ready' : 'empty';
        this.statusMessage = '';
        this.statusKind = '';
        this.stopWait();
        // A step opened is said with its options (C175 (7), as C157 (6)).
        if (step && !query) this.announcement = `${step.title}, ${this.sfWord('options-text', {count: results.length})}`;
      } else {
        this.emptyAnswer = {results, scopes};
        if (Array.isArray(data.operators)) {
          this.operatorList = data.operators.filter((one) => one && OPERATORS.includes(one.id))
            .map((one) => ({id: one.id, suggest: Boolean(one.suggest)}));
        }
      }
      this.takeRecent(answer);
      const popular = strings(data.popular);
      if (popular?.length) this.popularList = popular;
    } else if (more) {
      this.answer = null;
      this.status = 'error';
      this.statusMessage = this.answerWords(answer, 'refused-text');
      // The host could not answer: an error with «Повторить» (C120 (3), (5));
      // forbidden: no access; any other refusal (a query too short) is the
      // host's sentence alone.
      const reason = text(answer.reason);
      this.statusKind = answer.answer === 'unavailable' ? 'error' : reason === 'forbidden' ? 'no-access' : '';
      this.stopWait();
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
    const step = this.steps.at(-1) ?? null;
    const resultRow = (item) => add({
      kind: 'result',
      item,
      title: highlight(item.title, query),
      path: text(item.path),
      icon: text(item.icon) || (item.kind === 'action' ? 'bolt' : 'description'),
      shortcut: item.kind === 'action' ? text(item.shortcut) : '',
      url: item.kind === 'action' ? '' : text(item.url),
    });
    const commands = this.shows('actions');
    let scopes = [];
    let correction = null;
    let message = '';
    let state = null;
    const asking = this.asksMore(query);
    const waiting = asking && this.status === 'loading';
    if (step) {
      // A command's next step (C175 (7)): its options under the command's
      // name, chosen, not opened.
      const options = (this.answer?.step === step.id ? this.answer.results : []).map((item) => add({
        kind: 'option', item, title: highlight(text(item.title), query), path: text(item.path), icon: text(item.icon), shortcut: '', url: ''}));
      if (options.length) sections.push({kind: 'results', id: `${this._id}-results`, groups: [{label: step.title, captionId: `${this._id}-step`, rows: options}]});
      else if (this.answer?.step === step.id && !waiting) state = {kind: 'nothing-found', text: this.sfWord('empty-text', {vars: {query: query || step.title}})};
    } else if (this.draft) {
      // An operator being typed (C175 (8)): the host's suggestions for its
      // value, or the words typed as the one row that makes the tag.
      const {draft} = this;
      if (draft.suggest) {
        const found = this.answer?.suggest === draft.id ? this.answer.results : [];
        const rowsOf = found.map((item) => add({kind: 'token', item, token: {id: draft.id, value: text(item.id), label: text(item.title)},
          title: highlight(text(item.title), draft.value), path: text(item.path), icon: text(item.icon) || OPERATOR_ICON[draft.id], avatar: item.avatar ?? null, shortcut: '', url: ''}));
        if (rowsOf.length) sections.push({kind: 'results', id: `${this._id}-results`, groups: [{label: this.sfWord(`operator-${draft.id}-label`), captionId: `${this._id}-suggest`, rows: rowsOf}]});
      } else if (draft.value) {
        const row = add({kind: 'token', token: {id: draft.id, value: draft.value, label: draft.value}, title: [`${draft.word}: ${draft.value}`, '', ''],
          path: '', icon: OPERATOR_ICON[draft.id], shortcut: '', url: ''});
        sections.push({kind: 'results', id: `${this._id}-results`, groups: [{label: this.sfWord('refine-label'), captionId: `${this._id}-suggest`, rows: [row]}]});
      }
    } else if (!asking || (waiting && !this.answer)) {
      // A first query waits over what the empty field showed (the recent
      // queries, the commands): those rows stay, a step paler, until the answer
      // replaces them (C139 (4)); before, the card emptied at once for «Ищем…».
      if (this.shows('recent') && (this.recentList.length || this.recentPages.length)) {
        sections.push({kind: 'recent', id: `${this._id}-recent`, label: this.sfWord('recent-label'),
          rows: [
            ...this.recentList.map((entry) => add({kind: 'recent', text: entry, title: [entry, '', ''], path: '', icon: 'history',
              removeLabel: this.sfWord('recent-remove-label', {vars: {query: entry}})})),
            ...this.recentPages.map((page) => Object.assign(resultRow({...page, kind: 'page'}), {
              recentPage: true, removeLabel: this.sfWord('recent-remove-label', {vars: {query: text(page.title)}})})),
          ]});
      }
      if (this.shows('popular') && this.popularList.length) sections.push({kind: 'popular', texts: this.popularList});
      const actions = commands ? (this.emptyAnswer?.results ?? []).filter((item) => item.kind === 'action') : [];
      if (actions.length) {
        sections.push({kind: 'actions', id: `${this._id}-actions`, label: this.sfWord('actions-label'), rows: actions.map(resultRow)});
      }
      // «Уточнить» (C175 (8)): the operators the host reads, each a row that
      // starts it in the field.
      const known = this.operators();
      if (known.length && !this.tokens.length) {
        sections.push({kind: 'refine', id: `${this._id}-refine`, label: this.sfWord('refine-label'),
          rows: known.map((operator) => add({kind: 'refine', operator, title: [`${operator.word}: ${this.sfWord(`operator-${operator.id}-hint`)}`, '', ''],
            path: '', icon: OPERATOR_ICON[operator.id], shortcut: '', url: ''}))});
      }
      if (!sections.length && !asking) message = this.sfWord('start-text');
    } else {
      const answer = this.answer;
      const items = (answer?.results ?? []).filter((item) => commands || item.kind !== 'action');
      // The scopes the host announced, then any group its results name that
      // it did not: the tags follow the host's order, the panel adds nothing
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
      // A scope the host answered with nothing stays pressed: the empty state
      // offers «Искать во всех» (C162 (5)).
      if (items.length && !present.some((scope) => scope.id === this.scope)) this.scope = '';
      // The host's count where it sent one (the whole index), else the number
      // the panel holds, so a tag says what pressing it will show.
      const counted = (scope) => (Number.isInteger(scope.count) ? scope.count : items.filter((item) => item.group === scope.id).length);
      if (present.length) {
        scopes = [{id: '', label: this.sfWord('all-label'), count: Number.isInteger(answer?.total) ? answer.total : items.length, pressed: this.scope === ''},
          ...present.map((scope) => ({id: scope.id, label: text(scope.label) || scope.id, count: counted(scope), pressed: this.scope === scope.id}))];
      }
      const chosen = present.filter((scope) => !this.scope || scope.id === this.scope);
      const ungrouped = this.scope ? [] : items.filter((item) => !present.some((scope) => scope.id === item.group));
      const captions = !this.scope && (present.length > 1 || text(present[0]?.label));
      // Up to five rows of a group while every group is shown (C175 (9)); the
      // last row leads to the rest: the product's results page where the host
      // named one, else the group's own scope here. A scope pressed shows the
      // rows held of it, and the page where the host has more.
      const capped = (scope, list) => {
        const count = counted(scope);
        const url = text(scope.more);
        const room = this.scope ? list.length : Math.min(list.length, GROUP_ROWS);
        const shown = list.slice(0, room).map(resultRow);
        const rest = count > shown.length && (url || (!this.scope && this.shows('scopes') && list.length > shown.length));
        if (rest) shown.push(add({kind: 'more', scope: scope.id, url, count, title: [this.sfWord('more-text', {vars: {count}}), '', ''], path: '', icon: 'arrow_forward', shortcut: ''}));
        return shown;
      };
      const groups = [
        ...chosen.map((scope, n) => ({
          label: text(scope.label) || scope.id || this.sfWord('results-label'),
          captionId: captions && text(scope.label) ? `${this._id}-group-${n}` : '',
          rows: capped(scope, items.filter((item) => item.group === scope.id)),
        })),
        ...(ungrouped.length ? [{label: this.sfWord('results-label'), captionId: '', rows: (() => {
          const shown = ungrouped.map(resultRow);
          const total = Number.isInteger(answer?.total) ? answer.total : ungrouped.length;
          if (answer?.more && total > shown.length) shown.push(add({kind: 'more', scope: '', url: answer.more, count: total, title: [this.sfWord('more-text', {vars: {count: total}}), '', ''], path: '', icon: 'arrow_forward', shortcut: ''}));
          return shown;
        })()}] : []),
      ].filter((group) => group.rows.length);
      if (groups.length) sections.push({kind: 'results', id: `${this._id}-results`, groups});
      // «Возможно, вы искали …»: offered, never applied -- accepting it is an
      // ordinary query.
      if (answer?.correction) {
        correction = {query: text(answer.correction.query),
          count: Number.isInteger(answer.correction.total) ? answer.correction.total : null,
          text: this.sfWord('correction-text', {vars: {query: text(answer.correction.query)}})};
      }
      // Nothing found and a failure are an inline sf-empty-state (owner
      // decision C120 (3), (5)): search_off with the popular queries under it,
      // the error glyph with «Повторить»; a refusal that is not a failure (a
      // query too short) stays the host's sentence. A search running over
      // them takes them away at once, as a new answer would.
      if (waiting) {
        // The rows of the last answer stay (paler); an old state goes.
      } else if (this.status === 'error') {
        const words = this.statusMessage || this.sfWord('error-text');
        if (this.statusKind) state = {kind: this.statusKind, text: words};
        else message = words;
      } else if (!rows.length && answer) {
        const popular = this.shows('popular') ? this.popularList.slice(0, 3) : [];
        state = {kind: 'nothing-found', text: this.sfWord(popular.length ? 'empty-advice-text' : 'empty-text', {vars: {query: query || this.tokens.map((one) => one.label).join(', ')}}),
          // In a scope: «Искать во всех» (C162 (5)).
          actions: this.scope ? [{id: 'all', label: this.sfWord('search-all-label')}] : null};
        if (popular.length) sections.push({kind: 'popular', texts: popular});
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
      state,
      step,
      draft: this.draft,
      tokens: this.tokens.map((token) => ({...token, word: this.sfWord(`operator-${token.id}`)})),
      // The rows on screen belong to the last answer while a new one is
      // awaited; the «Поиск…» line comes after WAIT_LINE_DELAY.
      stale: waiting && rows.length > 0,
      waiting: waiting && this.waitShown,
      activeId: rows.length ? `${this._id}-option-${this.selected}` : '',
    };
  }

  statusText(view) {
    if (this.announcement) return this.announcement;
    if (!this.asksMore(this.query.trim())) return '';
    if (this.status === 'loading') return this.waitShown ? this.sfWord('loading-text') : '';
    if (this.status === 'error') return this.statusMessage || this.sfWord('error-text');
    if (!view.rowCount) return this.answer ? this.sfWord('empty-text', {vars: {query: this.query.trim()}}) : '';
    return this.sfWord('count-text', {count: view.rowCount});
  }

  // The key hints (R252, C175 (11)): none until the first arrow in the
  // window, then at most three on one line -- move, the Enter of this list
  // and the Escape of this state. The other keys are in the labels of the
  // buttons they act on (aria-keyshortcuts).
  keyHints(view) {
    if (!this.keysUsed || this.keys === false || !view.rowCount) return [];
    const enter = view.step ? 'key-apply-label' : (view.draft ? 'key-tag-label' : 'key-open-label');
    const escape = this.query ? 'key-clear-label' : (view.step ? 'key-back-label' : 'key-close-label');
    return [
      {keys: ['↑', '↓'], label: this.sfWord('key-select-label')},
      {keys: ['↵'], label: this.sfWord(enter)},
      {keys: ['Esc'], label: this.sfWord(escape)},
    ];
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
      newTab: this.sfWord('new-tab-label'),
      copyLink: this.sfWord('copy-link-label'),
      removeTag: this.sfWord('remove-tag-label'),
      loading: this.sfWord('loading-text'),
    };
    this.drawInto(renderSearchWindow({
      component: this,
      ids: {dialog: `${this._id}-dialog`, option: (index) => `${this._id}-option-${index}`},
      query: this.query,
      label: this.label,
      placeholder: view.step ? this.sfWord('step-placeholder') : this.placeholder,
      selected: this.selected,
      status: this.status,
      busy: this.status === 'loading' || this.running,
      statusText: this.statusText(view),
      show: {path: this.path, keys: this.keys !== false},
      hints: this.keyHints(view),
      words,
      view,
    }), this._portal);
    // The X and a row's buttons are not Tab stops (C153 (6), C148 (3)): the
    // X is Escape's, a row's buttons are reached with →. The buttons draw
    // their native button when they upgrade, so once more after that.
    this.untabButtons();
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(() => this.untabButtons());
    if (reveal) this._portal.querySelector('.sf-search-row--selected')?.scrollIntoView?.({block: 'nearest'});
  }

  untabButtons() {
    for (const button of this._portal?.querySelectorAll('.sf-search-clear button, .sf-search-row-actions button') ?? []) {
      if (button.tabIndex !== -1) button.tabIndex = -1;
    }
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

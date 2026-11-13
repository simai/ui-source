// sf-alert-bar: the full-width bar above a page or admin header for the
// conditions that need action now -- a disk nearly full, a failed backup, a
// site that does not answer, an update. One bar for all of them:
//
//   <sf-alert-bar><script type="application/json" data-sf-settings>
//     {"items": [{"id": "backup", "level": "warning", "text": "…",
//       "action": {"label": "Открыть копии", "href": "/backups/"}}]}
//   </script></sf-alert-bar>
//
// The items are sorted error, warning, info, the newest first; the bar takes
// the colour of the first and shows it, without paging arrows (owner decision
// C114 (3)); «Ещё N» lists the others under the bar (NS-12). A warning closes for a day, an info item
// for good; an error item is never closed, its button minimizes the bar to a
// strip that keeps the count.
//
// The bar stores nothing. A close, an acknowledge and an action link are
// events with the item's id (sf-alert-bar-close, -acknowledge, -navigate);
// the host keeps the choice and sets the list again. A closed or acknowledged
// item leaves the bar at once, until the host's next list.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings and values are made by core/js/element-manifest.js, close
// is the action and answers an outcome, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {toDate} from '../../core/js/format';
import {renderAlertBarTemplate} from './js/templates/default';
import {preloadControlIcons} from '../helpers/cycle';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';
import { noteDeprecated } from '../../core/js/deprecations';

// The list's id, one per bar on the page (the same on every render, so a
// first-paint snapshot is stable).
let sequence = 0;

// The levels say what happened (decision C13, docs review R031): error is the
// most serious, as on every message; danger is its former word here.
export const LEVELS = ['error', 'warning', 'info'];
const RANK = {error: 0, warning: 1, info: 2};
// How a closed item is kept by the host: a warning for a day, info for good.
export const HIDE = {warning: 'day', info: 'always'};
// sf-alert's status icons, by the theme's status words.
export const ICONS = {error: 'error', warning: 'warning', info: 'info'};
// The open toggle's glyph on a narrow bar (1.6.1): the list collapses.
export const COLLAPSE_ICON = 'unfold_less';

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An item's level: error, warning or info; the former danger is read as error (noted once), anything else as info. */
export function levelOf(value) {
  const word = text(value).toLowerCase();
  if (word === 'danger') {
    noteDeprecated({component: 'sf-alert-bar', tag: 'sf-alert-bar', kind: 'value', attribute: 'items.level', from: 'danger', to: 'error', since: '2026-11-08', remove_after: '2027-01-01'});
    return 'error';
  }
  return LEVELS.includes(word) ? word : 'info';
}

/**
 * The items as given, made safe and sorted: error, warning, info; inside a
 * level the newest first by time. An item without an id or a text is left
 * out; one without a readable time keeps the host's order after the timed
 * ones of its level.
 */
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const items = [];
  list.forEach((item, order) => {
    if (!item || typeof item !== 'object') return;
    const id = text(item.id);
    const body = text(item.text);
    if (!id || !body || seen.has(id)) return;
    seen.add(id);
    const level = levelOf(item.level);
    const moment = toDate(item.time);
    const action = item.action && typeof item.action === 'object' && text(item.action.label)
      ? {label: text(item.action.label), href: text(item.action.href)} : null;
    const acknowledge = item.acknowledge && typeof item.acknowledge === 'object'
      ? {label: text(item.acknowledge.label)} : (item.acknowledge === true ? {label: ''} : null);
    items.push({
      id,
      level,
      text: body,
      source: text(item.source),
      time: moment ? moment.toISOString() : '',
      at: moment ? moment.getTime() : null,
      action,
      acknowledge,
      // An error item is never closed; the others unless the host says no.
      dismissible: level !== 'error' && item.dismissible !== false,
      order,
    });
  });
  return items.sort((a, b) => {
    if (RANK[a.level] !== RANK[b.level]) return RANK[a.level] - RANK[b.level];
    if (a.at !== null && b.at !== null && a.at !== b.at) return b.at - a.at;
    if ((a.at === null) !== (b.at === null)) return a.at === null ? 1 : -1;
    return a.order - b.order;
  });
}

/** A place in a list of `length`, wrapped: one before the first is the last. */
export function wrapIndex(value, length) {
  if (length <= 0) return 0;
  const number = Math.trunc(Number(value)) || 0;
  return ((number % length) + length) % length;
}

const AlertBarElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    close(args = {}) {
      const id = typeof args === 'string' ? args : args?.id;
      return this.closeItem(text(id), 'api');
    },
  },
});

class SfAlertBar extends AlertBarElement {
  constructor() {
    super();
    // The place of the shown item in the sorted list, and the list's state.
    this._index = 0;
    this._listOpen = false;
    // Items a person closed or acknowledged in this list; the host's next
    // list starts afresh (the bar stores nothing).
    this._gone = new Set();
    this._source = undefined;
    // What the bar knew at its last drawing, to tell a new item from one that
    // was there: the first list is the page's, never announced.
    this._known = null;
    this._announce = {alert: '', status: ''};
    this._listId = `sf-alert-bar-list-${++sequence}`;
    this._onKey = (event) => this.onKey(event);
  }

  onConnected() {
    super.onConnected?.();
    this.addEventListener('keydown', this._onKey);
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.removeEventListener('keydown', this._onKey);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'minimized' && oldValue !== newValue) this.sfHostState('data-minimized', this.isMinimized);
  }

  // The items the bar shows: the host's list, sorted, less what a person
  // closed or acknowledged since the host set it.
  get list() {
    return normalizeItems(this.items).filter((item) => !this._gone.has(item.id));
  }

  // The most serious level shown; the bar's colour.
  get level() {
    return this.list[0]?.level ?? '';
  }

  // Only an error bar is minimized.
  get isMinimized() {
    return Boolean(this.minimized) && this.level === 'error';
  }

  // A new list from the host: forget what was closed in the old one, find
  // what is new, keep the shown item in view when it is still there.
  syncList() {
    const source = this.items;
    if (source === this._source) return;
    const shownId = this._shownId;
    this._source = source;
    this._gone.clear();
    const list = this.list;
    const ids = new Set(list.map((item) => item.id));
    if (this._known) {
      const fresh = list.filter((item) => !this._known.has(item.id));
      const danger = fresh.filter((item) => item.level === 'error');
      const other = fresh.filter((item) => item.level !== 'error');
      // A new error item is the one thing that is read out at once (role
      // alert); the rest politely (role status). A minimized bar opens again
      // for it.
      this._announce = {
        alert: danger.map((item) => this.spoken(item)).join(' '),
        status: other.map((item) => this.spoken(item)).join(' '),
      };
      if (danger.length) {
        this._index = 0;
        // The page that keeps the minimized state hears that it ended.
        if (this.minimized) {
          this.minimized = false;
          this.sfEmit('minimize', {minimized: false});
        }
      }
    }
    this._known = ids;
    const kept = list.findIndex((item) => item.id === shownId);
    if (kept >= 0 && !this._announce.alert) this._index = kept;
    else if (!this._announce.alert) this._index = wrapIndex(this._index, list.length);
    if (list.length < 2) this._listOpen = false;
  }

  spoken(item) {
    return `${this.sfWord(`level-${item.level}`)}: ${item.text}`;
  }

  // ---------------------------------------------------------------- presses

  toggleList(force) {
    const open = force === undefined ? !this._listOpen : Boolean(force);
    if (open === this._listOpen) return;
    this._listOpen = open;
    this.requestComponentUpdate('list');
  }

  setMinimized(minimized) {
    const next = Boolean(minimized);
    if (next === this.isMinimized) return;
    const restore = this.contains(this.ownerDocument.activeElement);
    this.minimized = next;
    this._listOpen = false;
    this.sfHostState('data-minimized', this.isMinimized);
    this.sfEmit('minimize', {minimized: next});
    // The press's own control is replaced by the strip or the bar: focus moves
    // to what took its place, never to the page.
    if (restore) this.whenDrawn(() => this.querySelector(next ? '.sf-alert-bar-strip' : '.sf-alert-bar-minimize button, .sf-alert-bar-minimize')?.focus({preventScroll: true}));
  }

  // An action link: the request first; not cancelled, the browser follows it.
  onNavigate(event, item) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const allowed = this.sfEmit('navigate', {id: item.id, level: item.level, href: item.action?.href ?? ''}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  acknowledgeItem(id) {
    const item = this.list.find((entry) => entry.id === id);
    if (!item?.acknowledge) return refused('missing');
    if (!this.sfEmit('acknowledge', {id: item.id, level: item.level}, {cancelable: true})) return refused('prevented');
    this.leave(item.id);
    return applied();
  }

  // close: the request with how long the host keeps it; not cancelled, the
  // item leaves the bar at once.
  closeItem(id, reason = 'close') {
    const item = this.list.find((entry) => entry.id === id);
    if (!item) return refused('missing');
    // The reason keeps its former word: an outcome has no alias to carry a
    // rename (change journal value-alert-bar-level-danger-to-error).
    if (!item.dismissible) return refused('danger');
    if (!this.sfEmit('close', {id: item.id, level: item.level, hide: HIDE[item.level] ?? 'always', reason}, {cancelable: true})) return refused('prevented');
    this.leave(item.id);
    return applied();
  }

  // An item leaves: the control that had focus hands it on (§19.2: focus
  // never falls to the page). From a row of the open list it goes to the
  // row that takes its place -- the next one, or from the last row the one
  // before it (NS-12); with no row left, to the bar. From the bar, to the
  // bar's first control.
  leave(id) {
    const active = this.ownerDocument.activeElement;
    const focused = Boolean(active && this.contains(active));
    const row = active?.closest?.('.sf-alert-bar-item');
    const rows = row ? [...this.querySelectorAll('.sf-alert-bar-item')] : [];
    const place = row ? rows.indexOf(row) : -1;
    this._gone.add(id);
    const count = this.list.length;
    this._index = wrapIndex(this._index, count);
    if (count < 2) this._listOpen = false;
    this.requestComponentUpdate('leave');
    if (!focused) return;
    const first = (scope) => scope?.querySelector('a[href], button:not([disabled])');
    this.whenDrawn(() => {
      const left = this._listOpen ? [...this.querySelectorAll('.sf-alert-bar-item')] : [];
      const target = (place >= 0 && left.length ? first(left[Math.min(place, left.length - 1)]) : null)
        ?? first(this.querySelector('.sf-alert-bar-row'))
        ?? this.querySelector('.sf-alert-bar a[href], .sf-alert-bar button:not([disabled])');
      target?.focus({preventScroll: true});
    });
  }

  // Runs after the element's next drawing (and its buttons' own).
  whenDrawn(callback) {
    const done = (event) => {
      if (event.target !== this) return;
      this.removeEventListener('sf-after-render', done);
      const settle = () => callback();
      if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(settle);
      else Promise.resolve().then(settle);
    };
    this.addEventListener('sf-after-render', done);
  }

  // Escape closes the open list and returns focus to its toggle.
  onKey(event) {
    if (event.key !== 'Escape' || !this._listOpen || event.defaultPrevented) return;
    event.preventDefault();
    this.toggleList(false);
    this.whenDrawn(() => this.querySelector('.sf-alert-bar-all button, .sf-alert-bar-all')?.focus({preventScroll: true}));
  }

  // ---------------------------------------------------------------- drawing

  templateContext() {
    const list = this.list;
    const count = list.length;
    const index = wrapIndex(this._index, count);
    const current = list[index] ?? null;
    this._shownId = current?.id;
    // The open list holds the others: every item but the one the bar shows.
    const others = list.filter((item) => item !== current);
    const level = list[0]?.level ?? '';
    // The raw value stays under its own name; the template reads this one.
    const isMinimized = Boolean(this.minimized) && level === 'error';
    const word = (key, vars) => this.sfWord(key, vars ? {vars} : {});
    this.sfHostState('data-level', level);
    this.sfHostState('data-empty', count === 0);
    this.sfHostState('data-minimized', isMinimized);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: this.size === '1' ? '1' : '1/2',
      label: this.label,
      list: list.map((item) => ({...item, levelWord: word(`level-${item.level}`)})),
      others: others.map((item) => ({...item, levelWord: word(`level-${item.level}`)})),
      count,
      index,
      level,
      isMinimized,
      listOpen: this._listOpen && count > 1,
      listId: this._listId,
      announce: this._announce,
      icons: ICONS,
      collapseIcon: COLLAPSE_ICON,
      words: {
        more: word('more', {count: others.length}),
        collapseList: word('collapse-list'),
        list: word('list'),
        hideDay: word('hide-day'),
        hide: word('hide'),
        acknowledge: word('acknowledge'),
        minimize: word('minimize'),
        expand: word('expand'),
        expandLabel: word('expand-label'),
        strip: count === 1 && current ? `${word(`level-${level}`)}: ${list[0].text}` : word('count', {count}),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    // The live regions keep their text until the host's next list, so a
    // drawing in between (a page, a minimize) does not speak it again.
    this.syncList();
    const context = this.templateContext();
    // The open toggle's collapse glyph (narrow bar, 1.6.1) is drawn only
    // after a press: asked for with the bar's first drawing, so the page's
    // icon request carries it and the glyph does not wait for a subset of
    // its own (R074, as sf-toast asks for its status glyph).
    if (context.count > 1) preloadControlIcons(this, [{icon: COLLAPSE_ICON, filled: false}]);
    return renderAlertBarTemplate(context);
  }
}

SfAlertBar.define('sf-alert-bar');

export {SfAlertBar};

// sf-list-attention: the problems that need a person, on an overview screen --
// server health, site checks, import errors, update readiness, a form's
// validation summary:
//
//   <sf-list-attention triage checked-at="2026-11-09T14:05:00+03:00" more-href="/checks/">
//     <script type="application/json" data-sf-settings>
//     {"items": [{"id": "cert", "status": "warning", "title": "…",
//       "object": {"label": "crm.dealer-auto.ru", "href": "/sites/12/"},
//       "since": "2026-11-08T10:00:00+03:00", "source": "Сертификаты",
//       "action": {"label": "Продлить", "href": "/ssl/"}}]}
//   </script></sf-list-attention>
//
// Owner decision C37 (2026-11-09; ui-control control/research/
// 2026-11-09-list-attention.md, prototypes/list-attention.html scenes А, Б):
// a card with a summary of badges per severity in its head, rows of a filled
// status icon, the title, a line of what · how long · where, one quiet action
// and the «⋯» triage menu (snooze a day or a week, do not remind, about the
// check), at most `limit` rows and «Все проблемы (N)», «Проверено …» with a
// recheck, «Всё в порядке · проверено …» when empty; group="severity" is the
// full checks page: disclosure groups, a collapsed «Пройдено», an aligned
// affected column.
//
// The items are ordered error, warning, info, success; inside a status the
// longest-lasting first where since is given, then the host's order. The
// list orders, counts and draws; the host owns the problems: it checks, sets
// the whole list again when one appears or ends, and does the actions. A
// snoozed or dismissed item is set aside here at once (the host hears
// snooze or dismiss and stores it), and the notice's «Вернуть» brings it back
// with undo. The list stores and loads nothing.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {pageLocale} from '../../core/js/page-language';
import {noteDeprecated} from '../../core/js/deprecations.js';
import {preloadControlIcons} from '../helpers/cycle';
import {renderListAttentionTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The heading's id, one per list on the page (stable across renders).
let sequence = 0;

export const STATUSES = ['error', 'warning', 'info', 'success'];
const RANK = {error: 0, warning: 1, info: 2, success: 3};
// sf-alert's status icons, by the shared status words.
export const ICONS = {error: 'error', warning: 'warning', info: 'info', success: 'check_circle'};
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// The snooze lengths of the «⋯» menu, in days.
export const SNOOZE = {'snooze-day': 1, 'snooze-week': 7};

// size is deprecated (1.2.0; change journal attribute-list-attention-size-to-density):
// decision C22 gives the density to the page (data-sf-density, a compact
// context), never to a manual size, and in sf-list-timeline size="1/2" is a
// smaller rung, not the compact density. Until 2027-01-01 size="1/2" still
// draws this list compact, as 1.1's own small rung did; it is noted in
// SF.deprecations and said once per page in the console with its
// replacement -- by the component only when the page has not opted in to
// deprecation warnings (data-sf-deprecations="warn"), where SF.deprecations
// already prints it, so a page sees one warning, not two.
export const SIZE_REMOVE_AFTER = '2027-01-01';

function noteSize(host) {
  if (!host.hasAttribute('size')) return;
  noteDeprecated({component: 'sf-list-attention', kind: 'attribute', from: 'size', to: 'data-sf-density', since: '2026-11-10', remove_after: SIZE_REMOVE_AFTER});
  const root = globalThis.SF = globalThis.SF || {};
  const optedIn = globalThis.document?.documentElement?.dataset?.sfDeprecations === 'warn' || root.deprecations?.warn === true;
  if (optedIn || root.__sfListAttentionSizeWarned) return;
  Object.defineProperty(root, '__sfListAttentionSizeWarned', {value: true, configurable: true});
  globalThis.console?.warn?.(`[SIMAI Framework] sf-list-attention: size is deprecated until ${SIZE_REMOVE_AFTER}; the density comes from the page -- write data-sf-density="compact" on the list or on the region or page around it. See contracts/changes/journal.json (attribute-list-attention-size-to-density).`);
}

// The icons this list can draw, asked for when it connects and when it draws
// (R074 F3; preloadControlIcons, as sf-segmented and sf-tag do). The status
// icons are filled glyphs of their own <i>, scanned only after the page's
// first icon request: they went in a second one and, on icons.simai.io, drew
// at 1.05-1.15 s against rows at 0.11 s, while the icon is the row's only
// visible status sign. Every status the list can draw is declared when it
// connects -- before the host has set any items, so the list does not wait
// for its data -- filled for the rows (check_circle for passed and the empty
// line) and outlined for the head's badges (sf-badge icon-start), which,
// left out, asked the same list again. The settings known at connect add
// the controls' glyphs: the «⋯» and its menu with triage, the recheck with
// checked-at, «Все проблемы» / «Показать все» outside group mode, the
// chevron in group mode --
// so a host whose items come late still sends one request. What the data
// adds (a help link's menu without triage) is added when drawn. One list
// per host, asked once while it stays the same.
const MENU_ICONS = ['schedule', 'event', 'notifications_off', 'help'];

export const STATUS_GLYPHS = Object.freeze([
  ...STATUSES.map((one) => ({icon: ICONS[one], filled: true})),
  ...STATUSES.map((one) => ({icon: ICONS[one], filled: false})),
]);

export function listIcons(host, context = null) {
  const entries = [...STATUS_GLYPHS];
  const add = (icon, filled) => {
    if (icon && !entries.some((one) => one.icon === icon && one.filled === filled)) entries.push({icon, filled});
  };
  const menu = () => ['more_horiz', ...MENU_ICONS].forEach((icon) => add(icon, false));
  if (host?.hasAttribute?.('triage')) menu();
  if (host?.hasAttribute?.('checked-at')) add('refresh', false);
  // «Все проблемы» with more-href, or «Показать все» past the limit, which
  // the items decide later: every list but group mode can show it.
  if (host?.getAttribute?.('group') === 'severity') add('expand_more', false);
  else if (host) add('arrow_forward', false);
  if (!context) return entries;
  const rows = context.grouped ? (context.groups ?? []).flatMap((one) => one.items) : context.list ?? [];
  if (rows.some((item) => item.menu)) menu();
  if (context.checked) add('refresh', false);
  if (context.more) add('arrow_forward', false);
  if (context.grouped) add('expand_more', false);
  return entries;
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An item's status: the four words; danger is read as error, anything else as info. */
export function statusOf(value) {
  const word = text(value).toLowerCase();
  if (word === 'danger') return 'error';
  return STATUSES.includes(word) ? word : 'info';
}

/** A moment given as an ISO date-time or a number of milliseconds; NaN when neither. */
export function momentOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const given = text(value);
  if (!given) return NaN;
  return /^-?\d+$/u.test(given) ? Number(given) : Date.parse(given);
}

/**
 * The items as given, made safe and ordered by severity; inside a status the
 * longest-lasting first where since is given (an item without one after
 * them), then the host's order. An item without an id or a title, or with an
 * id seen before, is left out. An action needs a label and an href or an
 * event; an object a label.
 */
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const items = [];
  list.forEach((item, order) => {
    if (!item || typeof item !== 'object') return;
    const id = text(item.id);
    const title = text(item.title);
    if (!id || !title || seen.has(id)) return;
    seen.add(id);
    const given = item.action && typeof item.action === 'object' ? item.action : null;
    const label = text(given?.label);
    const href = text(given?.href);
    const event = text(given?.event);
    const object = item.object && typeof item.object === 'object' ? item.object : null;
    const objectLabel = text(object?.label);
    const since = momentOf(item.since);
    items.push({
      id,
      status: statusOf(item.status),
      title,
      text: text(item.text),
      action: label && (href || event) ? {label, href, event} : null,
      object: objectLabel ? {label: objectLabel, href: text(object.href)} : null,
      since: Number.isFinite(since) ? since : null,
      source: text(item.source),
      affected: text(item.affected),
      help: text(item.help),
      dismissible: typeof item.dismissible === 'boolean' ? item.dismissible : null,
      order,
    });
  });
  const age = (a, b) => {
    if (a.since !== null && b.since !== null) return a.since - b.since;
    if (a.since !== null) return -1;
    if (b.since !== null) return 1;
    return 0;
  };
  return items.sort((a, b) => (RANK[a.status] - RANK[b.status]) || age(a, b) || (a.order - b.order));
}

/** The passed checks of group mode: strings or {id?, title, text?}. */
export function normalizePassed(value) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    if (typeof item === 'string') return {id: `passed-${index}`, title: text(item), text: ''};
    if (!item || typeof item !== 'object') return null;
    return {id: text(item.id) || `passed-${index}`, title: text(item.title), text: text(item.text)};
  }).filter((item) => item && item.title);
}

// The narrow column's parts (C45): the summary as a line of text, the quiet
// line's two lines and its icon recheck.
const NARROW_PARTS = [
  '.sf-list-attention-summary-line',
  '.sf-list-attention-quiet-title',
  '.sf-list-attention-quiet-meta',
  '.sf-list-attention-recheck--narrow',
].join(', ');

const ListAttentionElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfListAttention extends ListAttentionElement {
  constructor() {
    super();
    this._headingId = `sf-list-attention-heading-${++sequence}`;
    // Set aside by snooze or dismiss: id -> 'snooze' | 'dismiss'.
    this._aside = new Map();
    // The rows past the limit shown in place (no more-href).
    this._all = false;
    // Group mode: which groups are open; «Пройдено» starts closed.
    this._open = {error: true, warning: true, info: true, success: true, passed: false};
    this._menuFor = '';
    this._focusAfter = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // Before the first draw and before any items: every status glyph.
    if (this.isConnected) preloadControlIcons(this, listIcons(this));
  }

  /** Every item the host gave, ordered, the set-aside ones left out. */
  get list() {
    const all = normalizeItems(this.items);
    // An id the host no longer gives was dealt with: forget it.
    const ids = new Set(all.map((item) => item.id));
    for (const id of [...this._aside.keys()]) if (!ids.has(id)) this._aside.delete(id);
    return all.filter((item) => !this._aside.has(item.id));
  }

  get grouped() {
    return this.group === 'severity';
  }

  // ── what a press does ───────────────────────────────────────────────────

  // A link (an action, an object or the help of a check): the request
  // first; not cancelled, the browser follows it.
  onNavigate(event, item, part = 'action') {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = part === 'object' ? item.object?.href ?? ''
      : part === 'help' ? item.help ?? ''
        : item.action?.href ?? '';
    const allowed = this.sfEmit('navigate', {id: item.id, status: item.status, href, part}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  // An action button: the fact; the host does it.
  onApply(item) {
    this.sfEmit('apply', {action: item.action?.event ?? '', scope: 'entry', ids: [item.id], id: item.id, status: item.status});
  }

  // «Все проблемы (N)»: with more-href a link, asked first; without it the
  // rows past the limit open in place.
  onAll(event) {
    const href = this.moreHref;
    if (href) {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const allowed = this.sfEmit('all', {href}, {cancelable: true});
      if (!allowed) event.preventDefault();
      return;
    }
    if (!this.sfEmit('all', {href: ''}, {cancelable: true})) return;
    this._all = true;
    this.requestComponentUpdate('all');
  }

  onRecheck() {
    this.sfEmit('recheck', {});
  }

  onToggleGroup(key) {
    this._open[key] = !this._open[key];
    this.requestComponentUpdate('group');
  }

  // ── the «⋯» menu ────────────────────────────────────────────────────────

  get menu() {
    return this.querySelector(':scope > .sf-list-attention > .sf-list-attention-menu');
  }

  /**
   * May this item be dismissed: the page's permission (the host's
   * dismissible) gates it; an item's dismissible: false only takes it away,
   * an item can never grant it to a person without the right.
   */
  canDismiss(item) {
    return this.dismissible === true && item.dismissible !== false;
  }

  /** The entries of an item's «⋯»: snooze and dismiss with triage, help with a help link. */
  menuEntries(item) {
    const entries = [];
    if (this.triage) {
      entries.push({id: 'snooze-day', text: this.sfWord('snooze-day-text'), icon: 'schedule'});
      entries.push({id: 'snooze-week', text: this.sfWord('snooze-week-text'), icon: 'event'});
      if (this.canDismiss(item)) entries.push({id: 'dismiss', text: this.sfWord('dismiss-text'), icon: 'notifications_off'});
    }
    if (item.help) {
      if (entries.length) entries.push({type: 'separator'});
      entries.push({id: 'help', text: this.sfWord('help-text'), icon: 'help', href: item.help});
    }
    return entries;
  }

  openMenu(item, anchor) {
    const menu = this.menu;
    if (!menu) return;
    this._menuFor = item.id;
    menu.setAttribute('aria-label', this.sfWord('more-label', {vars: {title: item.title}}));
    menu.entries = this.menuEntries(item);
    // The Loader brings sf-menu-context when it is first needed (a lazy
    // relation); a press before that waits for it.
    customElements.whenDefined('sf-menu-context').then(() => menu.toggleFor(anchor));
  }

  onMenuSelect(event) {
    event.stopPropagation();
    const choice = event.detail?.id;
    const item = normalizeItems(this.items).find((one) => one.id === this._menuFor);
    if (!item || !choice) return;
    // «Подробнее о проверке» is a link row: the menu raised select inside the
    // click on it, so the click is still going up. The root's click listener
    // (onRootClick, after the menu's own) asks navigate with that click and
    // stops the link when the host cancels it.
    if (choice === 'help') {
      this._helpFor = item;
      return;
    }
    if (Object.hasOwn(SNOOZE, choice)) this.snooze(item, SNOOZE[choice]);
    else if (choice === 'dismiss' && this.canDismiss(item)) this.dismiss(item);
  }

  // The click that chose «Подробнее о проверке», on its way up past the menu.
  onRootClick(event) {
    const item = this._helpFor;
    if (!item) return;
    this._helpFor = null;
    this.onNavigate(event, item, 'help');
  }

  /** Snoozes an item for some days: the request, then set aside with an undo notice. */
  snooze(item, days) {
    const until = new Date(Date.now() + days * DAY).toISOString();
    if (!this.sfEmit('snooze', {id: item.id, until}, {cancelable: true})) return false;
    this.setAside(item, 'snooze', this.sfWord(days === 1 ? 'snoozed-day-notice' : 'snoozed-week-notice', {vars: {title: item.title}}));
    return true;
  }

  /** «Не напоминать»: the request, then set aside with an undo notice. */
  dismiss(item) {
    if (!this.sfEmit('dismiss', {id: item.id}, {cancelable: true})) return false;
    this.setAside(item, 'dismiss', this.sfWord('dismissed-notice', {vars: {title: item.title}}));
    return true;
  }

  setAside(item, action, notice) {
    const shown = this.shownIds();
    const at = shown.indexOf(item.id);
    // The focus goes to the next row's «⋯», or the previous one's, or the list.
    this._focusAfter = shown[at + 1] ?? shown[at - 1] ?? '';
    this._aside.set(item.id, action);
    this.requestComponentUpdate('aside');
    globalThis.SF?.notify?.({
      status: 'neutral',
      title: notice,
      source: this.localName,
      key: `${this.localName}|${this._headingId}|${item.id}|${action}`,
      action: {label: this.sfWord('undo-text'), onSelect: () => this.undo(item.id)},
    });
  }

  /** «Вернуть»: an item set aside comes back, and the host hears undo. */
  undo(itemId) {
    const action = this._aside.get(itemId);
    if (!action) return false;
    this._aside.delete(itemId);
    this._focusAfter = itemId;
    this.requestComponentUpdate('undo');
    this.sfEmit('undo', {id: itemId, action});
    return true;
  }

  // The ids of the rows drawn, in order.
  shownIds() {
    return [...this.querySelectorAll('.sf-list-attention-item[data-id]')].map((row) => row.dataset.id);
  }

  // Both forms of the head and of the quiet line are drawn and the sheet's
  // container query shows one (C45). Until the sheet is in, the narrow
  // column's parts are hidden, so a late sheet shows one form, not both. A
  // ResizeObserver on the drawing finds the sheet: it reports before the
  // frame is painted with it, and the parts are shown in that same frame.
  whenRenderedStylesReady(target) {
    this.holdNarrowParts();
    return super.whenRenderedStylesReady(target);
  }

  sheetIn(root) {
    return getComputedStyle(root).containerType === 'inline-size';
  }

  holdNarrowParts() {
    const root = this.querySelector(':scope > .sf-list-attention');
    if (!root || this._sheetSeen) return;
    if (this.sheetIn(root)) {
      this.releaseNarrowParts();
      return;
    }
    for (const part of this.querySelectorAll(NARROW_PARTS)) part.hidden = true;
    if (typeof ResizeObserver !== 'function' || this._sheetWatch?.root === root) return;
    this._sheetWatch?.observer.disconnect();
    const observer = new ResizeObserver(() => {
      if (root.isConnected && this.sheetIn(root)) this.releaseNarrowParts();
    });
    this._sheetWatch = {root, observer};
    observer.observe(root);
    if (root.firstElementChild) observer.observe(root.firstElementChild);
  }

  releaseNarrowParts() {
    this._sheetSeen = true;
    this._sheetWatch?.observer.disconnect();
    this._sheetWatch = null;
    for (const part of this.querySelectorAll(NARROW_PARTS)) part.hidden = false;
  }

  onDisconnected() {
    this._sheetWatch?.observer.disconnect();
    this._sheetWatch = null;
    super.onDisconnected?.();
  }

  afterRender(changed) {
    super.afterRender?.(changed);
    // The sheet gate let go (in, or its time ran out): the parts are shown.
    if (!this._sheetSeen) {
      const root = this.querySelector(':scope > .sf-list-attention');
      if (root && this.sheetIn(root)) this.releaseNarrowParts();
    }
    if (this._focusAfter === null) return;
    const target = this._focusAfter;
    this._focusAfter = null;
    // After the menu gives the focus back to its (now gone) anchor.
    setTimeout(() => {
      const row = target ? [...this.querySelectorAll('.sf-list-attention-item[data-id]')].find((one) => one.dataset.id === target) : null;
      const button = row?.querySelector('.sf-list-attention-more button') ?? row?.querySelector('.sf-list-attention-action :is(a, button)');
      (button ?? this.querySelector(':scope > .sf-list-attention'))?.focus?.();
    }, 0);
  }

  // ── words ───────────────────────────────────────────────────────────────

  /** How long a problem lasts: «только что», «12 мин», «5 ч», «2 дня». */
  ageText(since, now = Date.now()) {
    if (since === null) return '';
    const span = Math.max(0, now - since);
    if (span < MINUTE) return this.sfWord('age-now');
    if (span < HOUR) return this.sfWord('age-minutes', {count: Math.floor(span / MINUTE)});
    if (span < DAY) return this.sfWord('age-hours', {count: Math.floor(span / HOUR)});
    return this.sfWord('age-days', {count: Math.floor(span / DAY)});
  }

  /** When the checks ran: «5 мин назад» within the hour, «в 14:05» today, the date before. */
  checkedText(now = Date.now()) {
    const at = momentOf(this.checkedAt);
    if (!Number.isFinite(at)) return '';
    const span = now - at;
    if (span >= 0 && span < MINUTE) return this.sfWord('checked-now');
    if (span >= 0 && span < HOUR) return this.sfWord('checked-minutes', {count: Math.floor(span / MINUTE)});
    const locale = pageLocale(this);
    const time = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'}).format(at);
    if (new Date(at).toDateString() === new Date(now).toDateString()) return this.sfWord('checked-time', {vars: {time}});
    const date = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long'}).format(at);
    return this.sfWord('checked-date', {vars: {date, time}});
  }

  templateContext() {
    noteSize(this);
    const list = this.list;
    const count = list.length;
    const status = list[0]?.status ?? '';
    const level = Math.min(6, Math.max(2, Math.trunc(Number(this.headingLevel)) || 3));
    const grouped = this.grouped;
    const limit = Math.max(0, Math.trunc(Number(this.limit)) || 0);
    const limited = !grouped && !this._all && limit > 0 && count > limit;
    const shown = limited ? list.slice(0, limit) : list;
    const now = Date.now();
    const counts = Object.fromEntries(STATUSES.map((one) => [one, list.filter((item) => item.status === one).length]));
    const row = (item) => {
      const meta = [item.text, this.ageText(item.since, now), item.source].filter(Boolean);
      return {
        ...item,
        statusWord: this.sfWord(`status-${item.status}`),
        meta,
        affectedText: item.affected ? this.sfWord('affected-text', {vars: {text: item.affected}}) : '',
        menu: this.menuEntries(item).length > 0,
        moreLabel: this.sfWord('more-label', {vars: {title: item.title}}),
      };
    };
    const passed = grouped ? normalizePassed(this.passed) : [];
    const checked = this.checkedText(now);
    this.sfHostState('data-status', status);
    this.sfHostState('data-empty', count === 0);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      // size is deprecated (noteSize): until its removal size="1/2" still
      // draws compact; the density otherwise comes from the page (C22).
      compact: this.hasAttribute('size') && this.size === '1/2',
      frame: this.frame === 'none' ? 'none' : 'card',
      label: this.label,
      level,
      headingId: this._headingId,
      list: shown.map(row),
      count,
      status,
      grouped,
      groups: grouped ? STATUSES.filter((one) => counts[one]).map((one) => ({
        key: one,
        title: this.sfWord(`group-${one}`),
        count: counts[one],
        open: this._open[one],
        items: list.filter((item) => item.status === one).map(row),
      })) : [],
      // Computed values under keys of their own, not a setting's name (the
      // template-context probe compares a setting's key with its getter).
      passedGroup: passed.length ? {
        key: 'passed',
        title: this.sfWord('group-passed'),
        count: passed.length,
        open: this._open.passed,
        word: this.sfWord('status-passed'),
        items: passed,
      } : null,
      badges: STATUSES.filter((one) => counts[one]).map((one) => ({
        status: one,
        icon: ICONS[one],
        text: this.sfWord(`summary-${one}`, {count: counts[one]}),
      })),
      // The same summary as one line of text, for a narrow column (C45).
      summaryLine: STATUSES.filter((one) => counts[one]).map((one) => this.sfWord(`summary-${one}`, {count: counts[one]})).join(' · '),
      empty: this.empty === 'none' ? 'none' : 'line',
      quietTitle: this.emptyText,
      emptyLine: checked ? this.sfWord('empty-checked-text', {vars: {text: this.emptyText, when: checked}}) : this.emptyText,
      checked,
      checkedLine: checked ? this.sfWord('checked-text', {vars: {when: checked}}) : '',
      recheckLabel: this.sfWord('recheck-label'),
      more: limited || this.moreHref ? {
        href: this.moreHref,
        text: this.moreHref ? this.sfWord('more-text', {count}) : this.sfWord('show-all-text', {count}),
      } : null,
      icons: ICONS,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    const context = this.templateContext();
    preloadControlIcons(this, listIcons(this, context));
    return renderListAttentionTemplate(context);
  }
}

SfListAttention.define('sf-list-attention');

export {SfListAttention};

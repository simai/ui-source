// sf-list-timeline: a short history read from the top -- recent server
// actions, an audit, a record's history, a notifications page, a job's
// history:
//
//   <sf-list-timeline><script type="application/json" data-sf-settings>
//     {"items": [{"id": "e1", "time": "2026-11-09T14:30:00+03:00", "icon": "swap_horiz",
//       "actor": {"name": "Анна Котова", "hue": "teal"}, "title": "изменила статус",
//       "change": {"label": "Статус", "before": "Собран", "after": "Передан в доставку"}}]}
//   </script></sf-list-timeline>
//
// 1.1 (owner decision C40, R092 option 1) builds the event from the
// Framework's shared parts: the marker on the line is .sf-featured-icon (its
// tone the status; a dot when the event has no icon), the actor sf-avatar
// line and a bold name at the start of the sentence, a field change
// sf-change, the time sf-time in one quiet line «time · text», a comment the
// text in an outline, and the day headings block list's .sf-list-heading.
// Runs of one actor and kind longer than collapse fold into «Ещё N», revealed
// in place; state done|current|upcoming draws steps. The list keeps the
// host's order, and stores and loads nothing.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {calendarDayOffset, msUntilNextDay, toDate} from '../../core/js/format-date.js';
import {formatRelativeDay} from '../../core/js/format-relative.js';
import {noteDeprecated} from '../../core/js/deprecations.js';
import {renderListTimelineTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The day headings' ids, one set per list on the page (stable across renders).
let sequence = 0;

export const STATUSES = ['neutral', 'success', 'warning', 'error', 'info'];
export const KINDS = ['event', 'comment', 'sms'];
export const STATES = ['done', 'current', 'upcoming'];
// The glyph a kind puts on the marker when the event names none.
export const KIND_ICONS = {comment: 'chat_bubble', sms: 'phone_iphone'};
// The marker's tone: only error, warning and success colour it (C40); info
// is said in words and drawn neutral.
export const TONES = {error: 'error', warning: 'warning', success: 'success'};
const DENSITY_REMOVE_AFTER = '2027-01-01';

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An event's status: the five words; danger is read as error, anything else as neutral. */
export function statusOf(value) {
  const word = text(value).toLowerCase();
  if (word === 'danger') return 'error';
  return STATUSES.includes(word) ? word : 'neutral';
}

/** Who did it: {name, avatar, hue, system}, from a string (1.0) or an object (1.1); null when nobody. */
export function actorOf(value) {
  if (value && typeof value === 'object') {
    const name = text(value.name);
    if (!name) return null;
    return {name, avatar: text(value.avatar), hue: text(value.hue), system: value.system === true};
  }
  const name = text(value);
  return name ? {name, avatar: '', hue: '', system: false} : null;
}

/** A field change: [{label, before, after}] from one object or a list; [] when none. */
export function changesOf(value) {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  return list.filter((one) => one && typeof one === 'object')
    .map((one) => ({label: text(one.label), before: one.before ?? null, after: one.after ?? null}));
}

/**
 * The events as given, made safe, in the host's order: an event without an
 * id or a title, or with an id seen before, is left out; a time that is no
 * date is none.
 */
export function normalizeItems(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const items = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const id = text(item.id);
    const title = text(item.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const kind = KINDS.includes(text(item.kind)) ? text(item.kind) : 'event';
    const state = STATES.includes(text(item.state)) ? text(item.state) : '';
    items.push({
      id,
      title,
      kind,
      state,
      at: toDate(typeof item.time === 'number' ? item.time : text(item.time)),
      text: text(item.text),
      actor: actorOf(item.actor),
      status: statusOf(item.status),
      icon: text(item.icon) || KIND_ICONS[kind] || '',
      href: text(item.href),
      changes: changesOf(item.changes ?? item.change),
    });
  }
  return items;
}

/**
 * Runs inside one day: consecutive events of one actor and one kind longer
 * than `collapse` fold whole into one «Ещё N» row (list-timeline.html R092),
 * unless the run was opened. [{fold: null, item}] for an event, [{fold: {key,
 * items}}] for a folded run, in order; the key is the run's first id.
 * collapse 0 folds nothing.
 */
export function foldRuns(items, {collapse = 5, opened = new Set()} = {}) {
  const out = [];
  let at = 0;
  while (at < items.length) {
    const first = items[at];
    const who = first.actor?.name ?? '';
    let end = at + 1;
    while (end < items.length && (items[end].actor?.name ?? '') === who && items[end].kind === first.kind) end += 1;
    const run = items.slice(at, end);
    if (collapse > 0 && run.length > collapse && !opened.has(first.id)) {
      out.push({fold: {key: first.id, items: run}, item: null});
    } else {
      for (const item of run) out.push({fold: null, item});
    }
    at = end;
  }
  return out;
}

/**
 * The events in runs of one calendar day (in the reader's time zone), in
 * their order: [{day, at, items}]. An event without a time joins the run
 * before it; grouping none is one run with no day.
 */
export function groupByDay(items, {group = 'day', now = new Date()} = {}) {
  if (group !== 'day') return items.length ? [{day: null, at: null, items}] : [];
  const runs = [];
  for (const item of items) {
    const day = item.at ? calendarDayOffset(item.at, {now}) : null;
    const last = runs[runs.length - 1];
    if (last && (day === null || day === last.day)) last.items.push(item);
    else runs.push({day, at: item.at, items: [item]});
  }
  return runs;
}

const ListTimelineElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfListTimeline extends ListTimelineElement {
  constructor() {
    super();
    this._uid = `sf-list-timeline-${++sequence}`;
    this._timer = 0;
    this._opened = new Set();
    this._focusRun = null;
  }

  onConnected() {
    super.onConnected?.();
    this.syncTimer();
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.stopTimer();
  }

  // The moment the day headings count from: the page's now, else the clock.
  get moment() {
    return toDate(text(this.now)) ?? new Date();
  }

  get list() {
    return normalizeItems(this.items);
  }

  // The days move at the reader's midnight: one timer to it, with the
  // reader's clock and day headings. The times are sf-time's, which keeps its
  // own clock.
  syncTimer() {
    this.stopTimer();
    if (!this.isConnected || toDate(text(this.now)) || this.group !== 'day' || !this.list.some((item) => item.at)) return;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this.requestComponentUpdate('day');
    }, msUntilNextDay(new Date()) + 1000);
  }

  stopTimer() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = 0;
  }

  // density is the page's since 1.1.0 (C22): compact still draws compact
  // until 2027-01-01, noted once in SF.deprecations.
  get compact() {
    if (this.density !== 'compact') return false;
    if (!this._densityNoted) {
      this._densityNoted = true;
      noteDeprecated({component: 'sf-list-timeline', kind: 'attribute', from: 'density', to: 'data-sf-density', since: '2026-11-10', remove_after: DENSITY_REMOVE_AFTER});
    }
    return true;
  }

  // A title link: the request first; not cancelled, the browser follows it.
  onNavigate(event, item) {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const allowed = this.sfEmit('navigate', {id: item.id, href: item.href}, {cancelable: true});
    if (!allowed) event.preventDefault();
  }

  // «Показать ещё»: the request for the page after the last event shown.
  onMore() {
    if (this.loading) return;
    const list = this.list;
    this.sfEmit('load-more', {direction: 'after', after: list[list.length - 1]?.id ?? ''});
  }

  // «Ещё N»: the folded events shown in place, the focus on the first of them;
  // expand tells a host that loads a run lazily which run was opened.
  expand(fold) {
    this._opened.add(fold.key);
    this._focusRun = fold.key;
    this.sfEmit('expand', {run: fold.key, ids: fold.items.map((item) => item.id), count: fold.items.length});
    this.requestComponentUpdate('expand');
  }

  // What sf-time is asked for: the time under a day heading, auto without.
  timeFormatFor(grouped) {
    const asked = this.timeFormat;
    if (asked === 'relative') return 'relative';
    if (asked === 'exact') return grouped ? 'time' : 'datetime';
    return grouped ? 'time' : 'auto';
  }

  templateContext() {
    const now = this.moment;
    const list = this.list;
    const group = this.group === 'none' ? 'none' : 'day';
    const loading = Boolean(this.loading);
    const level = Math.min(6, Math.max(2, Math.trunc(Number(this.headingLevel)) || 3));
    const collapse = Math.max(0, Math.trunc(Number(this.collapse)));
    this.sfHostState('data-empty', list.length === 0);
    this.sfHostState('data-loading', loading);
    const decorate = (item) => ({
      ...item,
      iso: item.at ? item.at.toISOString() : '',
      tone: TONES[item.status] ?? 'neutral',
      statusWord: item.state ? this.sfWord(`state-${item.state}`) : item.status === 'neutral' ? '' : this.sfWord(`status-${item.status}`),
    });
    const runs = groupByDay(list, {group, now}).map((run, at) => ({
      id: `${this._uid}-day-${at}`,
      day: run.day === null || !run.at ? '' : formatRelativeDay(run.at, {now, capital: true, node: this,
        today: this.sfWord('today'), yesterday: this.sfWord('yesterday'), tomorrow: this.sfWord('tomorrow')}),
      date: run.day === 0 || run.day === -1 ? run.at.toISOString() : '',
      entries: foldRuns(run.items, {collapse, opened: this._opened}).map((entry) => (entry.fold
        ? {fold: {...entry.fold, text: this.sfWord(entry.fold.items.every((item) => item.changes.length) ? 'run-changes' : 'run-events', {count: entry.fold.items.length, vars: {n: entry.fold.items.length}})}}
        : {item: decorate(entry.item)})),
    }));
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: ['1/2', '1', '2'].includes(this.size) ? this.size : '1',
      compact: this.compact,
      group,
      level,
      label: this.label,
      runs,
      now: text(this.now),
      timeFormat: this.timeFormatFor(group === 'day'),
      sticky: Boolean(this.stickyHeadings),
      steps: list.some((item) => item.state),
      count: list.length,
      hasMore: Boolean(this.hasMore),
      loading,
      moreText: this.sfWord(loading ? 'loading' : 'more'),
      emptyText: this.emptyText,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderListTimelineTemplate(this.templateContext());
  }

  afterRender() {
    super.afterRender?.();
    this.syncTimer();
    if (this._focusRun) {
      const key = this._focusRun;
      this._focusRun = null;
      const first = [...this.querySelectorAll('.sf-list-timeline-item')].find((li) => li.dataset.id === key);
      if (first) {
        first.setAttribute('tabindex', '-1');
        first.focus({preventScroll: false});
      }
    }
  }
}

SfListTimeline.define('sf-list-timeline');

export {SfListTimeline};

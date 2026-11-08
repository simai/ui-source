// sf-list-timeline: a short history read from the top -- recent server
// actions, an audit, a record's history, a notifications page, a job's
// history:
//
//   <sf-list-timeline><script type="application/json" data-sf-settings>
//     {"items": [{"id": "e1", "time": "2026-10-27T11:50:00+03:00",
//       "status": "success", "title": "Копия создана", "actor": "Планировщик"}]}
//   </script></sf-list-timeline>
//
// Events on a vertical line, each with a status marker (a dot, or the item's
// icon), its title, time, actor and text; grouped by calendar day under
// «Сегодня», «Вчера» or the date; the time relative («5 минут назад») with
// the exact moment under the pointer. has-more draws «Показать ещё», which
// asks load-more; with no events one quiet line. The list keeps the host's
// order, and stores and loads nothing.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {formatDate, calendarDayOffset, msUntilNextDay, toDate} from '../../core/js/format-date.js';
import {formatRelativeDay, formatRelativeTime} from '../../core/js/format-relative.js';
import {renderListTimelineTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The day headings' ids, one set per list on the page (stable across renders).
let sequence = 0;

export const STATUSES = ['neutral', 'success', 'warning', 'error', 'info'];
const MINUTE = 60000;

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An event's status: the five words; danger is read as error, anything else as neutral. */
export function statusOf(value) {
  const word = text(value).toLowerCase();
  if (word === 'danger') return 'error';
  return STATUSES.includes(word) ? word : 'neutral';
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
    items.push({
      id,
      title,
      at: toDate(typeof item.time === 'number' ? item.time : text(item.time)),
      text: text(item.text),
      actor: text(item.actor),
      status: statusOf(item.status),
      icon: text(item.icon),
      href: text(item.href),
    });
  }
  return items;
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
  }

  onConnected() {
    super.onConnected?.();
    this.syncTimer();
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.stopTimer();
  }

  // The moment the times count from: the page's now, else the clock.
  get moment() {
    return toDate(text(this.now)) ?? new Date();
  }

  get list() {
    return normalizeItems(this.items);
  }

  // With the reader's clock and something that moves (a relative time or a
  // day heading), one timer: to the next minute, or to midnight when only the
  // days move. None with a fixed now, no events, or off the page.
  syncTimer() {
    this.stopTimer();
    if (!this.isConnected || toDate(text(this.now)) || !this.list.some((item) => item.at)) return;
    const relative = this.timeFormat !== 'exact';
    if (!relative && this.group !== 'day') return;
    const now = new Date();
    const wait = relative ? MINUTE - (now.getTime() % MINUTE) : msUntilNextDay(now) + 1000;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this.requestComponentUpdate('time');
    }, wait);
  }

  stopTimer() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = 0;
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

  // An event's time as the list says it, and the exact moment in words.
  timeOf(at, {grouped, now}) {
    if (!at) return null;
    const node = this;
    const exact = formatDate(at, {date: 'long', time: 'short', node});
    let shown;
    if (this.timeFormat === 'exact') shown = grouped ? formatDate(at, {date: null, time: 'short', node}) : formatDate(at, {date: 'medium', time: 'short', node});
    else shown = formatRelativeTime(at, {now, node});
    return {iso: at.toISOString(), shown, exact};
  }

  templateContext() {
    const now = this.moment;
    const list = this.list;
    const group = this.group === 'none' ? 'none' : 'day';
    const loading = Boolean(this.loading);
    const level = Math.min(6, Math.max(2, Math.trunc(Number(this.headingLevel)) || 3));
    this.sfHostState('data-empty', list.length === 0);
    this.sfHostState('data-loading', loading);
    const runs = groupByDay(list, {group, now}).map((run, at) => ({
      id: `${this._uid}-day-${at}`,
      day: run.day === null || !run.at ? '' : formatRelativeDay(run.at, {now, capital: true, node: this,
        today: this.sfWord('today'), yesterday: this.sfWord('yesterday'), tomorrow: this.sfWord('tomorrow')}),
      items: run.items.map((item) => ({
        ...item,
        time: this.timeOf(item.at, {grouped: group === 'day', now}),
        statusWord: item.status === 'neutral' ? '' : this.sfWord(`status-${item.status}`),
      })),
    }));
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      size: ['1/2', '1', '2'].includes(this.size) ? this.size : '1',
      density: this.density === 'compact' ? 'compact' : 'normal',
      group,
      level,
      label: this.label,
      runs,
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
  }
}

SfListTimeline.define('sf-list-timeline');

export {SfListTimeline};

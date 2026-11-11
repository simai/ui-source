// sf-time: a moment as the place needs it (owner decision C40, 2026-11-09):
//
//   <sf-time datetime="2026-11-09T14:32:00+03:00"></sf-time>              auto
//   <sf-time datetime="…" format="time"></sf-time>                        14:32
//   <sf-time datetime="…" format="relative"></sf-time>                    28 минут назад
//
// It draws a <time datetime> with the words of core's SF.format in the page
// language: auto says the first hour relative, today the time, yesterday
// «вчера, 19:40», this year the day and month, older the date with the year.
// When the text is not the full moment, the full date and time are a tooltip
// (the Framework's tooltip composition: hover, keyboard focus, Escape). With
// the reader's clock it draws itself again each minute while relative and at
// the reader's midnight.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files' and SF.format's.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {formatDate, calendarDayOffset, msUntilNextDay, toDate} from '../../core/js/format-date.js';
import {formatRelativeTime} from '../../core/js/format-relative.js';
import {renderTimeTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

export const FORMATS = ['auto', 'time', 'date', 'datetime', 'relative'];
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DURATION = /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/iu;

// The tooltips' ids, one per element on the page (stable across renders).
let sequence = 0;

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** An ISO 8601 duration (PnW, PnDTnHnMnS) in milliseconds; null when it is not one. */
export function durationMs(value) {
  const source = text(value);
  const match = DURATION.exec(source);
  if (!match || source === 'P' || source.endsWith('T')) return null;
  const [weeks, days, hours, minutes, seconds] = match.slice(1).map((part) => Number(String(part ?? '0').replace(',', '.')));
  const ms = ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return Number.isFinite(ms) ? ms : null;
}

/** A moment: an ISO string, milliseconds (a number or digits) or a Date; null when it is none. */
export function momentOf(value) {
  if (value instanceof Date) return toDate(value);
  if (typeof value === 'number') return toDate(value);
  const source = text(value);
  if (!source) return null;
  return toDate(/^-?\d+$/u.test(source) ? Number(source) : source);
}

/**
 * What the element says: {iso, shown, full, relative} for a moment, or null.
 * `node` gives the page language; `words.yesterdayAt` is «вчера, {time}», or a
 * function of the time that says it.
 */
export function describeTime(value, {format = 'auto', now = new Date(), threshold = HOUR, node = null, words = {}} = {}) {
  const at = momentOf(value);
  if (!at) return null;
  const kind = FORMATS.includes(format) ? format : 'auto';
  const base = momentOf(now) ?? new Date();
  const time = () => formatDate(at, {date: null, time: 'short', node});
  const full = formatDate(at, {date: 'long', time: 'short', node});
  let shown;
  let relative = false;
  if (kind === 'time') shown = time();
  else if (kind === 'date') shown = formatDate(at, {intl: {day: 'numeric', month: 'long', ...(at.getFullYear() === base.getFullYear() ? {} : {year: 'numeric'})}, node});
  else if (kind === 'datetime') shown = full;
  else if (kind === 'relative') {
    shown = formatRelativeTime(at, {now: base, node});
    relative = true;
  } else if (Math.abs(base.getTime() - at.getTime()) < threshold) {
    shown = formatRelativeTime(at, {now: base, node});
    relative = true;
  } else {
    const day = calendarDayOffset(at, {now: base});
    if (day === 0) shown = time();
    else if (day === -1) shown = typeof words.yesterdayAt === 'function' ? words.yesterdayAt(time()) : String(words.yesterdayAt ?? '{time}').replace('{time}', time());
    else if (at.getFullYear() === base.getFullYear()) shown = formatDate(at, {intl: {day: 'numeric', month: 'long'}, node});
    else shown = formatDate(at, {date: 'medium', node});
  }
  return {iso: at.toISOString(), shown, full, relative, kind};
}

const TimeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfTime extends TimeElement {
  constructor() {
    super();
    this._uid = `sf-time-${++sequence}`;
    this._timer = 0;
    this._onVisible = () => {
      if (globalThis.document?.visibilityState === 'visible') this.requestComponentUpdate('time');
    };
  }

  onConnected() {
    super.onConnected?.();
    globalThis.document?.addEventListener?.('visibilitychange', this._onVisible);
    this.syncTimer();
  }

  onDisconnected() {
    super.onDisconnected?.();
    globalThis.document?.removeEventListener?.('visibilitychange', this._onVisible);
    this.stopTimer();
  }

  // The moment auto and relative count from: the page's now, else the clock.
  get moment() {
    return momentOf(this.now) ?? new Date();
  }

  get thresholdMs() {
    return durationMs(this.threshold) ?? HOUR;
  }

  describe() {
    return describeTime(this.datetime, {
      format: this.format,
      now: this.moment,
      threshold: this.thresholdMs,
      node: this,
      words: {yesterdayAt: (time) => this.sfWord('yesterday-at', {vars: {time}})},
    });
  }

  // One timer with the reader's clock, for what moves: to the next minute
  // while relative, else to the reader's midnight (auto and relative); none
  // for time, date and datetime, with a fixed now, or off the page.
  syncTimer(said = this._said) {
    this.stopTimer();
    if (!this.isConnected || momentOf(this.now) || !said) return;
    if (said.kind !== 'auto' && said.kind !== 'relative') return;
    const now = new Date();
    let wait = said.relative ? MINUTE - (now.getTime() % MINUTE) + 50 : msUntilNextDay(now) + 1000;
    // auto leaves the relative words at the threshold: draw again then too.
    if (said.kind === 'auto' && said.relative) {
      const left = this.thresholdMs - Math.abs(now.getTime() - Date.parse(said.iso));
      if (left > 0) wait = Math.min(wait, left + 50);
    }
    this._timer = setTimeout(() => {
      this._timer = 0;
      if (globalThis.document?.visibilityState === 'hidden') return;
      this.requestComponentUpdate('time');
    }, wait);
  }

  stopTimer() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = 0;
  }

  templateContext() {
    const said = this.describe();
    this._said = said;
    this.sfHostState('data-empty', !said);
    this.sfHostState('data-relative', Boolean(said?.relative));
    const tooltip = Boolean(said) && this.tooltip !== 'none' && said.kind !== 'datetime';
    const nested = Boolean(this.parentElement?.closest?.('a[href], button, summary, [role="button"], [role="link"]'));
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      said,
      tooltip,
      focusable: tooltip && !nested,
      tipId: `${this._uid}-tip`,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderTimeTemplate(this.templateContext());
  }

  afterRender() {
    super.afterRender?.();
    this.syncTimer();
  }
}

SfTime.define('sf-time');

export {SfTime};

// sf-time: a moment as the place needs it (owner decision C40, 2026-11-09):
//
//   <sf-time datetime="2026-11-09T14:32:00+03:00"></sf-time>              auto
//   <sf-time datetime="…" format="time"></sf-time>                        14:32
//   <sf-time datetime="…" format="relative"></sf-time>                    28 минут назад
//
// It draws a <time datetime> with the words of core's SF.format in the page
// language: auto says the first hour relative, today the time, yesterday
// «вчера, 19:40», this year the day and month, older the date with the year
// in one long form («30 декабря 2025 г.»), a later day its date and its time
// («15 ноября, 10:00»). Every word is the platform's (Intl.DateTimeFormat,
// Intl.RelativeTimeFormat) in the page language: «gestern, 19:40» on a German
// page; the language file only joins the day and the time. When the text is
// not the full moment, the full date and time are a tooltip (the Framework's
// tooltip composition: hover, keyboard focus, Escape). With the reader's clock
// it draws itself again when its words change («1 минуту назад» becomes
// «2 минуты назад» on the half minute the words round at), on one timer for
// every sf-time on the page, which waits while the page is hidden.
//
// First paint (DEV change-time study CT-7): text the server printed inside
// the host -- «<sf-time datetime="…">14:32</sf-time>», or the static markup
// of §5.4 -- holds the line until the code draws the same words in the same
// task, so the line does not move; an empty host gets a time's width from
// core's first-paint sheet.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4,
// §8): the settings are made by core/js/element-manifest.js, the words are
// the language files' and SF.format's.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {formatDate, calendarDayOffset, knownTimeZone, msUntilNextDay, timeZoneOffset, toDate} from '../../core/js/format-date.js';
import {formatRelativeDay, formatRelativeTime} from '../../core/js/format-relative.js';
import {formatLocale, intlFormatter} from '../../core/js/format-intl.js';
import {language} from '../../core/js/page-language.js';
import {renderTimeTemplate} from './js/templates/default';
import manifest from './component.json';
import enFile from './lang/en.json';
import ruFile from './lang/ru.json';
// Only the words on screen ship in the bundle; the title, settings and events
// stay in the language files for the Studio and the docs (localization study LC-2).
const en = {runtime: enFile.runtime};
const ru = {runtime: ruFile.runtime};
import './scss/index.scss';

export const FORMATS = ['auto', 'time', 'date', 'datetime', 'relative'];
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
// A timer longer than this is not one setTimeout keeps (2^31-1 ms fires at
// once); a moment that will not change its words for longer is looked at again.
const LONGEST_WAIT = 24 * 24 * HOUR;
// A wake a little after the change, so the words read on waking are the new ones.
const MARGIN = 50;
const DURATION = /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/iu;

// Where a time is one of many (C183 (2)): a list's item, a feed or a log of
// entries (sf-list, sf-list-timeline, sf-list-attention, sf-alert-bar,
// sf-list-feed).
// A table's cell is one of many too (C204, C183 (2) for tables): a column of
// fifty times is not fifty more stops.
export const IN_LIST = 'li, [role="listitem"], [role="feed"], [role="log"], td, th, [role="cell"], [role="gridcell"], [role="rowheader"], [role="columnheader"]';

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

// The words formatRelativeTime gives for a span, as a key: [unit, value].
// The same steps and rounding (format-relative.js), so the key changes
// exactly when the words do.
// Under a minute there are no seconds (owner decision C183 (1)): a moment
// that has just passed is «только что», one about to come the language's
// «сейчас»; neither changes until the minute.
const RELATIVE_STEPS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

function relativeKey(spanMs) {
  const seconds = Math.round(spanMs / 1000);
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return `${unit}:${Math.round(seconds / size)}`;
  }
  return seconds > 0 ? 'soon' : 'just';
}

/**
 * Relative words for a moment from `now`: «только что» under a minute past
 * (`justNow`, the component's word; null where the page language has none,
 * and then the language's own «now»), the language's «now» under a minute
 * ahead, else formatRelativeTime's («5 минут назад», «через 20 минут»).
 */
export function relativeWords(at, {now = new Date(), node = null, justNow = null} = {}) {
  const moment = momentOf(at);
  const base = momentOf(now);
  if (!moment || !base) return '';
  const key = relativeKey(moment.getTime() - base.getTime());
  if (key === 'just' || key === 'soon') {
    const own = key === 'just' && typeof justNow === 'function' ? justNow() : justNow;
    if (key === 'just' && own) return String(own);
    return intlFormatter('RelativeTimeFormat', formatLocale({node}), {numeric: 'auto'}).format(0, 'second');
  }
  return formatRelativeTime(moment, {now: base, node});
}

/** The IANA name of a zone: `timeZone` when the platform knows it, else the reader's. */
export function zoneId(timeZone = '') {
  if (knownTimeZone(timeZone)) return String(timeZone).trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/** The language-file key of a zone's own name: zone-europe-moscow. */
export const zoneWordKey = (id) => `zone-${String(id).toLowerCase().replace(/[/_]/gu, '-')}`;

/**
 * The zone a moment is written in, as its tooltip names it (owner decision
 * C183 (3)): the zone's name and its offset from UTC -- «Москва (UTC+3)»,
 * «Центральная Европа (UTC+1)», «Индия (UTC+5:30)»; only the offset where
 * there is no name («UTC»). The name is `name(id)` when it gives one (the
 * component's words for the zones of Russia: browsers carry no city names in
 * other languages, Chrome says «Moscow» on a Russian page), else the
 * platform's generic name in the page language (Intl, longGeneric).
 * `timeZone` is an IANA name; empty or unknown, the reader's own.
 */
export function zoneLabel(at, {timeZone = '', node = null, name = null} = {}) {
  const moment = momentOf(at);
  if (!moment) return '';
  const minutes = timeZoneOffset(moment, {timeZone});
  const hours = Math.trunc(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  const offset = minutes === 0 ? 'UTC' : `UTC${minutes > 0 ? '+' : '\u2212'}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
  let said = typeof name === 'function' ? name(zoneId(timeZone)) : null;
  if (!said) {
    try {
      const options = {timeZoneName: 'longGeneric', ...(knownTimeZone(timeZone) ? {timeZone} : {})};
      said = intlFormatter('DateTimeFormat', formatLocale({node}), options).formatToParts(moment).find((part) => part.type === 'timeZoneName')?.value ?? '';
    } catch {
      said = '';
    }
  }
  return !said || /^(?:GMT|UTC)/u.test(said) ? offset : `${said} (${offset})`;
}

/**
 * Milliseconds from `now` until relative words for `at` change («1 минуту
 * назад» → «2 минуты назад» at 1 min 30 s, «59 секунд» → «1 минуту» at a
 * minute), looked for up to `limit`; `limit` when they do not change before.
 * Each set of words holds for one unbroken stretch of time, so the first
 * change is found by halving.
 */
export function msUntilRelativeChange(at, now = Date.now(), limit = LONGEST_WAIT) {
  const moment = momentOf(at)?.getTime();
  const base = momentOf(now)?.getTime();
  if (!Number.isFinite(moment) || !Number.isFinite(base)) return limit;
  const key = relativeKey(moment - base);
  if (relativeKey(moment - base - limit) === key) return limit;
  let low = 0;
  let high = limit;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (relativeKey(moment - base - middle) === key) low = middle;
    else high = middle;
  }
  return high;
}

const joinWords = (said, day, time) => (typeof said === 'function'
  ? said(day, time)
  : String(said ?? '{day}, {time}').replace(/\{(?:day|date)\}/u, day).replace('{time}', time));

/**
 * What the element says: {iso, shown, full, tip, relative, kind} for a
 * moment, or null. `node` gives the page language, `timeZone` (IANA) the
 * clock the moment is written on, the reader's own when empty. The words are
 * Intl's; `words.yesterdayAt` and `words.dateAt` only join a day and a time:
 * a pattern «{day}, {time}» or a function (day, time). A pattern without
 * {day} (a product's own «вчера в {time}») is used as it is.
 * `words.justNow` is the word under a minute past (C183 (1)). `tip` is the
 * full moment with its zone named (C183 (3)): «13 ноября 2026 г. в 19:40,
 * Москва (UTC+3)».
 */
export function describeTime(value, {format = 'auto', now = new Date(), threshold = HOUR, node = null, words = {}, timeZone = ''} = {}) {
  const at = momentOf(value);
  if (!at) return null;
  const kind = FORMATS.includes(format) ? format : 'auto';
  const base = momentOf(now) ?? new Date();
  const zone = knownTimeZone(timeZone) ? timeZone : '';
  const time = () => formatDate(at, {date: null, time: 'short', timeZone: zone, node});
  // One form of a date in every format (CT-10): the day and the long month,
  // the year when it is not this one.
  const dayAndMonth = () => formatDate(at, {intl: {day: 'numeric', month: 'long', ...(at.getFullYear() === base.getFullYear() ? {} : {year: 'numeric'})}, timeZone: zone, node});
  const full = formatDate(at, {date: 'long', time: 'short', timeZone: zone, node});
  const relativeNow = () => relativeWords(at, {now: base, node, justNow: words.justNow});
  let shown;
  let relative = false;
  if (kind === 'time') shown = time();
  else if (kind === 'date') shown = dayAndMonth();
  else if (kind === 'datetime') shown = full;
  else if (kind === 'relative') {
    shown = relativeNow();
    relative = true;
  } else if (Math.abs(base.getTime() - at.getTime()) < threshold) {
    shown = relativeNow();
    relative = true;
  } else {
    const day = calendarDayOffset(at, {now: base, timeZone: zone});
    const ahead = at.getTime() > base.getTime();
    // The future mirrors the past (owner decision C183 (4)): later today is
    // «сегодня, 14:00» (the past of today stays «09:05»), tomorrow «завтра,
    // 10:00», then the date and the time. «сегодня», «завтра» and «вчера» are
    // the language's own (Intl.RelativeTimeFormat, numeric auto): «gestern»,
    // «morgen», «أمس» (CT-9).
    const relativeDay = () => formatRelativeDay(at, {now: base, weekday: false, timeZone: zone, node});
    if (day === 0) shown = ahead ? joinWords(words.dateAt, relativeDay(), time()) : time();
    else if (day === -1) shown = joinWords(words.yesterdayAt, relativeDay(), time());
    else if (day === 1) shown = joinWords(words.dateAt, relativeDay(), time());
    // A later day keeps its time: «17 ноября, 10:00» (CT-11).
    else if (day > 1) shown = joinWords(words.dateAt, dayAndMonth(), time());
    else shown = dayAndMonth();
  }
  const where = zoneLabel(at, {timeZone: zone, node, name: words.zoneName});
  return {iso: at.toISOString(), shown, full, tip: where ? `${full}, ${where}` : full, relative, kind};
}

// One timer for every sf-time on the page (CT-5): each element says when its
// words change next (due), and the clock wakes once, at the earliest. While
// the page is hidden it does not run at all; when it shows again every
// element draws once with the clock as it is.
const clock = {
  elements: new Set(),
  timer: 0,
  pending: false,
  listening: false,
  hidden: () => globalThis.document?.visibilityState === 'hidden',
  watch(element) {
    this.elements.add(element);
    if (!this.listening && globalThis.document?.addEventListener) {
      this.listening = true;
      globalThis.document.addEventListener('visibilitychange', () => this.onVisibility());
    }
    this.schedule();
  },
  forget(element) {
    if (this.elements.delete(element)) this.schedule();
  },
  // Many elements say their due in one task (a list drawn at once): the
  // timer is set once, after them.
  schedule() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      this.arm();
    });
  },
  arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = 0;
    if (this.hidden()) return;
    let next = Infinity;
    for (const element of this.elements) next = Math.min(next, element._due);
    if (!Number.isFinite(next)) return;
    this.timer = setTimeout(() => this.tick(), Math.min(Math.max(0, next - Date.now()), LONGEST_WAIT));
  },
  tick() {
    this.timer = 0;
    if (this.hidden()) return;
    const now = Date.now();
    for (const element of this.elements) {
      if (element._due <= now) {
        element._due = Infinity;
        element.requestComponentUpdate('time');
      }
    }
    this.arm();
  },
  onVisibility() {
    if (this.hidden()) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = 0;
      return;
    }
    for (const element of this.elements) {
      element._due = Infinity;
      element.requestComponentUpdate('time');
    }
    this.arm();
  },
};

/** Milliseconds until the words of a said moment change, with the reader's clock; Infinity when they never do. */
export function msUntilWordsChange(said, {now = Date.now(), threshold = HOUR, timeZone = ''} = {}) {
  if (!said || (said.kind !== 'auto' && said.kind !== 'relative')) return Infinity;
  const at = Date.parse(said.iso);
  const base = momentOf(now)?.getTime() ?? Date.now();
  if (said.kind === 'relative') return msUntilRelativeChange(at, base);
  const midnight = msUntilNextDay(new Date(base), {timeZone}) + 1000;
  if (said.relative) {
    // Past moments leave the relative words at the threshold; a coming one
    // stays relative until it is past by the threshold.
    const leaves = at + threshold - base;
    return Math.min(msUntilRelativeChange(at, base, Math.max(1, Math.min(leaves, LONGEST_WAIT))), Math.max(1, leaves), midnight);
  }
  // A coming moment becomes relative when it is the threshold away.
  const enters = at - threshold - base;
  return enters > 0 ? Math.min(enters, midnight) : midnight;
}

const TimeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
});

class SfTime extends TimeElement {
  // The host's own text is the server's first paint (CT-7): it stands until
  // the first render, which replaces it in the same task.
  static clearLightDomBeforeFirstRender = true;

  constructor() {
    super();
    this._uid = `sf-time-${++sequence}`;
    this._due = Infinity;
  }

  onConnected() {
    super.onConnected?.();
    this.syncTimer();
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.stopTimer();
  }

  // The moment auto and relative count from: the page's now, else the clock.
  get moment() {
    return momentOf(this.now) ?? new Date();
  }

  get thresholdMs() {
    return durationMs(this.threshold) ?? HOUR;
  }

  // The zone the moment is written on (C183 (3)): the time-zone setting when
  // the platform knows it, else the reader's own.
  get zone() {
    return knownTimeZone(this.timeZone) ? String(this.timeZone).trim() : '';
  }

  // «только что» is the component's word, in the languages it has words for
  // (its files and what a product registered); another page language says its
  // own «now» (Intl) rather than a Russian or an English word.
  justNow() {
    const wanted = formatLocale({node: this}).toLowerCase();
    const known = ['ru', 'en', ...language.known('sf-time')];
    const has = known.includes(wanted) || known.includes(wanted.split('-')[0]);
    return has ? this.sfWord('just-now') : null;
  }

  // A zone's own name where the component has one in the page language: the
  // zones of Russia in its files (ru, en) and in any language a pack or a
  // product gave words for, else null and the platform names it. Until
  // 1.7.1 only ru and en were read, and a pack's zone words were never said.
  zoneName(id) {
    if (!id) return null;
    const key = zoneWordKey(id);
    const wanted = formatLocale({node: this}).toLowerCase().replace('_', '-');
    const registered = globalThis.__sfPageLanguage?.registered?.get?.('sf-time');
    for (const code of [...new Set([wanted, wanted.split('-')[0]])]) {
      const own = registered?.get?.(code)?.[key] ?? {ru, en}[code]?.runtime?.[key];
      if (typeof own === 'string' && own.trim()) return this.sfWord(key);
    }
    return null;
  }

  describe() {
    return describeTime(this.datetime, {
      format: this.format,
      now: this.moment,
      threshold: this.thresholdMs,
      node: this,
      timeZone: this.zone,
      words: {
        yesterdayAt: (day, time) => this.sfWord('yesterday-at', {vars: {day, time}}),
        dateAt: (date, time) => this.sfWord('date-at', {vars: {date, time}}),
        justNow: () => this.justNow(),
        zoneName: (id) => this.zoneName(id),
      },
    });
  }

  // With the reader's clock, what moves says when it changes next and the
  // page's one clock wakes it then: relative words when they round to new
  // ones, auto also at its threshold and at the reader's midnight. Nothing
  // for time, date and datetime, with a fixed now, or off the page.
  syncTimer(said = this._said) {
    if (!this.isConnected || momentOf(this.now) || !said) {
      this.stopTimer();
      return;
    }
    const wait = msUntilWordsChange(said, {threshold: this.thresholdMs, timeZone: this.zone});
    if (!Number.isFinite(wait)) {
      this.stopTimer();
      return;
    }
    this._due = Date.now() + wait + MARGIN;
    clock.watch(this);
  }

  stopTimer() {
    this._due = Infinity;
    clock.forget(this);
  }

  templateContext() {
    const said = this.describe();
    this._said = said;
    this.sfHostState('data-empty', !said);
    this.sfHostState('data-relative', Boolean(said?.relative));
    // hasTip, not tooltip: the tooltip prop keeps its own value (auto) in the context.
    const hasTip = Boolean(said) && this.tooltip !== 'none' && said.kind !== 'datetime';
    const nested = Boolean(this.parentElement?.closest?.('a[href], button, summary, [role="button"], [role="link"]'));
    // In a list or a feed the time is no Tab stop (owner decision C183 (2)):
    // fifty rows are not fifty more stops. The row's own text carries the
    // exact moment (a visually hidden line), the tooltip still shows on
    // hover. A time that stands alone stays a stop.
    const inList = Boolean(this.parentElement?.closest?.(IN_LIST));
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      said,
      hasTip,
      focusable: hasTip && !nested && !inList,
      spoken: hasTip && (nested || inList),
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

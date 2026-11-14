// sf-progress-run: a long job as a person sees it -- creating a site, an
// update, a backup or a restore, an import, a package install:
//
//   <sf-progress-run label="Импорт товаров" total="12000" value="4812"
//       unit="товар|товара|товаров" pausable cancelable minimizable>
//     <script type="application/json" data-sf-settings>
//       {"steps": [{"id": "read", "title": "Чтение файла", "state": "done", "duration": 4000},
//                  {"id": "rows", "title": "Товары", "state": "running", "value": 4812, "total": 12000}],
//        "counters": [{"id": "added", "label": "Добавлено", "value": 3700},
//                     {"id": "errors", "label": "{n} ошибка|{n} ошибки|{n} ошибок", "value": 0, "status": "error"}]}
//     </script>
//   </sf-progress-run>
//
//   run.value = 5120;                                  // the bar, the figures, the time left
//   run.step({id: 'rows', value: 5120});
//   run.chunk({text: 'Row 218: price is not a number\n', step: 'rows'});
//
// One element, three looks (owner decision C34): look full (the card, and
// once ended its summary), compact (a table row) and notice (a corner
// panel's row). The steps with their states and times, a log per step and a
// collapsible output pane that follows the newest line only while the reader
// is at its end (core's reading position), copy and download, the overall
// bar with «N из M · %» and the time left, the counts as one line, the first
// errors, and Pause/Continue, Cancel, Minimize, Retry and Hide as requests to
// the host. The host drives it: it sets the numbers and the steps (or changes
// one with step) and appends the output (chunk); the component polls nothing
// and does none of the actions itself.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings, values and actions are made by
// core/js/element-manifest.js, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {toDate} from '../../core/js/format-intl.js';
import {pageLocale} from '../../core/js/page-language.js';
import {readingPosition} from '../../core/js/reading-position';
import {tagSelector} from '../../core/js/tag-aliases.js';
import {renderProgressRunTemplate} from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The ids of a run's parts, one set per run on the page (the same on every
// render, so a first-paint snapshot is stable).
let sequence = 0;

export const STEP_STATES = ['waiting', 'running', 'done', 'failed', 'skipped'];
export const RUN_STATES = ['waiting', 'running', 'paused', 'done', 'partial', 'failed', 'cancelled'];
export const ENDED = ['done', 'partial', 'failed', 'cancelled'];
// row is the table row's look; compact, its former name, is a dated value
// alias of row until 2027-01-01 (aliases.json; owner decision C134: the word
// compact means density only).
export const VIEWS = ['full', 'row', 'notice'];
// sf-steps' state glyphs (sf-steps 1.2.0, sf-wizard); waiting is an empty ring.
export const ICONS = {waiting: 'radio_button_unchecked', running: 'progress_activity', done: 'check_circle', failed: 'error', skipped: 'do_not_disturb_on', cancelled: 'cancel', partial: 'warning', paused: 'pause_circle'};
// The output a run keeps: the oldest lines leave past this many characters.
export const OUTPUT_LIMIT = 500000;
// The errors the summary shows in the card (C34: the first five, then a report).
export const ERRORS_SHOWN = 5;
// The time left is shown once the rate has been seen this long, from a window
// of this length (NN/g, Apple HIG: no estimate before it means something).
export const RATE_SETTLE_MS = 5000;
export const RATE_WINDOW_MS = 30000;
// The progress a screen reader hears from the run's polite live region: the
// count in words («4 812 из 12 000 товаров, 40 %»), at most once in this
// many ms and only when it changed, never at the first paint.
export const ANNOUNCE_MS = 10000;

// One state, one look in every look (C34, R073): the badge of sf-badge 1.4.0
// and the status of the overall bar (sf-progress-bar 1.3.0). A job waiting or
// running has no status: its bar is the theme's primary, as before (since
// sf-progress-bar 1.4.0, owner decision C131 (1), neutral is grey); a
// cancelled job's bar is that grey.
export const STATE_LOOK = {
  waiting: {activity: 'queued', bar: ''},
  running: {activity: 'running', bar: ''},
  paused: {activity: 'paused', bar: 'warning'},
  done: {activity: 'done', bar: 'success'},
  partial: {status: 'warning', icon: 'warning', bar: 'warning'},
  failed: {activity: 'failed', bar: 'error'},
  cancelled: {activity: 'stopped', bar: 'neutral'},
};

// Where focus goes when the run's own button that had it is replaced: its
// counterpart first, then the buttons a run in the new state shows.
export const FOCUS_NEXT = {
  pause: ['resume'],
  resume: ['pause'],
  minimize: ['expand'],
  expand: ['minimize'],
  cancel: ['retry', 'hide'],
  retry: ['pause', 'cancel'],
  hide: ['retry'],
  more: ['retry', 'hide'],
};
// The run's button hosts, under their names and the names they replaced
// (asked when needed: the alias table is filled as the bundles load).
const buttonHosts = () => ['sf-button', 'sf-button-icon', 'sf-button-copy'].map((tag) => tagSelector(tag)).join(', ');
export const FOCUS_FALLBACK = ['pause', 'resume', 'cancel', 'retry', 'expand', 'minimize', 'hide'];

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const number = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** A step's state: the five words; anything else is waiting. */
export function stepState(value) {
  const word = text(value).toLowerCase();
  return STEP_STATES.includes(word) ? word : 'waiting';
}

/** The steps as given, made safe: an id and a title each, an id once. */
export function normalizeSteps(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const steps = [];
  for (const step of list) {
    if (!step || typeof step !== 'object') continue;
    const id = text(step.id);
    const title = text(step.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const duration = Number(step.duration);
    steps.push({
      id,
      title,
      state: stepState(step.state),
      text: text(step.text),
      value: number(step.value),
      total: number(step.total),
      unit: text(step.unit),
      log: typeof step.log === 'string' ? step.log : '',
      started: text(step.started),
      finished: text(step.finished),
      duration: step.duration !== undefined && step.duration !== null && step.duration !== '' && Number.isFinite(duration) && duration >= 0 ? duration : null,
    });
  }
  return steps;
}

/** The job's state from its steps: failed, running, done, else waiting. */
export function runState(steps) {
  if (steps.some((step) => step.state === 'failed')) return 'failed';
  if (steps.some((step) => step.state === 'running')) return 'running';
  if (steps.length && steps.every((step) => step.state === 'done' || step.state === 'skipped')) return 'done';
  return 'waiting';
}

/** A step's time in milliseconds: its duration, else finished − started; a running step counts to `now`. */
export function stepTime(step, now = Date.now()) {
  if (step.duration !== null && step.duration !== undefined) return step.duration;
  const start = toDate(step.started);
  if (!start) return null;
  const end = toDate(step.finished);
  if (end) return Math.max(0, end.getTime() - start.getTime());
  return step.state === 'running' ? Math.max(0, now - start.getTime()) : null;
}

/** Milliseconds as m:ss, or h:mm:ss over an hour. */
export function formatTime(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** The output with `more` appended, the oldest whole lines dropped past `limit`. */
export function appendOutput(output, more, limit = OUTPUT_LIMIT) {
  let next = `${output}${more}`;
  if (next.length <= limit) return next;
  next = next.slice(next.length - limit);
  const line = next.indexOf('\n');
  return line >= 0 && line < next.length - 1 ? next.slice(line + 1) : next;
}

// The plural categories in their canonical order (CLDR).
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * A word of the host's in its plural form for `count`: the forms separated by
 * | in the order of the locale's plural categories (ru one|few|many|other, en
 * one|other); a category past the forms given takes the last one.
 */
export function pluralForm(forms, count, locale = 'en') {
  const list = String(forms ?? '').split('|').map((one) => one.trim());
  if (list.length <= 1) return list[0] ?? '';
  let rules;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    rules = new Intl.PluralRules('en');
  }
  const order = CATEGORIES.filter((one) => rules.resolvedOptions().pluralCategories.includes(one));
  const index = order.indexOf(rules.select(Number(count) || 0));
  return list[Math.min(index < 0 ? list.length - 1 : index, list.length - 1)];
}

/** A number in the page's figures (9 227 in Russian, 9,227 in English). */
export function formatNumber(value, locale = 'en') {
  try {
    return new Intl.NumberFormat(locale, {maximumFractionDigits: 0}).format(value);
  } catch {
    return String(Math.round(value));
  }
}

/** The percentage of done: floored, so it says 100 only when everything is done. */
export function percentOf(value, total) {
  if (!(total > 0) || value === null) return null;
  return Math.max(0, Math.min(100, Math.floor((value / total) * 100)));
}

/**
 * The time left from the samples seen, in ms, or null while the rate has not
 * settled: (total − value) / rate over the window, once the samples span
 * RATE_SETTLE_MS and the value moved.
 */
export function estimateRemaining(samples, total, now = Date.now()) {
  if (!(total > 0) || !Array.isArray(samples) || samples.length < 2) return null;
  const recent = samples.filter((one) => now - one.t <= RATE_WINDOW_MS);
  const window = recent.length >= 2 ? recent : samples.slice(-2);
  const first = window[0];
  const last = window[window.length - 1];
  const span = last.t - first.t;
  const done = last.v - first.v;
  if (span < RATE_SETTLE_MS || done <= 0) return null;
  const rate = done / span;
  return Math.max(0, (total - last.v) / rate);
}

/** Time left in words, always rounded up: «меньше минуты», «≈ 6 мин», «≈ 1 ч 5 мин». */
export function remainingWords(ms, word, {short = false} = {}) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  if (ms < 60000) return word(short ? 'remaining-less-short' : 'remaining-less');
  const minutes = Math.ceil(ms / 60000);
  const time = minutes < 60
    ? word('minutes', {count: minutes})
    : word('hours', {vars: {h: Math.floor(minutes / 60), m: minutes % 60}});
  return word(short ? 'remaining-short' : 'remaining', {vars: {time}});
}

/** The counters as the line draws them: zero ones left out, an error one at zero only once ended (its zero words). */
export function shownCounters(counters, {ended = false} = {}) {
  const list = Array.isArray(counters) ? counters : [];
  const shown = [];
  for (const counter of list) {
    if (!counter || typeof counter !== 'object') continue;
    const label = text(counter.label);
    if (!label) continue;
    const value = number(counter.value) ?? 0;
    const error = text(counter.status) === 'error';
    if (value === 0 && !(error && ended)) continue;
    shown.push({id: text(counter.id), label, value, error, zero: value === 0, zeroText: text(counter.zero)});
  }
  return shown;
}

/** A counter in words: «Добавлено 9 227», «18 ошибок» (the label's {n}), the zero words for a zero error counter. */
export function counterWords(counter, locale, word) {
  if (counter.zero) return counter.zeroText || word('no-errors');
  const label = pluralForm(counter.label, counter.value, locale);
  const figure = formatNumber(counter.value, locale);
  return label.includes('{n}') ? label.replaceAll('{n}', figure) : `${label} ${figure}`;
}

/** The errors made safe, at most `limit` of them. */
export function normalizeErrors(value, limit = ERRORS_SHOWN) {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((one) => one && typeof one === 'object' && text(one.text))
    .slice(0, limit)
    .map((one) => ({where: text(one.where), key: text(one.key), text: text(one.text)}));
}

const ProgressRunElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions: {
    chunk(args = {}) {
      const more = typeof args === 'string' ? args : args?.text;
      if (more === undefined || more === null || String(more) === '') return refused('invalid');
      const step = typeof args === 'string' ? '' : text(args?.step);
      if (step) {
        if (!this.list.some((one) => one.id === step)) return refused('missing');
        this.appendStepText(step, String(more));
        return applied();
      }
      this.appendText(String(more));
      return applied();
    },
    clear() {
      this._output = '';
      this._logs.clear();
      this.requestComponentUpdate('output');
      return applied();
    },
    step(args = {}) {
      const id = text(args?.id);
      if (!this.steps.some((step) => text(step?.id) === id)) return refused('missing');
      // The changes belong to the host's current list: one the run has not
      // read yet starts them afresh now, not at the next read (which dropped a
      // change made before the first render).
      this.syncStepsSource();
      const change = {};
      for (const key of ['state', 'text', 'value', 'total', 'started', 'finished', 'duration']) {
        if (Object.prototype.hasOwnProperty.call(args, key)) change[key] = args[key];
      }
      this._changes.set(id, {...(this._changes.get(id) ?? {}), ...change});
      this.requestComponentUpdate('step');
      return applied();
    },
  },
});

class SfProgressRun extends ProgressRunElement {
  constructor() {
    super();
    const n = ++sequence;
    this._ids = {
      heading: `sf-progress-run-heading-${n}`,
      output: `sf-progress-run-output-${n}`,
      errors: `sf-progress-run-errors-${n}`,
      log: `sf-progress-run-log-${n}`,
    };
    // Changes made with the action step, over the host's list until it sets
    // a new one.
    this._changes = new Map();
    this._stepsSource = undefined;
    this._output = '';
    this._outputSource = undefined;
    this._follow = true;
    this._reading = readingPosition(null);
    this._timer = 0;
    // A log per step (chunk {step}) and which step logs a person opened.
    this._logs = new Map();
    this._logOpen = new Map();
    // The rate of value while it runs, and the moments the run saw.
    this._samples = [];
    this._seenStart = 0;
    this._seenEnd = 0;
    this._lastState = '';
    this._resumed = false;
    // What the polite live region says now, and when that reached the page
    // (stamped after the render that drew it: a render overtaken by the next
    // one never drew its text, and a stamp taken before it let two changes
    // land 9 s apart).
    this._spoken = '';
    this._spokenAt = 0;
    this._spokenDrawn = false;
  }

  onConnected() {
    super.onConnected?.();
    this.syncTimer();
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.stopTimer();
  }

  // A new list from the host clears the changes made over the old one.
  syncStepsSource() {
    if (this.steps === this._stepsSource) return;
    this._stepsSource = this.steps;
    this._changes.clear();
  }

  // The steps the run shows: the host's list with the step changes on it.
  get list() {
    this.syncStepsSource();
    const changed = (Array.isArray(this.steps) ? this.steps : []).map((step) => {
      const change = step && typeof step === 'object' ? this._changes.get(text(step.id)) : null;
      return change ? {...step, ...change} : step;
    });
    return normalizeSteps(changed);
  }

  get locale() {
    return pageLocale(this);
  }

  // The numbers of the run, null when not given.
  get done() {
    return number(this.value);
  }

  get whole() {
    const total = number(this.total);
    return total && total > 0 ? total : null;
  }

  get errorsCount() {
    // A number setting reads 0 when absent, so 0 means «not said»: the error counter speaks.
    const total = number(this.errorsTotal);
    if (total) return total;
    const counter = (Array.isArray(this.counters) ? this.counters : []).find((one) => one && text(one.status) === 'error');
    return counter ? number(counter.value) ?? 0 : 0;
  }

  // The job's state: the host's run-state, else worked out from the steps,
  // or, with no steps, from its numbers: running while value is below total,
  // done once it reached it. Finished with errors (errors-total or an error
  // counter above 0) is partial.
  get drawnState() {
    const given = this.runState;
    if (given && given !== 'auto' && RUN_STATES.includes(given)) return given;
    let worked = runState(this.list);
    if (worked === 'waiting' && !this.list.length && this.whole !== null) {
      worked = (this.done ?? 0) >= this.whole ? 'done' : 'running';
    }
    if (worked === 'done' && this.errorsCount > 0) return 'partial';
    return worked;
  }

  get drawnView() {
    // The shim rewrites look compact to row; a value set as a property after
    // the element drew is read the same (C134).
    if (this.look === 'compact') return 'row';
    return VIEWS.includes(this.look) ? this.look : 'full';
  }

  // The output: the host's setting, then what chunk appended. A new setting
  // starts it afresh.
  get outputText() {
    const source = this.output ?? '';
    if (source !== this._outputSource) {
      this._outputSource = source;
      this._output = String(source);
    }
    return this._output;
  }

  appendText(more) {
    // Follow the newest line only while the reader is at the end.
    this._follow = !this.outputOpen || this._reading.atEnd();
    this._output = appendOutput(this.outputText, more);
    this.requestComponentUpdate('output');
  }

  appendStepText(step, more) {
    this._logs.set(step, appendOutput(this._logs.get(step) ?? '', more));
    this.requestComponentUpdate('output');
  }

  toggleOutput(force) {
    const open = force === undefined ? !this.outputOpen : Boolean(force);
    if (open === Boolean(this.outputOpen)) return;
    this._follow = true;
    this.outputOpen = open;
    this.sfEmit('toggle', {open});
  }

  // A step's log is open when a person opened it, else when the step failed.
  stepLogOpen(step) {
    return this._logOpen.has(step.id) ? this._logOpen.get(step.id) : step.state === 'failed';
  }

  toggleStepLog(id) {
    const step = this.list.find((one) => one.id === id);
    if (!step) return;
    this._logOpen.set(id, !this.stepLogOpen(step));
    this.requestComponentUpdate('log');
  }

  // ---------------------------------------------------------------- presses

  onCancel() {
    this.sfEmit('cancel', {}, {cancelable: true});
  }

  onRetry() {
    const state = this.drawnState;
    if (state === 'partial') {
      this.sfEmit('retry', {scope: 'failed'});
      return;
    }
    const failed = this.list.find((step) => step.state === 'failed');
    this.sfEmit('retry', failed ? {scope: 'all', from: failed.id} : {scope: 'all'});
  }

  onPause() {
    this.sfEmit('pause', {});
  }

  onResume() {
    this.sfEmit('resume', {});
  }

  onMinimize() {
    this.sfEmit('minimize', {});
  }

  onExpand() {
    this.sfEmit('expand', {});
  }

  // The error count link and «Ещё N ошибок»: a request for the report. Not
  // cancelled, the link moves to the error list the summary shows.
  onReport(event) {
    const asked = this.sfEmit('report', {}, {cancelable: true});
    if (!event) return;
    const list = this.querySelector(`#${this._ids.errors}`);
    if (event.currentTarget?.localName === 'a') {
      event.preventDefault();
      if (asked && list) list.focus({preventScroll: false});
    }
  }

  onHide() {
    this.sfEmit('close', {reason: 'close'}, {cancelable: true});
  }

  onDownload() {
    const name = text(this.fileName) || 'output.txt';
    if (!this.sfEmit('download', {'file-name': name}, {cancelable: true})) return;
    const doc = this.ownerDocument;
    const url = URL.createObjectURL(new Blob([this.outputText], {type: 'text/plain;charset=utf-8'}));
    const link = doc.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ---------------------------------------------------------------- time

  // The moments the run saw and the samples of the rate, kept as it draws.
  observe(state, now) {
    const previous = this._lastState;
    if (state !== previous) {
      // Going on after a pause: the rate is measured afresh (the pause is not work).
      this._resumed = previous === 'paused' && state === 'running';
      if (state === 'paused' || previous === 'paused') this._samples = [];
      if (state === 'running' && !this._seenStart) this._seenStart = now;
      if (ENDED.includes(state) && !this._seenEnd) this._seenEnd = now;
      if (!ENDED.includes(state)) this._seenEnd = 0;
      this._lastState = state;
    }
    const value = this.done;
    if (state === 'running' && value !== null) {
      const last = this._samples[this._samples.length - 1];
      if (!last || last.v !== value) this._samples.push({t: now, v: value});
      while (this._samples.length > 2 && now - this._samples[1].t > RATE_WINDOW_MS) this._samples.shift();
    }
  }

  // The job's elapsed time: the host's started, else the moment the run saw
  // it run; to finished, the moment it ended, or now.
  elapsed(state, now) {
    const start = toDate(this.startedAt)?.getTime() ?? (this._seenStart || null);
    if (!start) return null;
    const end = toDate(this.finishedAt)?.getTime() ?? (ENDED.includes(state) ? this._seenEnd || null : null);
    if (ENDED.includes(state) && !end) return null;
    return Math.max(0, (end ?? now) - start);
  }

  // One timer per run, only while a time counts up: a running step with a
  // start, the elapsed time of an unknown size, or the time left.
  syncTimer() {
    const state = this.drawnState;
    const counting = this.isConnected && (
      this.list.some((step) => step.state === 'running' && step.started && step.duration === null && !step.finished)
      || state === 'running'
    );
    if (counting && !this._timer) this._timer = setInterval(() => this.requestComponentUpdate('time'), 1000);
    else if (!counting) this.stopTimer();
  }

  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = 0;
  }

  // ---------------------------------------------------------------- drawing

  // What the polite live region says while the job runs: the count as the
  // figures line says it, in words («4 812 из 12 000 товаров, 40 %»; with no
  // size «1 240 строк»). It changes at most once in ANNOUNCE_MS, never at the
  // first paint and never in a table row (a table of runs would talk over
  // itself); a pause or the end empties it (the status region says those).
  spokenProgress(state, view, value, total, now) {
    if (state !== 'running' || view === 'row') {
      this._spoken = '';
      this._spokenAt = 0;
      this._spokenDrawn = false;
      return '';
    }
    const locale = this.locale;
    const forms = text(this.unit);
    let next = '';
    if (total !== null) {
      next = this.sfWord('announce-progress', {vars: {
        value: formatNumber(value ?? 0, locale),
        total: formatNumber(total, locale),
        unit: forms ? ` ${pluralForm(forms, total, locale)}` : '',
        percent: percentOf(value ?? 0, total),
      }});
    } else if (value) {
      next = this.sfWord('announce-count', {vars: {value: formatNumber(value, locale), unit: forms ? ` ${pluralForm(forms, value, locale)}` : ''}});
    }
    if (!this._spokenAt) this._spokenAt = now;
    else if (!this._spokenDrawn && next !== this._spoken && now - this._spokenAt >= ANNOUNCE_MS) {
      this._spoken = next;
      this._spokenDrawn = true;
    }
    return this._spoken;
  }

  // «4 812 из 12 000 товаров · 40 %», the count so far, or nothing.
  figures(value, total, unit, {short = false} = {}) {
    const locale = this.locale;
    const word = (key, options) => this.sfWord(key, options);
    if (value === null && total === null) return '';
    if (total === null) {
      // An absent number setting reads 0: with no size, a count of 0 says
      // nothing, so the line shows nothing (not a bare «0»).
      if (!value) return '';
      const forms = text(unit);
      return word('figures-count', {vars: {value: formatNumber(value ?? 0, locale), unit: forms ? ` ${pluralForm(forms, value ?? 0, locale)}` : ''}});
    }
    const percent = percentOf(value ?? 0, total);
    if (short === 'plain') return word('figures-plain', {vars: {value: formatNumber(value ?? 0, locale), total: formatNumber(total, locale)}});
    if (short) return word('percent', {vars: {percent}});
    const forms = text(unit);
    return word('figures', {vars: {
      value: formatNumber(value ?? 0, locale),
      total: formatNumber(total, locale),
      unit: forms ? ` ${pluralForm(forms, total, locale)}` : '',
      percent,
    }});
  }

  templateContext() {
    const now = Date.now();
    const list = this.list;
    const state = this.drawnState;
    const view = this.drawnView;
    const ended = ENDED.includes(state);
    const locale = this.locale;
    const word = (key, options) => this.sfWord(key, options);
    this.observe(state, now);
    this.sfHostState('data-state', state);

    const value = this.done;
    const total = this.whole;
    const indeterminate = total === null && (state === 'running' || state === 'paused');
    // The overall bar: whenever the size is known, and while a job of unknown
    // size runs or is paused (indeterminate), with steps or without. A run of
    // steps alone that has not started or has ended has none: its steps say it.
    const showBar = total !== null || !list.length || indeterminate;
    const percent = percentOf(value ?? 0, total);
    const barValue = total !== null ? (state === 'done' ? 100 : percentOf(value ?? 0, total)) : (ended ? 100 : 0);

    // The time on the figures line: the time left while it runs, the time it
    // took once ended, the elapsed time while the size is unknown.
    const elapsed = this.elapsed(state, now);
    // An absent number setting reads 0; no running job has 0 left, so 0 means «not given».
    const given = number(this.remaining);
    const remainingMs = given ? given : estimateRemaining(this._samples, total, now);
    let time = '';
    let timeShort = '';
    if (ended) {
      time = elapsed !== null ? word('took', {vars: {time: formatTime(elapsed)}}) : '';
    } else if (state === 'running' && total !== null) {
      time = remainingMs !== null ? remainingWords(remainingMs, word) : word('estimating');
      timeShort = remainingMs !== null ? remainingWords(remainingMs, word, {short: true}) : '';
    } else if ((state === 'running' || state === 'paused') && elapsed !== null) {
      time = formatTime(elapsed);
      timeShort = time;
    }

    const counters = shownCounters(this.counters, {ended}).map((counter) => ({...counter, words: counterWords(counter, locale, word)}));
    const errors = ended ? normalizeErrors(this.errors) : [];
    const errorsTotal = Math.max(this.errorsCount, errors.length);
    const resultShown = ended ? (this.resultText || word(`result-${state}`)) : '';

    // What a screen reader hears: the result and the state changes only.
    let announcement = '';
    if (ended) announcement = resultShown;
    else if (state === 'paused') announcement = word('announce-paused');
    else if (state === 'running' && this._resumed) announcement = word('announce-resumed');

    // The badge and bar of the state (not the look setting, which is view).
    const stateLook = STATE_LOOK[state] ?? STATE_LOOK.waiting;
    const badgeText = {running: 'state-word-running', paused: 'state-word-paused', partial: 'state-word-partial', cancelled: 'state-word-cancelled', waiting: 'state-word-waiting'}[state];
    const failed = list.find((step) => step.state === 'failed');

    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      ids: this._ids,
      view,
      size: this.size === '1/2' ? '1/2' : '1',
      label: this.label,
      caption: text(this.caption),
      headingLevel: ['1', '2', '3', '4', '5', '6'].includes(String(this.headingLevel)) ? String(this.headingLevel) : '3',
      regionLabel: this.label || word('label'),
      steps: list.map((step) => {
        const log = `${step.log}${this._logs.get(step.id) ?? ''}`;
        return {
          ...step,
          time: formatTime(stepTime(step, now)),
          stateWord: word(`state-${step.state}`),
          figures: step.value !== null || step.total !== null ? this.figures(step.value, step.total && step.total > 0 ? step.total : null, step.unit) : '',
          log,
          logOpen: Boolean(log) && this.stepLogOpen(step),
        };
      }),
      state,
      ended,
      stateLook,
      badgeText: badgeText ? word(badgeText) : '',
      showBar,
      indeterminate,
      barValue,
      barStatus: stateLook.bar,
      percent,
      figures: this.figures(value, total, this.unit),
      figuresShort: total !== null ? this.figures(value, total, this.unit, {short: true}) : '',
      figuresPlain: total !== null ? this.figures(value, total, this.unit, {short: 'plain'}) : '',
      time,
      timeShort,
      counters,
      errors,
      errorsTotal,
      moreErrors: errorsTotal > errors.length && ended ? errorsTotal - errors.length : 0,
      resultShown,
      announcement,
      spoken: this.spokenProgress(state, view, value, total, now),
      outputShown: this.outputText,
      outputOpen: Boolean(this.outputOpen),
      outputLabel: this.outputLabel,
      showCancel: Boolean(this.cancelable) && (state === 'running' || state === 'paused'),
      showPause: Boolean(this.pausable) && state === 'running',
      showResume: Boolean(this.pausable) && state === 'paused',
      showMinimize: Boolean(this.minimizable) && view === 'full',
      showRetry: Boolean(this.retryable) && (state === 'failed' || state === 'cancelled' || state === 'partial'),
      retryWord: state === 'partial' ? word('retry-failed') : word('retry'),
      retryFrom: state === 'failed' && failed ? failed.id : '',
      showHide: Boolean(this.hideable) && ended,
      icons: ICONS,
      words: {
        steps: word('steps'),
        cancel: word('cancel'),
        retry: word('retry'),
        hide: word('hide'),
        copy: word('copy'),
        download: word('download'),
        pause: word('pause'),
        resume: word('resume'),
        minimize: word('minimize'),
        expand: word('expand'),
        stepLog: word('step-log'),
        counts: word('counts'),
        errorsList: errors.length ? word('errors-shown', {count: errors.length, vars: {total: formatNumber(errorsTotal, locale)}}) : '',
        moreErrors: errorsTotal > errors.length ? word('more-errors', {count: errorsTotal - errors.length}) : '',
        errorsCount: word('errors-count', {count: errorsTotal}),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderProgressRunTemplate(this.templateContext());
  }

  // ---------------------------------------------------------------- focus

  // The run's own button that holds focus, by its part name (pause, resume,
  // minimize, expand, cancel, retry, hide...), or ''.
  focusedAction() {
    const active = this.ownerDocument?.activeElement;
    if (!active || !this.contains(active)) return '';
    const host = active.closest(buttonHosts());
    if (!host || !this.contains(host)) return '';
    const part = [...host.classList].map((name) => /^sf-progress-run-([a-z]+)$/u.exec(name)?.[1]).find(Boolean);
    return part || '';
  }

  beforeRender(changedAttributes) {
    super.beforeRender?.(changedAttributes);
    // A render overtaken by the next one never reaches afterRender: the
    // button it removed stays noted until a render that did lands.
    const focused = this.focusedAction();
    if (focused) this._focusAction = focused;
  }

  // A press the host answers swaps the run's own button: Pause becomes
  // Continue, Minimize turns the card into the notice with its Expand. The
  // button that had focus is gone, and focus fell to the page (WCAG 2.4.3):
  // a second Space did nothing. Focus moves to the button that took its
  // place, else to the next one the run still shows. Only a focus the run
  // lost itself is moved; it never takes focus from elsewhere.
  restoreFocus() {
    const lost = this._focusAction;
    this._focusAction = '';
    if (!lost) return;
    const active = this.ownerDocument?.activeElement;
    if (active && active !== this.ownerDocument.body && active.isConnected) return;
    for (const part of [...(FOCUS_NEXT[lost] ?? []), lost, ...FOCUS_FALLBACK]) {
      const target = this.querySelector(`.sf-progress-run-${part}`);
      if (target && typeof target.focus === 'function') {
        target.focus({preventScroll: true});
        return;
      }
    }
  }

  afterRender() {
    super.afterRender?.();
    // The count the live region now holds reached the page: the next one waits
    // ANNOUNCE_MS from here.
    if (this._spokenDrawn) {
      this._spokenDrawn = false;
      this._spokenAt = Date.now();
    }
    this.restoreFocus();
    this.syncTimer();
    const pane = this.querySelector('.sf-progress-run-output');
    this._reading.element = pane;
    // Instant: the page's smooth scrolling would leave a log behind its end
    // while lines arrive faster than the animation.
    if (pane && this._follow) pane.scrollTo({top: pane.scrollHeight, behavior: 'instant'});
    for (const log of this.querySelectorAll('.sf-progress-run-step-log')) log.scrollTo({top: log.scrollHeight, behavior: 'instant'});
  }
}

SfProgressRun.define('sf-progress-run');

export {SfProgressRun};

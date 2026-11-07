// sf-progress-run: a long job as a person sees it -- creating a site, an
// update, a backup or a restore, an import, a package install:
//
//   <sf-progress-run label="Создание сайта demo.test" cancelable retryable hideable>
//     <script type="application/json" data-sf-settings>
//       {"steps": [{"id": "dns", "title": "Адрес", "state": "done", "duration": 1200},
//                  {"id": "files", "title": "Файлы", "state": "running", "started": "…"}]}
//     </script>
//   </sf-progress-run>
//
//   run.step({id: 'files', state: 'done', duration: 5300});
//   run.chunk({text: 'Copying 120 files…\n'});
//
// The steps with their states and times, a collapsible output pane that
// follows the newest line only while the reader is at its end (core's reading
// position), copy and download, the result once the job ended, and Cancel,
// Retry and Hide as requests to the host. The host drives it: it sets the
// steps (or changes one with step) and appends the output (chunk); the
// component polls nothing and does none of the actions itself.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4,
// §8): the settings, values and actions are made by
// core/js/element-manifest.js, the words are the language files'.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {toDate} from '../../core/js/format-intl.js';
import {readingPosition} from '../../core/js/reading-position';
import {renderProgressRunTemplate} from './js/templates/default';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// The ids of a run's parts, one set per run on the page (the same on every
// render, so a first-paint snapshot is stable).
let sequence = 0;

export const STEP_STATES = ['waiting', 'running', 'done', 'failed', 'skipped'];
export const RUN_STATES = ['waiting', 'running', 'done', 'failed', 'cancelled'];
// sf-steps' state glyphs (sf-steps 1.2.0, sf-wizard); waiting is an empty ring.
export const ICONS = {waiting: 'radio_button_unchecked', running: 'progress_activity', done: 'check_circle', failed: 'error', skipped: 'do_not_disturb_on', cancelled: 'cancel'};
// The output a run keeps: the oldest lines leave past this many characters.
export const OUTPUT_LIMIT = 500000;

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

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

const ProgressRunElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    chunk(args = {}) {
      const more = typeof args === 'string' ? args : args?.text;
      if (more === undefined || more === null || String(more) === '') return refused('invalid');
      this.appendText(String(more));
      return applied();
    },
    clear() {
      this._output = '';
      this.requestComponentUpdate('output');
      return applied();
    },
    step(args = {}) {
      const id = text(args?.id);
      if (!this.steps.some((step) => text(step?.id) === id)) return refused('missing');
      const change = {};
      for (const key of ['state', 'text', 'started', 'finished', 'duration']) {
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
    this._ids = {heading: `sf-progress-run-heading-${n}`, output: `sf-progress-run-output-${n}`};
    // Changes made with the action step, over the host's list until it sets
    // a new one.
    this._changes = new Map();
    this._stepsSource = undefined;
    this._output = '';
    this._outputSource = undefined;
    this._follow = true;
    this._reading = readingPosition(null);
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

  // The steps the run shows: the host's list with the step changes on it.
  get list() {
    if (this.steps !== this._stepsSource) {
      this._stepsSource = this.steps;
      this._changes.clear();
    }
    const changed = (Array.isArray(this.steps) ? this.steps : []).map((step) => {
      const change = step && typeof step === 'object' ? this._changes.get(text(step.id)) : null;
      return change ? {...step, ...change} : step;
    });
    return normalizeSteps(changed);
  }

  // The job's state: the host's run-state, else worked out from the steps.
  get drawnState() {
    const given = this.runState;
    if (given && given !== 'auto' && RUN_STATES.includes(given)) return given;
    return runState(this.list);
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

  toggleOutput(force) {
    const open = force === undefined ? !this.outputOpen : Boolean(force);
    if (open === Boolean(this.outputOpen)) return;
    this._follow = true;
    this.outputOpen = open;
    this.sfEmit('toggle', {open});
  }

  // ---------------------------------------------------------------- presses

  onCancel() {
    this.sfEmit('cancel', {}, {cancelable: true});
  }

  onRetry() {
    this.sfEmit('retry', {});
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

  // One timer per run, only while a step runs with a start: its time counts up.
  syncTimer() {
    const counting = this.isConnected && this.list.some((step) => step.state === 'running' && step.started && step.duration === null && !step.finished);
    if (counting && !this._timer) this._timer = setInterval(() => this.requestComponentUpdate('time'), 1000);
    else if (!counting) this.stopTimer();
  }

  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = 0;
  }

  // ---------------------------------------------------------------- drawing

  templateContext() {
    const list = this.list;
    const state = this.drawnState;
    const ended = state === 'done' || state === 'failed' || state === 'cancelled';
    const word = (key) => this.sfWord(key);
    this.sfHostState('data-state', state);
    const now = Date.now();
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      ids: this._ids,
      size: this.size === '1/2' ? '1/2' : '1',
      label: this.label,
      regionLabel: this.label || word('label'),
      steps: list.map((step) => ({...step, time: formatTime(stepTime(step, now)), stateWord: word(`state-${step.state}`)})),
      state,
      ended,
      resultText: ended ? (this.resultText || word(`result-${state}`)) : '',
      output: this.outputText,
      outputOpen: Boolean(this.outputOpen),
      outputLabel: this.outputLabel,
      showCancel: Boolean(this.cancelable) && state === 'running',
      showRetry: Boolean(this.retryable) && (state === 'failed' || state === 'cancelled'),
      showHide: Boolean(this.hideable) && ended,
      icons: ICONS,
      words: {
        steps: word('steps'),
        cancel: word('cancel'),
        retry: word('retry'),
        hide: word('hide'),
        copy: word('copy'),
        download: word('download'),
        emptyOutput: word('empty-output'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderProgressRunTemplate(this.templateContext());
  }

  afterRender() {
    super.afterRender?.();
    this.syncTimer();
    const pane = this.querySelector('.sf-progress-run-output');
    this._reading.element = pane;
    // Instant: the page's smooth scrolling would leave a log behind its end
    // while lines arrive faster than the animation.
    if (pane && this._follow) pane.scrollTo({top: pane.scrollHeight, behavior: 'instant'});
  }
}

SfProgressRun.define('sf-progress-run');

export {SfProgressRun};

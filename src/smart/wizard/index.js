// sf-wizard: the universal step-by-step wizard (owner decision 2026-11-06,
// ui-control control/decisions/2026-11-06-sf-wizard.md). The frame holds the
// progress, the step's title and «why», the step's body and one footer; each
// step is a child sf-wizard-step whose children are its body:
//
//   <sf-wizard heading="Настройка сервера">
//     <sf-wizard-step name="address" label="Адрес панели" type="form" …>
//       <form>…Framework fields…</form>
//     </sf-wizard-step>
//     …
//   </sf-wizard>
//
// The steps are live nodes placed in the frame (data-sf-live) and never
// copied: a server's form, its errors and its listeners stay what they are.
// The wizard keeps nothing the host must know: the states are the steps'
// attributes, the answers its value, and every move and press an event.
//
// Places: inline, modal (an sf-modal the wizard composes) and pages (the
// server's page per step: the footer's submit buttons post the step's form
// with their word, sf-button 1.5.0 form/name/value).
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {renderWizardTemplate} from './js/templates/default';
import BundledPreferences from '../../core/js/preferences.js';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

export const TYPES = ['info', 'form', 'action', 'review', 'result'];
export const STATES = ['done', 'skipped', 'running', 'error'];
// The progress draws a row up to this many steps, the count above (owner).
export const ROW_LIMIT = 7;
// sf-steps' word for each state of a step.
export const STAGES = {done: 'completed', skipped: 'skipped', running: 'running', error: 'error', '': 'default'};
// The place kept for remember: SF.Preferences under sf-wizard/<key> (the
// browser's copy is localStorage sf-pref:sf-wizard/<key>; a host that keeps
// preferences for its user gets it too).
const STORE = 'sf-wizard/';
const preferences = () => globalThis.SF?.Preferences || BundledPreferences;

// One wizard id per instance, the same on every render (a first-paint
// snapshot stays stable).
let sequence = 0;

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** A step element read as data. */
export function readStep(element, index) {
  const attr = (name) => text(element.getAttribute(name));
  const type = attr('type');
  const state = attr('state');
  return {
    element,
    index,
    name: attr('name') || `step-${index + 1}`,
    label: attr('label') || attr('heading') || `${index + 1}`,
    heading: attr('heading') || attr('label'),
    // The step's «why»: its description attribute.
    why: attr('description'),
    type: TYPES.includes(type) ? type : 'info',
    state: STATES.includes(state) ? state : '',
    optional: element.hasAttribute('optional') && element.getAttribute('optional') !== 'false',
    href: attr('href'),
    actionText: attr('action-text'),
    message: attr('message'),
  };
}

/** The step shown: the one current names, else the first not done or skipped, else the first. */
export function currentIndex(steps, current) {
  if (!steps.length) return -1;
  const named = steps.findIndex((step) => step.name === current);
  if (named >= 0) return named;
  const open = steps.findIndex((step) => step.state !== 'done' && step.state !== 'skipped');
  return open >= 0 ? open : 0;
}

/** Whether a press in the progress may open step `index` under the rule. */
export function reachable(steps, index, at, rule = 'linear') {
  if (index === at || index < 0 || index >= steps.length) return index === at;
  if (rule === 'free') return true;
  const passed = (step) => step.state === 'done' || step.state === 'skipped' || step.state === 'error';
  if (rule === 'visited') return passed(steps[index]) || index < at;
  // linear: any step up to the first one not done or skipped.
  const first = steps.findIndex((step) => step.state !== 'done' && step.state !== 'skipped');
  return index <= Math.max(first < 0 ? steps.length - 1 : first, at);
}

/** What the primary button does on a step, and its word. */
export function primaryOf(step, last) {
  if (!step) return {action: 'next', word: 'next'};
  if (step.type === 'action') {
    if (step.state === 'error') return {action: 'retry', word: 'retry'};
    if (step.state !== 'done') return {action: 'run', word: 'run', text: step.actionText};
  }
  if (step.type === 'review' && step.state !== 'done') return {action: 'apply', word: 'apply', text: step.actionText};
  if (step.type === 'result' || last) return {action: 'done', word: 'done', text: step.type === 'action' ? '' : step.actionText};
  return {action: 'next', word: 'next', text: step.type === 'action' ? '' : step.actionText};
}

// A node inside a [hidden] element that stands within root (root's own
// hidden, a closed step, does not count).
function hiddenWithin(node, root) {
  const hidden = node.parentElement?.closest('[hidden]');
  return Boolean(hidden && hidden !== root && root.contains(hidden));
}

/** The named answers of a step, as its forms would post them: FormData of
 * each form (Framework fields are form-associated, a native control is
 * itself), then the named controls outside a form. A name given twice is a
 * list; a file is its name. */
export function answersOf(root) {
  if (!root) return {};
  const values = {};
  const add = (name, value) => {
    if (!name) return;
    const answer = typeof File !== 'undefined' && value instanceof File ? value.name : value;
    if (Object.hasOwn(values, name)) values[name] = [].concat(values[name], answer);
    else values[name] = answer;
  };
  const forms = root.localName === 'form' ? [root] : [...root.querySelectorAll('form')];
  for (const form of forms) {
    for (const [name, value] of new FormData(form)) add(name, value);
  }
  // Named controls outside any form of the step.
  for (const control of root.querySelectorAll('[name]')) {
    if (control.closest('form') || control.disabled || hiddenWithin(control, root)) continue;
    const native = ['input', 'select', 'textarea'].includes(control.localName);
    if (!native && !control.constructor?.formAssociated) continue;
    // A native control drawn inside a Framework field is the field's, not an answer.
    if (native && control.parentElement?.closest('[name]')?.constructor?.formAssociated) continue;
    const type = (control.type || '').toLowerCase();
    if (['submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (type === 'file') { for (const file of control.files ?? []) add(control.getAttribute('name'), file); continue; }
    if ((type === 'checkbox' || type === 'radio') && !control.checked) continue;
    if (control.localName === 'select' && control.multiple) {
      for (const option of control.selectedOptions) add(control.getAttribute('name'), option.value);
      continue;
    }
    if (!native && (control.checked === false)) continue;
    add(control.getAttribute('name'), control.value ?? '');
  }
  return values;
}

const WizardElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  actions: {
    open() { return this.openWindow(); },
    close() { return this.closeWindow('api'); },
    'go-to-step'(args = {}) {
      const name = typeof args === 'string' ? args : args?.name;
      const steps = this.steps;
      const index = steps.findIndex((step) => step.name === text(name));
      if (index < 0) return refused('missing');
      if (index === this.index) return refused('current');
      this.show(index, {person: false});
      return applied();
    },
    next() { return this.primary(); },
  },
});

class SfWizard extends WizardElement {
  constructor() {
    super();
    this._steps = [];
    this._id = `sf-wizard-${++sequence}`;
    this._listOpen = false;
    this._asking = null;
    this._dirty = false;
    this._announce = '';
    this._marked = new Set();
    this._restored = false;
    this._onSubmit = (event) => this.onNativeSubmit(event);
    this._onInvalid = (event) => this.onNativeInvalid(event);
    this._onInput = (event) => this.onInput(event);
    this._onClick = (event) => this.onBodyClick(event);
    this._onTrigger = (event) => this.onTrigger(event);
    this._onModal = (event) => this.onModalClose(event);
  }

  // ------------------------------------------------------------ the steps

  // The steps: the sf-wizard-step elements of this wizard, wherever they
  // stand -- direct children, inside the printed picture (first paint), or in
  // the frame's body once placed (also when a window carried the frame into
  // its portal).
  captureSlotTemplates() {
    const first = !this._slotTemplatesCaptured;
    super.captureSlotTemplates();
    if (first) this.collectSteps();
    if (first && typeof MutationObserver === 'function') {
      this._stepObserver = new MutationObserver(() => {
        if (this.collectSteps()) this.requestComponentUpdate('steps');
      });
    }
    this._stepObserver?.observe(this, {childList: true});
  }

  collectSteps() {
    const own = (element) => element.closest('sf-wizard') === this || element.sfWizard === this;
    const found = Array.from(this.querySelectorAll('sf-wizard-step')).filter(own);
    const fresh = found.filter((step) => !this._steps.includes(step));
    if (!fresh.length) return false;
    // Page order: the printed or written order of the host's own steps.
    this._steps = [...this._steps, ...fresh];
    for (const step of fresh) step.sfWizard = this;
    return true;
  }

  get stepElements() {
    return this._steps;
  }

  get steps() {
    return this._steps.map((element, index) => readStep(element, index));
  }

  get index() {
    return currentIndex(this.steps, this.current);
  }

  get place() {
    const value = this.getAttribute('place');
    return ['inline', 'modal', 'pages'].includes(value) ? value : 'inline';
  }

  // The value open (place modal); the action open() is the method of that name.
  get isOpen() {
    return this.hasAttribute('open') && this.getAttribute('open') !== 'false';
  }

  get isPages() {
    return this.place === 'pages';
  }

  // A step told its wizard it changed (sf-wizard-step).
  stepChanged() {
    this.requestComponentUpdate('step');
  }

  // The one value of every answer, by step and field (owner).
  get value() {
    const value = {};
    for (const step of this.steps) {
      const answers = answersOf(step.element);
      if (Object.keys(answers).length) value[step.name] = answers;
    }
    return value;
  }

  set value(_value) {
    // Read-only: the wizard collects it from the steps' fields.
  }

  get stepStates() {
    return this.steps.map((step) => ({name: step.name, state: step.state}));
  }

  get currentStep() {
    return this.steps[this.index] ?? null;
  }

  get busy() {
    return this.currentStep?.state === 'running';
  }

  // The form of a step: its first form, or the form its controls belong to.
  formOf(step) {
    const element = step?.element;
    if (!element) return null;
    const form = element.querySelector('form') ?? element.closest('form');
    if (form && !form.id) form.id = `${this._id}-form-${step.index + 1}`;
    return form;
  }

  // ------------------------------------------------------------ lifecycle

  onConnected() {
    super.onConnected?.();
    this.listen(this);
    this.bindTriggers();
    this.restore();
    if (this.isPages && this.focusTitle) this.whenDrawn(() => this.focusStepTitle(), {first: true});
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.listen(null);
    this._stepObserver?.disconnect();
    this.unbindTriggers();
  }

  // The steps' events reach the wizard where the frame stands: in the host,
  // or in a window's portal at the end of the body (place modal).
  listen(target) {
    const pairs = [['submit', this._onSubmit, true], ['invalid', this._onInvalid, true], ['input', this._onInput, false], ['change', this._onInput, false], ['click', this._onClick, false]];
    if (this._listening) for (const [type, handler, capture] of pairs) this._listening.removeEventListener(type, handler, capture);
    this._listening = target;
    if (target) for (const [type, handler, capture] of pairs) target.addEventListener(type, handler, capture);
  }

  // The frame: in the host, or in the window's portal.
  get frameRoot() {
    return this.querySelector(`.sf-wizard[data-sf-wizard="${this._id}"]`)
      ?? this.ownerDocument.querySelector(`.sf-wizard[data-sf-wizard="${this._id}"]`);
  }

  find(selector) {
    return this.frameRoot?.querySelector(selector) ?? null;
  }

  // The steps stand in the frame's body; while the first paint's picture is
  // replaced, they must not take a printed picture meant for the frame's own
  // controls (smart-base handOverStaticMarkup): they keep their own.
  handOverStaticMarkup(printed) {
    const marked = this._steps.filter((step) => !step.hasAttribute('data-sf-static'));
    marked.forEach((step) => step.setAttribute('data-sf-static', ''));
    try {
      super.handOverStaticMarkup(printed);
    } finally {
      marked.forEach((step) => step.removeAttribute('data-sf-static'));
    }
  }

  // Runs after the element's next drawing (and its controls' own).
  whenDrawn(callback, {first = false} = {}) {
    const run = () => {
      const settle = () => callback();
      if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(settle);
      else Promise.resolve().then(settle);
    };
    if (first && this._hasRendered) { run(); return; }
    const done = (event) => {
      if (event.target !== this) return;
      this.removeEventListener('sf-after-render', done);
      run();
    };
    this.addEventListener('sf-after-render', done);
  }

  // ------------------------------------------------------------ remember

  get storeKey() {
    const key = text(this.remember);
    return key && !this.isPages ? `${STORE}${key}` : '';
  }

  keep() {
    const key = this.storeKey;
    if (!key) return;
    preferences()?.write(key, {v: 1, current: this.currentStep?.name ?? '', steps: this.stepStates, value: this.value});
  }

  forget() {
    const key = this.storeKey;
    if (!key) return;
    preferences()?.remove(key);
  }

  // The place, the states and the answers kept last time (remember).
  restore() {
    if (this._restored) return;
    this._restored = true;
    const key = this.storeKey;
    if (!key) return;
    const kept = preferences()?.read(key);
    if (!kept || typeof kept !== 'object') return;
    const steps = this.steps;
    for (const {name, state} of Array.isArray(kept.steps) ? kept.steps : []) {
      const step = steps.find((one) => one.name === name);
      if (step && STATES.includes(state) && state !== 'running' && !step.state) step.element.setAttribute('state', state);
    }
    for (const [name, answers] of Object.entries(kept.value && typeof kept.value === 'object' ? kept.value : {})) {
      const step = steps.find((one) => one.name === name);
      if (step) this.fill(step.element, answers);
    }
    if (kept.current && steps.some((step) => step.name === kept.current)) this.current = kept.current;
  }

  // Answers written back into a step's named controls (a Framework field
  // through its own value, so it draws it).
  fill(root, answers) {
    for (const [name, value] of Object.entries(answers || {})) {
      const controls = Array.from(root.querySelectorAll('[name]')).filter((control) => control.getAttribute('name') === name);
      for (const control of controls) {
        const field = control.localName.includes('-') ? control : control.closest('[name]');
        const target = field ?? control;
        if (target.type === 'checkbox' || target.type === 'radio') {
          target.checked = [].concat(value).map(String).includes(String(target.value));
        } else if (!Array.isArray(value)) {
          if ('value' in target) target.value = value;
          else target.setAttribute('value', value);
        }
      }
    }
  }

  // ------------------------------------------------------------ moves

  show(index, {person = true, mark = null} = {}) {
    const steps = this.steps;
    const from = this.index;
    if (index < 0 || index >= steps.length) return;
    if (mark && steps[from] && steps[from].state !== mark) steps[from].element.setAttribute('state', mark);
    const previous = steps[from]?.name ?? '';
    this.current = steps[index].name;
    this._dirty = false;
    this.sfHostState('data-dirty', false);
    this._listOpen = false;
    this._asking = null;
    this._announce = this.sfWord('moved', {vars: {n: index + 1, count: steps.length, step: steps[index].label}});
    this.requestComponentUpdate('move');
    if (person) this.sfEmit('change', {previous, current: steps[index].name, value: this.value});
    this.keep();
    this.whenDrawn(() => this.focusStepTitle());
  }

  focusStepTitle() {
    this.find(`#${this._id}-title`)?.focus({preventScroll: false});
  }

  // A press in the progress (sf-steps or the list) or on data-wizard-step.
  goTo(index) {
    const steps = this.steps;
    const at = this.index;
    if (index === at || this.busy) return false;
    if (!reachable(steps, index, at, this.navigation)) return false;
    if (this.isPages) {
      const step = steps[index];
      if (step.href) this.follow(step.name, step.href);
      return Boolean(step.href);
    }
    this.show(index);
    return true;
  }

  back() {
    if (this.busy) return refused('busy');
    const at = this.index;
    if (at <= 0) return refused('first');
    if (this.isPages) {
      const step = this.steps[at - 1];
      if (step.href) this.follow(step.name, step.href);
      return applied();
    }
    this.show(at - 1);
    return applied();
  }

  // place pages: a link, as a request first.
  follow(name, href, event = null) {
    const allowed = this.sfEmit('navigate', {id: name, href}, {cancelable: true});
    if (!allowed) { event?.preventDefault(); return; }
    if (!event) globalThis.location?.assign(href);
  }

  // ------------------------------------------------------------ validation

  // The browser's own validation over the step's controls (required, type,
  // pattern, a form-associated element's validity). Each invalid Framework
  // field gets invalid and the message; the first takes focus.
  validate(step) {
    const root = step?.element;
    if (!root) return true;
    const controls = Array.from(root.querySelectorAll('input, select, textarea, *')).filter((node) => {
      if (typeof node.checkValidity !== 'function' || node.disabled) return false;
      if (hiddenWithin(node, root)) return false;
      if (['input', 'select', 'textarea'].includes(node.localName)) return node.willValidate !== false;
      return node.constructor?.formAssociated === true && node.willValidate;
    });
    const invalid = controls.filter((control) => !control.checkValidity());
    if (!invalid.length) return true;
    invalid.forEach((control) => this.markInvalid(control));
    const first = invalid[0];
    first.focus?.({preventScroll: false});
    if (!this.fieldOf(first)) first.reportValidity?.();
    this.sfEmit('invalid', {step: step.name, fields: invalid.map((control) => control.name || control.getAttribute?.('name') || '').filter(Boolean)});
    return false;
  }

  // The Framework field around a control: an element whose manifest has the
  // setting invalid (sf-input, sf-input-textarea, sf-dropdown …).
  fieldOf(control) {
    for (let node = control; node && node !== this; node = node.parentElement) {
      if (node.localName?.includes('-') && node.constructor?.manifest?.settings?.invalid) return node;
    }
    return null;
  }

  markInvalid(control) {
    const field = this.fieldOf(control);
    if (field) {
      if (!field.hasAttribute('invalid')) {
        field.setAttribute('invalid', '');
        field.setAttribute('data-sf-wizard-invalid', '');
        // An empty required field says it in the page's language; any other
        // failure keeps the browser's own words (they name the rule).
        const message = control.validity?.valueMissing ? this.sfWord('required') : control.validationMessage;
        if (!field.getAttribute('error-message') && message) {
          field.setAttribute('error-message', message);
          field.setAttribute('data-sf-wizard-message', '');
        }
      }
      this._marked.add(field);
    } else {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('data-sf-wizard-invalid', '');
      this._marked.add(control);
    }
  }

  // What the wizard set goes when the person edits the field.
  unmark(target) {
    for (const node of Array.from(this._marked)) {
      if (!(node === target || node.contains?.(target))) continue;
      this._marked.delete(node);
      if (!node.hasAttribute('data-sf-wizard-invalid')) continue;
      node.removeAttribute('data-sf-wizard-invalid');
      if (node.localName.includes('-')) {
        node.removeAttribute('invalid');
        if (node.hasAttribute('data-sf-wizard-message')) {
          node.removeAttribute('error-message');
          node.removeAttribute('data-sf-wizard-message');
        }
      } else {
        node.removeAttribute('aria-invalid');
      }
    }
  }

  onNativeInvalid(event) {
    // place pages: the browser validates the post; the Framework field shows
    // the message instead of the browser's bubble, and the first takes focus.
    const control = event.target;
    if (!this.currentStep?.element?.contains(control)) return;
    if (this.fieldOf(control)) event.preventDefault();
    this.markInvalid(control);
    if (!this._invalidSent) {
      this._invalidSent = true;
      queueMicrotask(() => {
        this._invalidSent = false;
        const first = Array.from(this._marked)[0];
        (first?.localName?.includes('-') ? first.querySelector('input, select, textarea, button') : first)?.focus?.();
        this.sfEmit('invalid', {step: this.currentStep?.name ?? '', fields: Array.from(this._marked).map((node) => node.getAttribute('name') || '').filter(Boolean)});
      });
    }
  }

  onInput(event) {
    const step = this.currentStep;
    if (!step?.element?.contains(event.target)) return;
    this.unmark(event.target);
    if (!this._dirty) {
      this._dirty = true;
      this.sfHostState('data-dirty', true);
    }
  }

  // ------------------------------------------------------------ presses

  // The primary button: validation, the request, then the move (inline,
  // modal) or the post (pages, the browser's own submit of the button).
  primary(skip = false) {
    const steps = this.steps;
    const at = this.index;
    const step = steps[at];
    if (!step) return refused('missing');
    if (this.busy) return refused('busy');
    const last = at === steps.length - 1;
    const {action} = skip ? {action: 'skip'} : primaryOf(step, last);
    if (!skip && !this.validate(step)) return refused('invalid');
    const values = answersOf(step.element);
    if (!this.sfEmit('submit', {step: step.name, action, values, value: this.value}, {cancelable: true})) return refused('prevented');
    this._dirty = false;
    this.sfHostState('data-dirty', false);
    if (this.isPages) return this.post(step, action, last);
    // Inline and modal: an action step without a host that runs it is done.
    if (action === 'run' || action === 'retry' || action === 'apply') {
      step.element.setAttribute('state', 'done');
      if (step.type === 'action') { this.keep(); return applied(); }
    }
    if (action === 'done' || last) {
      if (step.state !== 'done') step.element.setAttribute('state', 'done');
      const value = this.value;
      this.forget();
      this.sfEmit('completed', {steps: this.stepStates, value});
      if (this.place === 'modal') this.finishWindow('close');
      return applied();
    }
    this.show(at + 1, {mark: skip ? 'skipped' : 'done'});
    return applied();
  }

  // place pages: the step's form posts with the button's word; a step
  // without a form moves by the next step's address.
  post(step, action, last) {
    const form = this.formOf(step);
    if (form) {
      const button = this.find(action === 'skip' ? '.sf-wizard-skip button' : '.sf-wizard-primary button');
      const keep = form.noValidate;
      if (action === 'skip') form.noValidate = true;
      if (step.type === 'action' && action !== 'skip') this.markRunning(step);
      this._posting = true;
      try {
        if (button && typeof form.requestSubmit === 'function') form.requestSubmit(button.form === form ? button : undefined);
        else form.submit();
      } finally {
        this._posting = false;
        form.noValidate = keep;
      }
      return applied();
    }
    const next = this.steps[step.index + 1];
    const href = action === 'done' || last ? this.doneHref : next?.href;
    if (href) this.follow(next && !last ? next.name : step.name, href);
    return applied();
  }

  // The step shows running once the browser has read the form: the entry
  // list is built after the submit event, and a redraw in between (the
  // microtasks of a person's press run before it) would disable the
  // submitter and drop its word from the post.
  markRunning(step) {
    setTimeout(() => step.element.setAttribute('state', 'running'));
  }

  // A native submit inside the steps: in place pages the footer's own button
  // (or Enter in a field) posts it, so the request goes first and the step
  // shows running; elsewhere it is the primary press.
  onNativeSubmit(event) {
    if (this._posting) return;
    const step = this.currentStep;
    if (!step?.element?.contains(event.target) && this.formOf(step) !== event.target) return;
    if (this.isPages) {
      const word = event.submitter?.value || primaryOf(step, this.index === this.steps.length - 1).action;
      const values = answersOf(step.element);
      if (!this.sfEmit('submit', {step: step.name, action: word, values, value: this.value}, {cancelable: true})) {
        event.preventDefault();
        return;
      }
      this._dirty = false;
      if (step.type === 'action' && word !== 'skip') this.markRunning(step);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.primary();
  }

  // Footer presses in place pages are native (submit buttons and links);
  // their request is sent by onNativeSubmit or here.
  onFooter(event, which) {
    if (this.isPages) {
      const steps = this.steps;
      const step = this.currentStep;
      if (which === 'back') {
        const previous = steps[this.index - 1];
        if (previous?.href) this.follow(previous.name, previous.href, event);
        return;
      }
      if (which === 'skip' || which === 'primary') {
        if (this.busy) { event.preventDefault(); return; }
        const form = this.formOf(step);
        if (!form) {
          const last = this.index === steps.length - 1;
          const next = steps[this.index + 1];
          const href = which === 'primary' && (last || primaryOf(step, last).action === 'done') ? this.doneHref : next?.href;
          if (!this.sfEmit('submit', {step: step.name, action: which === 'skip' ? 'skip' : primaryOf(step, last).action, values: {}, value: this.value}, {cancelable: true})) { event.preventDefault(); return; }
          if (href) this.follow(next && !last ? next.name : step.name, href, event);
          return;
        }
        if (which === 'skip') {
          // Skip posts without validation: the browser reads novalidate on
          // the form when the press's default action runs, after this.
          form.noValidate = true;
          setTimeout(() => { form.noValidate = false; });
        }
      }
      return;
    }
    if (which === 'back') this.back();
    else if (which === 'skip') this.primary(true);
    else this.primary();
  }

  // «Изменить» in a review: any element with data-wizard-step="<name>".
  onBodyClick(event) {
    const link = event.target?.closest?.('[data-wizard-step]');
    if (!link || !this.frameRoot?.contains(link)) return;
    const index = this.steps.findIndex((step) => step.name === link.getAttribute('data-wizard-step'));
    if (index < 0) return;
    if (this.isPages && link.getAttribute('href')) return;
    event.preventDefault();
    this.goTo(index);
  }

  onProgress(event) {
    const index = Number(event.detail?.current);
    if (!Number.isInteger(index)) return;
    if (!this.goTo(index)) {
      // sf-steps moved its own mark: put it back on the step shown.
      event.target?.setAttribute?.('current', String(this.index));
    }
  }

  toggleList(force) {
    this._listOpen = force === undefined ? !this._listOpen : Boolean(force);
    this.requestComponentUpdate('list');
  }

  // ------------------------------------------------------------ leaving

  continueLater(event) {
    if (this._dirty && !this._asking) {
      event?.preventDefault();
      this.ask('later');
      return;
    }
    this.leave('later', event);
  }

  leave(reason, event = null) {
    const detail = {reason, current: this.currentStep?.name ?? '', steps: this.stepStates, value: this.value};
    if (!this.sfEmit('close', detail, {cancelable: true})) {
      event?.preventDefault();
      return refused('prevented');
    }
    this.keep();
    this._asking = null;
    if (this.place === 'modal') this.finishWindow(reason);
    else if (!event && this.laterHref && reason === 'later') globalThis.location?.assign(this.laterHref);
    this.requestComponentUpdate('leave');
    return applied();
  }

  ask(reason) {
    this._asking = reason;
    this.requestComponentUpdate('ask');
    this.whenDrawn(() => this.find('.sf-wizard-confirm button')?.focus());
  }

  answer(event) {
    const reason = this._asking;
    if (!reason) return;
    const accepted = Boolean(event?.detail?.accepted);
    this._asking = null;
    this.requestComponentUpdate('answer');
    if (!accepted) { this.whenDrawn(() => this.focusStepTitle()); return; }
    this._dirty = false;
    this.sfHostState('data-dirty', false);
    this.leave(reason);
  }

  // ------------------------------------------------------------ the window

  get modal() {
    return this.querySelector(':scope > sf-modal.sf-wizard-modal') ?? this._modal ?? null;
  }

  triggers() {
    const ids = text(this.for).split(/\s+/u).filter(Boolean);
    return ids.map((id) => this.ownerDocument.getElementById(id)).filter(Boolean);
  }

  bindTriggers() {
    if (this.place !== 'modal') return;
    for (const trigger of this.triggers()) {
      trigger.addEventListener('click', this._onTrigger);
      trigger.setAttribute('aria-haspopup', 'dialog');
    }
  }

  unbindTriggers() {
    for (const trigger of this.triggers()) trigger.removeEventListener('click', this._onTrigger);
  }

  onTrigger(event) {
    event.preventDefault();
    this.openWindow();
  }

  openWindow() {
    if (this.place !== 'modal') return refused('place');
    if (this.isOpen) return refused('open');
    if (!this.sfEmit('open', {}, {cancelable: true})) return refused('prevented');
    this.toggleAttribute('open', true);
    this.requestComponentUpdate('open');
    this.whenDrawn(() => this.whenDrawn(() => this.focusStepTitle()));
    return applied();
  }

  closeWindow(reason = 'api') {
    if (this.place !== 'modal' || !this.isOpen) return refused('closed');
    if (this._dirty) { this.ask(reason); return refused('asking'); }
    return this.leave(reason);
  }

  finishWindow() {
    this._closing = true;
    this.toggleAttribute('open', false);
    this.modal?.close?.({reason: 'api'});
    this._closing = false;
    this.requestComponentUpdate('close');
  }

  // sf-modal asks before it closes (its close, Escape, the scrim): with
  // input on the step the wizard asks first; else it is the wizard's close.
  onModalClose(event) {
    if (event.target !== this.modal || this._closing) return;
    const reason = event.detail?.reason === 'escape' || event.detail?.reason === 'outside' ? event.detail.reason : 'close';
    event.preventDefault();
    if (this._dirty) { this.ask(reason); return; }
    this.leave(reason);
  }

  // ------------------------------------------------------------ drawing

  templateContext() {
    const steps = this.steps;
    const count = steps.length;
    const index = this.index;
    const step = steps[index] ?? null;
    const last = index === count - 1;
    const rule = this.navigation;
    const word = (key, vars) => this.sfWord(key, vars ? {vars} : {});
    // The steps' bodies: the current one shown, the others hidden.
    steps.forEach((one) => {
      one.element.hidden = one.index !== index;
      one.element.sfWizard = this;
    });
    const progress = this.progress === 'auto' || !this.progress ? (count > ROW_LIMIT ? 'count' : 'row') : this.progress;
    const primary = primaryOf(step, last);
    this.sfHostState('data-place', this.place);
    this.sfHostState('data-busy', this.busy);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id: this._id,
      place: this.place,
      size: this.size === '1/2' ? '1/2' : '1',
      heading: this.heading,
      label: this.heading || this.label,
      level: Math.min(Math.max(Number(this.level) || 2, 1), 6),
      progress,
      steps: steps.map((one) => ({
        ...one,
        current: one.index === index,
        reachable: reachable(steps, one.index, index, rule),
        stateWord: one.state ? word(`state-${one.state}`) : '',
      })),
      count,
      index,
      step,
      first: index <= 0,
      last,
      busy: this.busy,
      listOpen: this._listOpen,
      asking: this._asking,
      announce: this._announce,
      form: this.isPages ? this.formOf(step) : null,
      stepNodes: this._steps,
      backHref: steps[index - 1]?.href ?? '',
      nextHref: steps[index + 1]?.href ?? '',
      doneHref: this.doneHref,
      primary: {...primary, text: primary.text || word(primary.word)},
      later: this.hasAttribute('later') || Boolean(this.laterHref),
      laterHref: this.laterHref,
      actionName: this.actionName || 'wizard-action',
      open: this.isOpen,
      words: {
        position: word('position', {n: index + 1, count}),
        back: word('back'),
        skip: word('skip'),
        later: word('later'),
        steps: word('steps'),
        allSteps: word('all-steps'),
        hideSteps: word('hide-steps'),
        progress: word('progress'),
        running: step?.message || this.runningText || word('running-text'),
        question: word('close-question'),
        accept: word('close-accept'),
        decline: word('close-decline'),
      },
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderWizardTemplate(this.templateContext());
  }

  afterRender(changedAttributes) {
    super.afterRender?.(changedAttributes);
    const modal = this.querySelector('sf-modal.sf-wizard-modal');
    if (modal && modal !== this._modal) {
      this._modal?.removeEventListener('sf-modal-close', this._onModal);
      this._modal = modal;
      modal.addEventListener('sf-modal-close', this._onModal);
    }
    if (modal) {
      // The window follows the value open.
      const shown = Boolean(modal.openState);
      if (this.isOpen && !shown) modal.open?.();
      const frame = this.frameRoot;
      if (frame && frame !== this._listening) this.listen(frame);
    }
  }
}

SfWizard.define('sf-wizard');

export {SfWizard};

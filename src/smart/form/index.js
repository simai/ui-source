// sf-form: a form drawn from field descriptions (owner decision C182,
// 2026-11-14; study control/research/2026-11-14-form.md, prototype
// prototypes/form-study.html).
//
//   <sf-form label="Кнопка"><script type="application/json" data-sf-settings>
//     {"fields": [{"key": "text", "label": "Текст", "propertyType": "string", "required": true}],
//      "value": {"text": "Подробнее"}}
//   </script></sf-form>
//
// The descriptor is the Framework field descriptor sf-view-properties sends:
// the property registry's type and parameters plus key, label, hint, help,
// width and group (C182 (3)). Every control is the field renderers' own
// (src/smart/field-renderers, renderEditField and renderViewField); the form
// draws only the frame around them: the label row, the hint, the error, the
// groups, the layout, the errors summary and the buttons. The bundle carries
// the renderers, which also publish themselves as SF.fieldRenderers.
//
// From its component.json (standard simai.smart-component 1.3.15 §3, §4, §8,
// §17.4): the settings and values are made by core/js/element-manifest.js;
// value, valid, check-validity and reset are the aggregating form's contract.
import SfBaseElement from '../../core/js/smart-base';
import {applied, refused, elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
import {OWN_ERROR_CONTROLS, fieldTemplate, propertyModes, renderEditField, renderViewField} from '../field-renderers/index.js';
import {validityWords} from '../helpers/form-field.js';
import {CONFIRM_ICON, CONFIRM_STATES} from '../helpers/confirm-surface.js';
import {renderFormTemplate} from './js/templates/default';
import {isListChoice, renderChoiceList} from './js/choice-list.js';
import manifest from './component.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

export const WIDTHS = ['s', 'm', 'full'];

// apply answer (owner decision C291 (3), FO-8): the states of the confirm
// surface, of which open and pending draw the fields to answer.
const ANSWERING = new Set(['open', 'pending']);

// The property types already reported as unknown, once per page for each.
const UNKNOWN_TYPES_TOLD = new Set();

function warnUnknownType(field) {
  const type = String(field?.propertyType ?? '');
  if (UNKNOWN_TYPES_TOLD.has(type)) return;
  const modes = propertyModes(type);
  if (modes.view || modes.edit) return;
  UNKNOWN_TYPES_TOLD.add(type);
  console.warn(`sf-form: the field «${field?.key ?? ''}» is left out: the Framework's field renderers draw no property type «${type}»`);
}

// The controls of the field family that say an error in their own message
// line, linked to their native control (C153 (3)): the form gives them
// invalid and error-message. Every other control gets its error line from the
// form. Read by tag, so it is known before the control's bundle arrives.
// The yes/no and file controls joined them in 1.6.0 (field orders FO-1): the
// field renderers name the controls they draw that say their error under
// themselves (OWN_ERROR_CONTROLS: the switch, the checkbox and the «Да» |
// «Нет» buttons of a yes/no, a file's upload area), where the form drew a line
// under a control with a normal edge.
export const SPEAKING_TAGS = new Set([
  'sf-input', 'sf-input-choice', 'sf-input-code', 'sf-input-color', 'sf-input-country', 'sf-input-date',
  'sf-input-image', 'sf-input-lookup', 'sf-input-quantity', 'sf-input-rich', 'sf-input-textarea', 'sf-dropdown',
]);

// Whether the control says the field's error itself: one of the tags above,
// and not one option of a checklist (a long choices field drawn as boxes,
// whose error is the form's line under the list).
export function speaksError(control) {
  if (!control || !(SPEAKING_TAGS.has(control.localName) || OWN_ERROR_CONTROLS.includes(control.localName))) return false;
  return !(control.localName === 'sf-checkbox' && control.closest?.('.sf-field-checklist'));
}

// The element a screen reader reads a field's description with: a group of
// choices as a whole, else the control's own focus target, else its first
// native control.
function messageTarget(control) {
  const group = control.querySelector('[role="radiogroup"], [role="group"]');
  if (group) return group;
  const delegate = typeof control.focusDelegate === 'function' ? control.focusDelegate() : null;
  if (delegate && delegate !== control && control.contains(delegate)) return delegate;
  return control.querySelector('input:not([type="hidden"]), textarea, select, button, [role="combobox"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])');
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => {
  if (!isObject(value)) return {};
  try {
    return structuredClone(value);
  } catch {
    return {...value};
  }
};
const same = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

/** Whether a field's value counts as given: not absent, not empty text, not an empty list. */
export function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** The fields as given, made safe: objects with a key and a type, each key once, width one of s, m, full or none. */
export function normalizeFields(list) {
  const seen = new Set();
  const fields = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!isObject(item)) continue;
    const key = text(item.key);
    const type = text(item.propertyType || item.type || item.dataType);
    if (!key || !type || seen.has(key)) continue;
    seen.add(key);
    const width = WIDTHS.includes(item.width) ? item.width : '';
    fields.push({...item, key, label: text(item.label) || key, propertyType: type, width, group: text(item.group)});
  }
  return fields;
}

/**
 * The groups the fields stand in, in order: the listed groups that hold a
 * field, then one group of its own for the fields without a listed group.
 * Each is {key, label, fields}.
 */
export function groupFields(fields, groups) {
  const listed = (Array.isArray(groups) ? groups : []).filter(isObject).map((group) => ({key: text(group.key), label: text(group.label)}))
    .filter((group, index, all) => group.key && all.findIndex((one) => one.key === group.key) === index);
  const keys = new Set(listed.map((group) => group.key));
  const out = listed.map((group) => ({...group, fields: fields.filter((field) => field.group === group.key)}))
    .filter((group) => group.fields.length);
  const rest = fields.filter((field) => !keys.has(field.group));
  if (rest.length) out.push({key: '', label: '', fields: rest});
  return out;
}

const FormElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'ru',
  actions: {
    'check-validity'() {
      return this.checkFields({focus: false, submit: false}) ? applied() : refused('invalid');
    },
    reset() {
      this.restore();
      return applied();
    },
    'set-errors'(args = {}) {
      const errors = isObject(args?.errors) ? args.errors : (isObject(args) && !('errors' in args) ? args : {});
      return this.applyHostErrors(errors);
    },
  },
});

class SfForm extends FormElement {
  constructor() {
    super();
    // The saved state and what the fields hold now.
    this._saved = {};
    this._values = {};
    // Shown errors by key, the host's errors by key, the fields the person
    // changed, and whether a submit was tried since the last saved state.
    this._errors = new Map();
    this._hostErrors = new Map();
    this._touched = new Set();
    this._submitted = false;
    this._dirty = false;
    // The mode the form returns to after a save or a cancel: view when it was
    // opened from view.
    this._fromView = false;
    // apply answer: which answer is on its way, true (Отправить) or false
    // (Отмена); null when the host set pending itself.
    this._pressed = null;
    this._hosts = new Map();
    this._onSubmit = (event) => this.onNativeSubmit(event);
    this._onFocusOut = (event) => this.onFieldLeave(event);
    this._onInput = (event) => this.onFieldInput(event);
    // A control's own drawing may rewrite its native control's
    // aria-describedby: the form's lines are linked again after it.
    this._onControlDrawn = (event) => {
      if (event.target !== this && event.target?.closest?.('.sf-form-control')) this.linkMessages();
    };
  }

  onConnected() {
    super.onConnected?.();
    this.addEventListener('submit', this._onSubmit);
    this.addEventListener('focusout', this._onFocusOut);
    this.addEventListener('input', this._onInput);
    this.addEventListener('sf-after-render', this._onControlDrawn);
  }

  onDisconnected() {
    super.onDisconnected?.();
    this.removeEventListener('submit', this._onSubmit);
    this.removeEventListener('focusout', this._onFocusOut);
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('sf-after-render', this._onControlDrawn);
  }

  // The ids the template writes come from the instance path (§7.1.1), never
  // from a counter.
  get _id() {
    return partId(instancePath(this, {kind: 'sf-form'}));
  }

  // ---------------------------------------------------------------- value

  // Set from code, the value is the saved state: the form shows it, forgets
  // the errors and is not dirty. No event, as for a native field.
  get value() {
    return clone(this._values);
  }

  set value(next) {
    this._saved = clone(next);
    this._values = clone(next);
    this.forget();
    this.requestComponentUpdate('value');
  }

  get valid() {
    return this.shownFields().every((field) => !this.errorOf(field));
  }

  get dirty() {
    return this._dirty;
  }

  get list() {
    return normalizeFields(this.fields);
  }

  // The fields the form shows now: every field the renderers draw. A field of
  // a type the renderers do not know at all (items or compound, which a
  // component set draws, or a misspelt type) is still left out, and the page
  // hears it once per type, with the field that brought it (set boundary
  // study, 2026-11-17): it was dropped without a word.
  shownFields() {
    // An answer declined or run out shows only its outcome (the confirm
    // surface; C35: a declined answer says nothing).
    if (this.isAnswer && !ANSWERING.has(this.answerState) && this.answerState !== 'accepted') return [];
    const editing = this.isEditing;
    return this.list.filter((field) => {
      warnUnknownType(field);
      return editing ? this.drawsEdit(field) : this.drawsView(field);
    });
  }

  // A field of a type the renderers do not draw in this mode is left out.
  drawsEdit(field) {
    const modes = propertyModes(field.propertyType);
    return modes.edit || (field.readonly === true && modes.view);
  }

  drawsView(field) {
    return propertyModes(field.propertyType).view;
  }

  get isEditing() {
    if (this.isAnswer) return ANSWERING.has(this.answerState);
    return this.mode !== 'view';
  }

  // apply answer: a form a person answers once (C291 (3)); mode is not read.
  get isAnswer() {
    return this.apply === 'answer';
  }

  get answerState() {
    return CONFIRM_STATES.includes(this.state) ? this.state : 'open';
  }

  get isInstant() {
    return this.apply === 'instant';
  }

  renderOptions() {
    const options = this.isInstant ? {apply: 'instant'} : {};
    // size 1/2: the controls a rung down, for a form in a message (C291 (3)).
    if (this.size === '1/2') options.size = '1/2';
    return options;
  }

  forget() {
    this._errors.clear();
    this._hostErrors.clear();
    this._touched.clear();
    this._submitted = false;
    this.setDirty(false);
  }

  setDirty(dirty) {
    this._dirty = Boolean(dirty);
    this.sfHostState('data-dirty', this._dirty);
  }

  // ---------------------------------------------------------------- the renderers' host

  // One host per field (the field renderers' interface): setFieldValue writes
  // the value, setFieldError says an incomplete text (a mask).
  hostOf(field) {
    let host = this._hosts.get(field.key);
    if (!host) {
      host = {
        setFieldValue: (one, value) => this.writeValue(one?.key ?? field.key, value),
        setFieldError: (one, message) => this.writeRendererError(one?.key ?? field.key, message),
      };
      this._hosts.set(field.key, host);
    }
    return host;
  }

  writeValue(key, value) {
    if (value === undefined) delete this._values[key];
    else this._values[key] = value;
    this._touched.add(key);
    this._hostErrors.delete(key);
    this.setDirty(!same(this._values, this._saved));
    this.sfEmit('input', {key, value});
    if (this.isInstant) this.sfEmit('change', {key, value});
    // A shown error goes the moment the value is right, and keeps the words
    // of what is wrong now (C153 (3)).
    if (this._errors.has(key)) this.recheck(key);
    this.requestComponentUpdate('value');
  }

  writeRendererError(key, message) {
    const words = text(message);
    if (words) this._rendererErrors = {...(this._rendererErrors || {}), [key]: words};
    else if (this._rendererErrors) delete this._rendererErrors[key];
  }

  // ---------------------------------------------------------------- checks

  // What is wrong with a field now, or '' -- the host's error first, then a
  // missing value in the form's words, then the renderer's (an incomplete
  // mask), then the control's own validity in its own words.
  errorOf(field) {
    const key = field.key;
    if (this._hostErrors.has(key)) return this._hostErrors.get(key);
    if (field.readonly === true) return '';
    const value = this._values[key];
    // A required yes/no is answered by its value, an unticked box is «Нет».
    if (field.required === true && field.propertyType !== 'boolean' && !hasValue(value)) {
      return this.sfWord('value-missing', {vars: {label: field.label}});
    }
    const rendered = this._rendererErrors?.[key];
    if (rendered) return rendered;
    const control = this.controlOf(key);
    const validity = control?.validity;
    if (validity && validity.valid === false) {
      if (validity.valueMissing) return field.required === true ? this.sfWord('value-missing', {vars: {label: field.label}}) : '';
      return validityWords(control) || control.validationMessage || '';
    }
    return '';
  }

  recheck(key) {
    const field = this.list.find((one) => one.key === key);
    if (!field) return;
    const message = this.errorOf(field);
    if (message) this._errors.set(key, message);
    else this._errors.delete(key);
    this.sfHostState('data-invalid', this._errors.size > 0);
    this.requestComponentUpdate('validity');
  }

  // A check of every field shown: each wrong one shows its error. With focus,
  // one error moves the focus to its field and two or more to the summary.
  checkFields({focus = false} = {}) {
    this._submitted = true;
    this._errors.clear();
    const wrong = [];
    for (const field of this.shownFields()) {
      const message = this.errorOf(field);
      if (!message) continue;
      this._errors.set(field.key, message);
      wrong.push(field.key);
    }
    this.sfHostState('data-invalid', wrong.length > 0);
    this.requestComponentUpdate('validity');
    if (!wrong.length) return true;
    this.sfEmit('invalid', {fields: wrong});
    if (focus) this.whenDrawn(() => (wrong.length > 1 ? this.focusSummary() : this.focusField(wrong[0])));
    return false;
  }

  applyHostErrors(errors) {
    const shown = new Set(this.list.map((field) => field.key));
    const entries = Object.entries(errors).map(([key, message]) => [text(key), text(message)]).filter(([key, message]) => key && message);
    if (entries.length && !entries.some(([key]) => shown.has(key))) return refused('missing');
    // apply answer: the host's errors answer a Send that could not be taken;
    // the form is open again with them. An answer settled is not reopened.
    if (this.isAnswer) {
      if (!ANSWERING.has(this.answerState)) return refused('closed');
      if (this.answerState === 'pending') this.state = 'open';
    }
    this._hostErrors = new Map(entries.filter(([key]) => shown.has(key)));
    if (!this._hostErrors.size) {
      for (const key of [...this._errors.keys()]) this.recheck(key);
      return applied();
    }
    if (!this.isEditing) {
      this._fromView = true;
      this.mode = 'edit';
    }
    this.checkFields({focus: true});
    return applied();
  }

  // ---------------------------------------------------------------- presses

  onNativeSubmit(event) {
    if (!event.target?.classList?.contains('sf-form')) return;
    event.preventDefault();
    this.submit();
  }

  submit() {
    if (this.isAnswer) return this.answer(true);
    if (!this.isEditing || this.isInstant) return refused('mode');
    if (!this.checkFields({focus: true})) return refused('invalid');
    const value = this.value;
    if (!this.sfEmit('submit', {value}, {cancelable: true})) return refused('prevented');
    this._saved = clone(this._values);
    this.forget();
    if (this._fromView) this.toView();
    else this.requestComponentUpdate('saved');
    return applied();
  }

  cancel() {
    if (this.isAnswer) return this.answer(false);
    this.restore();
    this.sfEmit('cancel', {value: this.value});
    if (this._fromView) this.toView();
  }

  // apply answer: «Отправить» (true) checks the fields and sends the values,
  // «Отмена» (false) declines. The form goes pending before the event, so a
  // host may set the outcome in its handler; a cancelled event is an answer
  // the host did not take, and the form is open again (the confirm surface).
  answer(accepted) {
    if (this.answerState !== 'open') return refused('closed');
    if (accepted && !this.checkFields({focus: true})) return refused('invalid');
    const focusWasInside = this.contains(this.ownerDocument.activeElement);
    this._pressed = accepted;
    this.state = 'pending';
    const detail = accepted ? {accepted, value: this.value} : {accepted};
    if (!this.sfEmit('answer', detail, {cancelable: true})) {
      this._pressed = null;
      this.state = 'open';
      return refused('prevented');
    }
    // The values sent are what the read view shows after the answer.
    if (accepted) {
      this._saved = clone(this._values);
      this.forget();
    }
    // The pressed button is gone with the answers: the line that says what
    // happened takes the focus rather than the page.
    if (focusWasInside) this.whenDrawn(() => this.querySelector('.sf-form-state')?.focus({preventScroll: true}));
    this.requestComponentUpdate('answer');
    return applied();
  }

  restore() {
    this._values = clone(this._saved);
    this._rendererErrors = {};
    this.forget();
    this.sfHostState('data-invalid', false);
    this.requestComponentUpdate('reset');
  }

  toEdit() {
    this._fromView = true;
    this.mode = 'edit';
    this.sfHostState('data-mode', 'edit');
    this.requestComponentUpdate('mode');
    this.whenDrawn(() => this.focusField(this.shownFields()[0]?.key));
  }

  toView() {
    this._fromView = false;
    this.mode = 'view';
    this.sfHostState('data-mode', 'view');
    this.requestComponentUpdate('mode');
    const restore = this.contains(this.ownerDocument.activeElement) || this.ownerDocument.activeElement === this.ownerDocument.body;
    if (restore) this.whenDrawn(() => this.querySelector('.sf-form-edit button, .sf-form-edit')?.focus({preventScroll: true}));
  }

  // Leaving a field the person changed, or any field after a submit, checks it.
  onFieldLeave(event) {
    const box = event.target?.closest?.('.sf-form-field');
    if (!box || !this.contains(box)) return;
    if (event.relatedTarget && box.contains(event.relatedTarget)) return;
    const key = box.getAttribute('data-key');
    if (!key || !this.isEditing) return;
    // A layer of the field (a list, a picker) holds the focus for it.
    queueMicrotask(() => {
      if (box.matches(':focus-within')) return;
      if (!this._touched.has(key) && !this._submitted && !this._errors.has(key)) return;
      this.recheck(key);
    });
  }

  // Typing into a field that shows an error takes the error away the moment
  // the control says the text is right, before the control writes it.
  onFieldInput(event) {
    const box = event.target?.closest?.('.sf-form-field');
    if (!box || !this.contains(box)) return;
    const key = box.getAttribute('data-key');
    if (!key) return;
    this._touched.add(key);
    if (!this._errors.has(key) || this._hostErrors.has(key)) return;
    const control = this.controlOf(key);
    if (control?.validity?.valid && control.validity.valueMissing === false) {
      const field = this.list.find((one) => one.key === key);
      if (field && (field.required !== true || hasValue(control.value))) {
        this._errors.delete(key);
        this.sfHostState('data-invalid', this._errors.size > 0);
        this.requestComponentUpdate('validity');
      }
    }
  }

  // ---------------------------------------------------------------- focus

  controlOf(key) {
    const slot = this.querySelector(`.sf-form-field[data-key="${CSS.escape(String(key))}"] > .sf-form-control`);
    if (!slot) return null;
    // The control that says its own error first: a file field draws the files
    // it holds (sf-file-preview) before its upload area (FO-1).
    let first = null;
    for (const node of slot.querySelectorAll('*')) {
      if (!node.localName.startsWith('sf-') || node.localName === 'sf-help-mark') continue;
      if (speaksError(node)) return node;
      first ??= node;
    }
    return first;
  }

  focusField(key) {
    if (!key) return;
    const control = this.controlOf(key);
    const slot = control?.closest('.sf-form-control');
    const target = control?.focusDelegate?.() || slot?.querySelector('input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])') || control;
    try {
      target?.focus?.();
    } catch {
      /* a field taken out of the page */
    }
  }

  focusSummary() {
    this.querySelector('.sf-form-summary')?.focus();
  }

  // Runs after the element's next drawing (and its controls').
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

  // ---------------------------------------------------------------- drawing

  // After each drawing, in the same task: a control of the field family says
  // its error itself (invalid, error-message); a checkbox carries its label.
  renderTemplateResult(templateResult) {
    const result = super.renderTemplateResult(templateResult);
    this.syncControls();
    return result;
  }

  syncControls() {
    for (const field of this.list) {
      const control = this.controlOf(field.key);
      if (!control) continue;
      const message = this.isEditing ? (this._errors.get(field.key) || '') : '';
      const speaks = speaksError(control);
      // A yes/no checkbox carries its label (a box beside its name, not under it).
      if (speaks && control.localName === 'sf-checkbox' && control.getAttribute('label') !== field.label) control.setAttribute('label', field.label);
      if (speaks) {
        if (message) {
          if (control.getAttribute('error-message') !== message) control.setAttribute('error-message', message);
          if (!control.hasAttribute('invalid')) control.setAttribute('invalid', '');
          control.setAttribute('data-sf-form-invalid', '');
        } else if (control.hasAttribute('data-sf-form-invalid')) {
          control.removeAttribute('data-sf-form-invalid');
          control.removeAttribute('invalid');
          control.removeAttribute('error-message');
        }
      }
    }
    this.linkMessages();
  }

  // The hint or the error line the form draws under a control is read with
  // that control: its id joins the aria-describedby of the control's native
  // focus target, and leaves it once the line is gone (the error gives the
  // hint's place back). A screen reader heard the label and the value of a
  // field and never its hint. Ids the control set itself are kept.
  linkMessages() {
    for (const box of this.querySelectorAll('.sf-form-field')) {
      const key = box.getAttribute('data-key');
      const control = key ? this.controlOf(key) : null;
      const target = control ? messageTarget(control) : null;
      if (!target) continue;
      const lines = [...box.children]
        .filter((node) => node.matches('.sf-form-hint, .sf-form-error') && node.id)
        .map((node) => node.id);
      const before = String(target.getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean);
      const own = before.filter((id) => !id.endsWith(`--hint-${key}`) && !id.endsWith(`--error-${key}`));
      const next = [...new Set([...own, ...lines])];
      if (next.join(' ') === before.join(' ')) continue;
      if (next.length) target.setAttribute('aria-describedby', next.join(' '));
      else target.removeAttribute('aria-describedby');
    }
  }

  templateContext() {
    const editing = this.isEditing;
    const instant = this.isInstant;
    const fields = this.shownFields();
    const id = this._id;
    const word = (key, options) => this.sfWord(key, options);
    const groups = groupFields(fields, this.groups).map((group, index, all) => ({
      ...group,
      legend: all.length > 1 ? group.label : '',
      fields: group.fields.map((field) => this.fieldContext(field, {editing, instant, id})),
    }));
    const answer = this.isAnswer ? this.answerContext() : null;
    const errors = editing ? fields.filter((field) => this._errors.has(field.key))
      .map((field) => ({key: field.key, message: this._errors.get(field.key), href: `#${id}--field-${field.key}`})) : [];
    this.sfHostState('data-mode', editing ? 'edit' : 'view');
    this.sfHostState('data-dirty', this._dirty);
    this.sfHostState('data-state', answer ? answer.state : null);
    return this.createTemplateContext({
      ...this.getPropsContext(),
      component: this,
      id,
      label: text(this.label),
      editing,
      instant,
      answer,
      size: this.size === '1/2' ? '1/2' : '1',
      labels: this.labels === 'start' ? 'start' : 'top',
      footer: this.footer === 'sticky' ? 'sticky' : 'static',
      groups,
      requiredNote: editing && !instant && !(answer && answer.state !== 'open') && fields.some((field) => field.required === true && field.readonly !== true && field.propertyType !== 'boolean'),
      errorList: editing && this._submitted && errors.length > 1 ? errors : null,
      dirty: answer ? false : this._dirty,
      words: {
        send: word('send'),
        requiredNote: word('required-note'),
        submit: word('submit'),
        cancel: word('cancel'),
        edit: word('edit'),
        unsaved: word('unsaved'),
        errorsTitle: word('errors-title', {count: errors.length}),
      },
      rootClass: this.getRootClass(),
    });
  }

  // apply answer: the state, the line under the fields and its glyph (the
  // confirm surface's: schedule, check_circle, timer_off).
  answerContext() {
    const state = this.answerState;
    if (state !== 'pending') this._pressed = null;
    const line = {
      pending: this._pressed === false ? 'answer-cancelling' : 'answer-sending',
      accepted: 'answer-sent',
      expired: 'answer-expired',
    }[state];
    return {
      state,
      open: state === 'open',
      pending: state === 'pending',
      pressed: state === 'pending' ? this._pressed : null,
      text: line ? this.sfWord(line) : '',
      icon: line ? CONFIRM_ICON[state] : '',
    };
  }

  fieldContext(field, {editing, id}) {
    const value = this._values[field.key];
    const host = this.hostOf(field);
    // A short choice is a ready group of radios or checks (C165 (1)).
    const control = editing
      ? (isListChoice(field) ? renderChoiceList(field, value, host) : renderEditField(field, value, host, this.renderOptions()))
      : renderViewField(field, value, host, this.size === '1/2' ? {size: '1/2'} : {});
    // A yes/no drawn as a checkbox carries its label beside the box (C165
    // (4)): no label row over it. The field's template says which it is
    // (C303 (4)); the form no longer picks it from required and apply.
    const drawn = fieldTemplate(field);
    const checkbox = editing && drawn.type === 'boolean' && drawn.template === 'checkbox' && field.readonly !== true;
    const error = editing ? (this._errors.get(field.key) || '') : '';
    const element = this.controlOf(field.key);
    const speaks = speaksError(element);
    return {
      key: field.key,
      id: `${id}--field-${field.key}`,
      label: field.label,
      labelRow: !checkbox,
      required: editing && field.required === true && field.readonly !== true && drawn.type !== 'boolean',
      help: text(field.help),
      helpLabel: this.sfWord('help-label', {vars: {label: field.label}}),
      // The hint gives its place to the error (C153 (3)).
      hint: editing && !error ? text(field.hint) : '',
      hintId: `${id}--hint-${field.key}`,
      // The form draws the error line only where the control does not.
      error: error && !speaks ? error : '',
      errorId: `${id}--error-${field.key}`,
      width: field.width,
      control,
      focus: () => this.focusField(field.key),
    };
  }

  template() {
    return renderFormTemplate(this.templateContext());
  }
}

SfForm.define('sf-form');

export {SfForm};

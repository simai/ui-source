import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
import {FormField} from '../helpers/form-field';
import {renderChoiceTemplate} from './js/templates/default';
import {CHOICE_COLUMNS, applyChoice, formatValue, normaliseItems, orderValues, parseValue} from './js/choice-model.mjs';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// sf-input-choice: a form field that picks one option, or several, from
// cards -- a site's kind, a page type, a template, a backup target, a plan --
// each with a title, a caption, an icon and a badge. Larena's request
// msg-993e1e39 item 3 (choice cards).
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8,
// §17): the settings are made by core/js/element-manifest.js; the host is the
// form control through ElementInternals and sends the chosen values. The
// cards are native radios (single) or checkboxes (multiple), so the keyboard
// is the browser's -- the arrow keys move and choose in a radio group, Space
// toggles a checkbox -- and a person's press says input and change once; a
// value set from code, a form reset and a restore say nothing.
//
// While the host submits, the inner inputs are taken out of the page's form by
// a `form` attribute that names no form (§17.1 item 6), and their name is the
// host's path id, so the radios of one element are one group and two elements
// never share one.
const ChoiceElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'en',
});

// The id the inner inputs' form attribute names: no element carries it.
const NO_FORM = 'sf-input-choice-no-form';

class SfInputChoice extends FormField(ChoiceElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: {attribute: 'root-class', default: ''},
    };
  }

  // value is a property, but a page prints it as an attribute too: one value,
  // or the values separated by commas.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'value', 'items'])];
  }

  constructor() {
    super();
    // undefined: follow the value attribute (the default a reset returns to).
    this._value = undefined;
    // A value set as a property before the element was defined is an own
    // property that would hide the accessor; it is taken through it.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const early = this.value;
      delete this.value;
      this._value = early;
    }
    // The inner inputs' own input and change stay inside: the host says its
    // own, once, with the choice in the detail.
    this.addEventListener('input', this.onInnerEvent, true);
    this.addEventListener('change', this.onInnerEvent, true);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // The value attribute written again is the value again.
    if (name === 'value' && oldValue !== newValue) {
      this._value = undefined;
      this.requestComponentUpdate?.('value');
      this.sfSyncFormState?.();
    }
    // A list setting is a property (or the JSON island); the attribute holds
    // the same list as JSON, as sf-menu's items.
    if (name === 'items' && oldValue !== newValue) this.requestComponentUpdate?.('items');
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  // ---------------------------------------------------------- settings

  // The options: the property or the island, else the attribute's JSON.
  get options() {
    const given = this.items;
    if (Array.isArray(given) && given.length) return normaliseItems(given);
    return normaliseItems(this.getAttribute('items'));
  }

  get effectiveDisabled() {
    return Boolean(this.disabled || this.sfFormDisabled);
  }

  get columnsValue() {
    const columns = String(this.columns ?? 'auto');
    return CHOICE_COLUMNS.includes(columns) ? columns : 'auto';
  }

  /** The chosen values, in the order of the options: one, or several when multiple. */
  get selected() {
    const raw = this._value !== undefined ? this._value : this.getAttribute('value');
    return orderValues(parseValue(raw ?? '', Boolean(this.multiple)), this.options);
  }

  /** One value, or the values joined by commas when multiple; '' when nothing is chosen. */
  get value() {
    return formatValue(this.selected);
  }

  // Set from code it is not a change: no event, as for a native field.
  set value(next) {
    this._value = next === undefined || next === null ? undefined : formatValue(parseValue(next, Boolean(this.multiple)));
    this.requestComponentUpdate?.('value');
    this.sfSyncFormState?.();
  }

  /** The cards' inputs, in order. */
  get inputs() {
    return [...this.querySelectorAll('.sf-choice-input')].filter((input) => input.closest('sf-input-choice') === this);
  }

  getInputElement() {
    return null;
  }

  // The first card that takes the focus: the chosen one, else the first
  // enabled one -- where Tab lands in a radio group.
  focusDelegate() {
    const inputs = this.inputs.filter((input) => !input.disabled);
    return inputs.find((input) => input.checked) || inputs[0] || null;
  }

  // ---------------------------------------------------------- the person

  onInnerEvent = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('sf-choice-input')
      || input.closest('sf-input-choice') !== this) return;
    event.stopPropagation();
    if (event.type !== 'change') return;
    const item = this.options.find((one) => one.value === input.value);
    if (!item) return;
    const multiple = Boolean(this.multiple);
    const next = applyChoice(this.selected, this.options, item.value, input.checked, multiple);
    this._value = formatValue(next);
    this.requestComponentUpdate('value');
    this.sfSyncFormState();
    const detail = {value: this.value, values: [...next], item: {...item}, checked: input.checked};
    this.sfEmit('input', detail);
    this.sfEmit('change', detail);
  };

  // ---------------------------------------------------------- form

  // The values alone: one entry, or one entry per chosen value under the
  // name (§17.1); nothing while disabled or empty.
  sfFormValue() {
    if (this.effectiveDisabled) return null;
    const entries = this.selected;
    if (!entries.length) return null;
    if (!this.multiple) return entries[0];
    const name = this.name || '';
    if (!name || typeof FormData !== 'function') return entries.join(',');
    const data = new FormData();
    for (const entry of entries) data.append(name, entry);
    return data;
  }

  fieldValidity() {
    const missing = Boolean(this.required) && !this.effectiveDisabled && this.selected.length === 0;
    return {valueMissing: missing, message: missing ? this.sfWord('value-missing') : '', anchor: this.focusDelegate()};
  }

  // form.reset(): the value attribute back, without events.
  fieldReset() {
    this._value = undefined;
    this.requestComponentUpdate('reset');
  }

  fieldRestore(state) {
    let values = state;
    if (typeof FormData === 'function' && state instanceof FormData) values = state.getAll(this.name || '').map(String);
    if (values === null || values === undefined) return;
    this._value = formatValue(parseValue(values, Boolean(this.multiple)));
    this.requestComponentUpdate('restore');
  }

  // ---------------------------------------------------------- drawing

  templateContext() {
    const props = this.getPropsContext();
    const internals = Boolean(this.sfInternals);
    const id = partId(instancePath(this, {kind: 'sf-input-choice'}));
    return this.createTemplateContext({
      ...props,
      component: this,
      id,
      items: this.options,
      chosen: new Set(this.selected),
      multiple: Boolean(this.multiple),
      columns: this.columnsValue,
      label: this.label || '',
      ariaLabel: this.getAttribute('aria-label') || '',
      hint: this.hint || '',
      errorMessage: this.errorMessage || '',
      invalid: Boolean(this.invalid),
      required: Boolean(this.required),
      disabled: this.effectiveDisabled,
      // Without ElementInternals the named inner inputs submit, as before.
      controlName: internals ? `${id}--choice` : (this.name || `${id}--choice`),
      innerForm: internals ? NO_FORM : '',
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderChoiceTemplate(this.templateContext());
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.sfSyncFormState();
    return undefined;
  }
}

SfInputChoice.define('sf-input-choice');

export {SfInputChoice};

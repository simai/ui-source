import {
  bindTextarea,
  setTextareaState,
  unbindTextarea,
} from '../../component/textarea/js/_textarea';
import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { fieldSize } from '../../component/field-size';
import { InheritedValueField } from '../helpers/inherited-value';
import { FormField, innerControlName } from '../helpers/form-field';
import { renderTextareaTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-textarea from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §17, §20). The settings are made by core/js/element-manifest.js;
// `spellcheck` (a property of HTMLElement, §3.1) is spell-check, and `type`
// (appearance) and `error` (invalid, §17.2) are dated aliases, as is the
// trait's old event sf-field:reset (aliases.json). The host is the form
// control through ElementInternals: it submits the text and reports the native
// textarea's validity, and the textarea carries no name (§17.1).
const TextareaElement = elementFromManifest(manifest, {
  base: InheritedValueField(SfBaseElement),
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfTextarea extends FormField(TextareaElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: { default: '' },
      // What the field falls back to while it holds nothing (simai/ui-source#28).
      inheritedValue: { attribute: 'inherited-value', default: '' },
      inheritedText: { attribute: 'inherited-text', default: '' },
      resetLabel: { attribute: 'reset-label', default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-textarea');
  }

  get minlength() {
    const value = this.getNumberAttr('minlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  get maxlength() {
    const value = this.getNumberAttr('maxlength', null);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  get value() {
    const textarea = this.querySelector('.sf-textarea textarea');
    return textarea ? textarea.value : this.getAttribute('value') || '';
  }

  set value(nextValue) {
    const normalizedValue = String(nextValue ?? '');
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', normalizedValue);
    }
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector('textarea');
    if (root?.__sfTextareaMask) root.__sfTextareaMask.value = normalizedValue;
    else if (textarea) textarea.value = normalizedValue;
    this.sfSyncFormState?.();
  }

  get rows() {
    const value = Math.trunc(this.getNumberAttr('rows', 3));
    return value > 0 ? value : 3;
  }

  get minRows() {
    const value = Math.trunc(this.getNumberAttr('minRows', 1));
    return value > 0 ? value : 1;
  }

  // No cap unless one is given; a cap below min-rows is min-rows.
  get maxRows() {
    const value = Math.trunc(this.getNumberAttr('maxRows', null));
    return value > 0 ? Math.max(value, this.minRows) : null;
  }

  // The inherited-value seam: the native textarea is the value, the focus and
  // what carries the description.
  inheritedFocusTarget() {
    return this.querySelector('.sf-textarea textarea');
  }

  getInputElement() {
    return this.inheritedFocusTarget();
  }

  // A reset is said the way typing is: input, then change, from the textarea.
  clearOwnValue() {
    this.value = '';
    const textarea = this.inheritedFocusTarget();
    textarea?.dispatchEvent(new Event('input', {bubbles: true}));
    textarea?.dispatchEvent(new Event('change', {bubbles: true}));
  }

  // The browser's restore of a form (back, reload) gives the text back.
  formStateRestoreCallback(state) {
    if (typeof state === 'string') this.value = state;
  }

  templateContext() {
    const props = this.getPropsContext();
    const textarea = this.querySelector('textarea');

    return this.createTemplateContext({
      ...props,
      value: this.hasAttribute('value') || !textarea ? props.value : textarea.value,
      // The host is the form control where the browser has ElementInternals,
      // so the textarea carries no name (§17.1 item 6).
      controlName: innerControlName(this, props.name),
      // Resolved names the template reads (contracts/template-context.json).
      type: this.appearance,
      minlength: this.minlength,
      maxlength: this.maxlength,
      autoGrow: this.autoGrow,
      minRows: this.minRows,
      maxRows: this.maxRows,
      inheritedValue: this.inheritedValue,
      inheritedText: this.inheritedText,
      resetLabel: this.resetLabel,
      component: this,
    });
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }
  }

  afterRender() {
    if (this._boundRoot) {
      unbindTextarea(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-textarea');
    if (this._boundRoot) {
      bindTextarea(this._boundRoot);
    }
    this.syncInheritedState();
    this.sfSyncFormState();
  }

  template() {
    return renderTextareaTemplate(this.templateContext());
  }

  get state() {
    const root = this.querySelector('.sf-textarea');
    const textarea = root?.querySelector?.('textarea') || null;
    return {
      value: textarea?.value || '',
      disabled: !!textarea?.disabled,
      invalid: textarea?.getAttribute('aria-invalid') === 'true',
      error: root?.classList?.contains('error') || textarea?.classList?.contains('error') || false,
    };
  }

  setState(nextState = {}) {
    const root = this.querySelector('.sf-textarea');
    return setTextareaState(root, nextState);
  }
}

SfTextarea.define('sf-textarea');

import SfBaseElement, { toBoolean } from '../../core/js/smart-base';
import { resolveCheckboxIcon } from '../../component/checkbox/js/_checkbox';
import { renderCheckboxTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';


class SfCheckbox extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1', values: ['1/2', '1', '2'] },
      label: { default: '' },
      ariaLabel: { default: '' },
      description: { default: '' },
      help: { default: '' },
      position: {type: String, default: 'start', values: ['start', 'end']},
      rootClass: {type: String, default: ''},
      checked: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      indeterminate: { type: Boolean, default: false },
      name: { default: '' },
      value: { default: '' },
      error: { type: Boolean, default: false },
    };
  }


  constructor() {
    super();
    this._inputElement = null;
  }

  get size() {
    return this.getProp('size');
  }

  get label() {
    return this.getProp('label');
  }

  // A checkbox with no visible label still needs a name: a table's row and
  // select-all boxes are the common case. Like sf-button, the name comes from
  // the host's aria-label or the ariaLabel prop and lands on the native input.
  get ariaLabel() {
    return this.getProp('ariaLabel') || this.getAttribute('aria-label') || '';
  }

  get description() {
    return this.getProp('description');
  }

  get help() {
    return this.getProp('help');
  }

  get checked() {
    return this.getProp('checked');
  }

  set checked(nextValue) {
    if (nextValue) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
  }

  get disabled() {
    return this.getProp('disabled');
  }

  get indeterminate() {
    return this.getProp('indeterminate');
  }

  get name() {
    return this.getProp('name');
  }

  get value() {
    return this.getProp('value');
  }

  set value(nextValue) {
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
      return;
    }

    this.setAttribute('value', String(nextValue));
  }

  get error() {
    return this.getProp('error');
  }

  get stateIcon() {
    return resolveCheckboxIcon({
      checked: this.checked,
      indeterminate: this.indeterminate,
    });
  }

  template() {
    return renderCheckboxTemplate({
      ...this.templateContext(),
      stateIcon: this.stateIcon,
      ariaLabel: this.ariaLabel,
    });
  }

  async afterRender() {
    await this.whenChildrenDefined();

    const input = this.getInputElement();
    if (!input) return;

    this.syncInputState(input);
    this._releaseReset?.();
    this._releaseReset = bindCheckableReset(this, input);

    if (this._inputElement && this._inputElement !== input) {
      this._inputElement.removeEventListener('change', this._handleChange);
    }

    if (this._inputElement !== input) {
      input.addEventListener('change', this._handleChange);
      this._inputElement = input;
    }
  }

  onDisconnected() {
    this._releaseReset?.();
    this._releaseReset = null;
    if (this._inputElement) {
      this._inputElement.removeEventListener('change', this._handleChange);
      this._inputElement = null;
    }
  }

  _handleChange = () => {
    const input = this.getInputElement();
    if (!input) return;

    if (input.checked) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }

    if (input.indeterminate) {
      this.setAttribute('indeterminate', '');
    } else {
      this.removeAttribute('indeterminate');
    }
  };

  getInputElement() {
    return this.querySelector('.sf-checkbox input[type="checkbox"]');
  }

  isChecked() {
    return !!this.getInputElement()?.checked;
  }

  setChecked(nextValue = false) {
    const checked = toBoolean(nextValue, false);
    this.setState({ checked });
    return this;
  }

  setIndeterminate(nextValue = false) {
    const indeterminate = toBoolean(nextValue, false);
    this.setState({ indeterminate });
    return this;
  }

  setDisabled(nextValue = false) {
    const disabled = toBoolean(nextValue, false);
    this.setState({ disabled });
    return this;
  }

  get state() {
    const input = this.getInputElement();
    return {
      checked: !!input?.checked,
      indeterminate: !!input?.indeterminate,
      disabled: !!input?.disabled,
      name: input?.name || '',
      value: input?.value || '',
    };
  }

  syncInputState(input = this.getInputElement()) {
    if (!input) return;

    input.checked = this.checked;
    input.disabled = this.disabled;
    input.indeterminate = this.indeterminate;
  }

  setBooleanStateAttribute(name, value) {
    if (value) {
      this.setAttribute(name, '');
    } else {
      this.removeAttribute(name);
    }
  }

  setState(nextState = {}) {
    const restState = { ...nextState };
    const input = this.getInputElement();

    if (Object.prototype.hasOwnProperty.call(nextState, 'checked')) {
      const checked = toBoolean(nextState.checked);
      this.setBooleanStateAttribute('checked', checked);
      if (input) input.checked = checked;
      delete restState.checked;
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'indeterminate')) {
      const indeterminate = toBoolean(nextState.indeterminate);
      this.setBooleanStateAttribute('indeterminate', indeterminate);
      if (input) input.indeterminate = indeterminate;
      delete restState.indeterminate;
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'disabled')) {
      const disabled = toBoolean(nextState.disabled);
      this.setBooleanStateAttribute('disabled', disabled);
      if (input) input.disabled = disabled;
      delete restState.disabled;
    }

    if (Object.keys(restState).length) {
      super.setState(restState);
    }

    return this;
  }

  onChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('change', handler, options);
    }

    return this;
  }

  onFocus(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusin', handler, options);
    }

    return this;
  }

  onBlur(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('focusout', handler, options);
    }

    return this;
  }
}

SfCheckbox.define('sf-checkbox');

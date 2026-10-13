import SfBaseElement from '../../core/js/smart-base';
import { bindSwitch, setSwitchState, unbindSwitch } from '../../component/switch/js/_switch';
import { renderSwitchTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';


class SfSwitch extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      label: { default: '' },
      description: { default: '' },
      help: { default: '' },
      checked: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      name: { default: '' },
      value: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get description() {
    return this.getAttribute('description') || '';
  }

  get help() {
    return this.getAttribute('help') || '';
  }

  get checked() {
    return this.getBooleanAttr('checked', false);
  }

  set checked(nextValue) {
    if (nextValue) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  set disabled(nextValue) {
    if (nextValue) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(nextValue) {
    if (nextValue === null || nextValue === undefined) {
      this.removeAttribute('value');
      return;
    }

    this.setAttribute('value', String(nextValue));
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
    });
  }

  template() {
    return renderSwitchTemplate(this.templateContext());
  }

  afterRender() {
    this._releaseReset?.();
    this._releaseReset = null;
    if (this._boundRoot) {
      unbindSwitch(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-switch');
    if (this._boundRoot) {
      bindSwitch(this._boundRoot);
      const input = this.getInputElement();
      if (input) {
        setSwitchState(input, {
          checked: this.checked,
          disabled: this.disabled,
        });
        input.addEventListener('change', this._handleChange);
        this._releaseReset = bindCheckableReset(this, input);
      }
    }
  }

  onDisconnected() {
    this._releaseReset?.();
    this._releaseReset = null;
    const input = this.getInputElement();
    if (input) {
      input.removeEventListener('change', this._handleChange);
    }

    if (this._boundRoot) {
      unbindSwitch(this._boundRoot);
      this._boundRoot = null;
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
  };

  getInputElement() {
    return this.querySelector('.sf-switch input[type="checkbox"]');
  }

  isChecked() {
    return !!this.getInputElement()?.checked;
  }

  setChecked(nextValue = false) {
    this.checked = !!nextValue;
    this.setState({ checked: !!nextValue });
    return this;
  }

  setDisabled(nextValue = false) {
    this.disabled = !!nextValue;
    this.setState({ disabled: !!nextValue });
    return this;
  }

  get state() {
    const input = this.getInputElement();
    return {
      checked: !!input?.checked,
      disabled: !!input?.disabled,
      name: input?.name || '',
      value: input?.value || '',
    };
  }

  setState(nextState = {}) {
    const input = this.getInputElement();
    if (!input) {
      super.setState(nextState);
      return this;
    }

    setSwitchState(input, nextState);

    if (Object.prototype.hasOwnProperty.call(nextState, 'checked')) {
      if (this.toBoolean(nextState.checked)) {
        this.setAttribute('checked', '');
      } else {
        this.removeAttribute('checked');
      }
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'disabled')) {
      if (this.toBoolean(nextState.disabled)) {
        this.setAttribute('disabled', '');
      } else {
        this.removeAttribute('disabled');
      }
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

SfSwitch.define('sf-switch');

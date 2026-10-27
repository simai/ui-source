import SfBaseElement, { toBoolean } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { resolveCheckboxIcon } from '../../component/checkbox/js/_checkbox';
import { renderCheckboxTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { FormField, innerControlName } from '../helpers/form-field';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-checkbox from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §17.1, §17.2). The settings and the values checked and
// indeterminate are made by core/js/element-manifest.js; `error` is a dated
// alias of `invalid` (§17.2, aliases.json); the host is the form control
// through ElementInternals, so a checked box submits its value, "on" without
// one, as a native checkbox does (§17.1 item 2), and the inner checkbox
// carries no name.
const CheckboxElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfCheckbox extends FormField(CheckboxElement) {
  static get props() {
    return {
      ...super.props,
      // A host attribute, never a setting (§3.1): read for the inner input's name.
      ariaLabel: { attribute: 'aria-label', default: '' },
      rootClass: {type: String, default: ''},
    };
  }

  constructor() {
    super();
    this._inputElement = null;
  }

  // A checkbox with no visible label still needs a name: a table's row and
  // select-all boxes are the common case. Like sf-button, the name comes from
  // the host's aria-label or the ariaLabel prop and lands on the native input.
  get ariaLabel() {
    return this.getProp('ariaLabel') || this.getAttribute('aria-label') || '';
  }

  get stateIcon() {
    return resolveCheckboxIcon({
      checked: this.checked,
      indeterminate: this.indeterminate,
    });
  }

  template() {
    const context = this.templateContext();
    return renderCheckboxTemplate({
      ...context,
      // The host is the form control where the browser has ElementInternals
      // (§17.1 item 6).
      name: innerControlName(this, context.name),
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
    this.sfSyncFormState();
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
    this.sfSyncFormState();
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
      name: this.name,
      value: this.value,
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

    this.sfSyncFormState();
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

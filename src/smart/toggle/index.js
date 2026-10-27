import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { bindToggle, setToggleState, unbindToggle } from '../../component/toggle/js/_toggle';
import { renderToggleTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { FormField, innerControlName } from '../helpers/form-field';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-toggle from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §17.1). Deprecated: sf-switch draws the same control and carries both of
// its looks (contracts/changes/journal.json component-toggle-to-switch). The
// settings are made by core/js/element-manifest.js, the legacy axis name
// `type` is a dated alias of `kind` (aliases.json), and the host is the form
// control through ElementInternals: a checked toggle submits its value, "on"
// without one, as a native checkbox does (§17.1 item 2).
const ToggleElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfToggle extends FormField(ToggleElement) {
  constructor() {
    super();
    this._boundRoot = null;
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
      // The host is the form control where the browser has ElementInternals,
      // so the inner checkbox carries no name (§17.1 item 6).
      checkboxName: innerControlName(this, props.name),
      // Resolved names the template reads (contracts/template-context.json).
      type: this.kind,
    });
  }

  template() {
    return renderToggleTemplate(this.templateContext());
  }

  afterRender() {
    this._releaseReset?.();
    this._releaseReset = null;
    if (this._boundRoot) {
      const prevInput = this.getInputElement();
      prevInput?.removeEventListener('change', this._handleChange);
      unbindToggle(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-toggle');
    if (this._boundRoot) {
      bindToggle(this._boundRoot);
      const input = this.getInputElement();
      if (input) {
        setToggleState(input, {
          checked: this.checked,
          disabled: this.disabled,
        });
        input.addEventListener('change', this._handleChange);
        this._releaseReset = bindCheckableReset(this, input);
      }
    }
    this.sfSyncFormState();
  }

  onDisconnected() {
    this._releaseReset?.();
    this._releaseReset = null;
    const input = this.getInputElement();
    if (input) {
      input.removeEventListener('change', this._handleChange);
    }

    if (this._boundRoot) {
      unbindToggle(this._boundRoot);
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
    this.sfSyncFormState();
  };

  getInputElement() {
    return this.querySelector('.sf-toggle input[type="checkbox"]');
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
      type: this.kind,
      size: this.size,
      checked: !!input?.checked,
      disabled: !!input?.disabled,
      name: this.name,
      value: this.value,
      icon: this.icon,
      label: this.label,
    };
  }

  setState(nextState = {}) {
    const input = this.getInputElement();
    if (!input) {
      super.setState(nextState);
      return this;
    }

    setToggleState(input, nextState);

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

    if (Object.prototype.hasOwnProperty.call(nextState, 'type')) {
      this.setAttribute('kind', String(nextState.type || 'simple'));
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'kind')) {
      this.setAttribute('kind', String(nextState.kind || 'simple'));
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'size')) {
      this.setAttribute('size', String(nextState.size || '1'));
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'icon')) {
      if (nextState.icon) {
        this.setAttribute('icon', String(nextState.icon));
      } else {
        this.removeAttribute('icon');
      }
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'label')) {
      if (nextState.label) {
        this.setAttribute('label', String(nextState.label));
      } else {
        this.removeAttribute('label');
      }
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

SfToggle.define('sf-toggle');

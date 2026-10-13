import SfBaseElement from '../../core/js/smart-base';
import { bindToggle, setToggleState, unbindToggle } from '../../component/toggle/js/_toggle';
import { renderToggleTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';


class SfToggle extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'simple', values: ['simple', 'icon', 'short'], aliases: ['type']},
      label: { default: '' },
      icon: { default: '' },
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

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get icon() {
    return this.getAttribute('icon') || '';
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
      rootClass: this.getRootClass(),
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
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
      type: this.type,
      size: this.size,
      checked: !!input?.checked,
      disabled: !!input?.disabled,
      name: input?.name || '',
      value: input?.value || '',
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
      this.setAttribute('type', String(nextState.type || 'simple'));
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

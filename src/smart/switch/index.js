import SfBaseElement from '../../core/js/smart-base';
import { bindSwitch, setSwitchState, unbindSwitch } from '../../component/switch/js/_switch';
import { renderSwitchTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { pageText } from '../../core/js/page-language';
import { InheritedValueField } from '../helpers/inherited-value';

const SWITCH_TEXT = {
  en: { on: 'on', off: 'off' },
  ru: { on: 'включено', off: 'выключено' },
};


class SfSwitch extends InheritedValueField(SfBaseElement) {
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
      ariaLabel: { attribute: 'aria-label', default: '' },
      // Whether the switch is on while it holds no value of its own
      // (simai/ui-source#28): `true`/`on` or `false`/`off`.
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
    return this.getAttribute('size') || '1';
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  // A switch inside a field that is already labelled -- a record panel draws the
  // label beside the control -- still needs a name. Like sf-checkbox and
  // sf-button, it comes from the host's aria-label or the ariaLabel prop and
  // lands on the native input, so the label is not printed a second time.
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
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
    this._writeChecked(!!nextValue);
  }

  // With an inherited value, «off» is a value of its own and must be told from
  // «nothing chosen»: it is kept as checked="false", and no `checked` at all
  // means the inherited state applies. Without one, a switch is on or off and
  // nothing else, as it always was.
  _writeChecked(on) {
    if (on) this.setAttribute('checked', '');
    else if (this.hasInheritedValue) this.setAttribute('checked', 'false');
    else this.removeAttribute('checked');
  }

  get inheritedOn() {
    return this.toBoolean(this.inheritedValue, false);
  }

  // The inherited-value seam. The own value is whether `checked` is there at
  // all; the native checkbox is the focus and carries the description.
  inheritedOwnValue() {
    if (!this.hasAttribute('checked')) return '';
    return this.checked ? 'on' : 'off';
  }

  inheritedDisplayValue() {
    return pageText(SWITCH_TEXT, this.inheritedOn ? 'on' : 'off', this);
  }

  inheritedFocusTarget() {
    return this.getInputElement();
  }

  // Back to no value of its own: the knob goes where the inherited value puts
  // it, and the host says change, as a flip does.
  clearOwnValue() {
    this.removeAttribute('checked');
    const input = this.getInputElement();
    if (input) input.checked = this.inheritedOn;
    this.dispatchEvent(new Event('change', { bubbles: true }));
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

    const inherited = this.isInherited;
    return this.createTemplateContext({
      ...props,
      // While the inherited state applies the knob shows it, and the form gets
      // nothing: the checkbox is not named, so it submits no value.
      checked: inherited ? this.inheritedOn : props.checked,
      name: inherited ? '' : props.name,
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
          // While inherited, the knob is where the inherited value puts it.
          checked: this.isInherited ? this.inheritedOn : this.checked,
          disabled: this.disabled,
        });
        input.addEventListener('change', this._handleChange);
        this._releaseReset = bindCheckableReset(this, input);
      }
    }
    this.syncInheritedState();
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

    this._writeChecked(input.checked);
    // The first flip of an inherited switch gives it a value of its own, and the
    // form its name back.
    if (this.hasInheritedValue && this.name && input.name !== this.name) input.name = this.name;
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
      this._writeChecked(this.toBoolean(nextState.checked));
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

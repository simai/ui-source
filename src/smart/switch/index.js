import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { bindSwitch, setSwitchState, unbindSwitch } from '../../component/switch/js/_switch';
import { renderSwitchTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { InheritedValueField } from '../helpers/inherited-value';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// The first component whose element plumbing comes from its component.json
// (standard simai.smart-component 1.3.8 §3, §4): the settings size, label,
// description, help, disabled, name and value are attributes and properties
// made by core/js/element-manifest.js, its words are lang/<locale>.json, its
// dated aliases are aliases.json, and a form gets its value from the host
// through ElementInternals (§17.1). What stays here is behaviour.
const SwitchElement = elementFromManifest(manifest, {
  base: InheritedValueField(SfBaseElement),
  lang: { en, ru },
  source: 'ru',
  aliases,
});

class SfSwitch extends SwitchElement {
  static get props() {
    return {
      ...super.props,
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

  // A switch inside a field that is already labelled -- a record panel draws the
  // label beside the control -- still needs a name. Like sf-checkbox and
  // sf-button, it comes from the host's aria-label or the ariaLabel prop and
  // lands on the native input, so the label is not printed a second time.
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
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
    return this.sfWord(this.inheritedOn ? 'on' : 'off');
  }

  // What the person sees, the inherited state included (§4.3).
  get effectiveChecked() {
    return this.isInherited ? this.inheritedOn : this.checked;
  }

  // While the inherited state applies the form gets nothing (§20.2); a
  // checked switch without `value` submits "on", as a native checkbox does
  // (simai/ui-source#38).
  sfFormValue() {
    if (this.isInherited) return null;
    return super.sfFormValue();
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
    this.sfSyncForm();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  templateContext() {
    const props = this.getPropsContext();

    const inherited = this.isInherited;
    return this.createTemplateContext({
      ...props,
      // While the inherited state applies the knob shows it, and the form gets
      // nothing. The host is the form control where the browser has
      // ElementInternals, so the inner checkbox carries no name (§17.1 item
      // 6); elsewhere the checkbox is named, and not while inherited.
      checked: inherited ? this.inheritedOn : props.checked,
      name: this.sfInternals || inherited ? '' : props.name,
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
    this.sfSyncForm();
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
    if (!this.sfInternals && this.hasInheritedValue && this.name && input.name !== this.name) input.name = this.name;
    this.sfSyncForm();
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

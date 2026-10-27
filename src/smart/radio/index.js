import SfBaseElement from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { bindRadio, setRadioState, unbindRadio } from '../../component/radio/js/_radio';
import { renderRadioTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { FormField } from '../helpers/form-field';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-radio from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §17.1, §17.2). The settings and the value checked are made by
// core/js/element-manifest.js; `error` is a dated alias of `invalid` (§17.2,
// aliases.json). The host is the form control through ElementInternals: a
// checked radio submits its value ("on" without one, as a native radio).
//
// The inner radios still make the group -- one checked at a time, the arrow
// keys move through it -- and a native group is the radios of one name in
// one form owner. So while the host submits, an inner radio is taken out of
// the page's form by a `form` attribute that names no form (§17.1 item 6:
// it joins no form and submits nothing), and its name is the group key: the
// host's form (its id, else its place among the page's forms, read from the
// page and never counted) and the host's name, so two forms on one page that
// use the same name keep two groups.
const RadioElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

// The id the inner radios' form attribute names: no element carries it.
const NO_FORM = 'sf-radio-no-form';

function groupKey(component) {
  if (!component.name) return '';
  const form = component.form;
  if (!form) return `sf-radio:page:${component.name}`;
  const place = form.id || String(Array.prototype.indexOf.call(form.ownerDocument?.forms || [], form));
  return `sf-radio:${place}:${component.name}`;
}

function syncSmartRadioGroup(source) {
  if (!source?.name) return;

  document.querySelectorAll('sf-radio').forEach((component) => {
    const input = component?.getInputElement?.();
    if (!input || input.name !== source.name || input.form !== source.form
      || input.getRootNode() !== source.getRootNode()) return;

    if (input.checked) {
      component.setAttribute('checked', '');
    } else {
      component.removeAttribute('checked');
    }
    component.sfSyncFormState?.();
  });
}

class SfRadio extends FormField(RadioElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: { default: '' },
    };
  }

  constructor() {
    super();
    this._boundRoot = null;
  }

  templateContext() {
    const props = this.getPropsContext();
    const internals = Boolean(this.sfInternals);

    return this.createTemplateContext({
      ...props,
      // Without ElementInternals the named inner radio submits, as before.
      controlName: internals ? groupKey(this) : props.name,
      innerForm: internals ? NO_FORM : '',
      component: this,
    });
  }

  template() {
    return renderRadioTemplate(this.templateContext());
  }

  afterRender() {
    this._releaseReset?.();
    this._releaseReset = null;
    if (this._boundRoot) {
      unbindRadio(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector('.sf-radio-button');
    if (this._boundRoot) {
      bindRadio(this._boundRoot);
      const input = this.getInputElement();
      if (input) {
        setRadioState(input, {
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
      unbindRadio(this._boundRoot);
      this._boundRoot = null;
    }
  }

  // Inside a form the host is reset by the form; its inner radio, out of the
  // form, is put back here: the default is what the markup said (§17.1 item 4).
  formResetCallback() {
    const input = this.getInputElement();
    if (input && this.sfInternals) {
      const checked = Object.prototype.hasOwnProperty.call(this, '_resetChecked') ? this._resetChecked : this.checked;
      input.checked = checked;
      if (checked) this.setAttribute('checked', '');
      else this.removeAttribute('checked');
    }
    super.formResetCallback();
  }

  // A group key follows the form the host is in.
  formAssociatedCallback() {
    if (this.sfInternals) this.requestComponentUpdate?.('form');
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
    syncSmartRadioGroup(input);
  };

  getInputElement() {
    return this.querySelector('.sf-radio-button input[type="radio"]');
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
    if (nextValue) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }

    this.setState({ disabled: !!nextValue });
    return this;
  }

  get state() {
    const input = this.getInputElement();
    return {
      checked: !!input?.checked,
      disabled: !!input?.disabled,
      name: this.name,
      value: this.value,
    };
  }

  setState(nextState = {}) {
    const input = this.getInputElement();
    if (!input) {
      super.setState(nextState);
      return this;
    }

    setRadioState(input, nextState);

    if (Object.prototype.hasOwnProperty.call(nextState, 'checked')) {
      if (this.toBoolean(nextState.checked)) {
        this.setAttribute('checked', '');
      } else {
        this.removeAttribute('checked');
      }
      syncSmartRadioGroup(input);
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'disabled')) {
      if (this.toBoolean(nextState.disabled)) {
        this.setAttribute('disabled', '');
      } else {
        this.removeAttribute('disabled');
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

SfRadio.define('sf-radio');

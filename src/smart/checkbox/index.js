import SfBaseElement, { toBoolean } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { preloadCheckboxIcons, resolveCheckboxIcon } from '../../component/checkbox/js/_checkbox';
import { renderCheckboxTemplate } from './js/templates/default';
import { bindCheckableReset } from '../helpers/checkableReset';
import { CHECKBOX_TEXT_PARTS, linkCheckableText } from '../../component/checkable-text-helper';
import { FormField, innerControlName } from '../helpers/form-field';
import { linkCheckableMessage } from '../helpers/checkable-row';
import { instancePath, partId } from '../../core/js/instance-path.js';
import manifest from './component.json';
import aliases from './aliases.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).

// sf-checkbox from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §17.1, §17.2). The settings and the values checked and
// indeterminate are made by core/js/element-manifest.js; `error` is a dated
// alias of `invalid` (§17.2, aliases.json); the host is the form control
// through ElementInternals, so a checked box submits its value, "on" without
// one, as a native checkbox does (§17.1 item 2), and the inner checkbox
// carries no name.
const CheckboxElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
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
    this._parentWatch = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // The tick and the dash are asked for before the first box draws, with
    // the page's first icons: an unchecked box names no glyph, and its first
    // tick waited for a second icon font.
    preloadCheckboxIcons();
  }

  // The checkboxes a parent stands for (controls, owner decision C165 (2)):
  // the elements its ids name now -- sf-checkbox hosts or plain checkbox
  // inputs -- in the page or the shadow root the parent stands in.
  controlledBoxes() {
    const ids = String(this.getAttribute('controls') || '').split(/\s+/u).filter(Boolean);
    if (!ids.length) return [];
    const root = this.getRootNode?.() || document;
    return ids.map((id) => root.getElementById?.(id) || document.getElementById(id))
      .filter((node) => node && node !== this && (node.localName === 'sf-checkbox' || node.matches?.('input[type="checkbox"]')));
  }

  static boxInput(node) {
    return node.localName === 'sf-checkbox' ? node.querySelector('.sf-checkbox input[type="checkbox"]') : node;
  }

  static boxChecked(node) {
    if (node.localName === 'sf-checkbox') return node.hasAttribute('checked') || Boolean(SfCheckbox.boxInput(node)?.checked);
    return Boolean(node.checked);
  }

  // The parent's own state from its children: all, some, none.
  syncFromControlled() {
    const boxes = this.controlledBoxes();
    if (!boxes.length || this._parentPressing) return;
    const on = boxes.filter((node) => SfCheckbox.boxChecked(node)).length;
    const all = on === boxes.length;
    const some = on > 0 && !all;
    if (this.hasAttribute('checked') !== all || this.hasAttribute('indeterminate') !== some) {
      this.setState({checked: all, indeterminate: some});
    }
    const input = this.getInputElement();
    if (input) input.setAttribute('aria-controls', boxes.map((node) => node.id).join(' '));
  }

  // A press on the parent: all of them checked, or all unchecked when all
  // were; each one that changes says change, as a press of it would.
  pressControlled() {
    const boxes = this.controlledBoxes();
    if (!boxes.length) return;
    // A disabled child is counted in the state and never changed; the press
    // turns on the ones that can change unless all of those are already on.
    const free = boxes.filter((node) => !SfCheckbox.boxInput(node)?.disabled);
    const next = !free.every((node) => SfCheckbox.boxChecked(node));
    this._parentPressing = true;
    try {
      for (const node of boxes) {
        const input = SfCheckbox.boxInput(node);
        if (!input || input.disabled || Boolean(input.checked) === next) continue;
        input.checked = next;
        input.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
    } finally {
      this._parentPressing = false;
    }
    this.syncFromControlled();
  }

  // Watches the children while controls names some: a change event from the
  // page (heard at the document, so a child drawn later counts too) and the
  // checked and indeterminate attributes a property or a page sets.
  watchControlled() {
    this._parentWatch?.();
    this._parentWatch = null;
    if (!this.getAttribute('controls')) return;
    const doc = this.ownerDocument;
    const ids = () => new Set(String(this.getAttribute('controls') || '').split(/\s+/u).filter(Boolean));
    const onChange = (event) => {
      const host = event.target?.closest?.('sf-checkbox') || event.target;
      if (host && ids().has(host.id) && host !== this) this.syncFromControlled();
    };
    doc.addEventListener('change', onChange);
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.target !== this && ids().has(record.target.id))) this.syncFromControlled();
    });
    observer.observe(doc.documentElement, {subtree: true, attributes: true, attributeFilter: ['checked', 'disabled']});
    const late = requestAnimationFrame(() => this.syncFromControlled());
    this._parentWatch = () => {
      doc.removeEventListener('change', onChange);
      observer.disconnect();
      cancelAnimationFrame(late);
    };
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
      // The error line's id (error-message, FO-1): the input is described by it.
      messageId: partId(instancePath(this, { kind: 'sf-checkbox' }), 'error'),
      ariaLabel: this.ariaLabel,
      // The help button is named by its subject («Подробнее: Сохранять черновики»).
      helpLabel: context.help && context.label ? this.sfWord('help', { vars: { label: context.label } }) : '',
    });
  }

  async afterRender() {
    await this.whenChildrenDefined();

    const input = this.getInputElement();
    if (!input) return;

    this.syncInputState(input);
    // The class binding is skipped inside sf-checkbox; the name and the
    // description are linked here the same way.
    linkCheckableText(this.querySelector('.sf-checkbox'), CHECKBOX_TEXT_PARTS);
    linkCheckableMessage(this, input);
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
    // A parent (controls, C165 (2)): its state from its children.
    if (this.getAttribute('controls')) {
      if (!this._parentWatch || this._parentWatchFor !== this.getAttribute('controls')) {
        this._parentWatchFor = this.getAttribute('controls');
        this.watchControlled();
      }
      this.syncFromControlled();
    } else if (this._parentWatch) {
      this._parentWatch();
      this._parentWatch = null;
      this._parentWatchFor = null;
      input.removeAttribute('aria-controls');
    }
  }

  onDisconnected() {
    this._parentWatch?.();
    this._parentWatch = null;
    this._parentWatchFor = null;
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
    // A parent's press is for its children (controls, C165 (2)).
    if (this.getAttribute('controls') && !this._parentPressing) {
      this.pressControlled();
      this.sfSyncFormState();
      return;
    }

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

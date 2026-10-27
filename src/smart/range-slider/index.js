import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import {
  bindRangeSlider,
  getRangeSliderValue,
  setRangeSliderValue,
  unbindRangeSlider,
} from '../../component/range-slider/js/_range_slider';
import { renderRangeSliderTemplate } from './js/templates/default';
import { setLoaderDragState } from '../helpers/loaderDragState';
import { elementFromManifest } from '../../core/js/element-manifest';
import { dispatchAliased } from '../../core/js/aliases';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';


function serializeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '')).join(',');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function firstValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return String(value ?? '').split(',')[0] ?? '';
}

function getValueHandleCount(value) {
  if (Array.isArray(value)) {
    return Math.min(Math.max(value.length, 1), 2);
  }

  const normalized = String(value ?? '');
  if (normalized.includes(',')) {
    return 2;
  }

  return 1;
}

function getSliderHandleCount(root) {
  if (!(root instanceof HTMLElement)) {
    return 0;
  }

  return root.querySelectorAll('.sf-range-slider-handle').length || 0;
}

// sf-range-slider from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8, §16.20): the settings are attributes and properties made by
// core/js/element-manifest.js and its dated aliases are aliases.json -- prefix
// is prefix-text, and the old change names follow change.
const RangeSliderElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

// The class component's events, copied onto the host under their old method
// names. Outside the interface: change is the host's own (sfEmit), and the
// shim sends sf-range-slider-change and onSliderChange after it.
const sliderEventAliases = {
  'sf-range-slider-update': 'onSliderUpdate',
  'sf-range-slider-set': 'onSliderSet',
  'sf-range-slider-start': 'onSliderStart',
  'sf-range-slider-end': 'onSliderEnd',
};

class SfRangeSlider extends RangeSliderElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      // A number or null, read as the manifest's accessor reads it (§4.2).
      step: {
        type: Number,
        default: null,
        parser: (raw, fallback) => (raw !== undefined && raw !== null && String(raw).trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : fallback),
      },
      rootClass: { default: '' },
    };
  }


  constructor() {
    super();
    this._boundRoot = null;
    this._syncingValueAttribute = false;
    this._syncingMultipleAttribute = false;
    this._loaderObserverLocked = false;
    this._autoMultiple = false;
    this._explicitMultiple = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    if (name === 'value' && this._syncingValueAttribute) {
      return;
    }

    if (name === 'multiple' && !this._syncingMultipleAttribute) {
      this._autoMultiple = false;
      this._explicitMultiple =
        newValue === null ? false : this.getBooleanAttr('multiple', true);
    }

    if (name === 'value') {
      this.syncAutoMultipleAttribute(newValue);
    }

    super.attributeChangedCallback(name, oldValue, newValue);
  }

  get step() {
    return this.getProp('step');
  }

  get start() {
    return this.getAttribute('start') || '';
  }

  get value() {
    const sliderValue = this.getValue();
    if (sliderValue !== null && sliderValue !== undefined) {
      return serializeValue(sliderValue);
    }

    return this.getAttribute('value') || this.start || '0';
  }

  set value(nextValue) {
    this.setValue(nextValue);
  }

  get hasExplicitMultiple() {
    return this._explicitMultiple !== null || (this.hasAttribute('multiple') && !this._autoMultiple);
  }

  get multiple() {
    if (this._explicitMultiple !== null) {
      return this._explicitMultiple;
    }

    if (this.hasExplicitMultiple) {
      return this.getBooleanAttr('multiple', false);
    }

    return getValueHandleCount(this.getAttribute('value') || this.start) > 1;
  }

  syncAutoMultipleAttribute(value) {
    if (this.hasExplicitMultiple) {
      return;
    }

    const shouldBeMultiple = getValueHandleCount(value) > 1;
    if (shouldBeMultiple) {
      this._autoMultiple = true;
      if (!this.hasAttribute('multiple')) {
        this._syncingMultipleAttribute = true;
        this.setAttribute('multiple', '');
        this._syncingMultipleAttribute = false;
      }
      return;
    }

    if (this._autoMultiple) {
      this._autoMultiple = false;
      this._syncingMultipleAttribute = true;
      this.removeAttribute('multiple');
      this._syncingMultipleAttribute = false;
    }
  }

  get margin() {
    return this.getAttribute('margin') || '';
  }

  get connect() {
    return this.getAttribute('connect') || '';
  }

  get keyboard() {
    return this.getBooleanAttr('keyboard', true);
  }

  get label() {
    return this.getAttribute('label') || 'none';
  }

  get suffix() {
    return this.getAttribute('suffix') || '';
  }

  get lowerLabel() {
    return this.getAttribute('lower-label') || '';
  }

  get upperLabel() {
    return this.getAttribute('upper-label') || '';
  }

  get decimals() {
    return this.getAttribute('decimals') || '';
  }

  get tooltipPosition() {
    return this.getAttribute('tooltip-position') || '';
  }

  get textPosition() {
    return this.getAttribute('text-position') || '';
  }

  get labelPosition() {
    return this.getAttribute('label-position') || '';
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  set disabled(nextValue) {
    this.setDisabled(!!nextValue);
  }

  get initialValue() {
    return this.getAttribute('value') || this.start || '0';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      rootClass: this.getRootClass(),
      multiple: this.multiple,
      start: this.initialValue,
    });
  }

  template() {
    return renderRangeSliderTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    if (!this.getSliderRoot()) {
      return 'lit';
    }

    if (
      changedAttributes.includes('value') &&
      this.shouldRebuildForValue(this.getAttribute('value') || this.start || '0')
    ) {
      return 'lit';
    }

    const requiresRerender = changedAttributes.some((name) =>
      [
        'template',
        'connected',
        'min',
        'max',
        'start',
        'multiple',
        'step',
        'margin',
        'connect',
        'keyboard',
        'label',
        'prefix-text',
        'suffix',
        'lower-label',
        'upper-label',
        'decimals',
        'tooltip-position',
        'text-position',
        'label-position',
        'root-class',
        // Disabled is drawn by the template from the setting (§5.3), not
        // toggled on the root by a script.
        'disabled',
      ].includes(name),
    );

    return requiresRerender ? 'lit' : 'dom';
  }

  updateDom(changedAttributes = []) {
    const root = this.getSliderRoot();
    if (!(root instanceof HTMLElement)) {
      return false;
    }

    if (changedAttributes.includes('style') || changedAttributes.includes('root-style')) {
      const style = this.getRootStyle();
      if (style) root.setAttribute('style', style);
      else root.removeAttribute('style');
    }

    if (
      changedAttributes.includes('value') &&
      this.shouldRebuildForValue(this.getAttribute('value') || this.start || '0')
    ) {
      return false;
    }

    if (changedAttributes.includes('value')) {
      setRangeSliderValue(root, this.getAttribute('value') || this.start || '0');
    }

    return true;
  }

  afterRender() {
    if (this._boundRoot) {
      this.removeSliderListeners(this._boundRoot);
      unbindRangeSlider(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.getSliderRoot();
    if (this._boundRoot) {
      bindRangeSlider(this._boundRoot, this);
      this.addSliderListeners(this._boundRoot);

      if (this.disabled && this._boundRoot.noUiSlider) {
        this._boundRoot.noUiSlider.disable();
      }
    }
  }

  onDisconnected() {
    if (this._boundRoot) {
      this.removeSliderListeners(this._boundRoot);
      unbindRangeSlider(this._boundRoot);
      this._boundRoot = null;
    }

    this.unlockLoaderObserver();
  }

  addSliderListeners(root) {
    root.addEventListener('sf-range-slider-update', this._handleSliderUpdate);
    root.addEventListener('sf-range-slider-start', this._handleSliderStart);
    root.addEventListener('sf-range-slider-end', this._handleSliderEnd);
    root.addEventListener('sf-range-slider-set', this._handleSliderEnd);
    root.addEventListener('sf-range-slider-change', this._handleSliderEnd);
    root.addEventListener('sf-range-slider-change', this._handleInnerChange);
    root.addEventListener('change', this._handleInnerChange);

    Object.keys(sliderEventAliases).forEach((eventName) => {
      root.addEventListener(eventName, this._handleSliderAlias);
    });
  }

  removeSliderListeners(root) {
    root.removeEventListener('sf-range-slider-update', this._handleSliderUpdate);
    root.removeEventListener('sf-range-slider-start', this._handleSliderStart);
    root.removeEventListener('sf-range-slider-end', this._handleSliderEnd);
    root.removeEventListener('sf-range-slider-set', this._handleSliderEnd);
    root.removeEventListener('sf-range-slider-change', this._handleSliderEnd);
    root.removeEventListener('sf-range-slider-change', this._handleInnerChange);
    root.removeEventListener('change', this._handleInnerChange);

    Object.keys(sliderEventAliases).forEach((eventName) => {
      root.removeEventListener(eventName, this._handleSliderAlias);
    });

    this.unlockLoaderObserver();
  }

  lockLoaderObserver() {
    if (this._loaderObserverLocked) {
      return;
    }

    this._loaderObserverLocked = true;
    setLoaderDragState(true);
  }

  unlockLoaderObserver() {
    if (!this._loaderObserverLocked) {
      return;
    }

    this._loaderObserverLocked = false;
    setLoaderDragState(false);
  }

  _handleSliderStart = () => {
    this.lockLoaderObserver();
  };

  _handleSliderEnd = () => {
    this.unlockLoaderObserver();
  };

  _handleSliderUpdate = (event) => {
    const values = event.detail?.values;
    if (!values?.length) {
      return;
    }

    const serialized = serializeValue(this.multiple ? values : values[0]);

    if ((this.getAttribute('value') || '') === serialized) {
      return;
    }

    this._syncingValueAttribute = true;
    this.setAttribute('value', serialized);
    this._syncingValueAttribute = false;
  };

  // The class component's change and sf-range-slider-change stop at the
  // host: a person's change leaves it once, as the host's own event, without
  // the element in its detail (§8), and the shim sends the old names after it
  // with the same detail (aliases.json). A value set from code sends nothing.
  _handleInnerChange = (event) => {
    event.stopPropagation();
    if (event.type !== 'change' || event.target !== this.getSliderRoot()) return;
    const {values, value, handleCount, handle} = event.detail || {};
    // change keeps its native name (§8, §17.3); sfEmit would derive
    // sf-range-slider-change from a verb that carries a detail.
    dispatchAliased(this, 'change', { detail: { values, value, handleCount, handle } });
  };

  _handleSliderAlias = (event) => {
    const alias = sliderEventAliases[event.type];
    if (!alias) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent(alias, {
        bubbles: true,
        composed: true,
        detail: {
          ...(event.detail || {}),
          sourceEvent: event,
          rangeSlider: this,
        },
      }),
    );
  };

  getSliderRoot() {
    return this.querySelector('.sf-range-slider');
  }

  shouldRebuildForValue(value) {
    const root = this.getSliderRoot();
    const currentCount = getSliderHandleCount(root);
    const nextCount =
      this.multiple || (!this.hasExplicitMultiple && getValueHandleCount(value) > 1)
        ? 2
        : 1;

    return currentCount > 0 && currentCount !== nextCount;
  }

  getValue() {
    const root = this.getSliderRoot();
    return root ? getRangeSliderValue(root) : null;
  }

  setValue(nextValue) {
    const nextMultiple =
      this.hasExplicitMultiple ? this.multiple : getValueHandleCount(nextValue) > 1;
    const serialized = serializeValue(nextMultiple ? nextValue : firstValue(nextValue));
    const root = this.getSliderRoot();

    if (!this.hasExplicitMultiple) {
      if (nextMultiple) {
        this._autoMultiple = true;
        this._syncingMultipleAttribute = true;
        this.setAttribute('multiple', '');
        this._syncingMultipleAttribute = false;
      } else if (this._autoMultiple) {
        this._autoMultiple = false;
        this._syncingMultipleAttribute = true;
        this.removeAttribute('multiple');
        this._syncingMultipleAttribute = false;
      }
    }

    // The old reflected value can still imply multiple=true until the next
    // render. Decide from this request, not from that stale attribute.
    const currentCount = getSliderHandleCount(root);
    if (currentCount > 0 && currentCount !== (nextMultiple ? 2 : 1)) {
      this.setAttribute('value', serialized);
      return this;
    }

    if (root?.noUiSlider) {
      setRangeSliderValue(root, serialized);
      this._syncingValueAttribute = true;
      // Reflect the value actually admitted by range/step/margin constraints.
      this.setAttribute('value', serializeValue(getRangeSliderValue(root)));
      this._syncingValueAttribute = false;
      return this;
    }

    this.setAttribute('value', serialized);
    return this;
  }

  setDisabled(nextValue = false) {
    if (nextValue) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }

    this.requestComponentUpdate('disabled');
    return this;
  }

  get state() {
    return {
      min: this.min,
      max: this.max,
      start: this.start,
      value: this.value,
      multiple: this.multiple,
      step: this.step,
      margin: this.margin,
      connect: this.connect,
      keyboard: this.keyboard,
      label: this.label,
      prefixText: this.prefixText,
      suffix: this.suffix,
      lowerLabel: this.lowerLabel,
      upperLabel: this.upperLabel,
      decimals: this.decimals,
      tooltipPosition: this.tooltipPosition,
      textPosition: this.textPosition,
      labelPosition: this.labelPosition,
      disabled: this.disabled,
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      if (key === 'value') {
        this.setValue(value);
        return;
      }

      if (key === 'multiple') {
        this._autoMultiple = false;
        this._explicitMultiple = !!value;
        if (value) {
          this.setAttribute('multiple', '');
        } else {
          this.setAttribute('multiple', 'false');
        }
        return;
      }

      if (key === 'disabled') {
        this.setDisabled(!!value);
        return;
      }

      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      if (value === false || value === null || value === undefined || value === '') {
        this.removeAttribute(attr);
        return;
      }

      if (value === true) {
        this.setAttribute(attr, '');
        return;
      }

      this.setAttribute(attr, String(value));
    });

    return this;
  }

  onUpdateValue(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-range-slider-update', (event) => {
        handler(event.detail?.value, event.detail, event);
      }, options);
    }

    return this;
  }

  onSliderUpdate(handler, options) {
    return this.onUpdateValue(handler, options);
  }

  // Binds change, the canonical name; it bound the legacy sf-range-slider-change,
  // which is emitted with the same detail but is the one to be retired.
  onChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('change', (event) => {
        if (!event.detail || !('value' in event.detail)) return;
        handler(event.detail?.value, event.detail, event);
      }, options);
    }

    return this;
  }

  onSliderChange(handler, options) {
    return this.onChange(handler, options);
  }

  onSet(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-range-slider-set', (event) => {
        handler(event.detail?.value, event.detail, event);
      }, options);
    }

    return this;
  }

  onSliderSet(handler, options) {
    return this.onSet(handler, options);
  }

  onStart(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-range-slider-start', (event) => {
        handler(event.detail?.value, event.detail, event);
      }, options);
    }

    return this;
  }

  onSliderStart(handler, options) {
    return this.onStart(handler, options);
  }

  onEnd(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-range-slider-end', (event) => {
        handler(event.detail?.value, event.detail, event);
      }, options);
    }

    return this;
  }

  onSliderEnd(handler, options) {
    return this.onEnd(handler, options);
  }
}

SfRangeSlider.define('sf-range-slider');

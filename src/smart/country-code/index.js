import countriesData from '../../component/country-code/data/countries.json';
import { pageLanguage } from '../../core/js/page-language';
import {
  bindCountryCode,
  normalizeCountriesList,
  normalizeIso2,
  resolveDefaultFlagBase,
  setCountryCodeState,
  unbindCountryCode,
} from '../../component/country-code/js/_country_code';
import SfBaseElement from '../../core/js/smart-base';
import { fieldSize } from '../../component/field-size';
import { renderCountryCodeTemplate } from './js/templates/default';

const COUNTRY_CODE_SELECTOR = '.sf-country-code';
const COUNTRY_ITEMS = Array.isArray(countriesData?.items) ? countriesData.items : [];

class SfCountryCode extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      label: { default: '' },
      required: { type: Boolean, default: false },
      name: { default: '' },
      form: { default: '' },
      hint: { default: '' },
      value: { default: '' },
      placeholder: { default: '+7(___)___-__-__' },
      disabled: { type: Boolean, default: false },
      open: { type: Boolean, default: false },
      locale: { default: '' },
      useMask: { type: Boolean, default: false },
      useCountryMasks: { type: Boolean, default: true },
      showCode: { type: Boolean, default: true },
      maskStyle: { default: 'native' },
      multiCountry: { type: Boolean, default: true },
      iso2: { default: '' },
      dialCode: { default: '' },
      maskPattern: { default: '' },
      flagBase: { default: '' },
      lazyFlags: { type: Boolean, default: true },
      showMaskPlaceholder: { type: Boolean, default: false },
      maskPlaceholderChar: { default: '_' },
      maxItems: { type: Number, default: 0 },
    };
  }


  constructor() {
    super();
    this._countries = null;
    this._boundRoot = null;
    this._renderAttributes = new Set();
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-country-code');
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get required() {
    return this.getBooleanAttr('required', false);
  }

  get hint() {
    return this.getAttribute('hint') || '';
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '+7(___)___-__-__';
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get open() {
    return this.getBooleanAttr('open', false) || this.getBooleanAttr('active', false);
  }

  get locale() {
    // The country names and the field's own words follow the page unless a
    // locale is given: Russian on a Russian page, English otherwise.
    return String(this.getAttribute('locale') || pageLanguage(this)).toLowerCase() === 'ru'
      ? 'ru'
      : 'en';
  }

  get useMask() {
    return this.getBooleanAttr('use-mask', false);
  }

  get useCountryMasks() {
    return this.getBooleanAttr('use-country-masks', true);
  }

  get showCode() {
    return this.getBooleanAttr('show-code', true);
  }

  get maskStyle() {
    return String(this.getAttribute('mask-style') || 'native').toLowerCase() === 'brackets'
      ? 'brackets'
      : 'native';
  }

  get multiCountry() {
    return this.getBooleanAttr('multi-country', true);
  }

  get iso2() {
    return normalizeIso2(this.getAttribute('iso2'));
  }

  get dialCode() {
    return String(this.getAttribute('dial-code') || '').trim();
  }

  get maskPattern() {
    return String(this.getAttribute('mask-pattern') || '').trim();
  }

  get flagBase() {
    return String(this.getAttribute('flag-base') || '').trim() || resolveDefaultFlagBase();
  }

  get lazyFlags() {
    return this.getBooleanAttr('lazy-flags', true);
  }

  get showMaskPlaceholder() {
    return this.getBooleanAttr('show-mask-placeholder', false);
  }

  get maskPlaceholderChar() {
    return String(this.getAttribute('mask-placeholder-char') || '_');
  }

  get maxItems() {
    return Math.trunc(this.getNumberAttr('max-items', 0));
  }

  get countries() {
    return normalizeCountriesList(this._countries, this.locale, this.maxItems);
  }

  set countries(value) {
    this._countries = Array.isArray(value) ? value : null;
    this.requestComponentUpdate('countries');
  }

  templateContext() {
    const props = this.getPropsContext();
    const root = this._boundRoot;
    const preserveOpen = root && !this._renderAttributes.has('open') && !this._renderAttributes.has('active');
    const preserveDisabled = root && !this._renderAttributes.has('disabled');

    return this.createTemplateContext({
      ...props,
      open: preserveOpen ? root.classList.contains('open') : this.open,
      disabled: preserveDisabled ? !!root.querySelector('input')?.disabled || root.classList.contains('disabled') : this.disabled,
      countries: this.countries.length
        ? this.countries
        : normalizeCountriesList(COUNTRY_ITEMS, this.locale, this.maxItems),
      locale: this.locale,
      maskStyle: this.maskStyle,
      iso2: this.iso2,
      flagBase: this.flagBase,
      maxItems: this.maxItems,
    });
  }

  onDisconnected() {
    if (this._boundRoot) {
      unbindCountryCode(this._boundRoot);
      this._boundRoot = null;
    }
  }

  beforeRender(changedAttributes = []) {
    this._renderAttributes = new Set(changedAttributes);
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    if (this._boundRoot) {
      unbindCountryCode(this._boundRoot);
      this._boundRoot = null;
    }

    this._boundRoot = this.querySelector(COUNTRY_CODE_SELECTOR);
    if (this._boundRoot) {
      bindCountryCode(this._boundRoot, {
        resetCountry: this._renderAttributes.has('iso2') || this._renderAttributes.has('dial-code'),
        countries: this.countries,
        maskPattern: this.maskPattern,
      });
    }
  }

  template() {
    return renderCountryCodeTemplate(this.templateContext());
  }

  get state() {
    const root = this.querySelector(COUNTRY_CODE_SELECTOR);
    const input = root?.querySelector?.('.sf-country-code-field input') || null;
    return {
      value: input?.value || '',
      iso2: root?.dataset?.iso2 || '',
      dialCode: root?.dataset?.dialCode || '',
      open: root?.classList?.contains('open') || false,
      disabled: root?.classList?.contains('disabled') || false,
    };
  }

  setState(nextState = {}) {
    const root = this.querySelector(COUNTRY_CODE_SELECTOR);
    return setCountryCodeState(root, nextState);
  }
}

SfCountryCode.define('sf-country-code');

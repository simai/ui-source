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
import { elementFromManifest } from '../../core/js/element-manifest';
import { fieldSize } from '../../component/field-size';
import { FormField } from '../helpers/form-field';
import { renderCountryCodeTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-country-code from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §11, §16.20, §17.1): the settings are attributes and properties
// made by core/js/element-manifest.js, the words are lang/<locale>.json and the
// host is the form control through ElementInternals. What stays here is
// behaviour: the countries, the mask and the list, drawn by the class script.
const CountryCodeElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

const COUNTRY_CODE_SELECTOR = '.sf-country-code';
const COUNTRY_ITEMS = Array.isArray(countriesData?.items) ? countriesData.items : [];

class SfCountryCode extends FormField(CountryCodeElement) {
  static get props() {
    return {
      ...super.props,
      ariaLabel: { attribute: 'aria-label', default: '' },
    };
  }


  constructor() {
    super();
    this._countries = null;
    this._boundRoot = null;
    this._renderAttributes = new Set();
    // The tel text is the value the form gets: every keystroke and every
    // country chosen tells the form (§17.1).
    this.addEventListener('input', () => this.fieldSyncForm());
    this.addEventListener('change', () => this.fieldSyncForm());
  }

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-country-code');
  }

  // A telephone inside a field that is already labelled -- a record panel draws
  // the label -- gets its name from the host instead of printing the label a
  // second time above the control.
  get ariaLabel() {
    return this.getProp('ariaLabel') || '';
  }

  // The current value is what the person typed (§4.3); the attribute is the
  // default, which a form reset returns to.
  get value() {
    const input = this._telInput();
    return input ? String(input.value ?? '') : this.getAttribute('value') || '';
  }

  set value(next) {
    const text = next === null || next === undefined ? '' : String(next);
    if (text) this.setAttribute('value', text);
    else this.removeAttribute('value');
    const input = this._telInput();
    if (input && input.value !== text) input.value = text;
    this.fieldSyncForm();
  }

  _telInput() {
    return this.querySelector(':scope .sf-country-code-field input') || null;
  }

  // What the form gets (§17.1): the tel text as the person sees it, nothing
  // while disabled.
  sfFormValue() {
    if (this.disabled) return null;
    return this.value;
  }

  // §17.2: a required phone has digits after the dial code; the dial code
  // alone is no number.
  fieldValidity() {
    const input = this._telInput();
    const text = this.value.trim();
    const dial = String(this.querySelector(':scope .sf-country-code')?.dataset?.dialCode || '').trim();
    const local = this.showCode && dial && text.startsWith(dial) ? text.slice(dial.length) : text;
    return {
      valueMissing: this.required && !this.disabled && !/\d/u.test(local),
      message: this.sfWord('value-missing'),
      anchor: input,
    };
  }

  // form.reset(): the class script puts the default text and country back
  // after the browser does; the form is told once it has.
  fieldReset() {
    setTimeout(() => this.fieldSyncForm(), 0);
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
      // The host is the form control where the browser has ElementInternals,
      // so the inner tel input carries no name (§17.1 item 6); elsewhere it is
      // named and joins the form the host names, as before.
      controlName: this.sfInternals ? '' : this.name,
      controlForm: this.sfInternals ? '' : this.getAttribute('form') || '',
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
    this.fieldSyncForm();
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

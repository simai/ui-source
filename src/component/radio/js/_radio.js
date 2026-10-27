import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { bindFormReset } from '../../form-reset-helper';
import radioUtility from '../json/radio.utility.json';

const RADIO_SELECTOR = 'label.sf-radio-button';
const RADIO_BOUND_FLAG = 'sfRadioBound';
const RADIO_FONT_WRAP_SELECTOR = '.sf-radio-wrap--type-font';
const RADIO_INTERNAL_ATTRS = new Set([
  'class',
  'className',
  'type',
  'count',
  'text',
  'title',
  'description',
  'help',
  'checked',
  'disabled',
]);

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on', 'checked', 'disabled'].includes(normalized);
}

function toNumber(value, defaultValue = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : defaultValue;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return [];
    }

    if (
      (normalized.startsWith('[') && normalized.endsWith(']')) ||
      (normalized.startsWith('{') && normalized.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(normalized);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return normalized
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return normalized
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
}

function getRadioNodes(root) {
  if (!root) return {};
  const input = root.querySelector('input[type="radio"]');
  const mark = root.querySelector('.sf-radio-button-box .sf-radio-button-mark');
  return { input, mark };
}

function getRadioGroupRoots(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'radio' || !input.name) {
    return [];
  }

  return Array.from(input.getRootNode().querySelectorAll(`${RADIO_SELECTOR} input[type="radio"]`))
    .filter((node) => node.name === input.name && node.form === input.form)
    .map((node) => node.closest(RADIO_SELECTOR))
    .filter(Boolean);
}

function syncRadioState(root) {
  const { input, mark } = getRadioNodes(root);
  if (!input) return;

  root.classList.toggle('active', !!input.checked);
  root.classList.toggle('disabled', !!input.disabled);

  if (mark) {
    mark.setAttribute('aria-hidden', 'true');
  }
}

function syncFontRadioWrap(input) {
  const wrap = input?.closest?.(RADIO_FONT_WRAP_SELECTOR);
  if (!wrap) return;

  const descriptions = toArray(wrap.dataset.sfRadioDescriptions || '');
  const descriptionNode = wrap.querySelector('.sf-radio-button-description');
  const checkedInput = wrap.querySelector(`${RADIO_SELECTOR} input[type="radio"]:checked`);
  const checkedIndex = toNumber(checkedInput?.dataset?.sfRadioFontIndex, -1);

  wrap
    .querySelectorAll('.sf-radio-text')
    .forEach((node, index) => node.classList.toggle('active', index === checkedIndex));

  if (!descriptionNode) return;

  if (checkedIndex >= 0 && checkedIndex < descriptions.length) {
    descriptionNode.textContent = descriptions[checkedIndex] || '';
    return;
  }

  descriptionNode.textContent = descriptions[0] || wrap.dataset.sfRadioDescription || '';
}

function refreshRadioGroup(input) {
  const roots = getRadioGroupRoots(input);
  if (!roots.length) {
    const root = input?.closest?.(RADIO_SELECTOR);
    if (root) {
      syncRadioState(root);
    }
    syncFontRadioWrap(input);
    return;
  }

  roots.forEach((root) => syncRadioState(root));
  syncFontRadioWrap(input);
}

function bindRadio(root) {
  if (!root || root.dataset[RADIO_BOUND_FLAG] === '1') return;
  const { input } = getRadioNodes(root);
  if (!input) return;

  const handleChange = () => refreshRadioGroup(input);
  root.__sfRadioHandleChange = handleChange;
  input.addEventListener('change', handleChange);
  root.__sfRadioReleaseReset = bindFormReset(input, handleChange);

  root.dataset[RADIO_BOUND_FLAG] = '1';
  syncRadioState(root);
}

function unbindRadio(root) {
  if (!root) return;
  root.__sfRadioReleaseReset?.();
  delete root.__sfRadioReleaseReset;
  const { input } = getRadioNodes(root);
  if (input && root.__sfRadioHandleChange) {
    input.removeEventListener('change', root.__sfRadioHandleChange);
  }
  delete root.__sfRadioHandleChange;
  delete root.dataset[RADIO_BOUND_FLAG];
}

function initRadioTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(RADIO_SELECTOR)) {
    bindRadio(target);
  }

  target.querySelectorAll?.(RADIO_SELECTOR).forEach(bindRadio);
}

function setRadioState(input, state = {}) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'radio') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'checked')) {
    input.checked = toBoolean(state.checked);
  }

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    input.disabled = toBoolean(state.disabled);
  }

  refreshRadioGroup(input);
  return true;
}

function initExistingRadios(target = document) {
  initRadioTree(target);
}

function hideNativeRadioInput(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'radio') {
    return input;
  }

  // A class, not inline styles: an inline style outranks every stylesheet, so a
  // page could not bring the native input back (or style it) at all.
  input.classList.add('sf-radio-native');

  return input;
}

class Radio extends ComponentObserver {
  static componentName = 'Radio';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1',
      type = 'default',
      count = 0,
      text = '',
      title = '',
      description = '',
      help = '',
      checked = false,
      disabled = false,
      name = '',
      value,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;

    this.type = type || 'default';
    this.template =
      this.type === 'font'
        ? this.buildFontTemplate({
            size,
            count,
            text,
            title,
            description,
            help,
            checked,
            disabled,
            name,
            value,
            className,
          })
        : document.createElement('label');

    if (this.id) {
      this.template.id = this.id;
    }

    if (this.type === 'font') {
      return;
    }

    this.template.classList.add(
      'sf-radio-button',
      `sf-radio-button--size-${size}`,
      `sf-radio-button--type-${type || 'default'}`,
    );
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    this.box = document.createElement('span');
    this.box.classList.add('sf-radio-button-box');

    this.input = document.createElement('input');
    this.input.type = 'radio';
    if (name) {
      this.input.name = name;
    }
    if (value !== undefined) {
      this.input.value = value;
    }
    this.input.checked =
      this.type === 'font'
        ? this.previewCheckedIndex >= 0 || toBoolean(checked)
        : toBoolean(checked);
    this.input.defaultChecked = this.input.checked;
    this.input.disabled = toBoolean(disabled);
    hideNativeRadioInput(this.input);

    Object.entries(this.attrs)
      .filter(([attr]) => !RADIO_INTERNAL_ATTRS.has(attr))
      .forEach(([attr, attrValue]) => {
        if (attrValue === undefined || attrValue === null) return;
        this.input.setAttribute(attr, attrValue);
      });

    if (this.type === 'font') {
      this.box.classList.add('sf-radio-button-box--font');
      this.box.append(this.input, this.createFontPreview());
    } else {
      this.mark = document.createElement('span');
      this.mark.classList.add('sf-radio-button-mark');
      this.mark.setAttribute('aria-hidden', 'true');
      this.box.append(this.input, this.mark);
    }

    this.template.append(this.box);

    const descriptionText =
      this.type === 'font'
        ? this.getSelectedDescription(description)
        : description;

    if (title || descriptionText || help) {
      this.container = document.createElement('span');
      this.container.classList.add('sf-radio-button-container');

      if (title || help) {
        this.top = document.createElement('span');
        this.top.classList.add('sf-radio-button-top');

        if (title) {
          this.text = document.createElement('span');
          this.text.classList.add('sf-radio-button-text');
          this.text.textContent = title;
          this.top.append(this.text);
        }

        if (help) {
          this.helpIcon = document.createElement('i');
          this.helpIcon.classList.add('sf-icon');
          this.helpIcon.setAttribute('aria-hidden', 'true');
          this.helpIcon.textContent = help;
          this.top.append(this.helpIcon);
        }

        this.container.append(this.top);
      }

      if (descriptionText) {
        this.description = document.createElement('span');
        this.description.classList.add('sf-radio-button-description');
        this.description.textContent = descriptionText;
        this.container.append(this.description);
      }

      this.template.append(this.container);
    }

    // The layout lives in utility hints (the stylesheet draws no display):
    // without these classes the ring was an inline span 2px wide and the
    // selected mark 0px (simai/ui-source#50). Optional parts are skipped by
    // the helper.
    this.applyLayoutUtilities(this.template, '.sf-radio-button');
    this.applyLayoutUtilities(this.box, '.sf-radio-button .sf-radio-button-box');
    this.applyLayoutUtilities(this.container, '.sf-radio-button .sf-radio-button-container');
    this.applyLayoutUtilities(this.top, '.sf-radio-button .sf-radio-button-top');
    this.applyLayoutUtilities(this.text, '.sf-radio-button .sf-radio-button-text');
  }

  init() {
    initRadioTree(this.template);
  }

  destroyInternal() {
    if (!this.template) return;
    if (this.template.matches?.(RADIO_SELECTOR)) {
      unbindRadio(this.template);
      return;
    }

    this.template.querySelectorAll?.(RADIO_SELECTOR).forEach(unbindRadio);
  }

  resolveCheckedIndex(checked, count) {
    const total = Math.max(0, toNumber(count, 0));

    if (typeof checked === 'number' || (typeof checked === 'string' && checked !== '')) {
      const index = Math.floor(toNumber(checked, -1));
      return index >= 0 && index < total ? index : -1;
    }

    return toBoolean(checked, false) ? 0 : -1;
  }

  buildFontTemplate({
    size = '1',
    count = 1,
    text = 'A',
    title = '',
    description = '',
    help = '',
    checked = false,
    disabled = false,
    name = '',
    value,
    className = '',
  } = {}) {
    const wrap = document.createElement('div');
    const total = Math.max(1, toNumber(count, 1));
    const checkedIndex = this.resolveCheckedIndex(checked, total);
    const descriptions = toArray(description);
    const values = toArray(value);

    wrap.classList.add(
      'sf-radio-button',
      'sf-radio-wrap--type-font',
      'flex',
      `sf-radio-button--size-${size}`,
    );

    if (className) {
      wrap.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    wrap.dataset.sfRadioDescriptions = JSON.stringify(descriptions);
    wrap.dataset.sfRadioDescription =
      (checkedIndex >= 0 ? descriptions[checkedIndex] : descriptions[0]) || '';

    const group = document.createElement('div');
    group.classList.add('sf-radio-group', 'sf-radio-group--font', 'flex', 'items-cross-start');

    for (let index = 0; index < total; index += 1) {
      const option = document.createElement('label');
      option.classList.add(
        'sf-radio-button',
        `sf-radio-button--size-${size}`,
        'sf-radio-button--type-font',
      );

      const icon = document.createElement('i');
      icon.classList.add('sf-radio-text');
      if (index === checkedIndex) {
        icon.classList.add('active');
      }
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = text || 'A';

      const input = document.createElement('input');
      input.type = 'radio';
      input.dataset.sfRadioFontIndex = String(index);
      if (name) {
        input.name = name;
      }
      if (values[index] !== undefined) {
        input.value = String(values[index]);
      } else if (value !== undefined && !Array.isArray(value)) {
        input.value = String(value);
      } else {
        input.value = String(index);
      }
      input.checked = index === checkedIndex;
      input.defaultChecked = input.checked;
      input.disabled = toBoolean(disabled);
      const optionLabel =
        descriptions[index] ||
        (values[index] !== undefined ? String(values[index]) : `${title || text || 'Radio'} ${index + 1}`);
      input.setAttribute('aria-label', optionLabel);
      hideNativeRadioInput(input);

      Object.entries(this.attrs)
        .filter(([attr]) => !RADIO_INTERNAL_ATTRS.has(attr))
        .forEach(([attr, attrValue]) => {
          if (attrValue === undefined || attrValue === null) return;
          input.setAttribute(attr, attrValue);
        });

      option.append(icon, input);
      group.append(option);
    }

    const container = document.createElement('div');
    container.classList.add('sf-radio-button-container', 'flex', 'flex-col');

    if (title || help) {
      const top = document.createElement('span');
      top.classList.add('sf-radio-button-top', 'flex');

      if (title) {
        const textNode = document.createElement('span');
        textNode.classList.add('sf-radio-button-text');
        textNode.textContent = title;
        top.append(textNode);
      }

      if (help) {
        const helpIcon = document.createElement('i');
        helpIcon.classList.add('sf-icon');
        helpIcon.setAttribute('aria-hidden', 'true');
        helpIcon.textContent = help;
        top.append(helpIcon);
      }

      container.append(top);
    }

    const descriptionText =
      (checkedIndex >= 0 ? descriptions[checkedIndex] : descriptions[0]) || '';


    if (descriptionText) {
      const descriptionNode = document.createElement('span');
      descriptionNode.classList.add('sf-radio-button-description');
      descriptionNode.textContent = descriptionText;
      container.append(descriptionNode);
    }
    wrap.append(group, container);

    return wrap;
  }
}

Radio.utilityMap = radioUtility;

registerComponent('Radio', Radio);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Radio = window.SF.Radio || {};
  window.SF.Radio.setState = setRadioState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingRadios());
} else {
  initExistingRadios();
}

const radioObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initRadioTree(node);
    });
  });
});

radioObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindRadio, setRadioState, syncRadioState, unbindRadio };

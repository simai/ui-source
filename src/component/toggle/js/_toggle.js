import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { bindFormReset } from '../../form-reset-helper';

const TOGGLE_SELECTOR = 'label.sf-toggle';
const TOGGLE_BOUND_FLAG = 'sfToggleBound';

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'checked', 'disabled'].includes(String(value).toLowerCase());
}

function getToggleNodes(root) {
  if (!(root instanceof HTMLElement)) {
    return {};
  }

  return {
    input: root.querySelector('input[type="checkbox"]'),
    control: root.querySelector('.sf-toggle-control'),
    container: root.querySelector('.sf-toggle-container'),
  };
}

function syncToggleState(root) {
  const { input, container } = getToggleNodes(root);
  if (!input) return;

  const isChecked = !!input.checked;
  const isDisabled = !!input.disabled;

  root.classList.toggle('active', isChecked);
  root.classList.toggle('disabled', isDisabled);

  if (container) {
    container.classList.toggle('content-main-start', !isChecked);
    container.classList.toggle('content-main-end', isChecked);
  }
}

function bindToggle(root) {
  if (!(root instanceof HTMLElement) || root.dataset[TOGGLE_BOUND_FLAG] === '1') return;
  const { input } = getToggleNodes(root);
  if (!(input instanceof HTMLInputElement)) return;

  const handleChange = () => syncToggleState(root);
  root.__sfToggleHandleChange = handleChange;
  input.addEventListener('change', handleChange);
  root.__sfToggleReleaseReset = bindFormReset(input, handleChange);

  root.dataset[TOGGLE_BOUND_FLAG] = '1';
  syncToggleState(root);
}

function unbindToggle(root) {
  if (!(root instanceof HTMLElement)) return;
  root.__sfToggleReleaseReset?.();
  delete root.__sfToggleReleaseReset;
  const { input } = getToggleNodes(root);
  if (input && root.__sfToggleHandleChange) {
    input.removeEventListener('change', root.__sfToggleHandleChange);
  }

  delete root.__sfToggleHandleChange;
  delete root.dataset[TOGGLE_BOUND_FLAG];
}

function initToggleTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(TOGGLE_SELECTOR)) {
    bindToggle(target);
  }

  target.querySelectorAll?.(TOGGLE_SELECTOR).forEach(bindToggle);
}

function initExistingToggles(target = document) {
  initToggleTree(target);
}

function setToggleState(input, state = {}) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'checked')) {
    input.checked = toBoolean(state.checked);
  }

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    input.disabled = toBoolean(state.disabled);
  }

  const root = input.closest(TOGGLE_SELECTOR);
  if (root) {
    syncToggleState(root);
  }

  return true;
}

function buildSimpleToggle(template, options) {
  const { checked, disabled, name, value } = options;
  const control = document.createElement('span');
  control.className = 'sf-toggle-control';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = checked;
  input.defaultChecked = input.checked;
  input.disabled = disabled;
  if (name) input.name = name;
  if (value !== undefined) input.value = value;

  const container = document.createElement('span');
  container.className = 'sf-toggle-container transition flex items-center content-main-start';

  const innerWrap = document.createElement('span');
  innerWrap.className = 'sf-toggle-inner-wrap transition flex items-center content-main-center';

  const inner = document.createElement('span');
  inner.className = 'sf-toggle-inner transition';
  inner.setAttribute('aria-hidden', 'true');

  innerWrap.append(inner);
  container.append(innerWrap);
  control.append(input, container);
  template.append(control);
}

function buildIconToggle(template, options) {
  const { checked, disabled, name, value, icon } = options;
  const control = document.createElement('span');
  control.className = 'sf-toggle-control';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = checked;
  input.defaultChecked = input.checked;
  input.disabled = disabled;
  if (name) input.name = name;
  if (value !== undefined) input.value = value;

  const container = document.createElement('span');
  container.className = 'sf-toggle-container transition flex items-center content-main-start';

  const innerWrap = document.createElement('span');
  innerWrap.className = 'sf-toggle-inner-wrap transition flex items-center content-main-center';

  const iconNode = document.createElement('i');
  iconNode.className = 'sf-icon';
  iconNode.setAttribute('aria-hidden', 'true');
  iconNode.textContent = icon || 'check';

  innerWrap.append(iconNode);
  container.append(innerWrap);
  control.append(input, container);
  template.append(control);
}

function buildShortToggle(template, options) {
  const { checked, disabled, name, value } = options;
  const control = document.createElement('span');
  control.className = 'sf-toggle-control';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = checked;
  input.defaultChecked = input.checked;
  input.disabled = disabled;
  if (name) input.name = name;
  if (value !== undefined) input.value = value;

  const container = document.createElement('span');
  container.className = 'sf-toggle-container transition flex items-center content-main-start';

  const innerWrap = document.createElement('span');
  innerWrap.className = 'sf-toggle-inner-wrap transition flex items-center content-main-center';

  const inner = document.createElement('span');
  inner.className = 'sf-toggle-inner transition';
  inner.setAttribute('aria-hidden', 'true');

  innerWrap.append(inner);
  container.append(innerWrap);
  control.append(input, container);
  template.append(control);
}

class Toggle extends ComponentObserver {
  static componentName = 'Toggle';
  html = null;

  constructor(props) {
    super(props);

    const {
      size = '1',
      type = 'simple',
      label = '',
      icon = '',
      checked = false,
      disabled = false,
      name = '',
      value,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;

    this.template = document.createElement('label');
    if (this.id) {
      this.template.id = this.id;
    }

    this.template.classList.add(
      'sf-toggle',
      `sf-toggle--${type}`,
      `sf-toggle--size-${size}`,
      'flex',
      'items-center',
    );

    if (className) {
      this.template.classList.add(...String(className).split(' ').filter(Boolean));
    }

    const options = {
      checked: toBoolean(checked),
      disabled: toBoolean(disabled),
      name,
      value,
      icon,
    };

    if (type === 'icon') {
      buildIconToggle(this.template, options);
    } else if (type === 'short') {
      buildShortToggle(this.template, options);
    } else {
      buildSimpleToggle(this.template, options);
    }

    if (label) {
      const text = document.createElement('span');
      text.className = 'sf-toggle-text';
      text.textContent = label;
      this.template.append(text);
    }
  }

  init() {
    bindToggle(this.template);
  }

  destroyInternal() {
    if (!this.template) return;
    unbindToggle(this.template);
  }
}

registerComponent('Toggle', Toggle);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Toggle = window.SF.Toggle || {};
  window.SF.Toggle.setState = setToggleState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingToggles());
} else {
  initExistingToggles();
}

const toggleObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initToggleTree(node);
    });
  });
});

toggleObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindToggle, setToggleState, syncToggleState, unbindToggle };

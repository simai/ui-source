import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { bindFormReset } from '../../form-reset-helper';
import checkboxUtility from '../json/checkbox.utility.json';

const CHECKBOX_SELECTOR = 'label.sf-checkbox';
const CHECKBOX_BOUND_FLAG = 'sfCheckboxBound';

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on', 'checked', 'disabled', 'indeterminate'].includes(
    normalized,
  );
}

function resolveCheckboxIcon(state) {
  if (!state) return '';
  if (state.indeterminate) return 'remove';
  if (state.checked) return 'check';
  return '';
}

function setCheckboxIcon(iconElement, icon = '') {
  if (!iconElement) return;

  if (iconElement.tagName?.toLowerCase() === 'sf-icon') {
    if (typeof iconElement.setState === 'function') {
      iconElement.setState({ icon });
    } else if (icon) {
      iconElement.setAttribute('icon', icon);
    } else {
      iconElement.removeAttribute('icon');
    }
    return;
  }

  iconElement.textContent = icon;
}

function getCheckboxNodes(root) {
  if (!root) return {};
  const input = root.querySelector('input[type="checkbox"]');
  const boxIcon = root.querySelector(
    '.sf-checkbox-box sf-icon, .sf-checkbox-box .sf-icon',
  );
  return { input, boxIcon };
}

function syncCheckboxState(root) {
  const { input, boxIcon } = getCheckboxNodes(root);
  if (!input || !boxIcon) return;
  setCheckboxIcon(boxIcon, resolveCheckboxIcon(input));
}

function bindCheckbox(root) {
  if (!root || root.dataset[CHECKBOX_BOUND_FLAG] === '1') return;
  const { input } = getCheckboxNodes(root);
  if (!input) return;

  if (input.hasAttribute('data-indeterminate')) {
    input.indeterminate = toBoolean(
      input.getAttribute('data-indeterminate'),
      true,
    );
  }

  const handleChange = () => syncCheckboxState(root);
  root.__sfCheckboxHandleChange = handleChange;
  input.addEventListener('change', handleChange);
  root.__sfCheckboxReleaseReset = bindFormReset(input, handleChange);

  root.dataset[CHECKBOX_BOUND_FLAG] = '1';
  syncCheckboxState(root);
}

function unbindCheckbox(root) {
  if (!root) return;
  root.__sfCheckboxReleaseReset?.();
  delete root.__sfCheckboxReleaseReset;
  const { input } = getCheckboxNodes(root);
  if (input && root.__sfCheckboxHandleChange) {
    input.removeEventListener('change', root.__sfCheckboxHandleChange);
  }
  delete root.__sfCheckboxHandleChange;
  delete root.dataset[CHECKBOX_BOUND_FLAG];
}

function shouldAutoBindCheckbox(root) {
  return root instanceof Element && !root.closest('sf-checkbox');
}

function initCheckboxTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (
    target instanceof Element &&
    target.matches?.(CHECKBOX_SELECTOR) &&
    shouldAutoBindCheckbox(target)
  ) {
    bindCheckbox(target);
  }

  target.querySelectorAll?.(CHECKBOX_SELECTOR).forEach((root) => {
    if (shouldAutoBindCheckbox(root)) {
      bindCheckbox(root);
    }
  });
}

function setCheckboxState(input, state = {}) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'checked')) {
    input.checked = toBoolean(state.checked);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'indeterminate')) {
    input.indeterminate = toBoolean(state.indeterminate);
  }
  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    input.disabled = toBoolean(state.disabled);
  }

  const root = input.closest(CHECKBOX_SELECTOR);
  if (root) {
    syncCheckboxState(root);
  }
  return true;
}

function initExistingCheckboxes(target = document) {
  initCheckboxTree(target);
}

class Checkbox extends ComponentObserver {
  static componentName = 'Checkbox';
  html = null;

  constructor(props) {
    super(props);
    const {
      size = '1',
      title = '',
      description = '',
      help = '',
      checked = false,
      disabled = false,
      indeterminate = false,
      name,
      value,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;

    this.template = document.createElement('label');
    if (this.id) {
      this.template.id = this.id;
    }
    this.template.classList.add('sf-checkbox', `sf-checkbox--size-${size}`);
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    this.box = document.createElement('span');
    this.box.classList.add('sf-checkbox-box');

    this.input = document.createElement('input');
    this.input.type = 'checkbox';
    if (name) {
      this.input.name = name;
    }
    if (value !== undefined) {
      this.input.value = value;
    }
    this.input.checked = toBoolean(checked);
    this.input.defaultChecked = this.input.checked;
    this.input.disabled = toBoolean(disabled);
    this.input.indeterminate = toBoolean(indeterminate);

    Object.entries(this.attrs)
      .filter(([attr]) => !['class', 'className'].includes(attr))
      .forEach(([attr, attrValue]) => {
        if (attrValue === undefined || attrValue === null) return;
        this.input.setAttribute(attr, attrValue);
      });

    this.boxIcon = document.createElement('span');
    this.boxIcon.classList.add('sf-icon');
    this.boxIcon.setAttribute('aria-hidden', 'true');

    this.box.append(this.input, this.boxIcon);
    this.template.append(this.box);

    if (title || description || help) {
      this.container = document.createElement('span');
      this.container.classList.add('sf-checkbox-container');

      if (title || help) {
        this.top = document.createElement('span');
        this.top.classList.add('sf-checkbox-top');

        if (title) {
          this.label = document.createElement('span');
          this.label.classList.add('sf-checkbox-label');
          this.label.textContent = title;
          this.top.append(this.label);
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

      if (description) {
        this.description = document.createElement('span');
        this.description.classList.add('sf-checkbox-description');
        this.description.textContent = description;
        this.container.append(this.description);
      }

      this.template.append(this.container);
    }

    // The layout lives in utility hints (the stylesheet draws no display):
    // without these classes the label drew inline -- a 26x21 mark, no gap and a
    // 21px row (simai/ui-source#49). Optional parts are skipped by the helper.
    this.applyLayoutUtilities(this.template, '.sf-checkbox');
    this.applyLayoutUtilities(this.box, '.sf-checkbox .sf-checkbox-box');
    this.applyLayoutUtilities(this.container, '.sf-checkbox .sf-checkbox-container');
    this.applyLayoutUtilities(this.top, '.sf-checkbox .sf-checkbox-top');
    this.applyLayoutUtilities(this.label, '.sf-checkbox .sf-checkbox-label');
  }

  init() {
    bindCheckbox(this.template);
  }

  destroyInternal() {
    if (!this.template) return;
    unbindCheckbox(this.template);
  }
}

Checkbox.utilityMap = checkboxUtility;

registerComponent('Checkbox', Checkbox);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Checkbox = window.SF.Checkbox || {};
  window.SF.Checkbox.setState = setCheckboxState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingCheckboxes());
} else {
  initExistingCheckboxes();
}

const checkboxObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initCheckboxTree(node);
    });
  });
});

checkboxObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindCheckbox,
  resolveCheckboxIcon,
  setCheckboxState,
  syncCheckboxState,
  unbindCheckbox,
};

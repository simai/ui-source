import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { bindFormReset } from '../../form-reset-helper';

const SWITCH_SELECTOR = 'label.sf-switch';
const SWITCH_BOUND_FLAG = 'sfSwitchBound';

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on', 'checked', 'disabled'].includes(normalized);
}

function getSwitchNodes(root) {
  if (!root) return {};

  const input = root.querySelector('input[type="checkbox"]');
  const toggler = root.querySelector('.sf-switch-toggler');
  const inner = root.querySelector('.sf-switch-inner');
  const description = root.querySelector('.sf-switch-description');

  return { input, toggler, inner, description };
}

function syncSwitchState(root) {
  const { input, toggler, inner, description } = getSwitchNodes(root);
  if (!input || !toggler || !inner) return;

  const isChecked = !!input.checked;
  const isDisabled = !!input.disabled;
  const onText = root.dataset.sfSwitchOnText || '';
  const offText = root.dataset.sfSwitchOffText || '';
  const hasToggleText = !!(onText && offText);

  root.classList.toggle('active', isChecked);
  root.classList.toggle('disabled', isDisabled);
  // The thumb used to move by swapping the track's alignment here. No browser
  // animates justify-content, so it jumped to the far end while the fill faded
  // under it. The stylesheet moves it with a transform now, off the same state
  // class as everything else, and the track keeps one alignment for good.
  toggler.removeAttribute('aria-hidden');
  inner.setAttribute('aria-hidden', 'true');

  if (description && hasToggleText) {
    description.textContent = isChecked ? onText : offText;
  }
}

function bindSwitch(root) {
  if (!root || root.dataset[SWITCH_BOUND_FLAG] === '1') return;
  const { input } = getSwitchNodes(root);
  if (!input) return;

  const handleChange = () => syncSwitchState(root);
  root.__sfSwitchHandleChange = handleChange;
  input.addEventListener('change', handleChange);
  root.__sfSwitchReleaseReset = bindFormReset(input, handleChange);

  root.dataset[SWITCH_BOUND_FLAG] = '1';
  syncSwitchState(root);
}

function unbindSwitch(root) {
  if (!root) return;
  root.__sfSwitchReleaseReset?.();
  delete root.__sfSwitchReleaseReset;

  const { input } = getSwitchNodes(root);
  if (input && root.__sfSwitchHandleChange) {
    input.removeEventListener('change', root.__sfSwitchHandleChange);
  }

  delete root.__sfSwitchHandleChange;
  delete root.dataset[SWITCH_BOUND_FLAG];
}

function initSwitchTree(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(SWITCH_SELECTOR)) {
    bindSwitch(target);
  }

  target.querySelectorAll?.(SWITCH_SELECTOR).forEach(bindSwitch);
}

function setSwitchState(input, state = {}) {
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'checked')) {
    input.checked = toBoolean(state.checked);
  }

  if (Object.prototype.hasOwnProperty.call(state, 'disabled')) {
    input.disabled = toBoolean(state.disabled);
  }

  const root = input.closest(SWITCH_SELECTOR);
  if (root) {
    syncSwitchState(root);
  }

  return true;
}

function initExistingSwitches(target = document) {
  initSwitchTree(target);
}

class Switch extends ComponentObserver {
  static componentName = 'Switch';
  html = null;

  constructor(props) {
    super(props);

    const {
      size = '1',
      title = '',
      label = title,
      description = '',
      help = '',
      checked = false,
      disabled = false,
      name = '',
        on,
        off,
      value,
    } = this.params || {};

    const className = this.attrs.class || this.attrs.className;

    this.template = document.createElement('label');
    if (this.id) {
      this.template.id = this.id;
    }

    this.template.classList.add('sf-switch', `sf-switch--size-${size}`, 'flex');
    if (className) {
      this.template.classList.add(...`${className}`.split(' ').filter(Boolean));
    }

    this.toggler = document.createElement('span');
    this.toggler.classList.add(
      'sf-switch-toggler',
      'flex',
      'items-cross-center',
    );

    this.input = document.createElement('input');
    this.input.type = 'checkbox';
    this.input.setAttribute('role', 'switch');
    if (name) {
      this.input.name = name;
    }
    if (value !== undefined) {
      this.input.value = value;
    }
    this.hasToggleText = !!(off && on);
    this.onText = on || '';
    this.offText = off || '';
    const descriptionText = this.hasToggleText
      ? (toBoolean(checked) ? this.onText : this.offText)
      : description;
    this.input.checked = toBoolean(checked);
    this.input.defaultChecked = this.input.checked;
    this.input.disabled = toBoolean(disabled);

    if (this.hasToggleText) {
      this.template.dataset.sfSwitchOnText = this.onText;
      this.template.dataset.sfSwitchOffText = this.offText;
    }

    Object.entries(this.attrs)
      .filter(([attr]) => !['class', 'className', 'on', 'off'].includes(attr))
      .forEach(([attr, attrValue]) => {
        if (attrValue === undefined || attrValue === null) return;
        this.input.setAttribute(attr, attrValue);
      });

    this.inner = document.createElement('span');
    // The component owns the motion now; the utility would override it with
    // its own clock and its own list of properties.
    this.inner.classList.add('sf-switch-inner');
    this.inner.setAttribute('aria-hidden', 'true');

    this.toggler.append(this.input, this.inner);
    this.template.append(this.toggler);

    if (label || descriptionText || help) {
      this.containerWrap = document.createElement('span');
      this.containerWrap.classList.add('sf-switch-container-wrap', 'flex', 'flex-col', 'text-start','flex-1');

      if (label || help) {
        this.top = document.createElement('span');
        this.top.classList.add('sf-switch-top', 'flex');

        if (label) {
          this.container = document.createElement('span');
          this.container.classList.add(
            'sf-switch-container',
            'flex',
            'items-cross-center',
            'content-main-center',
          );

          this.text = document.createElement('span');
          this.text.classList.add('sf-switch-text');
          this.text.textContent = label;
          this.container.append(this.text);
          this.top.append(this.container);
        }

        if (help) {
          this.helpIcon = document.createElement('i');
          this.helpIcon.classList.add('sf-icon');
          this.helpIcon.setAttribute('aria-hidden', 'true');
          this.helpIcon.textContent = help;
          this.top.append(this.helpIcon);
        }

        this.containerWrap.append(this.top);
      }

      if (descriptionText) {
        this.description = document.createElement('span');
        this.description.classList.add('sf-switch-description');
        this.description.textContent = descriptionText;
        this.containerWrap.append(this.description);
      }

      this.template.append(this.containerWrap);
    }
  }

  init() {
    bindSwitch(this.template);
  }

  destroyInternal() {
    if (!this.template) return;
    unbindSwitch(this.template);
  }
}

registerComponent('Switch', Switch);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Switch = window.SF.Switch || {};
  window.SF.Switch.setState = setSwitchState;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExistingSwitches());
} else {
  initExistingSwitches();
}

const switchObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initSwitchTree(node);
    });
  });
});

switchObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export { bindSwitch, setSwitchState, syncSwitchState, unbindSwitch };

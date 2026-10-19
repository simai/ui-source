import SfBaseElement from '../../core/js/smart-base';
import { renderButtonGroupTemplate } from './js/templates/default';
import { resolveControlSpacing } from '../../core/js/control-spacing';

function parseItems(value = []) {
  if (Array.isArray(value)) return value;

  const source = String(value || '').trim();
  if (!source) return [];

  if (source.startsWith('[')) {
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return source.split('|').map((entry) => {
    const [valuePart, labelPart, flagsPart = ''] = entry.split('::');
    const flags = flagsPart.split(',').map((flag) => flag.trim()).filter(Boolean);
    const iconFlag = flags.find((flag) => flag.startsWith('icon='));

    return {
      value: valuePart.trim(),
      label: (labelPart || valuePart).trim(),
      disabled: flags.includes('disabled'),
      icon: iconFlag ? iconFlag.slice('icon='.length) : '',
    };
  });
}

function normalizeItems(items = []) {
  const seen = new Set();

  return parseItems(items)
    .map((item, index) => {
      const source = typeof item === 'string' ? { value: item, label: item } : item;
      if (!source || typeof source !== 'object') return null;

      const value = String(source.value ?? source.id ?? index).trim();
      if (!value || seen.has(value)) return null;
      seen.add(value);

      return {
        id: String(source.id || value),
        value,
        label: String(source.label ?? source.text ?? value),
        icon: String(source.icon || ''),
        ariaLabel: String(source.ariaLabel || source['aria-label'] || ''),
        // A number shown after the label in the segmented appearance; 0 is a
        // count, an absent or empty one is not.
        count: source.count === null || typeof source.count === 'undefined' ? '' : String(source.count).trim(),
        // Only an icon can stand alone; the label stays as the accessible name.
        iconOnly: Boolean((source.iconOnly ?? source['icon-only']) && source.icon),
        disabled: Boolean(source.disabled),
      };
    })
    .filter(Boolean);
}

class SfButtonGroup extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      items: { type: Array, default: [], parser: parseItems },
      value: { default: '' },
      size: { default: '1', values: ['1/3', '1/2', '1', '2', '3'] },
      spacing: {type: String, default: null},
      tightness: { default: '', values: ['', 'low', 'high', 'highest'] },
      scheme: { default: 'primary', values: ['primary', 'secondary', 'on-surface'] },
      // How the group looks. segmented: a sunken track with borderless segments
      // and a plate under the selected one; the selection model is the same.
      appearance: { default: 'default', values: ['default', 'segmented'] },
      // The selected segment's plate in the segmented appearance: the scheme's
      // fill, or a raised neutral surface.
      plate: { default: 'scheme', values: ['scheme', 'raised'] },
      fullWidth: { attribute: 'full-width', type: Boolean, default: false },
      orientation: { default: 'horizontal', values: ['horizontal', 'vertical'] },
      disabled: { type: Boolean, default: false },
      ariaLabel: { attribute: 'aria-label', default: '' },
      rootClass: { attribute: 'root-class', default: '' },
    };
  }

  constructor() {
    super();
    this.addEventListener('click', this.handleClick);
    this.addEventListener('keydown', this.handleKeyDown);
    this.addEventListener('sf-after-render', (event) => {
      // A nested Smart button may finish after its parent or render again later.
      if (event.target !== this && event.target.parentElement === this.querySelector('.sf-button-group')) {
        this.syncButtonSemantics();
      }
    });
  }

  get normalizedItems() {
    const items = normalizeItems(this.getProp('items'));
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);

    return items.map((item, index) => ({
      ...item,
      firstEnabled: index === firstEnabledIndex,
    }));
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(nextValue) {
    if (nextValue === null || typeof nextValue === 'undefined' || nextValue === '') {
      this.removeAttribute('value');
      return;
    }
    this.setAttribute('value', String(nextValue));
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  templateContext() {
    return this.createTemplateContext({
      ...this.getPropsContext(),
      ...resolveControlSpacing({spacing: this.getAttribute('spacing'), tightness: this.getAttribute('tightness')}),
      component: this,
      items: this.normalizedItems,
      value: this.value,
      disabled: this.disabled,
    });
  }

  template() {
    return renderButtonGroupTemplate(this.templateContext());
  }

  // Every form value control reports a committed change as `change` on its host.
  // `sf-button-group-change` is the legacy name, still emitted with the same
  // detail; see contracts/public-api-axes.json.
  emitValueChange(detail) {
    this.emitComponentEvent('button-group-change', detail);
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { component: this, ...detail },
    }));
  }

  select(nextValue) {
    const value = String(nextValue ?? '');
    const item = this.normalizedItems.find((candidate) => candidate.value === value);

    if (!item || item.disabled || this.disabled || value === this.value) {
      return this;
    }

    const previous = this.value;
    this.value = value;
    this.emitValueChange({
      previous,
      value,
      item,
    });
    return this;
  }

  afterRender() {
    this.syncButtonSemantics();
  }

  syncButtonSemantics() {
    const root = this.querySelector('.sf-button-group');
    if (!root) return;
    const items = this.normalizedItems;
    const available = this.disabled ? [] : items.filter(item => !item.disabled);
    const tabStop = available.find(item => item.value === this.value) || available[0];
    // A segmented group draws native buttons; the default one draws Smart buttons.
    root.querySelectorAll(':scope > sf-button, :scope > button').forEach((host, index) => {
      const button = host.matches('button') ? host : host.querySelector('button'), item = items[index];
      if (!button || !item) return;
      const selected = item.value === this.value;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.tabIndex = item === tabStop ? 0 : -1;
    });
  }

  clear() {
    if (!this.value || this.disabled) return this;

    const previous = this.value;
    this.value = '';
    this.emitValueChange({
      previous,
      value: '',
      item: null,
    });
    return this;
  }

  focus(options) {
    const button = this.querySelector('button[role="radio"][tabindex="0"]:not(:disabled)');
    button?.focus?.(options);

    return this;
  }

  handleClick = (event) => {
    const target = event.target?.closest?.('[data-sf-button-group-value]');
    if (!target || !this.contains(target)) return;
    this.select(target.getAttribute('data-sf-button-group-value'));
  };

  handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;

    const enabled = this.normalizedItems.filter((item) => !item.disabled);
    if (!enabled.length || this.disabled) return;

    const currentIndex = Math.max(0, enabled.findIndex((item) => item.value === this.value));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabled.length - 1
          : ['ArrowLeft', 'ArrowUp'].includes(event.key)
            ? (currentIndex - 1 + enabled.length) % enabled.length
            : (currentIndex + 1) % enabled.length;

    event.preventDefault();
    const previous = this.value;
    this.select(enabled[nextIndex].value);

    if (this.value !== previous) {
      this.addEventListener('sf-after-render', () => this.focus(), { once: true });
    }
  };
}

SfButtonGroup.define('sf-button-group');

export { normalizeItems, parseItems };

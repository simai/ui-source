import SfBaseElement, { toAttributeName, toNumber } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderStepsTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-steps from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8, §11): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product adds
// another language through SF.language.register("sf-steps", code, words)), and
// the old event name sf-step-change is a dated alias of sf-steps-change.
const StepsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

function parseItems(items = '') {
  // The list as JSON in the attribute reads like the property.
  if (typeof items === 'string' && items.trim().startsWith('[')) {
    try {
      return parseItems(JSON.parse(items));
    } catch {
      // Not JSON: the "label::disabled|label" form below.
    }
  }
  if (Array.isArray(items)) {
    return items
      .map((item) => (typeof item === 'string' ? { label: item } : item))
      .filter(Boolean);
  }

  return String(items || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelPart, flagsPart = ''] = entry.split('::');
      const label = labelPart.trim();
      const flags = flagsPart
        .split(',')
        .map((flag) => flag.trim().toLowerCase())
        .filter(Boolean);

      return {
        label,
        disabled: flags.includes('disabled'),
      };
    });
}

class SfSteps extends StepsElement {
  // The manifest's settings, and what the steps read more closely: items from
  // the attribute's own forms or the property, the words from the language
  // files while the attribute is empty.
  static get props() {
    return {
      ...super.props,
      size: { default: '1' },
      items: {
        default: [],
        parser(value, fallback, element) {
          if (value !== undefined && value !== null) return parseItems(value);
          return parseItems(element?.__sfManifestData?.items ?? []);
        },
      },
      current: { type: Number, default: 0 },
      errorStep: { default: '' },
      separatorIcon: { default: 'chevron_right' },
      ariaLabel: { attribute: 'aria-label', default: '' },
      completedLabel: { default: '' },
      errorLabel: { default: '' },
      rootClass: { default: '' },
    };
  }


  constructor() {
    super();
    this.addEventListener('click', this.handleRootClick);
  }

  get size() {
    return this.getAttribute('size') || '1';
  }

  get items() {
    return this.getProp('items');
  }

  // A list setting is a property (§4): the list given here wins until the
  // attribute is written again.
  set items(value) {
    if (!this.__sfManifestData) this.__sfManifestData = {};
    this.__sfManifestData.items = value;
    if (this.hasAttribute('items')) this.removeAttribute('items');
    else this.requestComponentUpdate('items');
  }

  get current() {
    const maxIndex = Math.max(this.items.length - 1, 0);
    return Math.min(Math.max(this.getNumberAttr('current', 0), 0), maxIndex);
  }

  set current(value) {
    this.setAttribute('current', String(toNumber(value, 0)));
  }

  get errorStep() {
    const value = this.getAttribute('error-step');
    if (value === null || value === '') {
      return null;
    }

    const parsed = toNumber(value, -1);
    return parsed >= 0 ? parsed : null;
  }

  get separatorIcon() {
    return this.getAttribute('separator-icon') || 'chevron_right';
  }

  get computedItems() {
    const errorStep = this.errorStep;

    return this.items.map((item, index) => {
      const isError = errorStep === index;
      let stage = 'default';

      if (isError) {
        stage = 'error';
      } else if (index < this.current) {
        stage = 'completed';
      }

      return {
        ...item,
        index,
        stage,
        selected: index === this.current,
      };
    });
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.getAttribute('aria-label') || this.sfWord('aria-label'),
      completedLabel: this.getAttribute('completed-label') || this.sfWord('completed-label'),
      errorLabel: this.getAttribute('error-label') || this.sfWord('error-label'),
      component: this,
      rootClass: this.getRootClass(),
      items: this.computedItems,
    });
  }

  template() {
    return renderStepsTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      current: this.current,
      errorStep: this.errorStep,
      separatorIcon: this.separatorIcon,
      ariaLabel: this.getAttribute('aria-label') || this.sfWord('aria-label'),
      completedLabel: this.getAttribute('completed-label') || this.sfWord('completed-label'),
      errorLabel: this.getAttribute('error-label') || this.sfWord('error-label'),
      items: this.items,
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      if (value === false || value === null || value === undefined || value === '') {
        this.removeAttribute(attr);
        return;
      }

      if (Array.isArray(value)) {
        const serialized = value
          .map((item) => {
            if (typeof item === 'string') {
              return item;
            }

            const flags = [];
            if (item?.disabled) {
              flags.push('disabled');
            }

            return flags.length ? `${item.label}::${flags.join(',')}` : item.label;
          })
          .join('|');
        this.setAttribute(attr, serialized);
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

  // The action go-to-step (§4.4): moves current and answers an outcome. It
  // reports nothing: `change` is what a person did (§8), which is the press
  // below.
  goToStep(index) {
    return this.moveToStep(index, { person: false });
  }

  moveToStep(index, { person = false } = {}) {
    const requested = toNumber(index?.index ?? index, Number.NaN);
    if (!Number.isFinite(requested)) return { outcome: 'refused', reason: 'out-of-range' };
    const nextIndex = Math.min(Math.max(requested, 0), this.items.length - 1);
    const item = this.items[nextIndex];

    if (!item) return { outcome: 'refused', reason: 'out-of-range' };
    if (item.disabled) return { outcome: 'refused', reason: 'disabled' };
    if (nextIndex === this.current) return { outcome: 'refused', reason: 'current' };

    const previous = this.current;
    this.setAttribute('current', String(nextIndex));
    if (person) {
      this.sfEmit('change', { previous, current: nextIndex, item, items: this.items });
    }
    return { outcome: 'applied' };
  }

  // The old name keeps its old detail (§16.20 split row): the element and its
  // template were in it.
  sfAliasAdapters() {
    return {
      'sf-step-change': (detail) => ({
        component: this,
        tagName: this.componentTagName,
        template: this.componentTemplateName,
        ...detail,
      }),
    };
  }

  onStepChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        this.sfEventName('change'),
        (event) => {
          handler(event.detail?.current, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  handleRootClick = (event) => {
    const step = event.target?.closest?.('[data-step-index]');
    if (!(step instanceof HTMLElement)) {
      return;
    }

    const nextIndex = toNumber(step.dataset.stepIndex, this.current);
    this.moveToStep(nextIndex, { person: true });
  };

}

SfSteps.define('sf-steps');

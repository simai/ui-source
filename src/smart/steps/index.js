import SfBaseElement, { toAttributeName, toNumber } from '../../core/js/smart-base';
import { renderStepsTemplate } from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-steps", code, words).
const STEPS_TEXT = {
  en: {
    ariaLabel: 'Steps',
    completedLabel: 'Completed',
    errorLabel: 'Error',
  },
  ru: {
    ariaLabel: 'Шаги',
    completedLabel: 'Завершено',
    errorLabel: 'Ошибка',
  },
};




function parseItems(items = '') {
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

class SfSteps extends SfBaseElement {
  static get props() {
    return {
      size: { default: '1' },
      items: {
        default: [],
        parser(value) {
          return parseItems(value);
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

  get current() {
    const maxIndex = Math.max(this.items.length - 1, 0);
    return Math.min(Math.max(this.getNumberAttr('current', 0), 0), maxIndex);
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
      ariaLabel: this.getAttribute("aria-label") || pageText(STEPS_TEXT, "ariaLabel", this),
      completedLabel: this.getAttribute("completed-label") || pageText(STEPS_TEXT, "completedLabel", this),
      errorLabel: this.getAttribute("error-label") || pageText(STEPS_TEXT, "errorLabel", this),
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
      ariaLabel: this.getAttribute('aria-label') || 'Steps',
      completedLabel: this.getAttribute('completed-label') || 'Completed',
      errorLabel: this.getAttribute('error-label') || 'Error',
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

  goToStep(index) {
    const nextIndex = Math.min(Math.max(toNumber(index, this.current), 0), this.items.length - 1);
    const item = this.items[nextIndex];

    if (!item || item.disabled || nextIndex === this.current) {
      return this;
    }

    const previous = this.current;
    this.setAttribute('current', String(nextIndex));
    this.emitComponentEvent('step-change', {
      previous,
      current: nextIndex,
      item,
      items: this.items,
    });
    return this;
  }

  onStepChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-step-change',
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
    this.goToStep(nextIndex);
  };

}

SfSteps.define('sf-steps');

import SfBaseElement, { toAttributeName, toNumber } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderStepsTemplate } from './js/templates/default';
import {
  COUNT_BELOW_REM, LAYOUTS, MARKERS, NAVIGATION, noteOld, parseItems, reachable, resolveStates,
} from './js/items';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-steps from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §8, §11): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product adds
// another language through SF.language.register("sf-steps", code, words)), and
// the old event name sf-step-change is a dated alias of sf-steps-change.
//
// What it is (owner decision C101, 2026-11-12): where a person is in an
// ordered process of their own -- how many steps are behind and how many are
// ahead. A job the server runs is sf-progress-run; tasks done in any order are
// a task list, not steps. Passive by default: an ordered list, the current
// item aria-current=step, a state word in each item. navigation="visited" or
// "free" makes the steps a person may go to buttons, as in sf-wizard.
const StepsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

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
      marker: { default: 'number' },
      layout: { default: 'auto' },
      navigation: { default: '' },
      errorStep: { default: '' },
      separatorIcon: { default: '' },
      ariaLabel: { attribute: 'aria-label', default: '' },
      completedLabel: { default: '' },
      currentLabel: { default: '' },
      aheadLabel: { default: '' },
      errorLabel: { default: '' },
      skippedLabel: { default: '' },
      runningLabel: { default: '' },
      countLabel: { default: '' },
      rootClass: { default: '' },
    };
  }

  constructor() {
    super();
    this.addEventListener('click', this.handleRootClick);
  }

  get size() {
    return this.getAttribute('size') === '1/2' ? '1/2' : '1';
  }

  get marker() {
    const value = this.getAttribute('marker');
    return MARKERS.includes(value) ? value : 'number';
  }

  set marker(value) {
    this.setAttribute('marker', String(value));
  }

  get layout() {
    const value = this.getAttribute('layout');
    return LAYOUTS.includes(value) ? value : 'auto';
  }

  set layout(value) {
    this.setAttribute('layout', String(value));
  }

  get navigation() {
    const value = this.getAttribute('navigation');
    return NAVIGATION.includes(value) ? value : '';
  }

  set navigation(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('navigation');
    else this.setAttribute('navigation', String(value));
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

  // current runs from 0 to the number of steps: equal to it, every step is
  // behind (all done, C101 ST-4).
  get current() {
    const count = this.items.length;
    return Math.min(Math.max(this.getNumberAttr('current', 0), 0), count);
  }

  set current(value) {
    this.setAttribute('current', String(toNumber(value, 0)));
  }

  get done() {
    const count = this.items.length;
    return count > 0 && this.current >= count;
  }

  // The old way to mark one step failed (1.3 and before): an item's own
  // state error is today's.
  get errorStep() {
    const value = this.getAttribute('error-step');
    if (value === null || value === '') {
      return null;
    }

    const parsed = toNumber(value, -1);
    if (parsed < 0) return null;
    noteOld('attribute', 'error-step', 'error-step', 'items[i].state = "error"');
    return parsed;
  }

  get separatorIcon() {
    return this.getAttribute('separator-icon') || '';
  }

  get computedItems() {
    return resolveStates(this.items, this.current, this.errorStep).map((item) => ({
      ...item,
      reachable: reachable(item, this.navigation),
    }));
  }

  word(key, attribute) {
    return this.getAttribute(attribute) || this.sfWord(key);
  }

  get stateWords() {
    return {
      done: this.word('completed-label', 'completed-label'),
      current: this.word('current-label', 'current-label'),
      ahead: this.word('ahead-label', 'ahead-label'),
      error: this.word('error-label', 'error-label'),
      skipped: this.word('skipped-label', 'skipped-label'),
      running: this.word('running-label', 'running-label'),
    };
  }

  // The layout drawn: an explicit one, or for auto what the list's own width
  // allows (checkFit, after each drawing): a row while it fits, else a column,
  // and under 20rem the count line.
  get drawnLayout() {
    if (this.layout !== 'auto') return this.layout;
    return this._fit || 'row';
  }

  templateContext() {
    const props = this.getPropsContext();
    const items = this.computedItems;
    const count = items.length;
    const at = count ? Math.min(this.current, count - 1) : 0;
    const done = this.done;

    if (this.hasAttribute('separator-icon')) {
      noteOld('attribute', 'separator-icon', 'separator-icon', null);
    }

    return this.createTemplateContext({
      ...props,
      size: this.size,
      marker: this.marker,
      layout: this.layout,
      drawn: this.drawnLayout,
      navigation: this.navigation,
      ariaLabel: this.getAttribute('aria-label') || this.sfWord('aria-label'),
      words: this.stateWords,
      component: this,
      rootClass: this.getRootClass(),
      items,
      count,
      done,
      position: count
        ? {
            label: items[at]?.label ?? '',
            state: items[at]?.state ?? '',
            text: this.getAttribute('count-label')
              ? this.getAttribute('count-label').replace('{n}', String(at + 1)).replace('{count}', String(count))
              : this.sfWord('count-label', { vars: { n: at + 1, count } }),
            value: done ? 100 : Math.round(((at + 1) / count) * 100),
          }
        : null,
    });
  }

  template() {
    return renderStepsTemplate(this.templateContext());
  }

  get state() {
    return {
      size: this.size,
      current: this.current,
      marker: this.marker,
      layout: this.layout,
      navigation: this.navigation,
      ariaLabel: this.getAttribute('aria-label') || this.sfWord('aria-label'),
      completedLabel: this.word('completed-label', 'completed-label'),
      currentLabel: this.word('current-label', 'current-label'),
      aheadLabel: this.word('ahead-label', 'ahead-label'),
      errorLabel: this.word('error-label', 'error-label'),
      skippedLabel: this.word('skipped-label', 'skipped-label'),
      runningLabel: this.word('running-label', 'running-label'),
      items: this.items,
      rootClass: this.getRootClass(),
    };
  }

  // Writes each key as its attribute; a list (items) is written as JSON, the
  // one list format (C101).
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
        this.setAttribute(attr, JSON.stringify(value.map((item) => (typeof item === 'string' ? { label: item } : item))));
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
  // below. It moves whatever navigation says: navigation is what a person
  // may press, the host moves the steps itself.
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

  // Only a step drawn as a button is pressed (navigation): a passive list has
  // none.
  handleRootClick = (event) => {
    const control = event.target?.closest?.('.sf-step-control');
    if (!(control instanceof HTMLElement) || !this.contains(control) || control.disabled) {
      return;
    }
    const step = control.closest('[data-step-index]');
    const nextIndex = toNumber(step?.dataset.stepIndex, this.current);
    const item = this.computedItems[nextIndex];
    if (!item || !item.reachable) return;
    this.moveToStep(nextIndex, { person: true });
  };

  // ---------------------------------------------------------------- layout

  afterRender() {
    this.observeFit();
    this.checkFit();
  }

  onDisconnected() {
    this._fitObserver?.disconnect();
    super.onDisconnected();
  }

  observeFit() {
    if (typeof ResizeObserver === 'undefined') return;
    if (!this._fitObserver) {
      this._fitObserver = new ResizeObserver(() => this.checkFit());
      globalThis.document?.fonts?.ready?.then?.(() => this.checkFit());
    }
    this._fitObserver.disconnect();
    const root = this.querySelector(':scope > .sf-steps');
    if (root) this._fitObserver.observe(root);
  }

  // What the steps need on one row and what the list is given: the row is
  // laid out at its one-line width for a moment (data-sf-measure, in the same
  // task, never painted), whatever the list draws now.
  measureFit() {
    const root = this.querySelector(':scope > .sf-steps');
    const list = root?.querySelector(':scope > .sf-steps-container');
    if (!root || !list) return null;
    const room = root.getBoundingClientRect().width;
    root.setAttribute('data-sf-measure', '');
    const need = list.getBoundingClientRect().width;
    root.removeAttribute('data-sf-measure');
    const rem = parseFloat(globalThis.getComputedStyle?.(globalThis.document.documentElement).fontSize) || 16;
    return { need, room, rem };
  }

  checkFit() {
    if (!this.isConnected || this.layout !== 'auto') return;
    const fit = this.measureFit();
    // Not laid out (a closed panel, display none): nothing to decide.
    if (!fit || !fit.room) return;
    let next = 'row';
    if (fit.room < COUNT_BELOW_REM * fit.rem) next = 'count';
    // A pixel of slack: a row that fits exactly is a row.
    else if (fit.need > fit.room + 1) next = 'column';
    if (next === (this._fit || 'row')) return;
    this._fit = next;
    this.requestComponentUpdate?.('fit');
  }
}

SfSteps.define('sf-steps');

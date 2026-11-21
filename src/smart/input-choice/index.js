import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import {instancePath, partId} from '../../core/js/instance-path';
import {FormField, ShownValidity} from '../helpers/form-field';
import {renderChoiceTemplate} from './js/templates/default';
import {fieldHelpLabel} from '../helpers/field-help';
import {noteDeprecated} from '../../core/js/deprecations';
import {CHOICE_APPEARANCES, CHOICE_COLUMNS, CHOICE_LAYOUTS, OPTION_LOOKS, applyChoice, chosenFirst, formatValue, listFlow, mergeItems, normaliseItems, orderValues, parseValue, searchItems} from './js/choice-model.mjs';
import manifest from './component.json';
import {files as languageFiles} from './lang/index.mjs';
// Only the words on screen ship in the bundle, English only (owner decision
// C282): Russian and every other language come from a language file. The
// title, settings and events stay in the language files for the Studio and the
// docs (localization study LC-2).
import './scss/index.scss';

// sf-input-choice: a form field that picks one option, or several, from
// cards -- a site's kind, a page type, a template, a backup target, a plan,
// delivery or payment -- each with a title, a description, a badge, a price
// and term, an icon or an image, in one of three layouts (list, tile,
// picture; owner decision C28). Larena's request msg-993e1e39 item 3 (choice
// cards).
//
// appearance="list" (owner decision C165 (1), (3)) draws the same field as a
// ready group of checks or radios: a heading with its «?», the hint, the
// options as rows of the class checkbox or radio, the error under the last
// row; flow auto, row or column arranges the rows.
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8,
// §17): the settings are made by core/js/element-manifest.js; the host is the
// form control through ElementInternals and sends the chosen values. The
// cards are native radios (single) or checkboxes (multiple), so the keyboard
// is the browser's -- the arrow keys move and choose in a radio group, Space
// toggles a checkbox -- and a person's press says input and change once; a
// value set from code, a form reset and a restore say nothing.
//
// While the host submits, the inner inputs are taken out of the page's form by
// a `form` attribute that names no form (§17.1 item 6), and their name is the
// host's path id, so the radios of one element are one group and two elements
// never share one.
const ChoiceElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: languageFiles,
  source: 'en',
});

// An option named by text (sf-dropdown's first spelling) rather than label:
// read until the date, noted once in SF.deprecations (Larena LF-2).
const noteOptionAlias = (from, to) => noteDeprecated({component: 'sf-input-choice', tag: 'sf-input-choice', kind: 'property', attribute: 'items', from, to, since: '2026-11-18', remove_after: '2027-01-01'});

// The id the inner inputs' form attribute names: no element carries it.
const NO_FORM = 'sf-input-choice-no-form';

// A provider's page (FO-4): the options asked for at once, and the wait after
// the last key of a search before the provider is asked.
const PAGE_LIMIT = 50;
const SEARCH_DEBOUNCE = 200;

class SfInputChoice extends ShownValidity(FormField(ChoiceElement)) {
  static get props() {
    return {
      ...super.props,
      rootClass: {attribute: 'root-class', default: ''},
    };
  }

  // value is a property, but a page prints it as an attribute too: one value,
  // or the values separated by commas.
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'value', 'items'])];
  }

  constructor() {
    super();
    // undefined: follow the value attribute (the default a reset returns to).
    this._value = undefined;
    // A value set as a property before the element was defined is an own
    // property that would hide the accessor; it is taken through it.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const early = this.value;
      delete this.value;
      this._value = early;
    }
    // The inner inputs' own input and change stay inside: the host says its
    // own, once, with the choice in the detail.
    this.addEventListener('input', this.onInnerEvent, true);
    this.addEventListener('change', this.onInnerEvent, true);
  }

  // ---------------------------------------------------------- the host's pages (FO-4)

  // searchable: a search field over the rows; without a provider it searches
  // the options in hand. provider: the options come from the host, a page at
  // a time -- async (query, {cursor, limit, signal}) answering {items,
  // nextCursor?}, as sf-input-lookup's provider; a thrown error or a rejected
  // promise is the error line with «Try again». The previous call is aborted
  // through signal and an answer for an older call is dropped. The options in
  // hand (items) stay first -- a chosen option the pages have not reached
  // keeps its row.
  get _pages() {
    if (!this.__pages) this.__pages = {provider: null, items: [], status: 'idle', nextCursor: null, retryCursor: null, sequence: 0, abort: null, timer: 0, query: ''};
    return this.__pages;
  }

  searchFor(query) {
    const pages = this._pages;
    pages.query = String(query ?? '');
    clearTimeout(pages.timer);
    if (typeof this.provider === 'function') {
      pages.timer = setTimeout(() => this.loadPage(null), SEARCH_DEBOUNCE);
      return;
    }
    this.requestComponentUpdate('search');
  }

  async loadPage(cursor = null) {
    const provider = this.provider;
    const pages = this._pages;
    if (typeof provider !== 'function' || !this.isConnected) return false;
    pages.abort?.abort();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    pages.abort = controller;
    const sequence = ++pages.sequence;
    pages.status = 'loading';
    pages.retryCursor = cursor;
    this.requestComponentUpdate('page');
    try {
      const answer = await provider(pages.query, {cursor, limit: PAGE_LIMIT, signal: controller?.signal});
      if (sequence !== pages.sequence || !this.isConnected) return false;
      const items = normaliseItems(Array.isArray(answer?.items) ? answer.items : []);
      pages.items = cursor ? mergeItems(pages.items, items) : items;
      pages.nextCursor = answer?.nextCursor ?? answer?.next_cursor ?? null;
      pages.status = pages.items.length ? 'ready' : 'empty';
      this.requestComponentUpdate('page');
      return true;
    } catch (error) {
      if (sequence !== pages.sequence || error?.name === 'AbortError') return false;
      pages.status = 'error';
      this.requestComponentUpdate('page');
      return false;
    }
  }

  // A provider given (or replaced) is asked for its first page.
  _followProvider() {
    const pages = this._pages;
    const provider = typeof this.provider === 'function' ? this.provider : null;
    if (provider === pages.provider) return;
    pages.abort?.abort();
    Object.assign(pages, {provider, items: [], status: 'idle', nextCursor: null, retryCursor: null});
    if (provider) queueMicrotask(() => this.loadPage(null));
  }

  onDisconnected() {
    super.onDisconnected?.();
    this._opened = null;
    this._moreWatch?.disconnect();
    this._moreWatch = null;
    this._moreWatched = null;
    const pages = this._pages;
    clearTimeout(pages.timer);
    pages.abort?.abort();
    // Back on the page, the provider is asked again.
    pages.provider = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // The value attribute written again is the value again.
    if (name === 'value' && oldValue !== newValue) {
      this._value = undefined;
      this._opened = null;
      this.requestComponentUpdate?.('value');
      this.sfSyncFormState?.();
    }
    // A list setting is a property (or the JSON island); the attribute holds
    // the same list as JSON, as sf-menu's items. A change after the element
    // first connected is the property's list now (sfReadListAttributes below
    // takes the first one).
    if (name === 'items' && oldValue !== newValue) {
      if (this.__sfListAttributesRead) this.adoptItemsAttribute(newValue);
      this.requestComponentUpdate?.('items');
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  // The property says what the attribute gave (Larena LF-1, 2026-11-18:
  // items read [] while the cards drew the attribute's options). The base
  // reads a list attribute only for a setting no component observes; this
  // one is observed, so the first reading is here, after the island and on
  // the same terms: a property or the island that gave the list first wins.
  sfReadListAttributes() {
    const first = !this.__sfListAttributesRead;
    super.sfReadListAttributes();
    if (!first || !this.hasAttribute('items')) return;
    const given = this.items;
    const store = this.__sfManifestData ?? {};
    if ((Array.isArray(given) && given.length) || Object.prototype.hasOwnProperty.call(store, 'items')) return;
    this.adoptItemsAttribute(this.getAttribute('items'));
  }

  // The attribute's JSON as the items property; not JSON or not a list:
  // the property keeps its value (the cards still read the attribute).
  adoptItemsAttribute(raw) {
    let list;
    try {
      list = raw === null ? [] : JSON.parse(raw);
    } catch {
      return;
    }
    if (Array.isArray(list)) this.items = list;
  }

  // ---------------------------------------------------------- settings

  // The options: the property or the island, else the attribute's JSON.
  get options() {
    const given = this.items;
    const own = Array.isArray(given) && given.length ? normaliseItems(given, {onAlias: noteOptionAlias}) : normaliseItems(this.getAttribute('items'), {onAlias: noteOptionAlias});
    if (typeof this.provider === 'function') return mergeItems(own, this._pages.items);
    return own;
  }

  // The rows drawn: the options, searched in place when the field is
  // searchable and has no provider (a provider searches itself).
  get shownOptions() {
    const options = this.options;
    const paged = typeof this.provider === 'function';
    if (!this.searchable && !paged) return options;
    // FO4-5: with a search or a host's pages, what was chosen when the list
    // opened stands first; the order does not move while it is open.
    this._opened ??= new Set(this.selected);
    const shown = paged ? options : searchItems(options, this._pages.query);
    return chosenFirst(shown, this._opened);
  }

  // The index of the last row that stands first because it was chosen when
  // the list opened, while other rows follow it; -1 when nothing stands first.
  chosenLastIndex() {
    const opened = this._opened;
    if (!opened?.size) return -1;
    const shown = this.shownOptions;
    let last = -1;
    while (last + 1 < shown.length && opened.has(shown[last + 1].value)) last += 1;
    return last >= 0 && last < shown.length - 1 ? last : -1;
  }

  // panel (owner decisions C313 (3), C312 (1)): the list as a dropping
  // panel's content. While a search is typed in a multiple list, the rows
  // found and not chosen can be chosen at once («Select found (N)»).
  get panelValue() {
    return this.hasAttribute('panel') && this.getAttribute('panel') !== 'false';
  }

  foundToSelect() {
    if (!this.multiple || !this.panelValue || !this._pages.query.trim()) return [];
    const chosen = new Set(this.selected);
    return this.shownOptions.filter((one) => !one.disabled && !chosen.has(one.value)).map((one) => one.value);
  }

  selectFound() {
    const found = this.foundToSelect();
    if (!found.length || this.effectiveDisabled) return;
    const next = [...this.selected, ...found];
    this._value = formatValue(next);
    this.requestComponentUpdate('value');
    this.sfSyncFormState();
    const detail = {value: this.value, values: [...next], item: null, checked: true};
    this.sfEmit('input', detail);
    this.sfEmit('change', detail);
  }

  // Where a row's box stands (C308 FO-5): start, or end of the row.
  get controlPositionValue() {
    return this.getAttribute('control-position') === 'end' ? 'end' : 'start';
  }

  get optionLookValue() {
    const look = this.getAttribute('option-look');
    return OPTION_LOOKS.includes(look) ? look : '';
  }

  get effectiveDisabled() {
    return Boolean(this.disabled || this.sfFormDisabled);
  }

  get columnsValue() {
    const columns = String(this.columns ?? 'auto');
    return CHOICE_COLUMNS.includes(columns) ? columns : 'auto';
  }

  get appearanceValue() {
    const appearance = String(this.appearance ?? 'cards');
    return CHOICE_APPEARANCES.includes(appearance) ? appearance : 'cards';
  }

  get layoutValue() {
    const layout = String(this.layout ?? 'tile');
    return CHOICE_LAYOUTS.includes(layout) ? layout : 'tile';
  }

  // Appearance list (C165 (3)): row or column as asked; auto is a row for up
  // to three short options and a column for the rest.
  get flowValue() {
    return listFlow(String(this.flow ?? 'auto'), this.options);
  }

  /** The chosen values, in the order of the options: one, or several when multiple. */
  get selected() {
    const raw = this._value !== undefined ? this._value : this.getAttribute('value');
    return orderValues(parseValue(raw ?? '', Boolean(this.multiple)), this.options);
  }

  /** One value, or the values joined by commas when multiple; '' when nothing is chosen. */
  get value() {
    return formatValue(this.selected);
  }

  // Set from code it is not a change: no event, as for a native field.
  set value(next) {
    this._value = next === undefined || next === null ? undefined : formatValue(parseValue(next, Boolean(this.multiple)));
    // A value the host sets is what was chosen when the list opened (FO4-5);
    // a person's own choice (onChange) does not move the order.
    this._opened = null;
    this.requestComponentUpdate?.('value');
    this.sfSyncFormState?.();
  }

  /** The cards' inputs, in order. */
  get inputs() {
    return [...this.querySelectorAll('.sf-choice-input')].filter((input) => input.closest('sf-input-choice') === this);
  }

  getInputElement() {
    return null;
  }

  // The first card that takes the focus: the chosen one, else the first
  // enabled one -- where Tab lands in a radio group.
  focusDelegate() {
    const inputs = this.inputs.filter((input) => !input.disabled);
    return inputs.find((input) => input.checked) || inputs[0] || null;
  }

  // ---------------------------------------------------------- the person

  onInnerEvent = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('sf-choice-input')
      || input.closest('sf-input-choice') !== this) return;
    event.stopPropagation();
    if (event.type !== 'change') return;
    const item = this.options.find((one) => one.value === input.value);
    if (!item) return;
    const multiple = Boolean(this.multiple);
    const next = applyChoice(this.selected, this.options, item.value, input.checked, multiple);
    this._value = formatValue(next);
    this.requestComponentUpdate('value');
    this.sfSyncFormState();
    const detail = {value: this.value, values: [...next], item: {...item}, checked: input.checked};
    this.sfEmit('input', detail);
    this.sfEmit('change', detail);
  };

  // ---------------------------------------------------------- form

  // The values alone: one entry, or one entry per chosen value under the
  // name (§17.1); nothing while disabled or empty.
  sfFormValue() {
    if (this.effectiveDisabled) return null;
    const entries = this.selected;
    if (!entries.length) return null;
    if (!this.multiple) return entries[0];
    const name = this.name || '';
    if (!name || typeof FormData !== 'function') return entries.join(',');
    const data = new FormData();
    for (const entry of entries) data.append(name, entry);
    return data;
  }

  fieldValidity() {
    const missing = Boolean(this.required) && !this.effectiveDisabled && this.selected.length === 0;
    return {valueMissing: missing, message: missing ? this.sfWord('value-missing') : '', anchor: this.focusDelegate()};
  }

  // form.reset(): the value attribute back, without events.
  fieldReset() {
    this._value = undefined;
    this.requestComponentUpdate('reset');
  }

  fieldRestore(state) {
    let values = state;
    if (typeof FormData === 'function' && state instanceof FormData) values = state.getAll(this.name || '').map(String);
    if (values === null || values === undefined) return;
    this._value = formatValue(parseValue(values, Boolean(this.multiple)));
    this.requestComponentUpdate('restore');
  }

  // ---------------------------------------------------------- drawing

  pagingContext() {
    this._followProvider();
    const pages = this._pages;
    const paged = typeof this.provider === 'function';
    const searchable = Boolean(this.searchable);
    const status = paged ? pages.status
      : searchable && pages.query.trim() && !this.shownOptions.length ? 'empty' : 'ready';
    return {
      shown: paged || searchable,
      searchable,
      query: pages.query,
      status,
      nextCursor: paged ? pages.nextCursor : null,
      retryCursor: pages.retryCursor,
      words: {
        search: this.sfWord('search-label'),
        loading: this.sfWord('loading-options'),
        error: this.sfWord('options-error'),
        empty: this.sfWord('nothing-found'),
        retry: this.sfWord('retry'),
        more: this.sfWord('show-more'),
        found: this.sfWord('select-found'),
      },
      found: this.foundToSelect().length,
    };
  }

  templateContext() {
    const props = this.getPropsContext();
    const internals = Boolean(this.sfInternals);
    const id = partId(instancePath(this, {kind: 'sf-input-choice'}));
    return this.createTemplateContext({
      ...props,
      component: this,
      id,
      items: this.shownOptions,
      chosenLast: this.chosenLastIndex(),
      chosen: new Set(this.selected),
      paging: this.pagingContext(),
      multiple: Boolean(this.multiple),
      columns: this.columnsValue,
      appearance: this.appearanceValue,
      layout: this.layoutValue,
      flow: this.flowValue,
      optionLook: this.optionLookValue,
      controlPosition: this.controlPositionValue,
      panel: this.panelValue,
      label: this.label || '',
      // C165 (1), C153 (8): the «?» after the heading, named by its subject.
      help: this.help || '',
      helpLabel: fieldHelpLabel(this, this.label || ''),
      ariaLabel: this.getAttribute('aria-label') || '',
      hint: this.hint || '',
      // C153 (3): the page's error, or the one the field shows itself (ShownValidity).
      errorMessage: this.sfShownMessage(this.invalid, this.errorMessage || ''),
      invalid: this.sfShownInvalid(this.invalid),
      required: Boolean(this.required),
      // The field's own disabled or a disabled fieldset's (formDisabledCallback),
      // under a name of its own: the disabled getter is the setting alone.
      fieldDisabled: this.effectiveDisabled,
      // Without ElementInternals the named inner inputs submit, as before.
      controlName: internals ? `${id}--choice` : (this.name || `${id}--choice`),
      innerForm: internals ? NO_FORM : '',
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderChoiceTemplate(this.templateContext());
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.sfSyncFormState();
    this.watchMore();
    this.watchTrack();
    return undefined;
  }

  // The list's scrollbar (popup head round 2, PH-6): while the rows scroll
  // the scrollbar's track takes room at their end and the checks move in by
  // it; the search over them marks the list (data-sf-choice-track) and its
  // icon moves in by the track as well, so the two keep one column.
  watchTrack() {
    const scroll = this.querySelector('.sf-choice-scroll');
    const root = scroll?.closest('.sf-choice') ?? null;
    if (scroll !== this._trackWatched) {
      this._trackWatch?.disconnect();
      this._trackWatched = scroll;
      const Observer = this.ownerDocument?.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
      if (scroll && typeof Observer === 'function') {
        this._trackWatch ??= new Observer(() => this.markTrack());
        this._trackWatch.observe(scroll);
        if (scroll.firstElementChild) this._trackWatch.observe(scroll.firstElementChild);
      }
    }
    if (root) this.markTrack();
  }

  markTrack() {
    const scroll = this._trackWatched;
    const root = scroll?.closest('.sf-choice');
    if (!root) return;
    root.toggleAttribute('data-sf-choice-track', scroll.offsetWidth - scroll.clientWidth > 0);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._trackWatch?.disconnect();
    this._trackWatch = null;
    this._trackWatched = null;
  }

  // FO4-4: the host's next page loads when the list is scrolled to its end
  // (the mark after «Показать ещё» comes into view, in the window or the
  // box that scrolls the list); the button stays the last row, for the keyboard and for a
  // browser without IntersectionObserver.
  watchMore() {
    const more = this.querySelector(':scope .sf-choice-end[data-sf-more]');
    if (more === this._moreWatched) return;
    this._moreWatch?.disconnect();
    this._moreWatched = more;
    const Observer = this.ownerDocument?.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
    if (!more || typeof Observer !== 'function') return;
    this._moreWatch ??= new Observer((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      const pages = this._pages;
      if (pages.nextCursor && pages.status !== 'loading') this.loadPage(pages.nextCursor);
    });
    this._moreWatch.observe(more);
  }
}

SfInputChoice.define('sf-input-choice');

export {SfInputChoice};

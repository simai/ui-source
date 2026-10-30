import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import BundledPosition from '../../core/js/position.js';
import {holdOpenSurfaceMark} from '../../core/js/open-surface-mark';
import {pageLocale} from '../../core/js/page-language.js';
import {fieldSize} from '../../component/field-size';
import {FormField} from '../helpers/form-field';
import {renderLookupTemplate} from './js/templates/default';
import {
  DEFAULTS,
  appendItems,
  choose,
  chosenList,
  excludedKeys,
  filterOptions,
  formEntries,
  isChosen,
  moveActive,
  normaliseItems,
  normaliseValue,
  readAnswer,
  removeChosen,
  searchPlan,
  wholeNumber,
} from './js/lookup-model.mjs';
import manifest from './component.json';
import en from './lang/en.json';
import ru from './lang/ru.json';
import './scss/index.scss';

// sf-lookup: the people and object picker. A form field whose value is the
// field renderer's lookup value -- {value, label}, or a list of them when
// multiple -- chosen from a search the host answers through `provider`, or
// from a short list given whole (`options`).
//
// From its component.json (standard simai.smart-component 1.3.14 §3, §4, §8,
// §17): the settings are made by core/js/element-manifest.js; the field is the
// form control through ElementInternals and sends the values alone. A choice
// and a removed chip say input and change; a value set from code, a form reset
// and a restore say nothing.
//
// The search (js/lookup-model.mjs holds its pure parts): below min-length the
// list shows the hint and nothing is asked; after `debounce` the provider is
// called with {cursor, limit, signal}; a new call aborts the previous one and
// an answer for an older call is dropped; {status: 'unavailable'} is the
// neutral line, an error the line with Retry; nextCursor is Show more.

const LookupElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'en',
});

// Core publishes the helper; a bundle loaded without core.js positions with
// its own copy (as sf-dropdown's portal does).
const position = () => globalThis.SF?.Position || BundledPosition;

class SfLookup extends FormField(LookupElement) {
  static get props() {
    return {
      ...super.props,
      rootClass: {attribute: 'root-class', default: ''},
    };
  }

  // value is a property (an object or a list), but a page prints it as an
  // attribute too (JSON, or a bare value read against the options).
  static get observedAttributes() {
    return [...new Set([...super.observedAttributes, 'value'])];
  }

  constructor() {
    super();
    this._value = undefined;
    this._query = '';
    this._dirty = false;
    this._open = false;
    this._state = 'closed';
    this._items = [];
    this._nextCursor = null;
    this._notice = '';
    this._active = -1;
    this._refusal = '';
    this._loadingMore = false;
    this._seq = 0;
    this._controller = null;
    this._timer = 0;
    this._last = null;
    this._anchor = null;
    this._anchorPanel = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // The value attribute is the default a form reset returns to; written
    // again, it is the value again.
    if (name === 'value' && oldValue !== newValue) {
      this._value = undefined;
      this._dirty = false;
      this._query = '';
      this.sfSyncFormState?.();
    }
    if (name === 'disabled' || name === 'readonly') this._close();
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  // ---------------------------------------------------------- settings

  get size() {
    return fieldSize(this.getAttribute('size') || '1', 'sf-lookup');
  }

  get effectiveDisabled() {
    return Boolean(this.disabled || this.sfFormDisabled);
  }

  get editable() {
    return !this.effectiveDisabled && !this.readonly;
  }

  get input() {
    return this.querySelector('.sf-lookup-input');
  }

  _minLength() {
    return wholeNumber(this.minLength, DEFAULTS.minLength);
  }

  _maxResults() {
    return wholeNumber(this.maxResults, DEFAULTS.maxResults, {min: 1});
  }

  _debounce() {
    return wholeNumber(this.debounce, DEFAULTS.debounce);
  }

  _maxItems() {
    return this.multiple ? wholeNumber(this.maxItems, 0) : 0;
  }

  _options() {
    return normaliseItems(this.options);
  }

  _exclude() {
    return excludedKeys(this.exclude);
  }

  _provider() {
    return typeof this.provider === 'function' ? this.provider : null;
  }

  /**
   * The value: single {value, label, caption?, avatar?} or null; multiple a
   * list in the order chosen ([] when nothing is).
   */
  get value() {
    const options = this.options;
    if (this._value !== undefined) return normaliseValue(this._value, {multiple: Boolean(this.multiple), options});
    return normaliseValue(this.getAttribute('value'), {multiple: Boolean(this.multiple), options});
  }

  // Set from code it is not a change: no event, as for a native field.
  set value(next) {
    this._value = next === undefined ? undefined : normaliseValue(next, {multiple: Boolean(this.multiple), options: this.options});
    this._dirty = false;
    this._query = '';
    this.requestComponentUpdate('value');
    this.sfSyncFormState();
  }

  isItemChosen(item) {
    return isChosen(this.value, item);
  }

  focusDelegate() {
    return this.input;
  }

  // ---------------------------------------------------------- form

  // The values alone: one entry, or one entry per chosen value under the
  // name (§17.1); nothing while disabled or empty.
  sfFormValue() {
    if (this.effectiveDisabled) return null;
    const entries = formEntries(this.value);
    if (!entries.length) return null;
    if (!this.multiple) return entries[0];
    const name = this.name || '';
    if (!name || typeof FormData !== 'function') return entries.join(',');
    const data = new FormData();
    for (const entry of entries) data.append(name, entry);
    return data;
  }

  fieldValidity() {
    const missing = Boolean(this.required) && !this.effectiveDisabled && formEntries(this.value).length === 0;
    return {valueMissing: missing, message: missing ? this.sfWord('value-missing') : '', anchor: this.input};
  }

  // form.reset(): the value attribute back, without events.
  fieldReset() {
    this._value = undefined;
    this._dirty = false;
    this._query = '';
    this._refusal = '';
    this._close();
    this.requestComponentUpdate('reset');
  }

  // The form's saved entries: the values; their labels are what the options
  // know, else the values themselves.
  fieldRestore(state) {
    let values = state;
    if (typeof FormData === 'function' && state instanceof FormData) values = state.getAll(this.name || '').map(String);
    if (values === null || values === undefined) return;
    this._value = normaliseValue(Array.isArray(values) ? values : [values].filter((one) => one !== ''), {multiple: Boolean(this.multiple), options: this.options});
    this.requestComponentUpdate('restore');
  }

  // ---------------------------------------------------------- drawing

  templateContext() {
    const props = this.getPropsContext();
    const chosen = chosenList(this.value);
    const multiple = Boolean(this.multiple);
    return this.createTemplateContext({
      ...props,
      size: this.size,
      appearance: this.appearance,
      label: this.label || '',
      hint: this.hint || '',
      placeholder: this.placeholder || '',
      errorMessage: this.errorMessage || '',
      name: this.name || '',
      multiple,
      required: Boolean(this.required),
      readonly: Boolean(this.readonly),
      invalid: Boolean(this.invalid),
      // The form's disabled fieldset counts too, so the drawn state is not the
      // `disabled` getter's: it travels under its own name.
      fieldDisabled: this.effectiveDisabled,
      editable: this.editable,
      // The resolved value, as the getter answers it (a list when multiple).
      value: this.value,
      chosen,
      // A single field shows its chosen label while the person is not searching.
      queryText: !multiple && !this._dirty && chosen[0] ? String(chosen[0].label) : this._query,
      queryMaxLength: wholeNumber(this.maxlength, 0),
      minChars: this._minLength(),
      listOpen: this._open,
      listState: this._state,
      items: this._items,
      activeIndex: this._active,
      nextCursor: this._nextCursor,
      notice: this._notice,
      loadingMore: this._loadingMore,
      refusal: this._refusal,
      ariaLabel: this.getAttribute('aria-label') || '',
      component: this,
    });
  }

  template() {
    return renderLookupTemplate(this.templateContext());
  }

  afterRender() {
    this._syncPanel();
    this._scrollActiveIntoView();
    this.sfSyncFormState();
  }

  onDisconnected() {
    this._close({render: false});
    this._syncPanel({force: false});
    super.onDisconnected?.();
  }

  // The panel is a manual popover in the top layer, anchored under the frame
  // at its width; it flips above when there is no room (SF.Position).
  _syncPanel({force} = {}) {
    const panel = this.querySelector('.sf-lookup-panel');
    const frame = this.querySelector('.sf-lookup-frame');
    const open = (force ?? this._open) && Boolean(panel && frame) && this.isConnected;
    if (open) {
      try {
        if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
      } catch {
        // No popover in this browser: the sheet shows the panel in place.
      }
      if (!this._anchor || this._anchorPanel !== panel) {
        this._anchor?.stop();
        this._anchor = position().anchor(frame, panel, {side: 'block-end', align: 'start', matchWidth: true, fitHeight: true, autoUpdate: true});
        this._anchorPanel = panel;
      } else {
        this._anchor.update();
      }
    } else {
      this._anchor?.stop();
      this._anchor = null;
      this._anchorPanel = null;
      try {
        if (panel?.matches?.(':popover-open')) panel.hidePopover();
      } catch {
        // Nothing to hide.
      }
    }
    holdOpenSurfaceMark(this, open);
  }

  _scrollActiveIntoView() {
    if (!this._open || this._active < 0) return;
    const rows = this.querySelectorAll('.sf-lookup-option');
    rows[this._active]?.scrollIntoView?.({block: 'nearest'});
  }

  // ---------------------------------------------------------- the search

  _abort() {
    clearTimeout(this._timer);
    this._timer = 0;
    if (this._controller) {
      this._controller.abort();
      this._controller = null;
    }
    // Whatever was asked before is older than what comes next.
    this._seq += 1;
    this._loadingMore = false;
  }

  _openList() {
    if (!this.editable) return false;
    if (!this._open) {
      this._open = true;
      this._plan(this._dirty || this.multiple ? this._query : '', {immediate: true});
    }
    return true;
  }

  _close({render = true} = {}) {
    if (!this._open && this._state === 'closed' && !this._controller && !this._timer) return;
    this._abort();
    this._open = false;
    this._state = 'closed';
    this._items = [];
    this._nextCursor = null;
    this._notice = '';
    this._active = -1;
    this._refusal = '';
    if (render) this.requestComponentUpdate('close');
  }

  // What a query shows: the inline options filtered in place, the hint, or a
  // call to the provider after the debounce (at once when `immediate`).
  _plan(query, {immediate = false} = {}) {
    this._abort();
    this._refusal = '';
    const options = this._options();
    const plan = searchPlan(query, {minLength: this._minLength(), hasOptions: options.length > 0, hasProvider: Boolean(this._provider())});
    this._nextCursor = null;
    this._notice = '';
    this._active = -1;
    if (plan === 'local') {
      this._items = filterOptions(options, query, {exclude: this._exclude(), locale: pageLocale(this)});
      this._state = this._items.length ? 'results' : 'empty';
    } else if (plan === 'hint') {
      this._items = [];
      this._state = 'hint';
    } else if (plan === 'none') {
      this._items = [];
      this._state = 'unavailable';
    } else {
      const delay = immediate ? 0 : this._debounce();
      if (delay > 0) this._timer = setTimeout(() => this._call(query, null), delay);
      else this._call(query, null);
    }
    this.requestComponentUpdate('search');
  }

  async _call(query, cursor) {
    this._timer = 0;
    const provider = this._provider();
    if (!provider || !this.isConnected) return;
    if (this._controller) this._controller.abort();
    const controller = new AbortController();
    this._controller = controller;
    this._seq += 1;
    const seq = this._seq;
    this._last = {query, cursor};
    const limit = this._maxResults();
    if (cursor === null) {
      this._state = 'searching';
      this._items = [];
      this._nextCursor = null;
      this._notice = '';
      this._active = -1;
    } else {
      this._loadingMore = true;
    }
    this.requestComponentUpdate('searching');
    let answer;
    let failed = false;
    try {
      answer = await Promise.resolve().then(() => provider.call(null, query, {cursor, limit, signal: controller.signal}));
    } catch (error) {
      failed = true;
      answer = error;
    }
    // A late answer -- of a call aborted or overtaken -- is dropped.
    if (seq !== this._seq || controller.signal.aborted || !this._open) return;
    this._controller = null;
    this._loadingMore = false;
    const read = failed ? {state: 'error', items: [], nextCursor: null} : readAnswer(answer, {exclude: this._exclude(), limit});
    if (cursor === null) {
      this._items = read.items;
      this._state = read.state;
    } else if (read.state === 'error' || read.state === 'unavailable') {
      this._state = read.state;
    } else {
      this._items = appendItems(this._items, read.items);
      this._state = this._items.length ? 'results' : 'empty';
    }
    // Retry repeats the call that failed; a good page moves on.
    this._nextCursor = read.state === 'error' ? cursor : read.nextCursor;
    this._notice = read.notice ?? '';
    if (this._active >= this._items.length) this._active = this._items.length - 1;
    this.requestComponentUpdate('answer');
  }

  /** Searches a query at once, as typing does, opening the list. */
  search(query) {
    if (!this.editable) return false;
    this._query = String(query ?? '');
    this._dirty = true;
    this._open = true;
    this._plan(this._query, {immediate: true});
    return true;
  }

  /** Repeats the last call to the provider, with its query and cursor. */
  retry() {
    if (!this._last || !this._provider() || !this.editable) return false;
    this._open = true;
    this._abort();
    this._call(this._last.query, this._last.cursor);
    return true;
  }

  /** Asks the provider for the next page (Show more). */
  showMore() {
    if (this._nextCursor === null || this._state !== 'results' || !this._last) return false;
    this._abort();
    this._call(this._last.query, this._nextCursor);
    return true;
  }

  /** Closes the list and drops a search still running; the query stays. */
  close() {
    const was = this._open;
    this._close();
    return was;
  }

  // ---------------------------------------------------------- choosing

  _say(detail) {
    this.sfEmit('input', detail);
    this.sfEmit('change', detail);
  }

  _write(next) {
    this._value = next;
    this.sfSyncFormState();
  }

  chooseIndex(index) {
    const item = this._items[index];
    if (!item || !this.editable) return false;
    const multiple = Boolean(this.multiple);
    const result = choose(this.value, item, {multiple, maxItems: this._maxItems()});
    if (result.outcome === 'refused') {
      this._refusal = this.sfWord('max-items', {count: this._maxItems()});
      this._active = index;
      this.requestComponentUpdate('refused');
      return false;
    }
    this._refusal = '';
    if (result.outcome !== 'unchanged') {
      this._write(result.value);
      this._say({value: this.value, item: {...item}, action: result.outcome});
    }
    if (!multiple) {
      // A single choice commits and closes the list; the box shows its label.
      this._dirty = false;
      this._query = '';
      this._close({render: false});
    } else {
      this._active = index;
    }
    this.requestComponentUpdate('choose');
    return true;
  }

  _removeItem(item) {
    if (!this.editable) return false;
    const next = removeChosen(this.value, item.value, {multiple: Boolean(this.multiple)});
    this._refusal = '';
    this._write(next);
    this._say({value: this.value, item: {...item}, action: 'removed'});
    this.requestComponentUpdate('remove');
    return true;
  }

  // ---------------------------------------------------------- the search box

  onQueryInput(event) {
    // The box's own input is not the field's: typing is not a change of value.
    event.stopPropagation();
    if (!this.editable) return;
    this._query = String(event.target?.value ?? '');
    this._dirty = true;
    this._open = true;
    this._plan(this._query);
  }

  onQueryFocus() {
    // A single field's label is selected, so typing replaces it.
    const input = this.input;
    if (input && !this.multiple && !this._dirty && input.value) input.select?.();
  }

  onQueryKeydown(event) {
    if (event.isComposing || !this.editable) return;
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!this._open) {
        this._openList();
        return;
      }
      this._moveTo(moveActive(this._active, this._items.length, key));
      return;
    }
    if ((key === 'Home' || key === 'End') && this._open && this._items.length) {
      event.preventDefault();
      this._moveTo(moveActive(this._active, this._items.length, key));
      return;
    }
    if (key === 'Enter') {
      if (this._open && this._active >= 0) {
        event.preventDefault();
        this.chooseIndex(this._active);
      } else if (this._open) {
        // The list is open: Enter belongs to it, not to the form.
        event.preventDefault();
      }
      return;
    }
    if (key === 'Escape') {
      if (this._open) {
        event.preventDefault();
        event.stopPropagation();
        this._close();
        return;
      }
      if (this._query || this._dirty) {
        event.preventDefault();
        event.stopPropagation();
        this._query = '';
        this._dirty = false;
        this.requestComponentUpdate('clear-query');
      }
      return;
    }
    if (key === 'Backspace' && this.multiple && !event.target?.value) {
      const chosen = chosenList(this.value);
      if (chosen.length) {
        event.preventDefault();
        this._removeItem(chosen[chosen.length - 1]);
      }
    }
  }

  _moveTo(index) {
    if (index === this._active) return;
    this._active = index;
    this.requestComponentUpdate('active');
  }

  // ---------------------------------------------------------- pointer

  onFrameClick(event) {
    if (event.target?.closest?.('sf-tag, button')) return;
    if (!this.effectiveDisabled) this.input?.focus();
  }

  // A press anywhere in the list keeps the focus in the search box; Retry and
  // Show more still hear the click.
  onPanelMouseDown(event) {
    event.preventDefault();
  }

  // Retry and Show more go away while the call runs: the focus goes back to
  // the search box first, so a keyboard press on them does not leave the field.
  onRetryClick() {
    this.input?.focus({preventScroll: true});
    this.retry();
  }

  onShowMoreClick() {
    this.input?.focus({preventScroll: true});
    this.showMore();
  }

  onPanelClick(event) {
    const option = event.target?.closest?.('.sf-lookup-option');
    if (!option) return;
    event.preventDefault();
    this.chooseIndex(Number(option.dataset.sfIndex));
  }

  onChipClose(event, item) {
    event.stopPropagation();
    this._removeItem(item);
    // The chip goes with its button: the focus goes back to the search box.
    this.input?.focus({preventScroll: true});
  }

  onClearClick(event) {
    event.preventDefault();
    const chosen = chosenList(this.value);
    if (!chosen.length || !this.editable) return;
    this._removeItem(chosen[0]);
    this._dirty = false;
    this._query = '';
    this.input?.focus({preventScroll: true});
  }

  onRootPointerDown(event) {
    if (event.target?.closest?.('.sf-lookup-frame')) this.querySelector('.sf-lookup')?.classList.add('sf-lookup--pointer-focus');
  }

  // Leaving the field closes the list; a single field shows its label again.
  onRootFocusOut(event) {
    const next = event.relatedTarget;
    if (next && this.contains(next)) return;
    this.querySelector('.sf-lookup')?.classList.remove('sf-lookup--pointer-focus');
    if (!this.multiple && this._dirty) {
      this._dirty = false;
      this._query = '';
    }
    this._close({render: false});
    this.requestComponentUpdate('leave');
  }
}

SfLookup.define('sf-lookup');

export default SfLookup;

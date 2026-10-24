import SfBaseElement, { toBoolean } from '../../core/js/smart-base';
import { pageText } from '../../core/js/page-language';
import { fieldSize } from '../../component/field-size';
import { renderDropdownTemplate } from './js/templates/default';
import { createDropdownInteraction } from '../../component/dropdown/interaction';
import { bindFormReset } from '../../component/form-reset-helper';
import { openDropdownPortal, closeDropdownPortal } from '../../component/dropdown/portal';
import { holdOpenSurfaceMark } from '../../core/js/open-surface-mark';
import { InheritedValueField } from '../helpers/inherited-value';

const DROPDOWN_TEXT = { en: { search: 'Search' }, ru: { search: 'Поиск' } };

function normalizeSize(value) {
  return fieldSize(value, 'sf-dropdown');
}

function normalizeListItemType(value) {
  const normalized = String(value || '').toLowerCase();
  const supported = ['text', 'icon', 'checkbox', 'avatar', 'color'];
  return supported.includes(normalized) ? normalized : 'text';
}

function parseOptionNode(node, dropdownSize = '1') {
  if (!(node instanceof HTMLElement)) return null;
  if (node.tagName.toLowerCase() !== 'sf-list-item') return null;

  return {
    type: normalizeListItemType(node.getAttribute('kind') || node.getAttribute('type')),
    size: normalizeSize(node.getAttribute('size') || dropdownSize),
    text: node.getAttribute('text') || '',
    icon: node.getAttribute('icon') || 'person',
    checked: node.hasAttribute('checked') || toBoolean(node.getAttribute('checked')),
    selected: node.hasAttribute('selected') || toBoolean(node.getAttribute('selected')),
    disabled: node.hasAttribute('disabled') || toBoolean(node.getAttribute('disabled')),
    colorClass: node.getAttribute('color-class') || 'bg-tertiary',
    avatarImageUrl: node.getAttribute('avatar-image-url') || '',
    avatarTitle: node.getAttribute('avatar-title') || node.getAttribute('text') || '',
    value: node.getAttribute('value') ?? node.getAttribute('text') ?? '',
    ariaLabel: node.getAttribute('aria-label') || '',
    // Where this option comes from. Options carrying the same group, one after
    // another, are drawn under one heading.
    group: node.getAttribute('group') || '',
  };
}

// An option may also arrive as data rather than as a child element. The shape is
// the one parseOptionNode produces, so both paths answer the same questions and
// a missing field falls back the same way.
function parseOptionData(option, dropdownSize = '1') {
  if (!option || typeof option !== 'object') return null;
  const text = option.text === undefined || option.text === null ? '' : String(option.text);
  const value = option.value === undefined || option.value === null ? text : String(option.value);
  if (text === '' && value === '') return null;

  return {
    // `kind` is the list item's axis; `type` its legacy name.
    type: normalizeListItemType(option.kind || option.type),
    size: normalizeSize(option.size || dropdownSize),
    text,
    icon: option.icon ? String(option.icon) : 'person',
    checked: toBoolean(option.checked),
    selected: toBoolean(option.selected),
    disabled: toBoolean(option.disabled),
    colorClass: option.colorClass ? String(option.colorClass) : 'bg-tertiary',
    avatarImageUrl: option.avatarImageUrl ? String(option.avatarImageUrl) : '',
    avatarTitle: option.avatarTitle ? String(option.avatarTitle) : text,
    value,
    ariaLabel: option.ariaLabel ? String(option.ariaLabel) : '',
    group: option.group ? String(option.group) : '',
  };
}

function parseOptionList(value, dropdownSize = '1') {
  let list = value;
  if (typeof list === 'string') {
    const text = list.trim();
    if (text === '') return [];
    try {
      list = JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((option) =>
      typeof option === 'string' || typeof option === 'number'
        ? parseOptionData({ text: String(option), value: String(option) }, dropdownSize)
        : parseOptionData(option, dropdownSize),
    )
    .filter(Boolean);
}

function splitValues(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeValues(values = []) {
  return values.map((value) => String(value)).join(',');
}

function getOptionLabel(option = {}) {
  if (option.type === 'avatar') return option.avatarTitle || option.text || option.value || '';
  return option.text || option.avatarTitle || option.value || '';
}

class SfDropdown extends InheritedValueField(SfBaseElement) {
  constructor() {
    super();
    this._options = [];
    this._optionsCaptured = false;
    this._optionsFromData = false;
    this._open = false;
    this._searchValue = '';
    this._selectedValues = [];
    this._dropdownRoot = null;
    this._list = null;
    this._documentClickHandler = this.handleDocumentClick.bind(this);
    this._viewportHandler = this.positionPortalList.bind(this);
  }

  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      size: { default: '1' },
      // The axis is called appearance, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      appearance: {default: 'outlined', values: ['filled', 'outlined'], aliases: ['type']},
      mode: { default: 'select', values: ['tag', 'select'] },
      multiple: { type: Boolean, default: false },
      portal: { type: Boolean, default: true },
      value: { default: '' },
      name: { default: '' },
      label: { default: '' },
      required: { type: Boolean, default: false },
      placeholder: { default: '' },
      searchPlaceholder: { default: '' },
      search: { type: Boolean, default: true },
      // How the options are laid out. A list is one option a row; a grid puts
      // several in a row, which is the only way a hundred icons can be looked
      // at -- a column of them is a column nobody scrolls to the end of.
      layout: { default: 'list', values: ['list', 'grid'] },
      columns: { default: '6' },
      disabled: { type: Boolean, default: false },
      ariaLabel: { default: '' },
      // The option value the field falls back to while nothing is chosen
      // (simai/ui-source#28): its label is shown as inherited, in select mode.
      inheritedValue: { attribute: 'inherited-value', default: '' },
      inheritedText: { attribute: 'inherited-text', default: '' },
      resetLabel: { attribute: 'reset-label', default: '' },
    };
  }

  connectedCallback() {
    this.captureOptions();
    if (!Object.prototype.hasOwnProperty.call(this, '_resetValues')) {
      this._resetValues = [...this.selectedValues];
    }
    super.connectedCallback();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'value') this._selectedValues = splitValues(newValue);
      if (name === 'disabled' && this.disabled) {
        this._open = false;
        this._searchValue = '';
      }
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  get componentName() {
    return 'dropdown';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get size() {
    return normalizeSize(this.getAttribute('size'));
  }

  get appearance() {
    return this.getProp('appearance');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.appearance;
  }

  get mode() {
    return this.getEnumAttr('mode', ['tag', 'select'], 'select');
  }

  get multiple() {
    if (!this.hasAttribute('multiple')) {
      return this.mode === 'tag';
    }

    return this.getBooleanAttr('multiple', true);
  }

  get portal() {
    return this.getBooleanAttr('portal', true);
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  get selectedValue() {
    return this.getAttribute('value') || '';
  }

  get label() {
    return this.getAttribute('label') || '';
  }

  get required() {
    return this.getBooleanAttr('required', false);
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  // The control a person reaches is the readonly input inside the trigger, and
  // nothing named it (simai/ui-source#32, axe «label», critical, in ui-mail):
  // the visible label is a sibling span, not the wrapping <label>, and a name
  // given to the host -- aria-label, a <label for> or aria-labelledby pointing
  // at it -- names the host, which is not the control. The name is taken in
  // that order of precedence: the drawn label, then what the page said about
  // the host.
  accessibleName() {
    if (this.getProp('label')) return this.getProp('label');
    const own = this.getAttribute('aria-label');
    if (own) return own;
    const byIds = (this.getAttribute('aria-labelledby') || '')
      .split(/\s+/u)
      .filter(Boolean)
      .map((id) => this.ownerDocument?.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ');
    if (byIds) return byIds;
    const labels = this.id && this.ownerDocument
      ? [...this.ownerDocument.querySelectorAll('label[for]')].filter((label) => label.htmlFor === this.id)
      : [];
    return labels.map((label) => label.textContent.trim()).filter(Boolean).join(' ');
  }

  get searchPlaceholder() {
    // The search field read «Placeholder» on every page; a native change it
    // fires when left is stopped in the template, so the dropdown's own change
    // is the only one a listener on it hears.
    return this.getAttribute('search-placeholder') || pageText(DROPDOWN_TEXT, 'search', this);
  }

  get layout() {
    return this.getEnumAttr('layout', ['list', 'grid'], 'list');
  }

  get columns() {
    const value = Number.parseInt(this.getAttribute('columns') ?? '', 10);
    return Number.isFinite(value) && value > 0 ? String(value) : '6';
  }

  get search() {
    return this.getBooleanAttr('search', true);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  get selectedValues() {
    return this.hasAttribute('value') ? splitValues(this.selectedValue) : this._selectedValues;
  }

  get selectedOptions() {
    const options = this.options;
    return [...new Set(this.selectedValues)]
      .map(value => options.find(option => String(option.value) === value))
      .filter(Boolean);
  }

  get triggerText() {
    if (this.mode === 'tag') {
      return '';
    }

    const options = this.multiple ? this.selectedOptions : this.selectedOptions.slice(0, 1);
    return options.map(getOptionLabel).join(', ');
  }

  get hiddenValue() {
    return this.selectedValues.join(',');
  }

  captureOptions() {
    if (this._optionsFromData) {
      return;
    }

    const optionNodes = Array.from(this.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        child.tagName.toLowerCase() === 'sf-list-item',
    );

    if (!optionNodes.length) {
      return;
    }

    this._options = optionNodes
      .map((node) => parseOptionNode(node, this.size))
      .filter(Boolean);
    this._optionsCaptured = true;

    if (!this.selectedValue && !this._selectedValues.length) {
      this._selectedValues = this._options
        .filter((option) => option.selected)
        .map((option) => String(option.value));
    }

    optionNodes.forEach((child) => child.remove());
  }

  /**
   * Options given as data instead of as child elements. A Smart parent that
   * renders this dropdown from a template owns those children, and capturing
   * them means removing them, which takes them out of the parent's hands for
   * good: it can no longer put a changed list back. Data has no owner to take
   * them from.
   */
  set options(value) {
    const next = parseOptionList(value, this.size);
    this._optionsFromData = true;
    this._options = next;
    this._optionsCaptured = true;
    if (!this.selectedValue && !this._selectedValues.length) {
      this._selectedValues = next.filter((option) => option.selected).map((option) => String(option.value));
    }
    this.requestComponentUpdate('options');
  }

  get options() {
    if (!Array.isArray(this._options) || !this._options.length) {
      return [];
    }

    const selectedSet = new Set(this.selectedValues);

    return this._options.map((option) => ({
      ...option,
      size: normalizeSize(option.size || this.size),
      selected: selectedSet.has(String(option.value)),
    }));
  }

  get visibleOptions() {
    const query = String(this._searchValue || '').trim().toLowerCase();

    if (!query) {
      return this.options;
    }

    return this.options.filter((option) =>
      getOptionLabel(option).toLowerCase().includes(query),
    );
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      open: this._open,
      multiple: this.multiple,
      value: this.hiddenValue,
      triggerText: this.triggerText,
      searchValue: this._searchValue,
      searchPlaceholder: this.searchPlaceholder,
      accessibleName: this.accessibleName(),
      selectedValues: this.selectedValues,
      selectedOptions: this.selectedOptions,
      options: this.visibleOptions,
      inheritedValue: this.inheritedValue,
      inheritedLabel: this.hasInheritedValue ? this.inheritedDisplayValue() : '',
    });
  }

  // The inherited-value seam. The value is the selection; what the inherited
  // value reads as is its options' labels, as a chosen value reads -- a machine
  // value in the field would be a value nobody can recognise.
  inheritedOwnValue() {
    return this.hiddenValue;
  }

  inheritedDisplayValue() {
    const options = this.options;
    return splitValues(this.inheritedValue)
      .map((value) => {
        const option = options.find((item) => String(item.value) === value);
        return option ? getOptionLabel(option) : value;
      })
      .join(', ');
  }

  // The trigger is what a keyboard reaches and what names the field.
  inheritedFocusTarget() {
    return this.querySelector('.sf-dropdown-field > button');
  }

  // A reset is a change the person made: said as change, once, like removing
  // the last tag.
  clearOwnValue() {
    this._selectedValues = [];
    this.setAttributeValue('value', '');
    this.dispatchDropdownChange(null, []);
    this.requestComponentUpdate('reset-to-inherited');
  }

  template() {
    return renderDropdownTemplate(this.templateContext());
  }

  beforeRender() {
    this.captureOptions();
  }

  afterRender() {
    const previousRoot = this._dropdownRoot;
    const previousList = this._list;
    this._dropdownRoot = this.querySelector('.sf-dropdown');
    // Lit keeps references to this node even while the fallback projects it.
    this._list = this.querySelector('.sf-list') || (previousRoot===this._dropdownRoot ? previousList : null);
    if (previousList !== this._list) closeDropdownPortal(previousList);
    this.syncDocumentListeners();
    this.syncPortalListeners();
    this.syncOpenSurfaceMark();
    this.positionPortalList();
    if (previousRoot !== this._dropdownRoot) {
      this._interaction?.release();
      this._interaction = null;
    }
    if (this._dropdownRoot && !this._interaction) {
      this._interaction = createDropdownInteraction(this._dropdownRoot, {
        owner: this,
        getList: () => this._list,
        isOpen: () => this._open,
        isDisabled: () => this.disabled,
        isMultiple: () => this.multiple,
        open: () => this.openDropdown(),
        close: () => this.closeDropdown(),
        select: item => this.selectValue(item.dataset.value || ''),
        selectedLabels: () => this.selectedOptions.map(getOptionLabel),
      });
    }
    this._interaction?.refresh();
    this.syncInheritedState();
    const resetControl = this.querySelector('.sf-dropdown-hidden-input') ||
      this.querySelector('.sf-dropdown-field > button');
    if (this._resetControl !== resetControl) {
      this._releaseReset?.();
      this._resetControl = resetControl;
      this._releaseReset = resetControl ? bindFormReset(resetControl, () => {
        this._interaction?.beforeClose();
        this._selectedValues = [...this._resetValues];
        this.setAttributeValue('value', serializeValues(this._selectedValues));
        this._open = false;
        this._searchValue = '';
        // Native reset may change the display even when Lit's cached value has
        // not changed. The component owns this property synchronization.
        const display = this.querySelector('.sf-dropdown-field input:not([type="hidden"])');
        if (display) display.value = this.triggerText;
        this.requestComponentUpdate('reset');
      }) : null;
    }
  }

  onDisconnected() {
    holdOpenSurfaceMark(this, false);
    closeDropdownPortal(this._list);
    this._releaseReset?.();
    this._releaseReset = null;
    this._resetControl = null;
    this._interaction?.release();
    this._interaction = null;
    this.removeDocumentListeners();
    this.removePortalListeners();
    super.onDisconnected();
  }

  openDropdown() {
    if (this.disabled || this._open) return this;
    this._open = true;
    this.requestComponentUpdate('open');
    return this;
  }

  closeDropdown() {
    if (!this._open) return this;
    this._interaction?.beforeClose();
    this._open = false;
    this._searchValue = '';
    this.requestComponentUpdate('close');
    return this;
  }

  toggleDropdown() {
    if (this._open) {
      return this.closeDropdown();
    }

    return this.openDropdown();
  }

  handleTriggerClick(event) {
    if (this.disabled) return;
    event?.preventDefault?.();
    this.toggleDropdown();
  }

  handleSearchInput(event) {
    this._searchValue = event?.target?.value || '';
    this.requestComponentUpdate('search');
  }

  handleOptionClick(event) {
    if (this.disabled) return;
    const item = event.target?.closest?.('.sf-list-item');
    if (!item || (!this.contains(item) && !this._list?.contains(item)) || item.classList.contains('disabled')) {
      return;
    }

    event.preventDefault();
    this.selectValue(item.dataset.value || '');
  }

  handleOptionKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    this.handleOptionClick(event);
  }

  handleDocumentClick(event) {
    if (!this._open || this.contains(event.target) || this._list?.contains(event.target)) {
      return;
    }

    this.closeDropdown();
  }

  selectValue(value = '') {
    if (this.disabled) return this;
    const option = this.options.find(
      (item) => String(item.value) === String(value),
    );

    if (!option || option.disabled) {
      return this;
    }

    // Picking the item already chosen changes nothing, so it sends no change --
    // as a native select does. It sent one per pick, the same value again.
    const unchanged = !this.multiple
      && this.selectedValues.length === 1
      && this.selectedValues[0] === String(option.value);

    if (this.multiple) {
      const selected = new Set(this.selectedValues);
      if (selected.has(String(option.value))) {
        selected.delete(String(option.value));
      } else {
        selected.add(String(option.value));
      }
      this._selectedValues = Array.from(selected);
    } else {
      this._selectedValues = [String(option.value)];
    }

    const nextValues = [...this._selectedValues];
    this.setAttributeValue('value', serializeValues(nextValues));
    if (!unchanged) this.dispatchDropdownChange(option, nextValues);

    if (!this.multiple) {
      this._interaction?.beforeClose();
      this._open = false;
      this._searchValue = '';
    }

    this.requestComponentUpdate('select');
    return this;
  }

  removeSelectedValue(value = '') {
    if (this.disabled) return this;
    const selected = new Set(this.selectedValues);
    selected.delete(String(value));
    this._selectedValues = Array.from(selected);
    const nextValues = [...this._selectedValues];
    this.setAttributeValue('value', serializeValues(nextValues));
    this.dispatchDropdownChange(null, nextValues);
    this.requestComponentUpdate('remove-tag');
    return this;
  }

  dispatchDropdownChange(option = null, values = this.selectedValues) {
    const detail = {
      value: option?.value || '',
      label: option ? getOptionLabel(option) : '',
      values,
      item: option,
      root: this,
      multiple: this.multiple,
    };

    this.dispatchEvent(
      new CustomEvent('sf-dropdown:change', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );

    this.dispatchEvent(
      new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  // An open list owns Escape, so the root says a surface is open and a drawer, a
  // modal or a record panel leaves that press alone -- they listen on the
  // document in capture and would otherwise close before the list saw the key.
  // Synced from the rendered state, because `_open` is set from several places
  // and every one of them ends in an update.
  syncOpenSurfaceMark() {
    holdOpenSurfaceMark(this, this._open);
  }

  syncDocumentListeners() {
    if (this._open) {
      document.addEventListener('click', this._documentClickHandler);
      return;
    }

    this.removeDocumentListeners();
  }

  removeDocumentListeners() {
    document.removeEventListener('click', this._documentClickHandler);
  }

  syncPortalListeners() {
    if (this._open && this.portal) {
      window.addEventListener('resize', this._viewportHandler);
      document.addEventListener('scroll', this._viewportHandler, true);
      return;
    }

    this.removePortalListeners();
  }

  removePortalListeners() {
    window.removeEventListener('resize', this._viewportHandler);
    document.removeEventListener('scroll', this._viewportHandler, true);
  }

  positionPortalList() {
    if (!this._list || !this._dropdownRoot || !this.portal || !this._open) {
      closeDropdownPortal(this._list);
      return;
    }
    openDropdownPortal(this._dropdownRoot,this._list,()=>this.closeDropdown());
  }

  // The selected machine value, as the manifest declares it: a string, values
  // joined by commas for a multiple selection. It used to return every template
  // setting as an object, so `dropdown.value` was never the value (documentation
  // trial, 2026-10-12).
  get value() {
    return this.hiddenValue;
  }

  // A string or an array selects; an object still sets attributes, as it did.
  set value(nextValue) {
    if (nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)) {
      this.setValueAttributes(nextValue);
      return;
    }
    const values = Array.isArray(nextValue) ? nextValue.map(String) : splitValues(nextValue == null ? '' : String(nextValue));
    this.setAttributeValue('value', serializeValues(values));
  }
}

SfDropdown.define('sf-dropdown');

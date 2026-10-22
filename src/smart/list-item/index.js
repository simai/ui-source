import SfBaseElement from '../../core/js/smart-base';
import { renderListItemTemplate } from './js/templates/default';
import { nearestFieldSize } from '../../component/field-size';

// A row a person reaches by keyboard (interactive, or an item of an sf-sortable
// list) is one stop of its list: the list is a single Tab stop and the arrows,
// Home and End move between its rows (simai/ui-source#29, ui-mail P-14: twenty
// blocks were forty Tab stops). The list is the nearest sf-sortable, listbox,
// list or [data-sf-list] around the row, else the row's parent.
const ROVING = '[data-sf-list-roving]';
const LIST = 'sf-sortable, [role="listbox"], [role="list"], [data-sf-list]';
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([data-sf-list-roving])';
const pendingLists = new Set();

function listOf(row) {
  const host = row.closest('sf-list-item') || row;
  return host.parentElement?.closest(LIST) || host.parentElement;
}

function rowsOf(list) {
  return [...list.querySelectorAll(ROVING)].filter((row) => listOf(row) === list);
}

// A keyboard reorder in progress owns the arrows: the shared session of every
// sf-sortable bundle lives on this global.
function reordering() {
  return Boolean(globalThis.__sfSortableSharedV1?.session);
}

// The one row of a list that takes Tab: the one that last had the focus, else
// the selected one, else the first that is not disabled.
function syncRoving(list) {
  if (!list?.isConnected) return;
  const rows = rowsOf(list);
  const usable = rows.filter((row) => !row.classList.contains('disabled'));
  const current = usable.find((row) => row.dataset.sfListCurrent === 'true')
    || usable.find((row) => row.classList.contains('selected'))
    || usable[0];
  for (const row of rows) {
    row.tabIndex = row === current ? 0 : -1;
    if (row !== current) delete row.dataset.sfListCurrent;
  }
}

function scheduleRoving(list) {
  if (!list || pendingLists.has(list)) return;
  pendingLists.add(list);
  queueMicrotask(() => {
    pendingLists.delete(list);
    syncRoving(list);
  });
}

function moveTo(row) {
  const list = listOf(row);
  for (const other of rowsOf(list)) delete other.dataset.sfListCurrent;
  row.dataset.sfListCurrent = 'true';
  syncRoving(list);
  row.focus();
}

function normalizeSizeGroup(value) {
  const size = value;

  if (size === '1/3' || size === '1/2') {
    return {
      item: size,
      checkbox: nearestFieldSize(size),
      avatarGroup: '1/2',
      colorTag: '1/2',
    };
  }

  return {
    item: size,
    checkbox: nearestFieldSize(size),
    avatarGroup: size,
    colorTag: '1',
  };
}

class SfListItem extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      itemValue: { attribute: 'value', default: '' },
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'text', values: ['text', 'icon', 'checkbox', 'avatar', 'color'], aliases: ['type']},
      size: { default: '1', values: ['1/3', '1/2', '1', '2', '3'] },
      text: { default: '' },
      icon: { default: 'person' },
      checked: { type: Boolean, default: false },
      selected: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      colorClass: { default: 'bg-tertiary' },
      avatarImageUrl: { default: '' },
      avatarTitle: { default: '' },
      ariaLabel: { default: '' },
      // The general row (simai/ui-source#18): a supporting line under the
      // title, a row a person acts on, a row of an sf-sortable list (its item
      // id), and a pinned row of such a list that has no handle and does not move.
      supporting: { default: '' },
      interactive: { type: Boolean, default: false },
      sortableItem: { attribute: 'sortable-item', default: '' },
      pinned: { type: Boolean, default: false },
    };
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._rowBound) return;
    this._rowBound = true;
    this.addEventListener('sf-after-render', () => {
      const row = this.querySelector(':scope > .sf-list-item');
      if (row?.matches(ROVING)) scheduleRoving(listOf(row));
    });
    this.addEventListener('keydown', (event) => this.onRowKeyDown(event));
    this.addEventListener('click', (event) => this.onRowClick(event));
    this.addEventListener('focusin', (event) => {
      const row = this.querySelector(':scope > .sf-list-item');
      if (row?.matches(ROVING) && event.target === row && row.tabIndex !== 0) {
        for (const other of rowsOf(listOf(row))) delete other.dataset.sfListCurrent;
        row.dataset.sfListCurrent = 'true';
        syncRoving(listOf(row));
      }
    });
  }

  disconnectedCallback() {
    const row = this.querySelector(':scope > .sf-list-item');
    const list = row?.matches(ROVING) ? listOf(row) : null;
    super.disconnectedCallback?.();
    if (list) scheduleRoving(list);
  }

  // The row takes focus on the host's behalf: the host is boxless.
  focusDelegate() {
    const row = this.querySelector(':scope > .sf-list-item');
    return row?.matches(ROVING) ? row : null;
  }

  onRowKeyDown(event) {
    const row = this.querySelector(':scope > .sf-list-item');
    if (!row?.matches(ROVING) || event.target !== row || event.defaultPrevented || reordering()) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rows = rowsOf(listOf(row)).filter((entry) => !entry.classList.contains('disabled'));
    const at = rows.indexOf(row);
    const target = {
      ArrowDown: rows[at + 1],
      ArrowUp: rows[at - 1],
      Home: rows[0],
      End: rows.at(-1),
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      if (target && target !== row) moveTo(target);
      return;
    }
    // Enter acts on a row, unless the row is an item of an sf-sortable list:
    // there Space and Enter pick it up, as the list's instructions say.
    if (event.key === 'Enter' && this.interactive && !row.hasAttribute('data-sf-sortable-item')) {
      event.preventDefault();
      this.activate(event);
    }
  }

  onRowClick(event) {
    const row = this.querySelector(':scope > .sf-list-item');
    if (!this.interactive || !row || !row.contains(event.target)) return;
    // A control inside the row (a trailing action) acts for itself.
    const control = event.target.closest(INTERACTIVE);
    if (control && control !== row && row.contains(control)) return;
    if (row.matches(ROVING) && listOf(row)) {
      for (const other of rowsOf(listOf(row))) delete other.dataset.sfListCurrent;
      row.dataset.sfListCurrent = 'true';
      syncRoving(listOf(row));
    }
    this.activate(event);
  }

  activate(event) {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('sf-list-item-activate', {
      bubbles: true,
      composed: true,
      detail: { value: this.itemValue, item: this, trigger: event?.type === 'keydown' ? 'keyboard' : 'pointer' },
    }));
  }

  get supporting() {
    return this.getAttribute('supporting') || '';
  }

  get interactive() {
    return this.getBooleanAttr('interactive', false);
  }

  get sortableItem() {
    return this.getAttribute('sortable-item') || '';
  }

  get pinned() {
    return this.getBooleanAttr('pinned', false);
  }


  get componentName() {
    return 'list-item';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  get kind() {
    return this.getProp('kind');
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get itemValue() {
    return this.getAttribute('value') || '';
  }

  get size() {
    return this.getEnumAttr('size', ['1/3', '1/2', '1', '2', '3'], '1');
  }

  get sizeGroup() {
    return normalizeSizeGroup(this.size);
  }

  get text() {
    return this.getAttribute('text') || '';
  }

  get icon() {
    return this.getAttribute('icon') || 'person';
  }

  get checked() {
    return this.getBooleanAttr('checked', false);
  }

  get selected() {
    return this.getBooleanAttr('selected', false);
  }

  get disabled() {
    return this.getBooleanAttr('disabled', false);
  }

  get colorClass() {
    return this.getAttribute('color-class') || 'bg-tertiary';
  }

  get avatarImageUrl() {
    return this.getAttribute('avatar-image-url') || '';
  }

  get avatarTitle() {
    return this.getAttribute('avatar-title') || this.text;
  }

  get ariaLabel() {
    return this.getAttribute('aria-label') || '';
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      sizeGroup: this.sizeGroup,
      avatarTitle: this.avatarTitle,
      supporting: this.supporting,
      interactive: this.interactive,
      sortableItem: this.sortableItem,
      pinned: this.pinned,
      // Resolved names the template reads (contracts/template-context.json).
      type: this.type,
      value: this.itemValue,
      option: false,
    });
  }

  template() {
    return renderListItemTemplate(this.templateContext());
  }

  resolveUpdateMode(changedAttributes = []) {
    if (
      changedAttributes.length > 0 &&
      !this.supporting &&
      !this.interactive &&
      !this.sortableItem &&
      changedAttributes.every((attr) =>
        ['text', 'aria-label', 'disabled', 'selected', 'checked'].includes(attr),
      )
    ) {
      return 'dom';
    }

    return 'lit';
  }

  updateDom(changedAttributes = []) {
    const root = this.querySelector('.sf-list-item');
    const textNode = this.querySelector(
      '.sf-list-item-container, .sf-avatar-label-group-title, .sf-tag-container',
    );
    const checkbox = this.querySelector('.sf-checkbox input');

    if (!root) return false;

    if (changedAttributes.includes('text') && textNode) {
      textNode.textContent = this.text;
    }

    if (changedAttributes.includes('disabled')) {
      root.classList.toggle('disabled', this.disabled);

      if (checkbox) {
        checkbox.disabled = this.disabled;
      }
    }

    if (changedAttributes.includes('selected')) {
      root.classList.toggle('selected', this.selected);
    }

    if (
      checkbox &&
      (changedAttributes.includes('checked') || changedAttributes.includes('selected'))
    ) {
      checkbox.checked = this.checked || this.selected;
    }

    return true;
  }

  get value() {
    return {
      template: this.templateName,
      value: this.itemValue,
      type: this.type,
      size: this.size,
      text: this.text,
      icon: this.icon,
      checked: this.checked,
      selected: this.selected,
      disabled: this.disabled,
      colorClass: this.colorClass,
      avatarImageUrl: this.avatarImageUrl,
      avatarTitle: this.avatarTitle,
      ariaLabel: this.ariaLabel,
      supporting: this.supporting,
      interactive: this.interactive,
      sortableItem: this.sortableItem,
      pinned: this.pinned,
    };
  }

  set value(nextValue) {
    if (!nextValue || typeof nextValue !== 'object') return;

    const { value: itemValue, ...attributes } = nextValue;
    if (Object.prototype.hasOwnProperty.call(nextValue, 'value')) {
      this.setAttributeValue('value', itemValue);
    }
    this.setValueAttributes(attributes);
  }
}

SfListItem.define('sf-list-item');

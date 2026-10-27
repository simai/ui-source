// A row: an option sf-dropdown captures, or the general list row.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js; a press or Enter on an
// interactive row sends sf-list-item-open {id, trigger} (vocabulary 1.1.5 §5
// open), the old sf-list-item-activate its dated alias; type is kind's dated
// alias (aliases.json).
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import { renderListItemTemplate } from './js/templates/default';
import { nearestFieldSize } from '../../component/field-size';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

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

const ListItemElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
});

class SfListItem extends ListItemElement {
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
    // Enter opens a row, unless the row is an item of an sf-sortable list:
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

  // A press or Enter on the row: the request open {id} (vocabulary §5).
  activate(event) {
    if (this.disabled) return;
    this._openTrigger = event?.type === 'keydown' ? 'keyboard' : 'pointer';
    this.sfEmit('open', {id: this.value, trigger: this._openTrigger});
  }

  // The old sf-list-item-activate carried the element and named the id value.
  sfAliasAdapters() {
    return {
      'sf-list-item-activate': (detail) => ({value: detail.id, item: this, trigger: detail.trigger}),
    };
  }

  get componentName() {
    return 'list-item';
  }

  get templateName() {
    return this.getAttribute('template') || 'default';
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer
  // (the shim maps the attribute; aliases.json).
  get type() {
    return this.kind;
  }

  // Kept for the code that read the id under this name.
  get itemValue() {
    return this.value;
  }

  get sizeGroup() {
    return normalizeSizeGroup(this.size);
  }

  get avatarTitle() {
    return this.getAttribute('avatar-title') || this.text;
  }

  set avatarTitle(next) {
    super.avatarTitle = next;
  }

  // The value is the row's id (§4). Writing an object writes its attributes,
  // as the old snapshot form did.
  get value() {
    return super.value;
  }

  set value(next) {
    if (next && typeof next === 'object') {
      const { value: itemValue, ...attributes } = next;
      if (Object.prototype.hasOwnProperty.call(next, 'value')) this.setAttributeValue('value', itemValue);
      this.setValueAttributes(attributes);
      return;
    }
    super.value = next;
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
      ariaLabel: this.getAttribute('aria-label') || '',
      // Resolved names the template reads (contracts/template-context.json).
      kind: this.kind,
      type: this.kind,
      size: this.size,
      text: this.text,
      icon: this.icon,
      checked: this.checked,
      selected: this.selected,
      disabled: this.disabled,
      colorClass: this.colorClass,
      avatarImageUrl: this.avatarImageUrl,
      value: this.value,
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
}

SfListItem.define('sf-list-item');

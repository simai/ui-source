import SfBaseElement from '../../core/js/smart-base';
import { renderTreeTemplate } from './js/templates/default';

function isTreeItemNode(node) {
  return (
    node?.nodeType === Node.ELEMENT_NODE &&
    node?.tagName?.toLowerCase?.() === 'sf-tree-item'
  );
}

function getDirectLabel(node) {
  return Array.from(node?.childNodes || [])
    .filter((child) => !isTreeItemNode(child))
    .map((child) => child.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function treeItemNodeToData(node) {
  if (typeof node?.toTreeItemData === 'function') {
    return node.toTreeItemData();
  }

  const children = Array.from(node?.children || [])
    .filter(isTreeItemNode)
    .map(treeItemNodeToData);

  return {
    label:
      node.getAttribute('label') ||
      node.getAttribute('text') ||
      node.getAttribute('title') ||
      getDirectLabel(node),
    href: node.getAttribute('href') || '',
    target: node.getAttribute('target') || '',
    rel: node.getAttribute('rel') || '',
    type: node.getAttribute('kind') || node.getAttribute('type') || '',
    value: node.getAttribute('value') || '',
    open: node.hasAttribute('open'),
    selected: node.hasAttribute('selected'),
    active: node.hasAttribute('active'),
    disabled: node.hasAttribute('disabled'),
    openIcon: node.getAttribute('open-icon') || '',
    closedIcon: node.getAttribute('closed-icon') || '',
    icon: !node.hasAttribute('icon') || node.getAttribute('icon') !== 'false',
    chevronOpenIcon: node.getAttribute('chevron-open-icon') || '',
    chevronClosedIcon: node.getAttribute('chevron-closed-icon') || '',
    openLabel: node.getAttribute('open-label') || '',
    closeLabel: node.getAttribute('close-label') || '',
    children,
  };
}

// An item given as data answers the same questions a node does, and falls back
// the same way where it says nothing.
function normalizeTreeItemData(item) {
  if (!item || typeof item !== 'object') return null;
  const children = Array.isArray(item.children)
    ? item.children.map((child) => normalizeTreeItemData(child)).filter(Boolean)
    : [];

  return {
    label: String(item.label ?? item.text ?? item.title ?? ''),
    href: item.href ? String(item.href) : '',
    target: item.target ? String(item.target) : '',
    rel: item.rel ? String(item.rel) : '',
    // `kind` is the axis (port and manifest); `type` the legacy name.
    type: item.kind || item.type ? String(item.kind || item.type) : '',
    value: item.value === undefined || item.value === null ? '' : String(item.value),
    open: Boolean(item.open),
    selected: Boolean(item.selected),
    active: Boolean(item.active),
    disabled: Boolean(item.disabled),
    openIcon: item.openIcon ? String(item.openIcon) : '',
    closedIcon: item.closedIcon ? String(item.closedIcon) : '',
    icon: item.icon !== false,
    chevronOpenIcon: item.chevronOpenIcon ? String(item.chevronOpenIcon) : '',
    chevronClosedIcon: item.chevronClosedIcon ? String(item.chevronClosedIcon) : '',
    openLabel: item.openLabel ? String(item.openLabel) : '',
    closeLabel: item.closeLabel ? String(item.closeLabel) : '',
    children,
  };
}

class SfTree extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      rootClass: { default: '' },
      ariaLabel: { attribute: 'aria-label', default: '' },
      role: { default: 'tree', values: ['tree'] },
      selection: {
        default: 'none',
        values: ['none', 'single', 'multiple'],
      },
    };
  }

  constructor() {
    super();
    this._itemObserver = null;
    this._itemsData = [];
    this._tabStopItem = null;
    this._typeahead = '';
    this._typeaheadTimer = null;
  }

  connectedCallback() {
    this.addEventListener('keydown', this.handleTreeKeydown);
    this.addEventListener('focusin', this.handleTreeFocusIn);
    this.addEventListener('click', this.handleTreeClick);
    this.addEventListener('sf-after-render', this.handleAfterRender);
    this.observeItemChildren();
    this.captureInitialItems();
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this.handleTreeKeydown);
    this.removeEventListener('focusin', this.handleTreeFocusIn);
    this.removeEventListener('click', this.handleTreeClick);
    this.removeEventListener('sf-after-render', this.handleAfterRender);
    clearTimeout(this._typeaheadTimer);
    this.disconnectItemObserver();
    super.disconnectedCallback();
  }

  observeItemChildren() {
    if (this._itemObserver) {
      return;
    }

    this._itemObserver = new MutationObserver((mutations) => {
      const hasNewItems = mutations.some((mutation) =>
        Array.from(mutation.addedNodes || []).some(isTreeItemNode),
      );

      if (!hasNewItems || !this.captureInitialItems(true)) {
        return;
      }

      this.requestComponentUpdate('items');
    });

    this._itemObserver.observe(this, { childList: true });
  }

  disconnectItemObserver() {
    this._itemObserver?.disconnect?.();
    this._itemObserver = null;
  }

  captureInitialItems(append = false) {
    const nodes = Array.from(this.childNodes || []).filter(isTreeItemNode);

    if (!nodes.length) {
      return false;
    }

    const nextItems = nodes.map(treeItemNodeToData);
    this._itemsData = append
      ? [...this._itemsData, ...nextItems]
      : nextItems;
    nodes.forEach((node) => node.remove());

    return true;
  }

  get items() {
    return this._itemsData;
  }

  // Whether anything in this tree can be opened. A leaf keeps the chevron's
  // column so its name lines up with the branches beside it; where there are no
  // branches, that column is an indent nobody chose.
  get hasBranches() {
    const anyChildren = (items) => (items ?? []).some(
      (item) => (item?.children ?? []).length > 0 || anyChildren(item?.children),
    );
    return anyChildren(this._itemsData)
      || this.getRenderedItems().some((item) => item.hasChildren);
  }

  // Items may also arrive as data. The tree reads its `sf-tree-item` children
  // once and removes them, and watches only for children appearing -- so a
  // parent that re-renders a changed item changes a node the tree no longer
  // holds, and the tree goes on drawing the name it read at the start. A
  // section renamed in a record's arranging mode kept its old name in the list
  // beside the fields for exactly that reason. The same seam sf-dropdown has
  // for its options, and for the same reason: a parent rendering from a
  // template cannot put a changed list back through children it no longer owns.
  set items(value) {
    const next = Array.isArray(value) ? value.map((item) => normalizeTreeItemData(item)) : [];
    this._itemsData = next.filter(Boolean);
    this.requestComponentUpdate('items');
  }

  getRenderedItems() {
    return Array.from(this.querySelectorAll('sf-tree-item')).filter(
      (item) => item.closest('sf-tree') === this,
    );
  }

  getVisibleItems() {
    return this.getRenderedItems();
  }

  getEventItem(event) {
    const item = event.target?.closest?.('sf-tree-item');
    return item?.closest?.('sf-tree') === this ? item : null;
  }

  getParentItem(item) {
    const parent = item?.parentElement?.closest?.('sf-tree-item');
    return parent?.closest?.('sf-tree') === this ? parent : null;
  }

  setTabStop(item, focus = false) {
    const visible = this.getVisibleItems();
    const next = visible.includes(item) ? item : visible[0] || null;

    this.getRenderedItems().forEach((candidate) => {
      candidate.setTabStop?.(candidate === next);
    });

    this._tabStopItem = next;
    if (focus) next?.focusItem?.();
    return next;
  }

  syncTabStop(fallbackItem = null) {
    const visible = this.getVisibleItems();
    const selection = this.getProp('selection');

    this.getRenderedItems().forEach((item) => {
      const control = item.getTreeItemControl?.();
      if (!control) return;
      if (selection === 'none') control.removeAttribute('aria-selected');
      else control.setAttribute('aria-selected', String(item.hasAttribute('selected')));
    });

    const current = visible.find(
      (item) => item.getTreeItemControl?.()?.tabIndex === 0,
    );
    const focused = visible.find(
      (item) => item.getTreeItemControl?.() === document.activeElement,
    );
    const preferred = visible.find(
      (item) => item.hasAttribute('selected') || item.hasAttribute('active'),
    );

    return this.setTabStop(
      focused ||
        preferred ||
        (visible.includes(this._tabStopItem) ? this._tabStopItem : null) ||
        current ||
        (visible.includes(fallbackItem) ? fallbackItem : null) ||
        visible[0] ||
        null,
    );
  }

  selectItem(item) {
    const mode = this.getProp('selection');
    if (!['single', 'multiple'].includes(mode)) {
      item.activate?.();
      return;
    }

    const nextSelected =
      mode === 'multiple' ? !item.getProp('selected') : true;

    if (mode === 'single') {
      this.getRenderedItems().forEach((candidate) => {
        candidate.toggleAttribute('selected', candidate === item);
      });
    } else {
      item.toggleAttribute('selected', nextSelected);
    }

    this.emitComponentEvent('tree-selection-change', {
      item,
      selected: nextSelected,
      value: item.getProp('value'),
    });
  }

  moveTypeahead(item, key) {
    clearTimeout(this._typeaheadTimer);
    this._typeahead += key.toLocaleLowerCase();
    this._typeaheadTimer = setTimeout(() => {
      this._typeahead = '';
    }, 500);

    const visible = this.getVisibleItems();
    const start = Math.max(visible.indexOf(item), 0);
    const ordered = visible.slice(start + 1).concat(visible.slice(0, start + 1));
    const match = ordered.find((candidate) =>
      String(candidate.label || '')
        .trim()
        .toLocaleLowerCase()
        .startsWith(this._typeahead),
    );

    if (match) this.setTabStop(match, true);
  }

  handleAfterRender = (event) => {
    const fallback =
      event.target?.tagName?.toLowerCase?.() === 'sf-tree-item'
        ? event.target
        : null;
    queueMicrotask(() => this.syncTabStop(fallback));
  };

  handleTreeFocusIn = (event) => {
    const item = this.getEventItem(event);
    if (item) this.setTabStop(item);
  };

  // A press selects, the way the space bar does. Only the tab stop moved before,
  // so a tree asked for a single selection answered the keyboard and not the
  // pointer: a list of destinations could be walked with the arrows and chosen
  // with the space bar, and clicking one did nothing at all. The chevron stops
  // its own press, so opening a branch is still not choosing it.
  handleTreeClick = (event) => {
    const item = this.getEventItem(event);
    if (!item) return;
    this.setTabStop(item);
    if (item.getProp?.('disabled')) return;
    const mode = this.getProp('selection');
    if (mode === 'single' || mode === 'multiple') this.selectItem(item);
  };

  handleTreeKeydown = (event) => {
    const item = this.getEventItem(event);
    if (!item) return;

    const visible = this.getVisibleItems();
    const index = visible.indexOf(item);
    if (index < 0) return;

    let target = null;
    let handled = true;

    switch (event.key) {
      case 'ArrowDown':
        target = visible[Math.min(index + 1, visible.length - 1)];
        break;
      case 'ArrowUp':
        target = visible[Math.max(index - 1, 0)];
        break;
      case 'Home':
        target = visible[0];
        break;
      case 'End':
        target = visible[visible.length - 1];
        break;
      case 'ArrowRight': {
        const children = item.getRenderedChildItems?.() || [];
        if (item.hasChildren && !item.getProp('open')) item.open();
        else target = children[0] || null;
        break;
      }
      case 'ArrowLeft':
        if (item.hasChildren && item.getProp('open')) item.close();
        else target = this.getParentItem(item);
        break;
      case 'Enter':
        if (item.hasChildren) item.toggle();
        else item.activate?.();
        break;
      case ' ':
        this.selectItem(item);
        break;
      default:
        handled = false;
    }

    if (!handled && event.key.length === 1 && !event.altKey && !event.metaKey) {
      this.moveTypeahead(item, event.key);
      handled = true;
    }

    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
    if (target) this.setTabStop(target, true);
  };

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      items: this.items,
      hasBranches: this.hasBranches,
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
    });
  }

  template() {
    return renderTreeTemplate(this.templateContext());
  }

  onToggle(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-tree-item-toggle',
        (event) => {
          handler(event.detail?.item, event.detail, event);
        },
        options,
      );
    }

    return this;
  }
}

SfTree.define('sf-tree');

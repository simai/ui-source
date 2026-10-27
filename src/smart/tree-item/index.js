// A node of a tree: a folder that opens a group of nodes, or a file or a link.
//
// Inside an sf-tree the node is read once as data and removed: the tree draws
// every entry's row itself (js/templates/row.js, simai/ui-source#43). Alone,
// the node draws its own row and, open, its children as nested nodes.
//
// From its component.json (standard simai.smart-component 1.3.8 §3, §4, §8):
// the settings are made by core/js/element-manifest.js; a press on the name
// sends sf-tree-item-open {id, value} (the old sf-tree-item-click its dated
// alias), the branch's change sf-tree-item-toggle {id, open, value}; text is
// label's alias and type kind's (aliases.json); the words are the language
// files'.
import SfBaseElement from '../../core/js/smart-base';
import {elementFromManifest} from '../../core/js/element-manifest';
import { renderTreeItemTemplate } from './js/templates/default';
import {isTreeItemNode, treeItemNodeToData} from './js/node-data.js';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

const TreeItemElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: {en, ru},
  source: 'ru',
  aliases,
  actions: {
    expand() { return this.setOpen(true); },
    collapse() { return this.setOpen(false); },
    'toggle-open'() { return this.setOpen(!this.open); },
    activate() { return this.runActivate(); },
    'focus-item'() {
      const control = this.getTreeItemControl();
      if (!control) return {outcome: 'refused', reason: 'not-drawn'};
      control.focus();
      return {outcome: 'applied'};
    },
  },
});

class SfTreeItem extends TreeItemElement {
  static contentTemplateSlot = '__content';

  constructor() {
    super();
    this._itemObserver = null;
    this._itemsData = [];
    this._sourceData = null;
  }

  connectedCallback() {
    // A printed JSON island first (standard 1.3.8 §5.4): what is read below may be in it.
    this.sfReadIsland();
    if (!this.__treeItemSourceCaptured) {
      this.captureSourceData();
      this.captureInitialContent();
      this.captureInitialItems();
      this.__treeItemSourceCaptured = true;
    }

    this.observeChildItems();
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.disconnectItemObserver();
    super.disconnectedCallback();
  }

  observeChildItems() {
    if (this._itemObserver) return;
    this._itemObserver = new MutationObserver((mutations) => {
      const hasNewItems = mutations.some((mutation) =>
        Array.from(mutation.addedNodes || []).some(isTreeItemNode),
      );
      if (!hasNewItems || !this.captureInitialItems(true)) return;
      this.requestComponentUpdate('children');
    });
    this._itemObserver.observe(this, { childList: true });
  }

  disconnectItemObserver() {
    this._itemObserver?.disconnect?.();
    this._itemObserver = null;
  }

  isContentNode(node) {
    if (!node || isTreeItemNode(node)) return false;
    if (node.nodeType === Node.TEXT_NODE) return String(node.textContent || '').trim() !== '';
    return node.nodeType === Node.ELEMENT_NODE;
  }

  captureSourceData() {
    if (this._sourceData) return this._sourceData;
    this._sourceData = treeItemNodeToData({
      ...this,
      getAttribute: (name) => this.getAttribute(name),
      hasAttribute: (name) => this.hasAttribute(name),
      children: this.children,
      childNodes: this.childNodes,
    });
    return this._sourceData;
  }

  captureInitialContent() {
    if (this._slotTemplates.has(this.constructor.contentTemplateSlot)) return false;
    return this.captureChildTemplates(this.constructor.contentTemplateSlot, (node) => this.isContentNode(node)).length > 0;
  }

  captureInitialItems(append = false) {
    const nodes = Array.from(this.childNodes || []).filter(isTreeItemNode);
    if (!nodes.length) return false;
    const nextItems = nodes.map(treeItemNodeToData);
    this._itemsData = append ? [...this._itemsData, ...nextItems] : nextItems;
    nodes.forEach((node) => node.remove());
    return true;
  }

  get hasChildren() {
    return !this.isFile && this.childItems.length > 0;
  }

  get content() {
    return this.getSlotContent(this.constructor.contentTemplateSlot);
  }

  get childItems() {
    if (this.isFile) return [];
    const propItems = this.itemsData;
    return Array.isArray(propItems) && propItems.length ? propItems : this._itemsData;
  }

  get label() {
    return this.getAttribute('label') || this._sourceData?.label || '';
  }

  set label(next) {
    super.label = next;
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get isFile() {
    return this.kind === 'file';
  }

  toTreeItemData() {
    const sourceData = this.captureSourceData();
    return {
      ...sourceData,
      label: this.label,
      href: this.href || sourceData.href || '',
      target: this.target || sourceData.target || '',
      rel: this.rel || sourceData.rel || '',
      type: this.kind,
      value: this.value || sourceData.value || '',
      open: this.open || sourceData.open || false,
      selected: this.selected || sourceData.selected || false,
      active: this.active || sourceData.active || false,
      disabled: this.disabled || sourceData.disabled || false,
      openIcon: this.getAttribute('open-icon') || sourceData.openIcon || '',
      closedIcon: this.getAttribute('closed-icon') || sourceData.closedIcon || '',
      icon: this.icon,
      chevronOpenIcon: this.getAttribute('chevron-open-icon') || sourceData.chevronOpenIcon || '',
      chevronClosedIcon: this.getAttribute('chevron-closed-icon') || sourceData.chevronClosedIcon || '',
      openLabel: this.getAttribute('open-label') || sourceData.openLabel || '',
      closeLabel: this.getAttribute('close-label') || sourceData.closeLabel || '',
      children: this.isFile ? [] : this.childItems.length ? this.childItems : sourceData.children || [],
    };
  }

  templateContext() {
    const props = this.getPropsContext();
    return this.createTemplateContext({
      ...props,
      component: this,
      value: this.value,
      label: this.label,
      content: this.content,
      kind: this.kind,
      type: this.kind,
      isFile: this.isFile,
      open: this.open,
      selected: this.selected,
      active: this.active,
      disabled: this.disabled,
      icon: this.icon,
      openIcon: this.openIcon,
      closedIcon: this.closedIcon,
      chevronOpenIcon: this.chevronOpenIcon,
      chevronClosedIcon: this.chevronClosedIcon,
      openLabel: this.openLabel,
      closeLabel: this.closeLabel,
      itemClass: this.itemClass,
      containerClass: this.containerClass,
      nameClass: this.nameClass,
      children: this.childItems,
      hasChildren: this.hasChildren,
      rootClass: this.getRootClass(),
      rootStyle: this.getRootStyle(),
      onToggle: this.handleToggle,
      onItemClick: this.handleItemClick,
    });
  }

  template() {
    return renderTreeItemTemplate(this.templateContext());
  }

  getTreeItemControl() {
    return this.querySelector(':scope > .sf-tree-item[role="treeitem"]');
  }

  getRenderedChildItems() {
    return Array.from(this.querySelectorAll(':scope > .sf-tree-item > .sf-tree-group > sf-tree-item'));
  }

  setTabStop(active = false) {
    const control = this.getTreeItemControl();
    if (control) control.tabIndex = active ? 0 : -1;
    return this;
  }

  // The action activate: what Enter does on a leaf.
  runActivate() {
    if (this.disabled) return {outcome: 'refused', reason: 'disabled'};
    const link = this.querySelector(':scope > .sf-tree-item > .sf-tree-item-container > a[href]');
    if (link) {
      link.click();
      return {outcome: 'applied'};
    }
    this.sfEmit('open', {id: this.value, value: this.value});
    return {outcome: 'applied'};
  }

  // The actions expand, collapse and toggle-open.
  setOpen(open = true) {
    const next = Boolean(open);
    if (this.isFile || !this.hasChildren) return {outcome: 'refused', reason: 'leaf'};
    if (this.disabled) return {outcome: 'refused', reason: 'disabled'};
    if (this.open === next) return {outcome: 'applied'};
    this.toggleAttribute('open', next);
    this.sfEmit('toggle', {id: this.value, open: next, value: this.value});
    return {outcome: 'applied'};
  }

  // The old sf-tree-item-click carried the element and the DOM event.
  sfAliasAdapters() {
    return {
      'sf-tree-item-click': (detail) => ({item: this, value: detail.value, originalEvent: this._pressEvent ?? null}),
    };
  }

  onToggle(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener('sf-tree-item-toggle', (event) => handler(event.detail?.open, event.detail, event), options);
    }
    return this;
  }

  handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.setOpen(!this.open);
  };

  handleItemClick = (event) => {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    this._pressEvent = event;
    this.sfEmit('open', {id: this.value, value: this.value});
    this._pressEvent = null;
  };
}

SfTreeItem.define('sf-tree-item');

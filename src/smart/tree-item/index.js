import SfBaseElement from '../../core/js/smart-base';
import { renderTreeItemTemplate } from './js/templates/default';
import {pageText} from "../../core/js/page-language";
// Every word this component says, in the languages it ships with. A product
// adds any other through SF.language.register("sf-tree-item", code, words).
const TREE_ITEM_TEXT = {
  en: {
    openLabel: 'Open item',
    closeLabel: 'Close item',
  },
  ru: {
    openLabel: 'Развернуть',
    closeLabel: 'Свернуть',
  },
};


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

class SfTreeItem extends SfBaseElement {
  static contentTemplateSlot = '__content';

  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      label: { default: '' },
      text: { default: '' },
      href: { default: '' },
      target: { default: '' },
      rel: { default: '' },
      // The axis is called kind, because that is the question it answers.
      // `type` keeps working: see contracts/public-api-axes.json.
      kind: {default: 'folder', values: ['folder', 'file'], aliases: ['type']},
      value: { default: '' },
      open: { type: Boolean, default: false },
      selected: { type: Boolean, default: false },
      active: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      itemsData: { type: Array, default: [] },
      openIcon: { attribute: 'open-icon', default: 'folder_open' },
      closedIcon: { attribute: 'closed-icon', default: 'folder' },
      icon: { type: Boolean, default: true },
      chevronOpenIcon: {
        attribute: 'chevron-open-icon',
        default: 'keyboard_arrow_down',
      },
      chevronClosedIcon: {
        attribute: 'chevron-closed-icon',
        default: 'chevron_right',
      },
      openLabel: { attribute: 'open-label', default: '' },
      closeLabel: { attribute: 'close-label', default: '' },
      rootClass: { default: '' },
      itemClass: { attribute: 'item-class', default: '' },
      containerClass: { attribute: 'container-class', default: '' },
      nameClass: { attribute: 'name-class', default: '' },
    };
  }

  constructor() {
    super();
    this._itemObserver = null;
    this._itemsData = [];
    this._itemsDataProp = [];
    this._sourceData = null;
  }

  connectedCallback() {
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

      this.requestComponentUpdate('children');
    });

    this._itemObserver.observe(this, { childList: true });
  }

  disconnectItemObserver() {
    this._itemObserver?.disconnect?.();
    this._itemObserver = null;
  }

  isContentNode(node) {
    if (!node || isTreeItemNode(node)) {
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return String(node.textContent || '').trim() !== '';
    }

    return node.nodeType === Node.ELEMENT_NODE;
  }

  captureSourceData() {
    if (this._sourceData) {
      return this._sourceData;
    }

    const children = Array.from(this.children || [])
      .filter(isTreeItemNode)
      .map(treeItemNodeToData);

    this._sourceData = {
      label:
        this.getAttribute('label') ||
        this.getAttribute('text') ||
        this.getAttribute('title') ||
        getDirectLabel(this),
      href: this.getAttribute('href') || '',
      target: this.getAttribute('target') || '',
      rel: this.getAttribute('rel') || '',
      type: this.getAttribute('kind') || this.getAttribute('type') || '',
      value: this.getAttribute('value') || '',
      open: this.hasAttribute('open'),
      selected: this.hasAttribute('selected'),
      active: this.hasAttribute('active'),
      disabled: this.hasAttribute('disabled'),
      openIcon: this.getAttribute('open-icon') || '',
      closedIcon: this.getAttribute('closed-icon') || '',
      icon:
        !this.hasAttribute('icon') || this.getAttribute('icon') !== 'false',
      chevronOpenIcon: this.getAttribute('chevron-open-icon') || '',
      chevronClosedIcon: this.getAttribute('chevron-closed-icon') || '',
      openLabel: this.getAttribute('open-label') || '',
      closeLabel: this.getAttribute('close-label') || '',
      children,
    };

    return this._sourceData;
  }

  captureInitialContent() {
    if (this._slotTemplates.has(this.constructor.contentTemplateSlot)) {
      return false;
    }

    return (
      this.captureChildTemplates(
        this.constructor.contentTemplateSlot,
        (node) => this.isContentNode(node),
      ).length > 0
    );
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

  get hasChildren() {
    return !this.isFile && this.childItems.length > 0;
  }

  get content() {
    return this.getSlotContent(this.constructor.contentTemplateSlot);
  }

  get itemsData() {
    return this._itemsDataProp;
  }

  set itemsData(value) {
    this._itemsDataProp = Array.isArray(value) ? value : [];
    if (this._isMounted) this.requestComponentUpdate('items-data');
  }

  get childItems() {
    if (this.isFile) {
      return [];
    }

    const propItems = this.itemsData;

    return Array.isArray(propItems) && propItems.length
      ? propItems
      : this._itemsData;
  }

  get label() {
    return (
      this.getProp('label') ||
      this.getProp('text') ||
      this._sourceData?.label ||
      ''
    );
  }

  get kind() {
    return this.getProp('kind') || this._sourceData?.type || 'folder';
  }

  // The legacy name, kept so a consumer reading el.type still gets an answer.
  get type() {
    return this.kind;
  }

  get isFile() {
    return this.type === 'file';
  }

  toTreeItemData() {
    const sourceData = this.captureSourceData();

    return {
      ...sourceData,
      label: this.label,
      href: this.getProp('href') || sourceData.href || '',
      target: this.getProp('target') || sourceData.target || '',
      rel: this.getProp('rel') || sourceData.rel || '',
      type: this.type,
      value: this.getProp('value') || sourceData.value || '',
      open: this.getProp('open') || sourceData.open || false,
      selected: this.getProp('selected') || sourceData.selected || false,
      active: this.getProp('active') || sourceData.active || false,
      disabled: this.getProp('disabled') || sourceData.disabled || false,
      openIcon: this.getProp('openIcon') || sourceData.openIcon || '',
      closedIcon: this.getProp('closedIcon') || sourceData.closedIcon || '',
      icon: this.getProp('icon'),
      chevronOpenIcon:
        this.getProp('chevronOpenIcon') || sourceData.chevronOpenIcon || '',
      chevronClosedIcon:
        this.getProp('chevronClosedIcon') || sourceData.chevronClosedIcon || '',
      openLabel: this.getProp('openLabel') || sourceData.openLabel || '',
      closeLabel: this.getProp('closeLabel') || sourceData.closeLabel || '',
      children: this.isFile
        ? []
        : this.childItems.length
          ? this.childItems
          : sourceData.children || [],
    };
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      openLabel: this.getAttribute("open-label") || pageText(TREE_ITEM_TEXT, "openLabel", this),
      closeLabel: this.getAttribute("close-label") || pageText(TREE_ITEM_TEXT, "closeLabel", this),
      component: this,
      label: this.label,
      content: this.content,
      type: this.type,
      isFile: this.isFile,
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
    return Array.from(
      this.querySelectorAll(
        ':scope > .sf-tree-item > .sf-tree-group > sf-tree-item',
      ),
    );
  }

  setTabStop(active = false) {
    const control = this.getTreeItemControl();
    if (control) control.tabIndex = active ? 0 : -1;
    return this;
  }

  focusItem() {
    this.getTreeItemControl()?.focus?.();
    return this;
  }

  activate() {
    if (this.getProp('disabled')) return this;

    const link = this.querySelector(
      ':scope > .sf-tree-item > .sf-tree-item-container > a[href]',
    );

    if (link) {
      link.click();
      return this;
    }

    this.emitComponentEvent('tree-item-click', {
      item: this,
      value: this.getProp('value'),
      originalEvent: null,
    });

    return this;
  }

  setOpen(open = true) {
    const nextOpen = Boolean(open);

    if (this.isFile || !this.hasChildren || this.getProp('disabled')) {
      return this;
    }

    if (this.getProp('open') === nextOpen) {
      return this;
    }

    this.toggleAttribute('open', nextOpen);
    this.emitComponentEvent('tree-item-toggle', {
      item: this,
      open: nextOpen,
      value: this.getProp('value'),
    });

    return this;
  }

  open() {
    return this.setOpen(true);
  }

  close() {
    return this.setOpen(false);
  }

  toggle() {
    return this.setOpen(!this.getProp('open'));
  }

  onToggle(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-tree-item-toggle',
        (event) => {
          handler(event.detail?.open, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  handleToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  };

  handleItemClick = (event) => {
    if (this.getProp('disabled')) {
      event.preventDefault();
      return;
    }

    this.emitComponentEvent('tree-item-click', {
      item: this,
      value: this.getProp('value'),
      originalEvent: event,
    });
  };
}

SfTreeItem.define('sf-tree-item');

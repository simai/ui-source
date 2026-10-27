import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderBreadcrumbsTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-breadcrumbs from its component.json (standard simai.smart-component 1.3.8
// §3, §4, §8, §11): its settings are attributes and properties made by
// core/js/element-manifest.js, its words are lang/<locale>.json (a product adds
// another language through SF.language.register("sf-breadcrumbs", code,
// words)), and the old event name sf-breadcrumb-click is a dated alias of
// sf-breadcrumbs-press.
const BreadcrumbsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

function parseItemFlags(flagsPart = '') {
  const flags = String(flagsPart || '')
    .split(',')
    .map((flag) => flag.trim())
    .filter(Boolean);
  const item = {};

  flags.forEach((flag) => {
    const [rawKey, ...rawValue] = flag.split('=');
    const key = String(rawKey || '').trim().toLowerCase();
    const value = rawValue.join('=').trim();

    if (!key) return;

    if (['current', 'active', 'disabled', 'ellipsis'].includes(key)) {
      item[key] = value ? !['0', 'false', 'no'].includes(value.toLowerCase()) : true;
      return;
    }

    item[key] = value;
  });

  return item;
}

function normalizeItem(item = {}, index = 0, total = 0, options = {}) {
  if (typeof item === 'string') {
    return normalizeItem({ label: item }, index, total, options);
  }

  const { defaultCurrent = true } = options;
  const label = item.label || item.text || item.title || '';
  const current = Boolean(
    item.current || item.active || (defaultCurrent && index === total - 1),
  );
  const ellipsis = Boolean(item.ellipsis || label === '...' || label === '…');
  const hiddenItemsSource =
    item.hiddenItems || item.hiddenitems || item['hidden-items'] || item.items;
  const hiddenItems = hiddenItemsSource
    ? parseItems(hiddenItemsSource, { defaultCurrent: false })
    : [];

  return {
    label: ellipsis ? '…' : label,
    href: item.href || item.url || '',
    icon: item.icon || '',
    current,
    active: Boolean(item.active || current),
    disabled: Boolean(item.disabled),
    ellipsis,
    target: item.target || '',
    rel: item.rel || '',
    itemClass: item.itemClass || item['item-class'] || '',
    containerClass: item.containerClass || item['container-class'] || '',
    ariaLabel: item.ariaLabel || item['aria-label'] || '',
    value: item.value || '',
    hiddenItems,
    index,
  };
}

function parseItems(items = '', options = {}) {
  if (Array.isArray(items)) {
    return items.map((item, index) =>
      normalizeItem(item, index, items.length, options),
    );
  }

  const raw = String(items || '').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) =>
        normalizeItem(item, index, parsed.length, options),
      );
    }
  } catch {
    // Plain string format is handled below.
  }

  const entries = raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.map((entry, index) => {
    const [labelPart, ...flagParts] = entry.split('::');
    const flags = parseItemFlags(flagParts.join(','));

    return normalizeItem(
      {
        label: labelPart.trim(),
        ...flags,
      },
      index,
      entries.length,
      options,
    );
  });
}

class SfBreadcrumbs extends BreadcrumbsElement {
  static itemTemplateSlot = '__items';

  // The manifest's settings, and what the trail reads more closely: items from
  // the attribute's own forms or the property.
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      items: {
        default: [],
        parser(value, fallback, element) {
          if (value !== undefined && value !== null) return parseItems(value);
          return parseItems(element?.__sfManifestData?.items ?? []);
        },
      },
      separatorIcon: { default: 'chevron_right' },
      homeIcon: { default: 'home' },
      homeLabel: { default: '' },
      rootClass: { default: '' },
      itemClass: { default: '' },
      linkClass: { default: '' },
      currentClass: { default: '' },
      separatorClass: { default: '' },
      containerClass: { default: '' },
      ariaLabel: { default: '' },
      expandLabel: { default: '' },
      expandOnEllipsis: { default: true, type: Boolean },
      maxItems: { default: 4, type: Number },
    };
  }

  constructor() {
    super();
    this._itemObserver = null;
    this._readyCaptureHandler = null;
    this._ellipsisExpanded = false;
    this._preserveEllipsisExpanded = false;
  }

  connectedCallback() {
    if (this._isMounted) {
      return;
    }

    // Its scope (§7.7) opens with every placing, mounted or still waiting
    // for items: disconnectedCallback ends it either way, and a trail placed
    // again before its items came kept the ended one.
    this.sfOpenScope();

    // The trail mounts once it has items: a printed JSON island holds them
    // (standard 1.3.8 §5.4), read before it looks for item children.
    this.sfReadIsland();
    this.observeItemChildren();
    this.applyHostDisplayStyle();

    if (this.hasAttribute('items') || this.captureInitialItems()) {
      this.mountComponent();
      return;
    }

    this.scheduleReadyCapture();
  }

  disconnectedCallback() {
    this.disconnectItemObserver();
    this.cancelReadyCapture();
    super.disconnectedCallback();
  }

  get items() {
    return this.getProp('items');
  }

  // A list setting is a property (§4): the list given here wins until the
  // attribute is written again.
  set items(value) {
    if (!this.__sfManifestData) this.__sfManifestData = {};
    this.__sfManifestData.items = value;
    this._ellipsisExpanded = false;
    if (this.hasAttribute('items')) this.removeAttribute('items');
    else if (this._isMounted) this.requestComponentUpdate('items');
    else this.mountComponent();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);

    if (
      name === 'items' &&
      oldValue !== newValue &&
      !this._preserveEllipsisExpanded
    ) {
      this._ellipsisExpanded = false;
    }

    if (
      name === 'items' &&
      oldValue !== newValue &&
      this.isConnected &&
      !this._isMounted
    ) {
      this.mountComponent();
    }
  }

  mountComponent() {
    if (!this.isConnected || this._isMounted) {
      return;
    }
    super.connectedCallback();
  }

  observeItemChildren() {
    if (this._itemObserver) {
      return;
    }

    this._itemObserver = new MutationObserver(() => {
      if (!this.captureInitialItems()) {
        return;
      }

      this.cancelReadyCapture();

      if (!this._isMounted) {
        this.mountComponent();
        return;
      }

      if (this._isMounted) {
        this.requestComponentUpdate('items');
      }
    });

    this._itemObserver.observe(this, { childList: true });
  }

  scheduleReadyCapture() {
    if (document.readyState !== 'loading' || this._readyCaptureHandler) {
      return;
    }

    this._readyCaptureHandler = () => {
      this._readyCaptureHandler = null;

      if (!this.captureInitialItems()) {
        return;
      }

      this.mountComponent();
    };

    document.addEventListener('DOMContentLoaded', this._readyCaptureHandler, {
      once: true,
    });
  }

  cancelReadyCapture() {
    if (!this._readyCaptureHandler) {
      return;
    }

    document.removeEventListener('DOMContentLoaded', this._readyCaptureHandler);
    this._readyCaptureHandler = null;
  }

  disconnectItemObserver() {
    this._itemObserver?.disconnect?.();
    this._itemObserver = null;
  }

  isItemNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const tagName = node?.tagName?.toLowerCase?.();

    return (
      tagName === 'item' ||
      tagName === 'sf-breadcrumbs-item' ||
      node?.hasAttribute?.('data-sf-breadcrumb-item')
    );
  }

  captureInitialItems() {
    return (
      this.captureChildTemplates(
        this.constructor.itemTemplateSlot,
        (node) => this.isItemNode(node),
      ).length > 0
    );
  }

  getCapturedItems() {
    const itemNodes =
      this._slotTemplates.get(this.constructor.itemTemplateSlot) || [];

    return itemNodes.map((node) => {
      const label =
        node.getAttribute('label') ||
        node.getAttribute('text') ||
        node.getAttribute('title') ||
        node.textContent?.trim() ||
        '';

      return {
        label,
        href: node.getAttribute('href') || node.getAttribute('url') || '',
        icon: node.getAttribute('icon') || '',
        current: node.hasAttribute('current') || undefined,
        active: node.hasAttribute('active') || undefined,
        disabled: node.hasAttribute('disabled'),
        ellipsis: node.hasAttribute('ellipsis') || label === '...',
        target: node.getAttribute('target') || '',
        rel: node.getAttribute('rel') || '',
        itemClass: node.getAttribute('item-class') || '',
        containerClass: node.getAttribute('container-class') || '',
        ariaLabel: node.getAttribute('aria-label') || '',
        value: node.getAttribute('value') || '',
        hiddenItems: parseItems(
          node.getAttribute('hidden-items') || node.getAttribute('items') || '',
          { defaultCurrent: false },
        ),
      };
    });
  }

  get sourceItems() {
    const items = this.items;

    if (items.length) {
      return items.map((item, index) => normalizeItem(item, index, items.length));
    }

    const capturedItems = this.getCapturedItems();

    if (capturedItems.length) {
      return capturedItems.map((item, index) =>
        normalizeItem(item, index, capturedItems.length),
      );
    }
    return [];
  }

  get normalizedItems() {
    const items = this.sourceItems;
    return this.getDisplayItems(items);
  }

  getDisplayItems(items = []) {
    const maxItems = this.getNumberAttr('maxItems', 4);
    const expandLabel = this.getAttribute('expand-label') || this.sfWord('expand-label');

    if (
      this._ellipsisExpanded ||
      maxItems < 3 ||
      items.length <= maxItems
    ) {
      return this.reindexItems(items);
    }

    const visibleSlots = maxItems - 1;
    const leadingCount = Math.floor(visibleSlots / 2);
    const trailingCount = visibleSlots - leadingCount;
    const startItems = items.slice(0, leadingCount);
    const endItems = items.slice(items.length - trailingCount);
    const hiddenItems = items.slice(leadingCount, items.length - trailingCount);

    if (!hiddenItems.length) {
      return this.reindexItems(items);
    }

    return this.reindexItems([
      ...startItems,
      normalizeItem(
        {
          label: '…',
          ellipsis: true,
          hiddenItems,
          ariaLabel: expandLabel,
        },
        leadingCount,
        items.length,
        { defaultCurrent: false },
      ),
      ...endItems,
    ]);
  }

  reindexItems(items = []) {
    return items.map((item, index) => ({
      ...item,
      index,
      current: Boolean(item.current && index === items.length - 1),
      active: Boolean(item.active || (item.current && index === items.length - 1)),
    }));
  }

  templateContext() {
    const props = this.getPropsContext();
    const items = this.normalizedItems.map((item, index) => {
      if (index !== 0 || item.label || !props.homeLabel) {
        return item;
      }

      return {
        ...item,
        label: props.homeLabel,
        icon: item.icon || props.homeIcon,
      };
    });

    return this.createTemplateContext({
      ...props,
      ariaLabel: this.getAttribute('aria-label') || this.sfWord('aria-label'),
      expandLabel: this.getAttribute('expand-label') || this.sfWord('expand-label'),
      component: this,
      items,
      rootClass: this.getRootClass(),
    });
  }

  template() {
    return renderBreadcrumbsTemplate(this.templateContext());
  }

  get state() {
    const props = this.getPropsContext();

    return {
      ...props,
      items: this.normalizedItems,
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) return;

      if (value === false || value === null || typeof value === 'undefined') {
        this.removeAttribute(attr);
        return;
      }

      if (Array.isArray(value)) {
        this.setAttribute(attr, JSON.stringify(value));
        return;
      }

      this.setAttribute(attr, value === true ? '' : String(value));
    });

    return this;
  }

  onItemClick(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        this.sfEventName('press'),
        (event) => {
          handler(event.detail?.item, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  expandEllipsis(item) {
    if (!item?.ellipsis) {
      return false;
    }

    if (!item.hiddenItems?.length) {
      this._ellipsisExpanded = true;
      this.requestComponentUpdate('ellipsis');
      return true;
    }

    const items = this.normalizedItems;
    const nextItems = items.flatMap((currentItem) => {
      if (currentItem.index !== item.index) {
        return [currentItem];
      }

      return item.hiddenItems;
    });

    this._ellipsisExpanded = true;
    this._preserveEllipsisExpanded = true;

    try {
      this.setState({
        items: nextItems.map((nextItem, index) => ({
          ...nextItem,
          index,
          active: false,
          current: Boolean(nextItem.current && index === nextItems.length - 1),
        })),
      });
    } finally {
      this._preserveEllipsisExpanded = false;
    }

    return true;
  }

  // A press on a crumb (§8): sf-breadcrumbs-press with data only, cancelable;
  // the old name sf-breadcrumb-click follows through the alias table with its
  // old detail and the same cancel.
  handleItemClick = (event, item) => {
    if (item.disabled || item.current) {
      event.preventDefault();
    }

    this._pressOrigin = event;
    let allowed;
    try {
      allowed = this.sfEmit('press', {
        item,
        index: item.index,
        items: this.normalizedItems,
      });
    } finally {
      this._pressOrigin = null;
    }

    if (
      item.ellipsis &&
      this.getBooleanAttr('expandOnEllipsis', true) &&
      allowed
    ) {
      this.expandEllipsis(item);
    }
  };

  // The old name keeps its old detail (§16.20 split row): the element, its
  // template and the browser's event were in it.
  sfAliasAdapters() {
    return {
      'sf-breadcrumb-click': (detail) => ({
        component: this,
        tagName: this.componentTagName,
        template: this.componentTemplateName,
        ...detail,
        originalEvent: this._pressOrigin ?? null,
      }),
    };
  }
}

SfBreadcrumbs.define('sf-breadcrumbs');

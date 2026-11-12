import SfBaseElement, { toAttributeName } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { renderBreadcrumbsTemplate } from './js/templates/default';
import { collapseRange, foldGains, menuEntries, nextFit, onPhoneLadder, startFit, trailLines, trailWraps } from '../../component/breadcrumbs/js/_trail';
import { markCurrent, normalizeItem, parseItems, readFlag } from './js/items';
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
      maxItems: { default: 0, type: Number },
    };
  }

  constructor() {
    super();
    this._itemObserver = null;
    this._readyCaptureHandler = null;
    this._ellipsisExpanded = false;
    this._preserveEllipsisExpanded = false;
    // How many crumbs room hides (BC-06): 0 until the trail is measured.
    this._fitHidden = 0;
    this._fitStartLines = 0;
    this._fitNoGain = false;
    this._fitSettled = null;
    this._roomObserver = null;
    this._roomFrame = 0;
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
    this.disconnectRoom();
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
    this.restartFit();
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

    // A new trail, cap or page mode is measured again from the full trail.
    if (
      ['items', 'max-items', 'current'].includes(name) &&
      oldValue !== newValue &&
      !this._preserveEllipsisExpanded
    ) {
      this.restartFit();
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
        // current, current="false" or nothing (BC-01).
        current: node.hasAttribute('current')
          ? readFlag(node.getAttribute('current') || 'true')
          : undefined,
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
        siblings: node.getAttribute('siblings') || '',
      };
    });
  }

  // Which crumb is the page: "last" (the default) or "none", a trail of
  // parents. In sf-header-page's path the heading below is the page (owner
  // decision C93 item 4), so there the default is "none".
  get currentMode() {
    const value = String(this.getAttribute('current') || '').trim().toLowerCase();
    if (value === 'none' || value === 'last') return value;
    if (this.getAttribute('slot') === 'path' && this.parentElement?.closest?.('sf-header-page')) {
      return 'none';
    }
    return 'last';
  }

  get sourceItems() {
    const items = this.items;
    const mode = this.currentMode;

    if (items.length) {
      return markCurrent(
        items.map((item, index) => normalizeItem(item, index, items.length)),
        mode,
      );
    }

    const capturedItems = this.getCapturedItems();

    if (capturedItems.length) {
      return markCurrent(
        capturedItems.map((item, index) =>
          normalizeItem(item, index, capturedItems.length),
        ),
        mode,
      );
    }
    return [];
  }

  get normalizedItems() {
    const items = this.sourceItems;
    return this.getDisplayItems(items);
  }

  // The crumbs that fold (component/breadcrumbs/js/_trail.js, shared with
  // the class runtime, BC-11): the max-items cap when the page sets one, and
  // room -- what the last measure hid (BC-06).
  collapseOptions(items = []) {
    const last = items[items.length - 1];
    const tail = last?.current ? 2 : 1;
    return {
      maxItems: this.getNumberAttr('maxItems', 0),
      // The phone ladder starts at «… › parent › page» (C93 item 2).
      fit: Math.max(this._fitHidden, startFit(items.length, { tail, phone: onPhoneLadder() })),
      tail,
    };
  }

  // Whether a crumb's siblings are offered (C93 item 3): off unless the host
  // says siblings and the crumb carries them.
  get siblingsShown() {
    return this.getBooleanAttr('siblings', false);
  }

  getDisplayItems(items = []) {
    const expandLabel = this.getAttribute('expand-label') || this.sfWord('expand-label');

    if (this._ellipsisExpanded) {
      return this.reindexItems(items);
    }

    const range = collapseRange(items.length, this.collapseOptions(items));

    if (!range) {
      return this.reindexItems(items);
    }

    const hiddenItems = items.slice(range.start, range.end);

    return this.reindexItems([
      ...items.slice(0, range.start),
      {
        ...normalizeItem(
          {
            label: '…',
            ellipsis: true,
            hiddenItems,
            ariaLabel: expandLabel,
          },
          range.start,
          items.length,
        ),
        current: false,
        auto: true,
      },
      ...items.slice(range.end),
    ]);
  }

  reindexItems(items = []) {
    return items.map((item, index) => ({ ...item, index }));
  }

  // Room (BC-06, owner decision C93 item 1): after each drawing, while the
  // trail takes more than one line, one more crumb goes behind «…». A new
  // width starts again from the full trail. The trail's own change of size
  // (it got shorter) does not count as a new width.
  afterUpdate(changedAttributes, mode) {
    super.afterUpdate?.(changedAttributes, mode);
    this.fitTrail();
  }

  trailEntries() {
    const list = this.querySelector(':scope > nav > ol');
    return list ? Array.from(list.children) : [];
  }

  fitTrail() {
    // Only the element's own drawing is measured, never a printed first paint
    // it has not replaced yet.
    if (!this.isConnected || !this._isMounted || !this._hasRendered) return;
    this.observeRoom();

    if (!this._fitStartLines) this._fitStartLines = trailLines(this.trailEntries());

    if (!this._ellipsisExpanded && !this._fitNoGain && trailWraps(this.trailEntries())) {
      const items = this.sourceItems;
      const next = nextFit(items.length, this.collapseOptions(items));
      if (next !== null) {
        this._fitHidden = next;
        this.requestComponentUpdate('fit');
        return;
      }

      // Folded as far as it goes and no line was saved: the page's own name
      // is longer than the line. The crumbs come back until the room changes.
      if (this._fitHidden > 0 && !foldGains(this._fitStartLines, trailLines(this.trailEntries()))) {
        this._fitNoGain = true;
        this._fitHidden = 0;
        this.requestComponentUpdate('fit');
        return;
      }
    }

    this.markCutLabels();
    this._fitSettled = this.roomSize();
  }

  // A new list, setting or width measures the fold again from its start.
  restartFit() {
    this._fitHidden = 0;
    this._fitStartLines = 0;
    this._fitNoGain = false;
  }

  // A name cut with an ellipsis (C93 item 6) has its whole text as the
  // crumb's tooltip; the text itself stays whole for a screen reader.
  markCutLabels() {
    this.querySelectorAll(':scope > nav [data-sf-breadcrumb-index]').forEach((crumb) => {
      const label = crumb.querySelector(':scope > .sf-breadcrumbs-item-container > span');
      const cut = Boolean(label && label.scrollWidth > label.clientWidth + 1);
      if (cut) crumb.setAttribute('title', label.textContent.trim());
      else if (crumb.dataset.sfBreadcrumbCut) crumb.removeAttribute('title');
      if (cut) crumb.dataset.sfBreadcrumbCut = '';
      else delete crumb.dataset.sfBreadcrumbCut;
    });
  }

  roomSize() {
    const nav = this.querySelector(':scope > nav');
    const parent = this.parentElement;
    return {
      width: parent ? parent.getBoundingClientRect().width : 0,
      height: nav ? nav.getBoundingClientRect().height : 0,
    };
  }

  observeRoom() {
    if (typeof ResizeObserver === 'undefined') return;
    const nav = this.querySelector(':scope > nav');
    if (!nav || (this._roomObserver && this._roomNav === nav)) return;
    this.disconnectRoom();
    this._roomNav = nav;

    this._roomObserver = new ResizeObserver(() => {
      if (this._roomFrame) return;
      this._roomFrame = requestAnimationFrame(() => {
        this._roomFrame = 0;
        const before = this._fitSettled;
        const now = this.roomSize();
        if (
          !before ||
          (Math.abs(before.width - now.width) < 0.5 &&
            Math.abs(before.height - now.height) < 0.5)
        ) {
          return;
        }
        this._fitSettled = null;
        this.restartFit();
        this.requestComponentUpdate('fit');
      });
    });
    this._roomObserver.observe(nav);
    if (this.parentElement) this._roomObserver.observe(this.parentElement);
  }

  disconnectRoom() {
    this._roomObserver?.disconnect?.();
    this._roomObserver = null;
    this._roomNav = null;
    if (this._roomFrame) cancelAnimationFrame(this._roomFrame);
    this._roomFrame = 0;
    this._fitSettled = null;
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
      siblingsLabel: this.sfWord('siblings-label'),
      siblings: this.siblingsShown,
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

  // The «…» button leaves the trail when it opens: focus goes to the first
  // crumb it revealed (R177 BC-02), which takes the button's place.
  focusRevealed(index) {
    this.whenRendered(() => {
      const crumbs = Array.from(
        this.querySelectorAll(':scope > nav [data-sf-breadcrumb-index]'),
      ).filter((node) => Number(node.dataset.sfBreadcrumbIndex) >= index);
      const target =
        crumbs.find((node) => node.matches('a[href], button:not([disabled])')) ||
        crumbs[0];
      if (!target) return;
      if (!target.matches('a[href], button:not([disabled])')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    }, { next: true });
  }

  expandEllipsis(item) {
    if (!item?.ellipsis) {
      return false;
    }

    const hadFocus =
      this.contains(document.activeElement) || document.activeElement === document.body;

    // «…» this trail folded by itself: the full trail comes back.
    if (item.auto || !item.hiddenItems?.length) {
      this._ellipsisExpanded = true;
      if (hadFocus) this.focusRevealed(item.index);
      this.requestComponentUpdate('ellipsis');
      return true;
    }

    if (hadFocus) this.focusRevealed(item.index);

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
          // Each crumb keeps what it says; the page is decided again.
          current: nextItem.currentFlag,
          currentFlag: undefined,
          hiddenItems: undefined,
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

    // «…» opens its hidden crumbs as a menu beside it (C93 item 1); focus
    // goes into the menu and back to «…» when it closes.
    if (
      item.ellipsis &&
      this.getBooleanAttr('expandOnEllipsis', true) &&
      allowed
    ) {
      this.openMenu(item.hiddenItems || [], event.currentTarget, {
        label: this.getAttribute('expand-label') || this.sfWord('expand-label'),
        kind: 'hidden',
      });
    }
  };

  // The siblings of a crumb, from the button after it (C93 item 3).
  handleSiblingsClick = (event, item) => {
    this.openMenu(item.siblings || [], event.currentTarget, {
      label: `${this.sfWord('siblings-label')}: ${item.label}`,
      kind: 'siblings',
    });
  };

  get menu() {
    return this.querySelector(':scope > .sf-breadcrumbs-menu');
  }

  openMenu(crumbs, anchor, { label = '', kind = 'hidden' } = {}) {
    const menu = this.menu;
    if (!menu || !(anchor instanceof Element) || !crumbs.length) return false;
    this._menuCrumbs = crumbs;
    this._menuKind = kind;
    menu.setAttribute('aria-label', label);
    menu.entries = menuEntries(crumbs);
    // The Loader brings sf-menu-context with the first trail that needs it.
    customElements
      .whenDefined('sf-menu-context')
      .then(() => menu.toggleFor(anchor, { align: 'start' }));
    return true;
  }

  // A choice in the menu is a press on that crumb (§8): a link goes by itself,
  // a crumb with a value is the page's to handle; refusing the press keeps the
  // menu open.
  handleMenuSelect = (event) => {
    event.stopPropagation();
    const crumb = this._menuCrumbs?.[Number(event.detail?.id)];
    if (!crumb) return;
    const allowed = this.sfEmit('press', {
      item: { ...crumb, sibling: this._menuKind === 'siblings' },
      index: Number.isFinite(crumb.index) ? crumb.index : Number(event.detail.id),
      items: this.normalizedItems,
    });
    if (!allowed) event.preventDefault();
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

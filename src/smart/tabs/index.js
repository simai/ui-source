import { html, render } from 'lit';
import SfBaseElement, { toAttributeName, toNumber } from '../../core/js/smart-base';
import { pageText } from '../../core/js/page-language';
import { renderTabsTemplate } from './js/templates/default';

const TABS_TEXT = {
  en: {more: 'More', customize: 'Customize tabs', reset: 'Reset', visible: 'Shown', pinned: 'Always shown', moved: 'Moved'},
  ru: {more: 'Ещё', customize: 'Настроить вкладки', reset: 'Сбросить', visible: 'Показывать', pinned: 'Всегда на месте', moved: 'Перемещено'},
};
const OVERFLOWS = ['scroll', 'wrap', 'more'];

// Which item a tab in the list draws. An sf-button moves its data attributes
// to the button inside it, so the index is read wherever it landed.
function tabIndexOf(element) {
  const own = element?.dataset?.sfTabIndex ?? element?.querySelector?.(':scope > [data-sf-tab-index]')?.dataset?.sfTabIndex;
  const index = Number(own);
  return own !== undefined && Number.isInteger(index) ? index : null;
}

let tabsSequence = 0;

function parseItems(items = '') {
  if (Array.isArray(items)) {
    return items
      .map((item) => (typeof item === 'string' ? { label: item } : item))
      .filter(Boolean);
  }

  return String(items || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelPart, flagsPart = ''] = entry.split('::');
      const flags = flagsPart
        .split(',')
        .map((flag) => flag.trim().toLowerCase())
        .filter(Boolean);
      const options = {};

      flags.forEach((flag) => {
        const [key, value] = flag.split('=');
        if (!value && !['icon-start', 'icon-end', 'iconstart', 'iconend'].includes(key)) return;
        options[key] = value;
      });

      return {
        label: labelPart.trim(),
        disabled: flags.includes('disabled'),
        icon: options.icon || '',
        iconLeft: options['icon-left'] || options.iconleft || '',
        iconRight: options['icon-right'] || options.iconright || '',
        iconStart: options['icon-start'] ?? options.iconstart ?? null,
        iconEnd: options['icon-end'] ?? options.iconend ?? null,
      };
    });
}

function normalizeIndex(index, total) {
  const value = toNumber(index, 0);
  if (!Number.isFinite(value) || value < 0 || value >= total) {
    return 0;
  }

  return value;
}

function normalizeComponentDescriptor(component = null) {
  if (!component || typeof component !== 'object' || !component.type) {
    return null;
  }

  return {
    type: component.type,
    props: component.props && typeof component.props === 'object' ? component.props : {},
  };
}

function normalizeTabItem(item = {}) {
  if (typeof item === 'string') {
    return {
      label: item,
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const component = normalizeComponentDescriptor(item.component);

  return {
    ...item,
    component,
    label: item.label || item.text || item.title || '',
  };
}

function normalizePanelItem(item = {}) {
  if (typeof item === 'string') {
    return {
      text: item,
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  return {
    ...item,
    component: normalizeComponentDescriptor(item.component),
  };
}

class SfTabs extends SfBaseElement {
  static get props() {
    return {
      templateName: { attribute: 'template', default: 'default' },
      type: { default: null },
      size: { default: '1' },
      variant: { default: 'buttons' },
      scheme: { default: 'default' },
      topPosition: {default: 'start'},
      // scroll (the default), wrap, or more: what does not fit goes into
      // «Ещё» (owner, 2026-10-14).
      overflow: { default: 'scroll' },
      // A gear at the end of the tabs: the person orders and hides them; the
      // host keeps the choice (sf-tabs-settings-change, setSettings).
      configurable: { type: Boolean, default: false },
      activeIndex: { type: Number, default: 0 },
      items: {
        default: [],
        parser(value) {
          return parseItems(value);
        },
      },
      rootClass: { default: '' },
      topClass: { default: '' },
      panelClass: { default: '' },
    };
  }

  constructor() {
    super();
    this._tabsId = `sf-smart-tabs-${++tabsSequence}`;
    this._data = {
      tabs: [],
      panels: [],
    };
    this.addEventListener('click', this.handleRootClick);
    this.addEventListener('keydown', this.handleRootKeyDown);
    this._settings = { order: [], hidden: [] };
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.scheduleOverflow())
      : null;
    this.addEventListener('sf-after-render', (event) => {
      // Built-in Smart buttons can finish rendering after their owning Tabs.
      if (event.target !== this && event.target.parentElement === this.tabList) {
        this.syncTabSemantics();
      }
    });
  }

  get tabList() {
    return this.querySelector(':scope > .sf-tabs > .sf-tabs-top-container > [role="tablist"]');
  }

  // The tab of each item, by the item's index: the tabs are drawn in the
  // person's order, and a hidden one is not drawn at all.
  get tabTargets() {
    const targets = [];
    for (const element of Array.from(this.tabList?.children || [])) {
      const target = element.matches('sf-button,sf-icon-button')
        ? element.querySelector(':scope > button')
        : element.matches('[role="tab"]') ? element : null;
      const index = tabIndexOf(element);
      if (Number.isInteger(index)) targets[index] = target;
    }
    return targets;
  }

  afterRender(callback) {
    if (typeof callback === 'function') return super.afterRender(callback);
    this.syncTabSemantics();
    if (this._resizeObserver && this.tabList && !this._observed) {
      this._resizeObserver.observe(this);
      this._observed = true;
    }
    this.scheduleOverflow();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._observed = false;
    this._moreMenu?.close?.({restoreFocus: false});
    this._moreMenu?.remove?.();
    this._settingsMenu?.close?.({restoreFocus: false});
    this._settingsMenu?.remove?.();
    super.disconnectedCallback?.();
  }

  text(key) {
    return pageText(TABS_TEXT, key, this, 'sf-tabs');
  }

  // The menus the tabs open («Ещё», the settings) are a step the tabs are: 1/2
  // for tabs at 1/2, 1 otherwise.
  menuSize() {
    return (this.getAttribute('size') ?? '1') === '1/2' ? '1/2' : '1';
  }

  syncTabSemantics() {
    const items = this.computedItems;
    const shown = new Set(this.displayItems.map((item) => item.index));
    const tabStop = items.find(item => item.selected && !item.disabled && shown.has(item.index))
      || items.find(item => !item.disabled && shown.has(item.index));
    this.tabTargets.forEach((tab, index) => {
      const item = items[index];
      if (!tab || !item) return;
      if (item.href && item.selected) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute?.('aria-current');
      tab.id = `${this._tabsId}-tab-${index}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `${this._tabsId}-panel-${index}`);
      tab.setAttribute('aria-selected', item.selected ? 'true' : 'false');
      tab.setAttribute('aria-disabled', item.disabled ? 'true' : 'false');
      const label = tab.querySelector(':scope > .sf-button-text-container');
      if (label) {
        // Preserve authored text slots while excluding decorative icon ligatures
        // from the name. Icon-only buttons receive item.label in the template.
        label.id = `${this._tabsId}-label-${index}`;
        tab.setAttribute('aria-labelledby', label.id);
      } else if (item.label) {
        // An icon-only tab is named on its inner button. On the sf-icon-button
        // host the name would make the host a named node inside the tablist,
        // where only tabs are allowed, and the tab itself would stay unnamed.
        tab.setAttribute('aria-label', item.label);
      }
      tab.tabIndex = item === tabStop ? 0 : -1;
    });
  }

  ownedTab(event) {
    const tab = event.target?.closest?.('[data-sf-tab-index]');
    if (!(tab instanceof HTMLElement) || tab.closest('sf-tabs') !== this
      || tab.closest('[role="tablist"]') !== this.tabList) return null;
    return this.tabTargets.includes(tab) ? tab : null;
  }

  getData() {
    const data = this._data;

    return data && typeof data === 'object'
      ? data
      : {
          tabs: [],
          panels: [],
        };
  }

  normalizeData(data = {}) {
    const tabsSource = data.tabs || data.items || [];
    const panelsSource = data.panels || data.content || [];

    return {
      ...data,
      tabs: Array.isArray(tabsSource)
        ? tabsSource.map(normalizeTabItem).filter(Boolean)
        : [],
      panels: Array.isArray(panelsSource)
        ? panelsSource.map(normalizePanelItem).filter(Boolean)
        : [],
    };
  }

  setData(data = {}, reason = 'data') {
    const currentData = this.getData();
    const nextData = typeof data === 'function' ? data(currentData) : data;

    if (!nextData || typeof nextData !== 'object') {
      return this;
    }

    this._data = this.normalizeData({
      ...currentData,
      ...nextData,
    });
    this.requestComponentUpdate(reason);

    return this;
  }

  setItems(items = [], reason = 'items') {
    const nextItems = typeof items === 'function' ? items(this.dataTabs) : items;

    return this.setData(
      {
        tabs: Array.isArray(nextItems) ? nextItems : [],
      },
      reason,
    );
  }

  addItems(items = [], reason = 'items') {
    const nextItems = Array.isArray(items) ? items : [items];

    return this.setItems(
      (currentItems) => [...currentItems, ...nextItems.filter(Boolean)],
      reason,
    );
  }

  setPanels(panels = [], reason = 'panels') {
    const nextPanels =
      typeof panels === 'function' ? panels(this.dataPanels) : panels;

    return this.setData(
      {
        panels: Array.isArray(nextPanels) ? nextPanels : [],
      },
      reason,
    );
  }

  addPanels(panels = [], reason = 'panels') {
    const nextPanels = Array.isArray(panels) ? panels : [panels];

    return this.setPanels(
      (currentPanels) => [...currentPanels, ...nextPanels.filter(Boolean)],
      reason,
    );
  }

  get items() {
    return this.getProp('items');
  }

  get dataTabs() {
    const data = this.getData();

    return Array.isArray(data.tabs) ? data.tabs : [];
  }

  get dataPanels() {
    const data = this.getData();

    return Array.isArray(data.panels) ? data.panels : [];
  }

  get panelSlotNames() {
    const names = new Set();

    [this._slotTemplates, this._liveSlotNodes].forEach((storage) => {
      if (!storage) return;
      storage.forEach((_, name) => {
        if (/^panel-\d+$/.test(name)) {
          names.add(name);
        }
      });
    });

    return Array.from(names).sort((a, b) => {
      return toNumber(a.replace('panel-', ''), 0) - toNumber(b.replace('panel-', ''), 0);
    });
  }

  get tabCount() {
    return Math.max(
      this.dataTabs.length,
      this.dataPanels.length,
      this.items.length,
      this.panelSlotNames.length,
    );
  }

  get computedItems() {
    const items = this.dataTabs.length ? this.dataTabs : this.items;
    const panels = this.dataPanels;
    const activeIndex = this.activeIndex;

    return Array.from({ length: this.tabCount }).map((_, index) => {
      const item = items[index] || {};

      return {
        ...item,
        label: item.label || `Tab ${index + 1}`,
        key: String(item.key ?? index),
        pinned: Boolean(item.pinned),
        count: item.count ?? null,
        href: item.href || '',
        disabled: Boolean(item.disabled),
        icon: item.icon || '',
        iconStart: item.iconStart ?? (item.iconLeft || item.icon || ''),
        iconEnd: item.iconEnd ?? (item.iconRight || ''),
        iconLeft: item.iconStart ?? (item.iconLeft || item.icon || ''),
        iconRight: item.iconEnd ?? (item.iconRight || ''),
        component: item.component || null,
        panel: panels[index] || null,
        index,
        slotName: item.slotName || `panel-${index}`,
        tabSlotName: item.tabSlotName || `tab-${index}`,
        selected: index === activeIndex,
      };
    });
  }

  get activeIndex() {
    const rawValue =
      this.getAttribute('active-index') ||
      this.getAttribute('active') ||
      this.getAttribute('data-active-index') ||
      0;

    return normalizeIndex(rawValue, Math.max(this.tabCount, 1));
  }

  get overflow() {
    const value = this.getAttribute('overflow');
    return OVERFLOWS.includes(value) ? value : 'scroll';
  }

  get configurable() {
    return this.getBooleanAttr('configurable', false);
  }

  // ─── the person's arrangement ─────────────────────────────────────────────
  // {order: [keys], hidden: [keys]}, kept by the host. A key the items no
  // longer have is ignored; an item the order does not name follows, visible,
  // in its declared place; a pinned tab is never hidden.
  get settings() {
    return { order: [...this._settings.order], hidden: [...this._settings.hidden] };
  }

  setSettings(settings = {}) {
    const order = Array.isArray(settings?.order) ? settings.order.map(String) : [];
    const hidden = Array.isArray(settings?.hidden) ? settings.hidden.map(String) : [];
    this._settings = { order, hidden };
    this.requestComponentUpdate('settings');
    this.renderSettingsList();
    return this;
  }

  // The tabs as the person arranged them: in their order, without the hidden
  // ones -- except the active one, which is shown in place while it is active,
  // so a panel never stands without its tab.
  get displayItems() {
    const items = this.computedItems;
    const byKey = new Map(items.map((item) => [item.key, item]));
    const ordered = [];
    for (const key of this._settings.order) {
      const item = byKey.get(key);
      if (item && !ordered.includes(item)) ordered.push(item);
    }
    for (const item of items) if (!ordered.includes(item)) ordered.push(item);
    const hidden = new Set(this._settings.hidden);
    return ordered.filter((item) => item.pinned || item.selected || !hidden.has(item.key));
  }

  // The arrangement as the settings list shows it: every tab, in order.
  get arrangedItems() {
    const items = this.computedItems;
    const byKey = new Map(items.map((item) => [item.key, item]));
    const ordered = [];
    for (const key of this._settings.order) {
      const item = byKey.get(key);
      if (item && !ordered.includes(item)) ordered.push(item);
    }
    for (const item of items) if (!ordered.includes(item)) ordered.push(item);
    return ordered;
  }

  changeSettings(next, reason) {
    // A pinned tab is never hidden, so it is not said to be.
    const pinned = new Set(this.computedItems.filter((item) => item.pinned).map((item) => item.key));
    this._settings = { order: next.order.map(String), hidden: next.hidden.map(String).filter((key) => !pinned.has(key)) };
    this.requestComponentUpdate('settings');
    this.renderSettingsList();
    this.emitComponentEvent('tabs-settings-change', { ...this.settings, reason });
  }

  resetSettings() {
    this._settings = { order: [], hidden: [] };
    this.requestComponentUpdate('settings-reset');
    this.renderSettingsList();
    this.emitComponentEvent('tabs-settings-reset', {});
  }

  // ─── «Ещё» ────────────────────────────────────────────────────────────────
  scheduleOverflow() {
    if (this._overflowFrame) return;
    this._overflowFrame = requestAnimationFrame(() => {
      this._overflowFrame = 0;
      this.layoutOverflow();
    });
  }

  layoutOverflow() {
    const list = this.tabList;
    const more = this.querySelector(':scope > .sf-tabs > .sf-tabs-top-container > .sf-tabs-more');
    if (!list) return;
    const hosts = Array.from(list.children).filter((element) => Number.isInteger(tabIndexOf(element)));
    for (const host of hosts) host.classList.remove('sf-tabs-overflowed');
    this._overflowed = [];
    const container = list.parentElement;
    const showMore = (shown) => {
      if (shown) container?.setAttribute('data-sf-tabs-more', '');
      else container?.removeAttribute('data-sf-tabs-more');
    };
    if (this.overflow !== 'more' || this.getAttribute('type') === 'vertical') {
      showMore(false);
      return;
    }
    const width = (host) => {
      const box = host.matches('sf-button,sf-icon-button')
        ? host.querySelector(':scope > .sf-button, :scope > .sf-icon-button, :scope > button')
        : host;
      return box?.getBoundingClientRect().width ?? 0;
    };
    const widths = hosts.map(width);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const fits = (available) => {
      const kept = [];
      let used = 0;
      hosts.forEach((host, at) => {
        const next = used + (kept.length ? gap : 0) + widths[at];
        if (next <= available + 0.5) { kept.push(at); used = next; }
      });
      return kept.length === hosts.length ? null : kept;
    };
    showMore(false);
    let kept = fits(list.clientWidth);
    if (kept) {
      showMore(true);
      kept = fits(list.clientWidth) ?? hosts.map((_, at) => at);
      // The active tab always stays: the last kept one gives way to it.
      const active = hosts.findIndex((host) => tabIndexOf(host) === this.activeIndex);
      if (active >= 0 && !kept.includes(active)) {
        let used = kept.reduce((sum, at, n) => sum + widths[at] + (n ? gap : 0), 0);
        while (kept.length && used + gap + widths[active] > list.clientWidth + 0.5) {
          const dropped = kept.pop();
          used -= widths[dropped] + (kept.length ? gap : 0);
        }
        kept.push(active);
        kept.sort((a, b) => a - b);
      }
      hosts.forEach((host, at) => {
        // A class, not a data attribute: sf-button moves its data attributes
        // to the button inside it, and only class and style stay on the host.
        if (!kept.includes(at)) host.classList.add('sf-tabs-overflowed');
      });
      this._overflowed = hosts.filter((_, at) => !kept.includes(at)).map((host) => tabIndexOf(host));
      if (more) {
        const label = `${this.text('more')} (${this._overflowed.length})`;
        more.setAttribute('text', label);
        more.setAttribute('aria-label', label);
      }
    }
  }

  async openMore(anchor) {
    const items = this.computedItems;
    const entries = (this._overflowed ?? []).map((index) => items[index]).filter(Boolean).map((item) => ({
      id: String(item.index), text: item.label, icon: item.icon || undefined, disabled: item.disabled,
      value: item.count === null || item.count === undefined ? undefined : String(item.count),
    }));
    if (!entries.length) return;
    const menu = await this.standardMenu('_moreMenu', (id) => this.activate(Number(id)));
    menu.setAttribute('aria-label', this.text('more'));
    menu.setAttribute('size', this.menuSize());
    menu.entries = entries;
    menu.toggleFor(anchor);
  }

  async standardMenu(field, select) {
    if (!customElements.get('sf-context-menu')) {
      globalThis.SF?.Loader?.ensurePlugin?.('cl-context-menu');
      await Promise.race([customElements.whenDefined('sf-context-menu'), new Promise((done) => setTimeout(done, 3000))]);
    }
    if (this[field]?.isConnected) return this[field];
    const menu = document.createElement('sf-context-menu');
    menu.setAttribute('popup', '');
    menu.addEventListener('sf-context-menu-select', (event) => select?.(event.detail?.id, event));
    (this.closest('dialog[open]') || document.body).append(menu);
    this[field] = menu;
    return menu;
  }

  // A tab chosen anywhere -- its own button, «Ещё» -- is activated the same
  // way; a tab that is a link goes to its address.
  activate(index, event = null) {
    const item = this.computedItems[index];
    if (!item || item.disabled) return;
    if (item.href) {
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) {
        globalThis.open?.(item.href, '_blank', 'noopener');
        return;
      }
      this.goTo(index);
      if (globalThis.location && item.href !== globalThis.location.href) globalThis.location.assign(item.href);
      return;
    }
    this.goTo(index);
  }

  // ─── the settings ─────────────────────────────────────────────────────────
  async openSettings(anchor) {
    const menu = await this.settingsMenu();
    menu.setAttribute('size', this.menuSize());
    this.renderSettingsList();
    menu.toggleFor(anchor, {width: 'content'});
  }

  async settingsMenu() {
    if (this._settingsMenu?.isConnected) return this._settingsMenu;
    if (!customElements.get('sf-context-menu')) {
      globalThis.SF?.Loader?.ensurePlugin?.('cl-context-menu');
      await Promise.race([customElements.whenDefined('sf-context-menu'), new Promise((done) => setTimeout(done, 3000))]);
    }
    globalThis.SF?.Loader?.ensureSmartElementLoaded?.('sf-sortable');
    globalThis.SF?.Loader?.ensureSmartElementLoaded?.('sf-checkbox');
    const menu = document.createElement('sf-context-menu');
    menu.setAttribute('popup', '');
    menu.setAttribute('aria-label', this.text('customize'));
    menu.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.slot = 'content';
    body.className = 'sf-context-menu-body sf-tabs-settings-body';
    const reset = document.createElement('sf-button');
    reset.slot = 'footer';
    reset.setAttribute('appearance', 'outline');
    reset.setAttribute('scheme', 'on-surface');
    reset.setAttribute('size', this.menuSize());
    reset.setAttribute('text', this.text('reset'));
    reset.addEventListener('click', () => this.resetSettings());
    menu.append(body, reset);
    (this.closest('dialog[open]') || document.body).append(menu);
    this._settingsMenu = menu;
    this._settingsBody = body;
    return menu;
  }

  renderSettingsList() {
    const body = this._settingsBody;
    if (!body) return;
    const items = this.arrangedItems;
    const hidden = new Set(this._settings.hidden);
    const size = this.menuSize();
    const onIntent = (event) => {
      const {item, index} = event.detail ?? {};
      const keys = items.map((entry) => entry.key);
      const from = keys.indexOf(String(item));
      if (from < 0) return;
      keys.splice(from, 1);
      keys.splice(Math.max(0, Math.min(index, keys.length)), 0, String(item));
      this.changeSettings({order: keys, hidden: [...hidden]}, 'order');
    };
    const toggle = (key, shown) => {
      const next = new Set(hidden);
      if (shown) next.delete(key); else next.add(key);
      this.changeSettings({order: items.map((entry) => entry.key), hidden: [...next]}, 'visibility');
    };
    render(html`
      <sf-sortable class="sf-tabs-settings-list" group="sf-tabs-settings" label=${this.text('customize')}
                   @sf-sortable-intent=${onIntent}>
        ${items.map((item) => html`
          <div class="sf-tabs-settings-row" data-sf-sortable-item=${item.key}>
            <span class="sf-tabs-settings-handle" data-sf-sortable-handle aria-hidden="true"><i class="sf-icon">drag_indicator</i></span>
            <span class="sf-tabs-settings-label">${item.label}</span>
            ${item.pinned
              ? html`<i class="sf-icon sf-tabs-settings-pin" title=${this.text('pinned')} aria-label=${this.text('pinned')}>push_pin</i>`
              : html`<sf-checkbox size=${size} .checked=${!hidden.has(item.key)} aria-label=${`${this.text('visible')}: ${item.label}`}
                       @change=${(event) => toggle(item.key, Boolean(event.target?.checked ?? event.detail?.checked))}></sf-checkbox>`}
          </div>`)}
      </sf-sortable>`, body);
  }

  templateContext() {
    const props = this.getPropsContext();

    return this.createTemplateContext({
      ...props,
      component: this,
      tabsId: this._tabsId,
      activeIndex: this.activeIndex,
      displayItems: this.displayItems,
      overflow: this.overflow,
      configurable: this.configurable,
      moreText: this.text('more'),
      customizeText: this.text('customize'),
      rootClass: this.getRootClass(),
      items: this.computedItems,
      data: this.getData(),
    });
  }

  template() {
    return renderTabsTemplate(this.templateContext());
  }

  get state() {
    const props = this.getPropsContext();

    return {
      ...props,
      activeIndex: this.activeIndex,
      items: this.items,
      data: this.getData(),
      rootClass: this.getRootClass(),
    };
  }

  setState(nextState = {}) {
    Object.entries(nextState || {}).forEach(([key, value]) => {
      const attr = toAttributeName(key);
      if (!attr) {
        return;
      }

      if (value === false || value === null || value === undefined || value === '') {
        this.removeAttribute(attr);
        return;
      }

      if (Array.isArray(value)) {
        const serialized = value
          .map((item) => {
            if (typeof item === 'string') {
              return item;
            }

            const flags = [];
            if (item?.disabled) {
              flags.push('disabled');
            }
            if (item?.icon) {
              flags.push(`icon=${item.icon}`);
            }
            if (item?.iconLeft) {
              flags.push(`icon-left=${item.iconLeft}`);
            }
            if (item?.iconRight) {
              flags.push(`icon-right=${item.iconRight}`);
            }
            if (item?.iconStart !== undefined && item?.iconStart !== null) {
              flags.push(`icon-start=${item.iconStart}`);
            }
            if (item?.iconEnd !== undefined && item?.iconEnd !== null) {
              flags.push(`icon-end=${item.iconEnd}`);
            }

            return flags.length ? `${item.label}::${flags.join(',')}` : item.label;
          })
          .join('|');
        this.setAttribute(attr, serialized);
        return;
      }

      this.setAttribute(attr, value === true ? '' : String(value));
    });

    return this;
  }

  goTo(index) {
    const items = this.computedItems;
    const nextIndex = normalizeIndex(index, Math.max(items.length, 1));
    const item = items[nextIndex];

    if (!item || item.disabled || nextIndex === this.activeIndex) {
      return this;
    }

    const previous = this.activeIndex;
    this.setAttribute('active-index', String(nextIndex));
    this.emitComponentEvent('tab-change', {
      previous,
      current: nextIndex,
      item,
      items,
    });
    return this;
  }

  onTabChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        'sf-tab-change',
        (event) => {
          handler(event.detail?.current, event.detail, event);
        },
        options,
      );
    }

    return this;
  }

  handleRootClick = (event) => {
    const tool = event.target?.closest?.('.sf-tabs-more, .sf-tabs-settings');
    if (tool && tool.closest('sf-tabs') === this) {
      const anchor = tool.querySelector('button') ?? tool;
      if (tool.classList.contains('sf-tabs-more')) this.openMore(anchor);
      else this.openSettings(anchor);
      return;
    }
    const tab = this.ownedTab(event);
    if (!tab) return;
    this.activate(Number(tab.dataset.sfTabIndex), event);
  };

  handleRootKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const tab = this.ownedTab(event);
    // A custom tab descriptor may contain its own input/widget. Its keys are
    // not navigation commands for this tab list.
    if (!tab || event.target !== tab) return;
    const vertical = this.tabList.getAttribute('aria-orientation') === 'vertical';
    const arrows = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!['Enter', ' ', 'Home', 'End', ...arrows].includes(event.key)) return;

    event.preventDefault();

    if (event.key === 'Enter' || event.key === ' ') {
      this.goTo(tab.dataset.sfTabIndex);
      return;
    }

    let direction = event.key === arrows[0] ? -1 : 1;
    if (!vertical && getComputedStyle(this.tabList).direction === 'rtl') direction *= -1;
    // The arrows walk the tabs in the order they stand, past the ones in
    // «Ещё» and the hidden ones.
    const overflowed = new Set(this._overflowed ?? []);
    const enabledItems = this.displayItems.filter((item) => !item.disabled && !overflowed.has(item.index));
    if (!enabledItems.length) {
      return;
    }

    const currentEnabledIndex = enabledItems.findIndex(
      (item) => item.index === Number(tab.dataset.sfTabIndex),
    );
    const nextEnabledIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? enabledItems.length - 1
        : (currentEnabledIndex + direction + enabledItems.length) % enabledItems.length;
    const nextIndex = enabledItems[nextEnabledIndex].index;
    this.goTo(nextIndex);
    this.syncTabSemantics();
    this.tabTargets[nextIndex]?.focus();
  };
}

SfTabs.define('sf-tabs');

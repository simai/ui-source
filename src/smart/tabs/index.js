import { html, nothing, render } from 'lit';
import SfBaseElement, { toAttributeName, toNumber } from '../../core/js/smart-base';
import { elementFromManifest } from '../../core/js/element-manifest';
import { instancePath, partId } from '../../core/js/instance-path';
import { renderTabsTemplate } from './js/templates/default';
import manifest from './component.json';
import aliases from './aliases.json';
import en from './lang/en.json';
import ru from './lang/ru.json';

// sf-tabs from its component.json (standard simai.smart-component 1.3.8 §3,
// §4, §7.2.1, §7.2.3, §8, §11): the settings are attributes and properties
// made by core/js/element-manifest.js, the words are lang/<locale>.json, the
// actions answer outcomes, and the old event name sf-tab-change is a dated
// alias of sf-tabs-change.
const TabsElement = elementFromManifest(manifest, {
  base: SfBaseElement,
  lang: { en, ru },
  source: 'ru',
  aliases,
});

// A page's or an assembly's own panels: direct children of the host
// (§7.2.1 «A tab opens a part», §7.2.3 a panel per entry).
const isPagePanel = (node) => node?.nodeType === 1 && node.getAttribute('role') === 'tabpanel'
  && !node.hasAttribute('slot') && !node.hasAttribute('data-sf-static');
const OVERFLOWS = ['scroll', 'wrap', 'more'];

// Which item a tab in the list draws. An sf-button moves its data attributes
// to the button inside it, so the index is read wherever it landed.
function tabIndexOf(element) {
  const own = element?.dataset?.sfTabIndex ?? element?.querySelector?.(':scope > [data-sf-tab-index]')?.dataset?.sfTabIndex;
  const index = Number(own);
  return own !== undefined && Number.isInteger(index) ? index : null;
}

function parseItems(items = '') {
  // The list as JSON in the attribute reads like the property.
  if (typeof items === 'string' && items.trim().startsWith('[')) {
    try {
      return parseItems(JSON.parse(items));
    } catch {
      // Not JSON: the "label::flags|label" form below.
    }
  }
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

class SfTabs extends TabsElement {
  static get props() {
    return {
      ...super.props,
      templateName: { attribute: 'template', default: 'default' },
      type: { default: null },
      // The sheet's sizes (component.json): an unknown one draws as 1.
      size: { default: '1', values: ['1/2', '1', '2'] },
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
        parser(value, fallback, element) {
          if (value !== undefined && value !== null) return parseItems(value);
          return parseItems(element?.__sfManifestData?.items ?? []);
        },
      },
      rootClass: { default: '' },
      topClass: { default: '' },
      panelClass: { default: '' },
    };
  }

  constructor() {
    super();
    // The page's own panels, in their order (see capturePagePanels).
    this._pagePanels = [];
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

  // type is optional (component.json): absent is no type, not the first value.
  get type() {
    return this.getProp('type');
  }

  set type(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('type');
    else this.setAttribute('type', String(value));
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
    // The box that has a size: sf-tabs is display:contents, so observing the
    // element itself never fired and «Ещё» was laid out once, wrong after any
    // resize (docs trial 4, 2026-10-15).
    const container = this.tabList?.parentElement;
    if (this._resizeObserver && container && this._observed !== container) {
      this._resizeObserver.disconnect();
      this._resizeObserver.observe(container);
      this._observed = container;
    }
    this.scheduleOverflow();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._observed = null;
    this._moreMenu?.close?.({restoreFocus: false});
    this._moreMenu?.remove?.();
    this._settingsMenu?.close?.({restoreFocus: false});
    this._settingsMenu?.remove?.();
    super.disconnectedCallback?.();
  }

  text(key) {
    return this.sfWord(key);
  }

  // The host's path id (§7.1.1, simai/ui-source#41): the tab, panel and label
  // ids are <path>--tab-<n>, --panel-<n> and --label-<n>. A module counter
  // numbered them in creation order before.
  get tabsId() {
    return partId(instancePath(this, { kind: 'sf-tabs' }));
  }

  // ─── the page's panels (§7.2.1, §7.2.3) ───────────────────────────────────
  // <div role="tabpanel"> written inside the host, or placed there by an
  // assembly, are the panels: the same live nodes, moved into the panel row
  // and never copied. A panel with data-entry="<id>" is the panel of that
  // entry; the others follow in order. A closed one carries `hidden`, so a
  // part with start opened inside it starts when its tab opens.
  captureSlotTemplates() {
    const first = !this._slotTemplatesCaptured;
    super.captureSlotTemplates();
    if (!first) return;
    this.capturePagePanels();
    if (typeof MutationObserver === 'function') {
      this._panelObserver = new MutationObserver(() => {
        if (this.capturePagePanels()) this.requestComponentUpdate('panels');
      });
      this._panelObserver.observe(this, { childList: true });
    }
  }

  capturePagePanels() {
    const found = Array.from(this.children).filter(isPagePanel);
    for (const panel of found) {
      panel.remove();
      this._pagePanels.push(panel);
    }
    return found.length > 0;
  }

  // The page's panel of an entry: by data-entry, else by place among the ones
  // without it.
  pagePanelFor(item, index) {
    if (!this._pagePanels.length) return null;
    const byEntry = this._pagePanels.find((panel) => panel.getAttribute('data-entry') === item.key);
    if (byEntry) return byEntry;
    const loose = this._pagePanels.filter((panel) => !panel.hasAttribute('data-entry'));
    return loose[index] ?? null;
  }

  // Manual activation over deferred panels (§7.2.1): a panel holding a part
  // that starts later is opened by Enter or Space, never by the arrows alone.
  get manualActivation() {
    return this._pagePanels.some((panel) => panel.querySelector?.('[data-sf-start]'))
      || Boolean(this.querySelector?.(':scope > .sf-tabs > .sf-tabs-main-container [data-sf-start]'));
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
    const tabsId = this.tabsId;
    this.tabTargets.forEach((tab, index) => {
      const item = items[index];
      if (!tab || !item) return;
      if (item.href && item.selected) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute?.('aria-current');
      tab.id = `${tabsId}--tab-${index}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', this.pagePanelFor(item, index)?.id || `${tabsId}--panel-${index}`);
      tab.setAttribute('aria-selected', item.selected ? 'true' : 'false');
      tab.setAttribute('aria-disabled', item.disabled ? 'true' : 'false');
      const label = tab.querySelector(':scope > .sf-button-text-container');
      if (label) {
        // Preserve authored text slots while excluding decorative icon ligatures
        // from the name. Icon-only buttons receive item.label in the template.
        label.id = `${tabsId}--label-${index}`;
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
      return { outcome: 'refused', reason: 'invalid' };
    }

    this._data = this.normalizeData({
      ...currentData,
      ...nextData,
    });
    this.requestComponentUpdate(reason);

    return { outcome: 'applied' };
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

  // A list setting is a property (§4, §16 item 42): the list given here wins
  // until the attribute is written again.
  set items(value) {
    if (!this.__sfManifestData) this.__sfManifestData = {};
    this.__sfManifestData.items = value;
    if (this.hasAttribute('items')) this.removeAttribute('items');
    else this.requestComponentUpdate('items');
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
      this._pagePanels.filter((panel) => !panel.hasAttribute('data-entry')).length,
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
        // The entry's id (§16 item 42); key is its old name.
        key: String(item.id ?? item.key ?? index),
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
    // `selected` names the entry by its id (§7.2.3 values.selected).
    const selectedId = this.getAttribute('selected');
    if (selectedId) {
      const items = this.dataTabs.length ? this.dataTabs : this.items;
      const at = items.findIndex((item, index) => String(item?.id ?? item?.key ?? index) === selectedId);
      if (at >= 0) return at;
    }
    const rawValue =
      this.getAttribute('active-index') ||
      this.getAttribute('active') ||
      this.getAttribute('data-active-index') ||
      0;

    return normalizeIndex(rawValue, Math.max(this.tabCount, 1));
  }

  set activeIndex(value) {
    this.setAttribute('active-index', String(toNumber(value, 0)));
  }

  // The selected entry's id (§4 values): writing it selects that tab and is
  // not reported (§8).
  get selected() {
    return this.computedItems[this.activeIndex]?.key ?? '';
  }

  set selected(value) {
    if (value === null || value === undefined || value === '') this.removeAttribute('selected');
    else this.setAttribute('selected', String(value));
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

  set settings(value) {
    this.setSettings(value);
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
    const hidden = new Set(this._settings.hidden);
    return this.arrangedItems.filter((item) => item.pinned || item.selected || !hidden.has(item.key));
  }

  // The arrangement as the settings list shows it: every tab, in order.
  // Pinned tabs stay first, in their declared order, whatever the stored
  // order says: the person arranges the others after them (docs trial 5: a
  // pinned tab could be dragged and overtaken).
  get arrangedItems() {
    const items = this.computedItems;
    const byKey = new Map(items.map((item) => [item.key, item]));
    const ordered = items.filter((item) => item.pinned);
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
    this.sfEmit('settings-change', { ...this.settings, reason });
  }

  resetSettings() {
    this._settings = { order: [], hidden: [] };
    this.requestComponentUpdate('settings-reset');
    this.renderSettingsList();
    this.sfEmit('settings-reset', {});
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
      // The pinned tabs and the active one always stay in the row: the last
      // kept tabs that are neither give way to them. (Only the active one did:
      // at 375px a pinned first tab went into «Ещё» beside an active one,
      // docs trial 5.)
      const items = this.computedItems;
      const must = hosts.map((host, at) => at).filter((at) => {
        const index = tabIndexOf(hosts[at]);
        return index === this.activeIndex || items[index]?.pinned === true;
      });
      const missing = must.filter((at) => !kept.includes(at));
      if (missing.length) {
        const span = (indices) => indices.reduce((sum, at, n) => sum + widths[at] + (n ? gap : 0), 0);
        const next = [...kept, ...missing];
        while (span(next) > list.clientWidth + 0.5) {
          const dropAt = next.slice().reverse().find((at) => !must.includes(at));
          if (dropAt === undefined) break;
          next.splice(next.indexOf(dropAt), 1);
        }
        kept = next.sort((a, b) => a - b);
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
    const menu = await this.standardMenu('_moreMenu', (id) => this.activate(Number(id), null, { person: true }));
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
  activate(index, event = null, { person = true } = {}) {
    const item = this.computedItems[index];
    if (!item || item.disabled) return;
    if (item.href) {
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) {
        globalThis.open?.(item.href, '_blank', 'noopener');
        return;
      }
      this.selectTab(index, { person });
      if (globalThis.location && item.href !== globalThis.location.href) globalThis.location.assign(item.href);
      return;
    }
    this.selectTab(index, { person });
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
    // Only the tabs that are not pinned are sortable items, so the index the
    // list reports counts among them; the pinned ones lead.
    const pinnedKeys = items.filter((entry) => entry.pinned).map((entry) => entry.key);
    const onIntent = (event) => {
      const {item, index} = event.detail ?? {};
      const keys = items.filter((entry) => !entry.pinned).map((entry) => entry.key);
      const from = keys.indexOf(String(item));
      if (from < 0) return;
      keys.splice(from, 1);
      keys.splice(Math.max(0, Math.min(index, keys.length)), 0, String(item));
      this.changeSettings({order: [...pinnedKeys, ...keys], hidden: [...hidden]}, 'order');
    };
    const toggle = (key, shown) => {
      const next = new Set(hidden);
      if (shown) next.delete(key); else next.add(key);
      this.changeSettings({order: items.map((entry) => entry.key), hidden: [...next]}, 'visibility');
    };
    render(html`
      <sf-sortable class="sf-tabs-settings-list" group="sf-tabs-settings" label=${this.text('customize')}
                   @sf-sortable-move=${onIntent}>
        ${items.map((item) => html`
          <div class=${item.pinned ? 'sf-tabs-settings-row sf-tabs-settings-row--pinned' : 'sf-tabs-settings-row'}
               data-sf-sortable-item=${item.pinned ? nothing : item.key}>
            ${item.pinned
              ? html`<span class="sf-tabs-settings-handle" aria-hidden="true"></span>`
              : html`<span class="sf-tabs-settings-handle" data-sf-sortable-handle aria-hidden="true"><i class="sf-icon">drag_indicator</i></span>`}
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
      tabsId: this.tabsId,
      pagePanel: (item, index) => this.pagePanelFor(item, index),
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

  // The action go-to {index} (§4.4): selects the tab and answers an outcome.
  // It reports nothing: `change` is what a person did (§8).
  goTo(index) {
    return this.selectTab(index?.index ?? index, { person: false });
  }

  selectTab(index, { person = false } = {}) {
    const items = this.computedItems;
    const requested = toNumber(index, Number.NaN);
    if (!Number.isInteger(requested) || requested < 0 || requested >= items.length) {
      return { outcome: 'refused', reason: 'out-of-range' };
    }
    const item = items[requested];

    if (item.disabled) return { outcome: 'refused', reason: 'disabled' };
    if (requested === this.activeIndex) return { outcome: 'refused', reason: 'current' };

    const previous = this.activeIndex;
    // The attribute the page uses keeps being the one written.
    if (this.hasAttribute('selected')) this.setAttribute('selected', item.key);
    else this.setAttribute('active-index', String(requested));
    if (person) {
      this.sfEmit('change', { selected: item.key, previous, current: requested, item, items });
    }
    return { outcome: 'applied' };
  }

  // The old name keeps its old detail (§16.20 split row): the element and its
  // template were in it.
  sfAliasAdapters() {
    return {
      'sf-tab-change': (detail) => ({
        component: this,
        tagName: this.componentTagName,
        template: this.componentTemplateName,
        ...detail,
      }),
    };
  }

  onTabChange(handler, options) {
    if (typeof handler === 'function') {
      this.addEventListener(
        this.sfEventName('change'),
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

  // The focus on a tab; with manual activation the tab stop follows it, so Tab
  // leaves from where the person is.
  focusTab(index) {
    const target = this.tabTargets[index];
    if (!target) return;
    if (this.manualActivation) for (const tab of this.tabTargets) if (tab) tab.tabIndex = tab === target ? 0 : -1;
    target.focus();
  }

  // «Ещё», when it stands: the arrows reach it after the last tab in the row
  // and leave it back to the tabs (docs trial 5: only Tab reached it).
  get moreTarget() {
    const more = this.querySelector('.sf-tabs-more');
    if (!more || more.closest('sf-tabs') !== this || more.hidden) return null;
    // sf-button's host is display: contents and has no box: the button is
    // what stands, or not.
    const button = more.querySelector('button');
    return button && button.getClientRects().length ? button : null;
  }

  handleRootKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const more = this.moreTarget;
    if (more && (event.target === more || more.contains(event.target)) && this.tabList.getAttribute('aria-orientation') !== 'vertical') {
      const rtl = getComputedStyle(this.tabList).direction === 'rtl';
      const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') || event.key === 'End';
      const forward = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') || event.key === 'Home';
      if (!back && !forward) return;
      const overflowed = new Set(this._overflowed ?? []);
      const shown = this.displayItems.filter((item) => !item.disabled && !overflowed.has(item.index));
      const target = back ? shown[shown.length - 1] : shown[0];
      if (!target) return;
      event.preventDefault();
      if (!this.manualActivation) this.selectTab(target.index, { person: true });
      this.syncTabSemantics();
      this.focusTab(target.index);
      return;
    }
    const tab = this.ownedTab(event);
    // A custom tab descriptor may contain its own input/widget. Its keys are
    // not navigation commands for this tab list.
    if (!tab || event.target !== tab) return;
    const vertical = this.tabList.getAttribute('aria-orientation') === 'vertical';
    const arrows = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!['Enter', ' ', 'Home', 'End', ...arrows].includes(event.key)) return;

    event.preventDefault();

    if (event.key === 'Enter' || event.key === ' ') {
      this.selectTab(tab.dataset.sfTabIndex, { person: true });
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
    // Past the last tab in the row, forward, is «Ещё» when it stands.
    if (more && arrows.includes(event.key) && direction === 1 && currentEnabledIndex === enabledItems.length - 1) {
      more.focus();
      return;
    }
    const nextEnabledIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? enabledItems.length - 1
        : (currentEnabledIndex + direction + enabledItems.length) % enabledItems.length;
    const nextIndex = enabledItems[nextEnabledIndex].index;
    // Over deferred panels the arrows only move the focus (§7.2.1).
    if (!this.manualActivation) this.selectTab(nextIndex, { person: true });
    this.syncTabSemantics();
    this.focusTab(nextIndex);
  };
}

SfTabs.define('sf-tabs');

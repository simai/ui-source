import registerComponent from '../../register-helper';
import { instancePath, partId } from '../../../core/js/instance-path.js';

const ROOT_SELECTOR = '.sf-tab';
const ACTIVE_CLASS = 'active';
const boundRoots = new WeakSet();

function owned(root, selector) {
  return Array.from(root.querySelectorAll(selector)).filter((item) => item.closest(ROOT_SELECTOR) === root);
}

function getParts(root) {
  return {
    list: owned(root, 'nav > ul')[0] || null,
    tabs: owned(root, 'nav > ul > li'),
    panels: owned(root, '.sf-tab-content > section'),
  };
}

// <path>--<part>-<n> (standard 1.3.8 §7.1.1, simai/ui-source#41), not a module
// counter that numbered the parts in creation order.
function ensureId(root, element, part, index) {
  if (!element.id) element.id = partId(instancePath(root, { kind: 'sf-tab' }), `${part}-${index}`);
  return element.id;
}

function isDisabled(tab) {
  return tab.classList.contains('disabled') || tab.getAttribute('aria-disabled') === 'true';
}

function normalizeIndex(index, total) {
  const value = Number.parseInt(index, 10);
  return Number.isFinite(value) && value >= 0 && value < total ? value : 0;
}

function initialIndex(root, tabs, panels, configuredStart) {
  const configured = root.getAttribute('data-active') ?? configuredStart;
  if (configured !== undefined && configured !== null) return normalizeIndex(configured, tabs.length);
  const marked = tabs.findIndex((tab, index) => tab.classList.contains(ACTIVE_CLASS)
    || panels[index]?.classList.contains(ACTIVE_CLASS));
  return normalizeIndex(marked, tabs.length);
}

function syncSemantics(root, start) {
  const {list, tabs, panels} = getParts(root);
  if (!list || !tabs.length) return {list, tabs, panels};
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-orientation', 'horizontal');
  const navigation = list.closest('nav');
  for (const name of ['aria-label', 'aria-labelledby']) {
    if (!list.hasAttribute(name) && navigation?.hasAttribute(name)) {
      list.setAttribute(name, navigation.getAttribute(name));
    }
  }
  const index = initialIndex(root, tabs, panels, start);
  tabs.forEach((tab, itemIndex) => {
    tab.setAttribute('role', 'tab');
    ensureId(root, tab, 'trigger', itemIndex);
    if (panels[itemIndex]) tab.setAttribute('aria-controls', ensureId(root, panels[itemIndex], 'panel', itemIndex));
  });
  activate(root, index, false);
  return {list, tabs, panels};
}

function activate(root, requestedIndex, emit = true) {
  const {tabs, panels} = getParts(root);
  if (!tabs.length) return;
  const index = normalizeIndex(requestedIndex, tabs.length);
  const selected = !isDisabled(tabs[index]) ? tabs[index] : tabs.find((tab) => !isDisabled(tab));
  const selectedIndex = selected ? tabs.indexOf(selected) : index;

  tabs.forEach((tab, itemIndex) => {
    const active = itemIndex === selectedIndex;
    tab.classList.toggle(ACTIVE_CLASS, active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = tab === selected && !isDisabled(tab) ? 0 : -1;
  });
  panels.forEach((panel, itemIndex) => {
    const active = itemIndex === selectedIndex;
    panel.classList.toggle(ACTIVE_CLASS, active);
    panel.toggleAttribute('hidden', !active);
    panel.setAttribute('role', 'tabpanel');
    if (tabs[itemIndex]) panel.setAttribute('aria-labelledby', tabs[itemIndex].id);
  });
  if (root.getAttribute('data-active') !== String(selectedIndex)) {
    root.setAttribute('data-active', String(selectedIndex));
  }
  if (emit) root.dispatchEvent(new CustomEvent('sf:tab-change', {
    bubbles: true,
    detail: {index: selectedIndex, tab: tabs[selectedIndex], panel: panels[selectedIndex] || null},
  }));
}

function move(root, current, key) {
  const {tabs} = getParts(root);
  const enabled = tabs.filter((tab) => !isDisabled(tab));
  if (!enabled.length) return null;
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];
  let direction = key === 'ArrowLeft' ? -1 : 1;
  if (getComputedStyle(current).direction === 'rtl') direction *= -1;
  return enabled[(enabled.indexOf(current) + direction + enabled.length) % enabled.length];
}

function bind(root, options = {}) {
  if (!(root instanceof HTMLElement)) return;
  syncSemantics(root, options.start);
  root.classList.add('initialized');
  if (boundRoots.has(root)) return;

  root.addEventListener('click', (event) => {
    const {tabs} = getParts(root);
    const tab = event.target.closest?.('nav > ul > li');
    const index = tabs.indexOf(tab);
    if (index < 0 || isDisabled(tab)) return;
    event.preventDefault();
    activate(root, index);
  });

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const {tabs} = getParts(root);
    const tab = event.target.closest?.('nav > ul > li');
    if (!tabs.includes(tab) || event.target !== tab || isDisabled(tab)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(root, tabs.indexOf(tab));
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const next = move(root, tab, event.key);
    if (!next) return;
    event.preventDefault();
    activate(root, tabs.indexOf(next));
    next.focus();
  });

  boundRoots.add(root);
}

function init(target = document) {
  if (target instanceof Element && target.matches(ROOT_SELECTOR)) bind(target);
  target.querySelectorAll?.(ROOT_SELECTOR).forEach((root) => bind(root));
}

function sfTab(element, options = {}) {
  this.el = element;
  this.options = {...this.options, ...options};
  bind(element, this.options);
}

sfTab.prototype.options = {start: 0};
sfTab.prototype._show = function show(index) { activate(this.el, index); };
sfTab.prototype.refresh = function refresh() { syncSemantics(this.el, this.options.start); };
sfTab.componentName = 'sfTab';

window.sfTab = sfTab;
window.SF = window.SF || {};
window.SF.Tab = window.SF.Tab || {init, activate};
registerComponent('sfTab', sfTab);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
else init();

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((records) => {
    const roots = new Set();
    records.forEach((record) => {
      const owner = record.target.closest?.(ROOT_SELECTOR);
      if (owner) roots.add(owner);
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(ROOT_SELECTOR)) roots.add(node);
        node.querySelectorAll(ROOT_SELECTOR).forEach((root) => roots.add(root));
      });
    });
    roots.forEach((root) => { if (root.isConnected) bind(root); });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-disabled', 'data-active'],
  });
}

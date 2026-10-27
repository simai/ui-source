import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { instancePath, partId } from '../../../core/js/instance-path.js';

const TABS_SELECTOR = '.sf-tabs';
const TABS_BOUND_FLAG = 'sfTabsBound';
const SELECTED_CLASS = 'selected';
const boundTabs = new WeakSet();
const generatedLabels = new WeakMap();

function isSmartTabsRoot(root) {
  return root?.parentElement?.localName === 'sf-tabs';
}

function ownedMatches(root, selector) {
  return Array.from(root.querySelectorAll(selector)).filter(item => item.closest('.sf-tabs') === root);
}

function getTabButtons(root) {
  return ownedMatches(root, '.sf-tabs-top .sf-button, .sf-tabs-top .sf-icon-button');
}

function isDisabled(button) {
  return button.disabled || button.classList.contains('disabled')
    || button.getAttribute('aria-disabled') === 'true';
}

// A part's id is the tab group's path id and a local name (standard 1.3.8
// §7.1.1, simai/ui-source#41): <path>--tab-<n>, --panel-<n>, --label-<n>, the
// same in every bundle and in server markup. A module counter numbered them
// in creation order; an id the counter gave that repeats is replaced.
function ensureId(root, element, part, index) {
  const duplicateGeneratedId = /^sf-tabs-(?:tab|panel|label)-\d+$|--(?:tab|panel|label)-\d+$/.test(element.id)
    && document.querySelectorAll(`#${CSS.escape(element.id)}`).length > 1;
  if (!element.id || duplicateGeneratedId) {
    element.id = partId(instancePath(root, { kind: 'sf-tabs' }), `${part}-${index}`);
  }
  return element.id;
}

function syncSemantics(root, buttons, panels) {
  const list = ownedMatches(root, '.sf-tabs-top')[0];
  if (!list) return;
  // Panels are siblings of the tablist, not its descendants in the ARIA tree.
  if (root.getAttribute('role') === 'tablist') root.removeAttribute('role');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-orientation', root.classList.contains('sf-tabs--vertical') ? 'vertical' : 'horizontal');
  for (const name of ['aria-label', 'aria-labelledby']) {
    if (!list.hasAttribute(name) && root.hasAttribute(name)) list.setAttribute(name, root.getAttribute(name));
  }
  setIndex(buttons);
  setIndex(panels);
  buttons.forEach((button, index) => {
    ensureId(root, button, 'tab', index);
    button.setAttribute('role', 'tab');
    if (panels[index]) button.setAttribute('aria-controls', ensureId(root, panels[index], 'panel', index));
    const label = button.querySelector('.sf-button-text-container');
    const previous = generatedLabels.get(button);
    if (label && !button.hasAttribute('aria-label')
      && (!button.hasAttribute('aria-labelledby') || button.getAttribute('aria-labelledby') === previous
        || /^sf-tabs-label-\d+$|--label-\d+$/.test(button.getAttribute('aria-labelledby')))) {
      const labelId = ensureId(root, label, 'label', index);
      button.setAttribute('aria-labelledby', labelId);
      generatedLabels.set(button, labelId);
    }
  });
  panels.forEach((panel, index) => {
    panel.setAttribute('role', 'tabpanel');
    if (buttons[index]) panel.setAttribute('aria-labelledby', buttons[index].id);
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
  });
}

function initTabs(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(TABS_SELECTOR)) {
    bindTabs(target);
  }

  target.querySelectorAll?.(TABS_SELECTOR).forEach(bindTabs);
}

function setIndex(items) {
  let i = 0;
  for (const item of items) {
    item.dataset.tab = i++;
  }
}

function normalizeIndex(index, total) {
  const value = Number.parseInt(index, 10);
  if (!Number.isFinite(value) || value < 0 || value >= total) {
    return 0;
  }

  return value;
}

function getInitialIndex(root, buttons) {
  const configuredIndex =
    root.getAttribute('data-active-index') ||
    root.getAttribute('data-active') ||
    root.getAttribute('active-index') ||
    root.getAttribute('active');

  if (configuredIndex !== null) {
    return normalizeIndex(configuredIndex, buttons.length);
  }

  const selectedIndex = Array.from(buttons).findIndex((button) =>
    button.classList.contains(SELECTED_CLASS),
  );

  return normalizeIndex(selectedIndex, buttons.length);
}

function activateTab(root, index) {
  // Smart Tabs owns its selected index, lifecycle and events. The ordinary
  // runtime must not silently write a second state into that rendered subtree.
  if (isSmartTabsRoot(root)) return;
  const buttons = getTabButtons(root);
  const mainTabs = ownedMatches(root, '.sf-tabs-main-container .sf-tabs-main-tab');
  const activeIndex = normalizeIndex(index, buttons.length);
  syncSemantics(root, buttons, mainTabs);
  const tabStop = buttons[activeIndex] && !isDisabled(buttons[activeIndex])
    ? buttons[activeIndex] : buttons.find(button => !isDisabled(button));

  if (root.dataset.activeIndex !== String(activeIndex)) root.dataset.activeIndex = String(activeIndex);

  buttons.forEach((button, itemIndex) => {
    const active = itemIndex === activeIndex;
    if (button.classList.contains(SELECTED_CLASS) !== active) button.classList.toggle(SELECTED_CLASS, active);
    button.setAttribute('aria-selected', String(active));
    button.setAttribute('tabindex', button === tabStop ? '0' : '-1');
  });

  mainTabs.forEach((tab, itemIndex) => {
    const active = itemIndex === activeIndex;
    if (tab.classList.contains(SELECTED_CLASS) !== active) tab.classList.toggle(SELECTED_CLASS, active);
    tab.toggleAttribute('hidden', !active);
  });
}

function bindTabs(root) {
  if (!(root instanceof HTMLElement) || isSmartTabsRoot(root)) {
    return;
  }
  const buttons = getTabButtons(root);
  activateTab(root, getInitialIndex(root, buttons));
  // Explicit init also refreshes changed markup. A copied data marker is not
  // evidence that this DOM node already owns event listeners.
  if (boundTabs.has(root)) return;

  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('.sf-button, .sf-icon-button');
    const currentButtons = getTabButtons(root), index = currentButtons.indexOf(button);
    if (index < 0 || isDisabled(button)) return;
    activateTab(root, index);
  });

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const currentButtons = getTabButtons(root), button = event.target;
    if (!currentButtons.includes(button) || isDisabled(button)) return;
    if (event.key === 'Enter' || event.key === ' ') {
      // Native buttons retain their normal click event. Non-button legacy
      // controls with a tab role need explicit keyboard activation.
      if (button.tagName !== 'BUTTON') {
        event.preventDefault(); activateTab(root, currentButtons.indexOf(button));
      }
      return;
    }
    const vertical = root.classList.contains('sf-tabs--vertical');
    const arrows = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!['Home', 'End', ...arrows].includes(event.key)) return;
    const enabled = currentButtons.filter(item => !isDisabled(item));
    if (!enabled.length) return;
    event.preventDefault();
    let direction = event.key === arrows[0] ? -1 : 1;
    if (!vertical && getComputedStyle(button.closest('.sf-tabs-top')).direction === 'rtl') direction *= -1;
    const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
      : enabled[(enabled.indexOf(button) + direction + enabled.length) % enabled.length];
    activateTab(root, currentButtons.indexOf(next));
    next.focus();
  });

  boundTabs.add(root);
  root.dataset[TABS_BOUND_FLAG] = '1';
}

class Tabs extends ComponentObserver {
  static componentName = 'Tabs';

  html = null;
}

registerComponent('Tabs', Tabs);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Tabs = window.SF.Tabs || {};
  window.SF.Tabs.activate = activateTab;
  window.SF.Tabs.init = initTabs;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTabs(document));
} else {
  initTabs(document);
}

// One document observer; roots/listeners are weakly tracked, so detached blocks
// are not kept alive. Output attributes are either not watched or idempotent.
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((records) => {
    const roots = new Set();
    records.forEach((record) => {
      const owner = record.target.closest?.(TABS_SELECTOR);
      if (owner) roots.add(owner);
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(TABS_SELECTOR)) roots.add(node);
        node.querySelectorAll(TABS_SELECTOR).forEach(root => roots.add(root));
      });
    });
    roots.forEach(root => {if (root.isConnected && !isSmartTabsRoot(root)) bindTabs(root);});
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'disabled', 'aria-disabled', 'data-active-index', 'data-active', 'active-index', 'active'],
  });
}

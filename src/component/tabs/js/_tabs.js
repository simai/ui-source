import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { instancePath, partId } from '../../../core/js/instance-path.js';
import { pageText } from '../../../core/js/page-language';
import { fitBesideMore, fitInOrder, rowRoom, triggerExtra } from '../../../core/js/overflow-row.js';
import { menuOpen } from '../../../core/js/menu-open.js';

const TABS_SELECTOR = '.sf-tabs';
const TABS_BOUND_FLAG = 'sfTabsBound';
const SELECTED_CLASS = 'selected';
const boundTabs = new WeakSet();
const generatedLabels = new WeakMap();
// The row laid out with «Ещё» (C54): data attributes, which the document
// observer below does not watch, so laying the row out is not a change to
// lay it out again.
const OUT = 'data-sf-tabs-out';
const SQUEEZED = 'data-sf-tabs-squeezed';
const ROW = 'data-sf-tabs-row';
const ROW_STATE = '__sfTabsRow';
// Every word this part says. A product adds a language with
// SF.language.register('sf-tabs', code, words).
const WORDS = {
  en: { more: 'More' },
  ru: { more: 'Ещё' },
  kk: { more: 'Тағы' },
};

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

// Only the selected tab's label is medium (owner decision C96 item 3), and a
// label keeps the width of its medium face so that selecting a tab moves no
// neighbour: the sheet draws a hidden medium copy of data-sf-tabs-text in the
// label (RG-NV 31c; <sf-tabs> writes .sf-tabs-name for the same). Only a label
// of plain words is copied; one with parts of its own keeps the weights.
function syncLabelText(label) {
  if (!label) return;
  const plain = Array.from(label.childNodes).every((node) => node.nodeType === Node.TEXT_NODE);
  const text = plain ? label.textContent.trim() : '';
  if (text) {
    if (label.getAttribute('data-sf-tabs-text') !== text) label.setAttribute('data-sf-tabs-text', text);
  } else if (label.hasAttribute('data-sf-tabs-text')) {
    label.removeAttribute('data-sf-tabs-text');
  }
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
  // No unprefixed data-tab is written on the buttons and panels (R193 DP-11):
  // a page's own [data-tab] selector caught them, and nothing read it.
  buttons.forEach((button, index) => {
    ensureId(root, button, 'tab', index);
    button.setAttribute('role', 'tab');
    if (panels[index]) button.setAttribute('aria-controls', ensureId(root, panels[index], 'panel', index));
    const label = button.querySelector('.sf-button-text-container');
    syncLabelText(label);
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

// ─── «Ещё» (owner decision C54; RG-NV 31e, C224) ─────────────────────────────
// A horizontal row of class markup that does not fit keeps its tabs in their
// order up to the first that does not fit, each whole in the row or in
// «Ещё (n)» after it; the selected tab always stays; nothing scrolls. The
// arithmetic is the shared row engine <sf-tabs> uses (core/js/overflow-row.js).
// A row the page wraps (flex-wrap, sf-tabs--overflow-wrap) and the vertical
// look are left as they are.
function rowWanted(root, list) {
  if (!list || typeof ResizeObserver === 'undefined') return false;
  if (root.classList.contains('sf-tabs--vertical') || root.classList.contains('sf-tabs--overflow-wrap')) return false;
  return getComputedStyle(list).flexWrap !== 'wrap';
}

function tabSize(buttons) {
  const sized = buttons.find((button) => /\bsf-(?:icon-)?button--size-/.test(button.className));
  const match = sized?.className.match(/\bsf-(?:icon-)?button--size-(\S+)/);
  return match ? match[1] : '1';
}

function setAttr(element, name, value) {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function moreTrigger(root, container, buttons) {
  let more = container.querySelector(':scope > .sf-tabs-more');
  if (!more) {
    more = document.createElement('sf-button');
    more.className = 'sf-tabs-more';
    more.setAttribute('appearance', 'ghost');
    more.setAttribute('scheme', 'on-surface');
    more.setAttribute('icon-end', 'expand_more');
    more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', (event) => openMore(root, event));
    container.append(more);
  }
  setAttr(more, 'size', tabSize(buttons));
  if (!container.classList.contains('sf-tabs-top-container--tools')) container.classList.add('sf-tabs-top-container--tools');
  return more;
}

function clearRow(root) {
  const state = root[ROW_STATE];
  state?.observer.disconnect();
  root[ROW_STATE] = null;
  const container = ownedMatches(root, '.sf-tabs-top-container')[0];
  if (!container) return;
  for (const button of getTabButtons(root)) {
    setAttr(button, OUT, null);
    setAttr(button, SQUEEZED, null);
  }
  container.querySelector(':scope > .sf-tabs-more')?.remove();
  setAttr(container, ROW, null);
  setAttr(container, 'data-sf-tabs-more', null);
  if (state?.toolsAdded && container.classList.contains('sf-tabs-top-container--tools')) {
    container.classList.remove('sf-tabs-top-container--tools');
  }
}

function layoutRow(root) {
  const state = root[ROW_STATE];
  if (!state || state.busy || !root.isConnected) return;
  const container = ownedMatches(root, '.sf-tabs-top-container')[0];
  const list = ownedMatches(root, '.sf-tabs-top')[0];
  if (!container || !list) return;
  state.busy = true;
  try {
    const buttons = getTabButtons(root);
    setAttr(container, ROW, '');
    // Every tab at its own width, all shown, in one task (never painted).
    for (const button of buttons) {
      setAttr(button, OUT, null);
      setAttr(button, SQUEEZED, null);
    }
    setAttr(container, 'data-sf-tabs-more', null);
    const widths = buttons.map((button) => button.getBoundingClientRect().width);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    state.out = [];
    if (!buttons.length || !fitInOrder(widths, gap, rowRoom(list))) return;
    const more = moreTrigger(root, container, buttons);
    setAttr(container, 'data-sf-tabs-more', '');
    const current = buttons.findIndex((button) => button.classList.contains(SELECTED_CLASS));
    const word = pageText(WORDS, 'more', root, 'sf-tabs');
    const label = (count) => `${word} (${count})`;
    const textBox = more.querySelector(':scope > button .sf-button-text-container');
    const laid = fitBesideMore({
      widths, gap, room: rowRoom(list), must: current >= 0 ? [current] : [], current,
      extra: triggerExtra(textBox, label),
    });
    buttons.forEach((button, at) => {
      if (!laid.kept.includes(at)) {
        setAttr(button, OUT, '');
        state.out.push(button);
      }
    });
    if (laid.squeezed >= 0) setAttr(buttons[laid.squeezed], SQUEEZED, '');
    const text = label(state.out.length);
    setAttr(more, 'text', text);
    setAttr(more, 'aria-label', text);
  } finally {
    state.busy = false;
  }
}

async function openMore(root, event) {
  const left = root[ROW_STATE]?.out ?? [];
  const buttons = getTabButtons(root);
  const entries = left.map((button) => ({
    id: String(buttons.indexOf(button)),
    text: (button.getAttribute('aria-label') || button.textContent || '').trim(),
    icon: button.querySelector('.sf-icon')?.textContent.trim() || undefined,
    disabled: isDisabled(button) || undefined,
  })).filter((entry) => entry.text && entry.id !== '-1');
  if (!entries.length) return;
  const size = tabSize(buttons) === '1/2' ? '1/2' : '1';
  const anchor = event.currentTarget?.querySelector?.(':scope > button') || event.currentTarget;
  const choice = await menuOpen({ anchor, entries, label: pageText(WORDS, 'more', root, 'sf-tabs'), size });
  if (choice?.id == null || !root.isConnected) return;
  const index = Number(choice.id);
  const chosen = getTabButtons(root)[index];
  if (!chosen || isDisabled(chosen)) return;
  activateTab(root, index);
  layoutRow(root);
  chosen.focus();
}

function bindRow(root) {
  const list = ownedMatches(root, '.sf-tabs-top')[0];
  const container = list?.parentElement;
  if (isSmartTabsRoot(root) || !container?.matches('.sf-tabs-top-container')
    || (!root[ROW_STATE] && container.querySelector(':scope > .sf-tabs-more') && !container.hasAttribute(ROW))) return;
  if (!rowWanted(root, list)) {
    if (root[ROW_STATE]) clearRow(root);
    return;
  }
  if (!root[ROW_STATE]) {
    // The row's room and each tab's width change when the place resizes and
    // when a sheet or a face arrives; the callback runs before paint.
    const observer = new ResizeObserver(() => layoutRow(root));
    root[ROW_STATE] = {
      observer, out: [], busy: false, watched: [],
      toolsAdded: !container.classList.contains('sf-tabs-top-container--tools'),
    };
  }
  const state = root[ROW_STATE];
  const boxes = [container, ...getTabButtons(root)];
  if (boxes.length !== state.watched.length || boxes.some((box, at) => box !== state.watched[at])) {
    state.observer.disconnect();
    for (const box of boxes) state.observer.observe(box);
    state.watched = boxes;
  }
  layoutRow(root);
}

function initTabs(target) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(TABS_SELECTOR)) {
    bindTabs(target);
  }

  target.querySelectorAll?.(TABS_SELECTOR).forEach(bindTabs);
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
  bindRow(root);
  // Explicit init also refreshes changed markup. A copied data marker is not
  // evidence that this DOM node already owns event listeners.
  if (boundTabs.has(root)) return;

  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('.sf-button, .sf-icon-button');
    const currentButtons = getTabButtons(root), index = currentButtons.indexOf(button);
    if (index < 0 || isDisabled(button)) return;
    activateTab(root, index);
    layoutRow(root);
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
    // The tabs «Ещё» holds are not in the row: the arrows go round the row.
    const enabled = currentButtons.filter(item => !isDisabled(item) && !item.hasAttribute(OUT));
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

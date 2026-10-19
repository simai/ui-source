import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

const ROOT_SELECTOR = '.sf-button-group';
const SEGMENTS = ['start', 'middle', 'end'];
const OBSERVER_KEY = '__sfButtonGroupObserver';
const ORIENTED_ROLES = new Set([
  'listbox',
  'menu',
  'radiogroup',
  'tablist',
  'toolbar',
  'tree',
]);

function getItems(root) {
  return Array.from(root.children).filter((item) =>
    item.matches?.('sf-button, .sf-button'),
  );
}

function setSegment(item, segment) {
  if (item.matches('sf-button')) {
    if (segment) {
      item.setAttribute('segment', segment);
    } else {
      item.removeAttribute('segment');
    }
    return;
  }

  SEGMENTS.forEach((name) => item.classList.remove(`segment-${name}`));
  if (segment) {
    item.classList.add(`segment-${segment}`);
  }
}

export function syncButtonGroup(root) {
  if (!(root instanceof HTMLElement) || !root.matches(ROOT_SELECTOR)) {
    return root;
  }

  const items = getItems(root);
  const role = root.getAttribute('role') || 'group';
  if (root.getAttribute('role') !== role) {
    root.setAttribute('role', role);
  }
  const orientation = (
    root.getAttribute('data-orientation') === 'vertical' ||
    root.getAttribute('aria-orientation') === 'vertical'
  )
    ? 'vertical'
    : 'horizontal';
  if (root.getAttribute('data-orientation') !== orientation) {
    root.setAttribute('data-orientation', orientation);
  }

  if (ORIENTED_ROLES.has(role)) {
    if (root.getAttribute('aria-orientation') !== orientation) {
      root.setAttribute('aria-orientation', orientation);
    }
  } else if (root.hasAttribute('aria-orientation')) {
    root.removeAttribute('aria-orientation');
  }

  // Segmented segments are separate plates on a track, not joined buttons:
  // they take no join position, so no join border reaches them.
  const segmented = root.classList.contains('sf-button-group--segmented');
  items.forEach((item, index) => {
    const segment =
      segmented || items.length === 1
        ? ''
        : index === 0
          ? 'start'
          : index === items.length - 1
            ? 'end'
            : 'middle';
    setSegment(item, segment);
  });

  return root;
}

function bindButtonGroup(root) {
  if (!(root instanceof HTMLElement) || root[OBSERVER_KEY]) {
    return syncButtonGroup(root);
  }

  syncButtonGroup(root);
  root[OBSERVER_KEY] = new MutationObserver(() => syncButtonGroup(root));
  root[OBSERVER_KEY].observe(root, {
    childList: true,
    attributes: true,
    attributeFilter: ['role', 'data-orientation', 'aria-orientation', 'class'],
  });

  return root;
}

export function initButtonGroups(target = document) {
  if (target instanceof Element && target.matches?.(ROOT_SELECTOR)) {
    bindButtonGroup(target);
  }

  target.querySelectorAll?.(ROOT_SELECTOR).forEach(bindButtonGroup);
}

class ButtonGroup extends ComponentObserver {
  static componentName = 'ButtonGroup';

  html = null;
}

registerComponent('ButtonGroup', ButtonGroup);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.ButtonGroup = window.SF.ButtonGroup || {};
  window.SF.ButtonGroup.init = initButtonGroups;
  window.SF.ButtonGroup.sync = syncButtonGroup;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initButtonGroups(document));
  } else {
    initButtonGroups(document);
  }
}

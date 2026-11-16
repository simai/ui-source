import {noteDeprecated} from '../../../core/js/deprecations.js';

// What the floating button's sheet draws only on its own terms, said once per
// button in the console (component.fab 1.2.0):
//
// - the class active or aria-pressed: a floating button is filled or tonal,
//   and those have no pressed state (owner decision C211 (1), RG-FAB-1); the
//   sheet draws nothing for them. A toggle is an outline or ghost sf-button or
//   sf-icon-button in on-surface.
// - sf-fab--default sf-fab--secondary: the set's former secondary is the grey
//   (C116 (3), RG-FAB-4); drawn as sf-fab--default sf-fab--on-surface until
//   2027-01-01 and noted in SF.deprecations (journal
//   class-fab-default-secondary-c116). It drew a transparent, invisible button.

const DEPRECATED = Object.freeze({since: '2026-11-16', remove_after: '2027-01-01'});

function said() {
  const root = globalThis.SF = globalThis.SF || {};
  if (!(root.__fabChecks instanceof WeakMap)) {
    Object.defineProperty(root, '__fabChecks', {value: new WeakMap(), configurable: true});
  }
  return root.__fabChecks;
}

function sayOnce(element, topic, message) {
  const map = said();
  let topics = map.get(element);
  if (!topics) {
    topics = new Set();
    map.set(element, topics);
  }
  if (topics.has(topic)) return;
  topics.add(topic);
  globalThis.console?.warn?.(message, element);
}

function nameOf(element) {
  const label = element.getAttribute('aria-label') || '';
  const classes = [...element.classList].filter((name) => /^sf-fab--/u.test(name)).join(' ');
  return `<${element.localName}${element.id ? `#${element.id}` : ''} class="${classes}">${label ? ` «${label.slice(0, 40)}»` : ''}`;
}

export function checkFab(element) {
  if (!element?.classList?.contains('sf-fab')) return;
  const pressed = element.classList.contains('active') || element.hasAttribute('aria-pressed');
  if (pressed) {
    sayOnce(element, 'pressed', `[SIMAI Framework] sf-fab: ${nameOf(element)} says active or aria-pressed, but a floating button is filled or tonal and has no pressed state (owner decision C211); nothing is drawn for it. A toggle is an outline or ghost button in on-surface.`);
  }
  if (element.classList.contains('sf-fab--default') && element.classList.contains('sf-fab--secondary')) {
    noteDeprecated({component: 'fab', kind: 'class', from: 'sf-fab--default sf-fab--secondary', to: 'sf-fab--default sf-fab--on-surface', ...DEPRECATED});
    sayOnce(element, 'secondary', `[SIMAI Framework] sf-fab: ${nameOf(element)} writes sf-fab--default sf-fab--secondary, the set's former secondary, drawn as sf-fab--default sf-fab--on-surface until ${DEPRECATED.remove_after} (owner decision C116 (3)); write sf-fab--on-surface.`);
  }
}

let pending = null;
const queue = new Set();

function flush() {
  pending = null;
  const elements = [...queue];
  queue.clear();
  for (const element of elements) if (element.isConnected) checkFab(element);
}

function enqueue(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('.sf-fab')) queue.add(node);
  node.querySelectorAll?.('.sf-fab').forEach((element) => queue.add(element));
  if (!pending) pending = setTimeout(flush, 0);
}

export function watchFabs() {
  if (typeof document === 'undefined') return;
  const root = globalThis.SF = globalThis.SF || {};
  if (root.__fabChecksWatching) return;
  Object.defineProperty(root, '__fabChecksWatching', {value: true, configurable: true});
  const start = () => {
    enqueue(document.documentElement);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          if (mutation.target.matches?.('.sf-fab')) {
            queue.add(mutation.target);
            if (!pending) pending = setTimeout(flush, 0);
          }
        } else mutation.addedNodes.forEach(enqueue);
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed'],
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}

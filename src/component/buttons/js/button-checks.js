import {noteDeprecated} from '../../../core/js/deprecations.js';

// What the button sheets draw only on their own terms, said once in the
// console so a page author sees why a look is missing (owner decisions C116,
// C211, 2026-11-16). Shared by the buttons and icon-buttons runtimes: each
// bundle carries its own copy of this module, so what was said lives on one
// shared global and a button is named once whichever copy sees it first.
//
// - aria-pressed (or the --pressed class) on a button that is no toggle: the
//   pressed look is drawn only on outline or ghost in the neutral scheme
//   (C211 (1)); the button keeps its own look.
// - an sf-button with an icon and no label: square, as an icon button, and it
//   needs aria-label (C211 (2)).
// - the set's former classes sf-button--secondary and sf-button--surface
//   (C116 (3), (6)): drawn as on-surface and as tonal on-surface until
//   2027-01-01, noted in SF.deprecations (journal class-button-set-c116).

const DEPRECATED = Object.freeze({since: '2026-11-16', remove_after: '2027-01-01'});
export const BUTTON_CLASS_ALIASES = Object.freeze({
  'sf-button--secondary': 'sf-button--on-surface',
  'sf-button--surface': 'sf-button--tonal sf-button--on-surface',
});

export const BUTTON_TOGGLE = ':is(.sf-button--outline, .sf-button--ghost, .sf-button--link):is(.sf-button--on-surface, .sf-button--secondary)';
export const ICON_BUTTON_TOGGLE = ':is(.sf-icon-button--outline, .sf-icon-button--ghost, .sf-icon-button--link):is(.sf-icon-button--on-surface, .sf-icon-button--on-surface-variant, .sf-icon-button--secondary)';
export const BUTTON_ICON_ONLY = ':has(> :is(.sf-icon, sf-icon, .sf-button-spinner)):not(:has(> .sf-button-text-container:not(:empty)))';

const KINDS = {
  'sf-button': {pressedClass: 'sf-button--pressed', toggle: BUTTON_TOGGLE, iconOnly: BUTTON_ICON_ONLY},
  'sf-icon-button': {pressedClass: 'sf-icon-button--pressed', toggle: ICON_BUTTON_TOGGLE, iconOnly: null},
};

function said() {
  const root = globalThis.SF = globalThis.SF || {};
  if (!(root.__buttonChecks instanceof WeakMap)) {
    Object.defineProperty(root, '__buttonChecks', {value: new WeakMap(), configurable: true});
  }
  return root.__buttonChecks;
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
  const label = element.getAttribute('aria-label')
    || element.querySelector('.sf-button-text-container')?.textContent?.trim()
    || element.textContent?.trim()
    || '';
  const classes = [...element.classList].filter((name) => /^sf-(icon-)?button--/u.test(name)).join(' ');
  return `<${element.localName}${element.id ? `#${element.id}` : ''} class="${classes}">${label ? ` «${label.slice(0, 40)}»` : ''}`;
}

function hasName(element) {
  return Boolean(element.getAttribute('aria-label')?.trim()
    || element.getAttribute('aria-labelledby')?.trim()
    || element.getAttribute('title')?.trim());
}

function matches(element, selector) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function checkButton(element, block) {
  const kind = KINDS[block];
  if (!kind || !element?.classList?.contains(block)) return;
  const pressedSaid = element.hasAttribute('aria-pressed') || element.classList.contains(kind.pressedClass);
  if (pressedSaid && !matches(element, kind.toggle)) {
    sayOnce(element, 'pressed', `[SIMAI Framework] ${block}: ${nameOf(element)} says aria-pressed, but the pressed look is drawn only on a toggle -- outline or ghost in on-surface (owner decision C211); this button keeps its own look. A choice of one among several (a view, a width, a theme) is sf-segmented.`);
  }
  if (kind.iconOnly && matches(element, kind.iconOnly) && !hasName(element)) {
    sayOnce(element, 'name', `[SIMAI Framework] ${block}: ${nameOf(element)} has an icon and no label; it is drawn square and needs aria-label (owner decision C211).`);
  }
  if (block === 'sf-button') {
    for (const [from, to] of Object.entries(BUTTON_CLASS_ALIASES)) {
      if (element.classList.contains(from)) noteDeprecated({component: 'buttons', kind: 'class', from, to, ...DEPRECATED});
    }
  }
}

let pending = null;
const queue = new Set();

function flush() {
  pending = null;
  const elements = [...queue];
  queue.clear();
  for (const element of elements) {
    if (!element.isConnected) continue;
    checkButton(element, 'sf-button');
    checkButton(element, 'sf-icon-button');
  }
}

function enqueue(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('.sf-button, .sf-icon-button')) queue.add(node);
  node.querySelectorAll?.('.sf-button, .sf-icon-button').forEach((element) => queue.add(element));
  // After the current task: a Smart host writes the name and the state on the
  // button it draws in the same turn.
  if (!pending) pending = setTimeout(flush, 0);
}

export function watchButtons() {
  if (typeof document === 'undefined') return;
  const root = globalThis.SF = globalThis.SF || {};
  if (root.__buttonChecksWatching) return;
  Object.defineProperty(root, '__buttonChecksWatching', {value: true, configurable: true});
  const start = () => {
    enqueue(document.documentElement);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          if (mutation.target.matches?.('.sf-button, .sf-icon-button')) {
            queue.add(mutation.target);
            if (!pending) pending = setTimeout(flush, 0);
          }
        } else mutation.addedNodes.forEach(enqueue);
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'aria-label', 'aria-labelledby', 'title'],
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}

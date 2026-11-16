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
// - the icon button's former looks sf-icon-button--surface and
//   sf-icon-button--link (component.icon-buttons 1.14.0, RG-IB-2): drawn
//   exactly as tonal and ghost until 2027-01-01, said once per button in the
//   console and noted in SF.deprecations (journals
//   class-icon-button-retired-looks-c15, class-icon-button-link-to-ghost).
// - density on an icon button (owner decision C213): spacing-compact,
//   -comfortable, -spacious and the older tightness-low, -high, -highest draw
//   nothing on sf-icon-button; said once per button, noted until 2027-01-01
//   (journal class-icon-button-density-c213).
// - a close in a look of the icon button (component.icon-buttons 1.15.0,
//   RG-CL-3; owner decision C14: no squares, no solid plate under a cross):
//   sf-icon-button--close with --default, --tonal, --outline or --surface is
//   drawn as ghost until 2027-01-01, said once per button and noted in
//   SF.deprecations (journal class-icon-button-close-looks-c14). A close of
//   its own is sf-button-close.

const DEPRECATED = Object.freeze({since: '2026-11-16', remove_after: '2027-01-01'});
export const BUTTON_CLASS_ALIASES = Object.freeze({
  'sf-button--secondary': 'sf-button--on-surface',
  'sf-button--surface': 'sf-button--tonal sf-button--on-surface',
});

const ICON_DEPRECATED = Object.freeze({since: '2026-11-16', remove_after: '2027-01-01'});
export const ICON_BUTTON_CLASS_ALIASES = Object.freeze({
  'sf-icon-button--surface': 'sf-icon-button--tonal',
  'sf-icon-button--link': 'sf-icon-button--ghost',
});

export const ICON_BUTTON_CLOSE_LOOKS = Object.freeze([
  'sf-icon-button--default', 'sf-icon-button--tonal', 'sf-icon-button--outline', 'sf-icon-button--surface',
]);

export const ICON_BUTTON_DENSITY_CLASSES = Object.freeze([
  'spacing-compact', 'spacing-comfortable', 'spacing-spacious',
  'tightness-low', 'tightness-high', 'tightness-highest',
]);

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
  if (block === 'sf-icon-button') {
    for (const [from, to] of Object.entries(ICON_BUTTON_CLASS_ALIASES)) {
      if (!element.classList.contains(from)) continue;
      noteDeprecated({component: 'icon-buttons', kind: 'class', from, to, ...ICON_DEPRECATED});
      sayOnce(element, from, `[SIMAI Framework] ${block}: ${nameOf(element)} writes ${from}, a former look drawn exactly as ${to} until ${ICON_DEPRECATED.remove_after}; write ${to} (component.icon-buttons 1.14.0).`);
    }
    if (element.classList.contains('sf-icon-button--close') && !element.classList.contains('sf-button-close')) {
      const looks = ICON_BUTTON_CLOSE_LOOKS.filter((name) => element.classList.contains(name));
      for (const from of looks) {
        noteDeprecated({component: 'icon-buttons', kind: 'class', from: `sf-icon-button--close ${from}`, to: 'sf-icon-button--close sf-icon-button--ghost', ...ICON_DEPRECATED});
      }
      if (looks.length) {
        sayOnce(element, 'close-look', `[SIMAI Framework] ${block}: ${nameOf(element)} draws a close in ${looks.join(' ')}: a cross has no square and no solid plate (owner decision C14), so it is drawn as ghost until ${ICON_DEPRECATED.remove_after}; write sf-button-close (sf-button-close--ghost, --plain or --media) or sf-icon-button--ghost (component.icon-buttons 1.15.0).`);
      }
    }
    const density = ICON_BUTTON_DENSITY_CLASSES.filter((name) => element.classList.contains(name));
    for (const from of density) {
      noteDeprecated({component: 'icon-buttons', kind: 'class', from, to: null, ...ICON_DEPRECATED});
    }
    if (density.length) {
      sayOnce(element, 'density', `[SIMAI Framework] ${block}: ${nameOf(element)} writes ${density.join(' ')}: an icon button has no density (owner decision C213) and these classes draw nothing; size and height (sf-icon-button--height-low|high|highest) change it and keep it square. Remove them before ${ICON_DEPRECATED.remove_after}.`);
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

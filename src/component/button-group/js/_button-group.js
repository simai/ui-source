import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
import {
  actionEntry,
  controlOf,
  isMainAction,
  isPressed,
  layoutActionRow,
  openRowMenu,
  readPriority,
  rowRoom,
} from '../../../core/js/overflow-row.js';

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

const OUT = 'sf-button-group-out';
const MORE = 'sf-button-group-more';
const OVERFLOW_KEY = '__sfButtonGroupOverflow';

// Every word this part says (owner decision C155: «Ещё» names ⋯). A product
// adds a language with SF.language.register('sf-button-group', code, words).
const WORDS = {
  en: { more: 'More' },
  ru: { more: 'Ещё' },
};

// The buttons of the group that stand in it now: not out of the row, ⋯ when
// it shows (C155).
function getItems(root) {
  return Array.from(root.children).filter((item) =>
    item.matches?.('sf-button, .sf-button') && !item.classList.contains(OUT),
  );
}

// The group's own buttons, ⋯ aside.
function ownItems(root) {
  return Array.from(root.children).filter((item) =>
    item.matches?.('sf-button, .sf-button') && !item.classList.contains(MORE),
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

// overflow="more" (owner decision C155 (1), (3), (8)): a horizontal group
// keeps one row, and the buttons that do not fit leave for ⋯ «Ещё», the
// group's last segment, of its buttons' size and look -- from the end, by a
// button's priority attribute where the page gives one (1 the most important,
// pin never leaves), the main (filled) and a pressed button never. ⋯ opens
// the standard menu with them; a row presses the button. The arithmetic is
// the shared row engine (core/js/overflow-row.js). Without the attribute the
// group scrolls sideways as before.
function moreButton(root) {
  let more = root.querySelector(`:scope > .${MORE}`);
  const first = ownItems(root)[0];
  if (!more) {
    more = document.createElement('sf-button');
    more.className = `${MORE} ${OUT}`;
    more.setAttribute('icon', 'more_horiz');
    more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', (event) => openMore(root, event));
    root.append(more);
  } else if (more.nextElementSibling) {
    root.append(more);
  }
  // ⋯ is a segment of the row: its buttons' size, look and colour.
  for (const name of ['size', 'appearance', 'scheme']) {
    const value = first?.getAttribute(name);
    if (value === null || value === undefined) more.removeAttribute(name);
    else if (more.getAttribute(name) !== value) more.setAttribute(name, value);
  }
  const word = pageText(WORDS, 'more', root, 'sf-button-group');
  if (more.getAttribute('aria-label') !== word) more.setAttribute('aria-label', word);
  if (more.getAttribute('title') !== word) more.setAttribute('title', word);
  return more;
}

function layoutOverflow(root) {
  const state = root[OVERFLOW_KEY];
  if (!state || state.busy) return;
  state.busy = true;
  try {
    const more = moreButton(root);
    const units = ownItems(root).map((element) => {
      const { rank, pin } = readPriority(element.getAttribute('priority'));
      return { element, rank, pin: pin || isMainAction(element) || isPressed(element), group: 0 };
    });
    const parent = root.parentElement;
    const { out } = layoutActionRow({
      row: root,
      units,
      more,
      outClass: OUT,
      room: parent ? rowRoom(parent) : null,
    });
    state.out = out.map((at) => units[at].element);
    root.setAttribute('data-sf-row-laid', '');
    syncButtonGroup(root);
  } finally {
    state.busy = false;
  }
}

function openMore(root, event) {
  const state = root[OVERFLOW_KEY];
  const left = state?.out ?? [];
  const entries = left.map((element, at) => actionEntry(element, at)).filter((entry) => entry.text);
  const first = ownItems(root)[0];
  openRowMenu(root, {
    anchor: controlOf(event.currentTarget),
    entries,
    label: pageText(WORDS, 'more', root, 'sf-button-group'),
    size: (first?.getAttribute('size') || '1') === '1/2' ? '1/2' : '1',
    select: (id) => controlOf(left[Number(id)])?.click(),
  });
}

function bindOverflow(root) {
  const wanted = root.getAttribute('overflow') === 'more'
    && root.getAttribute('data-orientation') !== 'vertical'
    && typeof ResizeObserver !== 'undefined';
  const state = root[OVERFLOW_KEY];
  if (!wanted) {
    if (state) {
      state.observer.disconnect();
      root[OVERFLOW_KEY] = null;
      root.querySelector(`:scope > .${MORE}`)?.remove();
      for (const item of ownItems(root)) item.classList.remove(OUT);
      root.removeAttribute('data-sf-row-laid');
    }
    return;
  }
  if (!state) {
    // The parent's box is the room; each button's box widens when its sheet
    // or face arrives later. The callback runs before paint.
    const observer = new ResizeObserver(() => layoutOverflow(root));
    root[OVERFLOW_KEY] = { observer, out: [], busy: false, watched: [] };
  }
  const current = root[OVERFLOW_KEY];
  const boxes = [root.parentElement, ...ownItems(root)].filter(Boolean);
  if (boxes.length !== current.watched.length || boxes.some((box, at) => box !== current.watched[at])) {
    current.observer.disconnect();
    for (const box of boxes) current.observer.observe(box);
    current.watched = boxes;
  }
  layoutOverflow(root);
}

function bindButtonGroup(root) {
  if (!(root instanceof HTMLElement) || root[OBSERVER_KEY]) {
    if (root instanceof HTMLElement && !root[OVERFLOW_KEY]?.busy) bindOverflow(root);
    return syncButtonGroup(root);
  }

  syncButtonGroup(root);
  root[OBSERVER_KEY] = new MutationObserver(() => {
    if (root[OVERFLOW_KEY]?.busy) return;
    syncButtonGroup(root);
    bindOverflow(root);
  });
  root[OBSERVER_KEY].observe(root, {
    childList: true,
    attributes: true,
    attributeFilter: ['role', 'data-orientation', 'aria-orientation', 'class', 'overflow'],
  });
  bindOverflow(root);

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

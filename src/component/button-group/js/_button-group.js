import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';
import { pageText } from '../../../core/js/page-language';
import { tagSelector } from '../../../core/js/tag-aliases.js';
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

// The members of a joined group: buttons and icon buttons, as classes or as
// Smart hosts (RG-BG-1, DEV 2026-11-16: icon buttons stood apart, each with its
// own corners). A host carries its position as the segment attribute.
const HOSTS = 'sf-button, sf-button-icon, sf-icon-button';
const ITEMS = `${HOSTS}, .sf-button, .sf-icon-button`;

const OUT = 'sf-button-group-out';
const MORE = 'sf-button-group-more';
const OVERFLOW_KEY = '__sfButtonGroupOverflow';
const STACKED = 'data-sf-stacked';
const STACK_KEY = '__sfButtonGroupStack';
const AUTHOR_ORIENTATION_KEY = '__sfButtonGroupAuthorOrientation';

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
    item.matches?.(ITEMS) && !item.classList.contains(OUT),
  );
}

// The group's own buttons, ⋯ aside.
function ownItems(root) {
  return Array.from(root.children).filter((item) =>
    item.matches?.(ITEMS) && !item.classList.contains(MORE),
  );
}

function setSegment(item, segment) {
  if (item.matches(HOSTS)) {
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

// A group wider than its container stacks (owner decision C215): it draws as
// the vertical group -- one frame, one line at each join, the radius outside
// only -- at the container's full width, and stands in a row again once the
// row fits. It never scrolls sideways. data-sf-stacked carries the state, so
// an author's data-orientation is never rewritten, and a group whose author
// set an orientation keeps it. The segmented track and sf-segmented keep their
// own answer (a scroll, a fold), and overflow="more" keeps its row.
//
// A container query cannot ask whether the content fits, so the group
// measures: the row's extent against its own box, both read with the row laid
// out. It decides synchronously when it binds and in a ResizeObserver
// callback, both before paint, so a stacked group's first frame is a column.
function stackWanted(root) {
  return !root[AUTHOR_ORIENTATION_KEY]
    && root.getAttribute('data-orientation') !== 'vertical'
    && !root.classList.contains('sf-button-group--segmented')
    && root.getAttribute('overflow') !== 'more'
    && !root.parentElement?.matches(tagSelector('sf-segmented'))
    && typeof ResizeObserver !== 'undefined';
}

// The drawn boxes of the row: a Smart host draws none (display: contents),
// its control does.
function drawnBoxes(element, boxes = []) {
  for (const child of element.children) {
    if (getComputedStyle(child).display === 'contents') {
      drawnBoxes(child, boxes);
      continue;
    }
    const box = child.getBoundingClientRect();
    if (box.width || box.height) boxes.push(box);
  }
  return boxes;
}

function rowOverflows(root) {
  if (!root.getClientRects().length) return false;
  const boxes = drawnBoxes(root);
  if (boxes.length < 2) return false;
  const extent = Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
  // Half a pixel of rounding, as the row engine allows.
  return extent > rowRoom(root) + 0.5;
}

function layoutStack(root) {
  const state = root[STACK_KEY];
  if (!state || state.busy) return;
  state.busy = true;
  try {
    const was = root.hasAttribute(STACKED);
    // Read the row as a row; the attribute comes back in the same task, so no
    // frame ever shows the probe.
    if (was) root.removeAttribute(STACKED);
    const stacked = rowOverflows(root);
    if (stacked) root.setAttribute(STACKED, '');
    if (stacked !== was && state.observing) {
      // The change resizes the boxes this observer watches; it looks again
      // from the next frame, so the change never reads as a resize loop.
      state.observer.disconnect();
      state.observing = false;
      requestAnimationFrame(() => watchStack(root));
    }
  } finally {
    state.busy = false;
  }
}

function watchStack(root) {
  const state = root[STACK_KEY];
  if (!state || state.observing) return;
  // The room (the parent and the group) and each button, whose box widens
  // when its face arrives later.
  for (const box of [root.parentElement, root, ...drawnChildren(root)].filter(Boolean)) {
    state.observer.observe(box);
  }
  state.observing = true;
}

function drawnChildren(root) {
  return getItems(root).map((item) => (item.matches(HOSTS) ? item.firstElementChild : item)).filter(Boolean);
}

function bindStack(root) {
  const state = root[STACK_KEY];
  if (!stackWanted(root)) {
    if (state) {
      state.observer.disconnect();
      root[STACK_KEY] = null;
    }
    root.removeAttribute(STACKED);
    return;
  }
  if (!state) {
    root[STACK_KEY] = {
      observer: new ResizeObserver(() => layoutStack(root)),
      busy: false,
      observing: false,
    };
  } else if (state.observing) {
    // The buttons may have changed: watch the current ones.
    state.observer.disconnect();
    state.observing = false;
  }
  layoutStack(root);
  watchStack(root);
}

function bindButtonGroup(root) {
  if (!(root instanceof HTMLElement) || root[OBSERVER_KEY]) {
    if (root instanceof HTMLElement && !root[OVERFLOW_KEY]?.busy) bindOverflow(root);
    if (root instanceof HTMLElement) bindStack(root);
    return syncButtonGroup(root);
  }

  // An orientation the author wrote is kept, before the group writes its own.
  root[AUTHOR_ORIENTATION_KEY] = root.hasAttribute('data-orientation') || root.hasAttribute('aria-orientation');
  syncButtonGroup(root);
  root[OBSERVER_KEY] = new MutationObserver(() => {
    if (root[OVERFLOW_KEY]?.busy) return;
    syncButtonGroup(root);
    bindOverflow(root);
    bindStack(root);
  });
  root[OBSERVER_KEY].observe(root, {
    childList: true,
    attributes: true,
    attributeFilter: ['role', 'data-orientation', 'aria-orientation', 'class', 'overflow'],
  });
  bindOverflow(root);
  bindStack(root);

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

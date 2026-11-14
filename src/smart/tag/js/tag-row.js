// The row an sf-tag stands in (owner decisions C58 and C139 (6); tags study
// TG-2, TG-8). A tag is one element; what a row of them needs is read from
// the row itself, the parent the tags share, without a group element of its
// own (a group part is an open owner question):
//
// - «+N»: in a one-row container (a flex row that does not wrap: filters, a
//   table cell, a card) the tags keep their width (the tag sheet), the row
//   shows those that fit and a plain count «+N» for the rest. The first tag
//   always stands; a name too long for the row ends in an ellipsis. A row
//   that wraps (a form) wraps, as C58 asks. «+N» opens nothing: what it
//   opens is an open owner question, so it is a count with the hidden names
//   in its title.
// - keys: closable tags in a field (inside an .sf-input-field frame) are one
//   Tab stop. ArrowLeft and ArrowRight walk them (mirrored right to left),
//   Home and End go to the ends, Delete or Backspace removes the one stood on
//   (sf-tag-close, as the cross; the host removes it) and the focus goes to
//   its neighbour; each step is said in a polite line, «Москва, 1 из 3,
//   Delete — убрать», the words of sf-input-lookup's chips. The cross under
//   the mouse is unchanged. Tags outside a field keep a stop per cross: that
//   is an open owner question (tags study #q-keys).
//
// A host that lays out its own chips (sf-input-lookup, sf-dropdown) keeps its
// own rules: its rows are left alone. So does sf-tag-group (owner decision
// C145 (3)-(5)): the group owns its row -- one Tab stop for every tag, «+N»
// that opens the hidden tags -- with the helpers exported here.
//
// Every bundle that carries sf-tag carries a copy of this module; the rows
// are kept on one shared record.

import { tagSelector } from '../../../core/js/tag-aliases.js';

const ROWS = Symbol.for('sf.tag.rows');
const rows = () => globalThis[ROWS] || (globalThis[ROWS] = new WeakMap());

const OVER = 'data-sf-tag-over';
const SHRINK = 'data-sf-tag-shrink';
const MORE = 'data-sf-tag-more';
const MANAGED = 'sf-input-lookup, sf-lookup, sf-dropdown, .sf-dropdown, sf-tag-group';

const isTag = (node) => node?.localName === 'sf-tag';
const tagsOf = (row) => [...row.children].filter(isTag);

// What a row lays out: a host drawn with display: contents gives its boxes.
export function boxesOf(row) {
  const out = [];
  for (const child of row.children) {
    if (child.hidden) continue;
    const view = getComputedStyle(child);
    if (view.display === 'none') continue;
    if (view.display === 'contents') out.push(...[...child.children].filter((one) => getComputedStyle(one).display !== 'none' && !one.hidden));
    else out.push(child);
  }
  return out;
}

export function oneRow(row) {
  const view = getComputedStyle(row);
  return /flex/u.test(view.display) && view.flexWrap === 'nowrap' && view.flexDirection.startsWith('row');
}

// Whether anything the row lays out passes its content box, on either side.
export function overflows(row) {
  const view = getComputedStyle(row);
  const box = row.getBoundingClientRect();
  const start = box.left + (parseFloat(view.borderLeftWidth) || 0) + (parseFloat(view.paddingLeft) || 0);
  const end = box.right - (parseFloat(view.borderRightWidth) || 0) - (parseFloat(view.paddingRight) || 0);
  return boxesOf(row).some((one) => {
    const rect = one.getBoundingClientRect();
    return rect.width > 0 && (rect.right > end + 0.5 || rect.left < start - 0.5);
  });
}

export function setAttr(element, name, on) {
  if (on && !element.hasAttribute(name)) element.setAttribute(name, '');
  else if (!on && element.hasAttribute(name)) element.removeAttribute(name);
}

// The «+N» count: class markup of a default tag of the row's size, so it is
// drawn the moment it is placed and measured in the same pass.
function moreFor(row, state, tags) {
  let more = state.more;
  if (!more || !more.isConnected || more.parentElement !== row) {
    more = row.ownerDocument.createElement('span');
    more.setAttribute(MORE, '');
    more.innerHTML = '<span class="sf-tag-container"></span>';
    state.more = more;
  }
  const root = tags[0].querySelector(':scope > .sf-tag') || tags[0].firstElementChild;
  const steps = [...(root?.classList || [])].filter((name) => /^sf-tag--(size|height)-/u.test(name));
  const className = ['sf-tag', 'sf-tag--default', ...(steps.length ? steps : ['sf-tag--size-1/2']), 'inline-flex', 'flex-row', 'flex-nowrap', 'items-center'].join(' ');
  if (more.className !== className) more.className = className;
  return more;
}

function placeMore(row, more, after, count, names, word) {
  if (more.previousElementSibling !== after || more.parentElement !== row) after.after(more);
  const text = `+${count}`;
  const label = more.firstElementChild;
  if (label.textContent !== text) label.textContent = text;
  const title = word('more', {count, vars: {n: count, names}});
  if (more.title !== title) more.title = title;
}

function dropMore(state) {
  if (state.more?.isConnected) state.more.remove();
}

export function nameOf(tag) {
  return String(tag.text ?? tag.getAttribute('text') ?? tag.textContent ?? '').trim();
}

function fit(row, state) {
  const tags = tagsOf(row);
  for (const tag of tags) {
    setAttr(tag, OVER, false);
    setAttr(tag, SHRINK, false);
  }
  if (!tags.length || row.closest(MANAGED) || !oneRow(row)) {
    dropMore(state);
    return;
  }
  dropMore(state);
  if (!overflows(row)) return;
  const word = (key, options) => tags[0].sfWord?.(key, options) ?? '';
  const more = moreFor(row, state, tags);
  let shown = tags.length;
  while (shown > 1) {
    shown -= 1;
    setAttr(tags[shown], OVER, true);
    const hidden = tags.slice(shown);
    placeMore(row, more, tags[shown - 1], hidden.length, hidden.map(nameOf).join(', '), word);
    if (!overflows(row)) return;
  }
  if (tags.length === 1) dropMore(state);
  // The first tag always stands: it gives up its width and ends in an
  // ellipsis.
  setAttr(tags[0], SHRINK, true);
}

// ---------------------------------------------------------- keys in a field

function inField(row) {
  return Boolean(row.closest('.sf-input-field')) && !row.closest(MANAGED);
}

function groupOf(row) {
  if (!inField(row)) return [];
  return tagsOf(row).filter((tag) => tag.closable && !tag.disabled && !tag.hasAttribute(OVER));
}

// The tag's stop: its label button when it has one (a checkbox or an
// interactive tag), else its cross.
// Asked at the call, so a name the page registers later is found too.
const crossButton = () => `:scope > .sf-tag > ${tagSelector('sf-button-close')} button, :scope > .sf-tag > .sf-icon-button`;

export function stopOf(tag) {
  return tag.querySelector(':scope > button.sf-tag, :scope > a.sf-tag[href], :scope > .sf-tag > .sf-tag-action')
    || tag.querySelector(crossButton());
}

export function stopsIn(tag) {
  return [...tag.querySelectorAll('button, a[href]')];
}

function untab(row, state) {
  const group = groupOf(row);
  const was = state.group || [];
  // Tags that left the group get their own stops back.
  for (const tag of was) {
    if (group.includes(tag)) continue;
    for (const button of stopsIn(tag)) if (button.dataset.sfTagRoving !== undefined) {
      button.removeAttribute('tabindex');
      delete button.dataset.sfTagRoving;
    }
  }
  state.group = group;
  if (group.length < 2) {
    for (const tag of group) for (const button of stopsIn(tag)) if (button.dataset.sfTagRoving !== undefined) {
      button.removeAttribute('tabindex');
      delete button.dataset.sfTagRoving;
    }
    return;
  }
  if (state.active >= group.length) state.active = group.length - 1;
  if (state.active < 0) state.active = 0;
  group.forEach((tag, index) => {
    const stop = stopOf(tag);
    for (const button of stopsIn(tag)) {
      const tabIndex = button === stop && index === state.active ? '0' : '-1';
      if (button.getAttribute('tabindex') !== tabIndex) button.setAttribute('tabindex', tabIndex);
      button.dataset.sfTagRoving = '';
    }
  });
}

export function said(doc) {
  let line = doc.querySelector('[data-sf-tag-said]');
  if (!line) {
    line = doc.createElement('div');
    line.setAttribute('data-sf-tag-said', '');
    line.setAttribute('aria-live', 'polite');
    line.setAttribute('role', 'status');
    // Out of view, read: the visually hidden pattern, one Framework pixel.
    line.style.cssText = 'position:absolute;inline-size:var(--sf-px);block-size:var(--sf-px);overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
    doc.body.append(line);
  }
  return line;
}

function announce(tag, index, total) {
  const text = tag.sfWord?.('position', {vars: {label: nameOf(tag), position: index + 1, total}}) || '';
  if (!text) return;
  const line = said(tag.ownerDocument);
  line.textContent = '';
  requestAnimationFrame(() => { line.textContent = text; });
}

function focusAt(row, state, index) {
  const group = groupOf(row);
  if (!group.length) return;
  state.active = Math.max(0, Math.min(index, group.length - 1));
  untab(row, state);
  const tag = group[state.active];
  stopOf(tag)?.focus();
}

function onKeydown(row, state, event) {
  const group = state.group || [];
  if (group.length < 2) return;
  const index = group.findIndex((tag) => tag.contains(event.target));
  if (index < 0) return;
  const rtl = getComputedStyle(row).direction === 'rtl';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  const ahead = rtl ? 'ArrowLeft' : 'ArrowRight';
  const {key} = event;
  if (key === back || key === ahead || key === 'Home' || key === 'End') {
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? group.length - 1
      : Math.max(0, Math.min(group.length - 1, index + (key === ahead ? 1 : -1)));
    focusAt(row, state, next);
    return;
  }
  if (key === 'Delete' || key === 'Backspace') {
    event.preventDefault();
    const tag = group[index];
    tag.onClose?.();
    // The host removes the tag (sf-tag-close); the focus then goes to the
    // neighbour that took its place, or the one before the last.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (tag.isConnected && groupOf(row).includes(tag)) return;
      untab(row, state);
      const left = state.group || [];
      if (left.length) focusAt(row, state, Math.min(index, left.length - 1));
    }));
  }
}

function onFocusin(row, state, event) {
  const group = state.group || [];
  if (group.length < 2) return;
  const index = group.findIndex((tag) => tag.contains(event.target));
  if (index < 0) return;
  if (index !== state.active) {
    state.active = index;
    untab(row, state);
  }
  announce(group[index], index, group.length);
}

// ---------------------------------------------------------- the record

function settle(row, state) {
  state.frame = 0;
  if (!row.isConnected || !tagsOf(row).length) {
    forget(row);
    return;
  }
  state.busy = true;
  try {
    fit(row, state);
    untab(row, state);
  } finally {
    // The changes made here are not news: the observers' records of them are
    // taken before the next frame.
    state.mutations?.takeRecords();
    state.busy = false;
  }
}

function schedule(row, state) {
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => settle(row, state));
}

function forget(row) {
  const state = rows().get(row);
  if (!state) return;
  state.resize?.disconnect();
  state.mutations?.disconnect();
  row.removeEventListener('keydown', state.keydown);
  row.removeEventListener('focusin', state.focusin);
  if (state.frame) cancelAnimationFrame(state.frame);
  dropMore(state);
  rows().delete(row);
}

/** A tag that drew (or moved) asks its row to be laid out again. */
export function tagInRow(tag) {
  const row = tag.parentElement;
  if (!row || typeof requestAnimationFrame !== 'function') return;
  // A group lays out and walks its own tags (sf-tag-group): it is told.
  if (row.localName === 'sf-tag-group') {
    row.sfTagDrew?.();
    return;
  }
  let state = rows().get(row);
  if (!state) {
    state = {frame: 0, more: null, group: [], active: 0, busy: false};
    rows().set(row, state);
    if (typeof ResizeObserver === 'function') {
      let width = -1;
      state.resize = new ResizeObserver(([entry]) => {
        const now = Math.round(entry?.contentRect?.width ?? 0);
        if (now === width) return;
        width = now;
        schedule(row, state);
      });
      state.resize.observe(row);
    }
    if (typeof MutationObserver === 'function') {
      state.mutations = new MutationObserver(() => {
        if (!state.busy) schedule(row, state);
      });
      state.mutations.observe(row, {childList: true});
    }
    state.keydown = (event) => onKeydown(row, state, event);
    state.focusin = (event) => onFocusin(row, state, event);
    row.addEventListener('keydown', state.keydown);
    row.addEventListener('focusin', state.focusin);
  }
  schedule(row, state);
}

/** A tag that left asks the row it stood in to be laid out again. */
export function tagLeftRow(row) {
  const state = row && rows().get(row);
  if (state) schedule(row, state);
}

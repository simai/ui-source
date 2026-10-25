// The parts of sf-menu that are about data, not the page: the shape an item
// takes, from the items a host gives or from the links written in the markup,
// which item is the current page, and which branches lead to it. Kept apart
// from the element so the contract tests can run them in Node, as
// sf-accordion's sections.mjs is.

// The class menu's orientations: a column for a side panel, a row for a page
// header (sf-menu--horizontal, the first level only).
export const MENU_ORIENTATIONS = Object.freeze(['vertical', 'horizontal']);
// The class menu's presentations by name: default, the documentation tree
// (sf-menu--documentation-tree) and the compact rail (sf-menu--compact). The
// tree and the rail are columns: with them the menu is vertical.
export const MENU_APPEARANCES = Object.freeze(['default', 'documentation-tree', 'compact']);
// When a row of links that does not fit becomes a button that opens them as a
// column: when it does not fit, always, or never.
export const MENU_COLLAPSE = Object.freeze(['auto', 'always', 'none']);
// The class menu draws four levels; a deeper one is drawn as the fourth.
export const LEVEL_LIMIT = 4;

const text = (value) => (value === null || value === undefined ? '' : String(value));

// One item, as the element draws it, with its children. `label` is text, never
// markup; `badge` is a count (drawn by the class counter: capped at 99+,
// hidden at 0, its phrase ends the link's name) or a short label.
export function normaliseItem(item, index = 0, parentId = '', seen = new Set()) {
  if (typeof item === 'string') item = {label: item};
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const own = text(item.id ?? item.key).trim();
  const id = own || (parentId ? `${parentId}-${index + 1}` : `item-${index + 1}`);
  if (seen.has(id)) return null;
  seen.add(id);
  const children = [];
  (Array.isArray(item.children) ? item.children : []).forEach((child, at) => {
    const normalised = normaliseItem(child, at, id, seen);
    if (normalised) children.push(normalised);
  });
  return {
    id,
    label: text(item.label ?? item.text ?? item.title),
    href: text(item.href).trim(),
    icon: text(item.icon).trim(),
    badge: text(item.badge).trim(),
    current: Boolean(item.current),
    disabled: Boolean(item.disabled),
    open: Boolean(item.open),
    children,
  };
}

// The items from what a host gave: an array, or the same array as JSON in the
// `items` attribute. An item whose id repeats an earlier one, anywhere in the
// tree, is left out with its children, as one id must name one item.
export function normaliseItems(items) {
  let list = items;
  if (typeof list === 'string') {
    const raw = list.trim();
    if (!raw) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  list.forEach((item, index) => {
    const normalised = normaliseItem(item, index, '', seen);
    if (normalised) result.push(normalised);
  });
  return result;
}

// A badge that is a whole number is a count; anything else is a label.
export function badgeCount(badge) {
  return /^\d+$/u.test(text(badge).trim()) ? text(badge).trim() : null;
}

// Every item, depth first, with the ids of the branches above it.
export function walkItems(items, visit, path = []) {
  for (const item of items) {
    visit(item, path);
    if (item.children.length) walkItems(item.children, visit, [...path, item.id]);
  }
}

export function findItem(items, id) {
  let found = null;
  walkItems(items, (item) => {
    if (!found && item.id === String(id)) found = item;
  });
  return found;
}

// The ids of the branches above an item, outermost first; null when no item
// has that id.
export function pathTo(items, id) {
  let found = null;
  walkItems(items, (item, path) => {
    if (!found && item.id === String(id)) found = path;
  });
  return found;
}

// A path as the menu compares it: no trailing slash but the root's, and no
// index document name.
export function normalisePath(path) {
  let value = text(path).split(/[?#]/u)[0] || '/';
  value = value.replace(/\/index\.html?$/u, '/');
  if (value.length > 1) value = value.replace(/\/+$/u, '');
  return value || '/';
}

// The item that is the current page: the one the element's `current` names,
// else -- when the menu follows the location -- the item whose link leads to
// this path (the first, depth first), else the first item marked current.
// `base` resolves relative links, as the browser would.
export function currentItemId(items, {current = '', pathname = '', base = '', fromLocation = false} = {}) {
  const named = text(current).trim();
  if (named && findItem(items, named)) return named;
  if (fromLocation && pathname) {
    const here = normalisePath(pathname);
    let found = null;
    walkItems(items, (item) => {
      if (found || !item.href || item.disabled) return;
      let target;
      try {
        target = new globalThis.URL(item.href, base || 'http://localhost/');
      } catch {
        return;
      }
      if (base && new globalThis.URL(base).origin !== target.origin) return;
      if (normalisePath(target.pathname) === here) found = item.id;
    });
    if (found) return found;
  }
  let flagged = null;
  walkItems(items, (item) => {
    if (!flagged && item.current) flagged = item.id;
  });
  return flagged;
}

// Which branches are open: what the person or the host set, else -- in a
// column -- what the item says, and the branches above the current page, so
// it can be seen. A row's panels open only when asked: none is open when the
// page starts.
export function openBranches(items, overrides = new Map(), currentId = null, inColumn = true) {
  const reveal = new Set(inColumn && currentId ? pathTo(items, currentId) || [] : []);
  const open = new Set();
  walkItems(items, (item) => {
    if (!item.children.length) return;
    const fallback = inColumn && (item.open || reveal.has(item.id));
    const state = overrides.has(item.id) ? overrides.get(item.id) : fallback;
    if (state) open.add(item.id);
  });
  return open;
}

// A list written in the markup, read as items: each <li> is an item, its
// direct <a> the link (href, aria-current, the label from its words), its
// direct <ul> the children. data-id (or id), data-icon, data-badge,
// data-open and data-disabled give the other fields; a row the class menu has
// already drawn is read too (its .sf-menu-element-icon, .sf-menu-element-text
// and counter). Icon glyphs, counters and what is hidden from assistive
// technology are not words of the label. Works on any DOM-like node with
// children, childNodes and attributes.
const NOT_WORDS = /(?:^|\s)(?:sf-icon|sf-icon-button|sf-badge|sf-badge-anchored-text)(?:\s|$)/u;

function wordsOf(node) {
  if (!node) return '';
  if (node.nodeType === 3) return text(node.textContent);
  if (node.nodeType !== 1) return '';
  if (node.localName === 'ul' || NOT_WORDS.test(text(node.getAttribute?.('class')))
    || node.getAttribute?.('aria-hidden') === 'true') return '';
  return Array.from(node.childNodes || []).map(wordsOf).join(' ');
}

const squeeze = (value) => text(value).replace(/\s+/gu, ' ').trim();

export function itemsFromList(list) {
  if (!list) return [];
  const own = (node, name) => Array.from(node.children || []).find((child) => child.localName === name) || null;
  const attr = (node, name) => (node?.getAttribute ? node.getAttribute(name) : null);
  const has = (node, name) => Boolean(node?.hasAttribute?.(name));
  const find = (node, selector) => node?.querySelector?.(selector) || null;
  return Array.from(list.children || [])
    .filter((child) => child.localName === 'li')
    .map((li) => {
      const link = own(li, 'a') || find(li, ':scope > .sf-menu-element > a[href]');
      const row = link || find(li, ':scope > .sf-menu-element') || li;
      const nested = own(li, 'ul');
      const currentAttr = attr(link, 'aria-current');
      const drawnText = find(row, '.sf-menu-element-text');
      const drawnIcon = find(row, '.sf-menu-element-icon');
      const drawnCount = find(row, '.sf-badge[data-count]');
      return {
        id: attr(li, 'data-id') || attr(link, 'data-id') || attr(li, 'id') || undefined,
        label: squeeze(drawnText ? drawnText.textContent : wordsOf(row)),
        href: link ? attr(link, 'href') || '' : '',
        icon: attr(li, 'data-icon') || attr(link, 'data-icon') || squeeze(drawnIcon?.textContent),
        badge: attr(li, 'data-badge') || attr(link, 'data-badge') || attr(drawnCount, 'data-count') || '',
        current: (currentAttr !== null && currentAttr !== 'false') || has(li, 'data-current'),
        disabled: has(li, 'data-disabled') || has(li, 'disabled') || attr(link, 'aria-disabled') === 'true',
        open: has(li, 'data-open') || Boolean(li.classList?.contains?.('open')),
        children: nested ? itemsFromList(nested) : [],
      };
    });
}

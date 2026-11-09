// The parts of sf-menu that are about data, not the page: the shape an item
// takes, from the items a host gives or from the links written in the markup,
// which item is the current page, and which branches lead to it. Kept apart
// from the element so the contract tests can run them in Node, as
// sf-accordion's sections.mjs is.

// The class menu's orientations: a column for a side panel, a row for a page
// header (sf-menu--horizontal, the first level only).
export const MENU_ORIENTATIONS = Object.freeze(['vertical', 'horizontal']);
// The class menu's presentations by name: default, the documentation tree
// (sf-menu--documentation-tree), the compact rail (sf-menu--compact) and the
// header navigation (sf-menu--navigation). The tree and the rail are columns:
// with them the menu is vertical. The navigation is a row or a column, as
// orientation says, like the default.
export const MENU_APPEARANCES = Object.freeze(['default', 'documentation-tree', 'compact', 'navigation']);
// The presentations that can stand in a row.
export const ROW_APPEARANCES = Object.freeze(['default', 'navigation']);
// When a row of links that does not fit becomes a button that opens them as a
// column: when it does not fit, always, or never.
// narrow: a column (or a row) that is shown as that button while the page is
// narrower than the md breakpoint -- a phone -- whose words are then the
// current item's, a compact selector of the sections.
export const MENU_COLLAPSE = Object.freeze(['auto', 'always', 'narrow', 'none']);
// What a row of links does when its items do not fit (C30, the values of
// sf-tabs' overflow where they mean the same): more, the items that do not fit
// leave the row for a trailing «Ещё» branch -- priority+ -- and the section
// holding the current page stays; collapse, the whole row becomes the button
// (collapse auto); none, the row stays as it is.
export const MENU_OVERFLOW = Object.freeze(['more', 'collapse', 'none']);
// How a row's branch opens: a press (the default, WAI-ARIA and USWDS), or a
// pointer resting on it -- the hover delays of NN/g, 300 ms to open and
// 500 ms outside before it closes -- with the press still working.
export const MENU_OPEN_ON = Object.freeze(['click', 'hover']);
export const MENU_INDICATORS = Object.freeze(['line', 'fill']);
export const HOVER_OPEN_DELAY = 300;
// A region (a mega menu) is a bigger change of the page: it waits longer.
export const HOVER_REGION_OPEN_DELAY = 500;
export const HOVER_CLOSE_DELAY = 500;
// The id of the trailing «Ещё» branch of a row with overflow more. An item id
// never starts with @ in a host's data by this rule: one that does is
// renamed by its place.
export const MORE_ID = '@more';
// The tones of an item's status dot: the class dot's tones (src/component/dot).
export const MENU_STATUSES = Object.freeze(['success', 'warning', 'error', 'info', 'neutral']);
// The class menu draws four levels; a deeper one is drawn as the fourth.
export const LEVEL_LIMIT = 4;

const text = (value) => (value === null || value === undefined ? '' : String(value));

// One item, as the element draws it, with its children. `label` is text, never
// markup; `badge` is a count (drawn by the class counter: capped at 99+,
// hidden at 0, its phrase ends the link's name) or a short label, and `count`
// the same count by its own name. `status` is a dot of one of the tones.
//
// A first-level item with `group: true` is a group: a heading over its items
// (`children`, or `items` by the shape of a grouped navigation), never a
// destination itself. Its items are first-level rows; a group is open unless
// it says `open: false`, and only a `collapsible` one is opened and closed.
export function normaliseItem(item, index = 0, parentId = '', seen = new Set()) {
  if (typeof item === 'string') item = {label: item};
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const own = text(item.id ?? item.key).trim().replace(/^@.*$/u, '');
  const id = own || (parentId ? `${parentId}-${index + 1}` : `item-${index + 1}`);
  if (seen.has(id)) return null;
  seen.add(id);
  const group = !parentId && Boolean(item.group);
  const nested = Array.isArray(item.children) ? item.children : group && Array.isArray(item.items) ? item.items : [];
  const children = [];
  nested.forEach((child, at) => {
    const normalised = normaliseItem(child, at, id, seen);
    if (normalised) children.push(normalised);
  });
  const status = text(item.status).trim();
  const normalised = {
    id,
    label: text(item.label ?? item.text ?? item.title),
    href: group ? '' : text(item.href).trim(),
    icon: text(item.icon).trim(),
    badge: text(item.badge ?? item.count).trim(),
    status: MENU_STATUSES.includes(status) ? status : '',
    current: !group && Boolean(item.current),
    disabled: Boolean(item.disabled),
    open: group ? item.open !== false : Boolean(item.open),
    // A row's first-level branch that opens a region (a mega menu) instead of
    // a panel: the name of a <template slot="region-<name>"> written inside
    // the element; without one the region draws the item's children as
    // columns. Elsewhere -- a column, a deeper level, the «Ещё» panel -- it
    // is an ordinary branch.
    region: group ? '' : text(item.region).trim(),
    // A link that leaves the site or opens elsewhere (C30 amended, R071): its
    // target is the link's, and an item with a target of its own (_blank) or
    // external: true draws ↗ after its words.
    target: group ? '' : text(item.target).trim(),
    external: !group && (Boolean(item.external) || (Boolean(text(item.target).trim()) && text(item.target).trim() !== '_self')),
    children,
  };
  if (group) {
    normalised.group = true;
    normalised.collapsible = Boolean(item.collapsible);
  }
  return normalised;
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
export function currentItemId(items, {current = '', pathname = '', hash = '', base = '', fromLocation = false} = {}) {
  const named = text(current).trim();
  const namedItem = named ? findItem(items, named) : null;
  if (namedItem && !namedItem.group) return named;
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
      // A link to a section of a page (#address) is that section only while
      // the location names it: in-page panels, one hash each.
      if (target.hash && target.hash !== text(hash)) return;
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
// page starts. A group that cannot be collapsed is always open; a row draws
// no group (its items stand in the row), so none is open there.
export function openBranches(items, overrides = new Map(), currentId = null, inColumn = true) {
  const reveal = new Set(inColumn && currentId ? pathTo(items, currentId) || [] : []);
  const open = new Set();
  walkItems(items, (item) => {
    if (!item.children.length) return;
    if (item.group && !item.collapsible) {
      if (inColumn) open.add(item.id);
      return;
    }
    const fallback = inColumn && (item.open || reveal.has(item.id));
    const state = overrides.has(item.id) ? overrides.get(item.id) : fallback;
    if (state) open.add(item.id);
  });
  return open;
}

// A list written in the markup, read as items: each <li> is an item, its
// direct <a> the link (href, aria-current, the label from its words), its
// direct <ul> the children. data-id (or id), data-icon, data-badge,
// data-open, data-disabled, data-status, data-group and data-collapsible
// give the other fields (data-open="false" closes a group at first); a row the class menu has
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
        // A group is open unless data-open="false" says otherwise.
        open: has(li, 'data-group')
          ? attr(li, 'data-open') !== 'false'
          : has(li, 'data-open') || Boolean(li.classList?.contains?.('open')),
        group: has(li, 'data-group'),
        region: attr(li, 'data-region') || '',
        target: attr(link, 'target') || '',
        external: has(li, 'data-external') || has(link, 'data-external'),
        collapsible: has(li, 'data-collapsible'),
        status: attr(li, 'data-status') || '',
        children: nested ? itemsFromList(nested) : [],
      };
    });
}

// The items as a row or a compact rail draws them: a group gives its items
// to the first level, in its place, and draws no heading.
export function withoutGroups(items) {
  return items.flatMap((item) => (item.group ? item.children : [item]));
}

// Which first-level items of a row stay in it when the row is `available`
// wide (priority+, C30): every item when all fit; else, from the start, as
// many as fit beside the «Ещё» button, the item at `keep` (the section that
// holds the current page) first of all -- unless it does not fit beside the
// button either. Widths are each item's own, `gap` the row's gap. Answers the
// indexes that stay, in order; none means the button alone, then «Меню».
export function fitRow(widths, moreWidth, available, gap = 0, keep = -1) {
  const count = widths.length;
  const all = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1);
  if (all <= available + 0.5) return widths.map((_, index) => index);
  const stays = [];
  let used = moreWidth;
  if (keep >= 0 && keep < count && used + gap + widths[keep] <= available + 0.5) {
    used += gap + widths[keep];
    stays.push(keep);
  }
  for (let index = 0; index < count; index += 1) {
    if (index === keep) continue;
    if (used + gap + widths[index] > available + 0.5) break;
    used += gap + widths[index];
    stays.push(index);
  }
  return stays.sort((a, b) => a - b);
}

// Search in a column (C30 amended 2026-11-09, R071 a). Words are compared
// without case and with ё as е; one character stays one character, so a
// place in the folded words is the same place in the words drawn.
export function foldWords(value) {
  let folded = '';
  for (const unit of text(value)) {
    const lower = unit.toLowerCase();
    folded += lower === 'ё' ? 'е' : lower.length === unit.length ? lower : unit;
  }
  return folded;
}

// Where `query` stands in `words`: [start, end] pairs, none when it does not.
export function matchesIn(words, query) {
  const needle = foldWords(query).trim();
  if (!needle) return [];
  const haystack = foldWords(words);
  const found = [];
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    found.push([at, at + needle.length]);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return found;
}

// The items a query keeps: an item whose words match stays with all its
// children, closed unless one of them matches too; an item one of whose
// descendants matches stays, open, with only the branches that lead to a
// match; a group whose heading matches stays whole. Answers {items, open,
// count}: the tree to draw, the ids to draw open (groups and the branches
// leading to a match) and how many words matched.
export function filterItems(items, query) {
  const open = new Set();
  let count = 0;
  const keep = (item, whole) => {
    const hit = matchesIn(item.label, query).length > 0;
    if (hit) count += 1;
    if (whole) {
      // Under a matching heading or parent: everything stays; matches below
      // still count and still open their branch.
      const children = item.children.map((child) => keep(child, true));
      if (item.children.some((child, at) => children[at].leads)) open.add(item.id);
      return {item: {...item, children: children.map((entry) => entry.item)}, leads: hit || children.some((entry) => entry.leads)};
    }
    if (hit) {
      const children = item.children.map((child) => keep(child, true));
      if (item.group || children.some((entry) => entry.leads)) open.add(item.id);
      return {item: {...item, children: children.map((entry) => entry.item)}, leads: true};
    }
    const children = item.children.map((child) => keep(child, false)).filter(Boolean);
    if (!children.length) return null;
    open.add(item.id);
    return {item: {...item, children: children.map((entry) => entry.item)}, leads: true};
  };
  const kept = items.map((item) => keep(item, false)).filter(Boolean);
  return {items: kept.map((entry) => entry.item), open, count};
}

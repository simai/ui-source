import { instancePath, partId } from '../../../core/js/instance-path.js';
import BundledPosition from '../../../core/js/position.js';

// Prefer the helper Core published; an isolated bundle uses its own copy.
const positioning = () => globalThis.SF?.Position || BundledPosition;
const submenuAnchors = new WeakMap();

const MENU_ITEM_SELECTOR = '.sf-menu-item';
const BOUND_FLAG = 'sfMenuBound';
const EVENTS_BOUND_FLAG = 'sfMenuEventsBound';
const OBSERVED_ATTRIBUTES = [
  'icon',
  'trailing-icon',
  'text',
  'expanded',
  'aria-expanded',
  'disabled',
];
const ownedRoles = new WeakSet();
const ownedTabIndexes = new WeakMap();
const generatedElements = new WeakSet();
const generatedLeadingIcons = new WeakSet();
const generatedTrailingControls = new WeakSet();
const legacyExpandedOwners = new WeakSet();

// sf-menu (src/smart/menu) draws this markup from data and keeps its state
// itself -- open branches, the current page, the panels of a row. It marks
// what it draws with data-sf-menu-owned, and this runtime, loaded beside it
// for the sheet, leaves that markup alone, so two owners never toggle one
// branch.
const OWNED_SELECTOR = '[data-sf-menu-owned]';

function isOwned(element) {
  return Boolean(element?.closest?.(OWNED_SELECTOR));
}

// A group (component.menu 1.2.0; recognised by hand since 1.2.1) is styling
// only: a heading over a list of first-level rows, the markup sf-menu draws
// for a group --
//
//   li.sf-menu-item.sf-menu-item--group[data-sf-menu-group]
//     span.sf-menu-group-heading > span.sf-menu-group-label
//     ul.sf-menu[aria-labelledby the heading] > li.sf-menu-item ...
//
// A hand-written group is recognised by its class, its data-sf-menu-group or
// its heading, and is left flat: no row element, no disclosure, its rows stay
// on the first level. Only a collapsible group -- a button.sf-menu-group-heading
// -- opens and closes, by that button.
const GROUP_HEADING_SELECTOR = ':scope > .sf-menu-group-heading';

function isGroup(element) {
  return Boolean(
    element?.matches?.('.sf-menu-item') &&
      (element.classList.contains('sf-menu-item--group') ||
        element.hasAttribute('data-sf-menu-group') ||
        element.querySelector(GROUP_HEADING_SELECTOR)),
  );
}

function groupToggle(root) {
  const heading = root.querySelector(GROUP_HEADING_SELECTOR);
  return heading instanceof HTMLButtonElement ? heading : null;
}

function initGroup(root) {
  const heading = root.querySelector(GROUP_HEADING_SELECTOR);
  const list = root.querySelector(':scope > .sf-menu');
  const toggle = groupToggle(root);
  root.dataset[BOUND_FLAG] = 'true';
  root.classList.add('sf-menu-item', 'sf-menu-item--group');
  root.classList.remove('sf-menu-item--has-submenu');
  if (!list) return;

  // A fixed group is always open; a collapsible one by its class or its
  // button's aria-expanded, as it was written.
  const open = toggle
    ? root.classList.contains('open') || toggle.getAttribute('aria-expanded') === 'true'
    : true;
  root.classList.toggle('open', open);
  list.hidden = !open;
  if (heading?.id && !list.hasAttribute('aria-labelledby')) list.setAttribute('aria-labelledby', heading.id);
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-controls', ensureSubmenuId(list));
    const icon = toggle.querySelector(':scope > .sf-icon');
    if (icon) icon.textContent = open ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }
}

function isNativeInteractive(element) {
  return element.matches('button, a[href], input, select, textarea');
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function isExpanded(root) {
  return (
    root.classList.contains('open') ||
    root.hasAttribute('expanded') ||
    toBoolean(root.getAttribute('expanded')) ||
    toBoolean(root.getAttribute('aria-expanded'))
  );
}

function getElementLevel(root) {
  const levelClass = Array.from(root.classList).find((className) =>
    className.startsWith('sf-menu-element--level-'),
  );

  if (levelClass) return levelClass;

  const itemLevelClass = Array.from(root.classList).find((className) =>
    className.startsWith('sf-menu-item--level-'),
  );

  if (itemLevelClass) {
    return itemLevelClass.replace('sf-menu-item--', 'sf-menu-element--');
  }

  let level = 1;
  let currentMenu = root.parentElement?.closest('.sf-menu');

  while (currentMenu) {
    const parentItem = currentMenu.parentElement?.closest('.sf-menu-item');
    if (!parentItem) break;

    if (!isGroup(parentItem)) level += 1;
    currentMenu = parentItem.parentElement?.closest('.sf-menu');
  }

  const normalizedLevel = Math.min(Math.max(level, 1), 4);
  return `sf-menu-element--level-${normalizedLevel}`;
}

function getTextContent(root) {
  const explicitText = root.getAttribute('text');
  if (explicitText) return explicitText;

  const text = root.querySelector(
    ':scope > .sf-menu-element > .sf-menu-element-wrap .sf-menu-element-text',
  );
  if (text) return text.textContent?.trim() || '';

  return Array.from(root.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clearDirectTextNodes(root) {
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    node.remove();
  });
}

function hasSubmenu(root) {
  if (isGroup(root)) return false;
  const nestedMenu = root.querySelector(':scope > .sf-menu');
  return Boolean(nestedMenu);
}

function isHorizontalTopLevel(root) {
  return root?.parentElement?.matches('.sf-menu.sf-menu--horizontal') || false;
}

function getDisclosureController(root) {
  const element = root?.querySelector(':scope > .sf-menu-element');
  if (!element) return null;
  return element.querySelector(':scope > button.sf-icon-button') || element;
}

function closeHorizontalSiblings(root) {
  if (!isHorizontalTopLevel(root)) return;

  Array.from(root.parentElement.children).forEach((candidate) => {
    if (candidate === root || !candidate.matches('.sf-menu-item.open') || isGroup(candidate)) return;
    setMenuItemOpen(candidate, false);
  });
}

// Closing any horizontal item closes (and releases the anchored flyouts of)
// everything open inside it, deepest first.
function closeHorizontalDescendants(root) {
  if (!root?.closest('.sf-menu.sf-menu--horizontal')) return;

  Array.from(root.querySelectorAll('.sf-menu-item.open')).reverse().forEach((candidate) => {
    if (!isGroup(candidate)) setMenuItemOpen(candidate, false);
  });
}

// Horizontal flyouts use the shared Framework geometry: the first level opens
// below its item, deeper levels to the inline end; both flip to the opposite
// side and shift inside the viewport instead of overflowing it.
function positionHorizontalSubmenu(root) {
  const horizontal = root?.closest('.sf-menu.sf-menu--horizontal');
  const submenu = root?.querySelector(':scope > .sf-menu');
  if (!horizontal || !submenu || submenu.hidden || !root.classList.contains('open')) return;
  const current = submenuAnchors.get(submenu);
  if (current) {
    current.anchor.update();
    return;
  }
  const saved = ['min-width', 'overflow-y'].map(name => [name, submenu.style.getPropertyValue(name), submenu.style.getPropertyPriority(name)]);
  // min-inline-size: 100% would resolve against the viewport once fixed.
  submenu.style.minWidth = `${root.getBoundingClientRect().width}px`;
  submenu.style.overflowY = 'auto';
  const topLevel = isHorizontalTopLevel(root);
  // The gap between panels is sf-menu's (C30; RG-NV 26): the first level's
  // panel stands --sf-space-1/4 under the header's edge (or the row's), a
  // side panel --sf-space-1/4 past the edge of the panel its row is in --
  // its padding and border, not the row's own edge -- with its first row
  // level with the row that opened it. Both stood flush (offset 0), a side
  // panel over its parent's padding.
  let options;
  if (topLevel) {
    options = {side: 'block-end', align: 'start', fitHeight: true,
      offset: 'calc(var(--sf-site-header--edge, calc(var(--sf-px) * 0)) + var(--sf-space-1\\/4))'};
  } else {
    const outer = root.parentElement.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const own = getComputedStyle(submenu);
    const gap = positioning().resolveLength('var(--sf-space-1\\/4)', root);
    options = {side: 'inline-end', align: 'start', fitHeight: true,
      offset: Math.max(outer.right - box.right, box.left - outer.left) + gap,
      alignmentOffset: -((parseFloat(own.paddingTop) || 0) + (parseFloat(own.borderTopWidth) || 0))};
  }
  const anchor = positioning().anchor(root, submenu, options);
  submenuAnchors.set(submenu, {anchor, saved});
}

function releaseHorizontalSubmenu(root) {
  const submenu = root?.querySelector(':scope > .sf-menu');
  const current = submenu && submenuAnchors.get(submenu);
  if (!current) return;
  current.anchor.stop();
  for (const [name, value, priority] of current.saved) {
    if (value) submenu.style.setProperty(name, value, priority);
    else submenu.style.removeProperty(name);
  }
  submenuAnchors.delete(submenu);
}

function ensureElement(root, isBranch) {
  let element = root.querySelector(':scope > .sf-menu-element');
  if (!element) {
    element = document.createElement(isBranch ? 'button' : 'span');
    element.className = 'sf-menu-element';
    if (isBranch) element.type = 'button';
    generatedElements.add(element);
    root.prepend(element);
  } else if (generatedElements.has(element) && element.matches(isBranch ? ':not(button)' : 'button')) {
    const replacement = document.createElement(isBranch ? 'button' : 'span');
    replacement.className = element.className;
    if (isBranch) replacement.type = 'button';
    while (element.firstChild) replacement.append(element.firstChild);
    element.replaceWith(replacement);
    generatedElements.delete(element);
    generatedElements.add(replacement);
    element = replacement;
  }

  return element;
}

// A branch that is also a page (C30 R058, C224; RG-NV 25): a plain branch
// whose row is a link -- a.sf-menu-element[href] over a nested list -- was one
// link that opened its list (aria-expanded on the link, the chevron inside
// it): a press on the words opened the list instead of the page. It becomes
// the split control sf-menu draws: the row a div.sf-menu-element, the link its
// words (a.sf-menu-element-wrap, its href, aria-current and target kept) and
// beside it the chevron's own button, which opens and closes the list.
const splitRows = new WeakSet();

function splitLinkRow(element) {
  const row = document.createElement('div');
  row.className = 'sf-menu-element';
  splitRows.add(row);
  for (const name of ['aria-expanded', 'aria-controls']) element.removeAttribute(name);
  if (ownedRoles.has(element)) {
    element.removeAttribute('role');
    ownedRoles.delete(element);
  }
  if (ownedTabIndexes.has(element)) {
    element.removeAttribute('tabindex');
    ownedTabIndexes.delete(element);
  }
  for (const name of Array.from(element.classList)) {
    if (name === 'sf-menu-element' || name === 'open' || name === 'disabled' || name.startsWith('sf-menu-element--')) element.classList.remove(name);
  }
  // The link holds the row's words: a wrap the runtime wrote before is
  // unwrapped into it, the chevron it drew inside the link goes, and bare
  // words get the text span every row has.
  for (const trailing of element.querySelectorAll(':scope > .sf-icon-button')) trailing.remove();
  const innerWrap = element.querySelector(':scope > .sf-menu-element-wrap');
  if (innerWrap) innerWrap.replaceWith(...innerWrap.childNodes);
  const words = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (words.length > 0 && !element.querySelector('.sf-menu-element-text')) {
    const text = document.createElement('span');
    text.className = 'sf-menu-element-text';
    text.textContent = words.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
    words.forEach((node) => node.remove());
    element.append(text);
  }
  element.classList.add('sf-menu-element-wrap');
  element.replaceWith(row);
  row.append(element);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sf-icon-button';
  toggle.innerHTML = '<span class="sf-icon" aria-hidden="true"></span>';
  row.append(toggle);
  return row;
}

function ensureWrap(element) {
  let wrap = element.querySelector(':scope > .sf-menu-element-wrap');
  if (!wrap) {
    wrap = document.createElement('span');
    wrap.className = 'sf-menu-element-wrap';

    // Reuse accessible server-rendered content instead of leaving it beside
    // an empty wrapper. Two flex children would introduce the menu gap after
    // hydration and change the control width.
    const leading = element.querySelector(':scope > .sf-menu-element-icon');
    const text = element.querySelector(':scope > .sf-menu-element-text');
    if (leading) wrap.append(leading);
    if (text) wrap.append(text);

    const directTextNodes = Array.from(element.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    if (directTextNodes.length > 0) {
      const directText = document.createElement('span');
      directText.className = 'sf-menu-element-text';
      directText.textContent = directTextNodes
        .map((node) => node.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      directTextNodes.forEach((node) => node.remove());
      wrap.append(directText);
    }

    element.prepend(wrap);
  }

  return wrap;
}

function ensureLeading(root, wrap) {
  const iconName = root.getAttribute('icon') || '';
  let leading = wrap.querySelector('.sf-menu-element-icon');

  if (!iconName) {
    if (leading && generatedLeadingIcons.has(leading)) leading.remove();
    return null;
  }

  if (!leading) {
    leading = document.createElement('span');
    leading.className = 'sf-icon sf-menu-element-icon';
    generatedLeadingIcons.add(leading);
    wrap.prepend(leading);
  }

  leading.textContent = iconName;
  return leading;
}

function ensureText(root, wrap) {
  const content = getTextContent(root);
  let text = wrap.querySelector('.sf-menu-element-text');
  if (!text) {
    text = document.createElement('span');
    text.className = 'sf-menu-element-text';
    wrap.append(text);
  }

  text.textContent = content;
  return text;
}

function ensureTrailing(element) {
  let trailing = element.querySelector(':scope > .sf-icon-button');

  if (!trailing) {
    trailing = document.createElement('span');
    trailing.className = 'sf-icon-button';
    trailing.innerHTML = '<span class="sf-icon" aria-hidden="true"></span>';
    generatedTrailingControls.add(trailing);
    element.append(trailing);
  }

  trailing.classList.add('sf-icon-button');
  if (trailing.tagName !== 'BUTTON') trailing.setAttribute('aria-hidden', 'true');
  return trailing;
}

function removeTrailing(element) {
  const trailing = element.querySelector(':scope > .sf-icon-button');
  if (trailing && generatedTrailingControls.has(trailing)) {
    trailing.remove();
  }
}

function applyElementState(root, element, expanded, isBranch) {
  const disabled = root.classList.contains('disabled') || root.hasAttribute('disabled');

  element.classList.remove(
    'sf-menu-element--level-1',
    'sf-menu-element--level-2',
    'sf-menu-element--level-3',
    'sf-menu-element--level-4',
  );
  element.classList.add(getElementLevel(root));
  element.classList.toggle('open', expanded);
  element.classList.toggle('sf-menu-element--has-submenu', isBranch);
  element.classList.toggle(
    'disabled',
    disabled,
  );
  if (element instanceof HTMLButtonElement) element.disabled = disabled;
}

// A submenu's path id and a local name (standard 1.3.8 §7.1.1,
// simai/ui-source#41): the path of the root menu it stands in and the place
// of its branch in that menu, <root path>--submenu-<n>[-<n>...] -- the same in
// every bundle and in server markup. A module counter numbered them in
// creation order, once per bundle. Each submenu took its own path once
// (RG-NV 22): the path counts the menus that have no id, the first submenu
// took one, and every later one read the same count -- three submenus, one
// id, every aria-controls on the first (WCAG 4.1.2). The root's path is
// counted among roots only, so it does not move as its submenus get theirs.
function rootMenuOf(node) {
  let root = node.closest('.sf-menu');
  for (let up = root?.parentElement?.closest('.sf-menu'); up; up = up.parentElement?.closest('.sf-menu')) root = up;
  return root;
}

function rootMenuPath(root) {
  if (root.id) return instancePath(root, { kind: 'sf-menu' });
  let index = 0;
  for (const one of root.ownerDocument.querySelectorAll('.sf-menu')) {
    if (one.id || one.parentElement?.closest('.sf-menu')) continue;
    index += 1;
    if (one === root) break;
  }
  return `class.sf-menu[${index}]`;
}

function ensureSubmenuId(submenu) {
  if (!submenu.id) {
    const root = rootMenuOf(submenu.parentElement) || submenu;
    const places = [];
    for (let item = submenu.parentElement?.closest('.sf-menu-item'); item && root.contains(item); item = item.parentElement?.closest('.sf-menu-item')) {
      places.unshift(Array.from(item.parentElement.children).filter((one) => one.matches('.sf-menu-item')).indexOf(item) + 1);
    }
    submenu.id = partId(rootMenuPath(root), `submenu-${places.join('-')}`);
  }
  return submenu.id;
}

function applyDisclosureState(root, element, suppliedToggle, expanded, isBranch) {
  const submenu = root.querySelector(':scope > .sf-menu');
  const controller = suppliedToggle || (isBranch ? element : null);

  if (!submenu || !controller) {
    element.removeAttribute('aria-expanded');
    element.removeAttribute('aria-controls');
    return;
  }

  controller.setAttribute('aria-expanded', String(expanded));
  controller.setAttribute('aria-controls', ensureSubmenuId(submenu));
  submenu.hidden = !expanded;

  if (suppliedToggle) {
    element.removeAttribute('aria-expanded');
    element.removeAttribute('aria-controls');
  }
}

function applyTrailingState(trailing, root, expanded) {
  const horizontalTopLevel = isHorizontalTopLevel(root);
  // A deeper branch of a horizontal row opens its panel to the side: its
  // indicator points to that side whether open or not (C30).
  const sideBranch = !horizontalTopLevel && Boolean(root?.closest('.sf-menu.sf-menu--horizontal'));
  const trailingIcon =
    root.getAttribute('trailing-icon') ||
    (horizontalTopLevel
      ? (expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down')
      : (expanded && !sideBranch ? 'keyboard_arrow_down' : 'chevron_right'));

  trailing.classList.toggle(
    'disabled',
    root.classList.contains('disabled') || root.hasAttribute('disabled'),
  );
  if (trailing.tagName === 'BUTTON') {
    trailing.disabled = root.classList.contains('disabled') || root.hasAttribute('disabled');
    trailing.setAttribute('aria-expanded', String(expanded));
    if (!trailing.hasAttribute('aria-label') && !trailing.hasAttribute('aria-labelledby')) {
      trailing.setAttribute('aria-label', getTextContent(root));
    }
  }

  const icon = trailing.querySelector('.sf-icon');
  if (icon) {
    icon.textContent = trailingIcon;
  }
}

function setMenuItemOpen(root, nextOpen) {
  if (!root || root.classList.contains('disabled') || root.hasAttribute('disabled')) {
    return false;
  }

  const nestedMenu = root.querySelector(':scope > .sf-menu');
  if (!nestedMenu) return false;

  if (isGroup(root)) {
    const toggle = groupToggle(root);
    if (!toggle || toggle.disabled) return false;
    root.classList.toggle('open', Boolean(nextOpen));
    toggle.setAttribute('aria-expanded', String(Boolean(nextOpen)));
    initGroup(root);
    return true;
  }

  if (nextOpen) closeHorizontalSiblings(root);
  const usesLegacyAriaState = root.hasAttribute('aria-expanded');
  if (nextOpen) {
    root.classList.add('open');
    if (legacyExpandedOwners.has(root)) root.setAttribute('expanded', '');
    if (usesLegacyAriaState) root.setAttribute('aria-expanded', 'true');
  } else {
    closeHorizontalDescendants(root);
    releaseHorizontalSubmenu(root);
    root.classList.remove('open');
    if (legacyExpandedOwners.has(root)) root.removeAttribute('expanded');
    if (usesLegacyAriaState) root.setAttribute('aria-expanded', 'false');
  }

  initMenuItem(root);
  if (nextOpen) requestAnimationFrame(() => positionHorizontalSubmenu(root));
  return true;
}

function toggleMenuItem(root) {
  return setMenuItemOpen(root, !root?.classList.contains('open'));
}

function initMenuItem(root) {
  if (!root || isOwned(root)) return;
  if (isGroup(root)) {
    initGroup(root);
    return;
  }

  if (root.hasAttribute('expanded')) legacyExpandedOwners.add(root);

  const expanded = isExpanded(root);
  const isBranch = hasSubmenu(root);
  let element = ensureElement(root, isBranch);
  if (isBranch && element.matches('a[href]') && !element.querySelector(':scope > button.sf-icon-button')) {
    element = splitLinkRow(element);
  }
  const wrap = ensureWrap(element);
  const suppliedToggle = isBranch && element.querySelector(':scope > button.sf-icon-button');
  const usesRowController = isBranch && !isNativeInteractive(element) && !suppliedToggle;

  root.dataset[BOUND_FLAG] = 'true';
  root.classList.add('sf-menu-item');
  root.classList.toggle('sf-menu-item--has-submenu', isBranch);
  // The stylesheet opens an item by its .open class. An item written expanded
  // (expanded, aria-expanded="true") got its state on the element and the
  // submenu, never the class, and stayed shut.
  root.classList.toggle('open', expanded && isBranch);

  if (usesRowController && !element.hasAttribute('role')) {
    element.setAttribute('role', 'button');
    ownedRoles.add(element);
  } else if (!usesRowController && ownedRoles.has(element)) {
    if (element.getAttribute('role') === 'button') element.removeAttribute('role');
    ownedRoles.delete(element);
  }

  if (ownedTabIndexes.has(element) && element.getAttribute('tabindex') !== ownedTabIndexes.get(element)) {
    ownedTabIndexes.delete(element);
  }
  if (usesRowController && (!element.hasAttribute('tabindex') || ownedTabIndexes.has(element))) {
    const tabIndex = root.hasAttribute('disabled') || root.classList.contains('disabled') ? '-1' : '0';
    element.setAttribute('tabindex', tabIndex);
    ownedTabIndexes.set(element, tabIndex);
  } else if (!usesRowController && ownedTabIndexes.has(element)) {
    element.removeAttribute('tabindex');
    ownedTabIndexes.delete(element);
  }

  ensureLeading(root, wrap);
  ensureText(root, wrap);
  clearDirectTextNodes(root);
  applyElementState(root, element, expanded, isBranch);
  applyDisclosureState(root, element, suppliedToggle, expanded, isBranch);

  if (isBranch) {
    const trailing = ensureTrailing(element);
    applyTrailingState(trailing, root, expanded);
  } else {
    removeTrailing(element);
  }
}

function setupMenuItem(root) {
  if (!root || root.dataset[BOUND_FLAG] === 'true') {
    initMenuItem(root);
    return;
  }

  initMenuItem(root);
}

function initAllMenuItems(scope = document) {
  const roots =
    scope instanceof Element && scope.matches(MENU_ITEM_SELECTOR)
      ? [scope]
      : Array.from(scope.querySelectorAll?.(MENU_ITEM_SELECTOR) || []);

  roots.forEach(setupMenuItem);
}

function observeMenuItems() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        if (mutation.target.matches(MENU_ITEM_SELECTOR)) {
          initMenuItem(mutation.target);
        }
        return;
      }

      if (
        mutation.target instanceof Element &&
        mutation.target.matches(MENU_ITEM_SELECTOR) &&
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) => node instanceof Element && node.matches('.sf-menu'),
        )
      ) {
        initMenuItem(mutation.target);
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        initAllMenuItems(node);
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: OBSERVED_ATTRIBUTES,
  });
}

// A row's branches open under a resting mouse (C30, as sf-menu's open-on
// hover, its default; RG-NV 26): a branch the pointer rests on opens after
// 300 ms; once the pointer has been outside a branch and its panel for
// 500 ms the branch closes. Touch, a pen and the keyboard go through a press,
// as before. The delays are sf-menu's (src/smart/menu: HOVER_OPEN_DELAY,
// HOVER_CLOSE_DELAY); the Framework has no delay tokens.
const HOVER_OPEN_DELAY = 300;
const HOVER_CLOSE_DELAY = 500;
const hoverTimers = new Map();

function hoverRow(node) {
  const row = node instanceof Element ? node.closest('.sf-menu.sf-menu--horizontal') : null;
  if (!row || isOwned(row)) return null;
  // The outermost row: a panel's list is a .sf-menu too.
  let root = row;
  for (let up = root.parentElement?.closest('.sf-menu.sf-menu--horizontal'); up; up = up.parentElement?.closest('.sf-menu.sf-menu--horizontal')) root = up;
  return root;
}

// The branches a node stands in, innermost first, inside its row.
function hoverChain(node, row) {
  const chain = [];
  for (let item = node instanceof Element ? node.closest('.sf-menu-item') : null; item && row.contains(item); item = item.parentElement?.closest('.sf-menu-item')) {
    if (hasSubmenu(item)) chain.push(item);
  }
  return chain;
}

function clearHoverTimer(item, kind) {
  const timer = hoverTimers.get(item);
  if (!timer || (kind && timer.kind !== kind)) return;
  clearTimeout(timer.id);
  hoverTimers.delete(item);
}

function setHoverTimer(item, kind, delay, run) {
  const timer = hoverTimers.get(item);
  if (timer?.kind === kind) return;
  clearHoverTimer(item);
  hoverTimers.set(item, {kind, id: setTimeout(() => {
    hoverTimers.delete(item);
    if (item.isConnected) run();
  }, delay)});
}

function onMenuPointerOver(event) {
  if (event.pointerType !== 'mouse') return;
  const row = hoverRow(event.target);
  if (!row) return;
  const chain = hoverChain(event.target, row);
  for (const [item, timer] of [...hoverTimers]) {
    if (!row.contains(item)) continue;
    if ((timer.kind === 'close' && chain.includes(item)) || (timer.kind === 'open' && !chain.includes(item))) clearHoverTimer(item);
  }
  const [branch] = chain;
  if (!branch || branch.classList.contains('open') || branch.classList.contains('disabled') || branch.hasAttribute('disabled')) return;
  setHoverTimer(branch, 'open', HOVER_OPEN_DELAY, () => setMenuItemOpen(branch, true));
}

function onMenuPointerOut(event) {
  if (event.pointerType !== 'mouse') return;
  const row = hoverRow(event.target);
  if (!row) return;
  const next = event.relatedTarget instanceof Node && row.contains(event.relatedTarget) ? hoverChain(event.relatedTarget, row) : [];
  for (const [item, timer] of [...hoverTimers]) {
    if (timer.kind === 'open' && row.contains(item) && !next.includes(item)) clearHoverTimer(item);
  }
  for (const item of row.querySelectorAll('.sf-menu-item.open')) {
    if (next.includes(item) || isGroup(item)) continue;
    setHoverTimer(item, 'close', HOVER_CLOSE_DELAY, () => {
      if (item.classList.contains('open')) setMenuItemOpen(item, false);
    });
  }
}

function bindMenuEvents() {
  if (document.body.dataset[EVENTS_BOUND_FLAG] === 'true') return;

  document.body.dataset[EVENTS_BOUND_FLAG] = 'true';
  document.addEventListener('pointerover', onMenuPointerOver);
  document.addEventListener('pointerout', onMenuPointerOut);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    document.querySelectorAll('.sf-menu.sf-menu--horizontal > .sf-menu-item.open').forEach((root) => {
      if (!isOwned(root) && !root.contains(target)) setMenuItemOpen(root, false);
    });
    if (isOwned(target)) return;

    const groupHeading = target.closest('.sf-menu-item > button.sf-menu-group-heading');
    if (groupHeading) {
      const group = groupHeading.parentElement;
      if (isGroup(group)) toggleMenuItem(group);
      return;
    }

    const button = target.closest('.sf-menu-item > .sf-menu-element > .sf-icon-button');
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenuItem(button.closest('.sf-menu-item'));
      return;
    }

    const element = target.closest('.sf-menu-item > .sf-menu-element');
    if (!element) return;
    if (target.closest('.sf-icon-button')) return;
    if (target.closest('a[href], button, input, select, textarea') !== element) return;

    toggleMenuItem(element.closest('.sf-menu-item'));
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || isOwned(target)) return;

    if (event.key === 'Escape') {
      const root = target.closest('.sf-menu-item.open');
      if (!root || !root.closest('.sf-menu.sf-menu--horizontal')) return;
      event.preventDefault();
      setMenuItemOpen(root, false);
      getDisclosureController(root)?.focus();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;

    const element = target.closest('.sf-menu-item > .sf-menu-element');
    if (!element) return;
    const nestedInteractive = target.closest('a[href], button, input, select, textarea');
    if (nestedInteractive && nestedInteractive !== element && !nestedInteractive.classList.contains('sf-icon-button')) return;

    const root = element.closest('.sf-menu-item');
    if (!hasSubmenu(root)) return;
    event.preventDefault();
    toggleMenuItem(root);
  });
}

function bootMenuItems() {
  initAllMenuItems(document);
  observeMenuItems();
  bindMenuEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMenuItems, { once: true });
} else {
  bootMenuItems();
}

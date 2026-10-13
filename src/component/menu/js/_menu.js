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
let submenuId = 0;

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

    level += 1;
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
    if (candidate === root || !candidate.matches('.sf-menu-item.open')) return;
    setMenuItemOpen(candidate, false);
  });
}

// Closing any horizontal item closes (and releases the anchored flyouts of)
// everything open inside it, deepest first.
function closeHorizontalDescendants(root) {
  if (!root?.closest('.sf-menu.sf-menu--horizontal')) return;

  Array.from(root.querySelectorAll('.sf-menu-item.open')).reverse().forEach((candidate) => {
    setMenuItemOpen(candidate, false);
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
  const anchor = positioning().anchor(root, submenu, {
    side: topLevel ? 'block-end' : 'inline-end', align: 'start', offset: 0, fitHeight: true,
  });
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

function ensureSubmenuId(submenu) {
  if (!submenu.id) {
    submenuId += 1;
    submenu.id = `sf-menu-submenu-${submenuId}`;
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
  const trailingIcon =
    root.getAttribute('trailing-icon') ||
    (horizontalTopLevel
      ? (expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down')
      : (expanded ? 'keyboard_arrow_down' : 'chevron_right'));

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
  if (!root) return;

  if (root.hasAttribute('expanded')) legacyExpandedOwners.add(root);

  const expanded = isExpanded(root);
  const isBranch = hasSubmenu(root);
  const element = ensureElement(root, isBranch);
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

function bindMenuEvents() {
  if (document.body.dataset[EVENTS_BOUND_FLAG] === 'true') return;

  document.body.dataset[EVENTS_BOUND_FLAG] = 'true';

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    document.querySelectorAll('.sf-menu.sf-menu--horizontal > .sf-menu-item.open').forEach((root) => {
      if (!root.contains(target)) setMenuItemOpen(root, false);
    });

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
    if (!(target instanceof Element)) return;

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

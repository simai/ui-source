import { followLanguage, language, pageText } from '../../../core/js/page-language';
import { collapseRange, menuEntries, nextFit, starvedFit, trailOverflows, trailStarved } from './_trail';
// The words live in the component's language files (localization study LC-4):
// one place for every language, as the Smart components keep them.
import LANG_WORDS from '../lang/index.mjs';

// The ordinary runtime of the class markup a server prints (nav.sf-breadcrumbs):
// it folds a long trail behind one «…» button and opens it again in place.
// Which crumbs fold is _trail.js, shared with sf-breadcrumbs (R177 BC-11): a
// cap (data-max-items, when the page sets one) and room (BC-06, owner decision
// C93 item 1) -- while the trail takes more than one line, one more crumb goes.
//
// Two forms of the markup are read:
//   - the list form (R177 BC-09): nav.sf-breadcrumbs > ol > li, each li one
//     crumb with the separator before it (none in the first);
//   - the flat form: nav.sf-breadcrumbs > crumb, separator, crumb ...
const ROOT_SELECTOR = '.sf-breadcrumbs';
const BREADCRUMBS_TEXT = LANG_WORDS;
const ITEM_SELECTOR = '.sf-breadcrumbs-item';
const GENERATED_SELECTOR = '[data-sf-breadcrumbs-generated="ellipsis"]';
const BOUND_KEY = '__sfBreadcrumbsBound';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]';

function getMaxItems(root) {
  const value =
    root.getAttribute('data-max-items') ||
    root.getAttribute('max-items') ||
    root.dataset.maxItems;
  const maxItems = Number(value);

  // No cap unless the page sets one: a trail folds when it has no room
  // (owner decision C93 item 1), not by a count.
  return Number.isFinite(maxItems) ? Math.max(0, Math.floor(maxItems)) : 0;
}

function getExpandLabel(root) {
  return (
    root.getAttribute('data-expand-label') ||
    root.getAttribute('expand-label') ||
    pageText(BREADCRUMBS_TEXT, 'expandLabel', root, 'sf-breadcrumbs')
  );
}

function getItemLabel(item) {
  return String(item.textContent || '').trim();
}

function isSeparator(item) {
  if (!(item instanceof HTMLElement)) {
    return false;
  }

  if (
    item.classList.contains('sf-breadcrumbs-item--separator') ||
    item.dataset.sfBreadcrumbSeparator === 'true'
  ) {
    return true;
  }

  if (!item.classList.contains('sf-breadcrumbs-item--default')) {
    return false;
  }

  const label = getItemLabel(item);

  return label === 'chevron_right' || label === 'chevron_rightchevron_right';
}

function isGenerated(item) {
  return item?.matches?.(GENERATED_SELECTOR);
}

// The list of the list form, or null for the flat form.
function getList(root) {
  return (
    Array.from(root.children).find(
      (child) => child.tagName === 'OL' || child.tagName === 'UL',
    ) || null
  );
}

function getBreadcrumbNodes(root) {
  return Array.from(root.children).filter(
    (child) =>
      child instanceof HTMLElement &&
      child.matches(ITEM_SELECTOR) &&
      !isGenerated(child),
  );
}

// The crumbs, in order: the list's entries, or the flat form's items.
function getContentItems(root) {
  const list = getList(root);

  if (list) {
    return Array.from(list.children).filter(
      (child) => child.tagName === 'LI' && !isGenerated(child),
    );
  }

  return getBreadcrumbNodes(root).filter((item) => !isSeparator(item));
}

// What takes room in a line: the list's entries, or every flat child.
function getLineEntries(root) {
  const list = getList(root);
  return Array.from((list || root).children);
}

function getPreviousSeparator(item) {
  let current = item.previousElementSibling;

  while (current && isGenerated(current)) {
    current = current.previousElementSibling;
  }

  return isSeparator(current) ? current : null;
}

function clearGenerated(root) {
  root.querySelectorAll(GENERATED_SELECTOR).forEach((node) => node.remove());
}

function setCollapsedState(root, collapsedItems = []) {
  const collapsedSet = new Set(collapsedItems);

  if (getList(root)) {
    getContentItems(root).forEach((entry) => {
      entry.hidden = collapsedSet.has(entry);
    });
    return;
  }

  getBreadcrumbNodes(root).forEach((node) => {
    const shouldHide =
      collapsedSet.has(node) ||
      collapsedItems.some((item) => getPreviousSeparator(item) === node);

    node.hidden = shouldHide;
  });
}

function createSeparator(tag = 'div') {
  const separator = document.createElement(tag);
  separator.className =
    'sf-breadcrumbs-item sf-breadcrumbs-item--default sf-breadcrumbs-item--separator';
  separator.dataset.sfBreadcrumbsGenerated = 'ellipsis';
  separator.dataset.sfBreadcrumbSeparator = 'true';
  separator.setAttribute('aria-hidden', 'true');
  separator.innerHTML =
    '<span class="sf-breadcrumbs-item-container"><i class="sf-icon" aria-hidden="true">chevron_right</i></span>';

  return separator;
}

function createEllipsis(root, hiddenItems) {
  const ellipsis = document.createElement('button');
  ellipsis.type = 'button';
  ellipsis.className =
    'sf-breadcrumbs-item sf-breadcrumbs-item--link sf-breadcrumbs-item--default';
  ellipsis.dataset.sfBreadcrumbsGenerated = 'ellipsis';
  ellipsis.dataset.sfBreadcrumbIndex = 'ellipsis';
  ellipsis.setAttribute('aria-label', getExpandLabel(root));
  ellipsis.setAttribute('aria-expanded', 'false');
  // «…» opens its crumbs as a menu (owner decision C93 item 1; RG-NV 3): the
  // Loader brings sf-menu-context when the trail first folds (requestMenu).
  // Only a page with neither the element nor the Loader opens the trail in
  // place.
  if (menuReady() || menuReachable()) ellipsis.setAttribute('aria-haspopup', 'menu');
  ellipsis.innerHTML =
    '<span class="sf-breadcrumbs-item-container"><span aria-hidden="true">…</span></span>';

  ellipsis.addEventListener('click', async (event) => {
    const clickEvent = new CustomEvent('sf-breadcrumb-click', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {
        root,
        item: {
          label: '...',
          ellipsis: true,
          hiddenItems,
        },
        index: 'ellipsis',
        items: getContentItems(root),
        originalEvent: event,
      },
    });

    root.dispatchEvent(clickEvent);

    if (clickEvent.defaultPrevented) {
      return;
    }

    if (menuReady() || (await requestMenu())) {
      if (ellipsis.isConnected) openHiddenMenu(root, ellipsis, hiddenItems);
      return;
    }

    expandBreadcrumbs(root, hiddenItems[0]);
  });

  return ellipsis;
}

function menuReady() {
  return Boolean(globalThis.customElements?.get?.('sf-menu-context'));
}

// Whether the Loader can bring sf-menu-context (SF.Loader.ensure: asked for,
// waited for up to 3 s, never thrown), as the row engine's «Ещё» asks for it
// (core/js/overflow-row.js standardMenu).
function menuReachable() {
  return typeof globalThis.SF?.Loader?.ensure === 'function';
}

// Asks the Loader for sf-menu-context; true once the element is defined.
// Asked when a trail folds, so the menu is there by the time «…» is pressed.
let menuRequest = null;
function requestMenu() {
  if (menuReady()) return Promise.resolve(true);
  if (!menuReachable()) return Promise.resolve(false);
  menuRequest ||= Promise.resolve()
    .then(() => globalThis.SF.Loader.ensure(['sf-menu-context']))
    .catch(() => null)
    .then(() => {
      const ready = menuReady();
      if (!ready) menuRequest = null;
      return ready;
    });
  return menuRequest;
}

// A hidden crumb as a menu entry: its words and its address.
// A menu row says the crumb's name: its aria-label when it has one (an
// icon-only home crumb is named so), else its words without the icon's
// ligature; the icon goes along as the row's icon.
function crumbOf(entry) {
  const link = entry.matches?.('a[href]') ? entry : entry.querySelector?.('a[href]');
  const container = entry.querySelector?.('.sf-breadcrumbs-item-container') || entry;
  const icon = container.querySelector?.(':scope > :is(.sf-icon, sf-icon)');
  const named = (link || entry.querySelector?.('[aria-label]') || entry).getAttribute?.('aria-label');
  let words = '';
  container.childNodes.forEach((node) => {
    if (node !== icon) words += node.textContent || '';
  });
  const crumb = {
    label: String(named || '').trim() || words.trim() || getItemLabel(container),
    href: link?.getAttribute('href') || '',
  };
  const glyph = String(icon?.getAttribute?.('name') || icon?.textContent || '').trim();
  if (glyph) crumb.icon = glyph;
  return crumb;
}

// One menu per trail, after it; the menu owns aria-expanded on «…» and gives
// focus back to it when it closes.
function openHiddenMenu(root, anchor, hiddenItems) {
  let menu = root.__sfBreadcrumbsMenu;
  if (!menu?.isConnected) {
    menu = document.createElement('sf-menu-context');
    menu.setAttribute('popup', '');
    menu.dataset.sfBreadcrumbsGenerated = 'menu';
    root.after(menu);
    root.__sfBreadcrumbsMenu = menu;
  }
  menu.setAttribute('aria-label', getExpandLabel(root));
  menu.entries = menuEntries(hiddenItems.map(crumbOf));
  menu.toggleFor?.(anchor, { align: 'start' });
}

// A crumb's name is a <span> in its container (RG-NV 1): the sheet cuts a
// long ancestor with an ellipsis (C93 item 6), keeps the page's name on one
// cut line on the phone (C93 item 2) and underlines a link's words under the
// pointer (C186 (1)) on that <span>. Markup that prints the name straight
// into the container (the docs' examples did) wrapped to two lines and lost
// all three; the runtime wraps such bare words, so both spellings draw alike.
const LABEL_MARK = 'sfBreadcrumbsLabel';

function wrapLabels(root) {
  root.querySelectorAll(`${ITEM_SELECTOR} > .sf-breadcrumbs-item-container`).forEach((container) => {
    const runs = [];
    let run = [];
    container.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        run.push(node);
        return;
      }
      if (run.length) runs.push(run);
      run = [];
    });
    if (run.length) runs.push(run);
    runs.forEach((nodes) => {
      const text = nodes.map((node) => node.nodeValue).join('');
      if (!text.trim()) return;
      const label = document.createElement('span');
      label.dataset[LABEL_MARK] = '';
      nodes[0].before(label);
      nodes.forEach((node) => label.append(node));
      if (label.firstChild?.nodeType === Node.TEXT_NODE) {
        label.firstChild.nodeValue = label.firstChild.nodeValue.replace(/^\s+/u, '');
      }
      if (label.lastChild?.nodeType === Node.TEXT_NODE) {
        label.lastChild.nodeValue = label.lastChild.nodeValue.replace(/\s+$/u, '');
      }
    });
  });
}

// The runtime's own wrapping (a bare name put in a <span>) is no change of
// the trail: it does not fold the trail again.
function isLabelWrap(mutation) {
  if (mutation.type !== 'childList') return false;
  if (!mutation.target?.classList?.contains?.('sf-breadcrumbs-item-container')) return false;
  const added = Array.from(mutation.addedNodes);
  const removed = Array.from(mutation.removedNodes);
  return (
    added.every((node) => node instanceof HTMLElement && LABEL_MARK in node.dataset) &&
    removed.every((node) => node.nodeType === Node.TEXT_NODE)
  );
}

// A name cut with an ellipsis (C93 item 6) has its whole text as the
// crumb's tooltip.
function markCutLabels(root) {
  root.querySelectorAll(`${ITEM_SELECTOR}:not(.sf-breadcrumbs-item--separator)`).forEach((crumb) => {
    const label = crumb.querySelector(':scope > .sf-breadcrumbs-item-container > span') ||
      crumb.querySelector(':scope > .sf-breadcrumbs-item-container');
    const cut = Boolean(label && label.scrollWidth > label.clientWidth + 1);
    if (cut) {
      crumb.setAttribute('title', label.textContent.trim());
      crumb.dataset.sfBreadcrumbCut = '';
    } else if ('sfBreadcrumbCut' in crumb.dataset) {
      crumb.removeAttribute('title');
      delete crumb.dataset.sfBreadcrumbCut;
    }
  });
}

// The «…» button left the page: focus goes to the first crumb it revealed
// (R177 BC-02), not to the body. A crumb that is text takes focus as a
// target only (tabindex -1), so the keyboard path goes on from there.
function focusRevealed(root, first) {
  if (!first?.isConnected) return;

  const target = first.matches?.(FOCUSABLE)
    ? first
    : first.querySelector?.(FOCUSABLE) || first.querySelector?.(ITEM_SELECTOR) || first;

  if (!target.matches(FOCUSABLE)) target.setAttribute('tabindex', '-1');
  target.focus?.({ preventScroll: true });
}

function expandBreadcrumbs(root, firstHidden = null) {
  const hadFocus = root.contains(document.activeElement);
  root.dataset.sfBreadcrumbsExpanded = 'true';
  clearGenerated(root);
  setCollapsedState(root, []);
  if (hadFocus || document.activeElement === document.body) {
    focusRevealed(root, firstHidden);
  }
}

function applyRange(root, items, range) {
  clearGenerated(root);
  setCollapsedState(root, []);

  if (!range) return;

  const hiddenItems = items.slice(range.start, range.end);

  if (!hiddenItems.length) return;

  setCollapsedState(root, hiddenItems);

  const list = getList(root);
  const firstHidden = hiddenItems[0];
  const ellipsis = createEllipsis(root, hiddenItems);
  requestMenu();

  if (list) {
    // One entry for «…», with the separator before it unless it opens the trail.
    const entry = document.createElement('li');
    entry.dataset.sfBreadcrumbsGenerated = 'ellipsis';
    if (range.start > 0) entry.append(createSeparator('span'));
    entry.append(ellipsis);
    list.insertBefore(entry, firstHidden);
    return;
  }

  const lastHidden = hiddenItems[hiddenItems.length - 1];
  const insertionTarget = lastHidden.nextElementSibling;

  // «…» opens the trail when the first crumb is hidden too: the separator of
  // the next visible crumb follows it, and none goes before it.
  if (range.start > 0) root.insertBefore(createSeparator(), firstHidden);
  root.insertBefore(ellipsis, insertionTarget);
}

// Whether the last crumb is the page (it stays with its parent).
function getTail(items) {
  const last = items[items.length - 1];
  const current =
    last?.getAttribute?.('aria-current') === 'page' ||
    Boolean(last?.querySelector?.('[aria-current="page"]'));
  return current ? 2 : 1;
}

function collapseBreadcrumbs(root) {
  const maxItems = getMaxItems(root);
  const items = getContentItems(root);

  wrapLabels(root);
  clearGenerated(root);
  setCollapsedState(root, []);

  if (root.dataset.sfBreadcrumbsExpanded === 'true') {
    return;
  }

  let tail = getTail(items);
  // Room only, on every ladder (C93 item 1; L1 of the C93 review): the whole
  // trail first, then one more crumb at a time while the row has no room.
  // Folded as far as that goes, a crumb cut below a few letters takes the
  // parent with it: «… › current» (starvedFit, N1 of the nav-4b acceptance).
  let fit = 0;

  applyRange(root, items, collapseRange(items.length, { maxItems, fit, tail }));

  while (trailOverflows(getList(root) || root, getLineEntries(root))) {
    const next = nextFit(items.length, { maxItems, fit, tail });
    if (next !== null) {
      fit = next;
    } else {
      const last = trailStarved(getLineEntries(root)) ? starvedFit(items.length, { tail }) : null;
      if (!last) break;
      ({ tail, fit } = last);
    }
    applyRange(root, items, collapseRange(items.length, { maxItems, fit, tail }));
  }

  markCutLabels(root);
  root.__sfBreadcrumbsSettled = settledSize(root);
}

function settledSize(root) {
  const parent = root.parentElement;
  return {
    width: parent ? parent.getBoundingClientRect().width : 0,
    height: root.getBoundingClientRect().height,
  };
}

// A new width (or a font that came late and changed the words) folds the
// trail again; the trail's own change of size does not.
function observeRoom(root) {
  if (typeof ResizeObserver === 'undefined' || root.__sfBreadcrumbsRoom) return;

  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!root.isConnected) {
        observer.disconnect();
        root.__sfBreadcrumbsRoom = null;
        return;
      }
      const before = root.__sfBreadcrumbsSettled;
      const now = settledSize(root);
      if (
        before &&
        Math.abs(before.width - now.width) < 0.5 &&
        Math.abs(before.height - now.height) < 0.5
      ) {
        return;
      }
      collapseBreadcrumbs(root);
    });
  });

  observer.observe(root);
  if (root.parentElement) observer.observe(root.parentElement);
  root.__sfBreadcrumbsRoom = observer;
}

function bindBreadcrumbs(root) {
  if (!(root instanceof HTMLElement) || root[BOUND_KEY]) {
    return;
  }
  // sf-breadcrumbs draws its own trail and its own «…». Collapsing it here too
  // undid every expansion: the element expanded the trail, this script saw the
  // new items and folded them back behind a second «…» of its own.
  if (root.closest('sf-breadcrumbs')) {
    return;
  }

  root[BOUND_KEY] = true;
  collapseBreadcrumbs(root);
  observeRoom(root);
}

// «…» and its menu are named in the page's language when it is read, not when
// the trail folded: the language file may arrive after the trail was drawn
// (a bundle before core.js, a slow network), the page may choose another
// language or change a lang (VS-SITE-4: «Show hidden breadcrumbs» stayed on a
// Russian page). One listener for the page; aria-label is not an attribute
// the trail's observer folds again for.
function relabel(root) {
  if (!root?.isConnected || !root[BOUND_KEY]) return;
  const label = getExpandLabel(root);
  root.querySelectorAll('[data-sf-breadcrumb-index="ellipsis"]').forEach((ellipsis) => {
    if (ellipsis.getAttribute('aria-label') !== label) ellipsis.setAttribute('aria-label', label);
  });
  const menu = root.__sfBreadcrumbsMenu;
  if (menu?.isConnected && menu.getAttribute('aria-label') !== label) menu.setAttribute('aria-label', label);
}

function relabelAll() {
  document.querySelectorAll(ROOT_SELECTOR).forEach(relabel);
}

language.onChange(relabelAll);
if (document.documentElement) followLanguage(document.documentElement, relabelAll);

function initBreadcrumbs(target = document) {
  if (target instanceof HTMLElement && target.matches(ROOT_SELECTOR)) {
    bindBreadcrumbs(target);
  }

  target.querySelectorAll?.(ROOT_SELECTOR).forEach(bindBreadcrumbs);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initBreadcrumbs(document));
} else {
  initBreadcrumbs(document);
}

if (typeof MutationObserver !== 'undefined') {
  new MutationObserver((mutations) => {
    // A node added and gone again before the records arrive is a measuring
    // probe (core/js/position.js puts a span into the anchor's parent while a
    // menu opens for «…»): it is no crumb, and folding the trail again for it
    // took the anchor out from under the open menu.
    const transient = new Set();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!node.isConnected) transient.add(node);
      });
    });

    mutations.forEach((mutation) => {
      if (isLabelWrap(mutation)) return;

      if (mutation.type === 'attributes') {
        const root = mutation.target;

        if (root instanceof HTMLElement && root.matches(ROOT_SELECTOR) && root[BOUND_KEY]) {
          delete root.dataset.sfBreadcrumbsExpanded;
          collapseBreadcrumbs(root);
        }

        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || isGenerated(node) || transient.has(node)) {
          return;
        }

        initBreadcrumbs(node);

        const root = node.closest?.(ROOT_SELECTOR);
        if (root instanceof HTMLElement && root[BOUND_KEY]) {
          delete root.dataset.sfBreadcrumbsExpanded;
          collapseBreadcrumbs(root);
        }
      });

      const changedByRemoval = Array.from(mutation.removedNodes).some(
        (node) => !isGenerated(node) && !transient.has(node),
      );
      const mutationRoot = mutation.target.closest?.(ROOT_SELECTOR);

      if (
        changedByRemoval &&
        mutationRoot instanceof HTMLElement &&
        mutationRoot[BOUND_KEY]
      ) {
        delete mutationRoot.dataset.sfBreadcrumbsExpanded;
        collapseBreadcrumbs(mutationRoot);
      }
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-max-items', 'max-items', 'data-expand-label', 'expand-label'],
  });
}

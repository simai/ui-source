import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

const TREE_SELECTOR = '.sf-tree';
const TREE_ITEM_SELECTOR = '.sf-tree-item';
const TREE_GROUP_SELECTOR = '.sf-tree-group';
const TREE_BOUND_FLAG = 'sfTreeBound';
const treeTypeahead = new WeakMap();

// The vocabulary's names (simai.smart-vocabulary 1.1.5 §5.1: sf-tree:toggle ->
// sf-tree-toggle, sf-tree:activate -> sf-tree-open, sf-tree:selection-change ->
// sf-tree-select), the names sf-tree sends. A class tree sends the new name
// first, data only, then the old one with its old detail until 2026-12-01.
function sendBoth(target, name, detail, oldName, oldDetail) {
  target.dispatchEvent(new CustomEvent(name, {bubbles: true, detail}));
  target.dispatchEvent(new CustomEvent(oldName, {bubbles: true, detail: oldDetail}));
}

const valueOf = (item) => item?.getAttribute?.('data-value') || '';

function isSmartTreeRoot(root) {
  return Boolean(root?.closest?.('sf-tree'));
}

function getItemContainer(item) {
  return item?.querySelector?.(':scope > .sf-tree-item-container') || null;
}

function getNestedItems(item) {
  const group = Array.from(item?.children || []).find((child) =>
    child.classList?.contains('sf-tree-group'),
  );
  const owner = group || item;

  return Array.from(owner?.children || []).filter((child) =>
    child.classList?.contains('sf-tree-item'),
  );
}

function getParentItem(item, root) {
  const group = item?.parentElement?.closest?.(TREE_GROUP_SELECTOR);
  const parent = group?.parentElement?.closest?.(TREE_ITEM_SELECTOR);

  return parent && root.contains(parent) ? parent : null;
}

function getDirectItems(root) {
  return Array.from(root?.children || []).filter((child) =>
    child.classList?.contains('sf-tree-item'),
  );
}

function getItemLabel(item) {
  return (
    getItemContainer(item)
      ?.querySelector?.(':scope > .sf-tree-item-name')
      ?.textContent?.replace(/\s+/g, ' ')
      ?.trim() || ''
  );
}

function getVisibleItems(root) {
  const result = [];

  const visit = (items, visible = true) => {
    items.forEach((item) => {
      if (!visible) return;
      result.push(item);
      visit(getNestedItems(item), item.classList.contains('open'));
    });
  };

  visit(getDirectItems(root));
  return result;
}

function setTabStop(root, item, focus = false) {
  const visible = getVisibleItems(root);
  const next = visible.includes(item) ? item : visible[0] || null;

  root.querySelectorAll(TREE_ITEM_SELECTOR).forEach((candidate) => {
    candidate.tabIndex = candidate === next ? 0 : -1;
  });

  if (focus) next?.focus?.();
  return next;
}

function isBranch(item) {
  return getNestedItems(item).length > 0;
}

function getToggleButton(item) {
  const container = getItemContainer(item);
  return container?.querySelector?.(':scope > .sf-icon-button') || null;
}

function getButtonIcon(item) {
  return getToggleButton(item)?.querySelector?.('.sf-icon') || null;
}

function getChevronIcon(item) {
  const container = getItemContainer(item);
  return (
    container?.querySelector?.(':scope > .sf-tree-chevron .sf-icon') || null
  );
}

function getOpenIcon(item) {
  return item.getAttribute('data-open-icon') || 'folder_open';
}

function getClosedIcon(item) {
  return item.getAttribute('data-closed-icon') || 'folder';
}

function setIconText(icon, value) {
  if (icon) {
    icon.textContent = value;
  }
}

// Nested items may be written straight inside their parent item, and the tree
// reads them either way. Only a .sf-tree-group gets role="group" and the nested
// indent, though, so items written straight inside were a treeitem owned by a
// treeitem -- not allowed, and announced without their level -- and sat flush
// with their parent. They are gathered into a group once, which makes both ways
// of writing a tree the same tree.
function ensureTreeGroup(item) {
  const direct = Array.from(item.children || []).filter((child) => child.classList?.contains('sf-tree-item'));
  if (!direct.length) return;
  let group = Array.from(item.children).find((child) => child.classList?.contains('sf-tree-group'));
  if (!group) {
    group = document.createElement('div');
    group.className = 'sf-tree-group';
    direct[0].before(group);
  }
  group.append(...direct);
}

function syncTreeItem(item) {
  if (!(item instanceof HTMLElement)) return;

  ensureTreeGroup(item);
  const branch = isBranch(item);
  const open = item.classList.contains('open') || item.hasAttribute('open');
  const activeOpen = branch && open;
  const button = getToggleButton(item);

  item.classList.toggle('has-children', branch);
  item.classList.toggle('open', activeOpen);
  item.toggleAttribute('open', activeOpen);

  if (branch) {
    item.setAttribute('aria-expanded', String(activeOpen));
  } else {
    item.removeAttribute('aria-expanded');
  }

  item.setAttribute('role', 'treeitem');

  const group = Array.from(item.children || []).find((child) =>
    child.classList?.contains('sf-tree-group'),
  );
  group?.setAttribute('role', 'group');

  if (button) {
    button.type = button.getAttribute('type') || 'button';
    button.setAttribute('aria-expanded', branch ? String(activeOpen) : 'false');
    button.toggleAttribute('disabled', !branch);
  }

  setIconText(getButtonIcon(item), activeOpen ? getOpenIcon(item) : getClosedIcon(item));
  setIconText(
    getChevronIcon(item),
    activeOpen ? 'keyboard_arrow_down' : 'chevron_right',
  );
}

function syncTree(root) {
  if (isSmartTreeRoot(root)) return;

  root.querySelectorAll(TREE_ITEM_SELECTOR).forEach(syncTreeItem);
  const current = root.querySelector(`${TREE_ITEM_SELECTOR}[tabindex="0"]`);
  setTabStop(root, current);
}

function setTreeItemOpen(item, open = true) {
  if (!(item instanceof HTMLElement) || !isBranch(item)) return false;

  item.classList.toggle('open', open);
  item.toggleAttribute('open', open);
  syncTreeItem(item);

  sendBoth(item, 'sf-tree-toggle', {id: valueOf(item), open, value: valueOf(item)}, 'sf-tree:toggle', {item, open});

  return true;
}

function toggleTreeItem(item) {
  return setTreeItemOpen(item, !item.classList.contains('open'));
}

function activateTreeItem(item) {
  if (!item || item.matches('.disabled, [aria-disabled="true"]')) return;

  const name = getItemContainer(item)?.querySelector?.(
    ':scope > .sf-tree-item-name',
  );

  if (name?.matches?.('a[href]')) {
    name.click();
    return;
  }

  sendBoth(item, 'sf-tree-open', {id: valueOf(item), value: valueOf(item)}, 'sf-tree:activate', { item, value: item.getAttribute('data-value') || '' });
}

function selectTreeItem(root, item) {
  const mode = root.getAttribute('data-selection') || 'none';
  if (!['single', 'multiple'].includes(mode)) {
    activateTreeItem(item);
    return;
  }

  const nextSelected =
    mode === 'multiple' ? item.getAttribute('aria-selected') !== 'true' : true;

  if (mode === 'single') {
    root.querySelectorAll(TREE_ITEM_SELECTOR).forEach((candidate) => {
      const selected = candidate === item;
      candidate.classList.toggle('active', selected);
      candidate.setAttribute('aria-selected', String(selected));
    });
  } else {
    item.classList.toggle('active', nextSelected);
    item.setAttribute('aria-selected', String(nextSelected));
  }

  const ids = Array.from(root.querySelectorAll(`${TREE_ITEM_SELECTOR}[aria-selected="true"]`)).map(valueOf);
  sendBoth(root, 'sf-tree-select', {ids, id: valueOf(item), selected: nextSelected}, 'sf-tree:selection-change', {
    item,
    selected: nextSelected,
    value: item.getAttribute('data-value') || '',
  });
}

function moveTreeTypeahead(root, item, key) {
  const previous = treeTypeahead.get(root) || { value: '', timer: null };
  clearTimeout(previous.timer);
  const value = `${previous.value}${key}`.toLocaleLowerCase();
  const timer = setTimeout(() => treeTypeahead.delete(root), 500);
  treeTypeahead.set(root, { value, timer });

  const visible = getVisibleItems(root);
  const start = Math.max(visible.indexOf(item), 0);
  const ordered = visible.slice(start + 1).concat(visible.slice(0, start + 1));
  const match = ordered.find((candidate) =>
    getItemLabel(candidate).toLocaleLowerCase().startsWith(value),
  );

  if (match) setTabStop(root, match, true);
}

function handleTreeKeydown(root, event) {
  const item = event.target.closest?.(TREE_ITEM_SELECTOR);
  if (!item || !root.contains(item)) return;

  const visible = getVisibleItems(root);
  const index = visible.indexOf(item);
  if (index < 0) return;

  let target = null;
  let handled = true;

  switch (event.key) {
    case 'ArrowDown':
      target = visible[Math.min(index + 1, visible.length - 1)];
      break;
    case 'ArrowUp':
      target = visible[Math.max(index - 1, 0)];
      break;
    case 'Home':
      target = visible[0];
      break;
    case 'End':
      target = visible[visible.length - 1];
      break;
    case 'ArrowRight': {
      const children = getNestedItems(item);
      if (children.length && !item.classList.contains('open')) {
        setTreeItemOpen(item, true);
      } else {
        target = children[0] || null;
      }
      break;
    }
    case 'ArrowLeft':
      if (isBranch(item) && item.classList.contains('open')) {
        setTreeItemOpen(item, false);
      } else {
        target = getParentItem(item, root);
      }
      break;
    case 'Enter':
      if (isBranch(item)) toggleTreeItem(item);
      else activateTreeItem(item);
      break;
    case ' ':
      selectTreeItem(root, item);
      break;
    default:
      handled = false;
  }

  if (!handled && event.key.length === 1 && !event.altKey && !event.metaKey) {
    moveTreeTypeahead(root, item, event.key);
    handled = true;
  }

  if (!handled) return;
  event.preventDefault();
  event.stopPropagation();
  if (target) setTabStop(root, target, true);
}

function bindTree(root) {
  if (
    !(root instanceof HTMLElement) ||
    root.dataset[TREE_BOUND_FLAG] === '1' ||
    isSmartTreeRoot(root)
  ) {
    return;
  }

  root.setAttribute('role', root.getAttribute('role') || 'tree');
  if (root.getAttribute('data-selection') === 'multiple') {
    root.setAttribute('aria-multiselectable', 'true');
  } else {
    root.removeAttribute('aria-multiselectable');
  }
  syncTree(root);

  root.addEventListener('focusin', (event) => {
    const item = event.target.closest?.(TREE_ITEM_SELECTOR);
    if (item && root.contains(item)) setTabStop(root, item);
  });

  root.addEventListener('keydown', (event) => handleTreeKeydown(root, event));

  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('.sf-icon-button');
    if (!button || !root.contains(button)) return;

    const item = button.closest(TREE_ITEM_SELECTOR);
    if (!item || !root.contains(item)) return;

    const container = getItemContainer(item);
    if (container && !container.contains(button)) return;

    toggleTreeItem(item);
    setTabStop(root, item);
  });

  root.dataset[TREE_BOUND_FLAG] = '1';
}

function initTree(target = document) {
  if (!(target instanceof Element) && target !== document) return;

  if (target instanceof Element && target.matches?.(TREE_SELECTOR)) {
    bindTree(target);
  }

  target.querySelectorAll?.(TREE_SELECTOR).forEach(bindTree);
}

class Tree extends ComponentObserver {
  static componentName = 'Tree';
  html = null;
}

registerComponent('Tree', Tree);

if (typeof window !== 'undefined') {
  window.SF = window.SF || {};
  window.SF.Tree = window.SF.Tree || {};
  window.SF.Tree.init = initTree;
  window.SF.Tree.sync = syncTree;
  window.SF.Tree.open = (item) => setTreeItemOpen(item, true);
  window.SF.Tree.close = (item) => setTreeItemOpen(item, false);
  window.SF.Tree.toggle = toggleTreeItem;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTree(document));
} else {
  initTree(document);
}

const treeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      initTree(node);

      const tree = node.closest?.(TREE_SELECTOR);
      if (tree && !isSmartTreeRoot(tree)) {
        syncTree(tree);
      }
    });
  });
});

treeObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  activateTreeItem,
  getVisibleItems,
  handleTreeKeydown,
  initTree,
  isSmartTreeRoot,
  moveTreeTypeahead,
  selectTreeItem,
  setTabStop,
  setTreeItemOpen,
  syncTree,
  toggleTreeItem,
};

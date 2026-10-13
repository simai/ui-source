import { pageText } from '../../../core/js/page-language';

const ROOT_SELECTOR = '.sf-breadcrumbs';
const BREADCRUMBS_TEXT = {
  en: { expandLabel: 'Show hidden breadcrumbs' },
  ru: { expandLabel: 'Показать скрытые крошки' },
};
const ITEM_SELECTOR = '.sf-breadcrumbs-item';
const GENERATED_SELECTOR = '[data-sf-breadcrumbs-generated="ellipsis"]';
const BOUND_KEY = '__sfBreadcrumbsBound';

function getMaxItems(root) {
  const value =
    root.getAttribute('data-max-items') ||
    root.getAttribute('max-items') ||
    root.dataset.maxItems;
  const maxItems = Number(value);

  return Number.isFinite(maxItems) ? Math.max(0, Math.floor(maxItems)) : 4;
}

function getExpandLabel(root) {
  return (
    root.getAttribute('data-expand-label') ||
    root.getAttribute('expand-label') ||
    pageText(BREADCRUMBS_TEXT, 'expandLabel', root)
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

function getBreadcrumbNodes(root) {
  return Array.from(root.children).filter(
    (child) =>
      child instanceof HTMLElement &&
      child.matches(ITEM_SELECTOR) &&
      !isGenerated(child),
  );
}

function getContentItems(root) {
  return getBreadcrumbNodes(root).filter((item) => !isSeparator(item));
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

  getBreadcrumbNodes(root).forEach((node) => {
    const shouldHide =
      collapsedSet.has(node) ||
      collapsedItems.some((item) => getPreviousSeparator(item) === node);

    node.hidden = shouldHide;
  });
}

function createSeparator() {
  const separator = document.createElement('div');
  separator.className =
    'sf-breadcrumbs-item sf-breadcrumbs-item--default sf-breadcrumbs-item--separator';
  separator.dataset.sfBreadcrumbsGenerated = 'ellipsis';
  separator.dataset.sfBreadcrumbSeparator = 'true';
  separator.setAttribute('aria-hidden', 'true');
  separator.innerHTML =
    '<span class="sf-breadcrumbs-item-container flex items-cross-center"><i class="sf-icon" aria-hidden="true">chevron_right</i></span>';

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
  ellipsis.innerHTML =
    '<span class="sf-breadcrumbs-item-container flex items-cross-center"><span aria-hidden="true">…</span></span>';

  ellipsis.addEventListener('click', (event) => {
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

    expandBreadcrumbs(root);
  });

  return ellipsis;
}

function expandBreadcrumbs(root) {
  root.dataset.sfBreadcrumbsExpanded = 'true';
  clearGenerated(root);
  setCollapsedState(root, []);
}

function collapseBreadcrumbs(root) {
  const maxItems = getMaxItems(root);
  const items = getContentItems(root);

  clearGenerated(root);
  setCollapsedState(root, []);

  if (root.dataset.sfBreadcrumbsExpanded === 'true') {
    return;
  }

  if (maxItems < 3 || items.length <= maxItems) {
    return;
  }

  const visibleSlots = maxItems - 1;
  const leadingCount = Math.floor(visibleSlots / 2);
  const trailingCount = visibleSlots - leadingCount;
  const hiddenItems = items.slice(leadingCount, items.length - trailingCount);

  if (!hiddenItems.length) {
    return;
  }

  setCollapsedState(root, hiddenItems);

  const firstHidden = hiddenItems[0];
  const lastHidden = hiddenItems[hiddenItems.length - 1];
  const insertionTarget = lastHidden.nextElementSibling;
  const separator = createSeparator();
  const ellipsis = createEllipsis(root, hiddenItems);

  root.insertBefore(separator, firstHidden);
  root.insertBefore(ellipsis, insertionTarget);
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
}

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
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const root = mutation.target;

        if (root instanceof HTMLElement && root.matches(ROOT_SELECTOR)) {
          delete root.dataset.sfBreadcrumbsExpanded;
          collapseBreadcrumbs(root);
        }

        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || isGenerated(node)) {
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
        (node) => !isGenerated(node),
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

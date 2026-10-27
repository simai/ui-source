import { createDropdownInteraction, syncDropdownCheckbox } from '../interaction';
import { bindFormReset } from '../../form-reset-helper';
import { openDropdownPortal, positionDropdownPortal, closeDropdownPortal } from '../portal';
import { retireFieldSizeClass } from '../../field-size';
import { holdOpenSurfaceMark } from '../../../core/js/open-surface-mark';

const DROPDOWN_SELECTOR = ".sf-dropdown";
const BOUND_FLAG = "sfDropdownBound";
const CHECKMARK_SELECTOR = ".sf-list-item-selected-item";

// From size 1 up the field has room for a compact tag of its own size, with the
// field's own text. Size 1/2 does not (one pixel would be left), so its tag
// goes one size down onto the field line, rendered inline: its label is one
// text step down and it takes no block padding.
const FIELD_TAG = Object.freeze({
  "1/2": {size: "1/3", spacing: ""},
  "1": {size: "1", spacing: "compact"},
  "2": {size: "2", spacing: "compact"},
});

function isTagDropdown(root) {
  return root.classList.contains("sf-dropdown--tag");
}

function isSmartDropdownRoot(root) {
  const host = root?.closest?.("sf-dropdown");
  return Boolean(host?.__sfSmartElement);
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isMultipleDropdown(root) {
  if (!root) return false;

  if (root.hasAttribute("multiple")) {
    return toBoolean(root.getAttribute("multiple"), true);
  }

  if (root.dataset.multiple !== undefined) {
    return toBoolean(root.dataset.multiple, false);
  }

  return isTagDropdown(root);
}

function isDisabledDropdown(root) {
  if (!root) return false;
  if (root.classList.contains("disabled")) return true;
  if (root.hasAttribute("disabled"))
    return toBoolean(root.getAttribute("disabled"), true);
  return false;
}

function isPortalDropdown(root) {
  if (!root) return false;

  if (root.hasAttribute("portal")) {
    return toBoolean(root.getAttribute("portal"), true);
  }

  if (root.dataset.portal !== undefined) {
    return toBoolean(root.dataset.portal, true);
  }

  // Shared anchored positioning (SF.Position) is the default; portal="false"
  // keeps the legacy in-flow list.
  return true;
}

function getField(root) {
  return root.querySelector(".sf-dropdown-field");
}

function getTriggerInput(root) {
  return root.querySelector(
    ".sf-dropdown-field input:not(.sf-dropdown-hidden-input)",
  );
}

function getList(root) {
  return root.__sfDropdownPortalList || root.querySelector(".sf-list");
}

function getSearchInput(root) {
  return getList(root)?.querySelector(".sf-input input") || null;
}

function getTagContainer(root) {
  return root.querySelector(".sf-dropdown-tag-container");
}

function getHiddenInput(root) {
  return root.querySelector(".sf-dropdown-hidden-input");
}

function getToggleIcon(root) {
  return root.querySelector(".sf-dropdown-field .sf-icon-button .sf-icon");
}

function getListWrap(root) {
  return getList(root)?.querySelector(".sf-list-container-wrap") || null;
}

function getListContainer(root) {
  return getList(root)?.querySelector(".sf-list-container") || null;
}

function getItems(root) {
  return Array.from(getList(root)?.querySelectorAll(".sf-list-item") || []);
}

function containsDropdownTarget(root, target) {
  if (!root || !target) return false;
  if (root.contains(target)) return true;
  return Boolean(root.__sfDropdownPortalList?.contains(target));
}

function positionPortalList(root) {
  if (!root || !isPortalDropdown(root)) return;
  positionDropdownPortal(root,getList(root));
}

function ensurePortalList(root) {
  if (!root || !isPortalDropdown(root)) return;
  const list=getList(root);
  if (!list || !openDropdownPortal(root,list,()=>closeDropdown(root))) return;
  list.__sfDropdownRoot=root;
  if(!root.__sfDropdownPortalClick){
    root.__sfDropdownPortalClick=onRootClick;
    root.__sfDropdownPortalKeydown=onRootKeydown;
    list.addEventListener('click',onRootClick);
    list.addEventListener('keydown',onRootKeydown);
  }
  if (!root.__sfDropdownPortalOnViewportChange) {
    root.__sfDropdownPortalOnViewportChange=()=>{
      if(root.classList.contains('sf-dropdown--open'))positionPortalList(root);
    };
  }
  window.addEventListener('resize',root.__sfDropdownPortalOnViewportChange);
  document.addEventListener('scroll',root.__sfDropdownPortalOnViewportChange,true);
}

function restorePortalList(root) {
  if (!root) return;
  const list=getList(root);
  closeDropdownPortal(list);
  if(list&&root.__sfDropdownPortalClick){
    list.removeEventListener('click',root.__sfDropdownPortalClick);
    list.removeEventListener('keydown',root.__sfDropdownPortalKeydown);
  }
  delete root.__sfDropdownPortalClick;
  delete root.__sfDropdownPortalKeydown;
  if(root.__sfDropdownPortalOnViewportChange){
    window.removeEventListener('resize',root.__sfDropdownPortalOnViewportChange);
    document.removeEventListener('scroll',root.__sfDropdownPortalOnViewportChange,true);
  }
  if(list)delete list.__sfDropdownRoot;
  delete root.__sfDropdownPortalOnViewportChange;
}

function getItemValue(item) {
  return item?.dataset?.value ?? getItemLabel(item);
}

function getItemLabel(item) {
  if (!item) return "";

  const listItemText = item
    .querySelector(".sf-list-item-container")
    ?.textContent?.trim();
  if (listItemText) return listItemText;

  const tagText = item.querySelector(".sf-tag-container")?.textContent?.trim();
  if (tagText) return tagText;

  const avatarText = item
    .querySelector(".sf-avatar-label-group-title")
    ?.textContent?.trim();
  if (avatarText) return avatarText;

  return item.dataset?.value?.trim?.() || item.textContent?.trim() || "";
}

function ensureCheckmark(item) {
  const supportsSelectedIndicator =
    item.classList.contains("sf-list-item--text") ||
    item.classList.contains("sf-list-item--icon");

  if (!supportsSelectedIndicator) return;
  if (!item || item.querySelector(CHECKMARK_SELECTOR)) return;

  const selectedItem = document.createElement("div");
  selectedItem.className = "sf-list-item-selected-item flex";

  const icon = document.createElement("i");
  icon.className = "sf-icon";
  icon.textContent = "check";

  selectedItem.append(icon);
  item.append(selectedItem);
}

function syncSelected(root, selectedItems = []) {
  const selectedSet = new Set(selectedItems);

  getItems(root).forEach((item) => {
    const isSelected = selectedSet.has(item);
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");

    const checkmark = item.querySelector(CHECKMARK_SELECTOR);
    if (isSelected) {
      ensureCheckmark(item);
    } else if (checkmark) {
      checkmark.remove();
    }

    syncDropdownCheckbox(item, isSelected);
  });
  root.__sfDropdownInteraction?.refresh();
}

function syncItemCheckboxInteractivity(root) {
  getItems(root).forEach((item) => {
    const checkboxRoot = item.querySelector(".sf-checkbox");
    const checkbox = item.querySelector(".sf-checkbox input");
    if (!checkboxRoot || !checkbox) return;

    checkbox.tabIndex = -1;
    checkbox.dataset.dropdownManaged = "1";
    checkbox.style.pointerEvents = "none";
    checkboxRoot.style.pointerEvents = "none";

    if (isDisabledDropdown(root) || item.classList.contains("disabled")) {
      checkbox.disabled = true;
    } else {
      checkbox.disabled = false;
    }
  });
}

function createTagNode(root, item) {
  const value = getItemValue(item);
  const label = getItemLabel(item);
  const size = root.className.match(/sf-dropdown--size-([^\s]+)/)?.[1] || "1";
  const fieldTag = FIELD_TAG[size] || FIELD_TAG["1"];
  const tagSize = fieldTag.size;
  const tagSpacing = fieldTag.spacing ? ` spacing-${fieldTag.spacing}` : "";
  const isIconItem = item.classList.contains("sf-list-item--icon");
  const isAvatarItem = item.classList.contains("sf-list-item--avatar");
  const isColorItem = item.classList.contains("sf-list-item--color");
  const isDisabled = isDisabledDropdown(root);
  const tagType = isColorItem ? "color" : isAvatarItem ? "avatar" : "icon";

  const tag = document.createElement("div");
  tag.className = `sf-tag transition sf-tag--${tagType} sf-tag--size-${tagSize} sf-tag--inline${tagSpacing} flex flex-row flex-nowrap items-center active`;
  tag.dataset.value = value;
  if (isDisabled) {
    tag.classList.add("disabled");
    tag.setAttribute("aria-disabled", "true");
  }

  const container = document.createElement("span");
  container.className = "sf-tag-container";
  container.textContent = label;

  if (isColorItem) {
    const colorIcon = item.querySelector(".sf-tag-color-icon");
    const colorNode = document.createElement("span");
    colorNode.className = colorIcon?.className || "sf-tag-color-icon";
    tag.append(colorNode);
  } else if (isAvatarItem) {
    const avatarNode = item.querySelector(".sf-avatar");
    if (avatarNode) {
      tag.append(avatarNode.cloneNode(true));
    }
  } else if (isIconItem) {
    const icon = document.createElement("i");
    icon.className = "sf-icon sf-tag-icon";
    icon.textContent =
      item
        .querySelector(".sf-list-item-wrap > .sf-icon")
        ?.textContent?.trim() || "favorite";
    tag.append(icon);
  }

  tag.append(container);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className =
    "sf-icon-button sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1/3";
  closeButton.setAttribute("aria-label", `Remove ${label}`);
  closeButton.dataset.role = "remove-tag";
  closeButton.dataset.value = value;
  closeButton.disabled = isDisabled;
  closeButton.tabIndex = isDisabled ? -1 : 0;

  const close = document.createElement("div");
  close.className = "sf-close sf-close--size-1/3 flex";

  const closeIcon = document.createElement("div");
  closeIcon.className = "sf-close-icon";

  close.append(closeIcon);
  closeButton.append(close);
  tag.append(closeButton);

  return tag;
}

function syncTags(root) {
  if (!isTagDropdown(root)) return;

  const container = getTagContainer(root);
  if (!container) return;

  container.innerHTML = "";

  getItems(root)
    .filter((item) => item.classList.contains("selected"))
    .forEach((item) => {
      container.append(createTagNode(root, item));
    });
}

function syncHiddenInput(root) {
  const hiddenInput = getHiddenInput(root);
  if (!hiddenInput) return;

  hiddenInput.value = isMultipleDropdown(root)
    ? getSelectedItems(root).map(getItemValue).join(",")
    : root.dataset.selectedValue || "";
  hiddenInput.disabled = isDisabledDropdown(root);
}

function setTriggerValue(root, value) {
  if (isTagDropdown(root)) return;
  const input = getTriggerInput(root);
  if (!input) return;
  input.value = value;
}

// A single choice shows its picture in the field as well as its label: the
// flag of a language, the icon, colour or avatar of an option. The option's
// first visual is copied in front of the input; a flag is copied unmounted, so
// the flag component loads it on its own.
// Searched in document order inside the option, so a colour dot inside the tag
// markup of a colour option and an avatar inside a label group are found too;
// a checkbox indicator is never the picture.
const FIELD_VISUAL_SELECTOR = ":scope > .sf-list-item-wrap :is(.sf-flag, .sf-icon, .sf-tag-color-icon, .sf-avatar):not(.sf-checkbox *)";

function syncFieldVisual(root, selected) {
  if (isTagDropdown(root)) return;
  const field = getField(root);
  const input = getTriggerInput(root);
  if (!field || !input) return;
  field.querySelector(":scope > .sf-dropdown-field-visual")?.remove();
  if (isMultipleDropdown(root) || selected.length !== 1) return;
  const source = selected[0].querySelector(FIELD_VISUAL_SELECTOR);
  if (!source) return;
  const visual = source.cloneNode(true);
  visual.classList.add("sf-dropdown-field-visual");
  visual.setAttribute("aria-hidden", "true");
  if (visual.classList.contains("sf-flag")) {
    delete visual.dataset.sfFlagReady;
    visual.replaceChildren();
  }
  input.before(visual);
}

function syncSelectionPresentation(root) {
  const selected = getSelectedItems(root);
  const visible = isMultipleDropdown(root) ? selected : selected.slice(0, 1);
  setTriggerValue(root, visible.map(getItemLabel).join(', '));
  syncFieldVisual(root, visible);
  root.dataset.selectedValue = visible.map(getItemValue).join(',');
  syncTags(root);
  syncHiddenInput(root);
}

function syncToggleIcon(root, isOpen) {
  const icon = getToggleIcon(root);
  if (!icon) return;
  icon.textContent = isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down";
}

function applyDropdownViewport(root, visibleItems = 4) {
  const wrap = getListWrap(root);
  const container = getListContainer(root);
  if (!wrap || !container || visibleItems <= 0) return;

  const items = getItems(root).filter((item) => !item.hidden);
  if (!items.length) return;

  const firstItem = items[0];
  const itemHeight = firstItem.getBoundingClientRect().height;
  if (!itemHeight) return;

  const containerStyle = window.getComputedStyle(container);
  const gap =
    Number.parseFloat(containerStyle.rowGap || "") ||
    Number.parseFloat(containerStyle.gap || "") ||
    0;
  const paddingTop = Number.parseFloat(containerStyle.paddingTop || "") || 0;
  const paddingBottom =
    Number.parseFloat(containerStyle.paddingBottom || "") || 0;
  const visibleCount = Math.min(visibleItems, items.length);
  const totalHeight =
    visibleCount * itemHeight +
    Math.max(visibleCount - 1, 0) * gap +
    paddingTop +
    paddingBottom;

  wrap.style.maxHeight = `${Math.ceil(totalHeight)}px`;
  wrap.style.overflowY = items.length > visibleCount ? "auto" : "hidden";
  wrap.style.overflowX = "hidden";
}

function openDropdown(root) {
  if (!root || isDisabledDropdown(root)) return;
  // A Smart dropdown owns its open state and holds the mark on its host.
  if (isSmartDropdownRoot(root)) {
    root.closest("sf-dropdown").openDropdown();
    return;
  }
  const triggerInput = getTriggerInput(root);
  if (triggerInput && triggerInput.disabled) return;

  const list = getList(root);
  if (!list) return;

  root.classList.add("sf-dropdown--open");
  ensurePortalList(root);
  list.hidden = false;
  // An open list owns Escape, so the root says a surface is open and whatever
  // owns Escape for something larger -- a record panel, a drawer, a modal --
  // leaves that press alone. Those all listen on the document in capture and
  // the list closes on its own root in the bubble phase, so without the mark
  // the panel closed first and the list never saw the key.
  holdOpenSurfaceMark(root, true);
  syncToggleIcon(root, true);
  applyDropdownViewport(root, 4);
  positionPortalList(root);
  root.__sfDropdownInteraction?.refresh();
}

function closeDropdown(root) {
  if (!root) return;
  // A Smart dropdown owns its rendered nodes. Global outside-click handling
  // must request its state change, not replace Lit-managed icon text.
  if (isSmartDropdownRoot(root)) {
    root.closest("sf-dropdown").closeDropdown();
    return;
  }
  root.__sfDropdownInteraction?.beforeClose();
  const list = getList(root);
  if (!list) return;

  root.classList.remove("sf-dropdown--open");
  list.hidden = true;
  holdOpenSurfaceMark(root, false);
  syncToggleIcon(root, false);
  restorePortalList(root);

  const searchInput = getSearchInput(root);
  if (searchInput) {
    searchInput.value = "";
    filterItems(root, "");
  }
  root.__sfDropdownInteraction?.refresh();
}

function toggleDropdown(root) {
  if (!root) return;

  if (root.classList.contains("sf-dropdown--open")) {
    closeDropdown(root);
    return;
  }

  document
    .querySelectorAll(`${DROPDOWN_SELECTOR}.sf-dropdown--open`)
    .forEach((el) => {
      if (el !== root) closeDropdown(el);
    });

  openDropdown(root);
}

function filterItems(root, query = "") {
  const normalized = String(query).trim().toLowerCase();

  getItems(root).forEach((item) => {
    const label = getItemLabel(item).toLowerCase();
    item.hidden = Boolean(normalized) && !label.includes(normalized);
  });

  applyDropdownViewport(root, 4);
  root.__sfDropdownInteraction?.refresh();
  if (root.classList.contains('sf-dropdown--open')) positionPortalList(root);
}

function getSelectedItems(root) {
  return getItems(root).filter((item) => item.classList.contains("selected"));
}

function syncDisabledState(root) {
  // Search results (including zero or one match) are not disabled state.
  // Keep the author-owned class/attribute separate from derived DOM state.
  const disabled = isDisabledDropdown(root);
  const changed = root.__sfDropdownDisabledState !== disabled;
  root.__sfDropdownDisabledState = disabled;
  const field = getField(root);
  const triggerInput = getTriggerInput(root);
  const searchInput = getSearchInput(root);
  const toggleButton = root.querySelector(".sf-dropdown-field .sf-icon-button");

  root.removeAttribute("aria-disabled");
  // A native button trigger says it is disabled through its own attribute.
  // When the field itself is the trigger it carries role="button" and has no
  // such attribute, so the state has to be said in ARIA.
  const trigger = field?.querySelector(":scope > button") || field;
  if (trigger && trigger.tagName !== "BUTTON") {
    trigger.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  if (field) {
    field.classList.toggle("cursor-pointer", !disabled);
  }

  if (triggerInput) {
    triggerInput.disabled = disabled;
  }

  if (searchInput) {
    searchInput.disabled = disabled;
  }

  const hiddenInput = getHiddenInput(root);
  if (hiddenInput) {
    hiddenInput.disabled = disabled;
  }

  if (toggleButton) {
    toggleButton.disabled = disabled;
    toggleButton.tabIndex = disabled ? -1 : 0;
  }

  getItems(root).forEach((item) => {
    item.tabIndex = disabled || item.classList.contains("disabled") ? -1 : 0;
  });

  if (disabled && root.classList.contains("sf-dropdown--open")) {
    closeDropdown(root);
  }
  root.__sfDropdownInteraction?.refresh();
  return changed;
}

function dispatchDropdownChange(root, detail) {
  if (!root) return;

  root.dispatchEvent(
    new CustomEvent("sf-dropdown:change", {
      bubbles: true,
      composed: true,
      detail,
    }),
  );

  root.dispatchEvent(
    new CustomEvent("change", {
      bubbles: true,
      composed: true,
      detail,
    }),
  );
}

function selectItem(root, item) {
  if (
    !root ||
    !item ||
    item.classList.contains("disabled") ||
    isDisabledDropdown(root)
  )
    return;

  const label = getItemLabel(item);
  const value = getItemValue(item);
  const isMultiple = isMultipleDropdown(root);

  if (isMultiple) {
    const nextSelected = getSelectedItems(root);
    const alreadySelected = item.classList.contains("selected");
    const selectedItems = alreadySelected
      ? nextSelected.filter((selected) => selected !== item)
      : [...nextSelected, item];

    syncSelected(root, selectedItems);
  } else {
    syncSelected(root, [item]);
  }
  syncSelectionPresentation(root);

  dispatchDropdownChange(root, {
    value,
    label,
    values: isMultiple ? getSelectedItems(root).map(getItemValue) : [value],
    item,
    root,
    multiple: isMultiple,
  });

  syncItemCheckboxInteractivity(root);

  if (!isMultiple) {
    closeDropdown(root);
  }
}

function onDocumentClick(event) {
  document
    .querySelectorAll(`${DROPDOWN_SELECTOR}.sf-dropdown--open`)
    .forEach((root) => {
      if (containsDropdownTarget(root, event.target)) return;
      closeDropdown(root);
    });
}

function onRootClick(event) {
  const root = event.currentTarget.__sfDropdownRoot || event.currentTarget;
  // Native top-layer panels retain ancestry; the root receives this bubble.
  if (event.currentTarget !== root && root.contains(event.currentTarget)) return;
  if (isDisabledDropdown(root)) {
    event.preventDefault();
    return;
  }

  const field = getField(root);
  const item = event.target.closest(".sf-list-item");
  const removeTagButton = event.target.closest('[data-role="remove-tag"]');
  const searchWrap = event.target.closest(".sf-list .sf-input");
  const optionCheckbox = event.target.closest(".sf-list-item .sf-checkbox");

  if (searchWrap && containsDropdownTarget(root, searchWrap)) {
    return;
  }

  if (optionCheckbox && containsDropdownTarget(root, optionCheckbox)) {
    event.preventDefault();
  }

  if (removeTagButton && containsDropdownTarget(root, removeTagButton)) {
    event.preventDefault();
    event.stopPropagation();

    const value = removeTagButton.dataset.value;
    const selectedItems = getSelectedItems(root).filter((selectedItem) => {
      return getItemValue(selectedItem) !== value;
    });

    syncSelected(root, selectedItems);
    syncSelectionPresentation(root);

    dispatchDropdownChange(root, {
      value: "",
      label: "",
      values: selectedItems.map(getItemValue),
      item: null,
      root,
      multiple: isMultipleDropdown(root),
    });
    syncItemCheckboxInteractivity(root);
    return;
  }

  if (item && containsDropdownTarget(root, item)) {
    event.preventDefault();
    selectItem(root, item);
    return;
  }

  if (!field?.contains(event.target)) return;
  if (event.target.closest(".sf-list")) return;

  event.preventDefault();
  toggleDropdown(root);
}

function onRootKeydown(event) {
  const root = event.currentTarget.__sfDropdownRoot || event.currentTarget;
  if (event.currentTarget !== root && root.contains(event.currentTarget)) return;
  if (isDisabledDropdown(root)) return;

  if (event.key === "Escape") {
    closeDropdown(root);
    return;
  }

  const item = event.target.closest(".sf-list-item");
  if (!item) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectItem(root, item);
  }
}

function onSearchInput(event) {
  const root =
    event.currentTarget.__sfDropdownRoot ||
    event.currentTarget.closest(DROPDOWN_SELECTOR);
  if (!root || isDisabledDropdown(root)) return;
  filterItems(root, event.currentTarget.value);
}

// The search box is a text input, so leaving it after typing fires its own
// native `change`. That event is the box's, not the dropdown's: let out, it
// reached form and host listeners as a selection change with no detail, beside
// the real one (simai/ui-source#53). sf-dropdown stops it in its template; the
// Native dropdown stops it here, so only a selection change leaves the component.
function onSearchChange(event) {
  event.stopPropagation();
}

function bindDropdown(root) {
  retireFieldSizeClass(root, "sf-dropdown");
  if (isSmartDropdownRoot(root)) return;
  if (!root || root.dataset[BOUND_FLAG] === "1") return;

  const field = getField(root);
  const list = getList(root);
  const triggerInput = getTriggerInput(root);
  if (!field || !list) return;

  root.dataset[BOUND_FLAG] = "1";
  // Open and disabled state belong to the trigger, which the interaction layer
  // gives role, aria-expanded and aria-controls. The root is a plain div: an
  // aria-expanded or aria-disabled there is not allowed on its role, and a
  // screen reader never reads it. Earlier builds wrote both here as well.
  root.removeAttribute("aria-expanded");

  if (triggerInput && !isTagDropdown(root)) {
    triggerInput.readOnly = true;
  }
  list.hidden = !root.classList.contains("sf-dropdown--open");
  syncToggleIcon(root, root.classList.contains("sf-dropdown--open"));
  applyDropdownViewport(root, 4);
  syncDisabledState(root);
  syncItemCheckboxInteractivity(root);

  root.__sfDropdownStateObserver = new MutationObserver((records) => {
    const changed = syncDisabledState(root);
    syncItemCheckboxInteractivity(root);
    // The open class is the state, and a consumer may toggle it directly; the
    // mark follows the class so it cannot be left raised or missing.
    holdOpenSurfaceMark(root, root.classList.contains("sf-dropdown--open"));
    if (changed) syncTags(root);
    if(records.some(record=>['portal','data-portal'].includes(record.attributeName))){
      if(root.classList.contains('sf-dropdown--open')&&isPortalDropdown(root))ensurePortalList(root);
      else restorePortalList(root);
      root.__sfDropdownInteraction?.refresh();
    }
  });
  root.__sfDropdownStateObserver.observe(root, {
    attributes: true,
    attributeFilter: ["class", "disabled", "portal", "data-portal"],
  });

  const listContainer = getListContainer(root);
  if (listContainer && !root.__sfDropdownItemsObserver) {
    root.__sfDropdownItemsObserver = new MutationObserver(() => {
      syncDisabledState(root);
      syncItemCheckboxInteractivity(root);
    });
    root.__sfDropdownItemsObserver.observe(listContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden"],
    });
  }

  const selectedItems = getSelectedItems(root);
  if (selectedItems.length > 0) {
    syncSelected(root, selectedItems);
    syncSelectionPresentation(root);
  } else {
    const presetValue =
      root.getAttribute("value") || root.dataset.selectedValue || "";

    if (presetValue) {
      const presetValues = isMultipleDropdown(root)
        ? presetValue.split(',').map(value => value.trim()).filter(Boolean)
        : [presetValue];
      const presetItems = getItems(root).filter(item => presetValues.includes(getItemValue(item)));
      const presetItem = presetItems[0];

      if (presetItem) {
        syncSelected(root, isMultipleDropdown(root) ? presetItems : [presetItem]);
        syncSelectionPresentation(root);
      }
    }
  }

  if (!selectedItems.length && isTagDropdown(root)) {
    syncTags(root);
    syncHiddenInput(root);
  }

  root.__sfDropdownOnClick = onRootClick;
  root.__sfDropdownOnKeydown = onRootKeydown;

  root.addEventListener("click", onRootClick);
  root.addEventListener("keydown", onRootKeydown);

  const searchInput = getSearchInput(root);
  if (searchInput) {
    root.__sfDropdownSearchInput = searchInput;
    root.__sfDropdownOnSearchInput = onSearchInput;
    root.__sfDropdownOnSearchChange = onSearchChange;
    searchInput.__sfDropdownRoot = root;
    searchInput.addEventListener("input", onSearchInput);
    searchInput.addEventListener("change", onSearchChange);
  }
  root.__sfDropdownInteraction = createDropdownInteraction(root, {
    getList: () => getList(root),
    isOpen: () => root.classList.contains("sf-dropdown--open"),
    isDisabled: () => isDisabledDropdown(root),
    isMultiple: () => isMultipleDropdown(root),
    selectedLabels: () => getSelectedItems(root).map(getItemLabel),
    open: () => openDropdown(root),
    close: () => closeDropdown(root),
    select: item => selectItem(root, item),
  });
  if (!Object.prototype.hasOwnProperty.call(root, '__sfDropdownResetValues')) {
    root.__sfDropdownResetValues = getSelectedItems(root).map(getItemValue);
  }
  const resetControl = getHiddenInput(root) || field.querySelector(':scope > button') || triggerInput;
  if (resetControl) {
    root.__sfDropdownReleaseReset = bindFormReset(resetControl, () => {
      const selected = getItems(root).filter(item => root.__sfDropdownResetValues.includes(getItemValue(item)));
      const restored = isMultipleDropdown(root) ? selected : selected.slice(0, 1);
      syncSelected(root, restored);
      syncSelectionPresentation(root);
      closeDropdown(root);
    });
  }
}

function unbindDropdown(root) {
  if (!root || root.dataset[BOUND_FLAG] !== "1") return;
  holdOpenSurfaceMark(root, false);
  root.__sfDropdownInteraction?.release();
  delete root.__sfDropdownInteraction;
  root.__sfDropdownReleaseReset?.();
  delete root.__sfDropdownReleaseReset;

  restorePortalList(root);
  root.__sfDropdownItemsObserver?.disconnect?.();
  root.__sfDropdownStateObserver?.disconnect?.();

  root.removeEventListener("click", root.__sfDropdownOnClick);
  root.removeEventListener("keydown", root.__sfDropdownOnKeydown);

  const list = getList(root);
  if (list && root.__sfDropdownPortalClick) {
    list.removeEventListener("click", root.__sfDropdownPortalClick);
    list.removeEventListener("keydown", root.__sfDropdownPortalKeydown);
  }

  if (root.__sfDropdownSearchInput && root.__sfDropdownOnSearchInput) {
    root.__sfDropdownSearchInput.removeEventListener(
      "input",
      root.__sfDropdownOnSearchInput,
    );
    root.__sfDropdownSearchInput.removeEventListener(
      "change",
      root.__sfDropdownOnSearchChange,
    );
    delete root.__sfDropdownSearchInput.__sfDropdownRoot;
  }

  delete root.__sfDropdownOnClick;
  delete root.__sfDropdownOnKeydown;
  delete root.__sfDropdownPortalClick;
  delete root.__sfDropdownPortalKeydown;
  delete root.__sfDropdownSearchInput;
  delete root.__sfDropdownOnSearchInput;
  delete root.__sfDropdownOnSearchChange;
  delete root.__sfDropdownItemsObserver;
  delete root.__sfDropdownStateObserver;
  delete root.__sfDropdownDisabledState;
  delete root.dataset[BOUND_FLAG];
}

function initExistingDropdowns(target = document) {
  target.querySelectorAll(DROPDOWN_SELECTOR).forEach(bindDropdown);
}

if (!document.__sfDropdownDocumentClickBound) {
  document.addEventListener("click", onDocumentClick);
  document.__sfDropdownDocumentClickBound = true;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initExistingDropdowns());
} else {
  initExistingDropdowns();
}

const dropdownObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.(DROPDOWN_SELECTOR)) {
        bindDropdown(node);
      }
      initExistingDropdowns(node);
    });

    mutation.removedNodes.forEach((node) => {
      if (!(node instanceof Element) || node.isConnected) return;
      if (node.matches?.(DROPDOWN_SELECTOR)) {
        unbindDropdown(node);
      }
      node.querySelectorAll?.(DROPDOWN_SELECTOR).forEach(unbindDropdown);
    });
  });
});

dropdownObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export {
  bindDropdown,
  closeDropdown,
  openDropdown,
  selectItem,
  unbindDropdown,
};

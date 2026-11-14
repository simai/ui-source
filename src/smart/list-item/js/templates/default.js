import { html, nothing } from "lit";
import { nearestFieldSize } from "../../../../component/field-size";
import { avatarPicture } from "../../../avatar/js/picture";

// The mark in a row's box is bound as a property, not as an attribute. A press
// anywhere in the row reaches the label that holds this input and flips its live
// `checked`, after which the attribute controls nothing: a row unticked by its
// owner went on showing a tick, with the row's own highlight gone from under it.
export function renderListItemTemplate(context) {
  const isOption = context.option === true;
  const textContent = context.component?.hasSlotContent?.("text")
    ? context.component.getSlotContent("text")
    : context.text;

  const leadingContent = context.component?.hasSlotContent?.("leading")
    ? context.component.getSlotContent("leading")
    : nothing;

  const trailingContent = context.component?.hasSlotContent?.("trailing")
    ? context.component.getSlotContent("trailing")
    : nothing;

  // A general list row (simai/ui-source#18): a second, supporting line under
  // the title; a row a person acts on (interactive); a row of an sf-sortable
  // list, which carries the list's item id and a drag handle, or is pinned and
  // carries neither. None of these exist for an option, which Dropdown owns.
  const supportingContent = !isOption && context.component?.hasSlotContent?.("supporting")
    ? context.component.getSlotContent("supporting")
    : (!isOption && context.supporting) || nothing;
  const twoLine = supportingContent !== nothing;
  const sortableItem = !isOption && !context.pinned ? context.sortableItem || "" : "";
  const handleSlot = !isOption && Boolean(context.sortableItem || context.pinned);
  const roving = !isOption && Boolean(context.interactive || sortableItem);

  const classes = [
    "sf-list-item",
    "flex",
    "items-cross-center",
    `sf-list-item--${context.kind ?? context.type}`,
    `sf-list-item--size-${context.size}`,
    isOption ? "cursor-pointer" : "",
    context.selected ? "selected" : "",
    context.disabled ? "disabled" : "",
    twoLine ? "sf-list-item--two-line" : "",
    !isOption && context.interactive ? "sf-list-item--interactive" : "",
    handleSlot ? "sf-list-item--sortable" : "",
    !isOption && context.pinned ? "sf-list-item--pinned" : "",
    // Owner decision C148: an inset line under the row (divided), a title
    // of up to two lines (lines="2"). An option keeps neither.
    !isOption && context.divided ? "sf-list-item--divided" : "",
    !isOption && String(context.lines) === "2" ? "sf-list-item--lines-2" : "",
    context.rootClass,
  ].filter(Boolean);

  const wrapClasses = ["sf-list-item-wrap", "flex", "flex-1"];
  const isDecoratedType = ["icon", "checkbox", "avatar", "color"].includes(
    context.type,
  );

  // The step between the picture and the text is the row's own (C105 H2,
  // HS-5): the list item sheet sets it from the size and the density. A layout
  // class here (gap-2, --sf-space-2) put 20 between them at every size.
  if (isDecoratedType) {
    wrapClasses.push(
      "flex",
      "flex-row",
      "flex-nowrap",
      "items-center",
    );
  }

  if ((isOption && context.type === "avatar") || context.type === "color") {
    wrapClasses.push("justify-between");
  }

  const renderLeading = () => {
    if (leadingContent !== nothing) return leadingContent;

    // An icon row's picture is an sf-icon element (1.2.7): its name joins the
    // first icon font request. A bare <i class="sf-icon"> printed after the
    // page's icon scan -- every option of an opened sf-dropdown -- was found a
    // round later and its glyph came late. The row's size and colour reach
    // the glyph inside it (display: contents).
    if (context.type === "icon") {
      return html`<sf-icon icon=${context.icon} aria-hidden="true"></sf-icon>`;
    }

    if (context.type === "checkbox") {
      return html`
        <label
          class="sf-checkbox sf-checkbox--size-${context.sizeGroup
            .checkbox} flex"
          aria-hidden="true"
        >
          <span class="sf-checkbox-box flex">
            <input
              .checked=${Boolean(context.checked || context.selected)}
              ?disabled=${context.disabled}
              tabindex="-1"
              type="checkbox"
            />
            <span class="sf-icon" aria-hidden="true"></span>
          </span>
        </label>
      `;
    }

    if (context.type === "avatar") {
      // sf-avatar's own drawing (js/picture.js, avatar study AV-8): the photo
      // an <img>, else the initials of the title on the neutral plate, else
      // the person glyph. It was a background image, and with no photo an
      // empty circle.
      const avatarSize = context.sizeGroup.item === "1/3" || context.sizeGroup.item === "1/2" ? "1/3" : context.sizeGroup.item === "1" ? "1/2" : context.sizeGroup.item === "2" ? "1" : "2";

      // A row outside a dropdown (list item study LI-5): the picture is the
      // row's leading part, as an icon row's glyph is, and the title and its
      // supporting line are the row's own text block. In the label group the
      // supporting line was dropped (a 28 row at size 1, under the ladder).
      // An option keeps the label group sf-dropdown reads.
      if (!isOption) {
        return avatarPicture({
          size: avatarSize,
          imageUrl: context.avatarImageUrl,
          name: context.avatarTitle,
          disabled: context.disabled,
        });
      }

      return html`
        <div
          class="sf-avatar-label-group sf-avatar-label-group--size-${context
            .sizeGroup.avatarGroup} flex items-cross-center"
        >
          ${avatarPicture({
            size: avatarSize,
            imageUrl: context.avatarImageUrl,
            name: context.avatarTitle,
            disabled: context.disabled,
          })}
          <div class="sf-avatar-label-group-container flex flex-col">
            <div class="sf-avatar-label-group-title">
              ${context.avatarTitle}
            </div>
          </div>
        </div>
      `;
    }

    if (context.type === "color") {
      const tagClasses = [
        "sf-tag",
        "sf-tag--color",
        `sf-tag--size-${context.sizeGroup.colorTag}`,
        "flex",
        "flex-row",
        "flex-nowrap",
        "items-center",
        "flex-1",
        context.disabled ? "disabled" : "",
      ].filter(Boolean);

      return html`
        <div class=${tagClasses.join(" ")}>
          <span class="sf-tag-color-icon ${context.colorClass}" aria-hidden="true"></span>
          <span class="sf-tag-container">${textContent}</span>
        </div>
      `;
    }

    return nothing;
  };

  const renderText = () => {
    if (context.type === "color") return nothing;
    if (context.type === "avatar" && isOption) return nothing;
    // An avatar row's title is its text, else its avatar-title (the label
    // group showed avatar-title, which defaults to text).
    const title = context.type === "avatar" && !textContent ? context.avatarTitle : textContent;
    if (twoLine) {
      return html`<div class="sf-list-item-container"><span class="sf-list-item-title">${title}</span><span class="sf-list-item-supporting">${supportingContent}</span></div>`;
    }
    return html`<div class="sf-list-item-container">${title}</div>`;
  };

  // The handle stands in a slot of its own before everything else; a pinned
  // row keeps the slot empty, so its text starts where its neighbours' does.
  const renderHandle = () => {
    if (!handleSlot) return nothing;
    return html`<span class="sf-list-item-handle" ?data-sf-sortable-handle=${Boolean(sortableItem)} aria-hidden="true">${sortableItem ? html`<i class="sf-icon">drag_indicator</i>` : nothing}</span>`;
  };

  const renderTrailing = () => {
    // The row's end part is one box (owner decision C148 (2), (3)): a plain
    // <span slot="trailing"> gives the slot its children (the base unwraps a
    // wrapper that only names the slot), so loose nodes -- a time and a
    // badge, two buttons -- are put back in a box of the row's own. An
    // element the page gave keeps its own box.
    if (trailingContent !== nothing) {
      if (isOption || (typeof Element !== "undefined" && trailingContent instanceof Element)) return trailingContent;
      return html`<span class="sf-list-item-trailing">${trailingContent}</span>`;
    }

    // The box after a picture is a dropdown option's choice, and only where
    // the list may hold several chosen. A row outside a dropdown has no choice
    // to mark (docs precheck smart content LI-01: an empty checkbox stood at
    // the end of every such row); an option of a single choice says it is
    // chosen with its fill alone (owner C08; DEV P2, owner R143, 2026-11-12).
    if (isOption && context.multiple && (context.type === "avatar" || context.type === "color")) {
      return html`
        <label
          class="sf-checkbox sf-checkbox--size-${context.sizeGroup
            .checkbox} flex"
          aria-hidden="true"
        >
          <span class="sf-checkbox-box flex">
            <input
              .checked=${Boolean(context.checked || context.selected)}
              ?disabled=${context.disabled}
              tabindex="-1"
              type="checkbox"
            />
            <span class="sf-icon" aria-hidden="true"></span>
          </span>
        </label>
      `;
    }

    return nothing;
  };

  return html`
    <div
      class=${classes.join(" ")}
      style=${context.rootStyle || nothing}
      role=${isOption ? "option" : nothing}
      tabindex=${isOption ? "-1" : nothing}
      data-value=${isOption ? context.value || nothing : nothing}
      aria-label=${isOption || roving ? context.ariaLabel || nothing : nothing}
      title=${isOption ? context.ariaLabel || nothing : nothing}
      aria-disabled=${(isOption || roving) && context.disabled ? "true" : nothing}
      aria-selected=${isOption ? (context.selected ? "true" : "false") : nothing}
      data-sf-sortable-item=${sortableItem || nothing}
      ?data-sf-list-roving=${roving}
      aria-current=${roving && context.selected ? "true" : nothing}
    >
      ${renderHandle()}
      <div class=${wrapClasses.join(" ")}>
        ${renderLeading()} ${renderText()} ${renderTrailing()}
      </div>
    </div>
  `;
}

// A row in a listbox, which is what an option is: the same row, told that it
// takes a place in a list, so it carries the listbox roles and answers a
// pointer. The dropdown built this inline and nothing else could, which is why
// a multi-select list outside a dropdown had to be hand-made out of checkboxes.
export function renderListItemOption(option = {}, {multiple = false} = {}) {
  const size = String(option.size || "1");

  return renderListItemTemplate({
    component: {hasSlotContent: () => false, getSlotContent: () => nothing},
    templateName: "default",
    type: option.type || "text",
    kind: option.kind || option.type || "text",
    size,
    sizeGroup: optionSizeGroup(size),
    text: option.text,
    icon: option.icon,
    checked: option.checked || option.selected,
    selected: option.selected,
    disabled: option.disabled,
    value: option.value,
    colorClass: option.colorClass,
    avatarImageUrl: option.avatarImageUrl,
    avatarTitle: option.avatarTitle,
    ariaLabel: option.ariaLabel,
    multiple: Boolean(multiple),
    option: true,
  });
}

// What a list says about itself between its rows. A long list of names needs to
// say where each stretch of it comes from; written into every row instead, the
// origin was repeated on every line and the name it mattered for was pushed off
// the end.
export function renderListItemHeading(text, size = "1") {
  return html`
    <div class="sf-list-heading sf-list-heading--size-${size}" role="presentation">
      <span class="sf-list-heading-container">${text}</span>
    </div>
  `;
}

// The sizes a row's own parts take beside it. A checkbox and an avatar do not
// have the row's whole ladder, so each lands on the nearest step it has.
export function optionSizeGroup(value) {
  const size = String(value || "1");

  if (size === "1/3" || size === "1/2") {
    return {item: size, checkbox: nearestFieldSize(size), avatarGroup: "1/2", colorTag: "1/2"};
  }

  return {item: size, checkbox: nearestFieldSize(size), avatarGroup: size, colorTag: "1"};
}

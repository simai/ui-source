import { html, nothing } from "lit";
import { nearestFieldSize } from "../../../../component/field-size";

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

  const classes = [
    "sf-list-item",
    "flex",
    "items-cross-center",
    `sf-list-item--${context.kind ?? context.type}`,
    `sf-list-item--size-${context.size}`,
    isOption ? "cursor-pointer" : "",
    context.selected ? "selected" : "",
    context.disabled ? "disabled" : "",
    context.rootClass,
  ].filter(Boolean);

  const wrapClasses = ["sf-list-item-wrap", "flex", "flex-1"];
  const isDecoratedType = ["icon", "checkbox", "avatar", "color"].includes(
    context.type,
  );

  if (isDecoratedType) {
    wrapClasses.push(
      "flex",
      "flex-row",
      "flex-nowrap",
      "items-center",
      "gap-2",
    );
  }

  if (context.type === "avatar" || context.type === "color") {
    wrapClasses.splice(wrapClasses.indexOf("gap-2"), 1);
    wrapClasses.push("justify-between", "gap-2");
  }

  const renderLeading = () => {
    if (leadingContent !== nothing) return leadingContent;

    if (context.type === "icon") {
      return html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>`;
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
      const avatarClasses = [
        "sf-avatar",
        `sf-avatar--size-${context.sizeGroup.item === "1/3" || context.sizeGroup.item === "1/2" ? "1/3" : context.sizeGroup.item === "1" ? "1/2" : context.sizeGroup.item === "2" ? "1" : "2"}`,
        "bg-cover",
        context.disabled ? "disabled" : "",
      ].filter(Boolean);

      return html`
        <div
          class="sf-avatar-label-group sf-avatar-label-group--size-${context
            .sizeGroup.avatarGroup} flex items-cross-center"
        >
          <span
            class=${avatarClasses.join(" ")}
            aria-hidden="true"
            style=${context.avatarImageUrl
              ? `background-image: url(${context.avatarImageUrl});`
              : nothing}
          ></span>
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
    if (context.type === "avatar") return nothing;
    return html`<div class="sf-list-item-container">${textContent}</div>`;
  };

  const renderTrailing = () => {
    if (trailingContent !== nothing) return trailingContent;

    if (context.type === "avatar" || context.type === "color") {
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
      aria-label=${isOption ? context.ariaLabel || nothing : nothing}
      title=${isOption ? context.ariaLabel || nothing : nothing}
      aria-disabled=${isOption && context.disabled ? "true" : nothing}
      aria-selected=${isOption ? (context.selected ? "true" : "false") : nothing}
    >
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
export function renderListItemOption(option = {}) {
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

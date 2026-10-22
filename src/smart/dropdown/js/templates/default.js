import { html, nothing } from "lit";
import {
  renderListItemHeading,
  renderListItemOption,
} from "../../../list-item/js/templates/default";

function getOptionLabel(option = {}) {
  if (option.type === "avatar") return option.avatarTitle || option.text || option.value || "";
  return option.text || option.avatarTitle || option.value || "";
}

// Options may say where they come from. A list of a few dozen names is read by
// its stretches rather than line by line, and the name of a stretch belongs
// above it once instead of after every name in it.
function renderOptions(options = [], multiple = false) {
  const parts = [];
  let group = null;

  for (const option of options) {
    const next = option.group ? String(option.group) : "";
    if (next !== group) {
      group = next;
      if (next) parts.push(renderListItemHeading(next, option.size));
    }
    // Where several options may be chosen, each one carries the box that says
    // so: a plain row said it was chosen with a class and aria-selected alone,
    // so on a long list nothing on screen told the person what they had picked
    // (Larena storage QA, 2026-10-22). An option that draws a picture of its
    // own -- an icon, a colour, an avatar -- keeps it, because that is the
    // place the box would take.
    const withBox = multiple && (!option.type || option.type === "text");
    parts.push(renderListItemOption(withBox ? {...option, type: "checkbox"} : option));
  }

  return parts;
}

// From size 1 up the field has room for a compact tag of its own size, with the
// field's own text. Size 1/2 does not (one pixel would be left), so its tag
// goes one size down onto the field line, rendered inline: its label is one
// text step down and it takes no block padding.
const FIELD_TAG = Object.freeze({
  "1/2": {size: "1/3", spacing: ""},
  "1": {size: "1", spacing: "compact"},
  "2": {size: "2", spacing: "compact"},
});

// A single choice shows its picture in the field as well as its label.
function renderFieldVisual(context) {
  if (context.multiple || context.selectedOptions?.length !== 1) return nothing;
  const option = context.selectedOptions[0];
  if (option.type === "icon" && option.icon) {
    return html`<i class="sf-icon sf-dropdown-field-visual" aria-hidden="true">${option.icon}</i>`;
  }
  if (option.type === "color" && option.colorClass) {
    return html`<span class="sf-tag-color-icon sf-dropdown-field-visual ${option.colorClass}" aria-hidden="true"></span>`;
  }
  if (option.type === "avatar" && option.avatarImageUrl) {
    return html`<span class="sf-avatar sf-avatar--size-1/2 bg-cover sf-dropdown-field-visual" aria-hidden="true" style=${`background-image: url(${option.avatarImageUrl});`}></span>`;
  }
  return nothing;
}

function renderTag(context, option) {
  const label = getOptionLabel(option);
  const fieldTag = FIELD_TAG[context.size] || FIELD_TAG["1"];
  const tagSize = fieldTag.size;
  const tagSpacing = fieldTag.spacing ? ` spacing-${fieldTag.spacing}` : "";
  const tagType =
    option.type === "color" ? "color" : option.type === "avatar" ? "avatar" : "icon";

  return html`
    <div
      class="sf-tag transition sf-tag--${tagType} sf-tag--size-${tagSize} sf-tag--inline${tagSpacing} flex flex-row flex-nowrap items-center active"
      data-value=${option.value}
    >
      ${option.type === "color"
        ? html`<span class="sf-tag-color-icon ${option.colorClass}" aria-hidden="true"></span>`
        : nothing}
      ${option.type === "icon"
        ? html`<i class="sf-icon sf-tag-icon" aria-hidden="true">${option.icon}</i>`
        : nothing}
      ${option.type === "avatar"
        ? html`
            <span
              class="sf-avatar sf-avatar--size-${tagSize} bg-cover"
              aria-hidden="true"
              style=${option.avatarImageUrl
                ? `background-image: url(${option.avatarImageUrl});`
                : nothing}
            ></span>
          `
        : nothing}
      <span class="sf-tag-container">${label}</span>
      <button
        type="button"
        class="sf-icon-button sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1/3"
        aria-label=${`Remove ${label}`}
        ?disabled=${context.disabled}
        @click=${(event) => {
          event.preventDefault();
          event.stopPropagation();
          context.component.removeSelectedValue(option.value);
        }}
      >
        <div class="sf-close sf-close--size-1/3 flex">
          <div class="sf-close-icon"></div>
        </div>
      </button>
    </div>
  `;
}

// A grid cell is as tall as a field of the dropdown's size: a size-1/2 icon
// picker drew size-1 cells around its size-1/2 search (owner, 2026-10-14).
const CELL = {
  "1/2": "var(--sf-ui-1\\/2--control-height)",
  "1": "var(--sf-ui-1--control-height)",
  "2": "var(--sf-ui-2--control-height)",
};

export function renderDropdownTemplate(context) {
  const rootClasses = [
    "sf-dropdown",
    context.rootClass,
    context.open ? "open" : "",
    context.open ? "sf-dropdown--open" : "",
    `sf-dropdown--size-${context.size}`,
    `sf-dropdown--${context.appearance ?? context.type}`,
    context.mode === "tag" ? "sf-dropdown--tag" : "",
    context.layout === "grid" ? "sf-dropdown--grid" : "",
    context.mode !== "tag" ? "sf-dropdown--text" : "",
    context.disabled ? "disabled" : "",
    "flex",
    "flex-col",
  ].filter(Boolean);

  const fieldClasses = [
    "sf-dropdown-field",
    !context.disabled ? "cursor-pointer" : "",
    "items-cross-center",
    "relative",
    "transition",
    "flex",
  ].filter(Boolean);

  const iconButtonSize =
    context.size === "1" || context.size === "1/2" ? "1/2" : context.size;
  const listInputSize = context.size;
  const dropdownIcon = context.open ? "keyboard_arrow_up" : "keyboard_arrow_down";

  const renderTrigger = () => {
    // A trigger the consumer supplied. The dropdown's own is a field -- a
    // border, the text of what is chosen, a chevron -- and there are places
    // that want the same list behind something else: a «+» in the head of a
    // group, a glyph, a plain button. Without this seam a consumer had to
    // either show a field where an icon belongs or hide one with styles of its
    // own, which is working around the component rather than using it.
    if (context.component?.hasSlotContent?.('trigger')) {
      return html`
        <div
          class="sf-dropdown-trigger flex items-cross-center"
          @click=${(event) => context.component.handleTriggerClick(event)}
        >
          ${context.name
            ? html`
                <input
                  class="sf-dropdown-hidden-input"
                  type="hidden"
                  name=${context.name}
                  value=${context.value || ""}
                  ?disabled=${context.disabled}
                />
              `
            : nothing}
          ${context.component.getSlotContent('trigger')}
        </div>
      `;
    }

    const hiddenInput = context.name
      ? html`
          <input
            class="sf-dropdown-hidden-input"
            type="hidden"
            name=${context.name}
            value=${context.value || ""}
            ?disabled=${context.disabled}
          />
        `
      : nothing;

    if (context.mode === "tag") {
      return html`
        <div
          class=${fieldClasses.join(" ")}
          @click=${(event) => context.component.handleTriggerClick(event)}
        >
          ${hiddenInput}
          <div class="sf-dropdown-tag-container flex flex-wrap flex-1">
            ${context.selectedOptions.map((option) => renderTag(context, option))}
          </div>
          <button
            type="button"
            class="sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${iconButtonSize}"
            ?disabled=${context.disabled}
          >
            <i class="sf-icon" aria-hidden="true">${dropdownIcon}</i>
          </button>
        </div>
      `;
    }

    return html`
      <label
        class=${fieldClasses.join(" ")}
        @click=${(event) => context.component.handleTriggerClick(event)}
      >
        ${hiddenInput}
        ${renderFieldVisual(context)}
        <input
          placeholder=${context.placeholder}
          type="text"
          class="cursor-pointer"
          .value=${context.triggerText || ""}
          readonly
          ?disabled=${context.disabled}
        />
        <button
          type="button"
          class="sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${iconButtonSize} absolute"
          ?disabled=${context.disabled}
        >
          <i class="sf-icon" aria-hidden="true">${dropdownIcon}</i>
        </button>
      </label>
    `;
  };

  return html`
    <div
      class=${rootClasses.join(" ")}
      style=${context.rootStyle || nothing}
      ?disabled=${context.disabled}
      ?multiple=${context.multiple}
      ?portal=${context.portal}
      data-portal=${context.portal ? "true" : "false"}
    >
      ${context.label
        ? html`
            <span class="sf-dropdown-label flex">
              <span class="sf-dropdown-text">${context.label}</span>
              ${context.required
                ? html`<span class="sf-dropdown-required">*</span>`
                : nothing}
            </span>
          `
        : nothing}
      ${renderTrigger()}

      <div
        class=${`sf-list flex flex-col${
          context.component?.hasSlotContent?.('trigger') ? " sf-list--free-width" : ""
        }`}
        style=${`--sf-list--cell: ${CELL[context.size] || CELL["1"]}`}
        ?hidden=${!context.open}
      >
        ${context.search
          ? html`
              <label
                class="sf-input sf-input--size-${listInputSize} sf-input--filled flex flex-col"
              >
                <span class="sf-input-field items-cross-center transition flex">
                  <input
                    placeholder=${context.searchPlaceholder}
                    type="text"
                    .value=${context.searchValue || ""}
                    ?disabled=${context.disabled}
                    @input=${(event) => context.component.handleSearchInput(event)}
                    @change=${(event) => event.stopPropagation()}
                    @click=${(event) => event.stopPropagation()}
                  />
                  <i class="sf-icon sf-icon-hint" aria-hidden="true">search</i>
                </span>
              </label>
            `
          : nothing}
        <div class="sf-list-container-wrap">
          <div
            class=${`sf-list-container flex flex-col${context.layout === "grid" ? " sf-list-container--grid" : ""}`}
            style=${context.layout === "grid"
              ? `--sf-list-container--columns:${context.columns};`
              : nothing}
            @click=${(event) => context.component.handleOptionClick(event)}
            @keydown=${(event) => context.component.handleOptionKeydown(event)}
          >
            ${renderOptions(context.options, context.multiple)}
          </div>
        </div>
      </div>
    </div>
  `;
}

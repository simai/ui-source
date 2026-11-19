import { html, nothing } from "lit";
import {renderFieldHelp} from '../../../helpers/field-help';
import { renderInheritedSlot } from "../../../helpers/inherited-value";
import { avatarPicture } from "../../../avatar/js/picture";
import { optionBadgeProps } from "../../../helpers/option-badge.js";

// An option's colour (owner decision C308 FO-4; color, one data word, C302):
// the option's name is a tonal badge in that colour in its row, as in a cell,
// a view, a checklist and segmented buttons; the badge's text is the row's
// name.
//
// An option's dot (owner decision C314 (4)): `dot` names a status colour --
// primary, tertiary, info, success, warning, error or neutral (the grey) --
// and the row draws sf-dot's 8 px disc before the name, at the dot's gap
// (the filter window's conditions: excluding red, presence purple, the rest
// grey). The name stays the row's text.
const OPTION_DOTS = new Set(["primary", "tertiary", "info", "success", "warning", "error", "neutral"]);

function optionName(option) {
  if (option.dot && OPTION_DOTS.has(String(option.dot)) && typeof option.text === "string") {
    return {
      ...option,
      text: html`<span class="sf-dot sf-dot--size-1 sf-dot--${String(option.dot)} sf-dropdown-option-dot"><span class="sf-dot-item" aria-hidden="true"></span>${option.text}</span>`,
    };
  }
  if (!option.color || typeof option.text !== "string") return option;
  const badge = optionBadgeProps({color: option.color});
  return {
    ...option,
    text: html`<sf-badge class="sf-dropdown-option-badge" appearance="tonal" tight line="1" scheme=${badge.scheme}
                         root-style=${badge.rootStyle || nothing} text=${option.text}></sf-badge>`,
  };
}
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
    // place the box would take; an avatar or a colour row then draws its box
    // after the picture, and only in a multiple list (C08: a single choice
    // is the row's fill, no box).
    // The box stands at the row's end on every row (owner decision C308 (4),
    // FF-3): a text or icon row draws it after its name, as a picture row does.
    const withBox = multiple && (!option.type || option.type === "text" || option.type === "icon");
    const named = optionName(option);
    parts.push(renderListItemOption(withBox ? {...named, checkEnd: true} : named, {multiple}));
  }

  return parts;
}

// A tag in the field is part of the field (owner decision C145 (1), variant
// A): inline, one size below the field, so its label is one text step under
// the field's; the field gives it its height (the field less --sf-space-1/4
// above and below) as its line. From size 1 up it was a low chip of the
// field's own size (C27), 32 in a 40 field. At the field ladder's outer
// steps the tag is sf-input-lookup's chip: 1/3 holds a 1/3 tag (the smallest
// tag), 3 a tag of size 2.
const FIELD_TAG = Object.freeze({
  "1/3": {size: "1/3", height: ""},
  "1/2": {size: "1/3", height: ""},
  "1": {size: "1/2", height: ""},
  "2": {size: "1", height: ""},
  "3": {size: "2", height: ""},
});

// A single choice shows its picture in the field as well as its label. The
// pictures of a choice -- this one and an icon tag's -- are sf-icon elements,
// as in every other component: the element tells the Loader its name, so the
// name joins the first icon font request. A bare <i class="sf-icon"> drawn
// here after the page's scan was found only later and its glyph came late
// (the defect sf-tag 1.3.2 fixed, 2026-11-09).
function renderFieldVisual(context) {
  if (context.multiple || context.selectedOptions?.length !== 1) return nothing;
  const option = context.selectedOptions[0];
  if (option.type === "icon" && option.icon) {
    return html`<sf-icon icon=${option.icon} root-class="sf-dropdown-field-visual" aria-hidden="true"></sf-icon>`;
  }
  if (option.type === "color" && option.colorClass) {
    return html`<span class="sf-tag-color-icon sf-dropdown-field-visual ${option.colorClass}" aria-hidden="true"></span>`;
  }
  // sf-avatar's own drawing (js/picture.js, avatar study AV-8): the photo an
  // <img>, else the initials of the option's name, else the person glyph.
  if (option.type === "avatar") {
    return avatarPicture({
      size: "1/2",
      imageUrl: option.avatarImageUrl,
      name: option.avatarTitle || option.text,
      extraClass: "sf-dropdown-field-visual",
    });
  }
  return nothing;
}

// A value's tag is the tag's own grey (owner decision C58, as
// sf-input-lookup's chips; RG-NV 18): no active class, which drew it
// primary-container.
function renderTag(context, option) {
  const label = getOptionLabel(option);
  const fieldTag = FIELD_TAG[context.size] || FIELD_TAG["1"];
  const tagSize = fieldTag.size;
  const tagSpacing = fieldTag.height ? ` sf-tag--height-${fieldTag.height}` : "";
  const tagType =
    option.type === "color" ? "color" : option.type === "avatar" ? "avatar" : "icon";

  return html`
    <div
      class="sf-tag transition sf-tag--${tagType} sf-tag--size-${tagSize} sf-tag--inline${tagSpacing} flex flex-row flex-nowrap items-center"
      data-value=${option.value}
    >
      ${option.type === "color"
        ? html`<span class="sf-tag-color-icon ${option.colorClass}" aria-hidden="true"></span>`
        : nothing}
      ${option.type === "icon"
        ? html`<sf-icon icon=${option.icon} root-class="sf-tag-icon" aria-hidden="true"></sf-icon>`
        : nothing}
      ${option.type === "avatar"
        ? avatarPicture({
            size: tagSize,
            imageUrl: option.avatarImageUrl,
            name: option.avatarTitle || option.text,
          })
        : nothing}
      <span class="sf-tag-container">${label}</span>
      <button
        type="button"
        class="sf-icon-button sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/3"
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
  "1/3": "var(--sf-ui-1\\/3--control-height)",
  "1/2": "var(--sf-ui-1\\/2--control-height)",
  "1": "var(--sf-ui-1--control-height)",
  "2": "var(--sf-ui-2--control-height)",
  "3": "var(--sf-ui-3--control-height)",
};

// The look's class in the base component's markup. bordered (FM-9) draws the
// class layer's outlined modifier: .sf-dropdown--outlined stays the class
// markup's name, so pages written in classes and the first-paint snapshots
// keep drawing.
const LOOK_CLASS = Object.freeze({bordered: "outlined", outlined: "outlined", filled: "filled"});

export function renderDropdownTemplate(context) {
  const look = context.appearance ?? context.type;
  const rootClasses = [
    "sf-dropdown",
    context.rootClass,
    context.open ? "open" : "",
    context.open ? "sf-dropdown--open" : "",
    `sf-dropdown--size-${context.size}`,
    `sf-dropdown--${LOOK_CLASS[look] || look}`,
    context.mode === "tag" ? "sf-dropdown--tag" : "",
    context.layout === "grid" ? "sf-dropdown--grid" : "",
    context.mode !== "tag" ? "sf-dropdown--text" : "",
    context.disabled ? "disabled" : "",
    // The error look, as sf-input's root carries it (owner C55).
    context.invalid ? "error" : "",
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

  // The chevron is the field's indicator (owner decision C123 (3)): the field
  // layer's .sf-field-action, a glyph without a plate the size of the field's
  // leading picture, quiet at rest and the text's ink while the field is
  // under the pointer. It stays the button that holds the combobox's focus
  // and names (component/dropdown/interaction.js), the field's one Tab stop
  // whose ring the field draws; the whole field opens the list.
  // The chevron and the search glyph are sf-icon elements, as the pictures
  // of a choice are (1.8.0): the element tells the Loader its name, so it
  // joins the first icon font request instead of a later round (1.8.1).
  // Their size and colour stay the field's and the list's, which reach the
  // glyph inside the sf-icon (display: contents).
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
                  name=${context.controlName || nothing}
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
            name=${context.controlName || nothing}
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
            class="sf-field-action sf-field-action--indicator sf-dropdown-chevron"
            ?disabled=${context.disabled}
          >
            <sf-icon icon=${dropdownIcon} aria-hidden="true"></sf-icon>
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
          placeholder=${context.inheritedLabel || context.placeholder}
          type="text"
          class="cursor-pointer"
          aria-label=${context.accessibleName || nothing}
          .value=${context.triggerText || ""}
          readonly
          ?disabled=${context.disabled}
        />
        ${renderInheritedSlot(context.component, {size: context.size, disabled: context.disabled})}
        <button
          type="button"
          class="sf-field-action sf-field-action--indicator sf-dropdown-chevron absolute"
          ?disabled=${context.disabled}
        >
          <sf-icon icon=${dropdownIcon} aria-hidden="true"></sf-icon>
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
                ? html`<span class="sf-dropdown-required" aria-hidden="true">*</span>`
                : nothing}
              ${renderFieldHelp({help: context.help, label: context.label, size: context.size, className: 'sf-dropdown-help', component: context.component})}
            </span>
          `
        : nothing}
      ${renderTrigger()}
      ${context.message
        // Under the field, in sf-input's field-message type, at the field's
        // own gap (owner C55). No error icon, as sf-input draws none.
        ? html`<span
            id=${context.messageId}
            class="sf-dropdown-message"
            data-field-message=${context.messageIsError ? "error" : "hint"}
          >${context.message}</span>`
        : nothing}

      <div
        class=${`sf-list sf-list--size-${context.size} flex flex-col${
          context.component?.hasSlotContent?.('trigger') ? " sf-list--free-width" : ""
        }`}
        style=${`--sf-list--cell: ${CELL[context.size] || CELL["1"]}`}
        data-sf-list-width=${context.listWidth === "list" || context.listWidth === "trigger" ? context.listWidth : nothing}
        ?hidden=${!context.open}
      >
        ${context.search
          // The search is the panel's header (owner C06, docs review R029):
          // its icon over the rows' icons, its text over their text, no frame.
          ? html`
              <label class="sf-list-search">
                <sf-icon icon="search" root-class="sf-list-search-icon" aria-hidden="true"></sf-icon>
                <input
                  class="sf-list-search-input"
                  placeholder=${context.searchPlaceholder}
                  aria-label=${context.searchPlaceholder || nothing}
                  type="text"
                  .value=${context.searchValue || ""}
                  ?disabled=${context.disabled}
                  @input=${(event) => context.component.handleSearchInput(event)}
                  @change=${(event) => event.stopPropagation()}
                  @click=${(event) => event.stopPropagation()}
                />
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
            ${context.nothingFound
              // A search that finds nothing says so, under the search header
              // (FF-1): the header alone read as a list that had not loaded.
              ? html`<div class="sf-list-empty" role="status">${context.nothingFound}</div>`
              : nothing}
          </div>
        </div>
      </div>
    </div>
  `;
}

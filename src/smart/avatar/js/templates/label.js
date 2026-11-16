import { html, nothing } from "lit";
import { avatarButton } from "./shared";

// The name and the role wrap (owner decision C152 (7): a printed name is
// read whole, the class sheet breaks a word longer than the line); with
// no-wrap they end in an ellipsis and the full text is the line's title
// (register RG-S1-24, 2026-11-16).
export function renderLabelTemplate(context) {
  return html`
    <div
      class="sf-avatar-label-group sf-avatar-label-group--size-${context.size} flex items-cross-center ${context.rootClass ||
      ""}"
      style=${context.rootStyle || ""}
    >
      ${avatarButton(context, {
        includeRootClass: false,
        includeRootStyle: false,
        // The heading is printed beside the picture: the name is read once,
        // from the text (C152 (1)).
        nameShown: Boolean(context.heading),
      })}
      <div class="sf-avatar-label-group-container flex flex-col">
        ${context.heading
          ? html`<div class="sf-avatar-label-group-title${context.noWrap ? ' overflow-hidden wrap-none t-ellipsis' : ''}" title=${context.noWrap ? context.heading : nothing}>
              ${context.heading}
            </div>`
          : ""}
        ${context.description
          ? html`<div class="sf-avatar-label-group-text${context.noWrap ? ' overflow-hidden wrap-none t-ellipsis' : ''}" title=${context.noWrap ? context.description : nothing}>
              ${context.description}
            </div>`
          : ""}
      </div>
    </div>
  `;
}

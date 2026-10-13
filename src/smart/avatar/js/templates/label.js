import { html } from "lit";
import { avatarButton } from "./shared";

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
      })}
      <div class="sf-avatar-label-group-container flex flex-col">
        ${context.title
          ? html`<div class="sf-avatar-label-group-title${context.noWrap ? ' overflow-hidden wrap-none t-ellipsis' : ''}">
              ${context.title}
            </div>`
          : ""}
        ${context.description
          ? html`<div class="sf-avatar-label-group-text${context.noWrap ? ' overflow-hidden wrap-none t-ellipsis' : ''}">
              ${context.description}
            </div>`
          : ""}
      </div>
    </div>
  `;
}

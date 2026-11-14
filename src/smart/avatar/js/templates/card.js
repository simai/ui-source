import { html } from "lit";

// The media box without a photo (owner decision C124, 2026-11-13; research
// control/research/2026-11-13-avatar-placeholder.md): the initials of the
// name on the person's hue (the round avatar's hue="auto" rule), and with no
// name a person glyph on the neutral fill. The heading beside it already
// names the person, so the box is decoration for assistive technology.
function cardPlaceholder(context) {
  if (context.isText) {
    const hue = context.resolvedHue ? ` sf-hue-${context.resolvedHue}` : "";

    return html`<div
      class="sf-avatar-card-placeholder sf-avatar-card-placeholder--text${hue} flex items-center justify-center w-full h-full"
      aria-hidden="true"
    ><span class="sf-avatar-card-initials">${context.text}</span></div>`;
  }

  return html`<div
    class="sf-avatar-card-placeholder sf-avatar-card-placeholder--icon flex items-center justify-center w-full h-full"
    aria-hidden="true"
  ><i class="sf-icon" aria-hidden="true">person</i></div>`;
}

export function renderCardTemplate(context) {
  const variant = context.cardVariant || "square";
  const imageAlt = context.imageAlt || "";

  return html`
    <div
      class="sf-avatar-card sf-avatar-card--${variant} sf-avatar-card-${variant} flex flex-col ${context.rootClass ||
      ""}"
      style=${context.rootStyle || ""}
    >
      <div class="sf-avatar-card-image flex flex-col">
        ${context.imageUrl
          ? html`<img src=${context.imageUrl} alt=${imageAlt} />`
          : cardPlaceholder(context)}
      </div>
      <div class="sf-avatar-card-content flex-1 flex flex-col">
        ${context.heading
          ? html`<div class="sf-avatar-card-title">${context.heading}</div>`
          : ""}
        ${context.meta || context.description
          ? html`
              <div class="sf-avatar-card-row flex flex-row items-center">
                ${context.metaIcon
                  ? html`<i class="sf-icon">${context.metaIcon}</i>`
                  : ""}
                <span>${context.meta || context.description}</span>
              </div>
            `
          : ""}
      </div>
    </div>
  `;
}

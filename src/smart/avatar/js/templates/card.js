import { html } from "lit";

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
          : html`<div
              class="sf-avatar-card-placeholder bg-surface-container w-full h-full"
              aria-hidden="true"
            ></div>`}
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

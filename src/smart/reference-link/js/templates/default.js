import { html, nothing } from 'lit';

export function renderReferenceLinkTemplate(context) {
  const { component, appearance, icon, label, text, href, target, disabled, ariaLabel, rootClass, size, line } =
    context;

  const rootClasses = [
    'sf-reference-link',
    size ? `sf-reference-link--size-${size}` : '',
    line ? `sf-reference-link--line-${line}` : '',
    appearance === 'plain' ? 'sf-reference-link--plain' : '',
    'flex',
    'items-cross-center',
    disabled ? 'disabled' : '',
    rootClass,
  ]
    .filter(Boolean)
    .join(' ');

  const labelContent =
    component?.hasSlotContent?.('label')
      ? component.getSlotContent('label')
      : label;

  const textContent =
    component?.hasSlotContent?.('text')
      ? component.getSlotContent('text')
      : text;

  const linkContent =
    href && !disabled
      ? html`
          <a class="sf-reference-link__link"
            href=${href}
            target=${target || nothing}
            rel=${target && target !== '_self' ? 'noopener noreferrer' : nothing}
            aria-label=${ariaLabel || nothing}
          >
            ${labelContent}
          </a>
        `
      : html`<span>${labelContent}</span>`;

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      @click=${component?.handleRootClick}
      aria-disabled=${disabled ? 'true' : nothing}
    >
      <div class="sf-reference-link__main sf-reference-link-left">
        ${icon ? html`<i class="sf-reference-link__icon sf-icon" aria-hidden="true">${icon}</i>` : nothing}
        ${linkContent}
      </div>
      <div class="sf-reference-link__meta sf-reference-link-text">${textContent}</div>
    </div>
  `;
}

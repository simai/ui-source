import { html, nothing } from 'lit';

function createIcon(name) {
  if (!name) return nothing;

  return html`
    <span class="sf-badge-icon-container flex justify-center items-center">
      <i class="sf-icon flex justify-center items-center" aria-hidden="true">${name}</i>
    </span>
  `;
}

export function renderBadgeTemplate(context) {
  const normalizedIconPosition = String(context.iconPosition || 'start').toLowerCase();
  const isIconEnd = ['right', 'end'].includes(normalizedIconPosition);
  const leftIconName = context.iconStart ?? (context.iconLeft || (context.icon && !isIconEnd ? context.icon : ''));
  const rightIconName = context.iconEnd ?? (context.iconRight || (context.icon && isIconEnd ? context.icon : ''));

  const leftIconContent = context.component?.hasSlotContent?.('icon-start')
    ? context.component.getSlotContent('icon-start')
    : context.component?.hasSlotContent?.('icon-left')
    ? context.component.getSlotContent('icon-left')
    : createIcon(leftIconName);

  const rightIconContent = context.component?.hasSlotContent?.('icon-end')
    ? context.component.getSlotContent('icon-end')
    : context.component?.hasSlotContent?.('icon-right')
    ? context.component.getSlotContent('icon-right')
    : createIcon(rightIconName);

  const hasTextSlot = context.component?.hasSlotContent?.('text');
  const hasTextContent = hasTextSlot || String(context.text ?? '').length > 0;
  const hasAccessibleLabel = String(context.ariaLabel || '').length > 0;
  const textContent = hasTextSlot
    ? context.component.getSlotContent('text')
    : context.text;

  const classes = [
    'sf-badge',
    `sf-badge--${context.appearance ?? context.type}`,
    // One colour name, as the styles expect: the status when one is set, the
    // colour role otherwise.
    `sf-badge--${context.status || context.scheme}`,
    `sf-badge--size-${context.size}`,
    context.line ? `sf-badge--line-${context.line}` : '',
    // Inline: a badge is as wide as its text. As a block-level flex box it
    // filled whatever held it -- every status in a table cell was a bar the
    // width of the column.
    'inline-flex',
    'flex-row',
    'flex-nowrap',
    'justify-center',
    'items-center',
    context.rootClass,
  ].filter(Boolean);

  return html`
    <span
      class=${classes.join(' ')}
      style=${context.rootStyle || nothing}
      aria-hidden=${!hasTextContent && !hasAccessibleLabel ? 'true' : nothing}
    >
      ${hasAccessibleLabel ? html`<span class="sr-only">${context.ariaLabel}</span>` : nothing}
      ${leftIconContent}
      ${hasTextContent
        ? html`
            <span
              class="sf-badge-text-container flex items-center"
              aria-hidden=${hasAccessibleLabel ? 'true' : nothing}
            >
              <span class="sf-badge-text">${textContent}</span>
            </span>
          `
        : nothing}
      ${rightIconContent}
    </span>
  `;
}

import { html, nothing } from 'lit';
import { createInlineSpinner } from '../../../../component/spinner/js/_spinner-draw';

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
  const leftIconName = context.iconStart ?? (context.iconLeft || (context.drawnIcon && !isIconEnd ? context.drawnIcon : ''));
  const rightIconName = context.iconEnd ?? (context.iconRight || (context.drawnIcon && isIconEnd ? context.drawnIcon : ''));

  // A run state always has a shape, so it is not told by colour alone: at the
  // icon's place the mark stands in for no icon, an emptied icon-start included.
  const drawIcon = (name, isMarkPlace) => {
    if (name || !isMarkPlace || !context.activity) return createIcon(name);
    return context.activitySpinner
      ? createInlineSpinner({className: 'sf-badge-spinner'})
      : createIcon(context.drawnIcon);
  };

  const leftIconContent = context.component?.hasSlotContent?.('icon-start')
    ? context.component.getSlotContent('icon-start')
    : context.component?.hasSlotContent?.('icon-left')
    ? context.component.getSlotContent('icon-left')
    : drawIcon(leftIconName, !isIconEnd);

  const rightIconContent = context.component?.hasSlotContent?.('icon-end')
    ? context.component.getSlotContent('icon-end')
    : context.component?.hasSlotContent?.('icon-right')
    ? context.component.getSlotContent('icon-right')
    : drawIcon(rightIconName, isIconEnd);

  const hasTextSlot = context.component?.hasSlotContent?.('text');
  const hasTextContent = hasTextSlot || String(context.drawnText ?? '').length > 0;
  const hasAccessibleLabel = String(context.ariaLabel || '').length > 0;
  const textContent = hasTextSlot
    ? context.component.getSlotContent('text')
    : context.drawnText;
  // Compact needs something to show: with no icon the text stays visible.
  const isCompact = Boolean(context.compact) && (leftIconContent !== nothing || rightIconContent !== nothing);

  const classes = [
    'sf-badge',
    `sf-badge--${context.appearance ?? context.type}`,
    // One colour name, as the styles expect: the run state's role, the status
    // or the colour role (the component's paintedScheme).
    `sf-badge--${context.paintedScheme}`,
    `sf-badge--size-${context.size}`,
    context.line ? `sf-badge--line-${context.line}` : '',
    isCompact ? 'sf-badge--compact' : '',
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
              class=${`sf-badge-text-container flex items-center${isCompact ? ' sr-only' : ''}`}
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

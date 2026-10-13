import { html, nothing } from 'lit';

function contentTemplate(context) {
  if (context.component?.hasSlotContent?.('content')) {
    return context.component.getSlotContent('content');
  }

  const textContent = context.component?.hasSlotContent?.('text')
    ? context.component.getSlotContent('text')
    : context.text;

  const supportingContent = context.component?.hasSlotContent?.('supporting-text')
    ? context.component.getSlotContent('supporting-text')
    : context.supportingText;

  return html`
    <div class="sf-tooltip-content flex flex-col">
      <div class="sf-tooltip-wrap flex flex-col">
        ${textContent
          ? html`<div class="sf-tooltip-text">${textContent}</div>`
          : nothing}
        ${supportingContent
          ? html`<div class="sf-tooltip-supporting-text">${supportingContent}</div>`
          : nothing}
      </div>
    </div>
  `;
}

function tailTemplate(context) {
  if (context.component?.hasSlotContent?.('tail')) {
    return context.component.getSlotContent('tail');
  }

  return html`<div class="sf-tooltip-tail" aria-hidden="true"></div>`;
}

export function renderTooltipTemplate(context) {
  const classes = [
    'sf-tooltip',
    `sf-tooltip--${context.appearance ?? context.type}`,
    `sf-tooltip--arrow-${context.arrow}`,
    `sf-tooltip--size-${context.size}`,
    'relative',
    context.rootClass,
  ].filter(Boolean);

  return html`
    <div class=${classes.join(' ')} style=${context.rootStyle || nothing}>
      ${contentTemplate(context)}
      ${tailTemplate(context)}
    </div>
  `;
}

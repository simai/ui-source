import { html, nothing } from 'lit';

export function renderCloseTemplate(context) {
  const classes = [
    'sf-close',
    `sf-close--size-${context.size || '1/3'}`,
    'flex',
    'justify-center',
    'items-center',
    context.rootClass,
  ]
    .filter(Boolean)
    .join(' ');

  return html`<span class="${classes}" style=${context.rootStyle || nothing} aria-hidden="true"><span class="sf-close-icon"></span></span>`;
}

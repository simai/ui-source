import { html, nothing } from 'lit';
import './default.css';

// The control ladder of the box (the icon button's sizes). A glyph-only size
// draws a button at the nearest ladder step: 1/4 at 1/3, 4-7 at 3.
const LADDER = new Set(['1/3', '1/2', '1', '2', '3']);

export function buttonSize(size) {
  if (LADDER.has(size)) return size;
  return size === '1/4' ? '1/3' : '3';
}

function renderCross(size, rootClass, rootStyle) {
  const classes = [
    'sf-close',
    `sf-close--size-${size || '1/3'}`,
    'flex',
    'justify-center',
    'items-center',
    rootClass,
  ]
    .filter(Boolean)
    .join(' ');

  return html`<span class="${classes}" style=${rootStyle || nothing} aria-hidden="true"><span class="sf-close-icon"></span></span>`;
}

// The close button (owner decision C14): a native button in the icon button's
// box, the cross inside it. Inside a containing button (context.glyph) the
// element draws only the decorative cross, as it did before 1.2.0.
// The box and the cross are drawn at context.placeSize, the size the place
// resolves (1.3.0, DEV D1 on C35); context.size is the declared size.
export function renderCloseTemplate(context) {
  const drawn = context.placeSize || context.size;
  if (context.glyph) return renderCross(drawn, context.rootClass, context.rootStyle);

  const size = buttonSize(drawn || '1/3');
  const classes = [
    'sf-icon-button',
    `sf-icon-button--size-${size}`,
    // The height (decisions C27, C35): the icon button's class of the size's
    // tightness step; default draws none.
    ['low', 'high', 'highest'].includes(context.height) ? `sf-icon-button--height-${context.height}` : '',
    'sf-icon-button--close',
    'sf-button-close',
    `sf-button-close--${context.appearance || 'ghost'}`,
    `sf-button-close--${context.scheme || 'on-surface'}`,
    context.backdrop === 'color' ? 'sf-button-close--backdrop-color' : '',
    context.radius === 'rounded' ? 'sf-button-close--radius-rounded' : '',
    'flex',
    'items-cross-center',
    context.rootClass,
  ]
    .filter(Boolean)
    .join(' ');

  return html`<button
    type="button"
    class=${classes}
    style=${context.rootStyle || nothing}
    aria-label=${context.label}
    ?disabled=${context.disabled}
  >${renderCross(size, 'pointer-event-none', '')}</button>`;
}

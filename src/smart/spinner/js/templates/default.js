import { html, nothing } from 'lit';

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

function valueOrNothing(value) {
  return value === '' || value === null || value === undefined ? nothing : String(value);
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function renderSpinnerTemplate(context) {
  const rootClasses = joinClasses(
    'sf-loader-container',
    `sf-loader--size-${normalizeChoice(context.size, ['1/2', '1', '2', '3'], '1')}`,
    context.rootClass,
  );

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      data-variant=${valueOrNothing(context.kind ?? context.variant)}
      data-width=${valueOrNothing(context.width)}
      data-height=${valueOrNothing(context.height)}
      data-label=${context.label ?? nothing}
      data-dots=${valueOrNothing(context.dots)}
      data-filled=${valueOrNothing(context.filled)}
      data-stroke-width=${valueOrNothing(context.strokeWidth)}
      data-dot-radius=${valueOrNothing(context.dotRadius)}
      data-infinite=${String(!!context.infinite)}
      data-announce=${String(!!context.announce)}
      data-direction=${normalizeChoice(
        context.direction,
        ['clockwise', 'counterclockwise'],
        'clockwise',
      )}
    ></div>
  `;
}

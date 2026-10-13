import { html, nothing } from 'lit';

function normalizeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, parsed));
}

function normalizeSize(value) {
  const normalized = String(value || '').toLowerCase();
  return ['1/3', '1/2', '1', '2', '3'].includes(normalized) ? normalized : '1';
}

// The component normalises the legacy words, so the template sees the shared
// vocabulary. `neutral` carries no class of its own, exactly as `primary` did.
function normalizeStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return ['neutral', 'info', 'success', 'warning', 'error'].includes(normalized)
    ? normalized
    : 'neutral';
}

export function renderProgressBarTemplate(context) {
  const { value, textPosition } = context;
  const size = normalizeSize(context.size);
  const tone = normalizeStatus(context.status ?? context.tone);
  const normalizedValue = normalizeValue(value);
  const normalizedPosition = ['none', 'right', 'inline-end', 'bottom'].includes(textPosition)
    ? textPosition
    : 'none';

  const rootClasses = ['sf-progress-bar', `sf-progress-bar--size-${size}`, `sf-progress-bar--${tone}`, 'flex', context.rootClass].filter(Boolean);
  if (normalizedPosition === 'right' || normalizedPosition === 'inline-end') {
    rootClasses.push('flex-row', 'items-cross-center');
  } else if (normalizedPosition === 'bottom') {
    rootClasses.push('flex-col', 'items-cross-end');
  }

  return html`
    <div
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-value=${String(normalizedValue)}
      data-position=${normalizedPosition}
      data-tone=${tone}
      data-label=${context.label || nothing}
      data-value-text=${context.valueText || nothing}
      role="progressbar"
      aria-label=${context.label || nothing}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${String(normalizedValue)}
      aria-valuetext=${context.valueText || nothing}
    >
      <div class="sf-progress-bar-main">
        <div class="sf-progress-bar-progress transition"></div>
      </div>
      ${normalizedPosition !== 'none'
        ? html`<div class="sf-progress-bar-text">${normalizedValue}%</div>`
        : nothing}
    </div>
  `;
}

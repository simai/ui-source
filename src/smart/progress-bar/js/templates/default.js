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
// vocabulary (owner decision C131 (1)): no status (empty) draws the theme's
// primary and carries no class; neutral is grey, as in sf-dot and sf-badge.
function normalizeStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return ['neutral', 'info', 'success', 'warning', 'error'].includes(normalized)
    ? normalized
    : '';
}

// top | inline-end | none (C131 (4)); bottom and right are the former words.
const FORMER_POSITIONS = { bottom: 'top', right: 'inline-end' };
function normalizePosition(value) {
  const named = FORMER_POSITIONS[value] ?? value;
  return ['none', 'top', 'inline-end'].includes(named) ? named : 'none';
}

const on = (value) => value === true || value === '' || value === 'true';

export function renderProgressBarTemplate(context) {
  const { value, textPosition } = context;
  const size = normalizeSize(context.size);
  const tone = normalizeStatus(context.drawnStatus ?? context.status ?? context.tone);
  const normalizedValue = normalizeValue(value);
  const normalizedPosition = normalizePosition(textPosition);

  // A meter (C131 (7)) shows an amount within a known range: it always has a
  // value, so it is never indeterminate.
  const meter = on(context.meter);
  const indeterminate = Boolean(context.indeterminate) && !meter;
  const paused = Boolean(context.paused);
  const rootClasses = ['sf-progress-bar', `sf-progress-bar--size-${size}`, tone ? `sf-progress-bar--${tone}` : '', indeterminate ? 'sf-progress-bar--indeterminate' : '', paused ? 'sf-progress-bar--paused' : '', 'flex', context.rootClass].filter(Boolean);
  if (normalizedPosition === 'inline-end') {
    rootClasses.push('flex-row', 'items-cross-center');
  } else if (normalizedPosition === 'top') {
    rootClasses.push('flex-col');
  }
  const valueText = `${normalizedValue}%`;

  return html`
    <div
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-value=${String(normalizedValue)}
      data-position=${normalizedPosition}
      data-tone=${tone}
      data-label=${context.label || nothing}
      data-value-text=${(context.spokenValueText ?? context.valueText) || nothing}
      data-indeterminate=${indeterminate ? 'true' : nothing}
      data-paused=${paused ? 'true' : nothing}
      data-meter=${meter ? 'true' : nothing}
      role=${meter ? 'meter' : 'progressbar'}
      aria-label=${context.label || nothing}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${indeterminate ? nothing : String(normalizedValue)}
      aria-valuetext=${(context.spokenValueText ?? context.valueText) || nothing}
    >
      ${normalizedPosition === 'top'
        ? html`<div class="sf-progress-bar-head" aria-hidden="true">${context.label
          ? html`<span class="sf-progress-bar-label">${context.label}</span>`
          : nothing}${indeterminate ? nothing : html`<span class="sf-progress-bar-text">${valueText}</span>`}</div>`
        : nothing}
      <div class="sf-progress-bar-main">
        <div class="sf-progress-bar-progress transition"></div>
      </div>
      ${normalizedPosition === 'inline-end' && !indeterminate
        ? html`<div class="sf-progress-bar-text" aria-hidden="true">${valueText}</div>`
        : nothing}
    </div>
  `;
}

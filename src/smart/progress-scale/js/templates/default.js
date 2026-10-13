import { html, nothing } from 'lit';

function normalizeProgressValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

function normalizeScaleStep(value) {
  const normalized = normalizeProgressValue(value);
  return Math.ceil(normalized / 10) * 10;
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

export function renderProgressScaleTemplate(context) {
  const size = normalizeSize(context.size);
  const value = normalizeProgressValue(context.value);
  const step = normalizeScaleStep(value);
  const tone = normalizeStatus(context.status ?? context.tone);
  const rootClasses = [
    'sf-progress-scale',
    `sf-progress-scale--size-${size}`,
    `sf-progress-scale--${tone}`,
    // On a text line the track and the value share the line; otherwise the
    // value stands under the track.
    ...(context.line ? [`sf-progress-scale--line-${context.line}`, 'flex', 'flex-row', 'items-cross-center'] : ['flex', 'flex-col']),
    context.rootClass,
  ].filter(Boolean);

  if (step > 0) {
    rootClasses.push(`sf-progress-scale--${step}`);
  }

  return html`
    <div
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-value=${String(value)}
      data-size=${size}
      data-tone=${tone}
      data-show-text=${String(Boolean(context.showText))}
      data-label=${context.label || nothing}
      data-value-text=${context.valueText || nothing}
      role="progressbar"
      aria-label=${context.label || nothing}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${String(value)}
      aria-valuetext=${context.valueText || nothing}
    >
      <div class="sf-progress-scale-container grid grid-col-10 overflow-hidden">
        ${Array.from({ length: 10 }, () => html`<div class="sf-progress-scale-block"></div>`)}
      </div>
      ${context.showText
        ? html`<div class="sf-progress-scale-text">${value}%</div>`
        : nothing}
    </div>
  `;
}

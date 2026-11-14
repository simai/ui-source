import { html, nothing } from 'lit';

function normalizeProgressValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

// The blocks never show more than is done (PG-12): 61 % lights 6 of 10, not 7;
// a block lights only once its tenth is reached. The epsilon keeps a value
// that is a whole tenth in decimal (70) from falling a block short in binary.
function normalizeScaleStep(value) {
  const normalized = normalizeProgressValue(value);
  return Math.floor(normalized / 10 + 1e-9) * 10;
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

const on = (value) => value === true || value === '' || value === 'true';

// A level of N (owner decision C185 (5)): 2..10 steps, or none (ten, a
// percent scale). The value lights the steps it reaches, rounded down.
function normalizeSteps(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(2, Math.min(10, parsed)) : 10;
}

export function renderProgressScaleTemplate(context) {
  const size = normalizeSize(context.size);
  const value = normalizeProgressValue(context.value);
  const levelSteps = normalizeSteps(context.steps);
  const steps = levelSteps ?? 10;
  // The class lights the first n blocks (sf-progress-scale--<n*10>).
  const step = levelSteps ? Math.floor((value / 100) * steps + 1e-9) * 10 : normalizeScaleStep(value);
  const lit = step / 10;
  const words = levelSteps
    ? (typeof context.levelWords === 'function' ? context.levelWords(lit, steps) : `${lit} / ${steps}`)
    : '';
  const valueText = context.valueText || words;
  const tone = normalizeStatus(context.drawnStatus ?? context.status ?? context.tone);
  const meter = on(context.meter);
  const rootClasses = [
    'sf-progress-scale',
    `sf-progress-scale--size-${size}`,
    tone ? `sf-progress-scale--${tone}` : '',
    // On a text line the track and the value share the line, and a level's
    // value stands at the row's end; otherwise the value stands under the
    // track.
    levelSteps ? 'sf-progress-scale--level' : '',
    ...(context.line ? [`sf-progress-scale--line-${context.line}`, 'flex', 'flex-row', 'items-cross-center'] : levelSteps ? ['flex', 'flex-row'] : ['flex', 'flex-col']),
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
      data-tone=${tone || nothing}
      data-meter=${meter ? 'true' : nothing}
      data-steps=${levelSteps ? String(levelSteps) : nothing}
      data-show-text=${String(Boolean(context.showText))}
      data-label=${context.label || nothing}
      data-value-text=${context.valueText || nothing}
      role=${meter ? 'meter' : 'progressbar'}
      aria-label=${context.label || nothing}
      aria-valuemin="0"
      aria-valuemax=${levelSteps ? String(steps) : '100'}
      aria-valuenow=${levelSteps ? String(lit) : String(value)}
      aria-valuetext=${valueText || nothing}
    >
      <div class=${steps === 10 ? 'sf-progress-scale-container grid grid-col-10 overflow-hidden' : 'sf-progress-scale-container grid overflow-hidden'}>
        ${Array.from({ length: steps }, () => html`<div class="sf-progress-scale-block"></div>`)}
      </div>
      ${context.showText
        ? html`<div class="sf-progress-scale-text">${levelSteps ? valueText : `${value}%`}</div>`
        : nothing}
    </div>
  `;
}

import {html, nothing} from 'lit';

// sf-tile-metric's markup (scss/ draws it on one rung of the ladder).
//
// - The root is the tile's one target when it has one: a link (href) or a
//   native button (openable), with nothing interactive inside it; otherwise a
//   group named by its label. Inside a button only phrasing content belongs,
//   so every part is a span the sheet lays out.
// - The change says its direction in words (visually hidden) beside the arrow
//   of a tonal sf-badge, the status its word beside the icon, so colour is
//   never the only sign.
// - The limit is a meter; the sf-progress-bar under it is its picture
//   (aria-hidden), with the page's thresholds.
// - loading keeps the label and draws a skeleton bar on each line that waits.

// The rung below the tile's: the label, the change, the limit's words and the hint.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};

const skeleton = (part) => html`<span class=${`sf-tile-metric-skeleton sf-tile-metric-skeleton--${part}`} aria-hidden="true"></span>`;

function renderDelta(context) {
  const {delta, size} = context;
  if (!delta) return nothing;
  return html`<span class="sf-tile-metric-delta">
    <sf-badge class="sf-tile-metric-change" data-tone=${delta.tone} appearance="tonal" size=${BELOW[size]}
      status=${delta.badge || nothing} icon-start=${delta.arrow} text=${delta.text}></sf-badge>
    <span class="sr-only">${delta.word}</span>
    ${context.periodText ? html`<span class="sf-tile-metric-period">${context.periodText}</span>` : nothing}
  </span>`;
}

function renderMeter(context) {
  const {meter, size} = context;
  if (!meter) return nothing;
  return html`<span class="sf-tile-metric-meter" role="meter" aria-label=${meter.name}
      aria-valuemin="0" aria-valuemax=${String(meter.max)} aria-valuenow=${String(meter.value)} aria-valuetext=${meter.text}>
    <sf-progress-bar class="sf-tile-metric-bar" aria-hidden="true" size=${size} value=${String(meter.percent)}
      status=${context.status} warning-at=${meter.warningAt ?? nothing} error-at=${meter.errorAt ?? nothing}></sf-progress-bar>
    <span class="sf-tile-metric-limit" aria-hidden="true">${meter.text}</span>
  </span>`;
}

function renderStatus(context) {
  const {status, hint} = context;
  if (status === 'neutral' && !hint) return nothing;
  return html`<span class=${`sf-tile-metric-status sf-tile-metric-status--${status}`}>
    ${status === 'neutral' ? nothing : html`<i class="sf-icon sf-tile-metric-status-icon" aria-hidden="true">${context.statusIcon}</i>`}
    ${context.statusWord ? html`<span class="sr-only">${context.statusWord}${hint ? ': ' : ''}</span>` : nothing}
    ${hint ? html`<span class="sf-tile-metric-hint">${hint}</span>` : nothing}
  </span>`;
}

function renderBody(context) {
  const {loading, uid} = context;
  return html`
    <span class="sf-tile-metric-label" id=${`${uid}-label`}>${context.label}</span>
    <span class="sf-tile-metric-figure">
      ${loading
        ? html`${skeleton('value')}<span class="sr-only">${context.loadingWord}</span>`
        : html`<span class="sf-tile-metric-value">${context.valueText}</span>${context.unit ? html`<span class="sf-tile-metric-unit">${context.unit}</span>` : nothing}`}
    </span>
    ${loading ? html`<span class="sf-tile-metric-delta">${skeleton('line')}</span>` : renderDelta(context)}
    ${renderMeter(context)}
    ${loading ? nothing : renderStatus(context)}
  `;
}

export function renderTileMetricTemplate(context) {
  const {loading, uid, target} = context;
  const size = context.size === '1/2' ? 'half' : context.size;
  const classes = [
    'sf-tile-metric',
    `sf-tile-metric--size-${size}`,
    `sf-tile-metric--${context.status}`,
    loading ? 'sf-tile-metric--loading' : '',
    target ? 'sf-tile-metric--target' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const busy = loading ? 'true' : 'false';
  const chart = html`<span class="sf-tile-metric-chart" ?hidden=${!context.hasChart}>${context.chart ?? nothing}</span>`;
  if (target === 'link') {
    return html`<a class=${classes} style=${context.rootStyle || nothing} href=${context.href} aria-busy=${busy}>${renderBody(context)}${chart}</a>`;
  }
  if (target === 'button') {
    return html`<button type="button" class=${classes} style=${context.rootStyle || nothing} aria-busy=${busy}
      @click=${() => context.component.open()}>${renderBody(context)}${chart}</button>`;
  }
  return html`<div class=${classes} style=${context.rootStyle || nothing} role="group" aria-labelledby=${`${uid}-label`} aria-busy=${busy}>${renderBody(context)}${chart}</div>`;
}

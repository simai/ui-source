import {html, nothing} from 'lit';

// sf-tile-metric's markup (scss/ draws it on one rung of the ladder).
//
// - The root is the tile's one target when it has one: a link (href) or a
//   native button (openable), with nothing interactive inside it; otherwise a
//   group named by its label. Inside a button only phrasing content belongs,
//   so every part is a span the sheet lays out.
// - The change says its direction in words (visually hidden) beside the arrow
//   of a tonal sf-badge (C140); no change is the visible words «без
//   изменений», no badge and no sign (C168 (1)). The status says its word
//   beside the icon, so colour is
//   never the only sign. With a hint the word is said before it (visually
//   hidden); without one the word is the line's text («Внимание»), so a
//   threshold that fired is never an icon alone.
// - The limit is a meter; the sf-progress-bar under it is its picture
//   (aria-hidden), with the page's thresholds.
// - loading keeps the label and draws each line that waits in its own place,
//   as tall as the line that comes (owner decision C130 (2); tile study
//   TM-1): the value a first-paint bar in the value's own type, the change
//   the change badge's own box, the limit the meter's own bar and its words'
//   line, the status its hint's line. Which lines wait is what the settings
//   promise (index.js skeleton()). The bars are core's .sf-first-paint-bar
//   (C136: the capitals' height in the middle of the line, the 12 % fill and
//   the pulse, C130 (3), (4)); a box (the badge, the bar) keeps its real part
//   hidden under one fill of the control radius, so it is exactly as big.

// The rung below the tile's: the label, the change, the limit's words and the hint.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};

const bar = (words) => html`<span class="sf-first-paint-bar">${words}</span>`;
const shape = (part) => html`<span class="sf-tile-metric-skeleton sf-tile-metric-skeleton--shape" aria-hidden="true">${part}</span>`;

function renderWaiting(context) {
  const {skeleton, size} = context;
  return html`
    ${skeleton.change ? html`<span class="sf-tile-metric-delta" aria-hidden="true">
      ${shape(html`<sf-badge appearance="tonal" size=${BELOW[size]} icon-start="arrow_upward" text=${skeleton.change}></sf-badge>`)}
      ${context.periodText ? html`<span class="sf-tile-metric-period">${bar(context.periodText)}</span>` : nothing}
    </span>` : nothing}
    ${skeleton.limit ? html`<span class="sf-tile-metric-meter" aria-hidden="true">
      ${shape(html`<sf-progress-bar class="sf-tile-metric-bar" size=${size} value="0"></sf-progress-bar>`)}
      <span class="sf-tile-metric-limit">${bar(skeleton.limit)}</span>
    </span>` : nothing}
    ${skeleton.status ? html`<span class="sf-tile-metric-status" aria-hidden="true"><span class="sf-tile-metric-hint">${bar(skeleton.status)}</span></span>` : nothing}
  `;
}

function renderDelta(context) {
  const {change: delta, size} = context;
  if (!delta) return nothing;
  // No change is said in words on the change's line, with no badge and no
  // sign: a grey «− 0» read as a fall (owner C168 (1), 2026-11-14).
  if (delta.direction === 'flat') {
    return html`<span class="sf-tile-metric-delta">
      <span class="sf-tile-metric-flat">${delta.word}</span>
      ${context.periodText ? html`<span class="sf-tile-metric-period">${context.periodText}</span>` : nothing}
    </span>`;
  }
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
      status=${context.status === 'neutral' ? nothing : context.status} warning-at=${meter.warningAt ?? nothing} error-at=${meter.errorAt ?? nothing}></sf-progress-bar>
    <span class="sf-tile-metric-limit" aria-hidden="true">${meter.text}</span>
  </span>`;
}

function renderStatus(context) {
  const {status, hint} = context;
  if (status === 'neutral' && !hint) return nothing;
  return html`<span class=${`sf-tile-metric-status sf-tile-metric-status--${status}`}>
    ${status === 'neutral' ? nothing : html`<i class="sf-icon sf-tile-metric-status-icon" aria-hidden="true">${context.statusIcon}</i>`}
    ${context.statusWord && hint ? html`<span class="sr-only">${context.statusWord}: </span>` : nothing}
    ${hint || context.statusWord ? html`<span class="sf-tile-metric-hint">${hint || context.statusWord}</span>` : nothing}
  </span>`;
}

function renderBody(context) {
  const {loading, uid} = context;
  return html`
    <span class="sf-tile-metric-label" id=${`${uid}-label`}>${context.labelShown}</span>
    <span class="sf-tile-metric-figure">
      ${loading
        ? html`<span class="sf-tile-metric-value sf-tile-metric-skeleton" aria-hidden="true">${bar(context.skeleton.value)}</span>${context.unit ? html`<span class="sf-tile-metric-unit">${context.unit}</span>` : nothing}<span class="sr-only">${context.loadingWord}</span>`
        : html`<span class="sf-tile-metric-value">${context.valueShown}</span>${context.unit ? html`<span class="sf-tile-metric-unit">${context.unit}</span>` : nothing}`}
    </span>
    ${loading ? renderWaiting(context) : html`${renderDelta(context)}${renderMeter(context)}${renderStatus(context)}`}
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

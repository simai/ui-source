import { html, nothing } from 'lit';

const SIZES = ['1/2', '1', '2'];
const STATUSES = ['neutral', 'info', 'success', 'warning', 'error'];

// A number from 0 to 100; anything else reads 0.
export function normalizeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

const on = (value) => value === true || value === '' || value === 'true';

// The class markup of the ring (src/component/progress-ring): the root holds
// the value as --sf-progress-ring--value, the ring (.sf-progress-ring-indicator)
// carries the role and the value, and the middle holds the slot content or the
// percentage, which is aria-hidden: the ring says the value once.
export function renderProgressRingTemplate(context) {
  const size = SIZES.includes(String(context.size)) ? String(context.size) : '1';
  const status = STATUSES.includes(String(context.status)) ? String(context.status) : 'neutral';
  const indeterminate = on(context.indeterminate);
  const meter = on(context.meter);
  const value = normalizeValue(context.value);
  const role = meter ? 'meter' : 'progressbar';
  // A meter always has a value; only a progressbar can be indeterminate.
  const unknown = indeterminate && !meter;
  const text = on(context.showText) && !unknown ? `${value}%` : '';
  const content = context.content && context.content !== nothing ? context.content : null;

  const rootClasses = [
    'sf-progress-ring',
    `sf-progress-ring--size-${size}`,
    status === 'neutral' ? '' : `sf-progress-ring--${status}`,
    unknown ? 'sf-progress-ring--indeterminate' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const style = [`--sf-progress-ring--value: ${unknown ? 0 : value}`, context.rootStyle].filter(Boolean).join('; ');

  return html`
    <div class=${rootClasses} style=${style} data-value=${String(value)} data-status=${status}>
      <span
        class="sf-progress-ring-indicator"
        role=${role}
        aria-label=${context.label || nothing}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${unknown ? nothing : String(value)}
        aria-valuetext=${unknown ? nothing : (context.valueText || nothing)}
      ></span>
      ${content
        ? html`<span class="sf-progress-ring-content">${content}</span>`
        : text
          ? html`<span class="sf-progress-ring-content" aria-hidden="true">${text}</span>`
          : nothing}
    </div>
  `;
}

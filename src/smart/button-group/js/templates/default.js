import { html, nothing } from 'lit';

function segmentFor(index, total) {
  if (total <= 1) return '';
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'middle';
}

function renderItem(item, index, context) {
  const selected = item.value === context.value;
  const disabled = context.disabled || item.disabled;

  return html`
    <sf-button
      text=${item.label}
      icon=${item.icon || nothing}
      size=${context.size}
      spacing=${context.spacing && context.spacing !== 'normal' ? context.spacing : nothing}
      appearance=${selected ? 'default' : 'outline'}
      scheme=${selected ? context.scheme : 'on-surface'}
      segment=${segmentFor(index, context.items.length)}
      data-sf-button-group-value=${item.value}
      aria-label=${item.ariaLabel || nothing}
      class=${selected ? 'active' : nothing}
      ?disabled=${disabled}
    ></sf-button>
  `;
}

// The segmented appearance draws each segment as a native button with the
// button's own size, spacing and text classes, so a segment is exactly as tall
// as a button of the same size. All segments carry the same appearance class:
// the plate under the selected one is a fill, never a change of type or weight,
// so selecting a segment never changes its width. The group sheet paints them.
function renderSegment(item, context) {
  const selected = item.value === context.value;
  const disabled = context.disabled || item.disabled;
  const classes = [
    'sf-button',
    `sf-button--size-${context.size}`,
    'sf-button--link',
    'sf-button--on-surface',
    'flex',
    'items-cross-center',
    'sf-button-group-segment',
    item.iconOnly ? 'sf-button-group-icon-only' : '',
    context.spacing && context.spacing !== 'normal' ? `spacing-${context.spacing}` : '',
    selected ? 'active' : '',
  ].filter(Boolean).join(' ');
  // The count stands next to the label with no space between the two nodes, so
  // the name is composed here: the label (or the item's aria-label), then the
  // count, as it is read on screen.
  const ariaLabel = item.count !== '' || item.ariaLabel
    ? [item.ariaLabel || item.label, item.count].filter((part) => part !== '').join(' ')
    : '';
  const icon = item.icon
    ? html`<sf-icon icon=${item.icon} root-class="pointer-event-none" weight="400" aria-hidden="true"></sf-icon>`
    : nothing;
  const count = item.count !== ''
    ? html`<span class="sf-button-group-count">${item.count}</span>`
    : nothing;

  return html`
    <button
      type="button"
      class=${classes}
      data-sf-button-group-value=${item.value}
      aria-label=${ariaLabel || nothing}
      ?disabled=${disabled}
    >
      ${icon}
      ${item.iconOnly
        ? html`<span class="sf-button-group-label--hidden">${item.label}</span>${count}`
        : html`<span class="sf-button-text-container text-center pointer-event-none">${item.label}${count}</span>`}
    </button>
  `;
}

export function renderButtonGroupTemplate(context) {
  const segmented = context.appearance === 'segmented';
  const classes = [
    'sf-button-group',
    segmented ? 'sf-button-group--segmented' : '',
    segmented ? `sf-button-group--size-${context.size}` : '',
    segmented && context.plate === 'raised' ? 'sf-button-group--plate-raised' : '',
    segmented ? `sf-button-group--${context.scheme}` : '',
    segmented && context.fullWidth ? 'sf-button-group--full-width' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');

  return html`
    <div
      class=${classes}
      style=${context.rootStyle || nothing}
      role="radiogroup"
      aria-label=${context.ariaLabel || nothing}
      aria-orientation=${context.orientation}
      data-value=${context.value || ''}
    >
      ${context.items.map((item, index) => (segmented ? renderSegment(item, context) : renderItem(item, index, context)))}
    </div>
  `;
}

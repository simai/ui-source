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

export function renderButtonGroupTemplate(context) {
  const classes = ['sf-button-group', context.rootClass].filter(Boolean).join(' ');

  return html`
    <div
      class=${classes}
      style=${context.rootStyle || nothing}
      role="radiogroup"
      aria-label=${context.ariaLabel || nothing}
      aria-orientation=${context.orientation}
      data-value=${context.value || ''}
    >
      ${context.items.map((item, index) => renderItem(item, index, context))}
    </div>
  `;
}

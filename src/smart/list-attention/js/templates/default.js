import {html, nothing} from 'lit';

// sf-list-attention's markup (scss/ draws it on one rung of the ladder).
//
// - The root is a section (role region) named by its heading; the heading is
//   role heading at heading-level, with the count as an sf-badge of the most
//   serious status.
// - The items are a list. Each says its status in words before its title
//   (visually hidden; the icon is a picture), then the title, the text, and
//   its one action: an sf-button link (href) or button (event).
// - With no items: nothing at all (empty none) or one
//   quiet line (empty line).

// The rung below the list's: the texts and the action.
const BELOW = {'1/2': '1/3', 1: '1/2'};

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-list-attention-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

function action(context, item) {
  if (!item.action) return nothing;
  const {component, size} = context;
  if (item.action.href) {
    return html`<sf-button class="sf-list-attention-action" size=${BELOW[size]} appearance="outline"
      text=${item.action.label} href=${item.action.href}
      @click=${(event) => component.onNavigate(event, item)}></sf-button>`;
  }
  return html`<sf-button class="sf-list-attention-action" size=${BELOW[size]} appearance="outline"
    text=${item.action.label} @click=${() => component.onApply(item)}></sf-button>`;
}

function row(context, item) {
  return html`<li class="sf-list-attention-item" data-status=${item.status} data-id=${item.id}>
    ${icon(context.icons[item.status], `sf-list-attention-icon--${item.status}`)}
    <div class="sf-list-attention-text">
      <span class="sf-list-attention-title"><span class="sr-only">${item.statusWord}: </span>${item.title}</span>
      ${item.text ? html`<span class="sf-list-attention-supporting">${item.text}</span>` : nothing}
    </div>
    ${action(context, item)}
  </li>`;
}

export function renderListAttentionTemplate(context) {
  const {count, size, status, empty, label, level, headingId} = context;
  const classes = [
    'sf-list-attention',
    `sf-list-attention--size-${size === '1/2' ? 'half' : '1'}`,
    count === 0 ? 'sf-list-attention--empty' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  if (count === 0) {
    if (empty !== 'line') return nothing;
    return html`<div class=${classes} style=${context.rootStyle || nothing}>
      <p class="sf-list-attention-quiet">${icon('check_circle', 'sf-list-attention-icon--success')}<span>${context.emptyText}</span></p>
    </div>`;
  }
  return html`<section class=${classes} style=${context.rootStyle || nothing} aria-labelledby=${headingId}>
    <div class="sf-list-attention-heading" role="heading" aria-level=${String(level)} id=${headingId}>
      <span class="sf-list-attention-heading-text">${label}</span>
      <sf-badge class="sf-list-attention-count" size=${BELOW[size]} appearance="tonal" status=${status || nothing}
        text=${context.countText}></sf-badge>
    </div>
    <ul class="sf-list-attention-list">${context.list.map((item) => row(context, item))}</ul>
  </section>`;
}

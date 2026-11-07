import {html, nothing} from 'lit';

// sf-list-description's markup (scss/ draws it on one rung of the ladder).
//
// - The root holds a native dl; each row is a div with one dt (the label)
//   and one dd (the value), so the rows can carry dividers and share one
//   grid.
// - A value is text: a link (href), monospace (mono), cut to one line
//   (overflow truncate, then focusable with its whole text as title), or
//   empty-text when there is none. A status icon stands before it, its word
//   visually hidden; a copy button after it; a hint under it.
// - With no items: nothing at all.

// The rung below the list's: the hint, a stacked label, the copy button.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};
const SIZE_CLASS = {'1/2': 'half', 1: '1', 2: '2'};

function shown(context, item) {
  const {component, overflow} = context;
  const classes = ['sf-list-description-text', item.mono ? 'sf-list-description-text--mono' : ''].filter(Boolean).join(' ');
  const cut = overflow === 'truncate';
  if (item.empty) return html`<span class="sf-list-description-text sf-list-description-empty">${context.emptyText}</span>`;
  if (item.href) {
    return html`<a class=${`${classes} sf-list-description-link`} href=${item.href} title=${cut ? item.value : nothing}
      @click=${(event) => component.onNavigate(event, item)}>${item.value}</a>`;
  }
  return html`<span class=${classes} tabindex=${cut ? '0' : nothing} title=${cut ? item.value : nothing}>${item.value}</span>`;
}

function row(context, item) {
  const {size, icons} = context;
  return html`<div class="sf-list-description-row" data-id=${item.id} data-status=${item.status || nothing}>
    <dt class="sf-list-description-label">${item.label}</dt>
    <dd class="sf-list-description-value">
      <span class="sf-list-description-line">
        ${item.status ? html`<i class=${`sf-icon sf-list-description-icon sf-list-description-icon--${item.status}`} aria-hidden="true">${icons[item.status]}</i><span class="sr-only">${item.statusWord}: </span>` : nothing}
        ${shown(context, item)}
        ${item.copy ? html`<sf-button-copy class="sf-list-description-copy" size=${BELOW[size]} appearance="ghost"
          value=${item.value} label=${item.copyLabel}></sf-button-copy>` : nothing}
      </span>
      ${item.hint ? html`<span class="sf-list-description-hint">${item.hint}</span>` : nothing}
    </dd>
  </div>`;
}

export function renderListDescriptionTemplate(context) {
  const {size, layout, overflow, dividers, list} = context;
  if (!list.length) return nothing;
  const classes = [
    'sf-list-description',
    `sf-list-description--size-${SIZE_CLASS[size] ?? '1'}`,
    `sf-list-description--layout-${layout}`,
    overflow === 'truncate' ? 'sf-list-description--truncate' : '',
    dividers ? 'sf-list-description--dividers' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  // Named (label) it is a group of that name; the dl inside keeps its own role.
  return html`<div class=${classes} style=${context.rootStyle || nothing} role=${context.label ? 'group' : nothing} aria-label=${context.label || nothing}>
    <dl class="sf-list-description-list">${list.map((item) => row(context, item))}</dl>
  </div>`;
}

import {html, nothing} from 'lit';

// sf-list-description's markup (scss/ draws it on one rung of the ladder).
//
// - The root holds a native dl; each row is a div with one dt (the label)
//   and one dd (the value), so the rows can carry dividers and share one
//   grid.
// - With section items the root's grid holds, per section, a head (its
//   title, role heading, and its one action) and a dl of its rows; each dl
//   and each row are subgrids of that one grid, so every label of the record
//   shares one column and every value starts on one axis (decision C33).
// - A label can carry a help mark (sf-help-mark) after it.
// - A value is text: a link (href), monospace (mono), tabular figures
//   (numeric), cut to one line (overflow truncate, then focusable with its
//   whole text as title), a badge (sf-badge on the value's line), or
//   empty-text when there is none. A status icon stands before a value, its
//   word visually hidden (never on an empty value); a copy button and the
//   item's action after it; a hint under it.
// - With no items: nothing at all.

// The rung below the list's: the hint, a stacked label, the copy button,
// the actions, the help mark.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};
// A badge value: sf-badge of this size, on the list's line (line="<size>").
const BADGE = {'1/2': '1/3', 1: '1/3', 2: '1/2'};
const SIZE_CLASS = {'1/2': 'half', 1: '1', 2: '2'};

function action(context, item) {
  if (!item.action) return nothing;
  const {component, size} = context;
  const look = {size: BELOW[size], appearance: 'ghost', scheme: 'primary'};
  return html`<span class="sf-list-description-action">${item.action.href
    ? html`<sf-button size=${look.size} appearance=${look.appearance} scheme=${look.scheme} text=${item.action.label}
        aria-label=${item.actionLabel} href=${item.action.href}
        @click=${(event) => component.onNavigate(event, item, item.action.href)}></sf-button>`
    : html`<sf-button size=${look.size} appearance=${look.appearance} scheme=${look.scheme} text=${item.action.label}
        aria-label=${item.actionLabel} @click=${() => component.onApply(item)}></sf-button>`}</span>`;
}

function shown(context, item) {
  const {component} = context;
  const classes = ['sf-list-description-text', item.mono ? 'sf-list-description-text--mono' : '',
    item.numeric ? 'sf-list-description-text--numeric' : ''].filter(Boolean).join(' ');
  const cut = context.overflow === 'truncate';
  const titled = cut || context.layout === 'grid';
  if (item.empty) return html`<span class="sf-list-description-text sf-list-description-empty">${item.emptyText || context.emptyText}</span>`;
  const badge = item.badge
    ? html`<sf-badge class="sf-list-description-badge" size=${BADGE[context.size]} line=${context.size} appearance="tonal"
        status=${item.badge.status || nothing} scheme=${item.badge.status ? nothing : item.badge.scheme}
        icon=${item.badge.icon || nothing} text=${item.badge.text}></sf-badge>`
    : nothing;
  if (!item.value) return badge;
  if (item.href) {
    return html`${badge}<a class=${`${classes} sf-list-description-link`} href=${item.href} title=${titled ? item.value : nothing}
      @click=${(event) => component.onNavigate(event, item)}>${item.value}</a>`;
  }
  return html`${badge}<span class=${classes} tabindex=${cut ? '0' : nothing} title=${titled ? item.value : nothing}>${item.value}</span>`;
}

function row(context, item) {
  const {size, icons} = context;
  return html`<div class="sf-list-description-row" data-id=${item.id} data-status=${item.status || nothing} data-empty=${item.empty ? '' : nothing}>
    <dt class="sf-list-description-label">${item.label}${item.help
      ? html`<sf-help-mark class="sf-list-description-help" size=${BELOW[size]} text=${item.help} label=${item.helpLabel}></sf-help-mark>`
      : nothing}</dt>
    <dd class="sf-list-description-value">
      <span class="sf-list-description-line">
        ${item.status ? html`<i class=${`sf-icon sf-list-description-icon sf-list-description-icon--${item.status}`} aria-hidden="true">${icons[item.status]}</i><span class="sr-only">${item.statusWord}: </span>` : nothing}
        ${shown(context, item)}
        ${item.copy ? html`<sf-button-copy class="sf-list-description-copy" size=${BELOW[size]} appearance="ghost"
          value=${item.value} label=${item.copyLabel}></sf-button-copy>` : nothing}
        ${action(context, item)}
      </span>
      ${item.hint ? html`<span class="sf-list-description-hint">${item.hint}</span>` : nothing}
    </dd>
  </div>`;
}

// The sections: a head per section, then a dl of its rows; rows before the
// first section stand in a dl of their own, without a head.
function sections(context) {
  const parts = [];
  for (const item of context.list) {
    if (item.kind === 'section') parts.push({section: item, rows: []});
    else if (parts.length) parts[parts.length - 1].rows.push(item);
    else parts.push({section: null, rows: [item]});
  }
  return parts.map(({section, rows}) => html`${section ? html`<div class="sf-list-description-head" data-id=${section.id}>
      <div class="sf-list-description-title" role="heading" aria-level=${String(context.level)}>${section.title}</div>
      ${action(context, section)}
    </div>` : nothing}${rows.length ? html`<dl class="sf-list-description-part" aria-label=${section ? section.title : nothing}>${rows.map((item) => row(context, item))}</dl>` : nothing}`);
}

export function renderListDescriptionTemplate(context) {
  const {size, layout, overflow, dividers, list} = context;
  if (!list.length) return nothing;
  const sectioned = list.some((item) => item.kind === 'section');
  const classes = [
    'sf-list-description',
    `sf-list-description--size-${SIZE_CLASS[size] ?? '1'}`,
    `sf-list-description--layout-${layout}`,
    layout === 'grid' ? `sf-list-description--columns-${context.columns}` : '',
    overflow === 'truncate' ? 'sf-list-description--truncate' : '',
    dividers ? 'sf-list-description--dividers' : '',
    sectioned ? 'sf-list-description--sections' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  // Named (label) it is a group of that name; the dl inside keeps its own role.
  return html`<div class=${classes} style=${context.rootStyle || nothing} role=${context.label ? 'group' : nothing} aria-label=${context.label || nothing}>
    ${sectioned
      ? html`<div class="sf-list-description-list">${sections(context)}</div>`
      : html`<dl class="sf-list-description-list">${list.map((item) => row(context, item))}</dl>`}
  </div>`;
}

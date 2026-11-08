import {html, nothing} from 'lit';

// sf-list-timeline's markup (scss/ draws it on one rung of the ladder).
//
// - The root holds one run per calendar day: a heading (role heading at
//   heading-level) and an ordered list named by it; ungrouped, one list
//   named by label.
// - An event: the marker (a dot, or the item's icon; a picture), then its
//   title with the status in words before it (visually hidden), the actor and
//   the time (a time element: datetime the moment, title the exact date and
//   time), and the text under them.
// - has-more: an sf-button «Показать ещё» after the last event; with no
//   events, one quiet line.

// The rung below the list's: the button.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};
const SIZE_CLASS = {'1/2': 'half', 1: '1', 2: '2'};

function marker(item) {
  if (item.icon) {
    return html`<span class=${`sf-list-timeline-marker sf-list-timeline-marker--${item.status}`} aria-hidden="true"><i class="sf-icon sf-list-timeline-icon">${item.icon}</i></span>`;
  }
  return html`<span class=${`sf-list-timeline-marker sf-list-timeline-marker--${item.status}`} aria-hidden="true"><span class="sf-list-timeline-dot"></span></span>`;
}

function title(context, item) {
  const said = item.statusWord ? html`<span class="sr-only">${item.statusWord}: </span>` : nothing;
  if (item.href) {
    return html`<span class="sf-list-timeline-title">${said}<a class="sf-list-timeline-link" href=${item.href}
      @click=${(event) => context.component.onNavigate(event, item)}>${item.title}</a></span>`;
  }
  return html`<span class="sf-list-timeline-title">${said}${item.title}</span>`;
}

function event(context, item) {
  return html`<li class="sf-list-timeline-item" data-id=${item.id} data-status=${item.status}>
    ${marker(item)}
    <div class="sf-list-timeline-body">
      <div class="sf-list-timeline-head">
        ${title(context, item)}
        ${item.actor || item.time ? html`<span class="sf-list-timeline-meta">
          ${item.actor ? html`<span class="sf-list-timeline-actor">${item.actor}</span>` : nothing}
          ${item.time ? html`<time class="sf-list-timeline-time" datetime=${item.time.iso} title=${item.time.exact}>${item.time.shown}</time>` : nothing}
        </span>` : nothing}
      </div>
      ${item.text ? html`<p class="sf-list-timeline-text">${item.text}</p>` : nothing}
    </div>
  </li>`;
}

function run(context, day) {
  if (!day.day) {
    return html`<ol class="sf-list-timeline-list" aria-label=${context.label || nothing}>${day.items.map((item) => event(context, item))}</ol>`;
  }
  return html`<div class="sf-list-timeline-group">
    <div class="sf-list-timeline-day" role="heading" aria-level=${String(context.level)} id=${day.id}>${day.day}</div>
    <ol class="sf-list-timeline-list" aria-labelledby=${day.id}>${day.items.map((item) => event(context, item))}</ol>
  </div>`;
}

export function renderListTimelineTemplate(context) {
  const {size, density, count, hasMore, loading, component} = context;
  const classes = [
    'sf-list-timeline',
    `sf-list-timeline--size-${SIZE_CLASS[size] ?? '1'}`,
    `sf-list-timeline--density-${density}`,
    count === 0 ? 'sf-list-timeline--empty' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<div class=${classes} style=${context.rootStyle || nothing}>
    ${count === 0
      ? html`<p class="sf-list-timeline-quiet">${context.emptyText}</p>`
      : context.runs.map((day) => run(context, day))}
    ${hasMore ? html`<div class="sf-list-timeline-more">
      <sf-button class="sf-list-timeline-more-button" size=${BELOW[size]} appearance="outline"
        text=${context.moreText} ?loading=${loading} @click=${() => component.onMore()}></sf-button>
    </div>` : nothing}
  </div>`;
}

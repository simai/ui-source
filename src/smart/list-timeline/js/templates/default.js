import {html, nothing} from 'lit';

// sf-list-timeline's markup (scss/ draws it on one rung of the ladder).
//
// 1.1 (owner decision C40, R092 option 1): the event is made of the
// Framework's shared parts.
//
// - The root holds one run per calendar day: block list's heading
//   (.sf-group-heading, role heading at heading-level; the date beside today
//   and yesterday in sf-time) and an ordered list named by it; ungrouped, one
//   list named by label.
// - An event: the rail with its marker (a picture) -- .sf-featured-icon
//   (circle, soft, the rung below's size; neutral, or the tone of error,
//   warning and success) when the event has an icon, else a dot -- on the
//   place's solid surface, so the line does not show through; then the
//   sentence: the status (or step) in words, visually hidden; the actor as
//   sf-avatar line and a bold name (a system actor: the name only); the title
//   (a link with href); a field change as sf-change inline, several as an
//   sf-change list under it. Then one quiet line: sf-time · text. A comment's
//   text stands in an outline under that line.
// - A folded run: a button «Ещё N» on the rail, revealed in place.
// - has-more: an sf-button «Показать ещё» after the last event; with no
//   events, one quiet line.

// The rung below the list's: the marker, the avatar line and the button.
const BELOW = {'1/2': '1/3', 1: '1/2', 2: '1'};
const SIZE_CLASS = {'1/2': 'half', 1: '1', 2: '2'};
// A step's marker (owner decision C61, variant A; one logic with and without
// an icon; C61 round 4: the shape shows the progress, the colour the status):
// done the solid circle, current the same circle ringed outside through a gap,
// upcoming an empty circle with a ring (scss/ draws the rings). The colour is
// primary (an upcoming one: quiet), or the status tone (error, warning,
// success) when the step has one: an upcoming step with an error stays empty.
const STEP_FILL = {done: 'solid', current: 'solid', upcoming: 'soft'};

function stepTone(item) {
  if (item.tone !== 'neutral') return item.tone;
  return item.state === 'upcoming' ? 'neutral' : 'primary';
}

function marker(context, item) {
  if (!item.icon) {
    return html`<span class=${`sf-list-timeline-marker sf-list-timeline-marker--dot sf-list-timeline-marker--${item.status}`}><span class="sf-list-timeline-dot"></span></span>`;
  }
  const step = STEP_FILL[item.state] ? item.state : '';
  const tone = step ? `${stepTone(item)} sf-featured-icon--${STEP_FILL[step]}` : `${item.tone} sf-featured-icon--soft`;
  return html`<span class=${`sf-list-timeline-marker sf-list-timeline-marker--${step || item.tone}`}><span
    class=${`sf-featured-icon sf-featured-icon--circle sf-featured-icon--size-${BELOW[context.size]} sf-featured-icon--${tone}`}><i
    class="sf-icon sf-list-timeline-icon">${item.icon}</i></span></span>`;
}

function actor(context, item) {
  const who = item.actor;
  if (!who) return nothing;
  const avatar = who.system ? nothing : html`<span class="sf-list-timeline-avatar"><sf-avatar inert aria-hidden="true"
    line=${context.size} aria-label=${who.name} hue=${who.hue || 'auto'} image-url=${who.avatar || nothing}></sf-avatar></span>`;
  return html`${avatar}<b class="sf-list-timeline-actor">${who.name}</b> `;
}

function title(context, item) {
  if (item.href) {
    return html`<a class="sf-list-timeline-title sf-list-timeline-link" href=${item.href}
      @click=${(event) => context.component.onNavigate(event, item)}>${item.title}</a>`;
  }
  return html`<span class="sf-list-timeline-title">${item.title}</span>`;
}

function meta(context, item) {
  const time = item.iso
    ? html`<sf-time class="sf-list-timeline-time" datetime=${item.iso} format=${context.itemFormat} now=${context.now || nothing}></sf-time>`
    : nothing;
  const words = item.kind === 'comment' ? '' : item.text;
  if (!item.iso && !words) return nothing;
  return html`<p class="sf-list-timeline-meta">${time}${item.iso && words ? html`<span aria-hidden="true"> · </span>` : nothing}${words
    ? html`<span class="sf-list-timeline-text">${words}</span>` : nothing}</p>`;
}

function event(context, item) {
  const said = item.statusWord ? html`<span class="sr-only">${item.statusWord}: </span>` : nothing;
  const inline = item.changes.length === 1;
  return html`<li class="sf-list-timeline-item" data-id=${item.id} data-status=${item.status} data-kind=${item.kind}
      data-state=${item.state || nothing} aria-current=${item.state === 'current' ? 'step' : nothing}>
    <span class="sf-list-timeline-rail" aria-hidden="true">${marker(context, item)}</span>
    <div class="sf-list-timeline-body">
      <p class="sf-list-timeline-head">${said}${actor(context, item)}${title(context, item)}${inline
        ? html` <sf-change class="sf-list-timeline-change" label=${item.changes[0].label}
            before=${item.changes[0].before ?? ''} after=${item.changes[0].after ?? ''}></sf-change>` : nothing}</p>
      ${item.changes.length > 1
        ? html`<sf-change class="sf-list-timeline-changes" layout="list" .changes=${item.changes}></sf-change>` : nothing}
      ${meta(context, item)}
      ${item.kind === 'comment' && item.text ? html`<p class="sf-list-timeline-comment">${item.text}</p>` : nothing}
    </div>
  </li>`;
}

function fold(context, entry) {
  return html`<li class="sf-list-timeline-item sf-list-timeline-item--fold" data-run=${entry.key}>
    <button type="button" class="sf-list-timeline-run" aria-expanded="false" @click=${() => context.component.expand(entry)}>
      <span class="sf-list-timeline-rail" aria-hidden="true"><span class="sf-list-timeline-marker sf-list-timeline-marker--run"><span
        class=${`sf-featured-icon sf-featured-icon--circle sf-featured-icon--size-${BELOW[context.size]} sf-featured-icon--neutral sf-featured-icon--soft`}><i
        class="sf-icon sf-list-timeline-icon">unfold_more</i></span></span></span>
      <span class="sf-list-timeline-run-text">${entry.text}</span>
    </button>
  </li>`;
}

const entries = (context, list) => list.map((entry) => (entry.fold ? fold(context, entry.fold) : event(context, entry.item)));

function run(context, day) {
  const classes = `sf-list-timeline-list${context.steps ? ' sf-list-timeline-list--steps' : ''}`;
  if (!day.day) {
    return html`<ol class=${classes} aria-label=${context.label || nothing}>${entries(context, day.entries)}</ol>`;
  }
  return html`<div class="sf-list-timeline-group">
    <div class=${`sf-group-heading sf-list-timeline-day${context.size === '1' ? '' : ` sf-group-heading--size-${context.size}`}${context.sticky ? ' sf-group-heading--sticky' : ''}`}
      role="heading" aria-level=${String(context.level)} id=${day.id}>${day.day}${day.date
        ? html` <sf-time class="sf-group-heading-date" format="date" tooltip="none" datetime=${day.date}
            now=${context.now || nothing}></sf-time>` : nothing}</div>
    <ol class=${classes} aria-labelledby=${day.id}>${entries(context, day.entries)}</ol>
  </div>`;
}

export function renderListTimelineTemplate(context) {
  const {size, count, hasMore, loading, component} = context;
  const classes = [
    'sf-list-timeline',
    `sf-list-timeline--size-${SIZE_CLASS[size] ?? '1'}`,
    count === 0 ? 'sf-list-timeline--empty' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<div class=${classes} style=${context.rootStyle || nothing} data-sf-density=${context.compact ? 'compact' : nothing}>
    ${count === 0
      ? html`<p class="sf-list-timeline-quiet">${context.emptyText}</p>`
      : context.runs.map((day) => run(context, day))}
    ${hasMore ? html`<div class="sf-list-timeline-more">
      <sf-button class="sf-list-timeline-more-button" size=${BELOW[size]} appearance="outline" scheme="on-surface"
        text=${context.moreText} ?loading=${loading} @click=${() => component.onMore()}></sf-button>
    </div>` : nothing}
  </div>`;
}

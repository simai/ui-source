import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

// sf-list-attention's markup (scss/ draws it; owner decision C37).
//
// - The root is a section (role region) named by its heading: a card frame
//   by default (frame="card"), the bare list with frame="none". size="1/2",
//   the former own rung, is the compact density (C22) on the root.
// - The head: the heading at heading-level, then the summary, one sf-badge
//   per severity («2 ошибки», «3 предупреждения»).
// - The rows are one grid of five columns (icon, text, affected, action,
//   «⋯»), every row a subgrid of it, so the actions and the affected counts
//   stand in columns. Each row says its status in words before its title
//   (visually hidden; the filled icon is a picture), then the title, the
//   meta line (object · text · age · source), the affected count (group
//   mode), one quiet action (sf-button outline on-surface) and the «⋯»
//   (sf-button-icon ghost) of the triage menu.
// - The foot: «Проверено …» with a recheck, then «Все проблемы (N)».
// - group="severity": disclosure groups by severity, «Пройдено» closed.
// - With no items: nothing (empty none) or the head and one quiet line
//   «Всё в порядке · проверено …» (empty line, the default).

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-icon--filled', 'sf-list-attention-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

function action(context, item) {
  if (!item.action) return nothing;
  const {component} = context;
  if (item.action.href) {
    return html`<sf-button class="sf-list-attention-action" size="1/2" appearance="outline" scheme="on-surface"
      text=${item.action.label} href=${item.action.href}
      @click=${(event) => component.onNavigate(event, item, 'action')}></sf-button>`;
  }
  return html`<sf-button class="sf-list-attention-action" size="1/2" appearance="outline" scheme="on-surface"
    text=${item.action.label} @click=${() => component.onApply(item)}></sf-button>`;
}

function more(context, item) {
  if (!item.menu) return nothing;
  return html`<sf-button-icon class="sf-list-attention-more" size="1/2" appearance="ghost" scheme="on-surface-variant"
    icon="more_horiz" aria-label=${item.moreLabel} aria-haspopup="menu"
    @click=${(event) => context.component.openMenu(item, event.currentTarget.querySelector('button') ?? event.currentTarget)}></sf-button-icon>`;
}

function meta(context, item) {
  const parts = [];
  if (item.object) {
    parts.push(item.object.href
      ? html`<a class="sf-list-attention-object" href=${item.object.href}
          @click=${(event) => context.component.onNavigate(event, item, 'object')}>${item.object.label}</a>`
      : html`<span class="sf-list-attention-object">${item.object.label}</span>`);
  }
  item.meta.forEach((one) => parts.push(one));
  if (!parts.length && !(context.grouped && item.affectedText)) return nothing;
  return html`<span class="sf-list-attention-meta">${parts.map((part, index) => html`${index ? ' · ' : ''}${part}`)}${context.grouped && item.affectedText
    ? html`<span class="sf-list-attention-affected-meta">${parts.length ? ' · ' : ''}${item.affectedText}</span>` : nothing}</span>`;
}

function row(context, item) {
  const lines = item.object || item.meta.length ? 2 : 1;
  return html`<li class="sf-list-attention-item" data-status=${item.status} data-id=${item.id} data-lines=${String(lines)}>
    ${icon(context.icons[item.status], `sf-list-attention-icon--${item.status}`)}
    <span class="sf-list-attention-text">
      <span class="sf-list-attention-title"><span class="sr-only">${item.statusWord}: </span>${item.title}</span>
      ${meta(context, item)}
    </span>
    ${context.grouped && item.affected
      ? html`<sf-badge class="sf-list-attention-affected" size="1/2" appearance="tonal" scheme="neutral" text=${item.affected}></sf-badge>`
      : nothing}
    ${action(context, item)}
    ${more(context, item)}
  </li>`;
}

function rows(context, items) {
  return repeat(items, (item) => item.id, (item) => row(context, item));
}

function passedRow(context, item) {
  return html`<li class="sf-list-attention-item sf-list-attention-item--passed" data-status="success" data-lines=${item.text ? '2' : '1'}>
    ${icon(context.icons.success, 'sf-list-attention-icon--success')}
    <span class="sf-list-attention-text">
      <span class="sf-list-attention-title"><span class="sr-only">${context.passed.word}: </span>${item.title}</span>
      ${item.text ? html`<span class="sf-list-attention-meta">${item.text}</span>` : nothing}
    </span>
  </li>`;
}

function group(context, one, body) {
  const panel = `${context.headingId}-${one.key}`;
  return html`<div class="sf-list-attention-group" data-group=${one.key}>
    <button type="button" class="sf-list-attention-group-toggle" aria-expanded=${one.open ? 'true' : 'false'} aria-controls=${panel}
      @click=${() => context.component.onToggleGroup(one.key)}>
      <i class="sf-icon sf-list-attention-chevron" aria-hidden="true">expand_more</i>
      <span class="sf-list-attention-group-title">${one.title}</span>
      <span class="sf-list-attention-group-count">${one.count}</span>
    </button>
    <ul class="sf-list-attention-list" id=${panel} ?hidden=${!one.open}>${body}</ul>
  </div>`;
}

function checked(context) {
  if (!context.checked) return nothing;
  return html`<span class="sf-list-attention-checked">${context.checkedLine}<sf-button-icon class="sf-list-attention-recheck" size="1/2"
    appearance="ghost" scheme="on-surface-variant" icon="refresh" aria-label=${context.recheckLabel}
    @click=${() => context.component.onRecheck()}></sf-button-icon></span>`;
}

function head(context, withSummary) {
  return html`<div class="sf-list-attention-head">
    <div class="sf-list-attention-heading" role="heading" aria-level=${String(context.level)} id=${context.headingId}>
      <span class="sf-list-attention-heading-text">${context.label}</span>
    </div>
    ${withSummary && context.badges.length ? html`<span class="sf-list-attention-summary">${context.badges.map((one) => html`<sf-badge
      class="sf-list-attention-badge" size="1/3" appearance="tonal" icon-start=${one.icon}
      status=${one.status === 'info' ? nothing : one.status} scheme=${one.status === 'info' ? 'neutral' : nothing}
      text=${one.text}></sf-badge>`)}</span>` : nothing}
    ${context.grouped ? html`<span class="sf-list-attention-spacer"></span>${checked(context)}` : nothing}
  </div>`;
}

function foot(context) {
  if (context.grouped || (!context.checked && !context.more)) return nothing;
  const link = context.more;
  return html`<div class="sf-list-attention-foot">
    ${checked(context)}
    <span class="sf-list-attention-spacer"></span>
    ${link ? html`<sf-button class="sf-list-attention-all" size="1/2" appearance="ghost" scheme="primary" icon-end="arrow_forward"
      text-position="start" text=${link.text} href=${link.href || nothing}
      @click=${(event) => context.component.onMore(event)}></sf-button>` : nothing}
  </div>`;
}

export function renderListAttentionTemplate(context) {
  const {count, empty, frame} = context;
  const classes = [
    'sf-list-attention',
    `sf-list-attention--frame-${frame}`,
    context.grouped ? 'sf-list-attention--group' : '',
    count === 0 ? 'sf-list-attention--empty' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const density = context.compact ? 'compact' : nothing;
  if (count === 0) {
    if (empty !== 'line') return nothing;
    const quiet = html`<p class="sf-list-attention-quiet" role="status">${icon('check_circle', 'sf-list-attention-icon--success')}<span class="sf-list-attention-quiet-text">${context.emptyText}</span>${context.checked
      ? html`<sf-button class="sf-list-attention-recheck-text" size="1/2" appearance="ghost" scheme="on-surface-variant" icon-start="refresh"
        text=${context.recheckLabel} @click=${() => context.component.onRecheck()}></sf-button>` : nothing}</p>`;
    if (frame === 'none') {
      return html`<div class=${classes} style=${context.rootStyle || nothing} data-sf-density=${density}>${quiet}</div>`;
    }
    return html`<section class=${classes} style=${context.rootStyle || nothing} aria-labelledby=${context.headingId} tabindex="-1" data-sf-density=${density}>
      ${head(context, false)}${quiet}
    </section>`;
  }
  const body = context.grouped
    ? html`<div class="sf-list-attention-groups">${context.groups.map((one) => group(context, one, rows(context, one.items)))}${context.passed
      ? group(context, context.passed, context.passed.items.map((item) => passedRow(context, item))) : nothing}</div>`
    : html`<ul class="sf-list-attention-list">${rows(context, context.list)}</ul>`;
  return html`<section class=${classes} style=${context.rootStyle || nothing} aria-labelledby=${context.headingId} tabindex="-1" data-sf-density=${density}>
    ${head(context, true)}
    ${body}
    ${foot(context)}
    <sf-menu-context class="sf-list-attention-menu" popup
      @sf-menu-context-select=${(event) => context.component.onMenuSelect(event)}
      @sf-context-menu-select=${(event) => event.stopPropagation()}></sf-menu-context>
  </section>`;
}

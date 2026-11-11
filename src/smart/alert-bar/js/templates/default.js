import {html, nothing} from 'lit';

// sf-alert-bar's markup (scss/ draws it on one rung of the ladder).
//
// - The root is a region named by label. Two visually hidden live regions
//   inside it speak what appears after the first list: a new error item in
//   role alert, any other new item in role status. The bar itself is no live
//   region, so a bar printed with the page is not read out.
// - Minimized (an error bar only): one button, the strip, that keeps the
//   colour, the icon and the count and expands the bar on a press.
// - Otherwise one row: the shown item's icon, its text with source and time,
//   its action link (sf-button href), acknowledge, the pager «‹ 1 из N ›» and
//   «Все N» when there are several, and at the end close (a warning or an
//   info item) or minimize (an error item). With several items the list of
//   all opens under the bar, each with its own action, acknowledge and close.
//
// The controls are sf-button and sf-button-icon of scheme on-surface: inside
// the coloured bar the sheet sets the surface roles they read to the fill's
// on- role, so they draw on it without a scheme of their own. The close is
// the close glyph on an icon button, not kind="close": the drawn close mark
// is 30 px at rung 1/2 on a phone where the rung's control is 28 px.

const icon = (name, extra = '') => html`<i class=${['sf-icon', 'sf-alert-bar-icon', extra].filter(Boolean).join(' ')} aria-hidden="true">${name}</i>`;

// The time is sf-time (C40): relative within a day (threshold P1D, as 1.x
// read it), else sf-time's auto («вчера, 19:40», «5 ноября»), the full
// moment in its tooltip.
function meta(item, extra = '') {
  if (!item.source && !item.time) return nothing;
  return html`<span class=${['sf-alert-bar-meta', extra].filter(Boolean).join(' ')}>${item.source}${item.source && item.time ? ' · ' : ''}${item.time
    ? html`<sf-time class="sf-alert-bar-time" datetime=${item.time} threshold="P1D"></sf-time>` : nothing}</span>`;
}

function actionLink(context, item, appearance) {
  if (!item.action) return nothing;
  return html`<sf-button class="sf-alert-bar-action" size=${context.size} appearance=${appearance} scheme="on-surface"
    text=${item.action.label} href=${item.action.href || nothing}
    @click=${(event) => context.component.onNavigate(event, item)}></sf-button>`;
}

function acknowledgeButton(context, item, appearance) {
  if (!item.acknowledge) return nothing;
  return html`<sf-button class="sf-alert-bar-acknowledge" size=${context.size} appearance=${appearance} scheme="on-surface"
    text=${item.acknowledge.label || context.words.acknowledge}
    @click=${() => context.component.acknowledgeItem(item.id)}></sf-button>`;
}

const hideWord = (context, item) => (item.level === 'warning' ? context.words.hideDay : context.words.hide);

function strip(context) {
  const {words, level, icons, component} = context;
  return html`<button class="sf-alert-bar-strip" type="button" aria-expanded="false" aria-label=${`${words.strip}. ${words.expandLabel}`}
    @click=${() => component.setMinimized(false)}>
    ${icon(icons[level])}<span class="sf-alert-bar-strip-text">${words.strip}</span><span class="sf-alert-bar-strip-expand">${words.expand}</span>${icon('expand_more', 'sf-alert-bar-strip-chevron')}
  </button>`;
}

function row(context) {
  const {component, list, index, count, level, size, words, icons, listOpen, listId} = context;
  const item = list[index];
  const many = count > 1;
  const prefix = many && item.level !== level ? `${item.levelWord}: ` : '';
  let end = nothing;
  if (item.dismissible) {
    const label = hideWord(context, item);
    end = html`<sf-button-icon class="sf-alert-bar-close" icon="close" size=${size} appearance="ghost" scheme="on-surface"
      aria-label=${label} title=${label} @click=${() => component.closeItem(item.id)}></sf-button-icon>`;
  } else if (item.level === 'error') {
    end = html`<sf-button-icon class="sf-alert-bar-minimize" icon="expand_less" size=${size} appearance="ghost" scheme="on-surface"
      aria-label=${words.minimize} title=${words.minimize} @click=${() => component.setMinimized(true)}></sf-button-icon>`;
  }
  return html`<div class="sf-alert-bar-row" data-level=${item.level}>
    ${icon(icons[item.level])}
    <div class="sf-alert-bar-text">
      <span class="sf-alert-bar-message">${prefix ? html`<span class="sf-alert-bar-prefix">${prefix}</span>` : nothing}${item.text}</span>
      ${meta(item)}
    </div>
    ${item.action || item.acknowledge || many ? html`<div class="sf-alert-bar-actions">
      ${actionLink(context, item, 'outline')}
      ${acknowledgeButton(context, item, 'ghost')}
      ${many ? html`<span class="sf-alert-bar-pager">
        <sf-button-icon class="sf-alert-bar-prev" icon="chevron_left" size=${size} appearance="ghost" scheme="on-surface"
          aria-label=${words.prev} @click=${() => component.page(-1)}></sf-button-icon>
        <span class="sf-alert-bar-position">${words.position}</span>
        <sf-button-icon class="sf-alert-bar-next" icon="chevron_right" size=${size} appearance="ghost" scheme="on-surface"
          aria-label=${words.next} @click=${() => component.page(1)}></sf-button-icon>
      </span>
      <sf-button class="sf-alert-bar-all" size=${size} appearance="tonal" scheme="on-surface"
        text=${listOpen ? words.collapseList : words.all} expanded=${listOpen ? 'true' : 'false'} aria-controls=${listId}
        @click=${() => component.toggleList()}></sf-button>` : nothing}
    </div>` : nothing}
    ${end}
  </div>`;
}

function listOfAll(context) {
  const {component, list, size, words, listId} = context;
  return html`<ul class="sf-alert-bar-list" id=${listId} aria-label=${words.list}>
    ${list.map((item) => html`<li class="sf-alert-bar-item" data-level=${item.level} data-id=${item.id}>
      <sf-badge class="sf-alert-bar-badge" status=${item.level} appearance="tonal" size="1/3" text=${item.levelWord}></sf-badge>
      <div class="sf-alert-bar-item-text">
        <span class="sf-alert-bar-item-message">${item.text}</span>
        ${meta(item, 'sf-alert-bar-item-meta')}
      </div>
      <div class="sf-alert-bar-item-actions">
        ${actionLink(context, item, 'outline')}
        ${acknowledgeButton(context, item, 'outline')}
        ${item.dismissible ? html`<sf-button class="sf-alert-bar-item-close" size=${size} appearance="outline" scheme="on-surface"
          text=${hideWord(context, item)} @click=${() => component.closeItem(item.id)}></sf-button>` : nothing}
      </div>
    </li>`)}
  </ul>`;
}

export function renderAlertBarTemplate(context) {
  const {count, level, isMinimized, listOpen, size, announce, label} = context;
  const classes = [
    'sf-alert-bar',
    level ? `sf-alert-bar--${level}` : 'sf-alert-bar--empty',
    `sf-alert-bar--size-${size === '1' ? '1' : 'half'}`,
    count > 1 ? 'sf-alert-bar--many' : '',
    isMinimized ? 'sf-alert-bar--minimized' : '',
    listOpen ? 'sf-alert-bar--open' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  return html`<div class=${classes} style=${context.rootStyle || nothing} role="region" aria-label=${label || nothing}>
    <div class="sf-alert-bar-live sr-only" role="alert">${announce.alert}</div>
    <div class="sf-alert-bar-live sr-only" role="status">${announce.status}</div>
    ${count === 0 ? nothing : isMinimized ? strip(context) : html`${row(context)}${listOpen ? listOfAll(context) : nothing}`}
  </div>`;
}

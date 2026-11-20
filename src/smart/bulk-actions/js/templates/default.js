import {html, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';

// sf-bulk-actions' markup (owner decision C295; study ui-control
// prototypes/sf-bulk-actions-study.html, variant A). scss/ draws it.
//
//   [start] Выбрано 2 · Выбрать все 240      [Опубликовать] [Переместить] [Экспорт] [⋯] [end] ×
//
// One row, a region named by label: the count (or the host's count-text) and
// the offer to take all under the filter at the start (on a phone, in «⋯»
// when the row would take a second line: C309 (1)); the actions, «⋯» and
// the clear cross at the end. While a short run goes the start says «Выполняем:
// 4 из 12» over a bar; a result with refusals says «Готово 10 из 12 · 2 не
// удалось» with «Подробнее» and «Повторить для 2»; a fast action's result
// says «Удалено: 5» in place of the count for a while, a long action's start
// «Экспорт: идёт в фоне» (C387). The row is a plain row of
// buttons in Tab order, 8 apart (C184: roving is for icon rows), the focus is
// never moved into it.
//
// A Smart button draws its look once, so a button whose look changes (a
// phone's icon button, a danger) is a new button: keyed by what it shows.

function actionButton(context, action) {
  const {component, size, compact} = context;
  const press = (event) => component.pressAction(action.id, event);
  const unavailable = action.unavailable ? 'true' : nothing;
  const description = action.reason || nothing;
  if (compact) {
    return keyed(`${action.id}|icon|${action.status}`, html`<sf-button-icon class="sf-bulk-actions__action" data-sf-bulk-action=${action.id}
      size=${size} appearance="ghost" scheme="on-surface" status=${action.status || nothing} icon=${action.icon}
      aria-label=${action.text} title=${action.reason ? `${action.text} — ${action.reason}` : action.text}
      aria-disabled=${unavailable} aria-description=${description} @click=${press}></sf-button-icon>`);
  }
  return keyed(`${action.id}|text|${action.status}|${action.icon}`, html`<sf-button class="sf-bulk-actions__action" data-sf-bulk-action=${action.id}
    size=${size} appearance="outline" scheme="on-surface" status=${action.status || nothing} icon-start=${action.icon || nothing}
    text=${action.text} title=${action.reason || nothing} aria-disabled=${unavailable} aria-description=${description}
    @click=${press}></sf-button>`);
}

function moreButton(context) {
  const {component, size, words} = context;
  return html`<sf-button-icon class="sf-bulk-actions__more" data-sf-bulk-action="more" size=${size} appearance="ghost"
    scheme="on-surface" icon="more_horiz" aria-label=${words.more} aria-haspopup="menu"
    @click=${(event) => component.openMore(event.currentTarget)}></sf-button-icon>`;
}

function offer(context) {
  const {component, size} = context;
  if (!context.offer) return nothing;
  return keyed(context.offer.kind, html`<sf-button class="sf-bulk-actions__offer" data-sf-bulk-offer=${context.offer.kind} size=${size}
    appearance="ghost" scheme="primary" text=${context.offer.text}
    @click=${() => (context.offer.kind === 'all' ? component.selectAll() : component.selectPage())}></sf-button>`);
}

function run(context) {
  const {run: shown} = context;
  return html`<div class="sf-bulk-actions__run" data-sf-bulk-run>
    <span class="sf-bulk-actions__say">${shown.text}</span>
    <sf-progress-bar class="sf-bulk-actions__progress" size="1/2" value=${String(shown.percent)}
      label=${shown.text}></sf-progress-bar>
  </div>`;
}

function result(context) {
  const {result: shown, component, size} = context;
  return html`<div class="sf-bulk-actions__run" data-sf-bulk-result>
    <span class="sf-bulk-actions__say sf-bulk-actions__say--warning">${shown.failed
      ? html`<sf-icon class="sf-bulk-actions__warning" icon="warning" size="1/2" aria-hidden="true"></sf-icon>` : nothing}<span class="sf-bulk-actions__text">${shown.text}</span></span>
    ${shown.failed ? html`<span class="sf-bulk-actions__answers">
      <sf-button data-sf-bulk-result-action="details" size=${size} appearance="outline" scheme="on-surface"
        text=${shown.details} @click=${() => component.showDetails()}></sf-button>
      ${shown.retry ? html`<sf-button data-sf-bulk-result-action="retry" size=${size} appearance="outline" scheme="on-surface"
        text=${shown.retry} @click=${() => component.retry()}></sf-button>` : nothing}
    </span>` : nothing}
  </div>`;
}

// A fast action's result, or a long one's start, in place of the count (C387).
function done(context) {
  const {done: shown} = context;
  const icon = shown.kind === 'background' ? 'schedule' : 'check_circle';
  return html`<div class="sf-bulk-actions__lead" data-sf-bulk-done=${shown.kind}>
    <span class="sf-bulk-actions__say sf-bulk-actions__say--done"><sf-icon class=${`sf-bulk-actions__done sf-bulk-actions__done--${shown.kind}`}
      icon=${icon} size="1/2" aria-hidden="true"></sf-icon><span class="sf-bulk-actions__text" title=${shown.text}>${shown.text}</span></span>
    ${shown.actions ? offer(context) : nothing}
  </div>`;
}

export function renderBulkActionsTemplate(context) {
  const {words, component, size} = context;
  const classes = [
    'sf-bulk-actions',
    `sf-bulk-actions--${context.place}`,
    `sf-bulk-actions--size-${size}`,
    context.compact ? 'sf-bulk-actions--compact' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const busy = Boolean(context.run || context.result);
  const quiet = busy || Boolean(context.done && !context.done.actions);
  let lead;
  if (busy) lead = context.run ? run(context) : result(context);
  else if (context.done) lead = done(context);
  else {
    lead = html`<div class="sf-bulk-actions__lead">
            <span class="sf-bulk-actions__count">${context.countText}</span>
            ${offer(context)}
          </div>`;
  }
  return html`<div class=${classes} role="region" aria-label=${context.label} ?hidden=${!context.shown}
      aria-busy=${context.run ? 'true' : nothing} data-sf-bulk-actions>
      ${context.start}
      ${lead}
      <div class="sf-bulk-actions__end">
        ${quiet ? nothing : html`<div class="sf-bulk-actions__actions">
          ${context.visible.map((action) => actionButton(context, action))}
          ${context.rest.length || context.offerFolded ? moreButton(context) : nothing}
        </div>`}
        ${context.end}
        <sf-button-icon class="sf-bulk-actions__clear" data-sf-bulk-action="clear" size=${size} appearance="ghost"
          scheme="on-surface" icon="close" aria-label=${words.clear} title=${words.clearHint}
          @click=${() => component.clear()}></sf-button-icon>
      </div>
    </div><span class="sf-bulk-actions__status sr-only" role="status" aria-live="polite">${context.announcement}</span>`;
}

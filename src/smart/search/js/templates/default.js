import {html, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {live} from 'lit/directives/live.js';
import {shortcutView} from '../../../../component/kbd/js/shortcut';

// The host: the page's trigger, in place. The host itself is display:
// contents, so the trigger stands in the page as the page wrote it, before the
// code and after it.
export function renderSearchTemplate(context) {
  const {hasSlot, slot} = context;
  return hasSlot('trigger') ? html`${slot('trigger')}` : nothing;
}

// One part of a title, the match marked (the first place a term of the query
// stands in it): medium weight on the row's own colour (owner decision C139
// (8), as sf-input-lookup marks it), no fill.
const marked = ([before, match, after]) => (match ? html`${before}<mark class="sf-search-mark">${match}</mark>${after}` : before);

const glyph = (name, extra = '') => html`<i class=${`sf-icon ${extra}`.trim()} aria-hidden="true">${name}</i>`;

// The scope tag of «Все»: a key no group of a host is called.
export const ALL_SCOPE_KEY = '*';

function keycaps(shortcut) {
  const {keys, join} = shortcutView(shortcut);
  return html`<kbd class="sf-kbd--group">${keys.map((key, at) => html`${at && join ? html`<span class="sf-kbd-join">+</span>` : nothing}<kbd class=${key.square ? 'sf-kbd--square' : nothing}>${key.text}</kbd>`)}</kbd>`;
}

// The row's own buttons (owner decision C175 (6), C148 (3)): icon buttons 32,
// 8 apart (C105 H5), out of the Tab order -- → reaches them from the field.
function rowActions(context, row) {
  const {component, words, selected} = context;
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const button = (icon, label, press, keys = '') => html`<sf-button-icon icon=${icon} size="1/2" appearance="ghost" scheme="on-surface"
    aria-label=${label} aria-keyshortcuts=${keys || nothing} @click=${(event) => {
      stop(event);
      press();
    }}></sf-button-icon>`;
  if (row.kind === 'recent' || row.recentPage) {
    // A recent query or page: its cross, which a pointer finds on the row it
    // stands on and a finger always sees (SW-18).
    const forget = row.kind === 'recent' ? () => component.forgetRecent(row.text) : () => component.forgetRecentPage(row.item.id);
    return html`<span class="sf-search-row-actions sf-search-row-actions--recent" @keydown=${(event) => component.onRowActionsKeydown(event)}
      @mousedown=${stop}>${button('close', row.removeLabel, forget)}</span>`;
  }
  if (row.index !== selected || row.kind !== 'result' || !row.url) return nothing;
  return html`<span class="sf-search-row-actions" @keydown=${(event) => component.onRowActionsKeydown(event)} @mousedown=${stop}>
    ${button('open_in_new', words.newTab, () => component.openInNewTab(row.index), 'Control+Enter Meta+Enter')}
    ${button('link', words.copyLink, () => component.copyLink(row.index))}
  </span>`;
}

// The end of a row: a command's keys, a step's chevron, the row's buttons, or
// on the selected row the Enter it answers.
function rowEnd(context, row) {
  const {selected} = context;
  if (row.shortcut) return html`<span class="sf-search-row-keys">${keycaps(row.shortcut)}</span>`;
  if (row.kind === 'result' && row.item.kind === 'action' && row.item.steps) return glyph('chevron_right', 'sf-search-row-next');
  const actions = rowActions(context, row);
  if (actions !== nothing) return actions;
  // A record's time: quiet, at the row's end (C175 (2), the prototype's mail
  // and admin rows).
  if (row.item?.time) return html`<span class="sf-search-row-meta"><sf-time datetime=${row.item.time} tooltip="none"></sf-time></span>`;
  if (row.index === selected && row.kind !== 'more') return html`<span class="sf-search-row-keys" aria-hidden="true"><kbd class="sf-kbd--group"><kbd class="sf-kbd--square">↵</kbd></kbd></span>`;
  return nothing;
}

// The row's picture (C175 (2)): the glyph 20 of menu and list rows, an
// avatar for a person or a chat. sf-avatar draws a button; in a row it is a
// picture, so the host is inert: no Tab stop, nothing read, a press falls to
// the row.
function rowLead(row) {
  const avatar = row.avatar ?? row.item?.avatar;
  if (avatar && (avatar.name || avatar.image)) {
    return html`<sf-avatar class="sf-search-row-avatar" size="1/2" heading=${avatar.name || nothing} image-url=${avatar.image || nothing}
      hue="auto" inert></sf-avatar>`;
  }
  return row.icon ? glyph(row.icon, 'sf-search-row-icon') : nothing;
}

function renderRow(context, row) {
  const {ids, selected, component, show} = context;
  const isSelected = row.index === selected;
  const path = show.path && row.path;
  const item = row.item ?? {};
  const classes = ['sf-search-row', path ? 'sf-search-row--two' : '', row.kind === 'recent' || row.recentPage ? 'sf-search-row--recent' : '',
    row.kind === 'more' ? 'sf-search-row--more' : '', isSelected ? 'sf-search-row--selected' : ''].filter(Boolean).join(' ');
  const line = html`<span class="sf-search-row-line"><span class="sf-search-row-title">${marked(row.title)}</span>${item.badge
    ? html`<sf-badge class="sf-search-row-badge" appearance="outline" size="1/3" text=${item.badge}></sf-badge>` : nothing}</span>`;
  const words = html`${rowLead(row)}<span class="sf-search-row-text">${line}${path ? html`<span class="sf-search-row-path">${row.path}</span>` : nothing}</span>`;
  const {url} = row;
  // A page row is a link (C175 (6)): Ctrl/Command with a press and the middle
  // button open it in a new tab, as any link does. The link covers the row;
  // the row's buttons stand over it.
  return html`<div class=${classes} role="option" id=${ids.option(row.index)} aria-selected=${isSelected ? 'true' : 'false'}
    @pointerenter=${(event) => component.markCut(event.currentTarget)}
    @pointermove=${() => component.hover(row.index)} @click=${(event) => component.onRowClick(event, row.index)}>
    ${url ? html`<a class="sf-search-row-main" href=${url} tabindex="-1">${words}</a>` : html`<span class="sf-search-row-main">${words}</span>`}
    ${rowEnd(context, row)}
  </div>`;
}

function renderPills(context, texts) {
  const {component} = context;
  return html`<div class="sf-search-pills">${texts.map((text) => html`<button class="sf-search-pill" type="button"
    @click=${() => component.setQuery(text)}>${text}</button>`)}</div>`;
}

function renderSection(context, section) {
  const {words, component} = context;
  if (section.kind === 'popular') {
    return html`<div class="sf-search-section">
      <div class="sf-search-caption"><span>${words.popular}</span></div>
      ${renderPills(context, section.texts)}
    </div>`;
  }
  if (section.kind === 'results') {
    return html`<div class="sf-search-list" role="listbox" id=${section.id} aria-label=${words.results} aria-busy=${context.view.stale ? 'true' : nothing}>
      ${section.groups.map((group) => html`<div class="sf-search-group" role="group" aria-labelledby=${group.captionId || nothing}
        aria-label=${group.captionId ? nothing : group.label}>
        ${group.captionId ? html`<div class="sf-search-caption" role="presentation"><span id=${group.captionId}>${group.label}</span></div>` : nothing}
        ${group.rows.map((row) => renderRow(context, row))}
      </div>`)}
    </div>`;
  }
  // recent, actions and refine: a caption (with the clear button for recent)
  // over a list of their own.
  const captionId = `${section.id}-caption`;
  return html`<div class="sf-search-section">
    <div class="sf-search-caption"><span id=${captionId}>${section.label}</span>
      ${section.kind === 'recent' ? html`<button class="sf-search-caption-action" type="button"
        @click=${() => component.clearRecent()}>${words.recentClear}</button>` : nothing}
    </div>
    <div class="sf-search-list" role="listbox" id=${section.id} aria-labelledby=${captionId} aria-busy=${context.view.stale ? 'true' : nothing}>
      ${section.rows.map((row) => renderRow(context, row))}
    </div>
  </div>`;
}

// The field's tags (C175 (7), (8)): a command's step, and the operators
// typed; a tag in a field is the field's, its line the head's row less 8
// (C145 (1)).
function renderTags(context) {
  const {component, view, words} = context;
  const step = view.step
    ? html`<sf-tag class="sf-search-tag" kind="default" size="1/2" inline text=${view.step.title} closable close-label=${words.back}
      @sf-tag-close=${(event) => {
        event.stopPropagation();
        component.leaveStep();
      }} @close=${(event) => event.stopPropagation()}></sf-tag>`
    : nothing;
  const tokens = view.tokens.map((token, at) => html`<sf-tag class="sf-search-tag" kind="default" size="1/2" inline
    text=${`${token.word}: ${token.label || token.value}`} closable close-label=${words.removeTag}
    @sf-tag-close=${(event) => {
      event.stopPropagation();
      component.setTokens(view.tokens.filter((_, index) => index !== at));
    }} @close=${(event) => event.stopPropagation()}></sf-tag>`);
  return html`${step}${tokens}`;
}

// The window, drawn into the layer's portal while it is open: the scrim and
// one surface -- the field as its frameless head with a line under it (owner
// decisions C175 (1), C06), the filters, the rows and the key hints.
export function renderSearchWindow(context) {
  const {component, ids, query, words, view, busy, statusText, placeholder, label, hints} = context;
  const filled = query.length > 0 || view.tokens.length > 0;
  const listIds = view.sections.filter((section) => section.kind !== 'popular').map((section) => section.id).join(' ');
  const scopes = view.scopes;
  const {correction, notice, pane, preview} = view;
  // The «Поиск…» line over the rows it keeps (C139 (4), C130 (8)): drawn
  // after the wait delay, so its spinner shows with it; the words say the
  // wait once (the spinner's label is for a screen reader and is not drawn).
  // Nothing found and a failure: an inline sf-empty-state (C120), which the
  // window's own status announces (live off).
  const body = html`<div class=${`sf-search-body${view.stale ? ' sf-search-body--stale' : ''}`}>
        ${view.waiting ? html`<div class="sf-search-wait" aria-hidden="true">
          <sf-spinner class="sf-search-spinner" size="1/2" label=${words.loading} label-hidden></sf-spinner><span>${words.loading}</span>
        </div>` : nothing}
        ${view.state ? html`<div class="sf-search-state"><sf-empty-state kind=${view.state.kind} layout="inline" size="1/2" live="off"
          text=${view.state.text} .actions=${view.state.actions ?? undefined}
          @sf-empty-state-action=${(event) => component.onStateAction(event)}></sf-empty-state></div>` : nothing}
        ${view.sections.map((section) => renderSection(context, section))}
        ${view.message ? html`<div class="sf-search-message">${view.message}</div>` : nothing}
      </div>`;
  return html`<div class="sf-search-scrim" aria-hidden="true" @click=${() => component.close({reason: 'outside'})}></div>
  <div class=${`sf-search-window${pane ? ' sf-search-window--pane' : ''}${view.step ? ' sf-search-window--step' : ''}`} id=${ids.dialog}
    role="dialog" aria-modal="true" aria-label=${label}>
    <div class=${`sf-search-head${filled ? ' sf-search-head--filled' : ''}`}>
      <sf-button-icon class="sf-search-back" icon="arrow_back" size="1/2" appearance="ghost" scheme="on-surface"
        aria-label=${view.step ? words.back : words.close} aria-keyshortcuts="Escape" @click=${() => component.onBackPress()}></sf-button-icon>
      <span class="sf-search-glyph">${glyph('search')}</span>
      <div class="sf-search-query">
        ${renderTags(context)}
        <input class="sf-search-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="true"
          aria-controls=${listIds || nothing} aria-activedescendant=${view.activeId || nothing} aria-label=${label}
          placeholder=${placeholder} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"
          @input=${(event) => component.onInput(event)} @keydown=${(event) => component.onFieldKeydown(event)}>
      </div>
      ${filled ? keyed(view.step ? 'step' : 'query', html`<sf-button-icon class="sf-search-clear" icon="close" size="1/2" appearance="ghost" scheme="on-surface"
        aria-label=${words.clear} aria-keyshortcuts="Escape" @click=${() => component.onClearPress()}></sf-button-icon>`) : nothing}
    </div>
    ${scopes.length > 1 ? html`<sf-tag-group class="sf-search-scopes" selection="one" layout="wrap" aria-label=${words.scopes}
      @sf-tag-group-select=${(event) => component.onScopeSelect(event)}>
      ${scopes.map((scope) => html`<sf-tag key=${scope.id || ALL_SCOPE_KEY} size="1/2" text=${scope.label} count=${String(scope.count)}
        ?active=${live(scope.pressed)}></sf-tag>`)}
    </sf-tag-group>` : nothing}
    ${notice ? html`<div class="sf-search-notice" role="alert">${notice}</div>` : nothing}
    ${correction ? html`<button class="sf-search-correction" type="button"
      @click=${() => component.setQuery(correction.query)}>${correction.text}${correction.count === null ? nothing
        : html`<span class="sf-search-count">${correction.count}</span>`}</button>` : nothing}
    <div class="sf-search-card" aria-busy=${busy ? 'true' : 'false'} @mousedown=${(event) => component.keepFocus(event)}>
      ${pane ? html`<div class="sf-search-split">
        ${body}
        <aside class="sf-search-preview" aria-label=${words.preview}>
          ${preview ? html`${preview.path ? html`<div class="sf-search-preview-path">${preview.path}</div>` : nothing}
          ${preview.title ? html`<div class="sf-search-preview-title">${preview.title}</div>` : nothing}
          ${preview.text ? html`<p class="sf-search-preview-text">${preview.text}</p>` : nothing}` : nothing}
        </aside>
      </div>` : body}
    </div>
    ${hints.length ? html`<div class="sf-search-keys" aria-hidden="true">
      ${hints.map((hint) => html`<span class="sf-search-key">${hint.keys.map((key) => html`<kbd appearance="cap" class=${key.length === 1 ? 'sf-kbd--square' : nothing}>${key}</kbd>`)}${hint.label}</span>`)}
    </div>` : nothing}
    <div class="sr-only" role="status" aria-live="polite">${statusText}</div>
  </div>`;
}

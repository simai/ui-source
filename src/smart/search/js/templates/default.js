import {html, nothing} from 'lit';

// The host: the page's trigger, in place. The host itself is display:
// contents, so the trigger stands in the page as the page wrote it, before the
// code and after it.
export function renderSearchTemplate(context) {
  const {hasSlot, slot} = context;
  return hasSlot('trigger') ? html`${slot('trigger')}` : nothing;
}

// One part of a title, the match marked (the first place a term of the query
// stands in it).
const marked = ([before, match, after]) => (match ? html`${before}<mark class="sf-search-mark">${match}</mark>${after}` : before);

const glyph = (name, extra = '') => html`<i class=${`sf-icon ${extra}`.trim()} aria-hidden="true">${name}</i>`;

function renderRow(context, row) {
  const {ids, selected, component, show} = context;
  const isSelected = row.index === selected;
  const classes = ['sf-search-row', row.kind === 'recent' ? 'sf-search-row--recent' : '', !show.path || !row.path ? 'sf-search-row--single' : '',
    isSelected ? 'sf-search-row--selected' : ''].filter(Boolean).join(' ');
  let trailing = nothing;
  if (row.kind === 'recent') {
    trailing = html`<button class="sf-search-remove" type="button" tabindex="-1" aria-label=${row.removeLabel}
      @click=${(event) => { event.stopPropagation(); component.removeRecent(row.text); }}>${glyph('close')}</button>`;
  } else if (row.shortcut) {
    trailing = html`<kbd class="sf-search-shortcut">${row.shortcut}</kbd>`;
  } else {
    trailing = glyph('arrow_forward', 'sf-search-go');
  }
  return html`<div class=${classes} role="option" id=${ids.option(row.index)} aria-selected=${isSelected ? 'true' : 'false'}
    @pointermove=${() => component.hover(row.index)} @click=${() => component.choose(row.index)}>
    <span class="sf-search-row-icon">${glyph(row.icon)}</span>
    <span class="sf-search-row-text">
      <span class="sf-search-row-title">${marked(row.title)}</span>
      ${show.path && row.path ? html`<span class="sf-search-row-path">${row.path}</span>` : nothing}
    </span>
    ${trailing}
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
    return html`<div class="sf-search-list" role="listbox" id=${section.id} aria-label=${words.results}>
      ${section.groups.map((group) => html`<div class="sf-search-group" role="group" aria-labelledby=${group.captionId || nothing}
        aria-label=${group.captionId ? nothing : group.label}>
        ${group.captionId ? html`<div class="sf-search-caption" role="presentation"><span id=${group.captionId}>${group.label}</span></div>` : nothing}
        ${group.rows.map((row) => renderRow(context, row))}
      </div>`)}
    </div>`;
  }
  // recent and actions: a caption (with the clear button for recent) over a
  // list of their own.
  const captionId = `${section.id}-caption`;
  return html`<div class="sf-search-section">
    <div class="sf-search-caption"><span id=${captionId}>${section.label}</span>
      ${section.kind === 'recent' ? html`<button class="sf-search-caption-action" type="button"
        @click=${() => component.clearRecent()}>${words.recentClear}</button>` : nothing}
    </div>
    <div class="sf-search-list" role="listbox" id=${section.id} aria-labelledby=${captionId}>
      ${section.rows.map((row) => renderRow(context, row))}
    </div>
  </div>`;
}

// The window, drawn into the layer's portal while it is open: the scrim, the
// field and the results card. The field and the card are two raised surfaces
// with the scrim between them and the page.
export function renderSearchWindow(context) {
  const {component, ids, query, words, show, view, status, statusText, placeholder, label} = context;
  const filled = query.length > 0;
  const listIds = view.sections.filter((section) => section.kind !== 'popular').map((section) => section.id).join(' ');
  const scopes = view.scopes;
  return html`<div class="sf-search-scrim" aria-hidden="true" @click=${() => component.close({reason: 'outside'})}></div>
  <div class="sf-search-window" id=${ids.dialog} role="dialog" aria-modal="true" aria-label=${label}>
    <div class=${`sf-search-field${filled ? ' sf-search-field--filled' : ''}`}>
      <sf-icon-button class="sf-search-back" icon="arrow_back" size="1/2" appearance="link" scheme="on-surface"
        aria-label=${words.back} @click=${() => component.close({reason: 'close'})}></sf-icon-button>
      ${glyph('search', 'sf-search-glyph')}
      <input class="sf-search-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="true"
        aria-controls=${listIds || nothing} aria-activedescendant=${view.activeId || nothing} aria-label=${label}
        placeholder=${placeholder} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"
        @input=${(event) => component.onInput(event)} @keydown=${(event) => component.onFieldKeydown(event)}>
      <sf-icon-button class="sf-search-clear" icon="close" size="1/2" appearance="link" scheme="on-surface"
        aria-label=${filled ? words.clear : words.close} @click=${() => component.onClearPress()}></sf-icon-button>
    </div>
    <div class="sf-search-card" aria-busy=${status === 'loading' ? 'true' : 'false'} @mousedown=${(event) => component.keepFocus(event)}>
      ${show.scopes && scopes.length > 1 ? html`<div class="sf-search-scopes" role="group" aria-label=${words.scopes}>
        ${scopes.map((scope) => html`<button class="sf-search-pill sf-search-scope" type="button" aria-pressed=${scope.pressed ? 'true' : 'false'}
          @click=${() => component.setScope(scope.id)}>${scope.label}<span class="sf-search-count">${scope.count}</span></button>`)}
      </div>` : nothing}
      <div class="sf-search-body">
        ${view.sections.map((section) => renderSection(context, section))}
        ${view.message ? html`<div class="sf-search-message">${view.message}</div>` : nothing}
        ${view.messagePills?.length ? renderPills(context, view.messagePills) : nothing}
      </div>
      ${show.keys && view.rowCount ? html`<div class="sf-search-keys" aria-hidden="true">
        <span class="sf-search-key"><kbd>↑</kbd><kbd>↓</kbd>${words.keySelect}</span>
        <span class="sf-search-key"><kbd>↵</kbd>${words.keyOpen}</span>
        <span class="sf-search-key"><kbd>esc</kbd>${filled ? words.keyClear : words.keyClose}</span>
      </div>` : nothing}
    </div>
    <div class="sr-only" role="status" aria-live="polite">${statusText}</div>
  </div>`;
}

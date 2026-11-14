import {html, nothing} from 'lit';
import {live} from 'lit/directives/live.js';
import {createFieldContract} from '../../../../component/field-contract';
import {matchRanges, splitByRanges} from '../lookup-model.mjs';

// The field: a label row, one frame holding the chips and the search box, the
// hint or error line under it, and the list panel -- a popover the component
// anchors under the frame. sf-input's parts, in its places.
//
// The search box is the combobox; the focus never leaves it while the arrows
// move the active row (aria-activedescendant). Rows are drawn here, not as
// elements: the class markup of an avatar (a photo or initials) beside the
// label and the caption. A chosen row is its fill alone, no check (owner
// decision C08).

// A row's picture is the field's text line, as a chip's is (the geometry
// standard: every picture of a size is its line; LK-06). The stylesheet sizes
// it; the class is the avatar ladder's smallest step, for its initials.
const AVATAR_CLASS_SIZE = '1/4';
// The clear is the field layer's action (owner decision C123, which takes
// C14's plain close further): a glyph without a plate, the size of the
// field's leading picture, its hit area the field's height.
const BUTTON_SIZE = {'1/3': '1/3', '1/2': '1/3', '1': '1/2', '2': '1', '3': '2'};
// A chip is an inline tag one size down, its text a step under the field's
// (1/3 keeps the smallest tag). Its height is the field's less --sf-space-1/4
// above and below (owner decision C58): the stylesheet publishes it to the tag
// as its line (--sf-tag--line), so the chip, its avatar and its remove target
// are read from the field ladder at every size and density (LS-1..LS-3). It
// stood on the field's text line before (sf-tag line): 24 in a 40 field.
const CHIP_TAG_SIZE = {'1/3': '1/3', '1/2': '1/3', '1': '1/2', '2': '1', '3': '2'};

function avatar(item, size, extraClass = '') {
  if (!item.avatar) return item.icon ? html`<sf-icon class=${`${extraClass} sf-lookup-icon flex-none`} icon=${item.icon} aria-hidden="true"></sf-icon>` : nothing;
  const classes = `sf-avatar sf-avatar--size-${size} inline-flex flex-none items-cross-center content-main-center overflow-hidden ${extraClass}`;
  if (item.avatar.src) {
    return html`<span class=${classes} aria-hidden="true"><img class="sf-avatar-image" src=${item.avatar.src} alt="" loading="lazy" decoding="async"></span>`;
  }
  return html`<span class="${classes} sf-avatar--text" aria-hidden="true">${item.avatar.initials}</span>`;
}

function chip(context, item, index) {
  const {component, size, editable, fieldDisabled, chipsShown, chipActive} = context;
  const label = String(item.label);
  // Row mode (chips="row"): the chips past the row stay drawn, out of the
  // flow and unseen, so the field can measure them; "+N" stands for them.
  const over = chipsShown !== null && index >= chipsShown;
  // The chip the arrows stand on (C139 (6)) wears the focus ring.
  return html`<sf-tag
      class=${['sf-lookup-chip', over ? 'sf-lookup-chip--over' : '', index === chipActive ? 'sf-lookup-chip--active' : ''].filter(Boolean).join(' ')}
      kind=${item.avatar ? 'avatar' : 'default'}
      size=${CHIP_TAG_SIZE[size] || '1/2'}
      inline
      text=${label}
      title=${item.caption ? `${label} — ${item.caption}` : label}
      avatar-image-url=${item.avatar?.src || nothing}
      avatar-text=${item.avatar?.initials || nothing}
      closable=${editable ? '' : 'false'}
      close-label=${component.sfWord('remove', {vars: {label}})}
      ?disabled=${fieldDisabled}
      data-sf-value=${String(item.value)}
      @sf-tag-close=${(event) => component.onChipClose(event, item)}
      @close=${(event) => event.stopPropagation()}
    ></sf-tag>`;
}

// The chips that do not fit one row (chips="row", PROVISIONAL name; C58: one
// row and a «+N» to press in filters, tables and cards). A press, or the focus
// coming into the field, opens the field to every chip; leaving it closes it.
function moreChips(context) {
  const {component, size, chosen, chipsShown} = context;
  if (chipsShown === null || chipsShown >= chosen.length) return nothing;
  const rest = chosen.slice(chipsShown);
  const names = rest.map((item) => String(item.label)).join(', ');
  const said = component.sfWord('more-chips', {count: rest.length, vars: {names}});
  return html`<sf-tag
      class="sf-lookup-more-chips"
      kind="default"
      size=${CHIP_TAG_SIZE[size] || '1/2'}
      inline
      text=${`+${rest.length}`}
      title=${said}
      aria-label=${said}
      closable="false"
      @click=${(event) => component.onMoreChipsClick(event)}
    ></sf-tag>`;
}

// The part of a text the query matched, in the medium weight (owner decision
// C139 (8)): found by the field in the inline options, or the ranges a host
// returned with its answer (item.match); a server's answer without them is
// drawn plain.
function marked(text, ranges) {
  if (!ranges?.length) return text;
  return splitByRanges(text, ranges).map((part) => (part.match ? html`<span class="sf-lookup-match">${part.text}</span>` : part.text));
}

function rangesOf(context, item, part) {
  if (item.match?.[part]) return item.match[part];
  const text = part === 'label' ? item.label : item.caption;
  return context.localQuery ? matchRanges(text, context.localQuery, context.locale) : [];
}

function row(context, item, index) {
  const {component, ids, activeIndex} = context;
  const chosen = component.isItemChosen(item);
  const active = index === activeIndex;
  return html`<div
      class=${['sf-lookup-option', 'flex', 'items-cross-center', item.caption ? 'sf-lookup-option--caption' : '', chosen ? 'sf-lookup-option--chosen' : '', active ? 'sf-lookup-option--active' : ''].filter(Boolean).join(' ')}
      id=${`${ids.option}-${index}`}
      role="option"
      aria-selected=${chosen ? 'true' : 'false'}
      data-sf-index=${String(index)}
    >${avatar(item, AVATAR_CLASS_SIZE, 'sf-lookup-option-avatar')}<span class="sf-lookup-option-text flex flex-col">
        <span class="sf-lookup-option-label">${marked(item.label, rangesOf(context, item, 'label'))}</span>
        ${item.caption ? html`<span class="sf-lookup-option-caption">${marked(item.caption, rangesOf(context, item, 'caption'))}</span>` : nothing}
      </span></div>`;
}

// The create row, last (owner decision C139 (2)): the add icon in the
// picture's place, «Создать «…»» or, for addresses, «Добавить адрес …»; a
// hairline parts it from the rows above.
function createRow(context) {
  const {component, ids, activeIndex, items, offer, creating} = context;
  const index = items.length;
  const words = offer.kind === 'email' ? 'create-email' : 'create-item';
  return html`${items.length ? html`<div class="sf-lookup-divider" role="separator"></div>` : nothing}<div
      class=${['sf-lookup-option', 'sf-lookup-option--create', 'flex', 'items-cross-center', index === activeIndex ? 'sf-lookup-option--active' : ''].filter(Boolean).join(' ')}
      id=${`${ids.option}-${index}`}
      role="option"
      aria-selected="false"
      aria-disabled=${creating ? 'true' : nothing}
      data-sf-index=${String(index)}
    ><sf-icon class="sf-lookup-option-avatar sf-lookup-icon flex-none" icon="add" aria-hidden="true"></sf-icon><span class="sf-lookup-option-text flex flex-col">
        <span class="sf-lookup-option-label">${component.sfWord(words, {vars: {text: offer.text}})}</span>
      </span></div>`;
}

const SPINNER_SIZE = {'1/3': '1/3', '1/2': '1/3', '1': '1/3', '2': '1/2', '3': '1'};

// The line says the wait once, in its own words (LS-16): the spinner keeps its
// label for a screen reader only (label-hidden, C138), so no «Загрузка…» stands
// under it and the line is a row high. The line itself waits the spinner's
// delay before it is drawn (C130 (8)); the stylesheet lets the spinner show at
// once with it, not a second later.
function spinner(context) {
  return html`<sf-spinner class="sf-lookup-spinner flex-none" size=${SPINNER_SIZE[context.size] || '1/3'} label-hidden aria-hidden="true"></sf-spinner>`;
}

function stateLine(context) {
  const {component, listState, minChars, refusal, items, loadingMore, notice, searching, waitShown} = context;
  if (refusal) return html`<span class="sf-lookup-state-text">${refusal}</span>`;
  // A search runs: the rows of the last answer stay; the line comes after the
  // delay, and an old line (the hint, Nothing found) goes at once.
  if (searching || loadingMore) {
    if (waitShown) return html`<span class="sf-lookup-state-text">${component.sfWord('searching')}</span>`;
    return listState === 'results' && !loadingMore
      ? html`<span class="sf-lookup-visually-hidden">${component.sfWord('results', {count: items.length})}</span>`
      : nothing;
  }
  switch (listState) {
    case 'hint':
      return html`<span class="sf-lookup-state-text">${component.sfWord('hint-min-length', {count: minChars})}</span>`;
    case 'empty':
      // With the create row under it, Nothing found is said, not shown.
      return context.offer
        ? html`<span class="sf-lookup-visually-hidden">${component.sfWord('nothing-found')}</span>`
        : html`<span class="sf-lookup-state-text">${component.sfWord('nothing-found')}</span>`;
    case 'unavailable':
      return html`<span class="sf-lookup-state-text">${component.sfWord('unavailable')}</span>`;
    case 'error':
      return html`<span class="sf-lookup-state-text">${component.sfWord('error')}</span>`;
    case 'results':
      // Said, not shown: the rows are what a sighted person reads.
      return html`${notice ? html`<span class="sf-lookup-state-text">${notice}</span>` : nothing}<span class="sf-lookup-visually-hidden">${component.sfWord('results', {count: items.length})}</span>`;
    default:
      return nothing;
  }
}

// The picture of a single chosen value (owner decision C139 (5)): its avatar
// or icon before the name, the field's text line high, --sf-space-1/2 (C105
// H2) before the text; it goes while the person types. The caption is not in
// the field: it is the row's, and the box's tooltip.
function valuePicture(context) {
  const {multiple, chosen, typing} = context;
  const item = !multiple && !typing ? chosen[0] : null;
  if (!item || (!item.avatar && !item.icon)) return nothing;
  return avatar(item, AVATAR_CLASS_SIZE, 'sf-lookup-value-picture');
}

// The frame: the chips and the search box (and a single value's picture and
// clear). The sheet draws its own (sheet: true), with its own box.
function frame(context, {sheet = false} = {}) {
  const {
    component, multiple, chosen, placeholder, queryText, queryMaxLength, listOpen, items, activeIndex,
    editable, ariaLabel, fieldDisabled, readonly, label, typing, offer,
  } = context;
  const {field, ids, message} = context.parts;
  const single = !multiple && chosen[0];
  const rows = items.length + (offer ? 1 : 0);
  const title = single && !typing && single.caption ? `${single.label} — ${single.caption}` : nothing;
  return html`<div class=${['sf-lookup-frame', sheet ? 'sf-lookup-sheet-frame' : '', 'flex', 'flex-wrap', 'items-cross-center'].filter(Boolean).join(' ')} @click=${(event) => component.onFrameClick(event)}>
        ${multiple ? chosen.map((item, index) => chip(context, item, index)) : nothing}
        ${multiple ? moreChips(context) : nothing}
        ${valuePicture(context)}
        <input
          class=${['sf-lookup-input', sheet ? 'sf-lookup-sheet-input' : '', 'flex-1', queryText ? 'sf-lookup-input--typed' : ''].filter(Boolean).join(' ')}
          id=${sheet ? `${field.controlId}--sheet` : field.controlId}
          type="text"
          role="combobox"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint=${sheet ? 'search' : nothing}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded=${listOpen ? 'true' : 'false'}
          aria-controls=${ids.list}
          aria-activedescendant=${listOpen && activeIndex >= 0 && activeIndex < rows ? `${ids.option}-${activeIndex}` : nothing}
          aria-labelledby=${label ? ids.label : nothing}
          aria-label=${!label && ariaLabel ? ariaLabel : nothing}
          aria-describedby=${message ? field.messageId : nothing}
          aria-errormessage=${field.invalid && context.errorMessage ? field.messageId : nothing}
          aria-invalid=${field.invalid ? 'true' : nothing}
          aria-required=${field.required ? 'true' : nothing}
          aria-readonly=${readonly ? 'true' : nothing}
          title=${title}
          placeholder=${(multiple && chosen.length) || single ? nothing : placeholder || nothing}
          maxlength=${queryMaxLength > 0 ? String(queryMaxLength) : nothing}
          ?disabled=${fieldDisabled}
          ?readonly=${readonly}
          .value=${live(queryText)}
          @input=${(event) => component.onQueryInput(event)}
          @change=${(event) => event.stopPropagation()}
          @keydown=${(event) => component.onQueryKeydown(event)}
          @focus=${(event) => component.onQueryFocus(event)}
        >
        ${single && editable
          ? html`<button type="button"
              class="sf-field-action sf-lookup-clear"
              aria-label=${component.sfWord('clear')}
              @click=${(event) => component.onClearClick(event)}
            ><sf-icon icon="close" aria-hidden="true"></sf-icon></button>`
          : nothing}
      </div>`;
}

export function renderLookupTemplate(context) {
  const {
    component,
    size,
    appearance,
    label,
    required,
    hint,
    errorMessage,
    invalid,
    fieldDisabled,
    readonly,
    multiple,
    chosen,
    listOpen,
    listState,
    items,
    nextCursor,
    loadingMore,
    refusal,
    searching,
    waitShown,
    chipsMode,
    chipsShown,
    offer,
    sheet,
    announce,
  } = context;
  const field = createFieldContract(component, {prefix: 'sf-lookup', required, invalid, hint, errorMessage});
  const ids = {
    label: `${field.base}--label`,
    panel: `${field.base}--panel`,
    list: `${field.base}--list`,
    status: `${field.base}--status`,
    option: `${field.base}--option`,
  };
  const message = field.invalid && errorMessage ? errorMessage : hint;
  const rowContext = {...context, ids, parts: {field, ids, message}};
  const showList = listOpen && (items.length > 0 || Boolean(offer)) && (!searching || listState === 'results' || Boolean(offer));
  // The rows of the last answer while a new search runs, a step paler (C139 (4)).
  const stale = showList && searching && listState === 'results';
  // Nothing to show yet (a first search inside the delay): the panel is not drawn.
  const stateShown = Boolean(refusal) || ((searching || loadingMore) ? waitShown : !['closed', 'results'].includes(listState) && !(listState === 'empty' && offer));
  const blank = listOpen && !sheet && !showList && !stateShown && listState !== 'error';
  const rootClasses = [
    'sf-lookup',
    `sf-lookup--size-${size}`,
    `sf-lookup--${appearance}`,
    multiple ? 'sf-lookup--multiple' : 'sf-lookup--single',
    multiple && chipsMode === 'row' ? 'sf-lookup--chips-row' : '',
    context.chipsCollapsed ? 'sf-lookup--chips-collapsed' : '',
    context.chipsCollapsed && chipsShown === 1 && chosen.length > 1 ? 'sf-lookup--chips-one' : '',
    listOpen ? 'sf-lookup--open' : '',
    sheet ? 'sf-lookup--sheet' : '',
    field.invalid ? 'error' : '',
    fieldDisabled ? 'sf-lookup--disabled' : '',
    readonly ? 'sf-lookup--readonly' : '',
    'flex',
    'flex-col',
    context.rootClass,
  ].filter(Boolean);
  const panelClasses = ['sf-lookup-panel', blank ? 'sf-lookup-panel--blank' : '', sheet ? 'sf-lookup-panel--sheet' : ''].filter(Boolean);

  return html`
    <div class=${rootClasses.join(' ')} style=${context.rootStyle || nothing}
      @pointerdown=${(event) => component.onRootPointerDown(event)}
      @focusin=${() => component.onRootFocusIn()}
      @focusout=${(event) => component.onRootFocusOut(event)}>
      ${label
        ? html`<span class="sf-lookup-label flex" id=${ids.label} @click=${() => component.focus()}>
            <span class="sf-lookup-text">${label}</span>
            ${required ? html`<span class="sf-lookup-required" aria-hidden="true">*</span>` : ''}
          </span>`
        : ''}
      ${frame(rowContext)}
      ${message
        ? html`<span id=${field.messageId} class="sf-lookup-hint-text-wrap"
            data-field-message=${field.invalid && errorMessage ? 'error' : 'hint'}>${message}</span>`
        : ''}
      <span class="sf-lookup-visually-hidden" role="status" aria-live="polite">${announce}</span>
      <div class=${panelClasses.join(' ')} id=${ids.panel} popover="manual"
        role=${sheet ? 'dialog' : nothing}
        aria-modal=${sheet ? 'true' : nothing}
        aria-label=${sheet ? label || context.ariaLabel || nothing : nothing}
        @mousedown=${(event) => component.onPanelMouseDown(event)}
        @click=${(event) => component.onPanelClick(event)}>
        ${sheet
          ? html`<div class="sf-lookup-sheet-head flex items-cross-center">
              <sf-button-icon class="sf-lookup-sheet-done" icon="arrow_back" size="1/2" appearance="ghost" scheme="on-surface"
                aria-label=${component.sfWord('done')} @click=${(event) => component.onSheetDone(event)}></sf-button-icon>
              ${frame(rowContext, {sheet: true})}
            </div>`
          : nothing}
        <div class=${['sf-lookup-list', stale ? 'sf-lookup-list--stale' : ''].filter(Boolean).join(' ')} id=${ids.list} role="listbox"
          aria-labelledby=${label ? ids.label : nothing}
          aria-label=${!label && context.ariaLabel ? context.ariaLabel : nothing}
          aria-multiselectable=${multiple ? 'true' : nothing}
          aria-busy=${stale ? 'true' : nothing}
          ?hidden=${!showList}>${showList ? items.map((item, index) => row(rowContext, item, index)) : nothing}${showList && offer ? createRow(rowContext) : nothing}</div>
        <div class=${['sf-lookup-state', 'flex', 'items-cross-center', refusal ? 'sf-lookup-state--refusal' : '', listState === 'error' && !refusal ? 'sf-lookup-state--error' : ''].filter(Boolean).join(' ')}>
          ${listOpen && !refusal && (searching || loadingMore) && waitShown ? spinner(rowContext) : nothing}
          <span class="sf-lookup-status" id=${ids.status} role="status" aria-live="polite">${listOpen ? stateLine(rowContext) : nothing}</span>
        </div>
        ${listOpen && listState === 'error'
          ? html`<div class="sf-lookup-actions flex"><sf-button class="sf-lookup-retry" size=${BUTTON_SIZE[size] || '1/2'} appearance="outline"
              @click=${() => component.onRetryClick()}>${component.sfWord('retry')}</sf-button></div>`
          : nothing}
        ${listOpen && listState === 'results' && nextCursor !== null && !loadingMore
          ? html`<div class="sf-lookup-actions flex"><sf-button class="sf-lookup-more" size=${BUTTON_SIZE[size] || '1/2'} appearance="outline"
              @click=${() => component.onShowMoreClick()}>${component.sfWord('show-more')}</sf-button></div>`
          : nothing}
      </div>
    </div>
  `;
}

import {html, nothing} from 'lit';
import {live} from 'lit/directives/live.js';
import {createFieldContract} from '../../../../component/field-contract';

// The field: a label row, one frame holding the chips and the search box, the
// hint or error line under it, and the list panel -- a popover the component
// anchors under the frame. sf-input's parts, in its places.
//
// The search box is the combobox; the focus never leaves it while the arrows
// move the active row (aria-activedescendant). Rows are drawn here, not as
// elements: the class markup of an avatar (a photo or initials) beside the
// label and the caption, and a check on a chosen row.

// A row's picture a rung below the field; the chips stand on the field's line.
const AVATAR_SIZE = {'1/2': '1/3', '1': '1/2', '2': '1'};
const CLEAR_SIZE = {'1/2': '1/4', '1': '1/3', '2': '1/2'};
const BUTTON_SIZE = {'1/2': '1/3', '1': '1/2', '2': '1'};

function avatar(item, size, extraClass = '') {
  if (!item.avatar) return nothing;
  const classes = `sf-avatar sf-avatar--size-${size} inline-flex flex-none items-cross-center content-main-center overflow-hidden ${extraClass}`;
  if (item.avatar.src) {
    return html`<span class=${classes} aria-hidden="true"><img class="sf-avatar-image" src=${item.avatar.src} alt="" loading="lazy" decoding="async"></span>`;
  }
  return html`<span class="${classes} sf-avatar--text" aria-hidden="true">${item.avatar.initials}</span>`;
}

function chip(context, item) {
  const {component, size, editable, fieldDisabled} = context;
  const label = String(item.label);
  return html`<sf-tag
      class="sf-lookup-chip"
      kind=${item.avatar ? 'avatar' : 'default'}
      line=${size}
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

function row(context, item, index) {
  const {component, ids, activeIndex, size} = context;
  const chosen = component.isItemChosen(item);
  const active = index === activeIndex;
  return html`<div
      class=${['sf-lookup-option', 'flex', 'items-cross-center', chosen ? 'sf-lookup-option--chosen' : '', active ? 'sf-lookup-option--active' : ''].filter(Boolean).join(' ')}
      id=${`${ids.option}-${index}`}
      role="option"
      aria-selected=${chosen ? 'true' : 'false'}
      data-sf-index=${String(index)}
    >${avatar(item, AVATAR_SIZE[size] || '1/2', 'sf-lookup-option-avatar')}<span class="sf-lookup-option-text flex flex-col">
        <span class="sf-lookup-option-label">${item.label}</span>
        ${item.caption ? html`<span class="sf-lookup-option-caption">${item.caption}</span>` : nothing}
      </span><i class="sf-icon sf-lookup-option-check" aria-hidden="true">${chosen ? 'check' : ''}</i></div>`;
}

const SPINNER_SIZE = {'1/2': '1/3', '1': '1/3', '2': '1/2'};

function spinner(context) {
  return html`<sf-spinner class="sf-lookup-spinner flex-none" size=${SPINNER_SIZE[context.size] || '1/3'} aria-hidden="true"></sf-spinner>`;
}

function stateLine(context) {
  const {component, listState, minChars, refusal, items, loadingMore} = context;
  if (refusal) return html`<span class="sf-lookup-state-text">${refusal}</span>`;
  switch (listState) {
    case 'hint':
      return html`<span class="sf-lookup-state-text">${component.sfWord('hint-min-length', {count: minChars})}</span>`;
    case 'searching':
      return html`<span class="sf-lookup-state-text">${component.sfWord('searching')}</span>`;
    case 'empty':
      return html`<span class="sf-lookup-state-text">${component.sfWord('nothing-found')}</span>`;
    case 'unavailable':
      return html`<span class="sf-lookup-state-text">${component.sfWord('unavailable')}</span>`;
    case 'error':
      return html`<span class="sf-lookup-state-text">${component.sfWord('error')}</span>`;
    case 'results':
      return loadingMore
        ? html`<span class="sf-lookup-state-text">${component.sfWord('searching')}</span>`
        // Said, not shown: the rows are what a sighted person reads.
        : html`<span class="sf-lookup-visually-hidden">${component.sfWord('results', {count: items.length})}</span>`;
    default:
      return nothing;
  }
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
    placeholder,
    chosen,
    queryText,
    queryMaxLength,
    listOpen,
    listState,
    items,
    activeIndex,
    nextCursor,
    loadingMore,
    editable,
    ariaLabel,
    refusal,
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
  const rowContext = {...context, ids};
  const showList = listOpen && items.length > 0;
  const rootClasses = [
    'sf-lookup',
    `sf-lookup--size-${size}`,
    `sf-lookup--${appearance}`,
    multiple ? 'sf-lookup--multiple' : 'sf-lookup--single',
    listOpen ? 'sf-lookup--open' : '',
    field.invalid ? 'error' : '',
    fieldDisabled ? 'sf-lookup--disabled' : '',
    readonly ? 'sf-lookup--readonly' : '',
    'flex',
    'flex-col',
    context.rootClass,
  ].filter(Boolean);
  const single = !multiple && chosen[0];

  return html`
    <div class=${rootClasses.join(' ')} style=${context.rootStyle || nothing}
      @pointerdown=${(event) => component.onRootPointerDown(event)}
      @focusout=${(event) => component.onRootFocusOut(event)}>
      ${label
        ? html`<span class="sf-lookup-label flex" id=${ids.label} @click=${() => component.focus()}>
            <span class="sf-lookup-text">${label}</span>
            ${required ? html`<span class="sf-lookup-required" aria-hidden="true">*</span>` : ''}
          </span>`
        : ''}
      <div class="sf-lookup-frame flex flex-wrap items-cross-center" @click=${(event) => component.onFrameClick(event)}>
        ${multiple ? chosen.map((item) => chip(context, item)) : nothing}
        <input
          class="sf-lookup-input flex-1"
          id=${field.controlId}
          type="text"
          role="combobox"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded=${listOpen ? 'true' : 'false'}
          aria-controls=${ids.list}
          aria-activedescendant=${listOpen && activeIndex >= 0 && activeIndex < items.length ? `${ids.option}-${activeIndex}` : nothing}
          aria-labelledby=${label ? ids.label : nothing}
          aria-label=${!label && ariaLabel ? ariaLabel : nothing}
          aria-describedby=${message ? field.messageId : nothing}
          aria-errormessage=${field.invalid && errorMessage ? field.messageId : nothing}
          aria-invalid=${field.invalid ? 'true' : nothing}
          aria-required=${field.required ? 'true' : nothing}
          aria-readonly=${readonly ? 'true' : nothing}
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
              class="sf-lookup-clear sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-${CLEAR_SIZE[size] || '1/3'} flex items-cross-center flex-none"
              aria-label=${component.sfWord('clear')}
              title=${component.sfWord('clear')}
              @click=${(event) => component.onClearClick(event)}
            ><i class="sf-icon" aria-hidden="true">close</i></button>`
          : nothing}
      </div>
      ${message
        ? html`<span id=${field.messageId} class="sf-lookup-hint-text-wrap"
            data-field-message=${field.invalid && errorMessage ? 'error' : 'hint'}>${message}</span>`
        : ''}
      <div class="sf-lookup-panel" id=${ids.panel} popover="manual"
        @mousedown=${(event) => component.onPanelMouseDown(event)}
        @click=${(event) => component.onPanelClick(event)}>
        <div class="sf-lookup-list" id=${ids.list} role="listbox"
          aria-labelledby=${label ? ids.label : nothing}
          aria-label=${!label && ariaLabel ? ariaLabel : nothing}
          aria-multiselectable=${multiple ? 'true' : nothing}
          ?hidden=${!showList}>${showList ? items.map((item, index) => row(rowContext, item, index)) : nothing}</div>
        <div class=${['sf-lookup-state', 'flex', 'items-cross-center', refusal ? 'sf-lookup-state--refusal' : '', listState === 'error' && !refusal ? 'sf-lookup-state--error' : ''].filter(Boolean).join(' ')}>
          ${listOpen && !refusal && (listState === 'searching' || (listState === 'results' && loadingMore)) ? spinner(rowContext) : nothing}
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

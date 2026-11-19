import {html, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {optionBadgeProps, optionDotColor} from '../../../helpers/option-badge.js';
import {optionLook} from '../choice-model.mjs';

// sf-input-choice's markup: the label row, the cards and the hint or error
// line under them (owner decision C28, prototype input-choice-world.html).
//
//   div.sf-choice[data-layout=list|tile|picture]
//     span.sf-choice-label            names the group (aria-labelledby)
//     div.sf-choice-grid              role radiogroup (single) or group (multiple)
//       label.sf-choice-card          one per option; the whole card is the target
//         span.sf-choice-media        picture: the image, to the card's edges
//         span.sf-choice-head         the name line and what hangs from it
//           span.sf-radio-button | span.sf-checkbox
//                                     the class radio or checkbox sf-radio and
//                                     sf-checkbox draw, size 1: its box is the
//                                     name line; the native input is in it
//           span.sf-choice-body       the name (icon, title, sf-badge) and the description
//           span.sf-choice-meta       list: price and term, a column at the line's end
//         span.sf-choice-rule         tile and picture with a price: the divider
//         span.sf-choice-price        tile and picture: price and term at the foot
//     span.sf-choice-message          the hint, or the error while invalid
//
// The native inputs are the control: the arrow keys move and choose in a
// radio group, Space toggles a checkbox, and each is named by its title (and
// badge; never the icon's ligature) and
// described by its description, price and term. While the host is the form
// control they stay out of the page's form (§17.1 item 6).

// The «?» after the heading or the label (help; C153 (8), C165 (1)): a step
// below the line it stands on, 1/3, as beside the checkable rows' text of
// size 1 (helpers/checkable-row.js CHECKABLE_HELP_SIZE); each sheet holds it
// to that line, so the line keeps its height.
function renderHelp(context) {
  if (!context.help) return nothing;
  return html`<sf-help-mark class="sf-choice-help" size="1/3" text=${context.help} label=${context.helpLabel || nothing}
                            @click=${(event) => event.stopPropagation()}></sf-help-mark>`;
}

const joinClasses = (...tokens) => tokens.flat().filter(Boolean).join(' ');

// The control on the name line: the markup of the class radio or checkbox,
// with the card's own native input in its box and the same utility classes
// sf-radio and sf-checkbox write (the class sheets leave display to them). Invalid marks the control of a
// card not chosen (C13: error).
function renderControl(context, item, state) {
  const {checked, disabled, ids} = state;
  const described = [item.caption ? ids.caption : '', item.price || item.term ? ids.price : ''].filter(Boolean).join(' ');
  const input = html`<input class="sf-choice-input" type=${context.multiple ? 'checkbox' : 'radio'}
           name=${context.controlName || nothing} form=${context.innerForm || nothing}
           value=${item.value} .checked=${checked} ?disabled=${disabled}
           aria-labelledby=${item.badge ? `${ids.title} ${ids.badge}` : ids.title} aria-describedby=${described || nothing}
           aria-invalid=${context.invalid ? 'true' : nothing}>`;
  const error = context.invalid && !checked ? 'error' : '';
  // sf-choice-mark: the 1.0 ring's class, a legacy alias of sf-choice-control
  // until 2027-01-01 (change journal class-input-choice-mark-to-control).
  const control = ['sf-choice-control', 'sf-choice-mark'];
  if (context.multiple) {
    return html`<span class=${joinClasses('sf-checkbox', 'sf-checkbox--size-1', 'flex', control, error)}><span class="sf-checkbox-box transition flex items-cross-center content-main-center">${input}${checked
      ? html`<span class="sf-icon" aria-hidden="true">check</span>`
      : nothing}</span></span>`;
  }
  return html`<span class=${joinClasses('sf-radio-button', 'sf-radio-button--size-1', 'flex', control, error)}><span class="sf-radio-button-box transition flex items-cross-center content-main-center">${input}<span class="sf-radio-button-mark" aria-hidden="true"></span></span></span>`;
}

function renderPrice(item, id, kind) {
  if (!item.price && !item.term) return nothing;
  return html`<span class=${kind} id=${id}>${item.price
    ? html`<span class="sf-choice-price-value">${item.price}</span>`
    : nothing}${item.term ? html`<span class="sf-choice-term">${item.term}</span>` : nothing}</span>`;
}

function renderCard(context, item, index) {
  const checked = context.chosen.has(item.value);
  const disabled = context.fieldDisabled || item.disabled;
  const n = index + 1;
  const ids = {
    title: `${context.id}--title-${n}`,
    badge: `${context.id}--badge-${n}`,
    caption: `${context.id}--caption-${n}`,
    price: `${context.id}--price-${n}`,
  };
  const list = context.layout === 'list';
  const picture = context.layout === 'picture';
  const foot = !list && (item.price || item.term);
  return html`<label class=${joinClasses('sf-choice-card', checked ? 'sf-choice-card--checked' : '', disabled ? 'sf-choice-card--disabled' : '')}>
    ${picture && item.image
      ? html`<span class="sf-choice-media" aria-hidden="true"><img src=${item.image} alt="" loading="lazy" decoding="async"></span>`
      : nothing}
    <span class="sf-choice-head">
      ${renderControl(context, item, {checked, disabled, ids})}
      <span class="sf-choice-body">
        <span class="sf-choice-title">${item.icon && !item.avatar
          ? html`<span class="sf-icon sf-choice-icon" aria-hidden="true">${item.icon}</span>`
          : renderVisual(context, item, {icon: false})}${renderName(context, item, disabled, ids.title)}${item.badge
          ? html`<sf-badge class="sf-choice-badge" id=${ids.badge} text=${item.badge} appearance="tonal" scheme="primary" line="1/2"
                           root-class=${disabled ? 'sf-badge--disabled' : nothing}></sf-badge>`
          : nothing}</span>
        ${item.caption ? html`<span class="sf-choice-caption" id=${ids.caption}>${item.caption}</span>` : nothing}
      </span>
      ${list ? renderPrice(item, ids.price, 'sf-choice-meta') : nothing}
    </span>
    ${foot ? html`<span class="sf-choice-rule" aria-hidden="true"></span>${renderPrice(item, ids.price, 'sf-choice-price')}` : nothing}
  </label>`;
}

// ---------------------------------------------------------------- list
//
// appearance="list" (owner decision C165 (1), (3); research ui-control
// control/research/2026-11-14-checks.md, prototype checks-study.html#q-group
// and #q-inline): the ready group of checks or radios.
//
//   div.sf-choice[data-appearance=list][data-flow=row|column]
//     div.sf-choice-heading           the heading (text 1, medium), «*», «?»
//     span.sf-choice-hint             the hint under the heading
//     div.sf-choice-options           role radiogroup (single) or group (multiple)
//       label.sf-radio-button | label.sf-checkbox   one row per option: the
//                                     class markup sf-radio and sf-checkbox
//                                     draw (size 1), the native input in its
//                                     box, the name and the description; a row
//                                     of the step, as the C63 rows
//     span.sf-choice-message          the error under the last row, its icon first
//
// The group is named by the heading and described by the hint and the error.
// While invalid every row's control takes the error colour, as an invalid
// sf-radio or sf-checkbox.

// An option's visual (FO-4; in every appearance since FO4-1): a picture
// (sf-avatar on the row's line), else its icon (FO4-3), else its colour as a
// circle when the look is dot (the menu's colour row, C85); with the look
// badge the name itself is a tonal badge (sf-badge tight, its scheme, palette
// hue or hex through helpers/option-badge.js, as a table cell's choice). The
// picture, the icon and the circle are not read: the name is.
function renderVisual(context, item, {icon = true} = {}) {
  if (item.avatar) {
    return html`<sf-avatar class="sf-choice-avatar" size="1" line="1" aria-hidden="true"
                           image-url=${item.avatar.image || nothing}
                           text=${item.avatar.text || nothing} heading=${item.label}></sf-avatar>`;
  }
  if (icon && item.icon) return html`<span class="sf-icon sf-choice-icon" aria-hidden="true">${item.icon}</span>`;
  if (item.color && optionLook(item, context.optionLook) === 'dot') {
    return html`<span class="sf-choice-swatch" style=${`--sf-choice--swatch: ${optionDotColor(item)}`} aria-hidden="true"></span>`;
  }
  return nothing;
}

function renderName(context, item, disabled, id = '') {
  if (!item.color || optionLook(item, context.optionLook) !== 'badge') return id ? html`<span class="sf-choice-title-text" id=${id}>${item.label}</span>` : item.label;
  const badge = optionBadgeProps({color: item.color});
  return html`<sf-badge class="sf-choice-name-badge" id=${id || nothing} appearance="tonal" tight line="1" scheme=${badge.scheme}
                        root-style=${badge.rootStyle || nothing} root-class=${disabled ? 'sf-badge--disabled' : nothing}
                        text=${item.label}></sf-badge>`;
}

function renderRow(context, item, index) {
  const checked = context.chosen.has(item.value);
  const disabled = context.fieldDisabled || item.disabled;
  const n = index + 1;
  const titleId = `${context.id}--title-${n}`;
  const captionId = `${context.id}--caption-${n}`;
  const input = html`<input class="sf-choice-input" type=${context.multiple ? 'checkbox' : 'radio'}
           name=${context.controlName || nothing} form=${context.innerForm || nothing}
           value=${item.value} .checked=${checked} ?disabled=${disabled}
           aria-labelledby=${titleId} aria-describedby=${item.caption ? captionId : nothing}
           aria-invalid=${context.invalid ? 'true' : nothing}>`;
  const error = context.invalid ? 'error' : '';
  // The last of what was chosen when the list opened, which stands first
  // (FO4-5): a hairline under it parts it from the rest (filter field study).
  const last = index === context.chosenLast ? 'sf-choice-row--chosen-last' : '';
  if (context.multiple) {
    return html`<label class=${joinClasses('sf-checkbox', 'sf-checkbox--size-1', 'flex', 'sf-choice-row', last, disabled ? '' : 'cursor-pointer', error)}>
      <span class="sf-checkbox-box flex">${input}${checked
        ? html`<span class="sf-icon" aria-hidden="true">check</span>`
        : nothing}</span>
      <span class="sf-checkbox-container flex flex-col"><span class="sf-checkbox-top flex">${renderVisual(context, item)}<span class="sf-checkbox-label" id=${titleId}>${renderName(context, item, disabled)}</span></span>${item.caption
        ? html`<span class="sf-checkbox-description" id=${captionId}>${item.caption}</span>`
        : nothing}</span>
    </label>`;
  }
  return html`<label class=${joinClasses('sf-radio-button', 'sf-radio-button--size-1', 'flex', 'sf-choice-row', last, disabled ? '' : 'cursor-pointer', error)}>
    <span class="sf-radio-button-box flex items-cross-center content-main-center">${input}<span class="sf-radio-button-mark" aria-hidden="true"></span></span>
    <span class="sf-radio-button-container flex flex-col"><span class="sf-radio-button-top flex">${renderVisual(context, item)}<span class="sf-radio-button-text" id=${titleId}>${renderName(context, item, disabled)}</span></span>${item.caption
      ? html`<span class="sf-radio-button-description" id=${captionId}>${item.caption}</span>`
      : nothing}</span>
  </label>`;
}

// The search over the rows and what the host's pages say under them (FO-4):
// searchable puts the dropping panel's search header over the options (C06,
// FF-7: one search look with sf-dropdown's and sf-settings' -- no frame, no
// fill, a hairline under it, its text over the rows' text and its icon at
// the end; it was a filled sf-input, a second look); a provider's answer is said in one polite status line --
// loading, nothing found, the error with «Try again» -- and «Show more» asks
// for its next page.
function renderSearch(context) {
  const {paging} = context;
  if (!paging.searchable) return nothing;
  return html`<label class="sf-choice-search">
    <span class="sf-choice-search-icon" aria-hidden="true"><i class="sf-icon">search</i></span>
    <input type="search" class="sf-choice-search-input" autocomplete="off" spellcheck="false"
           placeholder=${paging.words.search} aria-label=${paging.words.search}
           .value=${paging.query} ?disabled=${context.fieldDisabled}
           @input=${(event) => {
             // The search box's own input and change stop here:
             // typing is not a change of the field's value.
             event.stopPropagation();
             context.component.searchFor(event.target?.value ?? '');
           }}
           @change=${(event) => event.stopPropagation()}>
  </label>`;
}

// «Select found (N)» (owner decision C312 (1)): in a panel, while a search
// is typed in a multiple list, the first row chooses the rows found and not
// chosen; it is gone with the search, or when nothing found is left to choose.
function renderSelectFound(context) {
  const {paging} = context;
  if (!context.panel || !context.multiple || !paging.found) return nothing;
  return html`<button type="button" class="sf-choice-found" data-sf-select-found ?disabled=${context.fieldDisabled}
                      @click=${() => context.component.selectFound()}>
    <span class="sf-icon sf-choice-found-icon" aria-hidden="true">done_all</span><span class="sf-choice-found-text">${paging.words.found} (${paging.found})</span>
  </button>`;
}

function renderPaging(context) {
  const {paging} = context;
  const line = paging.status === 'loading' ? paging.words.loading
    : paging.status === 'error' ? paging.words.error
      : paging.status === 'empty' ? paging.words.empty : '';
  return html`<span class="sf-choice-status" role="status" aria-live="polite" ?hidden=${!line}>${line}</span>${paging.status === 'error'
    ? html`<sf-button class="sf-choice-more" size="1/2" appearance="ghost" scheme="on-surface" text=${paging.words.retry}
                      @click=${() => context.component.loadPage(paging.retryCursor)}></sf-button>`
    : paging.nextCursor && paging.status !== 'loading'
      ? html`<sf-button class="sf-choice-more" size="1/2" appearance="ghost" scheme="on-surface" icon="expand_more" text=${paging.words.more}
                        @click=${() => context.component.loadPage(paging.nextCursor)}></sf-button><span class="sf-choice-end" data-sf-more aria-hidden="true"></span>`
      : nothing}`;
}

// In a panel (C313 (3)) the rows and their paging scroll under the search,
// in one box: the band and the search stay and reach both edges, and the
// mark after «Show more» comes into view only at the list's end (FO4-4).
function renderScroll(context, content) {
  return context.panel ? html`<div class="sf-choice-scroll">${content}</div>` : content;
}

function renderListTemplate(context) {
  const labelId = `${context.id}--label`;
  const hintId = `${context.id}--hint`;
  const messageId = `${context.id}--message`;
  const error = context.invalid && context.errorMessage ? context.errorMessage : '';
  const described = [context.hint ? hintId : '', error ? messageId : ''].filter(Boolean).join(' ');
  return html`<div class=${joinClasses('sf-choice', 'sf-choice--list', context.multiple ? 'sf-choice--multiple' : '', context.invalid ? 'sf-choice--invalid' : '', context.fieldDisabled ? 'sf-choice--disabled' : '', context.rootClass)}
                   style=${context.rootStyle || nothing} data-appearance="list" data-flow=${context.flow}
                   data-control-position=${context.controlPosition} ?data-panel=${context.panel}>
    ${context.label
      ? html`<div class="sf-choice-heading"><span class="sf-choice-heading-text" id=${labelId}>${context.label}${context.required
        ? html`<span class="sf-choice-required" aria-hidden="true">*</span>`
        : nothing}</span>${renderHelp(context)}</div>`
      : nothing}
    ${context.hint ? html`<span class="sf-choice-hint" id=${hintId}>${context.hint}</span>` : nothing}
    ${renderSearch(context)}
    ${renderSelectFound(context)}
    ${renderScroll(context, html`<div class="sf-choice-options" role=${context.multiple ? 'group' : 'radiogroup'}
         aria-labelledby=${context.label ? labelId : nothing}
         aria-label=${!context.label && context.ariaLabel ? context.ariaLabel : nothing}
         aria-describedby=${described || nothing}
         aria-required=${context.required && !context.multiple ? 'true' : nothing}
         aria-invalid=${context.invalid && !context.multiple ? 'true' : nothing}
         aria-disabled=${context.fieldDisabled ? 'true' : nothing}>
      ${repeat(context.items, (item) => item.value, (item, index) => renderRow(context, item, index))}
    </div>
    ${context.paging.shown ? renderPaging(context) : nothing}`)}
    ${error
      ? html`<span class="sf-choice-message" id=${messageId} data-field-message="error"><span class="sf-icon sf-choice-message-icon" aria-hidden="true">error</span><span class="sf-choice-message-text">${error}</span></span>`
      : nothing}
  </div>`;
}

// The cards' label row: the label, then with help its «?» beside it in one
// row (the mark is the label's sibling, so the group's name is the label alone).
function renderLabel(context, labelId) {
  const label = html`<span class="sf-choice-label" id=${labelId}>${context.label}${context.required ? html`<span class="sf-choice-required" aria-hidden="true">*</span>` : nothing}</span>`;
  if (!context.help) return label;
  return html`<div class="sf-choice-label-row">${label}${renderHelp(context)}</div>`;
}

export function renderChoiceTemplate(context) {
  if (context.appearance === 'list') return renderListTemplate(context);
  const labelId = `${context.id}--label`;
  const messageId = `${context.id}--message`;
  const message = context.invalid && context.errorMessage ? context.errorMessage : context.hint;
  return html`<div class=${joinClasses('sf-choice', context.multiple ? 'sf-choice--multiple' : '', context.invalid ? 'sf-choice--invalid' : '', context.fieldDisabled ? 'sf-choice--disabled' : '', context.rootClass)}
                   style=${context.rootStyle || nothing} data-layout=${context.layout} data-columns=${context.columns}>
    ${context.label
      ? renderLabel(context, labelId)
      : nothing}
    <div class="sf-choice-grid" role=${context.multiple ? 'group' : 'radiogroup'}
         aria-labelledby=${context.label ? labelId : nothing}
         aria-label=${!context.label && context.ariaLabel ? context.ariaLabel : nothing}
         aria-describedby=${message ? messageId : nothing}
         aria-required=${context.required && !context.multiple ? 'true' : nothing}
         aria-invalid=${context.invalid && !context.multiple ? 'true' : nothing}
         aria-disabled=${context.fieldDisabled ? 'true' : nothing}>
      ${repeat(context.items, (item) => item.value, (item, index) => renderCard(context, item, index))}
    </div>
    ${message
      ? html`<span class="sf-choice-message" id=${messageId} data-field-message=${context.invalid && context.errorMessage ? 'error' : 'hint'}>${message}</span>`
      : nothing}
  </div>`;
}

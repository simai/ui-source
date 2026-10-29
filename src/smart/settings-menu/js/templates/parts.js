import {html, nothing} from 'lit';

// The parts both templates of sf-settings-menu draw: the panel around them,
// its heading, the tiles on top, the choice list a row opens in place, the
// rows every arrangement shares (a switch, a range, an action, a section, a
// divider) and the reset row. The two templates differ only in how a choice
// row looks (default.js: the value under the name and a chevron; rows.js:
// the control at the end).
//
// Every focusable part is a native control with its own role and carries
// the class sf-settings-menu-stop and data-sf-row, the row it belongs to:
// index.js walks the rows with the arrow keys and keeps one stop in the tab
// order.

export const STOP = 'sf-settings-menu-stop';

export function icon(name, className = '') {
  return html`<i class="sf-icon ${className}" aria-hidden="true">${name}</i>`;
}

// The leading place of a row: its icon, or an empty place of the same width
// when another row of the level has one, so the names start on one line.
function lead(item, context) {
  if (item.icon) return icon(item.icon, 'sf-settings-menu-row-icon');
  return context.lead ? html`<span class="sf-settings-menu-row-icon" aria-hidden="true"></span>` : nothing;
}

export function renderText(item, context, {value = false} = {}) {
  const nameId = `${context.id}-name-${item.key}`;
  const captionId = `${context.id}-caption-${item.key}`;
  return html`<span class="sf-settings-menu-row-text">
    <span class="sf-settings-menu-row-name" id=${nameId}>${item.label}</span>
    ${value ? html`<span class="sf-settings-menu-row-value" title=${item.valueLabel}>${item.valueLabel}</span>` : nothing}
    ${item.caption ? html`<span class="sf-settings-menu-row-caption" id=${captionId}>${item.caption}</span>` : nothing}
  </span>`;
}

const ids = (item, context) => ({
  name: `${context.id}-name-${item.key}`,
  caption: item.caption ? `${context.id}-caption-${item.key}` : undefined,
});

// A boolean: the Framework switch (component switch) at the end of a row the
// whole of which is its label, so a press anywhere on the row toggles it.
export function renderSwitchRow(item, context) {
  const {component} = context;
  const {name, caption} = ids(item, context);
  return html`<label class="sf-settings-menu-row sf-settings-menu-row--switch ${item.disabled ? 'sf-settings-menu-row--disabled' : ''}" data-sf-key=${item.key}>
    ${lead(item, context)}
    ${renderText(item, context)}
    <span class="sf-switch sf-switch--size-1/2 sf-settings-menu-switch ${item.disabled ? 'disabled' : ''}">
      <span class="sf-switch-toggler">
        <input type="checkbox" role="switch" class=${STOP} data-sf-row=${item.row} tabindex="-1"
          .checked=${Boolean(item.value)} ?disabled=${item.disabled}
          aria-labelledby=${name} aria-describedby=${caption ?? nothing}
          @change=${(event) => component.toggleBoolean(item.key, event.target)}>
        <span class="sf-switch-inner" aria-hidden="true"></span>
      </span>
    </span>
  </label>`;
}

// A number in a range: the native slider, the value written after it.
export function renderRangeRow(item, context) {
  const {component} = context;
  const {name, caption} = ids(item, context);
  return html`<div class="sf-settings-menu-row sf-settings-menu-row--range ${item.disabled ? 'sf-settings-menu-row--disabled' : ''}" data-sf-key=${item.key}>
    ${lead(item, context)}
    <span class="sf-settings-menu-row-main">
    ${renderText(item, context)}
    <span class="sf-settings-menu-row-control">
      <input type="range" class="sf-settings-menu-range ${STOP}" data-sf-row=${item.row} tabindex="-1"
        min=${item.min} max=${item.max} step=${item.step} .value=${String(item.value)} ?disabled=${item.disabled}
        aria-labelledby=${name} aria-describedby=${caption ?? nothing} aria-valuetext=${item.valueLabel}
        @input=${(event) => component.previewRange(item.key, event.target)}
        @change=${(event) => component.commitRange(item.key, event.target)}>
      <span class="sf-settings-menu-range-value" aria-hidden="true">${item.valueLabel}</span>
    </span>
    </span>
  </div>`;
}

// An action: a row that is one button; the page does the action.
export function renderActionRow(item, context) {
  const {component} = context;
  return html`<button type="button" class="sf-settings-menu-row sf-settings-menu-row--action ${STOP}" data-sf-row=${item.row} data-sf-key=${item.key}
    tabindex="-1" ?disabled=${item.disabled} @click=${() => component.chooseAction(item.key)}>
    ${lead(item, context)}
    ${renderText(item, context)}
  </button>`;
}

// A choice drawn in place of a list: the row is one button with the current
// value under the name, ending in a chevron; it opens the list in place.
export function renderDrillRow(item, context) {
  const {component} = context;
  return html`<button type="button" class="sf-settings-menu-row sf-settings-menu-row--drill ${STOP}" data-sf-row=${item.row} data-sf-key=${item.key}
    tabindex="-1" ?disabled=${item.disabled} @click=${() => component.drillIn(item.key)}>
    ${lead(item, context)}
    ${renderText(item, context, {value: true})}
    ${icon('chevron_right', 'sf-settings-menu-row-chevron')}
  </button>`;
}

// A choice of up to three icons or two short words: quiet pills without a
// frame, the chosen one on a soft fill. Toggle buttons in a group named by
// the row.
export function renderPillsRow(item, context) {
  const {component} = context;
  const {name, caption} = ids(item, context);
  const iconsOnly = item.options.every((option) => option.icon);
  return html`<div class="sf-settings-menu-row sf-settings-menu-row--pills ${item.disabled ? 'sf-settings-menu-row--disabled' : ''}" data-sf-key=${item.key}>
    ${lead(item, context)}
    <span class="sf-settings-menu-row-main">
    ${renderText(item, context)}
    <span class="sf-settings-menu-pills ${iconsOnly ? 'sf-settings-menu-pills--icons' : ''}" role="group" aria-labelledby=${name} aria-describedby=${caption ?? nothing}>
      ${item.options.map((option) => html`<button type="button" class="sf-settings-menu-pill ${STOP}" data-sf-row=${item.row} tabindex="-1"
        aria-pressed=${String(option.value === item.value)} ?disabled=${item.disabled}
        aria-label=${iconsOnly ? option.label : nothing} title=${iconsOnly ? option.label : nothing}
        @click=${() => component.requestChange(item.key, option.value)}>${iconsOnly ? icon(option.icon) : option.label}</button>`)}
    </span>
    </span>
  </div>`;
}

// A choice of more or longer options in rows: a compact select «value ⇕»
// that opens a small sf-context-menu of the options against itself.
export function renderSelectRow(item, context) {
  const {component} = context;
  const {name, caption} = ids(item, context);
  const valueId = `${context.id}-value-${item.key}`;
  return html`<div class="sf-settings-menu-row sf-settings-menu-row--select ${item.disabled ? 'sf-settings-menu-row--disabled' : ''}" data-sf-key=${item.key}>
    ${lead(item, context)}
    <span class="sf-settings-menu-row-main">
    ${renderText(item, context)}
    <button type="button" class="sf-settings-menu-select ${STOP}" data-sf-row=${item.row} tabindex="-1"
      aria-haspopup="menu" aria-expanded="false" ?disabled=${item.disabled}
      aria-labelledby="${name} ${valueId}" aria-describedby=${caption ?? nothing} title=${item.valueLabel}
      @click=${(event) => component.openSelect(event.currentTarget, item.key, event)}>
      <span class="sf-settings-menu-select-text" id=${valueId}>${item.valueLabel}</span>
      ${icon('unfold_more', 'sf-settings-menu-select-icon')}
    </button>
    </span>
  </div>`;
}

export function renderSection(item) {
  return html`<div class="sf-settings-menu-section" role="presentation">${item.label}</div>`;
}

export function renderDivider() {
  return html`<div class="sf-settings-menu-divider" role="separator"></div>`;
}

export function renderHeading(context) {
  if (!context.heading) return nothing;
  return html`<div class="sf-settings-menu-head">
    <span class="sf-settings-menu-heading" id=${`${context.id}-heading`}>${context.label}</span>
  </div>`;
}

// The tiles on top: one press toggles a boolean, cycles a short choice or
// opens a long one in place.
export function renderTiles(context) {
  const {tiles, component} = context;
  if (!tiles.length) return nothing;
  return html`<div class="sf-settings-menu-tiles sf-settings-menu-tiles--${tiles.length === 4 ? 2 : Math.min(tiles.length, 3)}" role="group" aria-label=${context.label}>
    ${tiles.map((item) => html`<button type="button" class="sf-settings-menu-tile ${item.on ? 'sf-settings-menu-tile--on' : ''} ${STOP}"
      data-sf-row=${item.row} data-sf-key=${item.key} tabindex="-1" ?disabled=${item.disabled}
      aria-pressed=${item.type === 'boolean' ? String(Boolean(item.value)) : nothing}
      aria-label=${`${item.label}: ${item.valueLabel}`}
      @click=${() => component.pressTile(item.key)}>
      ${icon(item.valueIcon || item.icon || 'tune', 'sf-settings-menu-tile-icon')}
      <span class="sf-settings-menu-tile-name">${item.label}</span>
      <span class="sf-settings-menu-tile-value" title=${item.valueLabel}>${item.valueLabel}</span>
    </button>`)}
  </div>`;
}

export function renderReset(context) {
  if (!context.resettable) return nothing;
  const {component} = context;
  return html`${renderDivider()}<button type="button" class="sf-settings-menu-row sf-settings-menu-row--action sf-settings-menu-row--reset ${STOP}"
    data-sf-row=${context.resetRow} data-sf-key="" tabindex="-1" @click=${() => component.reset()}>
    ${icon('restart_alt', 'sf-settings-menu-row-icon')}
    <span class="sf-settings-menu-row-text"><span class="sf-settings-menu-row-name">${context.resetLabel}</span></span>
  </button>`;
}

// The list a choice opens in place: the same panel, a head with the way back
// and the setting's name, then the options with a check mark on the chosen.
export function renderLevel(context) {
  const {level: item, component} = context;
  const titleId = `${context.id}-level-title`;
  const lead = item.options.some((option) => option.icon);
  return html`<div class="sf-settings-menu-level-head">
      <sf-icon-button class="sf-settings-menu-back" icon="arrow_back" size=${context.size} appearance="link" scheme="on-surface"
        aria-label=${context.backLabel} title=${context.backLabel} @click=${() => component.back()}></sf-icon-button>
      <span class="sf-settings-menu-level-title" id=${titleId}>${item.label}</span>
    </div>
    <div class="sf-settings-menu-options" role="listbox" aria-labelledby=${titleId}>
      ${item.options.map((option, at) => html`<button type="button" role="option" class="sf-settings-menu-option ${STOP}"
        data-sf-row=${at} data-sf-value=${option.value} tabindex="-1" aria-selected=${String(option.value === item.value)}
        @click=${() => component.pick(item.key, option.value)}>
        ${option.icon ? icon(option.icon, 'sf-settings-menu-row-icon') : (lead ? html`<span class="sf-settings-menu-row-icon" aria-hidden="true"></span>` : nothing)}
        <span class="sf-settings-menu-row-text"><span class="sf-settings-menu-row-name">${option.label}</span></span>
        <span class="sf-settings-menu-option-check">${option.value === item.value ? icon('check') : nothing}</span>
      </button>`)}
    </div>`;
}

// One row by its type; a choice by the control the template chose for it.
export function renderRow(item, context) {
  switch (item.type) {
    case 'section': return renderSection(item);
    case 'divider': return renderDivider();
    case 'boolean': return renderSwitchRow(item, context);
    case 'range': return renderRangeRow(item, context);
    case 'action': return renderActionRow(item, context);
    case 'choice':
      if (item.control === 'pills') return renderPillsRow(item, context);
      if (item.control === 'select') return renderSelectRow(item, context);
      return renderDrillRow(item, context);
    default: return nothing;
  }
}

// The panel: a dialog named by its heading when it pops up from a trigger, a
// group when it stands inline. The trigger stays where the page wrote it.
export function renderPanel(context, arrangement) {
  const classes = [
    'sf-settings-menu',
    `sf-settings-menu--${arrangement}`,
    `sf-settings-menu--size-${context.size === '1' ? '1' : 'half'}`,
    context.inline ? 'sf-settings-menu--inline' : 'sf-settings-menu--popup',
    context.open ? 'sf-settings-menu--open' : '',
    context.level ? 'sf-settings-menu--level' : '',
    context.rootClass,
  ].filter(Boolean).join(' ');
  const named = context.heading && !context.level;
  const body = context.level
    ? renderLevel(context)
    : html`${renderHeading(context)}${renderTiles(context)}${context.items.map((item) => renderRow(item, context))}${renderReset(context)}`;
  return html`${context.trigger}<div class=${classes} id=${`${context.id}-panel`}
    role=${context.inline ? 'group' : 'dialog'}
    aria-labelledby=${named ? `${context.id}-heading` : nothing}
    aria-label=${named ? nothing : context.label}
    style=${context.rootStyle || nothing}>${body}</div>`;
}

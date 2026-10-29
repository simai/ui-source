import {html, nothing} from 'lit';
import {createFieldContract} from '../../../../component/field-contract';

// The field: a label row, one frame holding the toolbar over the editing
// surface, and the hint or error line -- sf-textarea's parts, in its places.
//
// The toolbar is the class markup of icon buttons (.sf-icon-button, the
// sheet sf-dropdown and the inherited-value reset draw with), so the
// component owns their tabindex, aria-pressed and disabled outright: a roving
// toolbar has to, and an sf-icon-button host copies its attributes onto its
// own button on its own schedule. A tool with no glyph in the icon font --
// the four block levels -- holds its short text instead, in the same square.
// The link editor is an sf-popover whose
// trigger is the link button and whose content holds an sf-input and two
// sf-button.
//
// The editing surface carries no binding inside: lit draws the element and
// never its children, which are the person's text and are written only by
// the component, always through the subset's cleaner.

// Icon button size one step below the field's, so the toolbar sits inside the
// frame on the same ladder.
const BUTTON_SIZE = {'1/2': '1/3', '1': '1/2', '2': '1'};

function toolButton(context, tool) {
  const {component, buttonSize, disabled, readonly, state, roving} = context;
  const pressed = tool.pressed === undefined ? nothing : String(Boolean(state[tool.pressed]));
  // Unavailable (undo with nothing to undo, a heading in a list): said and
  // greyed, still reached by the arrows; the whole toolbar is disabled with
  // the field.
  const unavailable = Boolean(tool.unavailable?.(state));
  return html`<button
      type="button"
      class="sf-rich-text-tool sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-${buttonSize} flex items-cross-center"
      data-sf-tool=${tool.id}
      tabindex=${roving === tool.id ? '0' : '-1'}
      aria-label=${component.sfWord(tool.word)}
      title=${tool.keys ? `${component.sfWord(tool.word)} (${tool.keys})` : component.sfWord(tool.word)}
      aria-pressed=${pressed}
      aria-keyshortcuts=${tool.shortcut || nothing}
      aria-haspopup=${tool.popup || nothing}
      aria-disabled=${unavailable ? 'true' : nothing}
      ?disabled=${disabled || readonly}
    >${tool.icon
      ? html`<i class="sf-icon" aria-hidden="true">${tool.icon}</i>`
      : html`<span class="sf-rich-text-tool-text" aria-hidden="true">${tool.text}</span>`}</button>`;
}

export function renderRichTextTemplate(context) {
  const {
    component,
    size,
    appearance,
    label,
    required,
    hint,
    errorMessage,
    invalid,
    disabled,
    readonly,
    placeholder,
    tools,
    linkValue,
    linkError,
    linkExisting,
    rows,
    maxRows,
    ariaLabel,
  } = context;
  const field = createFieldContract(component, {
    prefix: 'sf-rich-text',
    required,
    invalid,
    hint,
    errorMessage,
  });
  const labelId = `${field.base}--label`;
  const toolbarId = `${field.base}--toolbar`;
  const linkId = `${field.base}--link`;
  const message = field.invalid && errorMessage ? errorMessage : hint;
  const buttonSize = BUTTON_SIZE[size] || '1/2';
  const rootClasses = [
    'sf-rich-text',
    `sf-rich-text--size-${size}`,
    `sf-rich-text--${appearance}`,
    field.invalid ? 'error' : '',
    disabled ? 'sf-rich-text--disabled' : '',
    readonly ? 'sf-rich-text--readonly' : '',
    'flex',
    'flex-col',
    context.rootClass,
  ].filter(Boolean);
  const toolContext = {...context, buttonSize};
  const group = (ids) => tools.filter((tool) => ids.includes(tool.id)).map((tool) => {
    if (tool.id !== 'link') return toolButton(toolContext, tool);
    // The link button opens the link editor: the popover's trigger.
    return html`<sf-popover class="sf-rich-text-link" placement=${context.linkPlacement || 'bottom-start'} width="20rem" label=${component.sfWord('link-dialog')}>
        <span slot="trigger" class="sf-rich-text-link-trigger">${toolButton(toolContext, tool)}</span>
        <div slot="content" class="sf-rich-text-link-panel flex flex-col" id=${linkId}
          @input=${(event) => component.onLinkPanelEvent(event)}
          @change=${(event) => component.onLinkPanelEvent(event)}
          @keydown=${(event) => component.onLinkPanelKeydown(event)}>
          <sf-input class="sf-rich-text-link-input" size=${size === '2' ? '1' : size} label=${component.sfWord('link-address')}
            hint=${component.sfWord('link-hint')} .value=${linkValue} ?invalid=${Boolean(linkError)}
            error-message=${linkError || nothing} autocomplete="url" inputmode="url"></sf-input>
          <div class="sf-rich-text-link-actions flex flex-wrap items-cross-center">
            <sf-button class="sf-rich-text-link-apply" size=${buttonSize} @click=${() => component.applyLinkFromPanel()}>${component.sfWord('link-apply')}</sf-button>
            ${linkExisting
              ? html`<sf-button class="sf-rich-text-link-remove" size=${buttonSize} appearance="outline" @click=${() => component.removeLinkFromPanel()}>${component.sfWord('link-remove')}</sf-button>`
              : nothing}
          </div>
        </div>
      </sf-popover>`;
  });
  const separator = html`<span class="sf-rich-text-separator" aria-hidden="true"></span>`;

  return html`
    <div class=${rootClasses.join(' ')} style=${context.rootStyle || nothing}
      @pointerdown=${(event) => component.onRootPointerDown(event)}
      @focusout=${(event) => component.onRootFocusOut(event)}>
      ${label
        ? html`<span class="sf-rich-text-label flex" id=${labelId} @click=${() => component.focus()}>
            <span class="sf-rich-text-text">${label}</span>
            ${required ? html`<span class="sf-rich-text-required" aria-hidden="true">*</span>` : ''}
          </span>`
        : ''}
      <div class="sf-rich-text-frame flex flex-col"
        style=${`--sf-rich-text--rows: ${rows};${maxRows ? ` --sf-rich-text--max-rows: ${maxRows};` : ''}`}>
        <div class="sf-rich-text-toolbar flex flex-wrap items-cross-center" role="toolbar" id=${toolbarId}
          aria-label=${component.sfWord('toolbar')} aria-controls=${field.controlId}
          aria-disabled=${disabled || readonly ? 'true' : nothing}
          @keydown=${(event) => component.onToolbarKeydown(event)}
          @mousedown=${(event) => component.onToolbarMouseDown(event)}
          @click=${(event) => component.onToolbarClick(event)}
          @focusin=${(event) => component.onToolbarFocusIn(event)}>
          <div class="sf-rich-text-group flex items-cross-center" role="group">${group(['paragraph', 'heading-2', 'heading-3', 'heading-4'])}</div>
          ${separator}
          <div class="sf-rich-text-group flex items-cross-center" role="group">${group(['bold', 'italic', 'link'])}</div>
          ${separator}
          <div class="sf-rich-text-group flex items-cross-center" role="group">${group(['bulleted-list', 'numbered-list', 'quote'])}</div>
          ${separator}
          <div class="sf-rich-text-group flex items-cross-center" role="group">${group(['undo', 'redo'])}</div>
        </div>
        <div
          class="sf-rich-text-editor"
          id=${field.controlId}
          role="textbox"
          aria-multiline="true"
          contenteditable=${disabled || readonly ? 'false' : 'true'}
          tabindex=${disabled ? '-1' : '0'}
          spellcheck="true"
          translate="no"
          aria-labelledby=${label ? labelId : nothing}
          aria-label=${!label && ariaLabel ? ariaLabel : nothing}
          aria-placeholder=${placeholder || nothing}
          data-placeholder=${placeholder || nothing}
          aria-required=${field.required ? 'true' : nothing}
          aria-readonly=${readonly ? 'true' : nothing}
          aria-disabled=${disabled ? 'true' : nothing}
          aria-invalid=${field.invalid ? 'true' : nothing}
          aria-describedby=${message ? field.messageId : nothing}
          aria-errormessage=${field.invalid && errorMessage ? field.messageId : nothing}
        ></div>
      </div>
      ${message
        ? html`<span id=${field.messageId} class="sf-rich-text-hint-text-wrap"
            data-field-message=${field.invalid && errorMessage ? 'error' : 'hint'}>${message}</span>`
        : ''}
    </div>
  `;
}

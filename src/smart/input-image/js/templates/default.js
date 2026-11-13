import {html, nothing} from 'lit';

// The buttons are one rung below the field, as a field's own trailing controls
// are: a size 1 field (a 40px control row) carries size 1/2 buttons.
const BUTTON_SIZE = {'1/2': '1/3', '1': '1/2', '2': '1'};
// The ring over a thumbnail is the smallest; over a preview one rung up.
const RING_SIZE = {row: '1/2', preview: '1'};
// The inner fields (description, address) are the field's own size, at most 1.
const INNER_SIZE = {'1/2': '1/2', '1': '1', '2': '1'};

// What stands in the thumbnail when there is no picture to show: an invitation
// while the field is empty, a broken image when the address did not load, and
// a plain image glyph for a value the host gave without an address.
function thumbIcon(context) {
  if (!context.value) return context.shape === 'circle' ? 'add_a_photo' : 'add_photo_alternate';
  if (context.broken) return 'broken_image';
  return 'image';
}

// Where the picture stands in its box: the frame's centre and zoom when the
// person cut one (preview), else the focal point, else the middle. The
// original is never cut: the frame is drawn by position and scale.
function imageStyle(context) {
  const {value, layout} = context;
  const crop = value?.crop;
  const focus = value?.focus;
  const pct = (number) => `${Math.round(number * 1000) / 10}%`;
  if (crop && layout === 'preview' && context.fit === 'cover') {
    return `object-position: ${pct(crop.x)} ${pct(crop.y)}; transform: scale(${crop.zoom}); transform-origin: ${pct(crop.x)} ${pct(crop.y)}`;
  }
  if (focus && context.fit === 'cover') return `object-position: ${pct(focus.x)} ${pct(focus.y)}`;
  return nothing;
}

function renderPicture(context) {
  const {value, component} = context;
  const href = value?.href || '';
  if (href && !context.broken) {
    // The description is the person's (alt), empty for a decorative picture
    // and while none is written: the name beside it is read anyway, and the
    // file name is not a description (IF-11).
    return html`<img class="sf-image-field-image" src=${href} alt=${value.decorative ? '' : value.alt || ''}
                     style=${imageStyle(context)} draggable="false"
                     @load=${(event) => component.onImageLoad(event, href)}
                     @error=${() => component.onImageError(href)}>`;
  }
  return html`<i class="sf-icon" aria-hidden="true">${thumbIcon(context)}</i>`;
}

function renderRing(context) {
  const {upload, names} = context;
  if (upload?.state !== 'process') return nothing;
  const known = upload.progress !== null && upload.progress !== undefined;
  return html`<span class="sf-image-field-ring">
    <sf-progress-ring size=${RING_SIZE[context.layout]} label=${names.upload}
                      value=${known ? upload.progress : nothing} ?indeterminate=${!known}></sf-progress-ring>
  </span>`;
}

function renderChoose(context, {replace}) {
  const {component, words, names, field} = context;
  const size = BUTTON_SIZE[context.size] ?? '1/2';
  const many = context.sources.length > 1;
  const describedBy = context.message ? field.messageId : nothing;
  // «Заменить ▾» opens the menu of sources the page enabled; with one source
  // it is a plain button that goes there («Заменить…», C94 point 5).
  const text = replace ? (many ? words.replaceMenu : words.replace) : (many ? words.chooseMenu : words.choose);
  return html`<sf-button class=${replace ? 'sf-image-field-replace' : 'sf-image-field-choose'} size=${size}
                         appearance="outline" scheme="on-surface"
                         text=${text} icon-end=${many ? 'expand_more' : nothing}
                         aria-haspopup=${many ? 'menu' : nothing}
                         aria-label=${replace ? names.replace : names.choose} aria-describedby=${describedBy}
                         ?disabled=${context.disabled}
                         @click=${(event) => component.onChoosePress(event)}></sf-button>`;
}

function renderActions(context) {
  const {component, value, words, names, upload} = context;
  if (context.readonly) return nothing;
  const size = BUTTON_SIZE[context.size] ?? '1/2';
  let buttons;
  if (upload?.state === 'process') {
    buttons = html`<sf-button class="sf-image-field-cancel" size=${size} appearance="outline" scheme="on-surface"
                              text=${words.cancelUpload} aria-label=${names.cancel}
                              @click=${() => component._cancelUpload()}></sf-button>`;
  } else if (upload?.state === 'error') {
    buttons = html`
      <sf-button class="sf-image-field-retry" size=${size} appearance="outline" scheme="on-surface"
                 text=${words.retry} aria-label=${names.retry}
                 @click=${() => component._retryUpload()}></sf-button>
      <sf-button-icon class="sf-image-field-cancel" size=${size} appearance="ghost" scheme="on-surface-variant"
                      icon="close" aria-label=${names.cancel} title=${words.cancelUpload}
                      @click=${() => component._cancelUpload()}></sf-button-icon>`;
  } else if (value) {
    // Real buttons with names that say what they act on: «Заменить изображение
    // «logo.png»», each beginning with its visible words so a voice command
    // naming what is seen still reaches it. Remove is the icon (IF-9), so the
    // size line keeps its room, and a required field has none (IF-6).
    buttons = html`
      ${renderChoose(context, {replace: true})}
      ${context.edits.length && value.href && !context.broken
        ? html`<sf-button class="sf-image-field-edit" size=${size} appearance="ghost" scheme="on-surface"
                          text=${words.edit} aria-label=${names.edit} aria-expanded=${context.editor ? 'true' : 'false'}
                          ?disabled=${context.disabled}
                          @click=${() => (context.editor ? component._closeEditor(false) : component._openEditor())}></sf-button>`
        : nothing}
      ${context.removable
        ? html`<sf-button-icon class="sf-image-field-remove" size=${size} appearance="ghost" scheme="on-surface-variant"
                               icon="delete" aria-label=${names.remove} title=${words.remove}
                               ?disabled=${context.disabled}
                               @click=${() => component.removeImage()}></sf-button-icon>`
        : nothing}`;
  } else {
    buttons = renderChoose(context, {replace: false});
  }
  return html`<span class="sf-image-field-actions">${buttons}</span>`;
}

// The words of the line under the name: the file's while it holds one; when
// empty, how to put one -- with a mouse drag or paste, on a phone take a
// photo or choose (IF-1: no drag words where there is nothing to drag with).
function emptyWords(context) {
  if (!context.interactive) return '';
  return context.coarse ? context.words.emptyHintCoarse : context.words.emptyHint;
}

function renderBody(context) {
  const {value, words} = context;
  const title = context.dragging
    ? words.drop
    : value ? context.fileName : context.emptyText || words.empty;
  const meta = context.dragging ? '' : value ? context.metaText : emptyWords(context);
  return html`<span class="sf-image-field-body">
    <span class="sf-image-field-name">${title}</span>
    ${meta ? html`<span class="sf-image-field-meta">${meta}</span>` : nothing}
  </span>`;
}

// The group the drop and the paste land on: the row, or the frame of the
// preview.
function groupAttributes(context) {
  const {field, component} = context;
  return {
    labelledby: context.label ? `${context.id}-label` : nothing,
    label: context.label ? nothing : context.names.group,
    describedby: context.message ? field.messageId : nothing,
    invalid: field.invalid ? 'true' : nothing,
    handlers: {
      dragenter: (event) => component.onDragOver(event),
      dragover: (event) => component.onDragOver(event),
      dragleave: (event) => component.onDragLeave(event),
      drop: (event) => component.onDrop(event),
      paste: (event) => component.onPaste(event),
    },
  };
}

function renderRow(context) {
  const group = groupAttributes(context);
  const thumbClasses = ['sf-image-field-thumb', context.value && context.transparent ? 'sf-image-field-thumb--transparent' : ''];
  return html`
    <div class="sf-image-field-well"
         role="group"
         aria-labelledby=${group.labelledby}
         aria-label=${group.label}
         aria-describedby=${group.describedby}
         aria-invalid=${group.invalid}
         @dragenter=${group.handlers.dragenter}
         @dragover=${group.handlers.dragover}
         @dragleave=${group.handlers.dragleave}
         @drop=${group.handlers.drop}
         @paste=${group.handlers.paste}>
      <span class=${thumbClasses.filter(Boolean).join(' ')}>${renderPicture(context)}${renderRing(context)}</span>
      ${renderBody(context)}
      ${renderActions(context)}
    </div>`;
}

// The preview (C94 point 1): the picture is the field, in its frame; the row
// under it -- name, size, the buttons -- keeps to the picture's width, with a
// floor that leaves room for a name and the buttons, and its buttons wrap
// under the name from the picture's start edge, never pushed to the field's
// far edge (owner's layout rule, as C88). The buttons are never laid over the
// picture (C94 point 2).
function renderPreview(context) {
  const group = groupAttributes(context);
  const {value, words} = context;
  const frameClasses = ['sf-image-field-frame', value && context.transparent ? 'sf-image-field-frame--transparent' : ''];
  const circleEmpty = !value && context.shape === 'circle';
  return html`
    <div class=${frameClasses.filter(Boolean).join(' ')}
         role="group"
         style=${`--sf-image-field--aspect: ${context.frameAspect}`}
         aria-labelledby=${group.labelledby}
         aria-label=${group.label}
         aria-describedby=${group.describedby}
         aria-invalid=${group.invalid}
         @dragenter=${group.handlers.dragenter}
         @dragover=${group.handlers.dragover}
         @dragleave=${group.handlers.dragleave}
         @drop=${group.handlers.drop}
         @paste=${group.handlers.paste}>
      ${value
        ? renderPicture(context)
        : html`<i class="sf-icon" aria-hidden="true">${thumbIcon(context)}</i>
          ${circleEmpty ? nothing : html`<span class="sf-image-field-frame-text">${context.dragging ? words.drop : emptyWords(context)}</span>`}
          ${circleEmpty ? nothing : renderActions(context)}`}
      ${renderRing(context)}
    </div>
    ${value || circleEmpty
      ? html`<div class="sf-image-field-under">${renderBody(context)}${renderActions(context)}</div>`
      : nothing}`;
}

// The address (source url): a text field, «Взять» and a close button, under
// the picture; Enter takes, Escape closes.
function renderUrl(context) {
  if (!context.urlOpen || !context.interactive) return nothing;
  const {component, words} = context;
  const size = INNER_SIZE[context.size] ?? '1';
  return html`<div class="sf-image-field-url">
    <sf-input class="sf-image-field-url-input" size=${size} input-type="url" label=${words.urlLabel}
              placeholder="https://…" ?invalid=${Boolean(context.urlError)} error-message=${context.urlError || nothing}
              @input=${(event) => component.stopInner(event)} @change=${(event) => component.stopInner(event)}
              @keydown=${(event) => component.onUrlKey(event)}></sf-input>
    <sf-button class="sf-image-field-url-take" size=${size} text=${words.urlTake}
               @click=${() => component._takeUrl()}></sf-button>
    <sf-button-icon class="sf-image-field-url-close" size=${size} appearance="ghost" scheme="on-surface-variant"
                    icon="close" aria-label=${words.urlClose} title=${words.urlClose}
                    @click=${() => component._closeUrl()}></sf-button-icon>
  </div>`;
}

// The editor (C94 point 3): the frame or the focal point, on the picture,
// with the mouse, a finger or the arrows. Nothing is cut: «Готово» writes
// crop {aspect, zoom, x, y} and focus {x, y} into the value.
function renderEditor(context) {
  const {editor, value, component, words} = context;
  if (!editor || !value?.href) return nothing;
  const size = BUTTON_SIZE[context.size] ?? '1/2';
  const crop = editor.mode === 'crop';
  const pct = (number) => `${Math.round(number * 1000) / 10}%`;
  const imageStyleText = crop
    ? `object-fit: cover; object-position: ${pct(editor.crop.x)} ${pct(editor.crop.y)}; transform: scale(${editor.crop.zoom}); transform-origin: ${pct(editor.crop.x)} ${pct(editor.crop.y)}`
    : 'object-fit: contain';
  const stageAspect = crop ? String(editor.crop.aspect || '1/1').replace('/', ' / ') : context.frameAspect;
  const pointer = (event) => component.onStagePointer(event);
  return html`<div class="sf-image-field-editor">
    ${context.edits.length > 1
      ? html`<span class="sf-image-field-editor-modes" role="group" aria-label=${words.editName}>
          ${context.edits.map((mode) => html`<sf-button size=${size} appearance=${editor.mode === mode ? 'tonal' : 'ghost'}
              scheme="on-surface" text=${mode === 'crop' ? words.crop : words.focus}
              icon-start=${mode === 'crop' ? 'crop' : 'center_focus_strong'}
              aria-pressed=${editor.mode === mode ? 'true' : 'false'}
              @click=${() => component._setEditorMode(mode)}></sf-button>`)}
        </span>`
      : nothing}
    <div class=${['sf-image-field-stage', context.shape === 'circle' && crop ? 'sf-image-field-stage--circle' : ''].filter(Boolean).join(' ')}
         tabindex="0" role="application" aria-roledescription=${words.stageName}
         aria-label=${context.editorState} aria-describedby=${`${context.id}-editor-hint`}
         style=${`--sf-image-field--aspect: ${stageAspect}`}
         @keydown=${(event) => component.onStageKey(event)}
         @pointerdown=${pointer} @pointermove=${pointer} @pointerup=${pointer} @pointercancel=${pointer}>
      <img src=${value.href} alt="" draggable="false" style=${imageStyleText}>
      ${crop ? html`<span class="sf-image-field-stage-grid" aria-hidden="true"></span>` : nothing}
      ${crop && context.shape === 'circle' ? html`<span class="sf-image-field-stage-mask" aria-hidden="true"></span>` : nothing}
      ${crop ? nothing : html`<span class="sf-image-field-focus-dot" aria-hidden="true"
                                    style=${`inset-inline-start: ${pct(editor.focus.x)}; inset-block-start: ${pct(editor.focus.y)}`}></span>`}
    </div>
    <span class="sf-image-field-editor-hint" id=${`${context.id}-editor-hint`}>${crop ? words.cropHint : words.focusHint}</span>
    <span class="sf-image-field-editor-foot">
      ${crop
        ? html`<sf-button-icon size=${size} appearance="ghost" scheme="on-surface-variant" icon="zoom_out"
                               aria-label=${words.zoomOut} title=${words.zoomOut}
                               @click=${() => component._zoomBy(-0.1)}></sf-button-icon>
          <sf-button-icon size=${size} appearance="ghost" scheme="on-surface-variant" icon="zoom_in"
                          aria-label=${words.zoomIn} title=${words.zoomIn}
                          @click=${() => component._zoomBy(0.1)}></sf-button-icon>`
        : nothing}
      <sf-button class="sf-image-field-editor-cancel" size=${size} appearance="outline" scheme="on-surface"
                 text=${words.editCancel} @click=${() => component._closeEditor(false)}></sf-button>
      <sf-button class="sf-image-field-editor-done" size=${size} text=${words.editDone}
                 @click=${() => component._closeEditor(true)}></sf-button>
    </span>
  </div>`;
}

// The description and «Декоративная» (C94 point 4), when the page asks for
// them (alt field | required): inside the field, under the picture.
function renderAlt(context) {
  const {value, component, words} = context;
  if (context.altMode === 'none' || !value || !context.interactive || context.upload?.state === 'process') return nothing;
  const size = INNER_SIZE[context.size] ?? '1';
  const required = context.altMode === 'required';
  return html`<div class="sf-image-field-alt">
    <sf-input class="sf-image-field-alt-input" size=${size} label=${words.altLabel}
              placeholder=${words.altPlaceholder} .value=${value.alt || ''}
              hint=${required ? words.altHintRequired : words.altHint}
              ?disabled=${Boolean(value.decorative) || context.disabled}
              ?invalid=${context.altMissing} error-message=${context.altMissing ? words.altMissing : nothing}
              @input=${(event) => component.onAltInput(event, 'input')}
              @change=${(event) => component.onAltInput(event, 'change')}></sf-input>
    <sf-switch class="sf-image-field-decorative" size=${size} label=${words.decorative}
               ?checked=${Boolean(value.decorative)} ?disabled=${context.disabled}
               @input=${(event) => component.stopInner(event)}
               @change=${(event) => component.onDecorative(event)}></sf-switch>
  </div>`;
}

export function renderImageFieldTemplate(context) {
  const {component, field, value} = context;
  const labelId = `${context.id}-label`;
  const rootClasses = [
    'sf-image-field',
    `sf-image-field--size-${context.size}`,
    `sf-image-field--${context.layout}`,
    value ? 'sf-image-field--filled' : 'sf-image-field--empty',
    field.invalid ? 'error' : '',
    context.dragging ? 'dragover' : '',
    context.disabled ? 'disabled' : '',
    context.readonly ? 'readonly' : '',
    context.upload ? `sf-image-field--upload-${context.upload.state}` : '',
    context.rootClass,
  ].filter(Boolean);

  return html`
    <div class=${rootClasses.join(' ')} style=${context.rootStyle || nothing}
         data-shape=${context.shape} data-fit=${context.fit}>
      ${context.label
        ? html`
          <span class="sf-image-field-label" id=${labelId}>
            <span class="sf-image-field-label-text">${context.label}</span>
            ${field.required ? html`<span class="sf-image-field-required">*</span>` : nothing}
          </span>`
        : nothing}

      ${context.layout === 'preview' ? renderPreview(context) : renderRow(context)}
      ${renderUrl(context)}
      ${renderEditor(context)}

      <input type="file"
             class="sf-image-field-input"
             id=${field.controlId}
             name=${context.controlName || nothing}
             accept=${context.accept || nothing}
             tabindex="-1"
             aria-hidden="true"
             ?required=${field.required && !value}
             ?disabled=${context.disabled || context.readonly}
             @change=${(event) => component.onInputChange(event)}
             @input=${(event) => component.onInputEvent(event)}>

      ${context.message
        ? html`<span id=${field.messageId} class="sf-image-field-message"
                     data-field-message=${context.messageKind}>${context.message}</span>`
        : nothing}

      ${renderAlt(context)}

      ${context.menuEntries.length
        ? html`<span class="sf-image-field-parts" style="display: contents">
            <sf-menu-context popup size=${context.menuSize} aria-label=${context.words.sourcesName}
                             .entries=${context.menuEntries}
                             @sf-menu-context-select=${(event) => component.onMenuSelect(event)}
                             @sf-context-menu-select=${(event) => event.stopPropagation()}></sf-menu-context>
          </span>`
        : nothing}

      <span class="sf-image-field-live" role="status" aria-live="polite" aria-atomic="true">${context.announcement}</span>
    </div>
  `;
}

import {html, nothing} from 'lit';

// The buttons are one rung below the field, as a field's own trailing controls
// are: a size 1 field (a 40px control row) carries size 1/2 buttons.
const BUTTON_SIZE = {'1/2': '1/3', '1': '1/2', '2': '1'};

// What stands in the thumbnail when there is no picture to show: an invitation
// while the field is empty, a broken image when the address did not load, and
// a plain image glyph for a value the host gave without an address.
function thumbIcon(context) {
  if (!context.value) return 'add_photo_alternate';
  if (context.broken) return 'broken_image';
  return 'image';
}

function renderThumb(context) {
  const {value, component} = context;
  const href = value?.href || '';
  if (href && !context.broken) {
    // The image is fitted, never stretched or cropped: a logo 900×300 stays a
    // logo. alt is the file's name, the one thing the field knows about it.
    return html`<img class="sf-image-field-image" src=${href} alt=${context.fileName}
                     @load=${(event) => component.onImageLoad(event, href)}
                     @error=${() => component.onImageError(href)}>`;
  }
  return html`<i class="sf-icon" aria-hidden="true">${thumbIcon(context)}</i>`;
}

function renderActions(context) {
  const {component, value, words, names, field} = context;
  if (context.readonly) return nothing;
  const size = BUTTON_SIZE[context.size] ?? '1/2';
  const describedBy = context.message ? field.messageId : nothing;
  // Real buttons with names that say what they act on: «Заменить изображение
  // «logo.png»», each beginning with its visible words so a voice command
  // naming what is seen still reaches it.
  return html`
    <span class="sf-image-field-actions">
      ${value
        ? html`
          <sf-button class="sf-image-field-replace" size=${size} appearance="outline" scheme="on-surface"
                     text=${words.replace} aria-label=${names.replace} aria-describedby=${describedBy}
                     ?disabled=${context.disabled}
                     @click=${() => component.choose()}></sf-button>
          <sf-button class="sf-image-field-remove" size=${size} appearance="link" scheme="on-surface"
                     text=${words.remove} aria-label=${names.remove}
                     ?disabled=${context.disabled}
                     @click=${() => component.removeImage()}></sf-button>`
        : html`
          <sf-button class="sf-image-field-choose" size=${size} appearance="outline" scheme="on-surface"
                     text=${words.choose} aria-label=${names.choose} aria-describedby=${describedBy}
                     ?disabled=${context.disabled}
                     @click=${() => component.choose()}></sf-button>`}
    </span>
  `;
}

export function renderImageFieldTemplate(context) {
  const {component, field, value, words} = context;
  const labelId = `${context.id}-label`;
  const rootClasses = [
    'sf-image-field',
    `sf-image-field--size-${context.size}`,
    value ? 'sf-image-field--filled' : 'sf-image-field--empty',
    field.invalid ? 'error' : '',
    context.dragging ? 'dragover' : '',
    context.disabled ? 'disabled' : '',
    context.readonly ? 'readonly' : '',
    context.rootClass,
  ].filter(Boolean);

  const title = context.dragging
    ? words.drop
    : value ? context.fileName || words.group : context.emptyText || words.empty;
  const meta = context.dragging ? '' : value ? context.metaText : (context.interactive ? words.emptyHint : '');

  return html`
    <div class=${rootClasses.join(' ')} style=${context.rootStyle || nothing}>
      ${context.label
        ? html`
          <span class="sf-image-field-label" id=${labelId}>
            <span class="sf-image-field-label-text">${context.label}</span>
            ${field.required ? html`<span class="sf-image-field-required">*</span>` : nothing}
          </span>`
        : nothing}

      <div class="sf-image-field-well"
           role="group"
           aria-labelledby=${context.label ? labelId : nothing}
           aria-label=${context.label ? nothing : context.names.group}
           aria-describedby=${context.message ? field.messageId : nothing}
           aria-invalid=${field.invalid ? 'true' : nothing}
           @dragenter=${(event) => component.onDragOver(event)}
           @dragover=${(event) => component.onDragOver(event)}
           @dragleave=${(event) => component.onDragLeave(event)}
           @drop=${(event) => component.onDrop(event)}>
        <span class="sf-image-field-thumb">${renderThumb(context)}</span>
        <span class="sf-image-field-body">
          <span class="sf-image-field-name">${title}</span>
          ${meta ? html`<span class="sf-image-field-meta">${meta}</span>` : nothing}
        </span>
        ${renderActions(context)}
      </div>

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

      <span class="sf-image-field-live" role="status" aria-live="polite" aria-atomic="true">${context.announcement}</span>
    </div>
  `;
}

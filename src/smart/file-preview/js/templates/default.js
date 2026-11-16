import {html, nothing} from 'lit';

// The actions stand on the step of the name beside them (C103: one line, one
// step): size 1 (40, icon 24) in a row; size 1/2 (32) in a chip and a tile,
// whose name is a step smaller (C149 (1)). Removing a file from a draft or a
// form field is «×» «Убрать <имя>»; erasing a stored file is the trash
// «Удалить <имя>», asked first (C149 (8)).
function renderAction({icon, label, disabled, action, size, onClick}) {
  return html`
    <button
      type="button"
      class="sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-${size}"
      data-action=${action}
      ?disabled=${disabled}
      aria-label=${label}
      @click=${onClick}
    >
      <i class="sf-icon" aria-hidden="true">${icon}</i>
    </button>
  `;
}

// A file name breaks between its words only (C34): spaces, and after the
// joints names use instead of spaces -- «_», «-», «–», «—», «/», «+» -- where
// a <wbr> lets the line end. Never inside a word, never before the extension's
// dot. The text itself (copy, a screen reader, the tooltip) is unchanged.
export function nameParts(name) {
  const parts = String(name ?? '').split(/(?<=[_\-–—/+])/u);
  return parts.map((part, index) => (index ? html`<wbr>${part}` : part));
}

// Only the leading visual, named by the file: the image, or the extension in a
// tile (the type's icon when the name has none). A link when the file has an
// address, so a list row opens it the way the record does. For a table cell.
function renderCompact(context) {
  const visual = context.picture
    ? html`<img class="sf-file-preview-thumbnail" src=${context.picture} alt=${context.fileName}>`
    : context.extension
      ? html`<span class="sf-file-preview-extension" aria-hidden="true">${context.extension}</span>`
      : html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>`;
  const classes = ['sf-file-preview', 'sf-file-preview--compact', context.rootClass].filter(Boolean).join(' ');
  const name = context.picture ? nothing : context.fileName;
  return context.href
    ? html`<a class=${classes} href=${context.href} target=${context.target || nothing} title=${context.fileName}
              aria-label=${name} data-render-managed="1"><span class="sf-file-preview-holder">${visual}</span></a>`
    : html`<span class=${classes} title=${context.fileName} role=${context.picture ? nothing : 'img'}
              aria-label=${name} data-render-managed="1"><span class="sf-file-preview-holder">${visual}</span></span>`;
}

// The leading visual (C149 (3), (4)): the picture the host gave (image-url,
// for any file; an image's own address), else the glyph of the file's kind in
// the grey tile. Over a picture of a file that is not an image the type
// stands in a small corner badge; a video adds the play sign and its length.
function renderHolder(context) {
  if (!context.picture) {
    return html`<span class="sf-file-preview-holder"><i class="sf-icon" aria-hidden="true">${context.icon}</i></span>`;
  }
  const badge = context.fileKind === 'video' ? context.duration : (context.fileKind === 'image' ? '' : context.extension);
  return html`<span class="sf-file-preview-holder sf-file-preview-holder--picture">
    <img class="sf-file-preview-thumbnail" src=${context.picture} alt="" decoding="async">
    ${context.fileKind === 'video'
      ? html`<span class="sf-file-preview-play" aria-hidden="true"><i class="sf-icon">play_circle</i></span>`
      : nothing}
    ${badge ? html`<span class="sf-file-preview-badge" aria-hidden="true">${badge}</span>` : nothing}
  </span>`;
}

// The name: a link to the file when it is there (C51; C149 (5): a picture, a
// PDF or a video opens the viewer, anything else downloads), a line of text
// while it uploads or after it failed. Its whole text breaks by words; when it
// does not fit its lines (two in a row, one in a chip or a tile) the element
// cuts it in the middle and keeps the tail with the extension (C149 (2)): the
// cut text is drawn in the fit span, the whole name stays in the tooltip and,
// with the type, the size and the date, for a screen reader (C88, C51).
function renderName(context) {
  const inner = html`<span class="sf-file-preview-full" aria-hidden="true">${nameParts(context.fileName)}</span><span
    class="sf-file-preview-fit" aria-hidden="true"></span><span class="sf-file-preview-said">${context.fileName}${context.said}</span>`;
  if (context.linked) {
    const viewing = context.viewable;
    return html`<a
      class="sf-file-preview-name"
      href=${context.href}
      download=${!viewing && context.download ? context.fileName : nothing}
      target=${!viewing && !context.download && context.target ? context.target : nothing}
      rel=${!viewing && !context.download && context.target === '_blank' ? 'noopener noreferrer' : nothing}
      title=${context.fileName}
      data-lines=${context.lines}
      @click=${context.onOpen}
    >${inner}</a>`;
  }
  return html`<span class="sf-file-preview-name" title=${context.fileName} data-lines=${context.lines}>${inner}</span>`;
}

// The line under the name, by the state (C81: one family with the upload
// core's rows): type, size and date (C149 (7)); while uploading the upload
// row's bar with its per cent at the end; after a failure the reason in the
// error colour.
function renderLine(context) {
  if (context.state === 'uploading') {
    return html`<sf-progress-bar
      class="sf-file-preview-progress"
      size="1/2"
      value=${context.progress === null ? nothing : String(context.progress)}
      ?indeterminate=${context.progress === null}
      text-position="inline-end"
      label=${context.words.uploading}
    ></sf-progress-bar>`;
  }
  if (context.state === 'error') {
    return html`<span class="sf-file-preview-error">${context.words.failed}</span>`;
  }
  return context.meta
    ? html`<span class="sf-file-preview-meta sf-file-preview-size" aria-hidden="true" title=${context.view === 'tile' ? context.meta : nothing}>${context.meta}</span>`
    : nothing;
}

// Erasing a stored file is asked in place (C149 (8), C25: a question where
// the removal cannot be taken back): sf-confirm under the row, the danger
// answer «Удалить», «Отмена» quiet.
function renderQuestion(context) {
  if (!context.asking) return nothing;
  return html`<sf-confirm
    class="sf-file-preview-question"
    question=${context.words.deleteQuestion}
    accept-text=${context.words.deleteText}
    status="danger"
    size="1/2"
    confirm-id=${context.fileId}
    @sf-confirm-answer=${context.onAnswer}
  ></sf-confirm>`;
}

export function renderFilePreviewTemplate(context) {
  if (context.compact) return renderCompact(context);
  const state = context.state;
  const view = context.view;
  const rootClasses = [
    'sf-file-preview',
    `sf-file-preview--${view}`,
    context.surface && view === 'row' ? 'sf-file-preview--surface' : '',
    state !== 'ready' ? `sf-file-preview--${state}` : '',
    context.disabled ? 'disabled' : '',
    context.rootClass,
  ].filter(Boolean);
  // A file not there yet (uploading) or not there at all (failed) has nothing
  // to download; it can still be taken away. A chip is an attachment: it
  // offers only «×» (C149 (1)).
  const download = context.downloadAction && state === 'ready' && view !== 'chip';
  const hasActions = context.actions && (download || context.removeAction);
  const retry = state === 'error' && !context.disabled;
  const grouped = hasActions || retry;
  const size = view === 'row' ? '1' : '1/2';

  return html`
    <div
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      data-render-managed="1"
      role=${grouped ? 'group' : nothing}
      aria-label=${grouped ? context.ariaLabel : nothing}
      aria-disabled=${context.disabled ? 'true' : nothing}
      aria-busy=${state === 'uploading' ? 'true' : nothing}
    >
      ${renderHolder(context)}
      <span class="sf-file-preview-main">
        ${renderName(context)}
        ${renderLine(context)}
      </span>
      ${grouped
        ? html`
          <span class="sf-file-preview-actions">
            ${retry
              ? html`<sf-button
                class="sf-file-preview-retry"
                size=${size}
                height="low"
                appearance="ghost"
                scheme="primary"
                icon-start="refresh"
                text=${context.words.retry}
                aria-label=${context.words.retryLabel}
                @click=${context.onRetry}
              ></sf-button>`
              : nothing}
            ${hasActions && download
              ? renderAction({
                // A file opened in a new tab shows the sign of it (C25): the
                // download glyph promised a download the browser never made.
                icon: !context.download && context.target === '_blank' ? 'open_in_new' : 'download',
                label: context.downloadLabel,
                disabled: context.disabled,
                action: 'download',
                size,
                onClick: context.onDownload,
              })
              : nothing}
            ${hasActions && context.removeAction
              ? renderAction({
                icon: context.stored ? 'delete' : 'close',
                label: context.removeLabel,
                disabled: context.disabled || context.asking,
                action: context.stored ? 'delete' : 'remove',
                size,
                onClick: context.onRemove,
              })
              : nothing}
          </span>
        `
        : nothing}
      ${renderQuestion(context)}
    </div>
  `;
}

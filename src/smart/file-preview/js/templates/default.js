import {html, nothing} from 'lit';

// The download and remove buttons stand on the step of the name beside them,
// size 1 (C103: one line, one step -- text 1, button size 1, 40 with a 24
// icon; docs precheck FP-06: they were 1/2, 32 beside the 16 px name).
function renderAction({icon, label, disabled, action, onClick}) {
  return html`
    <button
      type="button"
      class="sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1"
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
function nameParts(name) {
  const parts = String(name ?? '').split(/(?<=[_\-–—/+])/u);
  return parts.map((part, index) => (index ? html`<wbr>${part}` : part));
}

// Only the leading visual, named by the file: the image, or the extension in a
// tile (the type's icon when the name has none). A link when the file has an
// address, so a list row opens it the way the record does.
function renderCompact(context) {
  const visual = context.isImage
    ? html`<img class="sf-file-preview-thumbnail" src=${context.imageUrl || context.href} alt=${context.fileName}>`
    : context.extension
      ? html`<span class="sf-file-preview-extension" aria-hidden="true">${context.extension}</span>`
      : html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>`;
  const classes = ['sf-file-preview', 'sf-file-preview--compact', context.rootClass].filter(Boolean).join(' ');
  const name = context.isImage ? nothing : context.fileName;
  return context.href
    ? html`<a class=${classes} href=${context.href} target=${context.target || nothing} title=${context.fileName}
              aria-label=${name} data-render-managed="1"><span class="sf-file-preview-holder">${visual}</span></a>`
    : html`<span class=${classes} title=${context.fileName} role=${context.isImage ? nothing : 'img'}
              aria-label=${name} data-render-managed="1"><span class="sf-file-preview-holder">${visual}</span></span>`;
}

// The name: a link to the file when it is there (C51: the name is a link), a
// line of text while it uploads or after it failed. Two lines at most, then an
// ellipsis; the whole name in the tooltip and for a screen reader (C88). The
// type and the size follow it for a screen reader only (C51: «имя, тип,
// размер», the unit as a word); the eye reads the size line under it.
function renderName(context) {
  const said = context.said ? html`<span class="sf-file-preview-said">${context.said}</span>` : nothing;
  if (context.linked) {
    return html`<a
      class="sf-file-preview-name"
      href=${context.href}
      download=${context.download ? context.fileName : nothing}
      target=${!context.download && context.target ? context.target : nothing}
      rel=${!context.download && context.target === '_blank' ? 'noopener noreferrer' : nothing}
      title=${context.fileName}
      @click=${context.onOpen}
    >${nameParts(context.fileName)}${said}</a>`;
  }
  return html`<span class="sf-file-preview-name" title=${context.fileName}>${nameParts(context.fileName)}${said}</span>`;
}

// The line under the name, by the state (C81: one family with the upload
// core's rows): the size; while uploading the upload row's bar with its per
// cent at the end; after a failure the reason in the error colour.
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
  return context.fileSize
    ? html`<span class="sf-file-preview-size" aria-hidden=${context.said ? 'true' : nothing}>${context.fileSize}</span>`
    : nothing;
}

export function renderFilePreviewTemplate(context) {
  if (context.compact) return renderCompact(context);
  const state = context.state;
  const rootClasses = [
    'sf-file-preview',
    context.surface ? 'sf-file-preview--surface' : '',
    state !== 'ready' ? `sf-file-preview--${state}` : '',
    context.disabled ? 'disabled' : '',
    context.rootClass,
  ].filter(Boolean);
  // A file not there yet (uploading) or not there at all (failed) has nothing
  // to download; it can still be taken away.
  const download = context.downloadAction && state === 'ready';
  const hasActions = context.actions && (download || context.removeAction);
  const retry = state === 'error' && !context.disabled;
  const grouped = hasActions || retry;

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
      <span class="sf-file-preview-holder">
        ${context.isImage
          ? html`<img class="sf-file-preview-thumbnail" src=${context.imageUrl || context.href} alt="">`
          : html`<i class="sf-icon" aria-hidden="true">${context.icon}</i>`}
      </span>
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
                size="1"
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
                onClick: context.onDownload,
              })
              : nothing}
            ${hasActions && context.removeAction
              ? renderAction({
                icon: 'delete',
                label: context.removeLabel,
                disabled: context.disabled,
                action: 'remove',
                onClick: context.onRemove,
              })
              : nothing}
          </span>
        `
        : nothing}
    </div>
  `;
}

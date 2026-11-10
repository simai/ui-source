import { html, nothing } from 'lit';
import { createInlineSpinner } from '../../../../component/spinner/js/_spinner-draw';

// One file to fetch (decision C25, 2026-11-09):
//   ready      the download sign, the name, the type and the size;
//   preparing  the Framework's spinner in the sign's place, «Готовим файл…»
//              in place of the type and the size, aria-busy, no second press;
//   error      the file as when ready, and under it an error notice
//              «Не удалось подготовить файл» with «Повторить».
// A file link downloads in the same tab; target="_blank" is a file opened to
// view, and says so with a sign after the name and words for a screen reader.
export function renderDownloadFileTemplate(context) {
  const {
    size,
    fileName,
    fileType,
    fileSize,
    icon,
    href,
    download,
    disabled,
    opensTab,
    ariaLabel,
    state,
    words,
  } = context;

  const preparing = state === 'preparing';
  const tagName = href && !disabled ? 'a' : 'button';
  const rootClasses = [
    'sf-download-file',
    `sf-download-file--size-${size}`,
    `sf-download-file--${state}`,
    context.rootClass,
    disabled ? 'disabled' : 'cursor-pointer transition',
  ].filter(Boolean);

  const sign = preparing
    ? createInlineSpinner({ className: 'sf-download-file__spinner' })
    : html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">${icon}</i>`;

  const meta = preparing
    ? html`<span class="sf-download-file__meta"><span class="sf-download-file__status">${words.preparing}</span></span>`
    : html`<span class="sf-download-file__meta">${fileType
        ? html`<span class="sf-download-file__type">${fileType}</span>`
        : nothing}<span class="sf-download-file__size sf-download-file-file-size">${fileSize}</span></span>`;

  const content = html`
    <span class="sf-download-file__body sf-download-file-wrap">
      <span class="sf-download-file__main sf-download-file-container">
        ${sign}
        <span class="sf-download-file__name sf-download-file-file-name" title=${fileName || nothing}>${fileName}</span>
        ${opensTab
          ? html`<i class="sf-download-file__tab sf-icon" aria-hidden="true">open_in_new</i><span class="sf-download-file__tab-words">${words.newTab}</span>`
          : nothing}
      </span>
      ${meta}
    </span>
  `;

  const notice = state === 'error'
    ? html`<sf-alert
        class="sf-download-file__error"
        status="error"
        appearance="outlined"
        icon="error"
        heading=${words.errorHeading}
        supporting-text=${context.errorText || nothing}
        action-text=${words.retry}
        action="retry"
      ></sf-alert>`
    : nothing;

  // The host is display: contents, so whatever it draws is laid out by the
  // page's container. The file and its notice are one column of their own: as
  // two siblings, a flex row put the notice beside the file (docs pre-check
  // 2026-11-10 DF-13). Ready and preparing draw the file alone, as before.
  const withNotice = (file) => (notice === nothing
    ? file
    : html`<div class="sf-download-file__stack">${file}${notice}</div>`);

  if (tagName === 'a') {
    return withNotice(html`
      <a
        class=${rootClasses.join(' ')}
        style=${context.rootStyle || nothing}
        href=${href}
        target=${opensTab ? '_blank' : nothing}
        rel=${opensTab ? 'noopener noreferrer' : nothing}
        download=${download ? fileName || '' : nothing}
        aria-label=${ariaLabel || nothing}
        aria-busy=${preparing ? 'true' : nothing}
      >
        ${content}
      </a>
    `);
  }

  return withNotice(html`
    <button
      type="button"
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      ?disabled=${disabled}
      aria-disabled=${disabled ? 'true' : nothing}
      aria-label=${ariaLabel || nothing}
      aria-busy=${preparing ? 'true' : nothing}
    >
      ${content}
    </button>
  `);
}

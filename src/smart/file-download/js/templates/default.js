import { html, nothing } from 'lit';
import { createInlineSpinner } from '../../../../component/spinner/js/_spinner-draw';

// One file to fetch (decisions C25, C51):
//   ready      the download sign, the name, and right after it the type and
//              the size (under it on a phone); the row is as wide as its text
//              unless full-width. A screen reader hears «name, type, size»,
//              the unit in words.
//   preparing  the Framework's spinner in the sign's place -- the progress
//              ring with value -- and «Готовим файл…» or «Готовим… N %» in
//              place of the type and the size, aria-busy, no second press;
//              «Отменить» beside the row while cancelable.
//   offer      ready after a long wait, or while the page was hidden: the
//              success sign, «Готово · type · size» and «Скачать» beside it.
//   error      the row itself says so: the error sign and border,
//              «Не удалось собрать», «Повторить» at its end, error-text
//              small under it.
// A file link downloads in the same tab; target="_blank" is a file opened to
// view, and says so with a sign after the name and words for a screen reader.
// Two hidden live regions follow the file: the start, the end and a cancel
// are said politely, an error at once.
export function renderDownloadFileTemplate(context) {
  const { live = {} } = context;
  return html`${renderFile(context)}<span class="sf-download-file__live" role="status">${live.polite || ''}</span><span class="sf-download-file__live" role="alert">${live.assertive || ''}</span>`;
}

function rowClasses(context, view) {
  const { size, disabled, fullWidth } = context;
  return [
    'sf-download-file',
    `sf-download-file--size-${size}`,
    `sf-download-file--${view}`,
    fullWidth ? 'sf-download-file--full-width' : '',
    context.rootClass,
    view === 'ready' || view === 'preparing' ? (disabled ? 'disabled' : 'cursor-pointer transition') : '',
  ].filter(Boolean).join(' ');
}

function sizeMeta(fileType, fileSize, lead = nothing) {
  return html`<span class="sf-download-file__meta" aria-hidden="true">${lead}${fileType
    ? html`<span class="sf-download-file__type">${fileType}</span>`
    : nothing}<span class="sf-download-file__size sf-download-file-file-size">${fileSize}</span></span>`;
}

function body(sign, text, end = nothing) {
  return html`
    <span class="sf-download-file__body sf-download-file-wrap">
      <span class="sf-download-file__main sf-download-file-container">
        ${sign}
        <span class="sf-download-file__text">${text}</span>
      </span>
      ${end}
    </span>
  `;
}

function renderFile(context) {
  const { view, size, fileName, fileType, fileSize, said, words, fullWidth } = context;
  const stack = (content) => html`<div class=${fullWidth ? 'sf-download-file__stack sf-download-file__stack--full-width' : 'sf-download-file__stack'}>${content}</div>`;
  const name = html`<span class="sf-download-file__name sf-download-file-file-name">${fileName}</span>`;

  if (view === 'error') {
    const row = html`
      <div class=${rowClasses(context, 'error')} style=${context.rootStyle || nothing} role="group" aria-label=${fileName}>
        ${body(
          html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">error</i>`,
          html`${name}<span class="sf-download-file__said">, ${words.failed}</span><span class="sf-download-file__meta" aria-hidden="true"><span class="sf-download-file__status">${words.failed}</span></span>`,
          html`<span class="sf-download-file__end"><sf-button
            class="sf-download-file__retry"
            size=${size}
            height="low"
            appearance="ghost"
            scheme="primary"
            icon-start="refresh"
            text=${words.retry}
            aria-label=${words.retryLabel}
          ></sf-button></span>`,
        )}
      </div>
    `;
    return stack(html`${row}${context.errorText ? html`<p class="sf-download-file__reason">${context.errorText}</p>` : nothing}`);
  }

  if (view === 'offer') {
    const row = html`
      <span class=${rowClasses(context, 'offer')} style=${context.rootStyle || nothing}>
        ${body(
          html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">check_circle</i>`,
          html`${name}<span class="sf-download-file__said">, ${words.ready}${said}</span>${sizeMeta(fileType, fileSize, html`<span class="sf-download-file__status">${words.ready}</span>`)}`,
        )}
      </span>
    `;
    return stack(html`<div class="sf-download-file__line">${row}<sf-button
      class="sf-download-file__get"
      size=${size}
      height="low"
      appearance="default"
      scheme="primary"
      icon-start="download"
      text=${words.get}
      aria-label=${words.getLabel}
    ></sf-button></div>`);
  }

  const preparing = view === 'preparing';
  const { href, download, disabled, opensTab, ariaLabel } = context;
  const hasValue = preparing && context.value !== null;

  const sign = !preparing
    ? html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">${context.icon}</i>`
    : hasValue
      ? html`<span class="sf-download-file__ring" aria-hidden="true"><span class="sf-progress-ring" style=${`--sf-progress-ring--value:${context.value}`}><span class="sf-progress-ring-indicator"></span></span></span>`
      : createInlineSpinner({ className: 'sf-download-file__spinner' });

  const tab = opensTab
    ? html`<i class="sf-download-file__tab sf-icon" aria-hidden="true">open_in_new</i><span class="sf-download-file__tab-words">${words.newTab}</span>`
    : nothing;

  const text = preparing
    ? html`${name}<span class="sf-download-file__said">, </span><span class="sf-download-file__meta"><span class="sf-download-file__status">${hasValue ? words.preparingValue : words.preparing}</span></span>`
    : html`${name}${tab}<span class="sf-download-file__said">${said}</span>${sizeMeta(fileType, fileSize)}`;

  const content = body(sign, text);
  const classes = rowClasses(context, preparing ? 'preparing' : 'ready');

  const row = href && !disabled
    ? html`
      <a
        class=${classes}
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
    `
    : html`
      <button
        type="button"
        class=${classes}
        style=${context.rootStyle || nothing}
        ?disabled=${disabled}
        aria-disabled=${disabled ? 'true' : nothing}
        aria-label=${ariaLabel || nothing}
        aria-busy=${preparing ? 'true' : nothing}
      >
        ${content}
      </button>
    `;

  // «Отменить» stands beside the row while the file is made and the host
  // can stop it (cancelable).
  if (preparing && context.cancelable) {
    return stack(html`<div class="sf-download-file__line">${row}<sf-button
      class="sf-download-file__cancel"
      size=${size}
      height="low"
      appearance="ghost"
      scheme="on-surface"
      text=${words.cancel}
      aria-label=${words.cancelLabel}
    ></sf-button></div>`);
  }
  return row;
}

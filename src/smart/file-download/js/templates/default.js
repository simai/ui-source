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
//   error      the row itself says so (decision C88): one grid of the
//              error sign, the text and «Повторить». The sign stands on the
//              name's first line, the name takes two lines at most (the whole
//              name in its tooltip and for a screen reader), «Не удалось
//              собрать» and error-text a step smaller under it, inside the
//              frame. «Повторить» ends the first line; in a column narrower
//              than 360 px it goes under the text, and only when its words do
//              not fit there either is it the icon alone, its name in
//              aria-label and a tooltip.
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

// The Framework's plain tooltip (component.tooltip, class markup), hidden
// until the tooltip controller shows it on hover or keyboard focus of the
// trigger that names it. aria-hidden: what it says is already the trigger's
// name.
function tip(id, text) {
  if (!id) return nothing;
  return html`<span id=${id} class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1/3 sf-download-file__tip" aria-hidden="true" hidden><span class="sf-tooltip-content"><span class="sf-tooltip-text">${text}</span></span></span>`;
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
  // The hidden words stand inside the name, so a screen reader hears them as
  // one line with it: «Смета.csv, CSV, 112 байт».
  const name = (words = '') => html`<span class="sf-download-file__name sf-download-file-file-name">${fileName}${words
    ? html`<span class="sf-download-file__said">${words}</span>`
    : nothing}</span>`;

  if (view === 'error') {
    const { narrow, retryIcon, tipIds = {} } = context;
    const retry = retryIcon
      ? html`<sf-button-icon
          class="sf-download-file__retry"
          size=${size}
          height="low"
          appearance="ghost"
          scheme="primary"
          icon="refresh"
          aria-label=${words.retryLabel}
          data-tooltip=${tipIds.retry || nothing}
        ></sf-button-icon>${tip(tipIds.retry, words.retry)}`
      : html`<sf-button
          class="sf-download-file__retry"
          size=${size}
          height="low"
          appearance="ghost"
          scheme="primary"
          icon-start="refresh"
          text=${words.retry}
          aria-label=${words.retryLabel}
        ></sf-button>`;
    const classes = [
      rowClasses(context, 'error'),
      narrow ? 'sf-download-file--narrow' : '',
      retryIcon ? 'sf-download-file--retry-icon' : '',
    ].filter(Boolean).join(' ');
    // The name is cut after two lines: its tooltip shows it whole, and the
    // words stay whole in the markup, so a screen reader hears all of them.
    const row = html`
      <div class=${classes} style=${context.rootStyle || nothing} role="group" aria-label=${fileName}>
        ${body(
          html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">error</i>`,
          html`<span class="sf-download-file__name sf-download-file-file-name" data-tooltip=${tipIds.name || nothing}>${fileName}<span class="sf-download-file__said">, ${words.failed}</span></span><span class="sf-download-file__meta" aria-hidden="true"><span class="sf-download-file__status">${words.failed}</span></span>${context.errorText
            ? html`<span class="sf-download-file__reason">${context.errorText}</span>`
            : nothing}`,
          html`<span class="sf-download-file__end">${retry}</span>`,
        )}
        ${tip(tipIds.name, fileName)}
      </div>
    `;
    return stack(row);
  }

  if (view === 'offer') {
    const row = html`
      <span class=${rowClasses(context, 'offer')} style=${context.rootStyle || nothing}>
        ${body(
          html`<i class="sf-download-file__icon sf-icon" aria-hidden="true">check_circle</i>`,
          html`${name(`, ${words.ready}${said}`)}${sizeMeta(fileType, fileSize, html`<span class="sf-download-file__status">${words.ready}</span>`)}`,
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
    ? html`${name(', ')}<span class="sf-download-file__meta"><span class="sf-download-file__status">${hasValue ? words.preparingValue : words.preparing}</span></span>`
    : html`${name(opensTab ? '' : said)}${tab}${opensTab && said ? html`<span class="sf-download-file__said">${said}</span>` : nothing}${sizeMeta(fileType, fileSize)}`;

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

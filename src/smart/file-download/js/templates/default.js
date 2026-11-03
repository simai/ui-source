import { html, nothing } from 'lit';

export function renderDownloadFileTemplate(context) {
  const {
    size,
    fileName,
    fileSize,
    icon,
    href,
    download,
    disabled,
    target,
    ariaLabel,
  } = context;

  const tagName = href && !disabled ? 'a' : 'button';
  const rootClasses = [
    'sf-download-file',
    `sf-download-file--size-${size}`,
    context.rootClass,
    disabled ? 'disabled' : 'cursor-pointer transition',
  ].filter(Boolean);

  const content = html`
    <span class="sf-download-file__body sf-download-file-wrap">
      <span class="sf-download-file__main sf-download-file-container">
        <i class="sf-download-file__icon sf-icon" aria-hidden="true">${icon}</i>
        <span class="sf-download-file__name sf-download-file-file-name">${fileName}</span>
      </span>
      <span class="sf-download-file__size sf-download-file-file-size">${fileSize}</span>
    </span>
  `;

  if (tagName === 'a') {
    return html`
      <a
        class=${rootClasses.join(' ')}
        style=${context.rootStyle || nothing}
        href=${href}
        target=${download ? nothing : target}
        rel=${download ? nothing : 'noopener noreferrer'}
        download=${download ? fileName || '' : nothing}
        aria-label=${ariaLabel || nothing}
      >
        ${content}
      </a>
    `;
  }

  return html`
    <button
      type="button"
      class=${rootClasses.join(' ')}
      style=${context.rootStyle || nothing}
      ?disabled=${disabled}
      aria-disabled=${disabled ? 'true' : nothing}
      aria-label=${ariaLabel || nothing}
    >
      ${content}
    </button>
  `;
}

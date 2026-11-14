import { html, nothing } from 'lit';

// The icon a target that is gone shows in place of its own (C147 (6)): the
// broken link, whatever the reason.
const GONE_ICON = 'link_off';

export function renderReferenceLinkTemplate(context) {
  const {
    component, appearance, icon, label, text, href, target, disabled, ariaLabel, rootClass, size, line,
    state, copy, copyValue, words = {},
  } = context;

  const inline = appearance === 'inline';
  // A target that is gone (C147 (6)): no link, the words dimmed, the broken
  // link icon and the reason after the name. href is not followed then.
  const gone = state === 'missing' || state === 'forbidden';
  const newTab = !gone && !disabled && Boolean(href) && target === '_blank';
  // The copy button is the card's (C147 (8)): a card with an address to copy.
  const copyButton = copy && !inline && !size && !line && appearance !== 'plain' && !gone && !disabled && Boolean(href);

  const rootClasses = [
    'sf-reference-link',
    inline ? 'sf-reference-link--inline' : '',
    !inline && size ? `sf-reference-link--size-${size}` : '',
    !inline && line ? `sf-reference-link--line-${line}` : '',
    !inline && appearance === 'plain' ? 'sf-reference-link--plain' : '',
    gone ? `sf-reference-link--gone sf-reference-link--${state}` : '',
    copyButton ? 'sf-reference-link--copy' : '',
    inline ? '' : 'flex',
    inline ? '' : 'items-cross-center',
    disabled ? 'disabled' : '',
    rootClass,
  ]
    .filter(Boolean)
    .join(' ');

  const labelContent =
    component?.hasSlotContent?.('label')
      ? component.getSlotContent('label')
      : label;

  const textContent =
    component?.hasSlotContent?.('text')
      ? component.getSlotContent('text')
      : text;

  const shownIcon = gone ? GONE_ICON : icon;
  const iconPart = shownIcon
    ? html`<i class="sf-reference-link__icon sf-icon" aria-hidden="true">${shownIcon}</i>`
    : nothing;
  // A new tab says so (C147 (4)): the sign after the words and, for a screen
  // reader, the words in the link's name -- in the page's language, the
  // words sf-file-download says for a file opened to view (C25).
  const tabPart = newTab
    ? html`<i class="sf-reference-link__tab sf-icon" aria-hidden="true">open_in_new</i><span class="sf-reference-link__tab-words">${words.newTab}</span>`
    : nothing;
  const name = ariaLabel && newTab ? `${ariaLabel} ${words.newTab}` : ariaLabel;
  const reasonPart = gone
    ? html`<span class="sf-reference-link__reason">${state === 'forbidden' ? words.forbidden : words.missing}</span>`
    : nothing;

  if (inline) {
    // In text (C147 (1), (2)): one inline run that wraps with the sentence --
    // the type icon, the name, the record's number in a quiet ink, the new
    // tab sign. No white space between the parts: the icon never parts from
    // the name's first word at a line end.
    const numberPart = textContent
      ? html` <span class="sf-reference-link__number">${textContent}</span>`
      : nothing;
    const body = html`${iconPart}<span class="sf-reference-link__label">${labelContent}</span>${numberPart}${reasonPart}${tabPart}`;
    const run = href && !disabled && !gone
      ? html`<a class="sf-reference-link__link"
          href=${href}
          target=${target || nothing}
          rel=${target && target !== '_self' ? 'noopener noreferrer' : nothing}
          aria-label=${name || nothing}
        >${body}</a>`
      : disabled
        ? html`<span class="sf-reference-link__link" role="link" aria-disabled="true" aria-label=${ariaLabel || nothing}>${body}</span>`
        : html`<span class="sf-reference-link__link">${body}</span>`;

    return html`<span class=${rootClasses} style=${context.rootStyle || nothing}>${run}</span>`;
  }

  const linkContent =
    href && !disabled && !gone
      ? html`
          <a class="sf-reference-link__link"
            href=${href}
            target=${target || nothing}
            rel=${target && target !== '_self' ? 'noopener noreferrer' : nothing}
            aria-label=${name || nothing}
          ><span class="sf-reference-link__label">${labelContent}</span>${tabPart}</a>
        `
      : disabled
        ? // A disabled reference is a link the reader cannot follow: the label
          // says so as a link that is unavailable (RL-16), not as plain text.
          // No href and no tabindex, so it takes no focus and goes nowhere.
          html`<span role="link" aria-disabled="true" aria-label=${ariaLabel || nothing}>${labelContent}</span>`
        : // No address, or a target that is gone: the name as text; the
          // reason follows it in the same run, not as a card's row item.
          html`<span class="sf-reference-link__label">${labelContent}${reasonPart}</span>`;

  // Copy the address (C147 (8)): the clipboard component's attribute route
  // (data-sf-copy, decision C48) on an icon button of the Framework's class
  // markup; its feedback, name tooltip and words are that route's.
  const copyPart = copyButton
    ? html`<button type="button"
        class="sf-reference-link__copy sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1/2 flex items-cross-center content-main-center"
        data-sf-copy=${copyValue}
        aria-label=${words.copy}
      ><i class="sf-icon" aria-hidden="true">content_copy</i></button>`
    : nothing;

  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
      @click=${component?.handleRootClick}
    >
      <div class="sf-reference-link__main sf-reference-link-left">
        ${iconPart}
        ${linkContent}
      </div>
      <div class="sf-reference-link__meta sf-reference-link-text">${textContent}</div>
      ${copyPart}
    </div>
  `;
}

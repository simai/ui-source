import {html, nothing} from 'lit';

// Framework utilities and the header's own sheet (scss/: the gaps and colours
// are its public variables): a column for the path above the line, and a line
// holding the heading, its count, the install mark and the star, then the
// actions pushed to the end. The heading is the fourth heading step, the size
// the admin pages have always titled themselves at.
export function renderPageHeaderTemplate(context) {
  const {component, heading, count, level, star, text, hostSlot, hasHostSlot, rootClass} = context;
  const classes = ['sf-page-header', 'flex', 'flex-col', 'min-w-0', rootClass].filter(Boolean).join(' ');
  const on = star === true;
  return html`<header class=${classes} style=${context.rootStyle || nothing}>
    ${hasHostSlot('path') ? html`<div class="sf-page-header-path flex items-cross-center min-w-0">${hostSlot('path')}</div>` : nothing}
    <div class="sf-page-header-line flex items-cross-center flex-wrap min-w-0">
      ${hasHostSlot('start') ? hostSlot('start') : nothing}
      <h1 class="sf-page-header-heading sf-h-4 m-0 min-w-0 truncate">${heading}</h1>
      ${count !== '' && count !== null && count !== undefined
        ? html`<sf-badge appearance="tonal" scheme="neutral" size="1/2" text=${String(count)}></sf-badge>`
        : nothing}
      ${level === 'install'
        ? html`<sf-badge appearance="outline" scheme="tertiary" size="1/2" text=${text('all-sites')}></sf-badge>`
        : nothing}
      ${star === true || star === false
        ? html`<sf-icon-button size="1/2" appearance="ghost" scheme="on-surface"
            class=${on ? 'sf-page-header-star sf-page-header-star--on' : 'sf-page-header-star'}
            icon="star"
            ?filled=${on}
            aria-pressed=${String(on)}
            aria-label=${on ? text('unstar') : text('star')}
            title=${on ? text('unstar') : text('star')}
            @click=${() => component.toggleStar()}></sf-icon-button>`
        : nothing}
      <span class="grow"></span>
      ${hasHostSlot('actions') ? html`<div class="sf-page-header-actions flex items-cross-center">${hostSlot('actions')}</div>` : nothing}
    </div>
  </header>`;
}

import {html, nothing} from 'lit';
import {unsafeStatic, html as staticHtml} from 'lit/static-html.js';

// Framework utilities and the header's own sheet (scss/: the gaps and colours
// are its public variables): a column for the path above the line, and a line
// holding the title -- the heading, its count, the install mark and the star --
// then the actions at the end. The heading is the fourth heading step, the size
// the admin pages have always titled themselves at. The title is a group of its
// own so that a long heading closes down to its ellipsis beside the actions
// instead of taking a line and pushing the count and the actions under it
// (HD-12); the count and the marks stay right after the words. The actions
// come in the header's order, the main one last (C161 (3)); the tabs slot
// ends the header, its line the header's lower edge (C161 (5)).
//
// The head of a conversation (C161, 1.10.0) adds three optional parts, each
// drawn only when the page gives it, so a head without them is the markup it
// always was: the media slot (an avatar) first in the title, so that it moves
// with the name when a narrow line wraps the title under «назад», a
// heading slot (a control, such as a picker of whom to talk to) inside the
// heading element in place of the heading's words, and a description line
// under the heading (whether the person is online). heading-level changes the
// heading element's tag only; its look stays the fourth heading step.
//
// A head with no actions has nothing to keep the line beside its heading, so
// a long heading wraps whole (1.12.0, C324: the page's whole name) instead of
// closing down to its ellipsis; the count, the marks and the star stand
// beside its last line, on its centre line. HD-12's ellipsis stays for a head with actions. The
// path-end slot (1.12.0) stands at the end of the path's row -- the admin's
// activity indicator beside the crumbs -- and is drawn only when given.
export function renderPageHeaderTemplate(context) {
  const {component, heading, count, level, star, text, hostSlot, hasHostSlot, rootClass} = context;
  const headingLevel = context.headingLevel || 1;
  const tag = unsafeStatic(`h${headingLevel}`);
  const slotted = hasHostSlot('heading');
  const wrap = !hasHostSlot('actions');
  const fit = wrap ? 'sf-page-header-heading--wrap' : 'truncate';
  const headingBody = slotted ? hostSlot('heading') : heading;
  const headingClass = slotted
    ? 'sf-page-header-heading sf-page-header-heading--slot sf-h-4 m-0 min-w-0 flex items-cross-center'
    : `sf-page-header-heading sf-h-4 m-0 min-w-0 ${fit}`;
  const headingElement = headingLevel === 1 && !slotted
    ? (wrap
      ? html`<h1 class="sf-page-header-heading sf-h-4 m-0 min-w-0 sf-page-header-heading--wrap">${heading}</h1>`
      : html`<h1 class="sf-page-header-heading sf-h-4 m-0 min-w-0 truncate">${heading}</h1>`)
    : staticHtml`<${tag} class=${headingClass}>${headingBody}</${tag}>`;
  const description = context.description;
  const name = description
    ? html`<div class="sf-page-header-name flex flex-col min-w-0">${headingElement}<p class=${`sf-page-header-description m-0 min-w-0 ${fit}`}>${description}</p></div>`
    : headingElement;
  const classes = ['sf-page-header', 'flex', 'flex-col', 'min-w-0', wrap && !slotted ? 'sf-page-header--wrap' : '', context.expressive ? 'sf-page-header--expressive' : '', context.sticky ? 'sf-page-header--sticky' : '', rootClass].filter(Boolean).join(' ');
  const on = star === true;
  const actions = context.actions ? context.actions() : {rest: hostSlot('actions'), main: nothing};
  return html`<header class=${classes} style=${context.rootStyle || nothing}>
    ${hasHostSlot('path') || hasHostSlot('path-end')
      ? html`<div class="sf-page-header-path flex items-cross-center min-w-0">${hasHostSlot('path') ? hostSlot('path') : nothing}${hasHostSlot('path-end')
        ? html`<div class="sf-page-header-path-end flex items-cross-center">${hostSlot('path-end')}</div>`
        : nothing}</div>`
      : nothing}
    <div class="sf-page-header-line flex items-cross-center flex-wrap min-w-0">
      ${hasHostSlot('start') ? hostSlot('start') : nothing}
      <div class="sf-page-header-title flex items-cross-center min-w-0">
        ${hasHostSlot('media') ? html`<div class="sf-page-header-media flex items-cross-center">${hostSlot('media')}</div>` : nothing}${name}
        ${count !== '' && count !== null && count !== undefined
          ? html`<sf-badge appearance="tonal" scheme="neutral" size="1/2" text=${String(count)}></sf-badge>`
          : nothing}
        ${level === 'install'
          ? html`<sf-badge appearance="outline" scheme="tertiary" size="1/2" text=${text('all-sites')}></sf-badge>`
          : nothing}
        ${star === true || star === false
          // The star's name says what pressing it does («В избранное», «Убрать
          // из избранного»), so it says the state too and carries no
          // aria-pressed (1.2.2, rule C12): both at once read «Убрать из
          // избранного, нажата». The filled glyph in its own colour shows it.
          // It stands on its row's rung (C103, 1.7.0): the actions' size while
          // they keep the line beside it, else the start control's, else the
          // half step (index.js syncStarRung).
          ? (context.starLook
            // The toggle look (VS-10, C393): one name and aria-pressed, the
            // state on the plate, the glyph outline. The look is the one
            // index.js starLook found the icon button to declare.
            ? html`<sf-button-icon size=${context.starSize || '1/2'} appearance=${context.starLook}
                class=${on ? 'sf-page-header-star sf-page-header-star--toggle sf-page-header-star--on' : 'sf-page-header-star sf-page-header-star--toggle'}
                icon="star"
                pressed=${on ? 'true' : 'false'}
                aria-label=${text('star')}
                title=${text('star')}
                @click=${() => component.toggleStar()}></sf-button-icon>`
            : html`<sf-button-icon size=${context.starSize || '1/2'} appearance="ghost" scheme="on-surface"
                class=${on ? 'sf-page-header-star sf-page-header-star--on' : 'sf-page-header-star'}
                icon="star"
                ?filled=${on}
                aria-label=${on ? text('unstar') : text('star')}
                title=${on ? text('unstar') : text('star')}
                @click=${() => component.toggleStar()}></sf-button-icon>`)
          : nothing}
      </div>
      ${hasHostSlot('actions')
        // overflow more (owner decision C155 (7), C161 (3), (4)): one row,
        // and ⋯ for what does not fit, right before the main action, which
        // ends the line -- the actions' rung and the look of the actions it
        // stands for (outlined beside outlined ones, else the quiet ghost),
        // «Ещё» its name and tooltip. It is drawn out of the row
        // (sf-page-header-out) until the row is laid out and something left.
        ? html`<div class=${context.overflow === 'more' ? 'sf-page-header-actions sf-page-header-actions--more flex items-cross-center' : 'sf-page-header-actions flex items-cross-center'}>${actions.rest}${context.overflow === 'more'
            ? html`<sf-button-icon class="sf-page-header-more sf-page-header-out" icon="more_horiz" appearance=${context.moreLook.appearance} scheme=${context.moreLook.scheme || nothing}
                size=${context.moreSize || '1'} aria-label=${text('more')} title=${text('more')} aria-haspopup="menu"
                @click=${(event) => component.openActionsMore(event)}></sf-button-icon>`
            : nothing}${actions.main}</div>`
        : nothing}
    </div>
    ${hasHostSlot('tabs') ? html`<div class="sf-page-header-tabs min-w-0">${hostSlot('tabs')}</div>` : nothing}
  </header>`;
}

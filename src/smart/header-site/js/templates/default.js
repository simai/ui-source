import {html, nothing} from 'lit';

// The bar: a <header> (the page's banner) holding one container-wide row.
// Wide, the row reads brand · nav … actions · tools, and the panel around the
// nav and the actions is display: contents, so they stand in the row itself.
// Collapsed (a media rule per `collapse` step, scss/), the menu button comes
// first (menu-placement inline-start) or last, after the tools (inline-end),
// and the panel is shown only while open: a side panel from the button's edge
// over a scrim, named by its heading. The button is in the DOM where it is
// shown, so the reading and Tab order follow what is seen. While a switch of
// the page's own is on screen (data-header-site, C104) the bar draws none.
// The panel's close is sf-button-close, the one close button (C14), at the
// bar's size, ghost on the panel's surface.
// The page's slot nodes are placed once and stay where they are in both
// forms.
export function renderSiteHeaderTemplate(context) {
  const {component, id, open, collapse, menuPlacement, ownMenuButton, sticky, size, navigationAlign, label, menuLabel, closeLabel, slot, hasSlot, rootClass} = context;
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  const menuButton = html`<sf-button-icon class="sf-site-header-menu-button" icon="menu" size=${size} appearance="ghost" scheme="on-surface"
        aria-label=${menuLabel} aria-haspopup="dialog" aria-controls=${panelId} aria-expanded=${String(Boolean(open))}
        @click=${() => component.toggle()}></sf-button-icon>`;
  const classes = [
    'sf-site-header',
    `sf-site-header--collapse-${collapse}`,
    menuPlacement === 'inline-end' ? 'sf-site-header--menu-inline-end' : '',
    `sf-site-header--size-${size === '1/2' ? 'half' : '1'}`,
    navigationAlign === 'center' ? 'sf-site-header--navigation-center' : '',
    sticky ? 'sf-site-header--sticky' : '',
    open ? 'sf-site-header--open' : '',
    rootClass,
  ].filter(Boolean).join(' ');
  return html`<header class=${classes} style=${context.rootStyle || nothing}>
    <div class="sf-site-header-row container w-full m-inline-auto">
      ${ownMenuButton && menuPlacement !== 'inline-end' ? menuButton : nothing}
      ${hasSlot('brand') ? html`<div class="sf-site-header-brand">${slot('brand')}</div>` : nothing}
      <div class="sf-site-header-scrim" aria-hidden="true" @click=${() => component.close({reason: 'outside'})}></div>
      <div class="sf-site-header-panel" id=${panelId}
        role=${open ? 'dialog' : nothing} aria-modal=${open ? 'true' : nothing} aria-labelledby=${open ? headingId : nothing}
        tabindex=${open ? '-1' : nothing}
        @click=${(event) => component.onPanelClick(event)}>
        <div class="sf-site-header-panel-head">
          <span class="sf-site-header-panel-heading" id=${headingId}>${label}</span>
          <sf-button-close class="sf-site-header-close-button" size=${size}
            aria-label=${closeLabel} @click=${() => component.close({reason: 'close'})}></sf-button-close>
        </div>
        ${hasSlot('nav') ? html`<div class="sf-site-header-nav">${slot('nav')}</div>` : nothing}
        ${hasSlot('actions') ? html`<div class="sf-site-header-actions">${slot('actions')}</div>` : nothing}
        ${hasSlot('sheet') ? html`<div class="sf-site-header-sheet">${slot('sheet')}</div>` : nothing}
      </div>
      ${hasSlot('tools') ? html`<div class="sf-site-header-tools">${slot('tools')}</div>` : nothing}
      ${ownMenuButton && menuPlacement === 'inline-end' ? menuButton : nothing}
    </div>
  </header>`;
}

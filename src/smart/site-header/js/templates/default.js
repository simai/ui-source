import {html, nothing} from 'lit';

// The bar: a <header> (the page's banner) holding one container-wide row.
// Wide, the row reads brand · nav … actions · tools, and the panel around the
// nav and the actions is display: contents, so they stand in the row itself.
// Collapsed (a media rule per `collapse` step, scss/), the menu button comes
// first and the panel is shown only while open: a side panel at the inline
// start over a scrim, named by its heading. The page's slot nodes are placed
// once and stay where they are in both forms.
export function renderSiteHeaderTemplate(context) {
  const {component, id, open, collapse, sticky, size, label, menuLabel, closeLabel, slot, hasSlot, rootClass} = context;
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  const classes = [
    'sf-site-header',
    `sf-site-header--collapse-${collapse}`,
    `sf-site-header--size-${size === '1/2' ? 'half' : '1'}`,
    sticky ? 'sf-site-header--sticky' : '',
    open ? 'sf-site-header--open' : '',
    rootClass,
  ].filter(Boolean).join(' ');
  return html`<header class=${classes} style=${context.rootStyle || nothing}>
    <div class="sf-site-header-row container w-full m-inline-auto">
      <sf-icon-button class="sf-site-header-menu-button" icon="menu" size=${size} appearance="link" scheme="on-surface"
        aria-label=${menuLabel} aria-haspopup="dialog" aria-controls=${panelId} aria-expanded=${String(Boolean(open))}
        @click=${() => component.toggle()}></sf-icon-button>
      ${hasSlot('brand') ? html`<div class="sf-site-header-brand">${slot('brand')}</div>` : nothing}
      <div class="sf-site-header-scrim" aria-hidden="true" @click=${() => component.close({reason: 'outside'})}></div>
      <div class="sf-site-header-panel" id=${panelId}
        role=${open ? 'dialog' : nothing} aria-modal=${open ? 'true' : nothing} aria-labelledby=${open ? headingId : nothing}
        tabindex=${open ? '-1' : nothing}
        @click=${(event) => component.onPanelClick(event)}>
        <div class="sf-site-header-panel-head">
          <span class="sf-site-header-panel-heading" id=${headingId}>${label}</span>
          <sf-icon-button class="sf-site-header-close-button" icon="close" size=${size} appearance="link" scheme="on-surface"
            aria-label=${closeLabel} @click=${() => component.close({reason: 'close'})}></sf-icon-button>
        </div>
        ${hasSlot('nav') ? html`<div class="sf-site-header-nav">${slot('nav')}</div>` : nothing}
        ${hasSlot('actions') ? html`<div class="sf-site-header-actions">${slot('actions')}</div>` : nothing}
        ${hasSlot('sheet') ? html`<div class="sf-site-header-sheet">${slot('sheet')}</div>` : nothing}
      </div>
      ${hasSlot('tools') ? html`<div class="sf-site-header-tools">${slot('tools')}</div>` : nothing}
    </div>
  </header>`;
}

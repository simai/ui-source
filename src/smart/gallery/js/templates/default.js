import { html, nothing } from 'lit';
import './default.css';

// sf-gallery draws its pictures as the one picture tile of the Framework
// (component.figure 1.3.0: .sf-figure--tile in a .sf-figure-grid, owner
// decision C150 (10)); the full-screen viewer is its own part (js/viewer.js).

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ').trim();
}

const RATIO_CLASS = {
  '1/1': 'sf-figure--ratio-1x1',
  '4/3': 'sf-figure--ratio-4x3',
  '16/9': 'sf-figure--ratio-16x9',
  auto: '',
};

function pick(context, tile) {
  if (!context.selecting) return nothing;
  return html`
    <label class="sf-figure-pick sf-checkbox sf-checkbox--size-1 flex">
      <span class="sf-checkbox-box flex">
        <input type="checkbox" .checked=${tile.selected} data-sf-gallery-pick=${tile.index}
          aria-label=${tile.pickLabel}>
        <span class="sf-icon" aria-hidden="true"></span>
      </span>
    </label>
  `;
}

function media(context, tile) {
  if (!context.lightbox && !context.selecting) {
    return html`<div class="sf-figure-media">${tile.picture}</div>`;
  }
  return html`
    <button type="button" class="sf-figure-media" data-sf-gallery-open=${tile.index}
      aria-label=${tile.openLabel} aria-haspopup=${context.lightbox ? 'dialog' : nothing}>${tile.picture}</button>
  `;
}

function renderGrid(context) {
  const ratioClass = RATIO_CLASS[context.ratio] ?? RATIO_CLASS['1/1'];
  return html`
    ${renderBar(context)}
    <div class=${joinClasses('sf-gallery sf-gallery--grid sf-figure-grid', `sf-figure-grid--${context.tileSize}`,
      context.selectedCount ? 'sf-figure-grid--selecting' : '', context.rootClass)}
      role="list" aria-label=${context.label || nothing}>
      ${context.tiles.map((tile) => html`
        <figure role="listitem" data-sf-gallery-index=${tile.index}
          class=${joinClasses('sf-figure sf-figure--tile', ratioClass, context.ratio === 'auto' ? 'sf-figure--ratio-auto' : '',
            tile.selected ? 'sf-figure--selected' : '')}>
          ${media(context, tile)}
          ${context.caption === 'under' && tile.caption ? html`<figcaption class="sf-figure-caption">${tile.caption}</figcaption>` : nothing}
          ${pick(context, tile)}
        </figure>
      `)}
    </div>
  `;
}

// The second look (C150 (1)): the main picture, whole in its frame, and a row
// of thumbnails under it -- a product card. The thumbnails are one Tab stop,
// paged by the arrow keys (as sf-slider's, GL-2).
function renderThumbnails(context) {
  const shown = context.tiles[context.current - 1] || context.tiles[0];
  if (!shown) return html`<div class=${joinClasses('sf-gallery sf-gallery--thumbnails', context.rootClass)}></div>`;
  return html`
    <div class=${joinClasses('sf-gallery sf-gallery--thumbnails', context.rootClass)}
      style=${context.mainRatio ? `--sf-gallery--ratio: ${context.mainRatio}` : nothing}>
      <figure class="sf-figure sf-figure--contain sf-gallery-main">
        ${context.lightbox
          ? html`<button type="button" class="sf-figure-media" data-sf-gallery-open=${shown.index}
              aria-label=${shown.openLabel} aria-haspopup="dialog">${shown.mainPicture}</button>`
          : html`<div class="sf-figure-media">${shown.mainPicture}</div>`}
      </figure>
      ${context.tiles.length > 1 ? html`
        <div class="sf-gallery-thumbs" role="group" aria-label=${context.label || nothing}>
          ${context.tiles.map((tile) => html`
            <button type="button" class="sf-figure-media sf-gallery-thumb"
              data-sf-gallery-thumb=${tile.index} tabindex=${tile.index === shown.index ? '0' : '-1'}
              aria-current=${tile.index === shown.index ? 'true' : nothing} aria-label=${tile.thumbLabel}>${tile.thumbPicture}</button>
          `)}
        </div>
        <span class="sf-gallery-count" aria-live="polite">${context.countText}</span>
      ` : nothing}
    </div>
  `;
}

// «Выбрано N» with the page's actions and «Снять выбор» (C150 (9)).
function renderBar(context) {
  if (!context.selecting) return nothing;
  return html`
    <div class="sf-gallery-bar" ?hidden=${!context.selectedCount} role="region" aria-label=${context.barLabel}>
      <span class="sf-gallery-bar-count" aria-live="polite">${context.selectedText}</span>
      <span class="sf-gallery-bar-actions">${context.actions}</span>
      <sf-button-icon data-sf-gallery-clear appearance="ghost" scheme="on-surface" size="1/2" icon="close"
        aria-label=${context.clearLabel}></sf-button-icon>
    </div>
  `;
}

export function renderGalleryTemplate(context) {
  if (!context.inline) return html`<div class=${joinClasses('sf-gallery', context.rootClass)} hidden></div>`;
  return context.layout === 'thumbnails' ? renderThumbnails(context) : renderGrid(context);
}

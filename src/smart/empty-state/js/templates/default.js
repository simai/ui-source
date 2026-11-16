import {html, nothing} from 'lit';
import {unsafeStatic, html as staticHtml} from 'lit/static-html.js';

// The featured icon, title role and button a step up from the component's
// size: a state in a panel (1/2) is a size-1 icon, a page (2) a size-3 one.
const ICON_SIZE = {'1/2': '1', 1: '2', 2: '3'};
const BUTTON_SIZE = {'1/2': '1/2', 1: '1', 2: '1'};

// The glyph of the icon place, or for processing a spinner in the same place
// (owner decision C120): the circle, its tone and its size stay. The spinner
// takes the featured icon's size step, whose diameter is the glyph's (both
// read --sf-text-height-<step>), and the glyph's ink as its current colour.
// Its label is empty, so it is hidden from a screen reader: the state's own
// status says the words. With a known share (value) the block form draws an
// sf-progress-ring instead (owner decision C120 (2)): the ring is the circle's
// own box at the same size step, the percentage in the middle, and it is the
// one part of the icon place a reader meets -- a progressbar named «Готово»,
// whose value is said with the status when it appears and then only on
// request (a value change is an attribute, not new words in the region).
function renderGlyph(context, step) {
  if (context.share !== null && context.share !== undefined) {
    return html`<sf-progress-ring class="sf-empty-state-ring" size=${step} value=${String(context.share)} show-text
                 label=${context.shareLabel}></sf-progress-ring>`;
  }
  return context.processing
    ? html`<sf-spinner class="sf-empty-state-spinner" size=${step} label=""></sf-spinner>`
    : html`<i class="sf-icon">${context.shownIcon}</i>`;
}

// The inline form: one line, the icon at the text's size, the words and the
// first action as a link. No heading, so a list inside a menu or a dropdown
// gains no outline entry and no item.
function renderInline(context) {
  const size = context.size === '1' ? '1' : '1-2';
  const [action] = context.resolvedActions ?? [];
  return html`
    <div class=${['sf-empty-state', 'sf-empty-state--inline', `sf-empty-state--size-${size}`, `sf-empty-state--${context.kind}`, context.rootClass].filter(Boolean).join(' ')}
         role=${context.liveRole ?? nothing}>
      ${context.processing
        // The line's text height: the spinner step of the line's size. The
        // inline form has no circle, so a known share keeps the spinner.
        ? html`<span class="sf-empty-state-icon" aria-hidden="true">${renderGlyph({...context, share: null}, size === '1' ? '1' : '1/2')}</span>`
        : html`<i class="sf-icon sf-empty-state-icon" aria-hidden="true">${context.shownIcon}</i>`}
      <span class="sf-empty-state-line">${context.shownLine}</span>
      ${action
        // The link is one size below the line (1.0.x: size 1 with compact
        // spacing): density no longer changes a button's height (C01), so the
        // smaller link is the next size down, as tall as it was.
        ? html`<sf-button class="sf-empty-state-link" size=${size === '1' ? '1/2' : '1/3'} appearance="ghost" scheme="primary"
                 text=${action.text ?? ''} data-action=${String(action.id)}
                 @click=${() => context.component.act(action.id)}></sf-button>`
        : nothing}
    </div>
  `;
}

export function renderEmptyStateTemplate(context) {
  if (context.layout === 'inline') return renderInline(context);
  const tag = unsafeStatic(`h${context.headingLevel}`);
  const size = String(context.size).replace('/', '-');
  const actions = context.resolvedActions ?? [];
  const slotted = context.component?.hasSlotContent?.('actions') ? context.component.getSlotContent('actions') : nothing;
  const ring = context.share !== null && context.share !== undefined;
  return html`
    <div class=${['sf-empty-state', `sf-empty-state--size-${size}`, `sf-empty-state--${context.kind}`, context.expressive ? 'sf-empty-state--expressive' : '', context.rootClass].filter(Boolean).join(' ')}
         role=${context.liveRole ?? nothing}>
      <span class=${`sf-featured-icon sf-featured-icon--size-${ICON_SIZE[context.size] ?? '2'} sf-featured-icon--${context.tone} sf-featured-icon--soft sf-empty-state-icon${ring ? ' sf-empty-state-icon--ring' : ''}`}
            aria-hidden=${ring ? nothing : 'true'}>${renderGlyph(context, ICON_SIZE[context.size] ?? '2')}</span>
      ${staticHtml`<${tag} class="sf-empty-state-title">${context.shownTitle}</${tag}>`}
      ${context.shownText ? html`<p class="sf-empty-state-text">${context.shownText}</p>` : nothing}
      ${actions.length || slotted !== nothing
        ? html`<div class="sf-empty-state-actions">
            ${slotted}
            ${actions.map((action) => html`<sf-button size=${BUTTON_SIZE[context.size] ?? '1'} appearance=${action.appearance ?? 'default'}
                scheme=${action.scheme ?? (action.appearance === 'outline' ? 'on-surface' : 'primary')}
                text=${action.text ?? ''} data-action=${String(action.id)}
                @click=${() => context.component.act(action.id)}></sf-button>`)}
          </div>`
        : nothing}
    </div>
  `;
}

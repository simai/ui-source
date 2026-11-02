import {html, nothing} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

// sf-include's markup: one region, drawn in one of three states.
//
// - loading (and idle, before the first load): the placeholder -- the page's
//   slot placeholder, else an sf-skeleton of `lines` text lines, aria-hidden;
//   while loading the region is aria-busy.
// - ready: the part the server answered, cleaned of scripts by the element
//   (index.js partFrom) and drawn as markup; the Loader starts what is in it.
// - error: an icon, the message in a polite status and Retry, an outline
//   on-surface sf-button at rung 1 of the ladder that calls refresh().
//
// The region is the element's box (the host lays out as display: contents),
// so load="view" watches it, and tabindex -1 lets focus land on it after a
// retry instead of falling to the page.

function placeholder(context) {
  if (context.ownPlaceholder !== nothing) return html`<div class="sf-include-placeholder">${context.ownPlaceholder}</div>`;
  const widths = Array.from({length: context.lines}, (_, index) => (index === context.lines - 1 && context.lines > 1 ? '60%' : '100%')).join(',');
  return html`<div class="sf-include-placeholder" aria-hidden="true">
    <sf-skeleton class="sf-include-skeleton" count=${String(context.lines)} width=${widths}></sf-skeleton>
  </div>`;
}

function failure(context) {
  return html`<div class="sf-include-error">
    <i class="sf-icon sf-include-error-icon" aria-hidden="true">error</i>
    <span class="sf-include-message" role="status">${context.words.failed}</span>
    <sf-button class="sf-include-retry" size="1" appearance="outline" scheme="on-surface" icon-start="refresh"
      text=${context.words.retry} @click=${() => context.component.retry()}></sf-button>
  </div>`;
}

export function renderIncludeTemplate(context) {
  const {phase, part, rootClass} = context;
  const classes = ['sf-include', `sf-include--${phase}`, rootClass].filter(Boolean).join(' ');
  // idle (no src yet, or load="view" not yet near the viewport) shows the
  // placeholder too, but nothing is on its way, so it is not busy.
  const busy = phase === 'loading';
  // The host's own style (a public variable set on it) is the region's: the
  // host lays out as display: contents and keeps none (smart-base rootStyle).
  return html`<div class=${classes} style=${context.rootStyle || nothing} aria-busy=${busy ? 'true' : 'false'} tabindex="-1">${
    phase === 'ready' ? unsafeHTML(part)
      : phase === 'error' ? failure(context)
        : placeholder(context)
  }</div>`;
}

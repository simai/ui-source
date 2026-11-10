import {html, nothing} from 'lit';

// sf-change's markup (scss/ draws it).
//
// - inline: [label: ] old value, then the arrow and the new value as one
//   piece that does not break. The arrow is a picture; a visually hidden
//   word between the values says the change to a screen reader.
// - list: a dl, a term (the label) and a description (the pair) per change.
// - folded (a long value in a sentence): the button «Показать изменения»
//   (aria-expanded, aria-controls) and, revealed, the two values as blocks
//   labelled «Было» and «Стало».
// An empty value is the word «пусто».

const value = (context, text, part) => (text === null
  ? html`<span class=${`sf-change__${part} sf-change__empty`}>${context.words.empty}</span>`
  : html`<span class=${`sf-change__${part}`}>${text}</span>`);

const pair = (context, change) => html`${value(context, change.before, 'before')}<span class="sf-change__pair"> <span
  class="sf-change__arrow" aria-hidden="true">→</span><span class="sr-only"> ${context.words.to}</span> ${value(context, change.after, 'after')}</span>`;

const label = (context, change) => (context.showLabel && change.label
  ? html`<span class="sf-change__label">${change.label}${context.words.separator} </span>`
  : nothing);

function folded(context) {
  const {pair: change, revealed, blocksId, words, component} = context;
  return html`<span class=${['sf-change', 'sf-change--folded', revealed ? 'sf-change--revealed' : '', context.rootClass].filter(Boolean).join(' ')}>
    ${label(context, change)}<button type="button" class="sf-change__toggle" aria-expanded=${revealed ? 'true' : 'false'}
      aria-controls=${blocksId} @click=${() => component.toggleReveal()}><span>${revealed ? words.hide : words.show}</span><sf-icon
      class="sf-change__toggle-icon" icon=${revealed ? 'expand_less' : 'expand_more'} aria-hidden="true"></sf-icon></button>
    <span class="sf-change__blocks" id=${blocksId} ?hidden=${!revealed}>
      <span class="sf-change__block sf-change__block--before"><span class="sf-change__block-label">${words.before}</span>${change.before ?? words.empty}</span>
      <span class="sf-change__block sf-change__block--after"><span class="sf-change__block-label">${words.after}</span>${change.after ?? words.empty}</span>
    </span>
  </span>`;
}

export function renderChangeTemplate(context) {
  if (context.empty) return nothing;
  if (context.layout === 'list') {
    return html`<dl class=${['sf-change', 'sf-change--list', context.rootClass].filter(Boolean).join(' ')}>
      ${context.changes.map((change) => html`<div class="sf-change__row"><dt class="sf-change__term">${change.label}</dt><dd
        class="sf-change__value">${pair(context, change)}</dd></div>`)}
    </dl>`;
  }
  if (context.folded) return folded(context);
  return html`<span class=${['sf-change', 'sf-change--inline', context.rootClass].filter(Boolean).join(' ')}>${label(context, context.pair)}${pair(context, context.pair)}</span>`;
}

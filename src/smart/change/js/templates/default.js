import {html, nothing} from 'lit';

// sf-change's markup (scss/ draws it).
//
// - inline: [label: ] old value, then the arrow glued to the start of the new
//   value; the values wrap. The arrow is a picture; a visually hidden
//   word between the values says the change to a screen reader.
// - list: a dl, a term (the label) and a description (the pair) per change.
// - folded (a long value in a sentence): the button «Показать изменения»
//   (aria-expanded, aria-controls) and, revealed, the two values as blocks
//   labelled «Было» and «Стало».
// An empty value is the word «пусто».

// A short value -- a number and its unit, a phone number, a name -- stays
// whole on one line (it reads wrong broken: «4,6 / кг»); only a longer one
// wraps (dispatcher decision, C40 follow-up 2026-11-11). Whole is made by the
// text, not by nowrap: its spaces become no-break spaces and a word joiner
// (U+2060, zero width, not read aloud) follows each hyphen and dash, so the
// value stays on one line where it fits and still wraps (overflow-wrap
// anywhere) where its frame is narrower than the value -- never past the
// frame, and the arrow stays glued to the new value. A value is trimmed, so
// a padded value draws no leading gap.
export const WHOLE_VALUE_MAX = 20;
const whole = (text) => [...text].length <= WHOLE_VALUE_MAX;
const unbroken = (text) => text.replace(/ /gu, '\u00a0').replace(/([-\u2010\u2013])/gu, '$1\u2060');

const value = (context, text, part) => {
  if (text === null) return html`<span class=${`sf-change__${part} sf-change__empty`}>${context.words.empty}</span>`;
  const shown = String(text).trim();
  return whole(shown)
    ? html`<span class=${`sf-change__${part} sf-change__whole`}>${unbroken(shown)}</span>`
    : html`<span class=${`sf-change__${part}`}>${shown}</span>`;
};

// The arrow and the new value are joined by a no-break space (the hidden word
// is out of flow and makes no break), so the arrow never ends a line alone;
// both values wrap like any text.
const pair = (context, change) => html`${value(context, change.before, 'before')}<span class="sf-change__pair"> <span
  class="sf-change__arrow" aria-hidden="true">→</span><span class="sr-only"> ${context.words.to}</span>\u00a0${value(context, change.after, 'after')}</span>`;

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

import { html, nothing } from 'lit';

// sf-steps' markup (component/step draws it; owner decision C101).
//
//   .sf-steps                     the root: size, marker, layout drawn
//     ol.sf-steps-container       the ordered list, named by aria-label
//       li.sf-step                one step: its state, data-step-index,
//                                 aria-current=step on the current one; the
//                                 line to the next step is the item's own
//         .sf-step-body           a span, or a button when a person may go
//                                 there (navigation, class sf-step-control)
//           .sf-step-marker       the number, a check, «!», a dot or the
//                                 Framework spinner -- the rung's text line
//           .sf-step-content      the label (.sf-step-container), the
//                                 second line in a column (.sf-step-text)
//                                 and the state word for a screen reader
//     .sf-steps-count             the count layout: «Шаг N из M · label» over
//                                 sf-progress-bar 1/3, as sf-wizard's compact
//                                 head

function joinClasses(...tokens) {
  return tokens.flat().filter(Boolean).join(' ');
}

// A marker's glyph: done is a check, error an exclamation; the number of the
// step otherwise.
const MARK_ICONS = { done: 'check', error: 'priority_high' };

function renderMarker(item, context) {
  if (item.state === 'running') {
    // The Framework spinner at the marker's own size (the spinner's ladder is
    // the text line of each rung), centred, with no ring of its own.
    return html`<span class="sf-step-marker" aria-hidden="true"><sf-spinner size=${context.size} infinite label=""></sf-spinner></span>`;
  }
  if (context.marker === 'dot') {
    return html`<span class="sf-step-marker" aria-hidden="true"></span>`;
  }
  const icon = MARK_ICONS[item.state];
  return html`<span class="sf-step-marker" aria-hidden="true">${icon
    ? html`<i class="sf-icon">${icon}</i>`
    : String(item.index + 1)}</span>`;
}

function renderStep(item, context) {
  const classes = joinClasses(
    'sf-step',
    `sf-step--size-${context.size}`,
    `sf-step--state-${item.state}`,
    item.passed ? 'sf-step--passed' : '',
    item.disabled ? 'sf-step--disabled' : '',
  );
  const word = context.words[item.state] || '';
  const body = html`${renderMarker(item, context)}<span class="sf-step-content"><span class="sf-step-container">${item.label}</span>${item.text
    ? html`<span class="sf-step-text">${item.text}</span>`
    : nothing}${word ? html`<span class="sr-only">, ${word}</span>` : nothing}</span>`;

  return html`<li
    class=${classes}
    data-step-index=${String(item.index)}
    aria-current=${item.current ? 'step' : nothing}
  >${item.reachable
    ? html`<button type="button" class="sf-step-body sf-step-control">${body}</button>`
    : html`<span class="sf-step-body">${body}</span>`}</li>`;
}

function renderCount(context) {
  const { position, ariaLabel } = context;
  if (!position) return nothing;
  return html`<div class="sf-steps-count">
    <p class="sf-steps-count-line"><span class="sf-steps-count-position">${position.text} ·</span> <span class=${joinClasses('sf-steps-count-label', `sf-step--state-${position.state}`)}>${position.label}</span></p>
    <sf-progress-bar size="1/3" value=${String(position.value)} label=${ariaLabel} value-text=${position.text}></sf-progress-bar>
  </div>`;
}

export function renderStepsTemplate(context) {
  const rootClasses = joinClasses(
    'sf-steps',
    `sf-steps--size-${context.size}`,
    `sf-steps--marker-${context.marker}`,
    `sf-steps--layout-${context.drawn}`,
    context.layout === 'auto' ? 'sf-steps--auto' : '',
    context.done ? 'sf-steps--done' : '',
    context.rootClass,
  );

  // The steps are an ordered list (R185 ST-13): a screen reader says how many
  // there are and which one is current. role="list" is written out because a
  // list without its markers loses the role in WebKit. In the count layout the
  // list stays in the markup, out of view, so an automatic list can measure
  // whether a row fits again.
  return html`
    <div
      class=${rootClasses}
      style=${context.rootStyle || nothing}
    >
      <ol
        class="sf-steps-container"
        role="list"
        aria-label=${context.ariaLabel || nothing}
      >${context.items.map((item) => renderStep(item, context))}</ol>
      ${context.drawn === 'count' ? renderCount(context) : nothing}
    </div>
  `;
}

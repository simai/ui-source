import {html, nothing} from 'lit';

// The «?» after a field's label (owner decision C153 (8), C133's look): the
// `help` setting of every member of the field family draws sf-help-mark after
// the label text and its required mark. The mark stands a step below the
// value, as the label does -- 1/3 under the small steps, 1/2 from size 1 up --
// and each sheet holds it to the label's line, so the label row keeps its
// height. Its button is named by its subject (the component's word `help`,
// «Подробнее: {label}»). A press on it opens the explanation and never reaches
// the label row, whose own press focuses the field.

const HELP_SIZE = Object.freeze({'1/3': '1/3', '1/2': '1/3', 1: '1/2', 2: '1/2', 3: '1/2'});

/** The help mark's step for a field of `size`. */
export function fieldHelpSize(size) {
  return HELP_SIZE[size] || '1/2';
}

/** The mark's name: the component's `help` word with the label, or the mark's own default. */
export function fieldHelpLabel(component, label) {
  if (!label || typeof component?.sfWord !== 'function') return '';
  return component.sfWord('help', {vars: {label}});
}

/** sf-help-mark for `help`, or nothing without one. */
export function renderFieldHelp({help, label = '', size = '1', className = '', component = null} = {}) {
  if (!help) return nothing;
  return html`<sf-help-mark
    class=${className || nothing}
    size=${fieldHelpSize(size)}
    text=${help}
    label=${fieldHelpLabel(component, label) || nothing}
    @click=${(event) => event.stopPropagation()}
  ></sf-help-mark>`;
}

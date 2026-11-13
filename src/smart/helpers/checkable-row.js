import {html, nothing} from 'lit';
import './checkable-row.css';

// The shared base of the three choice controls, sf-checkbox, sf-radio and
// sf-switch (audit 2026-11-11 W9, owner decision C63): one text column with a
// help slot, one help mark, one row and one sheet (checkable-row.css) for the
// row's padding, the hit area, the help's size and place. The name and the
// description are linked by src/component/checkable-text-helper.js
// (linkCheckableText) for all three. Each control keeps its own class
// vocabulary (.sf-checkbox-*, .sf-radio-button-*, .sf-switch-*): the class
// markup is public and unchanged; the shared classes are .sf-checkable* on
// what the Smart elements draw.

// The help mark keeps the label's line: 1/3 beside the lines of sizes 1/2 and
// 1, 1/2 beside size 2 (the mark adds no height of its own).
export const CHECKABLE_HELP_SIZE = Object.freeze({'1/2': '1/3', 1: '1/3', 2: '1/2'});

// The help: what the help slot holds, or a «?» button (sf-help-mark) that
// opens the help setting's explanation.
export function renderCheckableHelp(context, className) {
  const component = context.component;
  if (component?.hasSlotContent?.('help')) return component.getSlotContent('help');
  if (!context.help) return '';
  return html`<sf-help-mark class=${className} size=${CHECKABLE_HELP_SIZE[context.size] || '1/3'} text=${context.help} label=${context.helpLabel || nothing}></sf-help-mark>`;
}

// The text column: the label row (the name), then the description.
//   parts.column  the column's class      (.sf-checkbox-container)
//   parts.top     the label row's class   (.sf-checkbox-top)
//   parts.wrap    a class the label text sits in inside the row, if any
export function renderCheckableText(parts, labelContent, descriptionContent) {
  if (!labelContent && !descriptionContent) return '';
  const name = parts.wrap ? html`<span class=${parts.wrap}>${labelContent}</span>` : labelContent;
  return html`<span class=${`${parts.column} flex flex-col`}>${labelContent ? html`<span class=${`${parts.top} flex`}>${name}</span>` : ''}${descriptionContent}</span>`;
}

// The classes the shared sheet reads on the control's <label>.
export function checkableClasses(size, hasText) {
  return ['sf-checkable', `sf-checkable--size-${size}`, hasText ? 'sf-checkable--text' : ''];
}

// The help mark is the label's sibling in a row, not inside the <label>
// (owner decision C59, as C33 for field labels): pressing «?» is no press on
// the control -- the label and its input never become :active, the box is not
// painted pressed and the value does not change.
export function renderCheckableRow(size, control, help) {
  if (!help) return control;
  // The help sits in a box of its own: sf-help-mark's host draws no box
  // (display: contents), so the row places this one.
  return html`<span class=${`sf-checkable-row sf-checkable--size-${size} flex flex-nowrap items-cross-start`}>${control}<span class="sf-checkable-help">${help}</span></span>`;
}

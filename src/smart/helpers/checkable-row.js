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
  sayBareHelp(context.help, component);
  return html`<sf-help-mark class=${className} size=${CHECKABLE_HELP_SIZE[context.size] || '1/3'} text=${context.help} label=${context.helpLabel || nothing}></sf-help-mark>`;
}

// The help is an explanation the «?» opens, not a label: a single lowercase
// word such as help="info" is almost always a placeholder (checks study CK-7).
// The development warning says so once per page.
const BARE_HELP_SAID = Symbol.for('sf.checkable.bare-help-said');

function sayBareHelp(help, component) {
  const global = globalThis;
  if (global[BARE_HELP_SAID] || !/^[a-z]+$/u.test(String(help).trim())) return;
  global[BARE_HELP_SAID] = true;
  const name = component?.id ? `#${component.id}` : (component?.localName || 'help');
  console.warn(`SIMAI Framework: ${name} has help="${String(help).trim()}". The help is the explanation the «?» opens: write a sentence, or leave help out.`);
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
export function renderCheckableRow(size, control, help, message = '') {
  // The help sits in a box of its own: sf-help-mark's host draws no box
  // (display: contents), so the row places this one.
  const row = help
    ? html`<span class=${`sf-checkable-row sf-checkable--size-${size} flex flex-nowrap items-cross-start`}>${control}<span class="sf-checkable-help">${help}</span></span>`
    : control;
  if (!message) return row;
  return html`<span class=${`sf-checkable-field sf-checkable--size-${size} flex flex-col`}>${row}${message}</span>`;
}

// The error line of a checkbox or a switch while it is invalid (field orders
// 2026-11-18, FO-1): what is wrong, under the control in the error role, as
// every field of the family says it (sf-input, sf-input-choice), so a host
// sets invalid and error-message on the control instead of writing a line of
// its own under it. Nothing without both. Its id joins the native input's
// aria-describedby (linkCheckableMessage).
export function renderCheckableMessage(context) {
  if (!context.invalid || !context.errorMessage) return '';
  return html`<span class="sf-checkable-message" id=${context.messageId || nothing} data-field-message="error">${context.errorMessage}</span>`;
}

// The message's id on the input's aria-describedby, and off it once the line
// is gone; ids put there by the author or the text link are kept.
export function linkCheckableMessage(host, input) {
  if (!host || !input) return;
  const line = host.querySelector('.sf-checkable-message');
  const before = String(input.getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean);
  const kept = before.filter((id) => id !== host.__sfCheckableMessageId);
  const next = line?.id ? [...kept, line.id] : kept;
  host.__sfCheckableMessageId = line?.id || '';
  if (next.join(' ') === before.join(' ')) return;
  if (next.length) input.setAttribute('aria-describedby', next.join(' '));
  else input.removeAttribute('aria-describedby');
}

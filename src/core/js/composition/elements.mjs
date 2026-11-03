// Smart elements a block prints (one block editor, 2026-11-03): a block's
// renderer may draw sf-button, sf-button-icon, sf-badge, sf-icon and the
// sf-divider class component, with attributes from their smart.manifest.json
// inputs (elements.generated.mjs) and nothing else. printElement makes the
// markup from inputs and refuses what a manifest does not take;
// checkPrintedElements reads HTML a renderer wrote by hand and reports every
// attribute those manifests do not take.
//
// An element draws itself in the browser (the Loader loads it); the HTML only
// names it. A block prints no inline style, no free classes on the element
// (root-class) and no legacy or alias names.

import { isPlainObject } from './canonical.mjs';
import { PRINTED_ELEMENT_TABLE } from './elements.generated.mjs';

export const PRINTED_ELEMENTS = Object.freeze(Object.keys(PRINTED_ELEMENT_TABLE));

// Attributes any printed element may carry beside its inputs: an editor's and
// the composition's own markers, and the host's class for its placement.
const HOST_ATTRIBUTE = /^(?:class|id|slot|data-[a-z0-9-]+)$/u;
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;

const diagnostic = (code, path, message, details = {}) => ({ code, path, message, ...details });
const escapeAttribute = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const unescape = (value) => String(value).replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

/** The inputs schema of a printed element, or null. */
export function elementInputs(name) {
  return Object.hasOwn(PRINTED_ELEMENT_TABLE, name) ? PRINTED_ELEMENT_TABLE[name].inputs : null;
}

function labelProblem(name, inputs, path) {
  // An element a reader must be able to name: a button with words or a label,
  // an icon button with its label.
  if (name === 'sf-button' && !inputs.text && !inputs['aria-label']) return diagnostic('element_label_missing', path, 'sf-button prints its text or an aria-label');
  if (name === 'sf-button-icon' && !inputs['aria-label']) return diagnostic('element_label_missing', path, 'sf-button-icon prints an aria-label');
  return null;
}

/**
 * The markup of one element from its inputs: {html, diagnostics}. `check(value,
 * schema, path, diagnostics)` is the Composition JSON Schema check. A value
 * equal to the input's default is left out; a boolean prints only when true.
 * An input the manifest does not take, or a value it refuses, prints nothing.
 */
export function printElement(name, inputs = {}, check = undefined, path = '$') {
  const entry = PRINTED_ELEMENT_TABLE[name];
  if (!Object.hasOwn(PRINTED_ELEMENT_TABLE, name)) return { html: '', diagnostics: [diagnostic('element_unknown', path, `${String(name)} is not an element a block prints; they are ${PRINTED_ELEMENTS.join(', ')}`)] };
  const diagnostics = [];
  if (!isPlainObject(inputs)) return { html: '', diagnostics: [diagnostic('element_inputs_invalid', path, 'Inputs are an object')] };
  const properties = entry.inputs.properties;
  for (const key of Object.keys(inputs)) {
    if (!Object.hasOwn(properties, key)) diagnostics.push(diagnostic('element_input_unknown', `${path}.${key}`, `${name} takes no input ${key}`, { element: name, input: key }));
  }
  // Unknown inputs are reported above, once; the schema holds the values.
  if (typeof check === 'function') check(inputs, { ...entry.inputs, additionalProperties: true }, path, diagnostics);
  const label = labelProblem(name, inputs, path);
  if (label) diagnostics.push(label);
  if (diagnostics.length) return { html: '', diagnostics };
  if (entry.kind === 'class') {
    const vertical = inputs.orientation === 'vertical';
    return { html: `<hr class="sf-divider sf-divider-${vertical ? 'vertical' : 'horizontal'}"${vertical ? ' aria-orientation="vertical"' : ''}>`, diagnostics };
  }
  const attributes = Object.keys(inputs).sort().flatMap((key) => {
    const value = inputs[key];
    if ('default' in properties[key] && value === properties[key].default) return [];
    if (typeof value === 'boolean') return value ? [` ${key}`] : [];
    return [` ${key}="${escapeAttribute(value)}"`];
  });
  return { html: `<${name}${attributes.join('')}></${name}>`, diagnostics };
}

/** The value an attribute stands for, read by the input's type. */
function attributeValue(raw, schema) {
  if (schema.type === 'boolean') return raw === undefined || raw === '' || raw === 'true' ? true : raw === 'false' ? false : raw;
  if (raw === undefined) return '';
  if (schema.type === 'integer' || schema.type === 'number') return /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(raw) ? Number(raw) : raw;
  return unescape(raw);
}

/**
 * Every printed element in HTML a renderer wrote, held to its manifest: an
 * attribute that is not an input (nor a host attribute), a value the input
 * refuses, an inline style, a missing label. Returns the diagnostics.
 */
export function checkPrintedElements(html, check = undefined, path = '$') {
  const diagnostics = [];
  if (typeof html !== 'string') return diagnostics;
  const names = PRINTED_ELEMENTS.filter((name) => PRINTED_ELEMENT_TABLE[name].kind === 'custom-element');
  const tag = new RegExp(`<(${names.join('|')})(?=[\\s>/])([^>]*)>`, 'gu');
  for (const match of html.matchAll(tag)) {
    const [, name, rest] = match;
    const at = `${path}<${name}>@${match.index}`;
    const properties = PRINTED_ELEMENT_TABLE[name].inputs.properties;
    const inputs = {};
    for (const attribute of rest.matchAll(ATTRIBUTE)) {
      const key = attribute[1].toLowerCase();
      const raw = attribute[2] ?? attribute[3] ?? attribute[4];
      if (key === 'style') diagnostics.push(diagnostic('element_inline_style', at, `${name} prints no inline style`, { element: name }));
      else if (Object.hasOwn(properties, key)) inputs[key] = attributeValue(raw, properties[key]);
      else if (!HOST_ATTRIBUTE.test(key)) diagnostics.push(diagnostic('element_input_unknown', `${at}.${key}`, `${name} takes no input ${key}`, { element: name, input: key }));
    }
    if (typeof check === 'function') check(inputs, PRINTED_ELEMENT_TABLE[name].inputs, at, diagnostics);
    const label = labelProblem(name, inputs, at);
    if (label) diagnostics.push(label);
  }
  return diagnostics;
}

export default { PRINTED_ELEMENTS, checkPrintedElements, elementInputs, printElement };

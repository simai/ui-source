import {html} from 'lit';
import {resolveField} from '../../field-renderers/templates.js';

// The short choice fields of a form drawn as a ready group of radios or checks
// (owner decision C165 (1): «sf-form рисует поля выбора через неё», names by
// the dispatcher 2026-11-14): sf-input-choice appearance="list". A choice of
// one is a column of radios, a choice of several a column of checks, up to
// three short options in a row (flow auto, C165 (3)). The form keeps its own
// label row (label, «*», «?») and hint over and under the field, as for every
// other field; the group is named by the same words (aria-label) and says its
// error itself under its last row (sf-input-choice is one of the speaking
// controls, SPEAKING_TAGS).
//
// Which fields: an editable `choice` or `choices` of at most LIST_MOST options
// (research 2026-11-14-checks.md §4: radios for one of few, 2-5 seen at once;
// a dropdown for one of many). A field that asks for its own control keeps it:
// a template other than the type's default (C302) -- `buttons` (the segmented
// group), `checklist` (the two-column checklist) -- or the former variant
// `select` (the dropdown at any length, until 2027-01-01); a read-only field
// is shown as text, as every field of the form.
export const LIST_MOST = 5;

const LIST_TYPES = new Set(['choice', 'choices']);
const DEFAULT_TEMPLATE = 'dropdown';

const typeOf = (field) => resolveField(field, {quiet: true}).type;

/** The options a field offers, those with a value. */
export function choiceOptions(field = {}) {
  const options = field.options || field.filter?.options || field.constraints?.options || [];
  return (Array.isArray(options) ? options : [])
    .filter((option) => option && option.value !== null && option.value !== undefined && String(option.value) !== '');
}

/** Whether the form draws this field as a group of radios or checks. */
export function isListChoice(field = {}) {
  if (!LIST_TYPES.has(typeOf(field)) || field.readonly === true) return false;
  const {template, former} = resolveField(field);
  if (template !== DEFAULT_TEMPLATE || former === 'select') return false;
  const count = choiceOptions(field).length;
  return count > 0 && count <= LIST_MOST;
}

/**
 * sf-input-choice appearance="list" for a choice field. The value goes back in
 * the option's own type (a chosen "2" is the 2 the option carries); a choice
 * of one is the value or null, of several the list in the options' order.
 */
export function renderChoiceList(field, value, host, {disabled = false} = {}) {
  const options = choiceOptions(field);
  const multiple = typeOf(field) === 'choices';
  const items = options.map((option) => ({
    value: String(option.value),
    label: String(option.label ?? option.text ?? option.value),
    ...(option.caption ? {caption: String(option.caption)} : {}),
    ...(option.disabled ? {disabled: true} : {}),
  }));
  const own = (text) => options.find((option) => String(option.value) === text)?.value ?? text;
  const chosen = multiple
    ? (Array.isArray(value) ? value : []).map((one) => String(one)).join(',')
    : (value === null || value === undefined ? '' : String(value));
  return html`<sf-input-choice
    appearance="list"
    name=${field.key}
    aria-label=${field.label || field.key || ''}
    ?multiple=${multiple}
    ?required=${field.required === true}
    ?disabled=${disabled}
    .items=${items}
    .value=${chosen}
    @change=${(event) => {
      const values = Array.isArray(event.detail?.values) ? event.detail.values : [];
      if (multiple) host.setFieldValue(field, values.map(own));
      else host.setFieldValue(field, values.length ? own(String(values[0])) : null);
    }}
  ></sf-input-choice>`;
}

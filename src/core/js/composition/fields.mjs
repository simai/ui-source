import { canonical, isPlainObject, stableStringify } from './canonical.mjs';

// Editor field kinds. A kind is derived from the exact host Property identity
// and the presence of choices in a simai.composition.editor-manifest.v1 field;
// the editor manifest schema is unchanged. Each kind fixes value schema,
// default, normalization, validation, accessibility, themes, localization and
// the server-rendered fallback control. Hosts keep persistence and access.

const STABLE_SEGMENT = /^[a-z][a-z0-9_]*$/u;
const INTEGER_TEXT = /^-?(?:0|[1-9][0-9]*)$/u;

export const BUILTIN_FIELD_KINDS = Object.freeze([
  {
    schema: 'simai.composition.editor-field-kind.v1',
    kind: 'choice',
    version: 1,
    status: 'formalized-existing',
    match: { property: [{ type: 'string', version: 1 }, { type: 'string', version: 2 }], choices: 'required' },
    value_schema: { type: 'string', minLength: 1 },
    default: { kind: null, field: 'must-be-a-choice' },
    constraints: { allowed: ['min_length', 'max_length'] },
    normalization: { form: 'exact-string', unset: 'absent-field', stored: 'value' },
    validation: ['choice-member'],
    accessibility: { control: 'select', role: 'combobox', name: 'label_key', description: 'help_key via aria-describedby', keyboard: ['Tab', 'ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape'] },
    themes: { modes: ['light', 'dark'], tokens: ['--sf-surface-1', '--sf-on-surface', '--sf-outline', '--sf-primary'], contrast: 'WCAG 2.2 AA' },
    localization: { label: 'label_key', help: 'help_key', value_labels: '<label_key>.<choice> when the choice is a stable segment, otherwise the raw choice', direction: 'logical' },
    server_fallback: { element: 'select', value: 'option value', enhanced_control: 'sf-dropdown' },
  },
  {
    schema: 'simai.composition.editor-field-kind.v1',
    kind: 'integer',
    version: 1,
    status: 'formalized-existing',
    match: { property: [{ type: 'integer', version: 1 }], choices: 'forbidden' },
    value_schema: { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 },
    default: { kind: null, field: 'must-satisfy-constraints' },
    constraints: { allowed: ['min', 'max'], required: ['min', 'max'] },
    normalization: { form: 'decimal-integer-text', unset: 'empty-text', stored: 'safe-integer' },
    validation: ['integer-text', 'range'],
    accessibility: { control: 'input[type=number]', role: 'spinbutton', name: 'label_key', description: 'help_key via aria-describedby', keyboard: ['Tab', 'ArrowUp', 'ArrowDown', 'digits'] },
    themes: { modes: ['light', 'dark'], tokens: ['--sf-surface-1', '--sf-on-surface', '--sf-outline', '--sf-primary'], contrast: 'WCAG 2.2 AA' },
    localization: { label: 'label_key', help: 'help_key', value_labels: 'none', direction: 'logical', digits: 'ASCII decimal' },
    server_fallback: { element: 'input', type: 'number', attributes: ['min', 'max', 'step=1', 'inputmode=numeric'], enhanced_control: 'sf-input' },
  },
  {
    schema: 'simai.composition.editor-field-kind.v1',
    kind: 'text',
    version: 1,
    status: 'new',
    match: { property: [{ type: 'string', version: 2 }], choices: 'forbidden' },
    value_schema: { type: 'string', minLength: 1, maxLength: 2000 },
    default: { kind: null, field: 'must-satisfy-constraints' },
    constraints: { allowed: ['min_length', 'max_length'], required: ['max_length'] },
    normalization: { form: 'exact-string-no-trim-no-unicode-normalization', unset: 'empty-text', stored: 'value' },
    validation: ['code-point-length', 'no-control-characters', 'well-formed-unicode'],
    accessibility: { control: 'input[type=text]', role: 'textbox', name: 'label_key', description: 'help_key via aria-describedby', keyboard: ['Tab', 'text entry'], attributes: ['dir=auto', 'maxlength'] },
    themes: { modes: ['light', 'dark'], tokens: ['--sf-surface-1', '--sf-on-surface', '--sf-outline', '--sf-primary'], contrast: 'WCAG 2.2 AA' },
    localization: { label: 'label_key', help: 'help_key', value_labels: 'none', direction: 'dir=auto per value; value is author content in the Document locale' },
    server_fallback: { element: 'input', type: 'text', attributes: ['maxlength', 'dir=auto'], enhanced_control: 'sf-input' },
  },
  {
    schema: 'simai.composition.editor-field-kind.v1',
    kind: 'toggle',
    version: 1,
    status: 'new',
    match: { property: [{ type: 'boolean', version: 1 }], choices: 'forbidden' },
    value_schema: { type: 'boolean' },
    default: { kind: false, field: 'false-or-absent' },
    constraints: { allowed: [] },
    normalization: { form: 'present-true-absent-false', unset: 'false', stored: 'true only; false removes the key' },
    validation: ['strict-boolean'],
    accessibility: { control: 'input[type=checkbox][role=switch]', role: 'switch', name: 'label_key', description: 'help_key via aria-describedby', keyboard: ['Tab', 'Space'], states: ['checked'] },
    themes: { modes: ['light', 'dark'], tokens: ['--sf-surface-1', '--sf-on-surface', '--sf-outline', '--sf-primary'], contrast: 'WCAG 2.2 AA' },
    localization: { label: 'label_key', help: 'help_key', value_labels: 'none', direction: 'logical' },
    server_fallback: { element: 'input', type: 'checkbox', attributes: ['role=switch', 'value=true'], enhanced_control: 'sf-switch' },
  },
]);

const diagnostic = (code, path, message) => ({ code, path, message });

function codePoints(value) {
  return [...value].length;
}

function wellFormed(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function hasControl(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Returns the kind manifest that governs an editor field, or null. */
export function resolveFieldKind(field, kinds = BUILTIN_FIELD_KINDS) {
  if (!isPlainObject(field?.property)) return null;
  const hasChoices = Array.isArray(field.choices);
  const matches = kinds.filter((kind) => kind.match.property.some((property) => property.type === field.property.type && property.version === field.property.version)
    && (kind.match.choices === 'required' ? hasChoices : !hasChoices));
  return matches.length === 1 ? matches[0] : null;
}

/** Checks one normalized value against its field; returns diagnostics. */
export function validateFieldValue(field, value, path = '$') {
  const kind = resolveFieldKind(field);
  if (!kind) return [diagnostic('field_kind_unknown', path, 'The field does not map to exactly one published kind')];
  const constraints = isPlainObject(field.constraints) ? field.constraints : {};
  const problems = [];
  if (kind.kind === 'choice') {
    if (typeof value !== 'string' || !field.choices.includes(value)) problems.push(diagnostic('field_value_choice', path, 'Value is not an allowed choice'));
  } else if (kind.kind === 'integer') {
    if (!Number.isSafeInteger(value)) problems.push(diagnostic('field_value_type', path, 'Value must be a safe integer'));
    else if ((Number.isInteger(constraints.min) && value < constraints.min) || (Number.isInteger(constraints.max) && value > constraints.max)) problems.push(diagnostic('field_value_range', path, 'Value is outside the allowed range'));
  } else if (kind.kind === 'text') {
    if (typeof value !== 'string') problems.push(diagnostic('field_value_type', path, 'Value must be a string'));
    else if (!wellFormed(value)) problems.push(diagnostic('field_value_unicode', path, 'Value must be well-formed Unicode'));
    else if (hasControl(value)) problems.push(diagnostic('field_value_control', path, 'Value cannot contain control characters'));
    else {
      const length = codePoints(value);
      const min = Math.max(1, Number.isInteger(constraints.min_length) ? constraints.min_length : 1);
      const max = Math.min(2000, Number.isInteger(constraints.max_length) ? constraints.max_length : 2000);
      if (length < min || length > max) problems.push(diagnostic('field_value_length', path, 'Value length is outside the allowed range'));
    }
  } else if (kind.kind === 'toggle' && typeof value !== 'boolean') {
    problems.push(diagnostic('field_value_type', path, 'Value must be a boolean'));
  }
  return problems;
}

/** Kind-specific manifest rules added on top of validateEditorManifest. */
export function validateFieldKinds(editorManifest) {
  const problems = [];
  (Array.isArray(editorManifest?.fields) ? editorManifest.fields : []).forEach((field, index) => {
    const path = `$.fields[${index}]`;
    const kind = resolveFieldKind(field);
    if (!kind) {
      problems.push(diagnostic('field_kind_unknown', path, 'The field does not map to exactly one published kind'));
      return;
    }
    const constraints = isPlainObject(field.constraints) ? field.constraints : {};
    for (const key of Object.keys(constraints)) {
      if (!kind.constraints.allowed.includes(key)) problems.push(diagnostic('field_constraint_unknown', `${path}.constraints.${key}`, `${key} is not a ${kind.kind} constraint`));
    }
    for (const key of kind.constraints.required || []) {
      if (!Number.isInteger(constraints[key])) problems.push(diagnostic('field_constraint_required', `${path}.constraints.${key}`, `${kind.kind} requires ${key}`));
    }
    if (kind.kind === 'choice') {
      const min = Number.isInteger(constraints.min_length) ? constraints.min_length : 0;
      const max = Number.isInteger(constraints.max_length) ? constraints.max_length : Infinity;
      if (min > max) problems.push(diagnostic('field_constraint_invalid', `${path}.constraints`, 'min_length must not exceed max_length'));
      for (const choice of field.choices) {
        if (typeof choice !== 'string' || codePoints(choice) < min || codePoints(choice) > max) problems.push(diagnostic('field_choice_invalid', `${path}.choices`, `${String(choice)} violates the choice constraints`));
      }
    }
    if (kind.kind === 'integer' && Number.isInteger(constraints.min) && Number.isInteger(constraints.max) && constraints.min > constraints.max) {
      problems.push(diagnostic('field_constraint_invalid', `${path}.constraints`, 'min must not exceed max'));
    }
    if (kind.kind === 'text' && Number.isInteger(constraints.min_length) && Number.isInteger(constraints.max_length) && constraints.min_length > constraints.max_length) {
      problems.push(diagnostic('field_constraint_invalid', `${path}.constraints`, 'min_length must not exceed max_length'));
    }
    if (kind.kind === 'toggle' && 'default' in field && field.default !== false) problems.push(diagnostic('field_default_invalid', `${path}.default`, 'A toggle default must be false or absent'));
    if (kind.kind !== 'toggle' && 'default' in field) problems.push(...validateFieldValue(field, field.default, `${path}.default`).map((entry) => ({ ...entry, code: 'field_default_invalid' })));
  });
  return problems;
}

/**
 * Normalizes one submitted form value. raw is the submitted string, or null
 * when the control sent nothing. Returns {value} or {unset: true} or {error}.
 */
export function parseFieldSubmission(field, raw) {
  const kind = resolveFieldKind(field);
  if (!kind) return { error: diagnostic('field_kind_unknown', '$', 'The field does not map to exactly one published kind') };
  if (raw !== null && typeof raw !== 'string') return { error: diagnostic('field_submission_invalid', '$', 'A submission must be a string or absent') };
  let value;
  if (kind.kind === 'toggle') {
    if (raw !== null && raw !== 'true') return { error: diagnostic('field_submission_invalid', '$', 'A toggle submits only true') };
    return raw === 'true' ? { value: true } : { unset: true };
  }
  if (raw === null || raw === '') return { unset: true };
  if (kind.kind === 'integer') {
    if (!INTEGER_TEXT.test(raw)) return { error: diagnostic('field_value_type', '$', 'Value must be a decimal integer') };
    value = Number(raw);
  } else {
    value = raw;
  }
  const problems = validateFieldValue(field, value);
  return problems.length ? { error: problems[0] } : { value };
}

/** Returns a new node with the field value set, or the key removed when unset. */
export function applyFieldValue(node, field, result) {
  if (!isPlainObject(result) || result.error || (result.unset !== true && !('value' in result))) {
    throw new TypeError('applyFieldValue requires a successful parseFieldSubmission result');
  }
  const next = canonical(JSON.parse(JSON.stringify(node)));
  const plane = isPlainObject(next[field.plane]) ? { ...next[field.plane] } : {};
  if (result.unset || (resolveFieldKind(field)?.kind === 'toggle' && result.value === false)) delete plane[field.target];
  else plane[field.target] = result.value;
  if (Object.keys(plane).length) next[field.plane] = plane;
  else delete next[field.plane];
  return canonical(next);
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function controlId(instance, field) {
  return `sf-field-${instance}-${field.key}`.replace(/[^A-Za-z0-9_-]/gu, '-');
}

/**
 * Server-rendered fallback control for one projected field (the output of
 * projectEditorFields plus its instance id). Works without JavaScript; the
 * submitted name is "<instance>.<destination>". Missing translations fall back
 * to the stable key text.
 */
export function renderFieldFallback(field, { instance, messages = {} } = {}) {
  const kind = resolveFieldKind(field);
  if (!kind) throw new TypeError('field_kind_unknown');
  // Hidden fields are not rendered; a form handler must skip them so that
  // their stored values stay unchanged.
  if (field.visibility === 'hidden') return '';
  const id = controlId(instance, field);
  const name = escapeHtml(`${instance}.${field.plane}.${field.target}`);
  const label = escapeHtml(messages[field.label_key] ?? field.label_key);
  const helpId = field.help_key ? `${id}-help` : null;
  const described = helpId ? ` aria-describedby="${helpId}"` : '';
  const help = helpId ? `<small class="sf-editor-field-help" id="${helpId}">${escapeHtml(messages[field.help_key] ?? field.help_key)}</small>` : '';
  const value = field.value ?? field.default ?? null;
  const constraints = field.constraints || {};
  let control;
  if (kind.kind === 'toggle') {
    control = `<input class="sf-editor-field-control" type="checkbox" role="switch" id="${id}" name="${name}" value="true"${value === true ? ' checked' : ''}${described}><label for="${id}">${label}</label>`;
  } else if (kind.kind === 'choice') {
    const options = field.choices.map((choice) => {
      const text = STABLE_SEGMENT.test(choice) ? (messages[`${field.label_key}.${choice}`] ?? choice) : choice;
      return `<option value="${escapeHtml(choice)}"${choice === value ? ' selected' : ''}>${escapeHtml(text)}</option>`;
    }).join('');
    control = `<label for="${id}">${label}</label><select class="sf-editor-field-control" id="${id}" name="${name}"${described}>${value === null ? '<option value="" selected></option>' : ''}${options}</select>`;
  } else if (kind.kind === 'integer') {
    const bounds = `${Number.isInteger(constraints.min) ? ` min="${constraints.min}"` : ''}${Number.isInteger(constraints.max) ? ` max="${constraints.max}"` : ''}`;
    control = `<label for="${id}">${label}</label><input class="sf-editor-field-control" type="number" inputmode="numeric" step="1"${bounds} id="${id}" name="${name}" value="${value === null ? '' : escapeHtml(value)}"${described}>`;
  } else {
    const max = Math.min(2000, Number.isInteger(constraints.max_length) ? constraints.max_length : 2000);
    control = `<label for="${id}">${label}</label><input class="sf-editor-field-control" type="text" dir="auto" maxlength="${max}" id="${id}" name="${name}" value="${value === null ? '' : escapeHtml(value)}"${described}>`;
  }
  const html = `<div class="sf-editor-field" data-sf-field-kind="${kind.kind}" data-sf-field-group="${escapeHtml(field.group)}">${control}${help}</div>`;
  return field.visibility === 'collapsed'
    ? `<details class="sf-editor-field-disclosure"><summary>${label}</summary>${html}</details>`
    : html;
}

export function fieldKindRegistry() {
  return JSON.parse(stableStringify({ schema: 'simai.composition.editor-field-kind-registry.v1', entries: BUILTIN_FIELD_KINDS }));
}

export default { BUILTIN_FIELD_KINDS, applyFieldValue, parseFieldSubmission, renderFieldFallback, resolveFieldKind, validateFieldKinds, validateFieldValue };

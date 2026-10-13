import { canonical, isPlainObject, stableStringify } from './canonical.mjs';

const SCHEMA = 'simai.composition.editor-manifest.v1';
const MANIFEST_FIELDS = new Set(['schema', 'type', 'type_version', 'applies_to', 'fields']);
const APPLIES_FIELDS = new Set(['views', 'presets', 'modifiers']);
const FIELD_FIELDS = new Set([
  'key', 'plane', 'target', 'property', 'constraints', 'group', 'visibility',
  'choices', 'default', 'label_key', 'help_key', 'capability_hints',
  'permission_hints', 'owner',
]);
const PROPERTY_FIELDS = new Set(['type', 'version']);
const PLANES = new Set(['props', 'data', 'presentation']);
const GROUPS = new Set(['preset', 'basic', 'advanced']);
const VISIBILITIES = new Set(['visible', 'collapsed', 'hidden']);
const PRESENTATION_TARGETS = new Set(['view', 'preset']);
const FORBIDDEN_KEYS = new Set([
  'actor', 'authorization', 'class', 'classname', 'cookie', 'endpoint', 'eval',
  'expression', 'function', 'handler', 'html', 'innerhtml', 'javascript', 'method',
  'password', 'php', 'query', 'request', 'script', 'secret', 'sql', 'token',
]);

const diagnostic = (code, path, message) => ({ code, path, message });
const stableKey = (value) => typeof value === 'string' && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/u.test(value);
const componentType = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(value);
const version = (value) => typeof value === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/u.test(value);
const owner = (value) => typeof value === 'string' && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9.-]*$/u.test(value);
const scalar = (value) => value === null
  || typeof value === 'string'
  || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value));
const forbiddenIdentity = (value) => typeof value === 'string'
  && value.split('.').some((part) => FORBIDDEN_KEYS.has(part.toLowerCase().replaceAll('-', '').replaceAll('_', '')));

function unknownFields(value, allowed, path, diagnostics) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) diagnostics.push(diagnostic('editor_unknown_field', `${path}.${key}`, `Unknown editor field ${key}`));
  }
}

function scanForbidden(value, path, diagnostics) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, `${path}[${index}]`, diagnostics));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
    if (FORBIDDEN_KEYS.has(normalized)) {
      diagnostics.push(diagnostic('editor_executable_or_secret_field_forbidden', `${path}.${key}`, `Field ${key} is not portable editor metadata`));
    }
    scanForbidden(entry, `${path}.${key}`, diagnostics);
  }
}

function propertyIdentities(propertyTypes) {
  if (propertyTypes === undefined) return null;
  const identities = new Set();
  for (const entry of propertyTypes) {
    if (typeof entry === 'string') identities.add(entry);
    else if (isPlainObject(entry)) identities.add(`${entry.type}@${entry.version}`);
  }
  return identities;
}

function validateHintList(value, path, diagnostics) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 50 || value.some((entry) => !stableKey(entry)) || new Set(value).size !== value.length) {
    diagnostics.push(diagnostic('editor_hint_list_invalid', path, 'Hints must be a bounded unique stable-key list'));
  }
}

function selectionValues(typeManifest, target) {
  if (target === 'view') return typeManifest.presentation?.views || [];
  if (target === 'preset') return typeManifest.presentation?.presets || [];
  return [];
}

function validateAppliesTo(value, typeManifest, diagnostics) {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    diagnostics.push(diagnostic('editor_applies_to_invalid', '$.applies_to', 'applies_to must be an object'));
    return;
  }
  unknownFields(value, APPLIES_FIELDS, '$.applies_to', diagnostics);
  for (const [key, registeredKey] of [['views', 'views'], ['presets', 'presets'], ['modifiers', 'modifiers']]) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key]) || value[key].length === 0 || value[key].some((entry) => typeof entry !== 'string') || new Set(value[key]).size !== value[key].length) {
      diagnostics.push(diagnostic('editor_applies_to_invalid', `$.applies_to.${key}`, `${key} must be a non-empty unique string list`));
      continue;
    }
    const registered = new Set(typeManifest.presentation?.[registeredKey] || []);
    for (const entry of value[key]) {
      if (!registered.has(entry)) diagnostics.push(diagnostic('editor_presentation_choice_unknown', `$.applies_to.${key}`, `${entry} is not registered by the type manifest`));
    }
  }
}

export function validateEditorManifest(editorManifest, typeManifest, options = {}) {
  const diagnostics = [];
  if (!isPlainObject(editorManifest)) return { valid: false, diagnostics: [diagnostic('editor_manifest_invalid', '$', 'Editor manifest must be an object')] };
  unknownFields(editorManifest, MANIFEST_FIELDS, '$', diagnostics);
  scanForbidden(editorManifest, '$', diagnostics);
  if (editorManifest.schema !== SCHEMA) diagnostics.push(diagnostic('editor_schema_unknown', '$.schema', `Expected ${SCHEMA}`));
  if (!componentType(editorManifest.type)) diagnostics.push(diagnostic('editor_type_invalid', '$.type', 'Component type is invalid'));
  if (!version(editorManifest.type_version)) diagnostics.push(diagnostic('editor_type_version_invalid', '$.type_version', 'Component type version is invalid'));
  if (!isPlainObject(typeManifest) || typeManifest.type !== editorManifest.type || typeManifest.version !== editorManifest.type_version) {
    diagnostics.push(diagnostic('editor_type_registration_mismatch', '$.type', 'Editor manifest must bind one exact registered type revision'));
  }
  validateAppliesTo(editorManifest.applies_to, typeManifest || {}, diagnostics);
  if (!Array.isArray(editorManifest.fields) || editorManifest.fields.length > 200) {
    diagnostics.push(diagnostic('editor_fields_invalid', '$.fields', 'fields must be a bounded array'));
    return { valid: false, diagnostics };
  }

  const keys = new Set();
  const destinations = new Set();
  const availablePropertyTypes = propertyIdentities(options.propertyTypes);
  editorManifest.fields.forEach((field, index) => {
    const path = `$.fields[${index}]`;
    if (!isPlainObject(field)) {
      diagnostics.push(diagnostic('editor_field_invalid', path, 'Editor field must be an object'));
      return;
    }
    unknownFields(field, FIELD_FIELDS, path, diagnostics);
    if (!stableKey(field.key)) diagnostics.push(diagnostic('editor_field_key_invalid', `${path}.key`, 'Field key must be stable'));
    else if (keys.has(field.key)) diagnostics.push(diagnostic('editor_field_key_duplicate', `${path}.key`, `Duplicate field key ${field.key}`));
    else keys.add(field.key);
    if (!PLANES.has(field.plane)) diagnostics.push(diagnostic('editor_plane_unknown', `${path}.plane`, 'Field plane is unknown'));
    if (!stableKey(field.target)) diagnostics.push(diagnostic('editor_target_invalid', `${path}.target`, 'Field target must be stable'));
    if (forbiddenIdentity(field.key)) diagnostics.push(diagnostic('editor_executable_or_secret_field_forbidden', `${path}.key`, 'Field key names executable or secret data'));
    if (forbiddenIdentity(field.target)) diagnostics.push(diagnostic('editor_executable_or_secret_field_forbidden', `${path}.target`, 'Field target names executable or secret data'));
    const destination = `${field.plane}.${field.target}`;
    if (destinations.has(destination)) diagnostics.push(diagnostic('editor_destination_duplicate', `${path}.target`, `Duplicate destination ${destination}`));
    else destinations.add(destination);
    if (!GROUPS.has(field.group)) diagnostics.push(diagnostic('editor_group_unknown', `${path}.group`, 'Field group is unknown'));
    if (!VISIBILITIES.has(field.visibility)) diagnostics.push(diagnostic('editor_visibility_unknown', `${path}.visibility`, 'Field visibility is unknown'));
    if (!stableKey(field.label_key)) diagnostics.push(diagnostic('editor_label_key_invalid', `${path}.label_key`, 'Localization key must be stable'));
    if (field.help_key !== undefined && !stableKey(field.help_key)) diagnostics.push(diagnostic('editor_help_key_invalid', `${path}.help_key`, 'Help localization key must be stable'));
    validateHintList(field.capability_hints, `${path}.capability_hints`, diagnostics);
    validateHintList(field.permission_hints, `${path}.permission_hints`, diagnostics);
    if (!owner(field.owner)) diagnostics.push(diagnostic('editor_owner_invalid', `${path}.owner`, 'Owner must be a portable owner id'));
    if (!isPlainObject(field.constraints)) diagnostics.push(diagnostic('editor_constraints_invalid', `${path}.constraints`, 'Constraints must be an object'));

    if (!isPlainObject(field.property)) diagnostics.push(diagnostic('editor_property_invalid', `${path}.property`, 'Property identity must be an object'));
    else {
      unknownFields(field.property, PROPERTY_FIELDS, `${path}.property`, diagnostics);
      if (!stableKey(field.property.type)) diagnostics.push(diagnostic('editor_property_type_invalid', `${path}.property.type`, 'Property type must be stable'));
      if (!Number.isInteger(field.property.version) || field.property.version < 1) diagnostics.push(diagnostic('editor_property_version_invalid', `${path}.property.version`, 'Property version must be positive'));
      if (availablePropertyTypes && !availablePropertyTypes.has(`${field.property.type}@${field.property.version}`)) {
        diagnostics.push(diagnostic('editor_property_registration_unknown', `${path}.property`, 'Property type and version are not registered by the host'));
      }
    }

    if (field.choices !== undefined && (!Array.isArray(field.choices) || field.choices.length === 0 || field.choices.length > 200 || field.choices.some((entry) => !scalar(entry)) || new Set(field.choices.map(stableStringify)).size !== field.choices.length)) {
      diagnostics.push(diagnostic('editor_choices_invalid', `${path}.choices`, 'Choices must be a bounded unique scalar list'));
    }
    if ('default' in field && !scalar(field.default)) diagnostics.push(diagnostic('editor_default_invalid', `${path}.default`, 'Default must be scalar'));
    if ('default' in field && Array.isArray(field.choices) && !field.choices.some((choice) => stableStringify(choice) === stableStringify(field.default))) {
      diagnostics.push(diagnostic('editor_default_choice_unknown', `${path}.default`, 'Default must be one of the allowed choices'));
    }

    if (field.plane === 'presentation') {
      if (!PRESENTATION_TARGETS.has(field.target)) diagnostics.push(diagnostic('editor_presentation_target_unsupported', `${path}.target`, 'Only view and preset are scalar editable presentation targets'));
      const registered = new Set(selectionValues(typeManifest || {}, field.target));
      for (const choice of field.choices || []) {
        if (typeof choice !== 'string' || !registered.has(choice)) diagnostics.push(diagnostic('editor_presentation_choice_unknown', `${path}.choices`, `${String(choice)} is not registered by the type manifest`));
      }
    } else if (PLANES.has(field.plane) && isPlainObject(typeManifest)) {
      const schema = field.plane === 'props' ? typeManifest.props_schema : typeManifest.data_schema;
      if (!isPlainObject(schema?.properties) || !(field.target in schema.properties)) diagnostics.push(diagnostic('editor_destination_unknown', `${path}.target`, `${destination} is not declared by the type manifest`));
    }
  });
  return { valid: diagnostics.length === 0, diagnostics };
}

function nodeValue(node, field) {
  const plane = node?.[field.plane];
  if (isPlainObject(plane) && field.target in plane) return { value: plane[field.target], source: 'node' };
  if ('default' in field) return { value: field.default, source: 'default' };
  return { value: null, source: 'unset' };
}

export function projectEditorFields(editorManifest, typeManifest, node, options = {}) {
  const checked = validateEditorManifest(editorManifest, typeManifest, options);
  if (!checked.valid) return { valid: false, fields: [], diagnostics: checked.diagnostics };
  const diagnostics = [];
  const fields = editorManifest.fields.map((field) => {
    const current = nodeValue(node, field);
    if (current.source !== 'unset' && field.choices && !field.choices.some((choice) => stableStringify(choice) === stableStringify(current.value))) {
      diagnostics.push(diagnostic('editor_choice_unknown', `node:${node?.id || ''}.${field.plane}.${field.target}`, 'Current value is not an allowed choice'));
    }
    return canonical({ ...field, destination: `${field.plane}.${field.target}`, ...current });
  });
  return { valid: diagnostics.length === 0, fields, diagnostics };
}

export function projectDocumentEditorFields(document, typeRegistry, editorManifests, options = {}) {
  const byType = new Map();
  for (const manifest of editorManifests || []) {
    const identity = `${manifest.type}@${manifest.type_version}`;
    if (byType.has(identity)) return { valid: false, instances: [], diagnostics: [diagnostic('editor_manifest_duplicate', '$', `Duplicate editor manifest ${identity}`)] };
    byType.set(identity, manifest);
  }
  const instances = [];
  const diagnostics = [];
  const visit = (node) => {
    const typeManifest = typeRegistry?.types instanceof Map ? typeRegistry.types.get(node.type) : undefined;
    if (typeManifest) {
      const editorManifest = byType.get(`${typeManifest.type}@${typeManifest.version}`);
      if (editorManifest) {
        const projected = projectEditorFields(editorManifest, typeManifest, node, options);
        diagnostics.push(...projected.diagnostics.map((entry) => ({ ...entry, instance: node.id })));
        instances.push({ id: node.id, type: node.type, fields: projected.fields });
      }
    }
    for (const children of Object.values(node.slots || {})) for (const child of children) visit(child);
  };
  if (document?.root) visit(document.root);
  return { valid: diagnostics.length === 0, instances, diagnostics };
}

export default { projectDocumentEditorFields, projectEditorFields, validateEditorManifest };

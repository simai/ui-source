// Names carry no version (owner, 2026-10-11; ui-control
// control/NAMES-WITHOUT-VERSIONS-DECISION-2026-10-11.md). A data format is
// `"schema": "simai.<name>"` with `"schema_version": <major>` beside it; the
// older form put the major in the name, `"simai.<name>.v<major>"`. Through the
// change journal's compatibility window every reader accepts both, and writers
// emit the new one. This is the one place that reads them.

const VERSIONED = /^(.+)\.v([0-9]+)$/u;

/**
 * The format a document declares, in either form: {name, version}, or null
 * when it declares none. `version` is the major, an integer; null when the
 * new form leaves schema_version out.
 */
export function readSchema(document) {
  const label = document?.schema ?? document?.schema_id;
  if (typeof label !== 'string' || !label) return null;
  const versioned = label.match(VERSIONED);
  if (versioned) return {name: versioned[1], version: Number(versioned[2]), form: 'versioned-name'};
  const version = document?.schema_version;
  return {name: label, version: Number.isInteger(version) ? version : null, form: 'name'};
}

/**
 * Whether a document is the format `name` at major `version`, in either form.
 * A schema_version beside the older label must agree with it.
 */
export function isSchema(document, name, version) {
  const read = readSchema(document);
  if (!read || read.name !== name || read.version !== version) return false;
  return document.schema_version === undefined || document.schema_version === version;
}

/** The new form of a format's fields, for a writer: {schema, schema_version}. */
export function schemaFields(name, version) {
  if (VERSIONED.test(name)) throw new TypeError(`A format name carries no version: ${name}`);
  if (!Number.isInteger(version) || version < 1) throw new TypeError(`A format's version is a whole major: ${version}`);
  return {schema: name, schema_version: version};
}

/** A document's format moved to the new form, everything else as it was. */
export function withUnversionedSchema(document) {
  const read = readSchema(document);
  if (!read || read.form === 'name') return document;
  const {schema, schema_id, schema_version, ...rest} = document;
  return {...schemaFields(read.name, read.version), ...rest};
}

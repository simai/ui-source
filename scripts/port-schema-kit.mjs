// Validates host port declarations (port.json) against the port declaration
// form, composite-host-port.v1.schema.json, strictly.
//
// ui-source has no dependencies, so this is not a general JSON Schema
// validator: it implements the keywords the port schema uses and refuses a
// schema that uses any other one, so a keyword added to the schema cannot be
// silently ignored here (the same rule as scripts/manifest-schema.mjs, which
// does not know anyOf).

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'x-simai-version', '$defs']);
const KEYWORDS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'uniqueItems',
  'enum', 'const', 'pattern', 'minLength', 'minimum', '$ref', 'anyOf',
]);

const kind = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

const matchesType = (value, type) => {
  const actual = kind(value);
  return actual === type || (type === 'number' && actual === 'integer');
};

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const pointer = (path, key) => `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** Every error of `value` against the port schema `rootSchema`, as {path, message}; empty when valid. */
export function validatePort(rootSchema, value) {
  const errors = [];
  const resolve = (ref) => {
    if (!ref.startsWith('#/$defs/')) throw new Error(`port_schema_ref_unsupported:${ref}`);
    const target = rootSchema.$defs?.[ref.slice('#/$defs/'.length)];
    if (!target) throw new Error(`port_schema_ref_missing:${ref}`);
    return target;
  };
  const check = (schema, data, path, sink) => {
    if (schema === true) return;
    if (schema === false) {
      sink.push({path, message: 'is not allowed'});
      return;
    }
    for (const key of Object.keys(schema)) {
      if (!KEYWORDS.has(key) && !ANNOTATIONS.has(key)) throw new Error(`port_schema_keyword_unsupported:${key} at ${path || '/'}`);
    }
    if (schema.$ref) {
      check(resolve(schema.$ref), data, path, sink);
    }
    if (schema.anyOf) {
      const passes = schema.anyOf.some((branch) => {
        const local = [];
        check(branch, data, path, local);
        return local.length === 0;
      });
      if (!passes) sink.push({path, message: 'matches no branch of anyOf'});
    }
    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((type) => matchesType(data, type))) {
        sink.push({path, message: `must be ${types.join(' or ')}, is ${kind(data)}`});
        return;
      }
    }
    if ('const' in schema && !same(schema.const, data)) sink.push({path, message: `must equal ${JSON.stringify(schema.const)}`});
    if (schema.enum && !schema.enum.some((option) => same(option, data))) sink.push({path, message: `must be one of ${JSON.stringify(schema.enum)}`});
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) sink.push({path, message: `is shorter than ${schema.minLength}`});
      if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(data)) sink.push({path, message: `does not match ${schema.pattern}`});
    }
    if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum) sink.push({path, message: `is below ${schema.minimum}`});
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) sink.push({path, message: `has fewer than ${schema.minItems} items`});
      if (schema.uniqueItems && new Set(data.map((item) => JSON.stringify(item))).size !== data.length) sink.push({path, message: 'has duplicate items'});
      if (schema.items !== undefined) data.forEach((item, index) => check(schema.items, item, pointer(path, index), sink));
    }
    if (kind(data) === 'object') {
      for (const key of schema.required ?? []) {
        if (!(key in data)) sink.push({path, message: `requires ${key}`});
      }
      const properties = schema.properties ?? {};
      for (const [key, child] of Object.entries(data)) {
        if (key in properties) check(properties[key], child, pointer(path, key), sink);
        else if (schema.additionalProperties !== undefined) {
          if (schema.additionalProperties === false) sink.push({path: pointer(path, key), message: 'is not declared'});
          else check(schema.additionalProperties, child, pointer(path, key), sink);
        }
      }
    }
  };
  check(rootSchema, value, '', errors);
  return errors;
}

/** The frozen copy of the port schema the live simai.composite-host-port standard pins: {standard, pin}. */
export function pinnedPortSchema(standards) {
  const live = standards.filter((standard) => standard.id === 'simai.composite-host-port');
  if (live.length !== 1) throw new Error(`expected one live simai.composite-host-port edition, found ${live.length}`);
  const pin = (live[0].uses ?? []).find((used) => used.id === 'simai.framework.composite-host-port-schema');
  if (!pin) throw new Error(`simai.composite-host-port ${live[0].version} pins no port schema`);
  return {standard: live[0], pin};
}

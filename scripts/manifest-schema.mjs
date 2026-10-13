// Validates a value against the Smart component manifest schema, strictly.
//
// ui-source has no dependencies, so this is not a general JSON Schema
// validator: it implements the keywords the manifest schema uses and refuses a
// schema that uses any other one, so a keyword added to the schema cannot be
// silently ignored here. ui-studio validates the same manifests with Ajv
// (draft 2020-12); this validator must agree with it on every manifest.

const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "x-simai-version", "$defs"]);
const KEYWORDS = new Set([
  "type", "properties", "required", "additionalProperties", "propertyNames",
  "items", "minItems", "uniqueItems", "enum", "const", "pattern", "minLength", "$ref",
]);

const kind = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
};

const matchesType = (value, type) => {
  const actual = kind(value);
  return actual === type || (type === "number" && actual === "integer");
};

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const pointer = (path, key) => `${path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;

/** Every error of `value` against `schema`, as {path, message}; empty when valid. */
export function validateWithSchema(rootSchema, value) {
  const errors = [];
  const resolve = (ref) => {
    if (!ref.startsWith("#/$defs/")) throw new Error(`manifest_schema_ref_unsupported:${ref}`);
    const target = rootSchema.$defs?.[ref.slice("#/$defs/".length)];
    if (!target) throw new Error(`manifest_schema_ref_missing:${ref}`);
    return target;
  };
  const check = (schema, data, path) => {
    if (schema === true) return;
    if (schema === false) { errors.push({path, message: "is not allowed"}); return; }
    for (const keyword of Object.keys(schema)) {
      if (!KEYWORDS.has(keyword) && !ANNOTATIONS.has(keyword)) throw new Error(`manifest_schema_keyword_unsupported:${keyword}`);
    }
    if (schema.$ref) check(resolve(schema.$ref), data, path);
    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((type) => matchesType(data, type))) {
        errors.push({path, message: `must be ${types.join(" or ")}`});
        return;
      }
    }
    if (schema.const !== undefined && !same(schema.const, data)) errors.push({path, message: `must equal ${JSON.stringify(schema.const)}`});
    if (schema.enum && !schema.enum.some((option) => same(option, data))) errors.push({path, message: `must be one of ${schema.enum.join(", ")}`});
    if (typeof data === "string") {
      if (schema.minLength !== undefined && [...data].length < schema.minLength) errors.push({path, message: `must have at least ${schema.minLength} characters`});
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(data)) errors.push({path, message: `must match ${schema.pattern}`});
    }
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) errors.push({path, message: `must have at least ${schema.minItems} items`});
      if (schema.uniqueItems && new Set(data.map((item) => JSON.stringify(item))).size !== data.length) errors.push({path, message: "must not repeat items"});
      if (schema.items !== undefined) data.forEach((item, index) => check(schema.items, item, pointer(path, index)));
    }
    if (kind(data) === "object") {
      for (const name of schema.required ?? []) {
        if (!Object.hasOwn(data, name)) errors.push({path, message: `must have ${name}`});
      }
      for (const [name, item] of Object.entries(data)) {
        if (schema.propertyNames) check(schema.propertyNames, name, pointer(path, name));
        if (schema.properties && Object.hasOwn(schema.properties, name)) {
          check(schema.properties[name], item, pointer(path, name));
        } else if (schema.additionalProperties !== undefined) {
          if (schema.additionalProperties === false) errors.push({path: pointer(path, name), message: "is not a declared property"});
          else check(schema.additionalProperties, item, pointer(path, name));
        }
      }
    }
  };
  check(rootSchema, value, "");
  return errors;
}

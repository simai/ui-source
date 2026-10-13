import { stableStringify } from './canonical.mjs';

const RECIPE_SCHEMA = 'simai.composition.recipe.v1';
const INPUTS_SCHEMA = 'simai.composition.inputs.v1';
const MANIFEST_SCHEMA = 'simai.composition.recipe-manifest.v1';
const DEPENDENCIES_SCHEMA = 'simai.composition.dependencies.v1';
const CANONICALIZATION = 'simai.recipe.canonical-json.v1';
const SAFE_INTEGER_MIN = -9007199254740991;
const SAFE_INTEGER_MAX = 9007199254740991;

export const RECIPE_DEFAULT_LIMITS = Object.freeze({
  maxRecipeBytes: 1048576,
  maxSourceBytes: 1048576,
  maxTotalSourceBytes: 8388608,
  maxInputBytes: 1048576,
  maxTotalInputBytes: 4194304,
  maxUniqueReferences: 128,
  maxInputs: 256,
  maxReferenceDepth: 16,
  maxExpansionSteps: 10000,
  maxIntermediateBytes: 4194304,
  maxOutputBytes: 1048576,
  maxOutputNodes: 2000,
  maxOutputDepth: 32,
  maxChildrenPerSlot: 500,
  maxSelectCases: 64,
});

const HARD_LIMITS = RECIPE_DEFAULT_LIMITS;
const ENTRY_FIELDS = {
  node: new Set(['id', 'node']),
  ref: new Set(['id', 'ref', 'params', 'slots', 'extensions']),
  select: new Set(['id', 'select']),
  insertSlot: new Set(['id', 'insertSlot']),
};
const NODE_FIELDS = new Set(['type', 'data', 'props', 'presentation', 'slots', 'bindings', 'extensions']);
const RECIPE_FIELDS = new Set(['schema', 'id', 'profile', 'locale', 'inputs', 'root', 'extensions']);
const INPUT_ENVELOPE_FIELDS = new Set(['schema', 'scope', 'values', 'extensions']);
const MANIFEST_FIELDS = new Set(['schema', 'id', 'parameters', 'slots', 'body', 'extensions']);
const INPUT_DECLARATION_FIELDS = new Set(['kind', 'schema', 'default', 'expectedOrigin', 'extensions']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;

function isObject(value) {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function utf8Size(value) {
  return new globalThis.TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).byteLength;
}

export function parseRecipeJson(text) {
  if (typeof text !== 'string' || text.charCodeAt(0) === 0xfeff) throw Object.assign(new SyntaxError('Invalid JSON input'), { code: 'invalid_json', sourcePath: '$' });
  let position = 0;
  const whitespace = () => { while (/\s/u.test(text[position] || '') && !['\u00a0'].includes(text[position])) position += 1; };
  const stringToken = () => {
    if (text[position] !== '"') throw new SyntaxError('Expected string');
    const start = position++;
    while (position < text.length) {
      const code = text.charCodeAt(position);
      if (code === 34) {
        position += 1;
        const value = JSON.parse(text.slice(start, position));
        for (let index = 0; index < value.length; index += 1) {
          const unit = value.charCodeAt(index);
          if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) throw new SyntaxError('Unpaired surrogate');
            index += 1;
          } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new SyntaxError('Unpaired surrogate');
        }
        return value;
      }
      if (code < 0x20) throw new SyntaxError('Control character in string');
      if (code === 92) {
        position += 1;
        if (text[position] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(position + 1, position + 5))) throw new SyntaxError('Invalid Unicode escape');
          position += 5;
          continue;
        }
        if (!/["\\/bfnrt]/u.test(text[position] || '')) throw new SyntaxError('Invalid escape');
      }
      position += 1;
    }
    throw new SyntaxError('Unterminated string');
  };
  const valueToken = () => {
    whitespace();
    if (text[position] === '{') {
      position += 1;
      whitespace();
      const keys = new Set();
      if (text[position] === '}') { position += 1; return; }
      while (position < text.length) {
        whitespace();
        const key = stringToken();
        if (keys.has(key)) throw new SyntaxError(`Duplicate key ${key}`);
        keys.add(key);
        whitespace();
        if (text[position++] !== ':') throw new SyntaxError('Expected colon');
        valueToken();
        whitespace();
        if (text[position] === '}') { position += 1; return; }
        if (text[position++] !== ',') throw new SyntaxError('Expected comma');
      }
      throw new SyntaxError('Unterminated object');
    }
    if (text[position] === '[') {
      position += 1;
      whitespace();
      if (text[position] === ']') { position += 1; return; }
      while (position < text.length) {
        valueToken();
        whitespace();
        if (text[position] === ']') { position += 1; return; }
        if (text[position++] !== ',') throw new SyntaxError('Expected comma');
      }
      throw new SyntaxError('Unterminated array');
    }
    if (text[position] === '"') { stringToken(); return; }
    const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u.exec(text.slice(position));
    if (!literal) throw new SyntaxError('Invalid JSON value');
    position += literal[0].length;
  };
  try {
    valueToken();
    whitespace();
    if (position !== text.length) throw new SyntaxError('Trailing JSON data');
    const value = JSON.parse(text);
    assertCanonicalValue(value);
    return value;
  } catch (error) {
    if (error?.code === 'invalid_value') throw error;
    throw Object.assign(new SyntaxError(error.message), { code: 'invalid_json', sourcePath: '$' });
  }
}

async function hashBytes(value) {
  if (!globalThis.crypto?.subtle) throw new Error('composition_crypto_unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recipeDigest(value) {
  assertCanonicalValue(value);
  return `sha256:${await hashBytes(stableStringify(value))}`;
}

export async function recipeNodeId(recipeId, segments) {
  return `n-${await hashBytes(stableStringify(['sf-composition-node-v1', recipeId, segments]))}`;
}

function assertCanonicalValue(value, path = '$', seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < SAFE_INTEGER_MIN || value > SAFE_INTEGER_MAX) {
      throw Object.assign(new TypeError('invalid canonical number'), { code: 'invalid_value', sourcePath: path });
    }
    return;
  }
  if (typeof value !== 'object' || (!Array.isArray(value) && !isObject(value)) || seen.has(value)) {
    throw Object.assign(new TypeError('value is not canonical JSON'), { code: 'invalid_json', sourcePath: path });
  }
  seen.add(value);
  if (Array.isArray(value)) value.forEach((entry, index) => assertCanonicalValue(entry, `${path}/${index}`, seen));
  else Object.entries(value).forEach(([key, entry]) => {
    if (/^[0-9]+$/u.test(key) && Number(key) > 4294967294) {
      // It remains a normal string key; the check intentionally documents the boundary.
    }
    assertCanonicalValue(entry, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, seen);
  });
  seen.delete(value);
}

function failure(code, sourcePath, message, referenceChain = []) {
  return { code, sourcePath, referenceChain: [...referenceChain], message };
}

function normalizeLimits(overrides = {}) {
  const limits = {};
  for (const [name, hardMaximum] of Object.entries(HARD_LIMITS)) {
    const value = overrides[name] ?? hardMaximum;
    if (!Number.isInteger(value) || value <= 0) {
      throw Object.assign(new RangeError(`Invalid limit ${name}`), { code: 'invalid_value', sourcePath: `/limits/${name}` });
    }
    if (value > hardMaximum) {
      throw Object.assign(new RangeError(`Limit ${name} exceeds the hard maximum`), { code: 'limit_exceeded', sourcePath: `/limits/${name}` });
    }
    limits[name] = value;
  }
  return limits;
}

function assertFields(value, allowed, path) {
  if (!isObject(value)) throw Object.assign(new TypeError('Expected object'), { code: 'invalid_value', sourcePath: path });
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw Object.assign(new TypeError(`Unknown field ${key}`), { code: 'unknown_field', sourcePath: `${path}/${key}` });
  }
}

function assertExtensions(extensions, path, supportedExtensions) {
  if (extensions === undefined) return;
  if (!isObject(extensions)) throw Object.assign(new TypeError('Extensions must be an object'), { code: 'invalid_value', sourcePath: path });
  for (const [name, value] of Object.entries(extensions)) {
    if (!/^[a-z][a-z0-9.-]*:[a-z][a-z0-9._-]*$/u.test(name)) throw Object.assign(new TypeError('Extension name must be namespaced'), { code: 'invalid_value', sourcePath: `${path}/${name}` });
    if (isObject(value) && value.required === true && !supportedExtensions.has(name)) throw Object.assign(new Error(`Required extension ${name} is unsupported`), { code: 'unsupported_extension', sourcePath: `${path}/${name}` });
  }
}

function assertValueExpression(expression, path) {
  if (!isObject(expression)) throw Object.assign(new TypeError('Value wrapper is required'), { code: 'invalid_value', sourcePath: path });
  const forms = ['literal', 'input', 'parameter'].filter((name) => Object.hasOwn(expression, name));
  if (forms.length !== 1 || Object.keys(expression).length !== 1) throw Object.assign(new TypeError('Value must have exactly one form'), { code: 'invalid_value', sourcePath: path });
  if (forms[0] !== 'literal' && !ID.test(expression[forms[0]] || '')) throw Object.assign(new TypeError('Value reference is invalid'), { code: 'invalid_value', sourcePath: path });
}

function entryKind(entry) {
  const kinds = ['node', 'ref', 'select', 'insertSlot'].filter((key) => Object.hasOwn(entry || {}, key));
  if (kinds.length !== 1) throw Object.assign(new TypeError('Entry must contain one form'), { code: 'invalid_value' });
  return kinds[0];
}

function validateEntrySyntax(entry, path, { insertionAllowed = false, localIds = new Set(), maxSelectCases = HARD_LIMITS.maxSelectCases, supportedExtensions = new Set() } = {}) {
  if (!isObject(entry) || !ID.test(entry.id || '')) throw Object.assign(new TypeError('Invalid entry id'), { code: 'invalid_value', sourcePath: `${path}/id` });
  const kind = entryKind(entry);
  if (kind === 'insertSlot' && !insertionAllowed) throw Object.assign(new TypeError('Insertion is only valid inside a slot'), { code: 'invalid_value', sourcePath: path });
  assertFields(entry, ENTRY_FIELDS[kind], path);
  if (localIds.has(entry.id)) throw Object.assign(new TypeError('Duplicate local id'), { code: 'duplicate_id', sourcePath: `${path}/id` });
  localIds.add(entry.id);
  if (kind === 'node') {
    assertFields(entry.node, NODE_FIELDS, `${path}/node`);
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(entry.node.type || '')) throw Object.assign(new TypeError('Node type is invalid'), { code: 'unknown_type', sourcePath: `${path}/node/type` });
    for (const [field, expressions] of Object.entries({ data: entry.node.data, props: entry.node.props, presentation: entry.node.presentation })) {
      for (const [name, expression] of Object.entries(expressions || {})) assertValueExpression(expression, `${path}/node/${field}/${name}`);
    }
    for (const [index, binding] of (entry.node.bindings || []).entries()) {
      assertFields(binding, new Set(['input', 'target']), `${path}/node/bindings/${index}`);
      if (!ID.test(binding.input || '') || !ID.test(binding.target || '')) throw Object.assign(new TypeError('Binding is invalid'), { code: 'invalid_value', sourcePath: `${path}/node/bindings/${index}` });
    }
    assertExtensions(entry.node.extensions, `${path}/node/extensions`, supportedExtensions);
    for (const [slot, children] of Object.entries(entry.node.slots || {})) {
      if (!Array.isArray(children)) throw Object.assign(new TypeError('Slot must be an array'), { code: 'invalid_value', sourcePath: `${path}/node/slots/${slot}` });
      children.forEach((child, index) => validateEntrySyntax(child, `${path}/node/slots/${slot}/${index}`, { insertionAllowed: true, localIds, maxSelectCases, supportedExtensions }));
    }
  } else if (kind === 'ref') {
    if (!isObject(entry.ref)) throw Object.assign(new TypeError('Reference is invalid'), { code: 'invalid_value', sourcePath: `${path}/ref` });
    const referenceFields = entry.ref.policy === 'pinned'
      ? new Set(['kind', 'owner', 'ref', 'policy', 'revision', 'extensions'])
      : new Set(['kind', 'owner', 'ref', 'policy', 'pointer', 'extensions']);
    assertFields(entry.ref, referenceFields, `${path}/ref`);
    if (!['template', 'fragment'].includes(entry.ref.kind) || !['pinned', 'follow-published'].includes(entry.ref.policy)) throw Object.assign(new TypeError('Reference kind or policy is invalid'), { code: 'invalid_value', sourcePath: `${path}/ref` });
    const selector = entry.ref.policy === 'pinned' ? entry.ref.revision : entry.ref.pointer;
    if (![entry.ref.owner, entry.ref.ref, selector].every((value) => typeof value === 'string' && value)) throw Object.assign(new TypeError('Reference identity is incomplete'), { code: 'invalid_value', sourcePath: `${path}/ref` });
    for (const [name, expression] of Object.entries(entry.params || {})) assertValueExpression(expression, `${path}/params/${name}`);
    assertExtensions(entry.ref.extensions, `${path}/ref/extensions`, supportedExtensions);
    assertExtensions(entry.extensions, `${path}/extensions`, supportedExtensions);
    for (const [slot, children] of Object.entries(entry.slots || {})) {
      if (!Array.isArray(children)) throw Object.assign(new TypeError('Slot must be an array'), { code: 'invalid_value', sourcePath: `${path}/slots/${slot}` });
      children.forEach((child, index) => validateEntrySyntax(child, `${path}/slots/${slot}/${index}`, { insertionAllowed: false, localIds, maxSelectCases, supportedExtensions }));
    }
  } else if (kind === 'select') {
    assertFields(entry.select, new Set(['value', 'cases', 'missingCase']), `${path}/select`);
    assertValueExpression(entry.select.value, `${path}/select/value`);
    const cases = entry.select?.cases;
    if (!isObject(cases) || Object.keys(cases).length === 0) throw Object.assign(new TypeError('Select needs cases'), { code: 'invalid_value', sourcePath: `${path}/select/cases` });
    if (Object.keys(cases).length > maxSelectCases) throw Object.assign(new RangeError('Select case limit exceeded'), { code: 'limit_exceeded', sourcePath: `${path}/select/cases` });
    if (entry.select.missingCase !== undefined && !Object.hasOwn(cases, entry.select.missingCase)) throw Object.assign(new TypeError('Missing case must name an existing case'), { code: 'invalid_value', sourcePath: `${path}/select/missingCase` });
    for (const [key, child] of Object.entries(cases)) validateEntrySyntax(child, `${path}/select/cases/${key}`, { localIds: new Set(), maxSelectCases, supportedExtensions });
  } else if (!ID.test(entry.insertSlot || '')) {
    throw Object.assign(new TypeError('Insertion slot is invalid'), { code: 'unknown_slot', sourcePath: `${path}/insertSlot` });
  }
  return kind;
}

function checkValue(value, schema, path) {
  const errors = [];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (schema.type && schema.type !== actual) errors.push(`expected ${schema.type}`);
  if (schema.const !== undefined && stableStringify(schema.const) !== stableStringify(value)) errors.push('const mismatch');
  if (schema.enum && !schema.enum.some((item) => stableStringify(item) === stableStringify(value))) errors.push('enum mismatch');
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push('string too short');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push('string too long');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push('number too small');
    if (schema.maximum !== undefined && value > schema.maximum) errors.push('number too large');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push('array too short');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push('array too long');
    if (schema.items) value.forEach((item, index) => checkValue(item, schema.items, `${path}/${index}`));
  }
  if (isObject(value)) {
    for (const name of schema.required || []) if (!Object.hasOwn(value, name)) errors.push(`missing ${name}`);
    if (schema.additionalProperties === false) for (const name of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, name)) errors.push(`unknown ${name}`);
    for (const [name, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, name)) checkValue(value[name], child, `${path}/${name}`);
  }
  if (errors.length) throw Object.assign(new TypeError(errors[0]), { code: 'invalid_value', sourcePath: path });
}

function copyExtensions(value) {
  return value === undefined ? undefined : clone(value);
}

export async function resolveRecipe(recipe, context = {}) {
  const trace = [];
  const diagnostics = [];
  const referenceChain = [];
  try {
    const limits = normalizeLimits(context.limits);
    assertCanonicalValue(recipe);
    if (utf8Size(recipe) > limits.maxRecipeBytes) throw Object.assign(new RangeError('Recipe byte limit exceeded'), { code: 'limit_exceeded', sourcePath: '$' });
    if (!isObject(recipe) || recipe.schema !== RECIPE_SCHEMA) throw Object.assign(new TypeError('Unsupported recipe schema'), { code: 'invalid_value', sourcePath: '/schema' });
    assertFields(recipe, RECIPE_FIELDS, '');
    if (!ID.test(recipe.id || '') || !['ui-layout', 'structured-content'].includes(recipe.profile)) throw Object.assign(new TypeError('Recipe identity or profile is invalid'), { code: 'invalid_value', sourcePath: '/' });
    const supportedExtensions = new Set(context.supportedExtensions || []);
    for (const [name, declaration] of Object.entries(recipe.inputs || {})) {
      assertFields(declaration, INPUT_DECLARATION_FIELDS, `/inputs/${name}`);
      if (!['parameter', 'setting', 'content'].includes(declaration.kind) || !isObject(declaration.schema)) throw Object.assign(new TypeError('Input declaration is invalid'), { code: 'invalid_value', sourcePath: `/inputs/${name}` });
      if (declaration.default) assertValueExpression(declaration.default, `/inputs/${name}/default`);
      if (declaration.default && !Object.hasOwn(declaration.default, 'literal')) throw Object.assign(new TypeError('Input default must be literal'), { code: 'invalid_value', sourcePath: `/inputs/${name}/default` });
      if (declaration.kind === 'content' && (!declaration.expectedOrigin?.owner || !declaration.expectedOrigin?.ref)) throw Object.assign(new TypeError('Content origin is required'), { code: 'input_origin_mismatch', sourcePath: `/inputs/${name}/expectedOrigin` });
      assertExtensions(declaration.extensions, `/inputs/${name}/extensions`, supportedExtensions);
    }
    assertExtensions(recipe.extensions, '/extensions', supportedExtensions);
    validateEntrySyntax(recipe.root, '/root', { localIds: new Set(), maxSelectCases: limits.maxSelectCases, supportedExtensions });
    if (Object.keys(recipe.inputs || {}).length > limits.maxInputs) throw Object.assign(new RangeError('Input limit exceeded'), { code: 'limit_exceeded', sourcePath: '/inputs' });
    const scope = context.trustedContext?.scope;
    if (typeof scope !== 'string' || !scope) throw Object.assign(new TypeError('Trusted scope is required'), { code: 'invalid_value', sourcePath: '/trustedContext/scope' });
    const inputsEnvelope = context.inputs || { schema: INPUTS_SCHEMA, scope, values: {} };
    assertCanonicalValue(inputsEnvelope, '/inputs');
    assertFields(inputsEnvelope, INPUT_ENVELOPE_FIELDS, '/inputs');
    if (inputsEnvelope.schema !== INPUTS_SCHEMA || inputsEnvelope.scope !== scope) throw Object.assign(new TypeError('Input scope mismatch'), { code: 'input_origin_mismatch', sourcePath: '/inputs' });

    const recipeHash = await recipeDigest(recipe);
    const limitsState = { steps: 0, sourceBytes: 0, inputBytes: 0, nodes: 0, intermediateBytes: 0 };
    const usedIds = new Set();
    const referenceCache = new Map();
    const inputCache = new Map();
    const references = [];
    const inputReceipts = [];
    const logicalPointers = [];

    const step = (sourcePath) => {
      limitsState.steps += 1;
      if (limitsState.steps > limits.maxExpansionSteps) throw Object.assign(new RangeError('Expansion step limit exceeded'), { code: 'limit_exceeded', sourcePath });
    };

    const readInput = async (name, sourcePath) => {
      step(sourcePath);
      if (inputCache.has(name)) return inputCache.get(name);
      const declaration = recipe.inputs?.[name];
      if (!declaration) throw Object.assign(new TypeError(`Unknown input ${name}`), { code: 'missing_input', sourcePath });
      trace.push({ operation: 'read-input', name, sourcePath });
      let supplied = inputsEnvelope.values?.[name];
      if (supplied === undefined && context.ports?.readInput) supplied = await context.ports.readInput(name, declaration, { scope });
      if (supplied?.status === 'denied') throw Object.assign(new Error('Input access denied'), { code: 'access_denied', sourcePath });
      if (supplied?.status === 'error') throw Object.assign(new Error('Input source failed'), { code: 'source_error', sourcePath });
      let result;
      if (supplied === undefined || supplied?.status === 'missing') {
        if (!declaration.default) throw Object.assign(new Error(`Input ${name} is missing`), { code: 'missing_input', sourcePath });
        const value = clone(declaration.default.literal);
        checkValue(value, declaration.schema, sourcePath);
        const valueDigest = await recipeDigest(value);
        const missingSource = supplied?.missingSource || (declaration.kind === 'parameter' ? undefined : { scope, owner: declaration.expectedOrigin?.owner, ref: declaration.expectedOrigin?.ref });
        if (declaration.kind !== 'parameter' && (!missingSource?.owner || !missingSource?.ref)) throw Object.assign(new Error('Missing source identity is required'), { code: 'input_origin_mismatch', sourcePath });
        result = { value, receipt: { name, kind: declaration.kind, valueDigest, ...(missingSource ? { missingSource } : {}), resolution: 'default' } };
      } else {
        limitsState.inputBytes += utf8Size(supplied);
        if (utf8Size(supplied) > limits.maxInputBytes || limitsState.inputBytes > limits.maxTotalInputBytes) throw Object.assign(new RangeError('Input byte limit exceeded'), { code: 'limit_exceeded', sourcePath });
        if (supplied.kind !== declaration.kind) throw Object.assign(new Error('Input kind mismatch'), { code: 'input_origin_mismatch', sourcePath });
        checkValue(supplied.value, declaration.schema, sourcePath);
        const valueDigest = await recipeDigest(supplied.value);
        if (valueDigest !== supplied.valueDigest) throw Object.assign(new Error('Input digest mismatch'), { code: 'input_digest_mismatch', sourcePath });
        const expected = declaration.expectedOrigin;
        if (declaration.kind !== 'parameter') {
          if (!supplied.origin || supplied.origin.scope !== scope || expected?.owner !== supplied.origin.owner || expected?.ref !== supplied.origin.ref || (expected?.revision && expected.revision !== supplied.origin.revision)) {
            throw Object.assign(new Error('Input origin mismatch'), { code: 'input_origin_mismatch', sourcePath });
          }
        }
        result = { value: clone(supplied.value), receipt: { name, kind: declaration.kind, valueDigest, ...(supplied.origin ? { origin: clone(supplied.origin) } : {}), resolution: 'provided' } };
      }
      inputCache.set(name, result);
      inputReceipts.push(result.receipt);
      return result;
    };

    const resolveValue = async (expression, parameters, sourcePath) => {
      step(sourcePath);
      if (!isObject(expression)) throw Object.assign(new TypeError('Value wrapper is required'), { code: 'invalid_value', sourcePath });
      if (Object.hasOwn(expression, 'literal')) return clone(expression.literal);
      if (Object.hasOwn(expression, 'input')) return (await readInput(expression.input, sourcePath)).value;
      if (Object.hasOwn(expression, 'parameter')) {
        if (!parameters.has(expression.parameter)) throw Object.assign(new Error(`Parameter ${expression.parameter} is missing`), { code: 'unknown_parameter', sourcePath });
        return clone(parameters.get(expression.parameter));
      }
      throw Object.assign(new TypeError('Unknown value wrapper'), { code: 'invalid_value', sourcePath });
    };

    const readReference = async (reference, sourcePath) => {
      step(sourcePath);
      const revisionKey = reference.policy === 'pinned' ? reference.revision : `pointer:${reference.pointer}`;
      const cacheKey = stableStringify([scope, reference.kind, reference.owner, reference.ref, revisionKey]);
      if (referenceCache.has(cacheKey)) return referenceCache.get(cacheKey);
      if (referenceCache.size >= limits.maxUniqueReferences) throw Object.assign(new RangeError('Reference limit exceeded'), { code: 'limit_exceeded', sourcePath });
      if (!context.ports?.readReference) throw Object.assign(new Error('Reference port is unavailable'), { code: 'missing_reference', sourcePath });
      trace.push({ operation: 'read-reference', kind: reference.kind, owner: reference.owner, ref: reference.ref, revision: reference.revision, pointer: reference.pointer, sourcePath });
      const response = await context.ports.readReference(reference, { scope, maxBytes: limits.maxSourceBytes });
      if (response?.status === 'denied') throw Object.assign(new Error('Reference access denied'), { code: 'access_denied', sourcePath });
      if (response?.status === 'error') throw Object.assign(new Error('Reference source failed'), { code: 'source_error', sourcePath });
      if (!response?.source) throw Object.assign(new Error('Reference not found'), { code: 'missing_reference', sourcePath });
      const revision = response.revision;
      if (reference.policy === 'pinned' && revision !== reference.revision) throw Object.assign(new Error('Reference revision mismatch'), { code: 'revision_mismatch', sourcePath });
      const bytes = utf8Size(response.source);
      limitsState.sourceBytes += bytes;
      if (bytes > limits.maxSourceBytes || limitsState.sourceBytes > limits.maxTotalSourceBytes) throw Object.assign(new RangeError('Source byte limit exceeded'), { code: 'limit_exceeded', sourcePath });
      const digest = await recipeDigest(response.source);
      if (response.digest && response.digest !== digest) throw Object.assign(new Error('Reference digest mismatch'), { code: 'revision_mismatch', sourcePath });
      const result = { source: clone(response.source), revision, digest };
      referenceCache.set(cacheKey, result);
      references.push({ kind: reference.kind, owner: reference.owner, ref: reference.ref, revision, digest, scope });
      if (reference.policy === 'follow-published') logicalPointers.push({ kind: reference.kind, owner: reference.owner, ref: reference.ref, pointer: reference.pointer, generation: response.generation, resolvedRevision: revision, scope });
      return result;
    };

    const expand = async (entry, state, sourcePath) => {
      step(sourcePath);
      const kind = entryKind(entry);
      if (kind === 'select') {
        const selected = await resolveValue(entry.select.value, state.parameters, `${sourcePath}/select/value`);
        if (typeof selected !== 'string') throw Object.assign(new Error('Select value must be a string'), { code: 'invalid_value', sourcePath: `${sourcePath}/select/value` });
        let caseName = String(selected);
        if (!Object.hasOwn(entry.select.cases, caseName)) caseName = entry.select.missingCase;
        if (!caseName || !Object.hasOwn(entry.select.cases, caseName)) throw Object.assign(new Error('Select value has no case'), { code: 'invalid_value', sourcePath });
        return expand(entry.select.cases[caseName], { ...state, segments: [...state.segments, ['select', entry.id], ['case', caseName]] }, `${sourcePath}/select/cases/${caseName}`);
      }
      if (kind === 'insertSlot') {
        const entries = state.callSlots?.[entry.insertSlot] ?? state.slotDefaults?.[entry.insertSlot] ?? [];
        const output = [];
        for (let index = 0; index < entries.length; index += 1) {
          output.push(await expand(entries[index], { ...state, segments: [...state.segments, ['insertion', entry.id], ['argument-slot', entry.insertSlot]] }, `${sourcePath}/inserted/${entry.insertSlot}/${index}`));
        }
        const expanded = output.flat();
        const slot = state.slotSpecs?.[entry.insertSlot];
        if (!slot) throw Object.assign(new Error(`Unknown insertion slot ${entry.insertSlot}`), { code: 'unknown_slot', sourcePath });
        if (expanded.length < slot.min || expanded.length > slot.max) throw Object.assign(new Error(`Slot ${entry.insertSlot} has invalid cardinality`), { code: 'invalid_value', sourcePath });
        if (slot.types?.length && expanded.some((node) => !slot.types.includes(node.type))) throw Object.assign(new Error(`Slot ${entry.insertSlot} contains a forbidden type`), { code: 'unknown_type', sourcePath });
        state.usedCallSlots?.add(entry.insertSlot);
        return expanded;
      }
      if (kind === 'ref') {
        if (referenceChain.length >= limits.maxReferenceDepth) throw Object.assign(new RangeError('Reference depth exceeded'), { code: 'limit_exceeded', sourcePath });
        const refKey = stableStringify([scope, entry.ref.kind, entry.ref.owner, entry.ref.ref, entry.ref.revision || entry.ref.pointer]);
        if (referenceChain.includes(refKey)) throw Object.assign(new Error('Reference cycle'), { code: 'reference_cycle', sourcePath });
        const resolved = await readReference(entry.ref, sourcePath);
        referenceChain.push(refKey);
        try {
          if (entry.ref.kind === 'fragment') {
            if (entry.params || entry.slots) throw Object.assign(new Error('Fragment cannot receive parameters or slots'), { code: 'invalid_value', sourcePath });
            validateEntrySyntax(resolved.source, `${sourcePath}/source`, { localIds: new Set(), maxSelectCases: limits.maxSelectCases, supportedExtensions });
            return await expand(resolved.source, { ...state, segments: [...state.segments, ['placement', entry.id]] }, `${sourcePath}/source`);
          }
          if (resolved.source.schema !== MANIFEST_SCHEMA) throw Object.assign(new Error('Template manifest is invalid'), { code: 'invalid_value', sourcePath });
          assertFields(resolved.source, MANIFEST_FIELDS, `${sourcePath}/source`);
          assertExtensions(resolved.source.extensions, `${sourcePath}/source/extensions`, supportedExtensions);
          validateEntrySyntax(resolved.source.body, `${sourcePath}/source/body`, { localIds: new Set(), maxSelectCases: limits.maxSelectCases, supportedExtensions });
          const parameters = new Map();
          for (const [name, schema] of Object.entries(resolved.source.parameters || {})) {
            const expression = entry.params?.[name] ?? schema.default;
            if (!expression) throw Object.assign(new Error(`Parameter ${name} is missing`), { code: 'unknown_parameter', sourcePath });
            const value = await resolveValue(expression, state.parameters, `${sourcePath}/params/${name}`);
            checkValue(value, schema, `${sourcePath}/params/${name}`);
            parameters.set(name, value);
          }
          for (const name of Object.keys(entry.params || {})) if (!Object.hasOwn(resolved.source.parameters || {}, name)) throw Object.assign(new Error(`Unknown parameter ${name}`), { code: 'unknown_parameter', sourcePath: `${sourcePath}/params/${name}` });
          for (const name of Object.keys(entry.slots || {})) if (!Object.hasOwn(resolved.source.slots || {}, name)) throw Object.assign(new Error(`Unknown slot ${name}`), { code: 'unknown_slot', sourcePath: `${sourcePath}/slots/${name}` });
          const defaults = Object.fromEntries(Object.entries(resolved.source.slots || {}).map(([name, spec]) => [name, spec.defaults || []]));
          for (const [name, spec] of Object.entries(resolved.source.slots || {})) {
            assertFields(spec, new Set(['min', 'max', 'types', 'defaults']), `${sourcePath}/source/slots/${name}`);
            if (!Number.isInteger(spec.min) || !Number.isInteger(spec.max) || spec.min < 0 || spec.max > limits.maxChildrenPerSlot || spec.min > spec.max) throw Object.assign(new Error(`Slot ${name} has invalid limits`), { code: 'invalid_value', sourcePath });
          }
          const usedCallSlots = new Set();
          const expanded = await expand(resolved.source.body, { ...state, parameters, callSlots: entry.slots || {}, slotDefaults: defaults, slotSpecs: resolved.source.slots || {}, usedCallSlots, segments: [...state.segments, ['placement', entry.id]] }, `${sourcePath}/source/body`);
          for (const name of Object.keys(entry.slots || {})) if (!usedCallSlots.has(name)) throw Object.assign(new Error(`Slot ${name} was not inserted`), { code: 'unknown_slot', sourcePath: `${sourcePath}/slots/${name}` });
          return expanded;
        } catch (error) {
          if (!error.referenceChain) error.referenceChain = [...referenceChain];
          throw error;
        } finally {
          referenceChain.pop();
        }
      }

      const nodePath = [...state.segments, ['node', entry.id]];
      const node = { id: await recipeNodeId(recipe.id, nodePath), type: entry.node.type };
      if (usedIds.has(node.id)) throw Object.assign(new Error('Duplicate resolved identity'), { code: 'duplicate_id', sourcePath });
      usedIds.add(node.id);
      for (const field of ['data', 'props']) {
        if (entry.node[field]) {
          node[field] = {};
          for (const [name, expression] of Object.entries(entry.node[field])) node[field][name] = await resolveValue(expression, state.parameters, `${sourcePath}/node/${field}/${name}`);
        }
      }
      if (entry.node.presentation) {
        node.presentation = {};
        for (const [name, expression] of Object.entries(entry.node.presentation)) node.presentation[name] = await resolveValue(expression, state.parameters, `${sourcePath}/node/presentation/${name}`);
      }
      if (entry.node.bindings) {
        node.bindings = [];
        for (const binding of entry.node.bindings) {
          const declaration = recipe.inputs?.[binding.input];
          if (declaration?.kind !== 'content' || !entry.node.data?.[binding.target] || entry.node.data[binding.target].input !== binding.input) throw Object.assign(new Error('Binding must match content data input'), { code: 'invalid_value', sourcePath });
          const input = await readInput(binding.input, `${sourcePath}/node/bindings/${binding.target}`);
          node.bindings.push({ owner: input.receipt.origin.owner, ref: input.receipt.origin.ref, target: binding.target, revision: input.receipt.origin.revision });
        }
      }
      if (entry.node.extensions) node.extensions = copyExtensions(entry.node.extensions);
      if (entry.node.slots) {
        node.slots = {};
        for (const [slotName, entries] of Object.entries(entry.node.slots)) {
          const children = [];
          for (let index = 0; index < entries.length; index += 1) children.push(await expand(entries[index], { ...state, segments: [...nodePath, ['slot', slotName]] }, `${sourcePath}/node/slots/${slotName}/${index}`));
          node.slots[slotName] = children.flat();
          if (node.slots[slotName].length > limits.maxChildrenPerSlot) throw Object.assign(new RangeError('Slot child limit exceeded'), { code: 'limit_exceeded', sourcePath });
        }
      }
      limitsState.nodes += 1;
      if (limitsState.nodes > limits.maxOutputNodes) throw Object.assign(new RangeError('Output node limit exceeded'), { code: 'limit_exceeded', sourcePath });
      limitsState.intermediateBytes += utf8Size(node);
      if (limitsState.intermediateBytes > limits.maxIntermediateBytes) throw Object.assign(new RangeError('Intermediate byte limit exceeded'), { code: 'limit_exceeded', sourcePath });
      return node;
    };

    const root = await expand(recipe.root, { parameters: new Map(), callSlots: {}, slotDefaults: {}, segments: [] }, '/root');
    if (Array.isArray(root)) throw Object.assign(new Error('Root must resolve to one node'), { code: 'invalid_resolved_document', sourcePath: '/root' });
    const document = { schema: 'simai.composition.document.v1', id: recipe.id, profile: recipe.profile, ...(recipe.locale ? { locale: recipe.locale } : {}), root };
    const outputDepth = (node) => 1 + Math.max(0, ...Object.values(node.slots || {}).flat().map(outputDepth));
    if (outputDepth(root) > limits.maxOutputDepth) throw Object.assign(new RangeError('Output depth limit exceeded'), { code: 'limit_exceeded', sourcePath: '/root' });
    const outputBytes = utf8Size(document);
    if (outputBytes > limits.maxOutputBytes) throw Object.assign(new RangeError('Output byte limit exceeded'), { code: 'limit_exceeded', sourcePath: '/root' });
    const { normalize } = await import('./index.mjs');
    const normalized = await normalize(document, context.registry, { limits: { maxDocumentBytes: limits.maxOutputBytes, maxDepth: limits.maxOutputDepth, maxNodes: limits.maxOutputNodes, maxChildrenPerSlot: limits.maxChildrenPerSlot }, supportedExtensions: context.supportedExtensions, ports: context.compositionPorts });
    if (!normalized.document) throw Object.assign(new Error('Resolved document is invalid'), { code: 'invalid_resolved_document', sourcePath: '/root', details: normalized.diagnostics });
    const executionContract = context.executionContract;
    if (!executionContract?.contractDigest || !executionContract?.registryDigest || !executionContract?.rendererDigest) throw Object.assign(new Error('Execution contract is required'), { code: 'invalid_value', sourcePath: '/executionContract' });
    const dependencyReceipt = {
      schema: DEPENDENCIES_SCHEMA,
      scope,
      recipeDigest: recipeHash,
      documentDigest: `sha256:${normalized.digest}`,
      references,
      inputs: inputReceipts,
      logicalPointers,
      executionContract: { ...clone(executionContract), canonicalization: CANONICALIZATION },
    };
    return { document: normalized.document, dependencyReceipt, trace, diagnostics };
  } catch (error) {
    diagnostics.push(failure(error.code || 'source_error', error.sourcePath || '$', error.message || 'Recipe resolution failed', error.referenceChain || referenceChain));
    if (error.details) diagnostics.push(...error.details.map((entry) => ({ ...entry, sourcePath: entry.path || error.sourcePath || '$' })));
    return { document: null, dependencyReceipt: null, trace, diagnostics };
  }
}

export const Recipe = Object.freeze({
  defaultLimits: RECIPE_DEFAULT_LIMITS,
  digest: recipeDigest,
  nodeId: recipeNodeId,
  parseJson: parseRecipeJson,
  resolve: resolveRecipe,
});

export default Recipe;

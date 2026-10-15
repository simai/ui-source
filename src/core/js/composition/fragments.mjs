import { isPlainObject } from './canonical.mjs';
import { VALUE_TYPES } from './routing.mjs';

// The interface fragment descriptor (simai.interface-fragment 1.0.0): checked
// here so a package gate, a page and a test read one rule. Returns the list of
// problems, empty when the descriptor holds; never coerces.
export const FRAGMENT_DESCRIPTOR_SCHEMA = 'simai.interface-fragment.v1';

const FIELDS = ['schema', 'id', 'element', 'regions', 'port', 'outputs', 'inputs', 'operation', 'url_state', 'budget'];
const ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const ELEMENT = /^[a-z][a-z0-9]*-[a-z0-9-]+$/u;
const NAME = /^[a-z][a-z0-9-]{0,31}$/u;
const STANDARD = /^[a-z][a-z0-9.-]*$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const OPERATION = /^[a-z][a-z0-9._:-]{0,127}$/u;
const URL_KEY = /^[a-z][a-z0-9_-]{0,63}$/u;

const closed = (value, allowed) => isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
const uniqueList = (value, max, test) => Array.isArray(value) && value.length <= max
  && new Set(value).size === value.length && value.every(test);

function portProblems(ports, where) {
  if (!isPlainObject(ports)) return [`${where}: not an object`];
  const names = Object.keys(ports);
  const problems = names.length > 16 ? [`${where}: more than 16 ports`] : [];
  for (const name of names) {
    const port = ports[name];
    if (!NAME.test(name)) problems.push(`${where}.${name}: name`);
    if (!closed(port, ['value', 'summary'])) { problems.push(`${where}.${name}: undeclared keys`); continue; }
    if (!Object.hasOwn(VALUE_TYPES, port.value)) problems.push(`${where}.${name}: unknown value type ${port.value}`);
    if (typeof port.summary !== 'string' || !port.summary.trim() || port.summary.length > 1000) problems.push(`${where}.${name}: summary`);
  }
  return problems;
}

export function checkFragmentDescriptor(descriptor) {
  if (!isPlainObject(descriptor)) return ['descriptor: not an object'];
  const problems = [];
  const keys = Object.keys(descriptor);
  for (const field of FIELDS) if (!keys.includes(field)) problems.push(`${field}: required`);
  for (const key of keys) if (!FIELDS.includes(key)) problems.push(`${key}: undeclared`);
  if (descriptor.schema !== FRAGMENT_DESCRIPTOR_SCHEMA) problems.push('schema: not simai.interface-fragment.v1');
  if (typeof descriptor.id !== 'string' || !ID.test(descriptor.id)) problems.push('id: a dotted identity');
  if (typeof descriptor.element !== 'string' || !ELEMENT.test(descriptor.element)) problems.push('element: a custom element name');
  if (!uniqueList(descriptor.regions, 8, (region) => typeof region === 'string' && NAME.test(region)) || !descriptor.regions.length) problems.push('regions: one to eight region names');
  const port = descriptor.port;
  if (!closed(port, ['standard', 'version']) || !STANDARD.test(port?.standard ?? '') || !VERSION.test(port?.version ?? '')) problems.push('port: {standard, version}');
  if ('outputs' in descriptor) problems.push(...portProblems(descriptor.outputs, 'outputs'));
  if ('inputs' in descriptor) problems.push(...portProblems(descriptor.inputs, 'inputs'));
  if (typeof descriptor.operation !== 'string' || !OPERATION.test(descriptor.operation)) problems.push('operation: an access operation token');
  if (!uniqueList(descriptor.url_state, 16, (key) => typeof key === 'string' && URL_KEY.test(key))) problems.push('url_state: up to sixteen query keys');
  const budget = descriptor.budget;
  if (!closed(budget, ['kb', 'first_answer_ms'])
    || !Number.isSafeInteger(budget.kb) || budget.kb < 0 || budget.kb > 2048
    || !Number.isSafeInteger(budget.first_answer_ms) || budget.first_answer_ms < 0 || budget.first_answer_ms > 10000) problems.push('budget: {kb 0-2048, first_answer_ms 0-10000}');
  return problems;
}

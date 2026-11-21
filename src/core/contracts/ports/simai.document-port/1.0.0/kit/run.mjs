// Conformance runner of simai.document-port 1.0.0 (draft 2). Dependency-free.
//
// A host adapter gives the runner three functions and nothing else:
//
//   {
//     async setup(given) {},          // put the host in the case's state (a fixture, a
//                                     // transaction, a fresh folder); given.capabilities
//                                     // is what it must announce for this case
//     async send(intent, payload) {}, // raise the intent; resolve with the answer object
//     async teardown() {},            // optional: roll the state back
//   }
//
// Usage in JavaScript:  import {runKit} from './run.mjs';
//                       const report = await runKit(adapter);
// From a shell:         node run.mjs ./my-adapter.mjs   (its default export is the adapter
//                       or a function returning one); exit code 1 when a case fails.
// A host in another language reads cases/*.json and applies the same checks; this file
// is the reading of `then` and `after` that the kit README describes.

import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));

export function loadCases(kit = KIT) {
  const manifest = JSON.parse(readFileSync(join(kit, 'manifest.json'), 'utf8'));
  const files = new Set(readdirSync(join(kit, 'cases')));
  return manifest.cases.map((id) => {
    if (!files.has(`${id}.json`)) throw new Error(`kit: case ${id} has no file`);
    return JSON.parse(readFileSync(join(kit, 'cases', `${id}.json`), 'utf8'));
  });
}

// A path is dot-separated; a segment that is a number indexes an array.
export function at(value, path) {
  let current = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = Array.isArray(current) && /^\d+$/u.test(segment) ? current[Number(segment)] : current[segment];
  }
  return current;
}

const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

// The layout.region named `name` anywhere in a document.
export function findRegion(node, name) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'layout.region' && node.props?.name === name) return node;
  for (const child of [...(node.root ? [node.root] : []), ...Object.values(node.slots ?? {}).flat()]) {
    const found = findRegion(child, name);
    if (found) return found;
  }
  return null;
}
const textsOf = (region) => (region?.slots?.default ?? []).map((node) => (node.data?.content ?? []).map((run) => run.text ?? '').join(''));

function check(answer, then, steps) {
  const failures = [];
  if (answer?.answer !== then.answer) failures.push(`answer is ${JSON.stringify(answer?.answer)}, expected ${then.answer}`);
  for (const key of then.answer_must_include ?? []) if (answer?.[key] === undefined) failures.push(`the answer carries no ${key}`);
  for (const key of then.data_must_include ?? []) if (answer?.data?.[key] === undefined) failures.push(`data carries no ${key}`);
  for (const rule of then.expect ?? []) {
    if (rule.area) {
      const region = findRegion(answer?.data?.resolved?.[rule.language], rule.area);
      if (!region) { failures.push(`resolved.${rule.language} has no area ${rule.area}`); continue; }
      const mark = region.extensions?.['simai:area'];
      for (const [key, value] of Object.entries(rule.mark ?? {})) if (!same(mark?.[key], value)) failures.push(`${rule.language} ${rule.area}: mark ${key} is ${JSON.stringify(mark?.[key])}, expected ${JSON.stringify(value)}`);
      if (rule.texts && !same(textsOf(region), rule.texts)) failures.push(`${rule.language} ${rule.area}: texts ${JSON.stringify(textsOf(region))}, expected ${JSON.stringify(rule.texts)}`);
      const listed = answer?.data?.areas?.[rule.area];
      if (listed && rule.mark && !Object.entries(rule.mark).every(([key, value]) => same(listed[key], value))) failures.push(`areas.${rule.area} disagrees with the mark in the document`);
      continue;
    }
    const value = at(answer, rule.path);
    // Reasons are codes matched exactly (draft 2): a host maps its own codes to the port's.
    if ('equals' in rule && !same(value, rule.equals)) failures.push(`${rule.path} is ${JSON.stringify(value)?.slice(0, 200)}, expected ${JSON.stringify(rule.equals).slice(0, 200)}`);
    if ('not_equals' in rule && same(value, rule.not_equals)) failures.push(`${rule.path} must not be ${JSON.stringify(rule.not_equals)}`);
    if ('not_in' in rule && rule.not_in.some((one) => same(value, one))) failures.push(`${rule.path} is ${JSON.stringify(value)}, one of ${JSON.stringify(rule.not_in)}`);
    if (rule.absent && value !== undefined) failures.push(`${rule.path} must be absent`);
    if ('at_most' in rule && !(typeof value === 'number' && value <= rule.at_most)) failures.push(`${rule.path} is ${value}, more than ${rule.at_most}`);
    if ('length' in rule && !(Array.isArray(value) && value.length === rule.length)) failures.push(`${rule.path} has ${Array.isArray(value) ? value.length : 'no'} entries, expected ${rule.length}`);
    if ('equals_step' in rule) {
      const expected = at(steps[rule.equals_step], rule.step_path);
      if (!same(value, expected)) failures.push(`${rule.path} is ${JSON.stringify(value)}, expected the ${rule.equals_step} step's ${rule.step_path} ${JSON.stringify(expected)}`);
    }
  }
  return failures;
}

// A step's payload may take values from earlier answers: when.bind maps a payload
// key to {step, path}, the step being "when" or "after.<n>" (1-based).
function payloadOf(when, steps) {
  const payload = structuredClone(when.payload ?? {});
  for (const [key, {step, path}] of Object.entries(when.bind ?? {})) {
    const value = at(steps[step], path);
    if (value === undefined) throw new Error(`bind ${key}: ${step} has no ${path}`);
    payload[key] = value;
  }
  return payload;
}

export async function runCase(adapter, kase) {
  await adapter.setup(structuredClone(kase.given));
  const failures = [];
  try {
    const steps = {};
    let answer;
    try { answer = await adapter.send(kase.when.intent, structuredClone(kase.when.payload)); }
    catch (error) { failures.push(`the host threw instead of answering: ${error?.message ?? error}`); }
    steps.when = answer;
    if (answer !== undefined) failures.push(...check(answer, kase.then, steps));
    for (const [index, step] of (kase.after ?? []).entries()) {
      let next;
      try { next = await adapter.send(step.when.intent, payloadOf(step.when, steps)); }
      catch (error) { failures.push(`after ${index + 1}: the host threw: ${error?.message ?? error}`); continue; }
      steps[`after.${index + 1}`] = next;
      failures.push(...check(next, step.then, steps).map((failure) => `after ${index + 1} (${step.when.intent}): ${failure}`));
    }
  } finally {
    await adapter.teardown?.();
  }
  return {id: kase.id, ok: failures.length === 0, failures};
}

export async function runKit(adapter, {kit = KIT, only = null} = {}) {
  const results = [];
  for (const kase of loadCases(kit)) {
    if (only && !only.includes(kase.id)) continue;
    results.push(await runCase(adapter, kase));
  }
  return {passed: results.filter((one) => one.ok).length, failed: results.filter((one) => !one.ok).length, results};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { console.error('usage: node run.mjs <adapter module>'); process.exit(2); }
  const module = await import(pathToFileURL(resolve(target)).href);
  const adapter = typeof module.default === 'function' ? await module.default() : module.default;
  const report = await runKit(adapter);
  for (const one of report.results) console.log(`${one.ok ? 'ok  ' : 'FAIL'} ${one.id}${one.ok ? '' : `\n     ${one.failures.join('\n     ')}`}`);
  console.log(`${report.passed} passed, ${report.failed} failed`);
  process.exit(report.failed ? 1 : 0);
}

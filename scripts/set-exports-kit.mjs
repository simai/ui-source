// The exports kit of standard simai.component-set 1.3.0 (owner decision D17,
// 2026-11-11): a set that gives a scripted API lists it in its passport
// (set.json exports, contracts/schema/component-set.v1.schema.json 1.1.0), and
// its browser probe holds the list against what SF.package('<set>') resolves
// to on a real page. A set's probe imports this file from the ui-source
// revision it is built over and calls checkSetExports(page, passport) on a
// page that has declared the set; an empty list is a pass.
//
//   import {checkSetExports} from '<ui-source>/scripts/set-exports-kit.mjs';
//   const problems = await checkSetExports(page, JSON.parse(readFileSync('set.json', 'utf8')));
//   if (problems.length) throw new Error(problems.join('\n'));
//
// What it holds, for the public and the internal names alike:
//   - every name the bundle exports is listed, and every listed name is
//     exported (an unlisted export is a name no page can be told about);
//   - each export is of the kind the list says (object, function, class,
//     value);
//   - every member the list names is on its export;
//   - and of the list itself: an internal name is never listed for authors, a
//     component's export names an element of this set.

// The kind of one value, as the contracts spell it.
export function kindOf(value) {
  if (typeof value === 'function') return /^class[\s{]/u.test(Function.prototype.toString.call(value)) ? 'class' : 'function';
  if (value !== null && typeof value === 'object') return 'object';
  return 'value';
}

// What a page sees: each export's kind and own enumerable or inherited
// members. Runs in the page; kindOf travels with it as source.
export async function readSetExports(page, set, {timeout = 10000} = {}) {
  return page.evaluate(async ({set, timeout, kindSource}) => {
    // eslint-disable-next-line no-new-func
    const kindOf = new Function(`return (${kindSource})`)();
    const exported = await Promise.race([
      window.SF.package(set),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error(`SF.package('${set}') did not settle in ${timeout} ms`)), timeout)),
    ]);
    const seen = {};
    for (const name of Object.keys(exported ?? {})) {
      const value = exported[name];
      const members = value !== null && (typeof value === 'object' || typeof value === 'function')
        ? [...new Set([...Object.keys(value), ...Object.getOwnPropertyNames(Object.getPrototypeOf(value) ?? {})])]
        : [];
      seen[name] = {kind: kindOf(value), members};
    }
    return seen;
  }, {set, timeout, kindSource: kindOf.toString()});
}

// The list against what the page saw; each problem is one line.
export function compareSetExports(passport, seen) {
  const problems = [];
  const listed = passport.exports ?? [];
  const elements = new Set((passport.components ?? []).map((component) => component.element));
  const names = new Set();
  for (const entry of listed) {
    const where = `${passport.id}: export ${entry.name}`;
    if (names.has(entry.name)) problems.push(`${where}: listed twice`);
    names.add(entry.name);
    if (entry.status === 'internal' && entry.audience !== 'internal') problems.push(`${where}: internal, so its audience must be internal`);
    if (entry.layer === 'component' && !elements.has(entry.component)) problems.push(`${where}: layer component names no element of this set (${entry.component ?? 'none'})`);
    if (entry.layer !== 'component' && entry.component) problems.push(`${where}: component given on layer ${entry.layer}`);
    const got = seen[entry.name];
    if (!got) { problems.push(`${where}: listed but not exported by SF.package('${passport.id}')`); continue; }
    if (got.kind !== entry.kind) problems.push(`${where}: listed as ${entry.kind}, exported as ${got.kind}`);
    for (const member of entry.members ?? []) if (!got.members.includes(member)) problems.push(`${where}: member ${member} is not there`);
  }
  for (const name of Object.keys(seen)) if (!names.has(name)) problems.push(`${passport.id}: SF.package('${passport.id}').${name} is exported but not listed in set.json exports`);
  return problems;
}

export async function checkSetExports(page, passport, options) {
  return compareSetExports(passport, await readSetExports(page, passport.id, options));
}

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [folder ...]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Gate 36 of standard simai.smart-component 1.3.9 (§7.7, §13): what a removed
// component leaves behind. Every example of every Smart component
// (src/smart/<folder>/examples.json; a component without one: its defaults)
// is put on a page built from the candidate, used a little -- the example's
// script, else open and close what opens, a focus and a pointer passing --
// and taken out of the page; then placed again (the same element) and taken
// out, then a new element is made and taken out. That cycle runs once to
// warm up (bundles a component loads late, the page's own singletons), then
// SCOPE_CYCLES times (default 4).
//
// scripts/instance-scope-page.js counts, before core.js runs, what the page
// keeps alive: listeners on the window, the document and every node still in
// the page; timers, animation frames and idle callbacks; observers that
// observe something; requests not settled whose signal is not aborted;
// elements in <body> outside the stage; the layer stack, the open surfaces,
// the language's listeners and the [lang] watch. A removed instance leaves
// nothing, so after the cycles the count is what it was after the warm-up:
// anything that grew is reported, with the bundle and line that started it.
// The attributes of <html> and <body> (a page lock, an open-surface mark)
// must also be back to what the page had before any element was placed.
//
// Placing the element again must work: its scope opens again and it draws.
//
// Exits 1 with the failures as JSON. Deterministic: no time is measured, only
// what is alive once the page has settled.
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {components, hostSpec, serveOutput, head, coreScript, repo} from '../../scripts/first-paint-lib.mjs';

const args = process.argv.slice(2);
const out = args[0] ? resolve(args[0]) : null;
if (!out || !existsSync(join(out, 'core'))) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');
const only = args.slice(1).filter((one) => !one.startsWith('--'));
const CYCLES = Number(process.env.SCOPE_CYCLES || 4);
const CONCURRENCY = Number(process.env.SCOPE_CONCURRENCY || 6);

const pageScript = readFileSync(join(repo, 'scripts', 'instance-scope-page.js'), 'utf8');
const pages = new Map([['/instance-scope-page.js', pageScript]]);
const site = await serveOutput(out, {pages, fonts: 'as-shipped'});
const browser = await chromium.launch();

// Examples given as a bare list are read too.
const examplesOf = (component) => {
  const file = join(component.dir, typeof component.manifest.examples === 'string' ? component.manifest.examples : 'examples.json');
  if (!existsSync(file)) return component.examples;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : data.examples;
  return Array.isArray(list) && list.length ? list : component.examples;
};

// Page attributes the runtime sets once for the page, whatever the element:
// the language and direction, the Loader's marks (sf-icons-loaded), the flag of
// a page-wide delegation a classic component's script binds once
// (data-sf-menu-events-bound, component/menu). An empty style attribute is a
// lock that was given back: the values are restored, the attribute stays.
const PAGE_NOISE = /^(?:class:sf-icons-loaded|lang=.*|dir=.*|style=|data-sf-[\w-]*-events-bound=true|data-sf-(?:ready|loaded|theme[\w-]*|icons?[\w-]*|core[\w-]*|utility[\w-]*|loader[\w-]*)=.*)$/u;

const keyOf = (entry) => `${entry.kind}\t${entry.what}\t${entry.owner}`;
function grown(before, after) {
  const counts = new Map();
  for (const entry of before) counts.set(keyOf(entry), (counts.get(keyOf(entry)) ?? 0) - 1);
  for (const entry of after) counts.set(keyOf(entry), (counts.get(keyOf(entry)) ?? 0) + 1);
  return [...counts].filter(([, n]) => n > 0).map(([key, n]) => {
    const [kind, what, owner] = key.split('\t');
    return {kind, what, owner, grew: n};
  });
}
// The attributes of <html> and <body> as "html name=value", a class one token at a time.
const pageAttrs = (text) => new Set(text.replace(/^html\[|\]$/gu, '').split(/\] body\[/u).flatMap((part, i) => part.split(' ').filter(Boolean)
  .map((one) => `${i ? 'body' : 'html'} ${one.startsWith('class=') ? `class:${one.slice(6)}` : one}`)));

async function probe(component, example) {
  const id = `${component.folder}/${example.name}`;
  const path = `/scope/${id}`;
  const spec = {...hostSpec(component, {...example, settings: example.settings ?? {}}), script: example.script ?? []};
  // hostSpec closes overlays for the first paint; here the example is placed as written.
  if (component.overlay && example.settings?.open === true) spec.attributes.push(['open', '']);
  pages.set(path, `${head({title: id, extra: '<script src="/instance-scope-page.js"></script>'})}<body>
<main id="stage"></main>
<script>window.__sfPageBefore = window.__sfScopeProbe.count().find((one) => one.kind === 'page').what; window.__sfScopeProbe.build(${JSON.stringify(spec).replace(/</g, '\\u003c')});</script>
${coreScript}
</body></html>`);
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  // Nothing leaves the test server: the icon font a page asks icons.simai.io
  // for arrives or not by the network, and the count must not depend on it.
  await context.route((url) => !url.href.startsWith(site.origin), (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.split('\n')[0].slice(0, 200)));
  const problems = [];
  const settle = () => page.evaluate(() => new Promise((done) => setTimeout(() => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => done())), 0), 0)));
  const frames = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const drawn = (what) => page.waitForFunction(() => window.__sfScopeProbe.drawn(), null, {timeout: 20000}).then(() => true, () => { problems.push(`${what}: it never drew`); return false; });
  const rest = async () => { await settle(); await page.waitForTimeout(200); await page.evaluate(() => window.__sfScopeProbe.quiet()); };
  const cycle = async () => {
    // The same element, placed again.
    const before = await page.evaluate(() => window.__sfScopeProbe.sizes());
    await page.evaluate(() => window.__sfScopeProbe.placeAgain());
    if (await drawn('placed again')) {
      await frames();
      for (const one of await page.evaluate((b) => window.__sfScopeProbe.placedAgainProblems(b), before)) if (!problems.includes(one)) problems.push(one);
    }
    await page.evaluate(() => window.__sfScopeProbe.interact({close: true}));
    await frames();
    await page.evaluate(() => window.__sfScopeProbe.removeHosts());
    await settle();
    // A new element, removed while open.
    await page.evaluate(() => window.__sfScopeProbe.build());
    await drawn('a new element');
    await frames();
    await page.evaluate(() => window.__sfScopeProbe.interact({close: false}));
    await frames();
    await page.evaluate(() => window.__sfScopeProbe.removeHosts());
    await settle();
  };
  try {
    await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
    if (!(await drawn('placed'))) return {id, problems, errors, leaks: []};
    await frames();
    await page.evaluate(() => window.__sfScopeProbe.interact({close: false}));
    await frames();
    await page.evaluate(() => window.__sfScopeProbe.removeHosts());
    await settle();
    await cycle();
    await rest();
    const base = await page.evaluate(() => window.__sfScopeProbe.count());
    for (let i = 0; i < CYCLES; i += 1) await cycle();
    await rest();
    const after = await page.evaluate(() => window.__sfScopeProbe.count());
    const leaks = grown(base.filter((one) => one.kind !== 'page'), after.filter((one) => one.kind !== 'page'));
    // The page itself: back to what it was before any element was placed.
    const was = pageAttrs(await page.evaluate(() => window.__sfPageBefore));
    const now = pageAttrs(after.find((one) => one.kind === 'page').what);
    const left = [...now].filter((one) => !was.has(one) && !PAGE_NOISE.test(one.replace(/^(html|body) /u, '')));
    if (left.length) leaks.push({kind: 'page', what: left.join(' '), owner: 'page', grew: 1});
    if (process.env.SCOPE_DEBUG) console.error(id, JSON.stringify(after.filter((one) => one.kind !== 'page' && !/^core\/js\/core/u.test(one.owner) && !(one.kind === 'listener' && /^<(link|script)>/u.test(one.what))), null, 0));
    return {id, problems, errors, leaks};
  } catch (error) {
    problems.push(String(error?.message ?? error).split('\n')[0].slice(0, 200));
    return {id, problems, errors, leaks: []};
  } finally {
    await context.close();
    pages.delete(path);
  }
}

const jobs = [];
for (const component of components(undefined, only)) {
  for (const example of examplesOf(component)) jobs.push([component, example]);
}
const results = [];
let next = 0;
await Promise.all(Array.from({length: Math.min(CONCURRENCY, jobs.length)}, async () => {
  while (next < jobs.length) {
    const [component, example] = jobs[next++];
    results.push(await probe(component, example));
  }
}));
await browser.close();
await site.close();

results.sort((a, b) => a.id.localeCompare(b.id));
const failed = results.filter((one) => one.leaks.length || one.problems.length);
const byKind = {};
for (const one of failed) {
  for (const leak of one.leaks) byKind[leak.kind] = (byKind[leak.kind] ?? 0) + 1;
  if (one.problems.length) byKind.placing = (byKind.placing ?? 0) + 1;
}
console.log(JSON.stringify({
  gate: 'simai.smart-component 1.3.9 gate 36: the instance scope',
  cycles: CYCLES,
  examples: results.length,
  passed: results.length - failed.length,
  failedComponents: [...new Set(failed.map((one) => one.id.split('/')[0]))],
  byKind,
  failed: failed.map(({id, leaks, problems, errors}) => ({id, leaks, problems, ...(errors.length ? {errors: [...new Set(errors)].slice(0, 3)} : {})})),
}, null, 1));
process.exit(failed.length ? 1 : 0);

#!/usr/bin/env node
// Usage: node scripts/snapshot-first-paint.mjs <build output root> [--check] [--config=<file>] [folder ...]
//
// The first paint of every Smart component, as a build snapshot (standard
// simai.smart-component 1.3.8 §5.4; owner decision 2026-10-27). Each example
// of src/smart/<folder>/examples.json (a component without one: its
// defaults) is rendered in a headless browser from the built output with the
// real Loader, and its rendered DOM is written as static markup:
//
//   static/<template>/<example>.html           the host with its static markup
//   static/<template>/<example>.skeleton.html  for a component with late data:
//                                              every text a bar, every image a
//                                              fill, values cleared; the late
//                                              settings left out (they arrive)
//   static/sheets.json                         the sheets the markup needs
//
// A component that declares a skeleton.html (presentation.skeleton.file) gets
// that template, filled from the example's settings, in place of the derived
// skeleton: it overrides the snapshot where the snapshot is wrong.
//
// A component fed through a host port gets its port's answers in phase 3 of
// the gate (an example's `port`, first-paint-lib.mjs portOf); its snapshot is
// taken before any port is handed over, as a page prints it.
//
// A component package declares its build output with --config=<file> or
// FIRST_PAINT_CONFIG (first-paint-lib.mjs readConfig).
//
// The snapshots are committed, so the builder and CI need no browser. With
// --check nothing is written and the run fails when a committed snapshot is
// not what this build renders (stale) or is missing. --fresh writes the
// sheet lists anew instead of keeping what they held.
//
// Playwright: the `playwright` package, else /Users/rim/node_modules. Browsers:
// PLAYWRIGHT_BROWSERS_PATH (the release probes keep theirs in
// <GitHub>/.playwright-browsers).
import {mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {components, assemblies, describe, hostSpec, exampleFiles, serveOutput, head, coreScript, repo, smartRoot, partFolder, assemblyModule, givesLateData, fontsReady, sizeProblem} from './first-paint-lib.mjs';
import {renderSkeletonTemplate, renderPartSkeleton} from './first-paint-skeleton.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = args.find((one) => !one.startsWith('--') && existsSync(one) && existsSync(join(one, 'core')));
if (!out) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');
const check = args.includes('--check');
const only = args.filter((one) => !one.startsWith('--') && one !== out);
const concurrency = Number(process.env.FIRST_PAINT_CONCURRENCY || 6);

const {chromium} = await import('playwright').catch(() => import('/Users/rim/node_modules/playwright/index.mjs'));
const pageScript = readFileSync(join(here, 'first-paint-page.js'), 'utf8');

const pages = new Map([['/first-paint-page.js', pageScript]]);
const site = await serveOutput(out, {pages});
const browser = await chromium.launch();
const results = {written: [], stale: [], missing: [], failed: [], tooLarge: [], unchanged: 0, sheetDrift: []};

async function snapshot(component, example) {
  const id = `${component.folder}/${example.name}`;
  const path = `/page/${id}`;
  const spec = {...hostSpec(component, example), late: component.late};
  pages.set(path, `${head({title: id, extra: '<script src="/first-paint-page.js"></script>'})}<body>
<main id="stage"></main>
<script>window.__sfFirstPaintBuild(${JSON.stringify(spec).replace(/</g, '\\u003c')});</script>
${coreScript}
</body></html>`);
  // The sheets this page asks for: the first paint needs every one.
  const sheets = [];
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let inflight = 0;
  let last = Date.now();
  page.on('request', (request) => {
    inflight += 1;
    last = Date.now();
    const url = new URL(request.url());
    if (url.pathname.endsWith('.css')) sheets.push(url.pathname);
  });
  const settle = () => { inflight -= 1; last = Date.now(); };
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
  try {
    await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
    // Drawn; a closed overlay draws nothing until it opens (its first paint
    // is what it has then, often nothing).
    await page.waitForFunction((overlay) => {
      const host = window.__sfFirstPaintHost;
      if (!host || !customElements.get(host.localName)) return false;
      if (window.__sfFirstPaintHosts.some((one) => 'isRendered' in one && !overlay && one.isRendered !== true)) return false;
      if (overlay) return host.hasAttribute('data-sf-started') || !host.constructor.manifest;
      return 'isRendered' in host ? host.isRendered === true : true;
    }, component.overlay, {timeout: 20000});
    // Measured in Inter, never the fallback (first-paint-lib.mjs measuredFonts).
    await page.evaluate(fontsReady);
    const quiet = Date.now() + 15000;
    while ((inflight > 0 || Date.now() - last < 600) && Date.now() < quiet) await new Promise((settle) => setTimeout(settle, 50));
    // Settled: three snapshots 250 ms apart agree (a measured style, such as
    // the composition overlay's clip-path, takes a while on a loaded machine).
    const prefix = `sf-${component.folder}-${example.name}`.replace(/[^a-z0-9-]/giu, '-');
    let html = '';
    let agreed = 0;
    for (let tries = 0; tries < 16 && agreed < 2; tries += 1) {
      await page.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle))));
      const next = await page.evaluate((prefix) => window.__sfFirstPaintSerialize({prefix}), prefix);
      agreed = next === html ? agreed + 1 : 0;
      html = next;
      await page.waitForTimeout(250);
    }
    let skeleton = null;
    // A skeleton stands for data the example gives late: an example that
    // gives none of the late settings (a tree of item elements) has none, and
    // neither has one that gives an empty list -- that is the empty state,
    // data that has arrived (element-manifest.js sfAwaitingData).
    if (givesLateData(component, example)) {
      skeleton = component.skeletonFile
        ? renderSkeletonTemplate(component, example, html)
        : await page.evaluate((prefix) => window.__sfFirstPaintSerialize({skeleton: true, prefix}), prefix);
    }
    // A sheet the Loader asks for a moment later (a utility its idle scan
    // finds) belongs to the first paint too: the list is taken once the page
    // has been idle and then quiet again.
    const settled = Date.now() + 10000;
    await page.evaluate(() => new Promise((settle) => requestIdleCallback(() => requestIdleCallback(settle, {timeout: 3000}), {timeout: 3000})));
    await new Promise((settle) => setTimeout(settle, 400));
    while ((inflight > 0 || Date.now() - last < 600) && Date.now() < settled) await new Promise((settle) => setTimeout(settle, 50));
    return {html, skeleton, sheets: [...new Set(sheets)], errors};
  } finally {
    await context.close();
    pages.delete(path);
  }
}

async function snapshotAssembly(assembly, layout, example) {
  const id = `${assembly.folder}/${layout}/${example.name}`;
  const path = `/assembly/${id}`;
  const spec = {...hostSpec(assembly, example), late: []};
  if (Object.keys(spec.island).length) throw new Error(`${id}: an assembly's list settings come after the first paint (example.late), not in its settings`);
  spec.attributes.unshift(['id', example.name]);
  if (layout !== 'default') spec.attributes.push(['layout', layout]);
  pages.set(path, `${head({title: id, extra: '<script src="/first-paint-page.js"></script>'})}<body>
<main id="stage"></main>
<script>window.__sfFirstPaintBuild(${JSON.stringify(spec).replace(/</g, '\\u003c')});</script>
${coreScript}
${assemblyModule(assembly)}
</body></html>`);
  const sheets = [];
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('.css')) sheets.push(url.pathname);
  });
  try {
    await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
    await page.waitForFunction(() => {
      const host = window.__sfFirstPaintHost;
      if (!window.__sfAssemblyDefined || !host?.sfCore) return false;
      const parts = [...host.querySelectorAll('[data-sf-role]')];
      return parts.length > 0 && parts.every((part) => customElements.get(part.localName) && (!('isRendered' in part) || part.isRendered));
    }, null, {timeout: 20000});
    // Measured in Inter, never the fallback (first-paint-lib.mjs measuredFonts).
    await page.evaluate(fontsReady);
    await page.waitForLoadState('networkidle');
    const prefix = `sf-${assembly.folder}-${example.name}`;
    let got = null;
    for (let tries = 0; tries < 8; tries += 1) {
      await page.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle))));
      const next = await page.evaluate((prefix) => window.__sfFirstPaintSerializeAssembly({prefix}), prefix);
      if (got && next.html === got.html) break;
      got = next;
      await page.waitForTimeout(150);
    }
    let html = got.html;
    for (const part of got.skeletons) {
      const component = describe(smartRoot, partFolder(part.tag));
      html = html.replace(`<!--sf-first-paint-skeleton ${part.role}-->`, () => renderPartSkeleton(component, part));
    }
    return {html, sheets: [...new Set(sheets)], errors, skeletons: got.skeletons.map((part) => part.role)};
  } finally {
    await context.close();
    pages.delete(path);
  }
}

const header = (component, example, kind) => `<!-- ${component.tag}, example «${example.name}»: the ${kind} (standard simai.smart-component 1.3.8 §5.4). Generated by scripts/snapshot-first-paint.mjs from the built output; do not edit, run it again. -->\n`;

function compare(file, body, example = null) {
  // The size gate: a first paint over its budget fails, in both modes.
  const large = example && sizeProblem(example, Buffer.byteLength(body));
  if (large) results.tooLarge.push(`${relative(repo, file)}: ${large}`);
  if (check) {
    if (!existsSync(file)) results.missing.push(relative(repo, file));
    else if (readFileSync(file, 'utf8') !== body) {
      results.stale.push(relative(repo, file));
      // What this run rendered, to compare (FIRST_PAINT_STALE_DIR).
      if (process.env.FIRST_PAINT_STALE_DIR) {
        const copy = join(process.env.FIRST_PAINT_STALE_DIR, relative(repo, file));
        mkdirSync(dirname(copy), {recursive: true});
        writeFileSync(copy, body);
      }
    }
    else results.unchanged += 1;
    return;
  }
  if (existsSync(file) && readFileSync(file, 'utf8') === body) { results.unchanged += 1; return; }
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, body);
  results.written.push(relative(repo, file));
}

const all = components(undefined, only);
const queue = all.flatMap((component) => component.examples.filter((example) => example.template !== 'skeleton').map((example) => ({component, example})));
const byComponent = new Map(all.map((component) => [component.folder, {component, sheets: new Set(), examples: {}, files: new Set()}]));

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const {component, example} = job;
    const entry = byComponent.get(component.folder);
    try {
      const files = exampleFiles(component, example);
      let got = await snapshot(component, example);
      // A check renders a differing example again before it calls it stale:
      // one render on a loaded machine can be taken before the page settled.
      for (let again = 0; check && again < 2 && existsSync(files.html)
        && readFileSync(files.html, 'utf8') !== `${header(component, example, 'static markup')}${got.html}\n`; again += 1) {
        got = await snapshot(component, example);
      }
      if (got.errors.length) throw new Error(got.errors.join('; '));
      compare(files.html, `${header(component, example, 'static markup')}${got.html}\n`, example);
      entry.files.add(files.html);
      if (got.skeleton) {
        compare(files.skeleton, `${header(component, example, component.skeletonFile ? 'skeleton, from skeleton.html' : 'skeleton, derived')}${got.skeleton}\n`, example);
        entry.files.add(files.skeleton);
      }
      const sheets = got.sheets.map((path) => path.replace(/^\/distr\//u, '')).sort();
      sheets.forEach((one) => entry.sheets.add(one));
      entry.examples[example.name] = sheets;
    } catch (error) {
      results.failed.push({example: `${component.folder}/${example.name}`, error: String(error.message ?? error).slice(0, 400)});
      // A failed example is not a gone one: its committed files stay.
      const files = exampleFiles(component, example);
      entry.files.add(files.html).add(files.skeleton);
    }
  }
}

// The assemblies, one after the other: few, and each starts all its parts.
const composedAssemblies = assemblies(only);
async function assemblyWork() {
  for (const assembly of composedAssemblies) {
    const entry = {component: assembly, sheets: new Set(), examples: {}, files: new Set()};
    byComponent.set(`assembly:${assembly.folder}`, entry);
    for (const layout of Object.keys(assembly.layouts)) {
      for (const example of assembly.examples) {
        try {
          const got = await snapshotAssembly(assembly, layout, example);
          if (got.errors.length) throw new Error(got.errors.join('; '));
          const file = join(assembly.dir, 'static', layout, `${example.name}.html`);
          const note = got.skeletons.length ? `; skeletons for ${got.skeletons.join(', ')}` : '';
          compare(file, `<!-- ${assembly.tag}, layout «${layout}», example «${example.name}»: the composed first paint (standard simai.smart-component 1.3.8 §7.3${note}). Generated by scripts/snapshot-first-paint.mjs from the built output; do not edit, run it again. -->\n${got.html}\n`, example);
          entry.files.add(file);
          const sheets = got.sheets.map((path) => path.replace(/^\/distr\//u, '')).sort();
          sheets.forEach((one) => entry.sheets.add(one));
          entry.examples[layout === 'default' ? example.name : `${layout}/${example.name}`] = sheets;
        } catch (error) {
          results.failed.push({example: `${assembly.folder}/${layout}/${example.name}`, error: String(error.message ?? error).slice(0, 400)});
        }
      }
    }
  }
}

try {
  await Promise.all([...Array.from({length: concurrency}, worker), assemblyWork()]);
} finally {
  await browser.close();
  await site.close();
}

// The Loader's idle scan may ask for a utility sheet a moment later on one
// run and not on another (sf-sortable's headers utility, under load). A sheet
// it asked for once is kept: a sheet too many costs a server one request, a
// sheet too few draws the first paint wrong. So the committed list keeps what
// it held, and --check fails on a component or Smart sheet the committed list
// lacks; a utility sheet it lacks is reported under sheetDrift.
const keptSheets = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
};
for (const {component, sheets, examples, files} of byComponent.values()) {
  if (!Object.keys(examples).length) continue;
  const committed = keptSheets(join(component.dir, 'static', 'sheets.json'));
  sheets.clear();
  for (const [name, list] of Object.entries(examples)) {
    const before = committed?.examples?.[name] ?? [];
    const missing = list.filter((one) => !before.includes(one));
    // A utility sheet only the idle scan asked for is reported, not failed:
    // whether the scan ran before the page was taken is the machine's timing.
    const drift = missing.filter((one) => one.startsWith('utility/'));
    if (drift.length) results.sheetDrift.push(`${component.folder}/${name}: ${drift.join(', ')}`);
    if (check && missing.length === drift.length && before.length) examples[name] = before;
    else if (!check && process.argv.includes('--fresh') === false) examples[name] = [...new Set([...list, ...before])].sort();
    examples[name].forEach((one) => sheets.add(one));
  }
  const order = Object.fromEntries(Object.keys(examples).sort().map((name) => [name, examples[name]]));
  const body = `${JSON.stringify({
    $comment: `The sheets the first paint of ${component.tag} needs, as the Loader asked for them while each example was rendered (standard simai.smart-component 1.3.8 §5.4). Paths are under the distribution root (distr/). The markup also needs the theme class on <html>: theme-light or theme-dark. Generated by scripts/snapshot-first-paint.mjs.`,
    component: component.tag,
    theme: ['theme-light', 'theme-dark'],
    sheets: [...sheets].sort(),
    examples: order,
  }, null, 2)}\n`;
  const file = join(component.dir, 'static', 'sheets.json');
  compare(file, body);
  files.add(file);
  // A snapshot of an example that is gone is stale too.
  const dir = join(component.dir, 'static');
  const walk = (folder) => readdirSync(folder, {withFileTypes: true}).flatMap((one) => (one.isDirectory() ? walk(join(folder, one.name)) : [join(folder, one.name)]));
  for (const file of existsSync(dir) ? walk(dir) : []) {
    if (files.has(file) || only.length && !files.size) continue;
    if (check) results.stale.push(`${relative(repo, file)} (no example)`);
    else { rmSync(file); results.written.push(`${relative(repo, file)} (removed)`); }
  }
}

const summary = {
  mode: check ? 'check' : 'write',
  components: all.length,
  examples: Object.values(Object.fromEntries(byComponent)).reduce((sum, one) => sum + Object.keys(one.examples).length, 0),
  unchanged: results.unchanged,
  written: results.written.length,
  stale: results.stale,
  missing: results.missing,
  failed: results.failed,
  tooLarge: results.tooLarge,
  sheetDrift: results.sheetDrift,
};
if (!check) summary.files = results.written;
console.log(JSON.stringify(summary, null, 2));
if (results.failed.length || results.tooLarge.length || (check && (results.stale.length || results.missing.length))) process.exit(1);

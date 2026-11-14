#!/usr/bin/env node
// The first paint of a page's own SIMAI Framework elements, printed from a
// Framework build: the static markup each sf-* element of the page shows
// before any script runs, and the sheets that markup needs. It is the
// snapshot the Framework takes of its own examples (standard
// simai.smart-component 1.3.8 §5.4; scripts/snapshot-first-paint.mjs), taken
// of markup a site wrote: same page, same Loader, same settling, same
// serializer (scripts/first-paint-page.js). Nothing is guessed: an element
// the build does not define is reported, never printed.
//
// Usage: node tools/first-paint/print.mjs --distr=<root> [options] <page.html ...>
//        node tools/first-paint/print.mjs --distr=<root> [options] -        (the page on stdin)
//
// Documented in docs/developer/first-paint-print.md (CLI, module API, output).
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {ensureLocalPlaywright} from '../../scripts/playwright-local.mjs';
import {BOOT_CONFIG, PAGE_CONTEXT, coreScript, esc, freezeClock, head, isDistribution, readConfig, serializeSettled, serveOutput, settleSheets, watchRequests} from '../../scripts/first-paint-lib.mjs';

export const SCHEMA = 'simai.first-paint-print.v1';
const here = dirname(fileURLToPath(import.meta.url));
const pageScript = readFileSync(join(here, '..', '..', 'scripts', 'first-paint-page.js'), 'utf8');
const THEMES = ['theme-light', 'theme-dark'];
const pause = (ms) => new Promise((settle) => setTimeout(settle, ms));

// In the browser, on a page without the Framework: the page's markup parsed
// into an inert template (nothing upgrades, nothing runs), its top-level sf-*
// elements (none of them inside another) taken out in document order, each
// replaced by a marker comment. Nested sf-* elements belong to the element
// that holds them: they are printed inside its first paint.
const SPLIT = (markup) => {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const framework = (el) => el.localName.startsWith('sf-');
  const top = [...template.content.querySelectorAll('*')].filter((el) => {
    if (!framework(el)) return false;
    for (let up = el.parentElement; up; up = up.parentElement) if (framework(up)) return false;
    return true;
  });
  const elements = top.map((el, at) => {
    const one = {tag: el.localName, markup: el.outerHTML, nested: [...el.querySelectorAll('*')].filter(framework).map((inner) => inner.localName)};
    el.replaceWith(document.createComment(`sf-first-paint ${at + 1}`));
    return one;
  });
  return {page: template.innerHTML, elements};
};

// In the browser, on the element's page: where it stands.
const STATE = () => {
  const host = window.__sfFirstPaintHost;
  if (!host) return {phase: 'none'};
  const defined = Boolean(customElements.get(host.localName));
  const nested = [...host.querySelectorAll('*')].filter((el) => el.localName.startsWith('sf-'))
    .map((el) => ({tag: el.localName, defined: Boolean(customElements.get(el.localName))}));
  if (!defined) return {phase: 'undefined', nested};
  const manifest = host.constructor?.manifest ?? null;
  // A closed overlay draws nothing until it opens (its first paint is what it
  // has then, often nothing), as in snapshot-first-paint.mjs.
  const overlay = Boolean(manifest && (manifest.layer || (manifest['side-effects'] ?? []).includes('portal')));
  let ready;
  if (overlay) ready = host.hasAttribute('data-sf-started') || !manifest;
  else ready = 'isRendered' in host ? host.isRendered === true : true;
  // An element on lit without the Smart base (a classic Smart element) has
  // drawn once its first update is done.
  if (ready && 'hasUpdated' in host && !('isRendered' in host)) ready = host.hasUpdated === true;
  return {phase: ready ? 'ready' : 'drawing', nested};
};

// In the browser, on the drawn element's page: what its printed first paint
// cannot hold, said rather than hidden.
//   text-shown-twice  the element took text the page gave it into its
//                     picture, and the print still holds that text beside the
//                     picture: a text node cannot be held out of view
//                     (data-sf-held), so it shows twice until the element
//                     draws. An element whose text setting is that label
//                     (sf-button) is printed with it as the attribute instead
//                     (first-paint-page.js holder), and has no note.
const NOTES = ({source, html}) => {
  const host = window.__sfFirstPaintHost;
  const parse = (markup) => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return template.content.firstElementChild;
  };
  const texts = (el) => [...(el?.childNodes ?? [])].filter((node) => node.nodeType === 3 && node.data.trim()).map((node) => node.data.trim());
  const given = texts(parse(source));
  const kept = new Set(texts(host));
  const printed = html.includes(' data-sf-static') ? new Set(texts(parse(html))) : new Set();
  const notes = [];
  if (given.some((one) => !kept.has(one) && printed.has(one))) notes.push('text-shown-twice');
  return notes;
};

const sheetPath = (path) => path.replace(/^\/distr\//u, '');
const sortedUnique = (list) => [...new Set(list)].sort();

/**
 * The committed snapshots of a distribution's Smart components, by their
 * markup: body -> "smart/<folder>/static/<template>/<example>.html". A printed
 * element that is byte for byte one of them names it (`snapshot`).
 */
export function snapshotIndex(distr) {
  const index = new Map();
  const smart = isDistribution(distr) ? join(distr, 'smart') : join(distr, 'smart', 'smart');
  if (!existsSync(smart)) return index;
  for (const folder of readdirSync(smart).sort()) {
    const dir = join(smart, folder, 'static');
    if (!existsSync(dir)) continue;
    for (const template of readdirSync(dir, {withFileTypes: true}).filter((one) => one.isDirectory()).map((one) => one.name).sort()) {
      for (const file of readdirSync(join(dir, template)).filter((one) => one.endsWith('.html') && !one.endsWith('.skeleton.html')).sort()) {
        const text = readFileSync(join(dir, template, file), 'utf8');
        // The generated header line, then the markup and one line end.
        const body = text.replace(/^<!--[^\n]*-->\n/u, '').replace(/\n$/u, '');
        if (!index.has(body)) index.set(body, `smart/${folder}/static/${template}/${file}`);
      }
    }
  }
  return index;
}

/**
 * A printer over one Framework build: one server and one browser for every
 * page it prints. Close it when done.
 *
 *   distr        the distribution root (a pair's distr/: core/, rule/,
 *                component/, utility/, smart/) or a ui-builder build output
 *   config       a first-paint configuration file (component packages, the
 *                frozen clock; scripts/first-paint-lib.mjs readConfig)
 *   concurrency  pages drawn at once (default 4)
 *   port         the server's port (default 0: any free port)
 *   timeout      ms an element may take to draw (default 20000)
 */
export async function createPrinter({distr, config = null, concurrency = 4, port = 0, timeout = 20000, browser: given = null} = {}) {
  if (!distr) throw new Error('distr is required: the distribution root (core/, rule/, component/, utility/, smart/)');
  const root = resolve(distr);
  const run = config ? readConfig([`--config=${config}`], {}) : {packages: {}};
  const pages = new Map([['/first-paint-page.js', pageScript], ['/split', '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>']]);
  const site = await serveOutput(root, {pages, packages: run.packages, port});
  let browser = given;
  if (!browser) {
    // The playwright this repository declares (scripts/playwright-local.mjs),
    // never a stray copy: a caller with its own passes `browser`.
    ensureLocalPlaywright(join(here, '..', '..'));
    const {chromium} = await import('playwright');
    browser = await chromium.launch();
  }
  const boot = {...BOOT_CONFIG};
  delete boot.packages;
  if (Object.keys(run.packages).length) boot.packages = Object.fromEntries(Object.entries(run.packages).map(([name, {base}]) => [name, {base}]));
  const bootScript = `<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG=${JSON.stringify(boot)};</script>`;
  const snapshots = snapshotIndex(root);
  let serial = 0;

  // The sheets of the page as a whole: the Loader over all of its markup
  // (a wrapper's utilities, gap-2 around the elements, are the page's first
  // paint too). Nothing is serialized here.
  async function pageSheets(markup) {
    serial += 1;
    const path = `/page/${serial}`;
    pages.set(path, `${head({title: 'page', scripts: false, extra: bootScript})}<body>
<main id="stage"></main>
<script>document.getElementById('stage').innerHTML = ${JSON.stringify(markup).replace(/</g, '\\u003c')};</script>
${coreScript}
</body></html>`);
    const context = await browser.newContext(PAGE_CONTEXT);
    const page = await context.newPage();
    await freezeClock(page, {}, run);
    const net = watchRequests(page);
    try {
      await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
      await net.quiet(Date.now() + 15000);
      await settleSheets(page, net);
      return sortedUnique(net.sheets.map(sheetPath));
    } finally {
      await context.close();
      pages.delete(path);
    }
  }

  // The page split into its elements, in a context of its own.
  async function split(markup) {
    const context = await browser.newContext(PAGE_CONTEXT);
    try {
      const page = await context.newPage();
      await page.goto(`${site.origin}/split`, {waitUntil: 'load'});
      return await page.evaluate(SPLIT, markup);
    } finally {
      await context.close();
    }
  }

  // One element on a page of its own, as snapshot-first-paint.mjs puts an
  // example: the stage, first-paint-page.js marking what the page gave, then
  // the Loader.
  async function printElement(element, prefix) {
    serial += 1;
    const path = `/print/${serial}`;
    const spec = {tag: element.tag, attributes: [], island: null, children: '', slots: [], markup: element.markup, parent: null, late: []};
    pages.set(path, `${head({title: element.tag, scripts: false, extra: `${bootScript}\n<script src="/first-paint-page.js"></script>`})}<body>
<main id="stage"></main>
<script>window.__sfFirstPaintBuild(${JSON.stringify(spec).replace(/</g, '\\u003c')});</script>
${coreScript}
</body></html>`);
    const context = await browser.newContext(PAGE_CONTEXT);
    const page = await context.newPage();
    await freezeClock(page, {}, run);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const net = watchRequests(page);
    try {
      await page.goto(`${site.origin}${path}`, {waitUntil: 'load'});
      const until = Date.now() + timeout;
      let state = await page.evaluate(STATE);
      // Drawn, or never defined: the Loader has loaded what the page asks
      // for (the network has been quiet for 2 s) and nothing defines the tag.
      while (state.phase !== 'ready' && Date.now() < until) {
        if (state.phase === 'undefined' && net.inflight === 0 && Date.now() - net.last > 2000) break;
        await pause(100);
        state = await page.evaluate(STATE);
      }
      if (state.phase === 'undefined') {
        return {status: 'unknown', reason: `this build defines no <${element.tag}>: the Loader loaded nothing that does`, errors};
      }
      if (state.phase !== 'ready') return {status: 'failed', reason: `<${element.tag}> did not draw in ${timeout} ms`, errors};
      const html = await serializeSettled(page, net, prefix);
      await settleSheets(page, net);
      const after = await page.evaluate(STATE);
      if (errors.length) return {status: 'failed', reason: 'the page threw while the element drew', errors};
      return {status: 'printed', html, sheets: sortedUnique(net.sheets.map(sheetPath)), nested: after.nested, notes: await page.evaluate(NOTES, {source: element.markup, html})};
    } catch (error) {
      return {status: 'failed', reason: String(error?.message ?? error).split('\n')[0].slice(0, 400), errors};
    } finally {
      await context.close();
      pages.delete(path);
    }
  }

  /**
   * The first paint of a page's markup (a fragment or a whole document).
   * `id` names the page in the result; `prefix` names the ids a component
   * makes up (a string: `<prefix>-<element number>`, or a function
   * (element, number) -> string; default "sf-first-paint").
   */
  async function print(markup, {id = null, prefix = 'sf-first-paint'} = {}) {
    const {page, elements} = await split(String(markup));
    // A page of classic components only (class markup, no element) has its
    // sheets too: its markup is its own first paint.
    // Settled into a value now: a failure is reported once the elements are
    // done, never as an unhandled rejection meanwhile.
    const whole = pageSheets(String(markup)).then((sheets) => ({sheets}), (error) => ({error}));
    const results = new Array(elements.length);
    let next = 0;
    const worker = async () => {
      for (let at = next++; at < elements.length; at = next++) {
        const element = elements[at];
        const own = typeof prefix === 'function' ? prefix(element, at + 1) : `${prefix}-${at + 1}`;
        const got = await printElement(element, own);
        const result = {index: at + 1, tag: element.tag, status: got.status};
        if (got.status === 'printed') {
          result.html = got.html;
          result.sheets = got.sheets;
          result.snapshot = snapshots.get(got.html) ?? null;
          const undefinedNested = sortedUnique(got.nested.filter((one) => !one.defined).map((one) => one.tag));
          result.nested = {count: element.nested.length, tags: sortedUnique(element.nested), undefined: undefinedNested};
          result.notes = got.notes;
        } else {
          result.reason = got.reason;
          result.nested = {count: element.nested.length, tags: sortedUnique(element.nested), undefined: []};
        }
        if (got.errors?.length) result.errors = [...got.errors];
        result.source = element.markup;
        results[at] = result;
      }
    };
    await Promise.all(Array.from({length: Math.max(1, Math.min(concurrency, elements.length))}, worker));
    const html = page.replace(/<!--sf-first-paint (\d+)-->/gu, (_, number) => {
      const one = results[Number(number) - 1];
      return one.status === 'printed' ? one.html : one.source;
    });
    const own = await whole;
    if (own.error) throw new Error(`the page's own sheets: ${String(own.error?.message ?? own.error).split('\n')[0]}`);
    const count = (status) => results.filter((one) => one.status === status).length;
    return {
      schema: SCHEMA,
      id,
      theme: THEMES,
      html,
      sheets: sortedUnique([...own.sheets, ...results.flatMap((one) => one.sheets ?? [])]),
      summary: {
        elements: results.length,
        printed: count('printed'),
        unknown: count('unknown'),
        failed: count('failed'),
        nested: results.reduce((sum, one) => sum + one.nested.count, 0),
        snapshots: results.filter((one) => one.snapshot).length,
        textShownTwice: results.filter((one) => one.notes?.includes('text-shown-twice')).length,
      },
      elements: results,
    };
  }

  async function close() {
    if (!given) await browser.close();
    await site.close();
  }
  return {print, close, origin: site.origin};
}

/** One page, one printer: the first paint of `markup` from the build at `distr`. */
export async function printFirstPaint(markup, options = {}) {
  const printer = await createPrinter(options);
  try {
    return await printer.print(markup, options);
  } finally {
    await printer.close();
  }
}

/** The <link> tags of a result's sheets under a site's base URL of the distribution. */
export const sheetLinks = (sheets, base) => sheets.map((sheet) => `<link rel="stylesheet" href="${esc(`${String(base).replace(/\/*$/u, '/')}${sheet}`)}">`);

// ---------- the command line ----------

export const USAGE = `Usage: node tools/first-paint/print.mjs --distr=<root> [options] <page.html ...> | -

  --distr=<root>    the Framework build: a pair's distr/ (or a ui-builder output)
  --root=<dir>      page ids are the inputs' paths relative to it (default: cwd)
  --out=<file>      write the JSON there (default: stdout)
  --out-dir=<dir>   write one <id>.first-paint.json per page there instead
  --base=<url>      also give each page and element its <link> tags under this URL of distr/
  --prefix=<text>   the ids components make up: <text>-<element number> (default sf-first-paint)
  --config=<file>   a first-paint configuration (component packages, clock)
  --concurrency=<n> pages drawn at once (default 4)
  --port=<n>        the build server's port (default: any free port)
  --strict          exit 1 when an element is unknown or failed`;

async function main(argv) {
  const flag = (name) => {
    const found = argv.find((one) => one.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : null;
  };
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const distr = flag('distr');
  const inputs = argv.filter((one) => one === '-' || !one.startsWith('--'));
  if (!distr || !inputs.length) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = resolve(flag('root') ?? process.cwd());
  const base = flag('base');
  const printer = await createPrinter({distr, config: flag('config'), concurrency: Number(flag('concurrency') ?? 4), port: Number(flag('port') ?? 0)});
  const pages = [];
  try {
    for (const input of inputs) {
      const markup = input === '-' ? readFileSync(0, 'utf8') : readFileSync(input, 'utf8');
      const id = input === '-' ? 'stdin' : relative(root, resolve(input)).split('\\').join('/');
      const result = await printer.print(markup, {id, prefix: flag('prefix') ?? 'sf-first-paint'});
      if (base) {
        result.links = sheetLinks(result.sheets, base);
        for (const one of result.elements) if (one.sheets) one.links = sheetLinks(one.sheets, base);
      }
      pages.push(result);
      const outDir = flag('out-dir');
      if (outDir) {
        const file = join(resolve(outDir), `${id.replace(/\.html?$/u, '')}.first-paint.json`);
        mkdirSync(dirname(file), {recursive: true});
        writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
      }
      const {summary} = result;
      process.stderr.write(`${id}: ${summary.elements} elements, ${summary.printed} printed, ${summary.unknown} unknown, ${summary.failed} failed\n`);
    }
  } finally {
    await printer.close();
  }
  if (!flag('out-dir')) {
    const body = `${JSON.stringify(pages.length === 1 ? pages[0] : {schema: SCHEMA, pages}, null, 2)}\n`;
    if (flag('out')) writeFileSync(flag('out'), body);
    else process.stdout.write(body);
  }
  const bad = pages.some((one) => one.summary.unknown || one.summary.failed);
  return argv.includes('--strict') && bad ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}

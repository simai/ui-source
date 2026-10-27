// The first paint of a Smart component (standard simai.smart-component 1.3.8
// §5.4, §7.3, gate 24; owner decision 2026-10-27: the static markup is a build
// snapshot). Shared by scripts/snapshot-first-paint.mjs, which writes the
// snapshots, and tests/browser/first-paint-gate.browser.mjs, which measures
// them. Node side only: a server for a build output, the page an example
// renders on, and what a component's folder declares.
//
// A component's first paint lives in its folder and ships with it (ui-builder
// copies every .html and .json under the entry's folder):
//
//   static/<template>/<example>.html           the host as a server prints it:
//                                              its attributes, a JSON island for
//                                              list and object settings, the
//                                              rendered markup marked
//                                              data-sf-static and the page's own
//                                              children
//   static/<template>/<example>.skeleton.html  the same with every text a bar
//                                              and every image a fill, for a
//                                              component whose data arrives late
//   static/sheets.json                         the sheets the markup needs
//
// An assembly's first paint is composed the same way per layout:
// static/<layout>/<example>.html.
//
// A component package (standard simai.component-package; ui-pro's) runs the
// same tools over its own build output: it declares its packages in a JSON
// file given as --config=<file> or FIRST_PAINT_CONFIG (see readConfig).
import {createServer} from 'node:http';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, extname, isAbsolute, join, resolve, sep} from 'node:path';

export const repo = resolve(new URL('..', import.meta.url).pathname);
export const smartRoot = join(repo, 'src', 'smart');

// Types whose values cannot live in an attribute (core/js/element-manifest.js
// PROPERTY_ONLY): a server gives them as a JSON island (§5.4).
export const PROPERTY_ONLY = new Set(['list', 'object', 'state']);

// What the runtime writes on a host that a server does not print: the
// markers of a started, styled element.
export const RUNTIME_ATTRIBUTES = [
  'data-sf-started', 'data-sf-style-ready', 'data-sf-style-pending', 'data-sf-snap-page',
  'data-sf-instance', 'data-sf-loaded', 'data-sf-upgraded', 'data-sf-ready',
];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/**
 * The run's configuration: --config=<file> on the command line, else the file
 * FIRST_PAINT_CONFIG names, else none. A package declares itself there instead
 * of editing these tools:
 *
 *   {
 *     "packages": {
 *       "larena": {
 *         "output": "<the package's built smart/ directory: rule.js and its component folders>",
 *         "base": "/distr/package/larena/"
 *       }
 *     }
 *   }
 *
 * Each package's output is served under its base (default
 * /distr/package/<name>/) and declared on every page as
 * SF_BOOT_CONFIG.packages.<name> = {base}, so the Loader fetches its rule.js
 * before the first scan, as on a page that uses the package. A base under a
 * free mount (/distr/smart/) is served after the free output: a package adds
 * to the Framework and never shadows it. Relative paths are read from the
 * file's folder. A top-level "now" (an ISO date-time) sets the package's
 * frozen clock (see clockOf).
 */
export function readConfig(argv = process.argv, env = process.env) {
  const flag = argv.find((one) => one.startsWith('--config='));
  const file = flag ? flag.slice('--config='.length) : env.FIRST_PAINT_CONFIG;
  if (!file) return {packages: {}};
  const config = readJson(file);
  const from = dirname(resolve(file));
  const packages = {};
  for (const [name, one] of Object.entries(config.packages ?? {})) {
    if (!/^[a-z][a-z0-9-]*$/u.test(name)) throw new Error(`${file}: "${name}" is not a package name`);
    if (!one?.output) throw new Error(`${file}: package ${name} names no output`);
    const output = isAbsolute(one.output) ? one.output : resolve(from, one.output);
    if (!existsSync(join(output, 'rule.js'))) throw new Error(`${file}: package ${name}: no rule.js in ${output}`);
    const base = `/${String(one.base ?? `/distr/package/${name}/`).replace(/^\/+|\/+$/gu, '')}/`;
    if (!base.startsWith('/distr/')) throw new Error(`${file}: package ${name}: its base must be under /distr/`);
    packages[name] = {output, base};
  }
  if (config.now === undefined) return {packages};
  if (!isInstant(config.now)) throw new Error(`${file}: "now" must be an ISO date-time with its offset, e.g. ${FIRST_PAINT_NOW}`);
  return {packages, now: config.now};
}

/**
 * The clock of a first-paint page is frozen (dispatcher decision 2026-10-28):
 * a component that reads the date (sf-thread-list groups by today, yesterday
 * and earlier) would otherwise print a different snapshot every midnight.
 * Before any page code runs, Date and Date.now give one instant -- the
 * example's "first-paint": {"now": "<ISO>"}, else the run configuration's
 * "now", else FIRST_PAINT_NOW; timers and performance.now() keep running.
 * The snapshot and gate 24 freeze the same instant, so the gate measures
 * what was printed.
 */
export const FIRST_PAINT_NOW = '2026-10-27T12:00:00+03:00';
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u;
export const isInstant = (value) => typeof value === 'string' && ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value));
export function clockOf(example, run = config) {
  const declared = example?.['first-paint']?.now;
  if (declared !== undefined) {
    if (!isInstant(declared)) throw new Error(`${example.name}: "first-paint" now must be an ISO date-time with its offset, e.g. ${FIRST_PAINT_NOW}`);
    return declared;
  }
  return run?.now ?? FIRST_PAINT_NOW;
}
/** Freezes the page's clock at the example's instant; call before page.goto. */
export async function freezeClock(page, example, run = config) {
  await page.clock.setFixedTime(new Date(clockOf(example, run)));
}

export const config = readConfig();

// Assemblies whose composed first paint is snapshotted and gated besides the
// components' own: src/smart/<folder> with "kind": "assembly", and the test
// assemblies of Framework parts here.
export const assemblyFixtures = join(repo, 'tests', 'fixtures', 'first-paint');

const kindOf = (root, folder) => readJson(join(root, folder, 'component.json')).kind ?? 'leaf';

/** Every component folder with a component.json, sorted, with what the first paint needs of it. */
export function components(root = smartRoot, only = []) {
  return readdirSync(root)
    .filter((folder) => existsSync(join(root, folder, 'component.json')) && kindOf(root, folder) !== 'assembly')
    .filter((folder) => !only.length || only.includes(folder))
    .sort()
    .map((folder) => describe(root, folder));
}

export function describe(root, folder) {
  const dir = join(root, folder);
  const manifest = readJson(join(dir, 'component.json'));
  const examplesFile = join(dir, typeof manifest.examples === 'string' ? manifest.examples : 'examples.json');
  let examples = existsSync(examplesFile) ? readJson(examplesFile).examples : null;
  // A component without examples is drawn with its defaults.
  if (!Array.isArray(examples) || !examples.length) examples = [{name: 'default', title: 'Defaults', settings: {}}];
  const skeleton = manifest.presentation?.skeleton ?? null;
  return {
    folder,
    dir,
    tag: manifest.tag,
    manifest,
    examples,
    // An overlay is closed at the first paint: its first paint is its trigger
    // (a closed dropdown's field), never the open surface (dispatcher decision,
    // 2026-10-27).
    overlay: Boolean(manifest.layer) || (manifest['side-effects'] ?? []).includes('portal'),
    // Late data (§5.4): settings that arrive after the first paint. The
    // skeleton is derived from the snapshot unless skeleton.html is declared.
    late: Array.isArray(skeleton?.late) ? skeleton.late : (manifest.port ? Object.keys(manifest.settings ?? {}).filter((name) => PROPERTY_ONLY.has(manifest.settings[name]?.type)) : []),
    skeletonFile: skeleton?.file ? join(dir, skeleton.file) : null,
    skeletonRepeat: skeleton?.repeat ?? null,
    hasPort: Boolean(manifest.port),
  };
}

/**
 * Whether an example gives late data (§5.4): a late setting with a value. An
 * explicitly empty list is data too -- the empty state -- but nothing to hold a
 * box for: its first paint is its static markup, and it has no skeleton.
 */
export function givesLateData(component, example) {
  const settings = example.settings ?? {};
  return component.late.some((name) => name in settings && settings[name] !== null && settings[name] !== undefined
    && !(Array.isArray(settings[name]) && !settings[name].length));
}

/**
 * How large a snapshot may be (owner decision 2026-10-27): 8 KB, a first
 * paint is the closed, resting element. An example whose first paint is
 * larger by nature (a palette of swatches) says so and why:
 *   "first-paint": {"max-bytes": 20000, "why": "..."}
 * Answers the problem with a file of `bytes`, or null.
 */
export const SNAPSHOT_MAX_BYTES = 8192;
export function sizeProblem(example, bytes) {
  const first = example['first-paint'] ?? null;
  // "now" alone (clockOf) declares no size.
  const declared = first && ('max-bytes' in first || 'why' in first || !('now' in first)) ? first : null;
  if (declared && (!Number.isInteger(declared['max-bytes']) || !String(declared.why ?? '').trim())) {
    return `${example.name}: "first-paint" needs an integer max-bytes and a why`;
  }
  const max = declared ? declared['max-bytes'] : SNAPSHOT_MAX_BYTES;
  if (bytes <= max) return null;
  return declared
    ? `${example.name}: ${bytes} bytes, over its declared ${max}`
    : `${example.name}: ${bytes} bytes, over ${SNAPSHOT_MAX_BYTES} (a closed surface prints closed; a larger first paint declares "first-paint": {"max-bytes", "why"} in its example)`;
}

/**
 * An example's port answers (§4.9): a component fed through a host port, not
 * a setting, declares in its example what a fake port answers, and the gate
 * hands that port over as the late data of phase 3. The example's `port`:
 *
 *   {"id": "<port id, default the manifest's>", "version": "...", "capabilities": ...,
 *    "answers": {"<intent>": <answer>, "*": <any other intent>},
 *    "methods": {"<method>": <answer>}, "delay": <ms, default 0>}
 *
 * `raise(intent, payload)` answers answers[intent] (else answers["*"], else
 * {outcome: "refused", reason: "not-in-example"}); every name of `methods` is a
 * method answering its value. Answers are copied, so a component may keep them.
 */
export function portOf(component, example) {
  const port = example.port;
  if (!port) return null;
  if (typeof port !== 'object' || Array.isArray(port)) throw new Error(`${component.folder}/${example.name}: port must be an object`);
  if (!component.hasPort) throw new Error(`${component.folder}/${example.name}: gives a port, the manifest declares none`);
  const id = port.id ?? component.manifest.port?.id ?? '';
  return {id, version: port.version ?? component.manifest.port?.version ?? '', capabilities: port.capabilities ?? null,
    answers: port.answers ?? {}, methods: port.methods ?? {}, delay: Number(port.delay ?? 0)};
}

// The page side of portOf: a function source that builds the fake port from
// its description in the page.
export const FAKE_PORT = `(spec) => {
  const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const later = (value) => new Promise((settle) => setTimeout(() => settle(copy(value)), spec.delay || 0));
  const port = {id: spec.id, port: spec.id, version: spec.version, calls: [],
    raise(intent, payload) {
      port.calls.push(intent);
      const answers = spec.answers || {};
      return later(Object.prototype.hasOwnProperty.call(answers, intent) ? answers[intent]
        : Object.prototype.hasOwnProperty.call(answers, '*') ? answers['*'] : {outcome: 'refused', reason: 'not-in-example'});
    }};
  if (spec.capabilities !== null && spec.capabilities !== undefined) port.capabilities = copy(spec.capabilities);
  for (const [name, answer] of Object.entries(spec.methods || {})) port[name] = () => { port.calls.push(name); return later(answer); };
  return port;
}`;

/** The member of a setting or value name, or null for a plain attribute (aria-label). */
export function memberOf(manifest, name) {
  return manifest.settings?.[name] ?? manifest.values?.[name] ?? null;
}

/**
 * How an example is put on a page: the host's attributes, its JSON island and
 * its children. Overlays drop `open` (closed at the first paint). `drop`
 * leaves out settings (the late data of a skeleton).
 */
export function hostSpec(component, example, {drop = []} = {}) {
  const {manifest, overlay} = component;
  const attributes = [];
  const island = {};
  for (const [name, value] of Object.entries(example.settings ?? {})) {
    if (drop.includes(name)) continue;
    if (overlay && name === 'open') continue;
    const member = memberOf(manifest, name);
    const type = member?.type ?? 'string';
    if (PROPERTY_ONLY.has(type)) { island[name] = value; continue; }
    if (value === null || value === undefined) continue;
    if (type === 'boolean') {
      if (value === true) attributes.push([name, '']);
      else if (member?.optional || member?.default === true) attributes.push([name, 'false']);
      continue;
    }
    // A boolean given to a setting that is not one (star: false for an enum
    // of '', off, on): present when true, absent when false.
    if (typeof value === 'boolean') {
      if (value) attributes.push([name, '']);
      continue;
    }
    attributes.push([name, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
  }
  for (const [name, value] of Object.entries(example.attributes ?? {})) {
    if (value === false || value === null) continue;
    attributes.push([name, value === true ? '' : String(value)]);
  }
  const children = [].concat(example.children ?? []).join('');
  const slots = Object.entries(example.slots ?? {});
  return {tag: component.tag, attributes, island, children, slots, markup: example.markup ?? null, parent: example.parent ?? null};
}

export const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A JSON island must not end its <script> early.
export const islandText = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

/** The folder of a template's snapshots, and the files of one example. */
export const staticDir = (component, template = 'default') => join(component.dir, 'static', template);
export const exampleFiles = (component, example) => {
  const template = example.template && example.template !== 'skeleton' ? example.template : 'default';
  const dir = staticDir(component, template);
  return {dir, html: join(dir, `${example.name}.html`), skeleton: join(dir, `${example.name}.skeleton.html`)};
};

// ---------- a server for a build output ----------

const TYPES = new Map([
  ['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'],
  ['.woff2', 'font/woff2'], ['.woff', 'font/woff'], ['.svg', 'image/svg+xml'], ['.html', 'text/html'], ['.png', 'image/png'],
]);

/**
 * Serves <output>/{core,component,utility,smart} under /distr/ and the pages
 * put in `pages` (path -> html). `onRequest(path)` hears every request;
 * `delay(path)` holds a response back (ms). Port 0: never a fixed port.
 */
export async function serveOutput(out, {pages = new Map(), onRequest = () => {}, delay = () => 0, packages = config.packages, fonts = 'measured'} = {}) {
  const mounts = [
    ['/distr/core/', join(out, 'core', 'core')],
    ['/distr/rule/', join(out, 'core', 'rule')],
    ['/distr/component/', join(out, 'component', 'component')],
    ['/distr/utility/', join(out, 'utility', 'utility')],
    ['/distr/smart/', join(out, 'smart', 'smart')],
  ];
  for (const [, path] of mounts) if (!existsSync(path)) throw new Error(`${path} not found: the build output root holds core/, component/, utility/, smart/`);
  // The declared packages, after the free output (never in its place).
  for (const {base, output} of Object.values(packages)) mounts.push([base, output]);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    onRequest(path, url);
    const wait = delay(path);
    if (wait) await new Promise((settle) => setTimeout(settle, wait));
    if (pages.has(path)) {
      const type = TYPES.get(extname(path)) ?? 'text/html';
      response.writeHead(200, {'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store'});
      response.end(pages.get(path));
      return;
    }
    // The first mount that holds the file: the free output, then a package.
    let file = '';
    for (const [prefix, root] of mounts) {
      if (!path.startsWith(prefix)) continue;
      const one = resolve(root, path.slice(prefix.length));
      if (one.startsWith(root + sep) && existsSync(one) && !statSync(one).isDirectory()) { file = one; break; }
    }
    if (!file) {
      response.writeHead(404);
      response.end();
      return;
    }
    const type = TYPES.get(extname(file)) ?? 'application/octet-stream';
    response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
    const bytes = readFileSync(file);
    response.end(type === 'text/css' && fonts === 'measured' ? measuredFonts(bytes.toString('utf8')) : bytes);
  });
  await new Promise((settle) => server.listen(0, '127.0.0.1', settle));
  return {server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((settle) => server.close(settle))};
}

/**
 * The text faces a snapshot is measured in (decision 2026-10-27, recorded in
 * docs/developer/first-paint-snapshots.md): Inter, always. On a page the faces
 * are `font-display: optional` -- a cold visit stays on the metric fallback
 * rather than move its layout late -- so which face a snapshot page set its
 * text in was a race, and a width the code measured moved by 1-2 px from run
 * to run. The server of these tools serves the sheets with the text faces
 * `block` instead, and the pages wait for them (fontsReady), so the snapshots
 * and the gate are measured in the face the page is designed in. The sheets a
 * page gets are not touched. `fonts: 'as-shipped'` serves them unchanged.
 */
export function measuredFonts(css) {
  return css.replace(/@font-face\s*\{[^}]*\}/gu, (face) => (/font-family:\s*["']?Inter Variable/u.test(face)
    ? face.replace(/font-display:\s*optional/u, 'font-display: block') : face));
}

/**
 * In the page: every Inter face the stage's text needs is loaded, and the
 * text is set in it. Fails (an Error) when Inter is not there, so a snapshot
 * is never taken in the fallback.
 */
export const fontsReady = async (selector = '#stage') => {
  const root = document.querySelector(selector) ?? document.body;
  const text = root.textContent || '';
  // No text at all (an icon-only control): no face to wait for.
  if (!text.trim()) return 0;
  const styles = new Set([...root.querySelectorAll('*')].concat(root).map((el) => {
    const style = getComputedStyle(el);
    return /Inter Variable/u.test(style.fontFamily) ? `${style.fontStyle} ${style.fontWeight} 16px "Inter Variable"` : null;
  }).filter(Boolean));
  await Promise.all([...styles].map((font) => document.fonts.load(font, text)));
  await document.fonts.ready;
  const inter = [...document.fonts].filter((face) => face.family.replace(/["']/gu, '') === 'Inter Variable');
  const used = inter.filter((face) => face.status !== 'unloaded');
  if (styles.size && (!used.length || used.some((face) => face.status !== 'loaded'))) {
    throw new Error(`Inter is not loaded (${used.map((face) => face.status).join(', ') || 'no face asked for'})`);
  }
  return used.length;
};

/** The boot of a page with the Framework: core.css, the theme class, core.js. */
export const BOOT_CONFIG = {
  cacheVersion: 'first-paint',
  pluginListVersion: 'first-paint',
  preloader: {enabled: false},
  ...(Object.keys(config.packages).length
    ? {packages: Object.fromEntries(Object.entries(config.packages).map(([name, {base}]) => [name, {base}]))} : {}),
};
export const head = ({sheets = ['/distr/core/css/core.css'], scripts = true, title = 'first paint', extra = ''} = {}) => `<!doctype html>
<html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="data:,">
${sheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
${scripts ? `<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG=${JSON.stringify(BOOT_CONFIG)};</script>` : ''}
${extra}</head>`;
export const coreScript = '<script src="/distr/core/js/core.js"></script>';

/** The assemblies, each with its layouts' HTML and the folders of its parts. */
export function assemblies(only = []) {
  const found = [];
  for (const root of [smartRoot, assemblyFixtures]) {
    if (!existsSync(root)) continue;
    for (const folder of readdirSync(root).sort()) {
      if (!existsSync(join(root, folder, 'component.json')) || kindOf(root, folder) !== 'assembly') continue;
      if (only.length && !only.includes(folder)) continue;
      const one = describe(root, folder);
      one.layouts = Object.fromEntries(Object.entries(one.manifest.layouts ?? {}).map(([name, file]) => [name, readFileSync(join(one.dir, file), 'utf8')]));
      one.parts = [...new Set(Object.values(one.manifest.roles ?? {}).map((role) => role.part))];
      found.push(one);
    }
  }
  return found;
}

/** The folder of a Framework part by its tag (sf-profile-picker -> profile-picker). */
export const partFolder = (tag) => String(tag).replace(/^sf-/u, '');

// The page of an assembly: its element in the stage, then the runtime
// defines it from its manifest and layouts, its parts' interfaces from their
// component.json (§7.3).
export const assemblyModule = (assembly) => `<script type="module">
import Assembly from '/distr/core/js/assembly/index.mjs';
const parts = ${JSON.stringify(assembly.parts)};
for (const tag of parts) Assembly.interfaces.register(tag, await (await fetch('/distr/smart/' + tag.replace(/^sf-/u, '') + '/component.json')).json());
Assembly.define(${JSON.stringify(assembly.manifest).replace(/</g, '\\u003c')}, {layouts: ${JSON.stringify(assembly.layouts).replace(/</g, '\\u003c')}});
window.__sfAssemblyDefined = true;
</script>`;

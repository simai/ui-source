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
import {createServer} from 'node:http';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';

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
export async function serveOutput(out, {pages = new Map(), onRequest = () => {}, delay = () => 0} = {}) {
  const mounts = [
    ['/distr/core/', join(out, 'core', 'core')],
    ['/distr/rule/', join(out, 'core', 'rule')],
    ['/distr/component/', join(out, 'component', 'component')],
    ['/distr/utility/', join(out, 'utility', 'utility')],
    ['/distr/smart/', join(out, 'smart', 'smart')],
  ];
  for (const [, path] of mounts) if (!existsSync(path)) throw new Error(`${path} not found: the build output root holds core/, component/, utility/, smart/`);
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
    const mount = mounts.find(([prefix]) => path.startsWith(prefix));
    const file = mount ? resolve(mount[1], path.slice(mount[0].length)) : '';
    if (!file || !file.startsWith(mount[1] + sep) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end();
      return;
    }
    const type = TYPES.get(extname(file)) ?? 'application/octet-stream';
    response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
    response.end(readFileSync(file));
  });
  await new Promise((settle) => server.listen(0, '127.0.0.1', settle));
  return {server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((settle) => server.close(settle))};
}

/** The boot of a page with the Framework: core.css, the theme class, core.js. */
export const BOOT_CONFIG = {
  cacheVersion: 'first-paint',
  pluginListVersion: 'first-paint',
  preloader: {enabled: false},
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

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Highlighted code never pulls in the Doc component (ui-chat, dark theme). The
// highlighter's generated root carried the compatibility class `source`; the
// Loader read that word as the Doc component's source block and fetched
// component/doc/css, whose `.source` rule painted the code surface the inverse
// colour, so in the dark theme plain identifiers stood light on light. Served
// through the Loader, on the built bytes:
//   - dark and light theme, `<pre><code class="language-js">const a = 1</code></pre>`
//     highlighted at boot and a block inserted later and highlighted by
//     SF.Highlight.highlight(): no request for component/doc; the root is
//     .sf-highlight.sf-code-surface without `source`; its background is
//     --sf-surface-container; the plain identifier `a` holds 4.5:1 on the
//     surface as composited over the page;
//   - an authored `.source` root (the compatibility input) is still a root, and
//     with the Doc component on the page (a doc pair: .sf-doc-example followed
//     by pre.sf-doc-source) the highlighted blocks keep the code surface and
//     4.5:1, and the pair keeps its joined corners.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error(`no core.js under ${out}`);

const page = (theme, body) => `<!doctype html><html lang="ru" class="theme-${theme}"><head>
<meta charset="utf-8"><title>highlight ${theme}</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'highlight-dark-probe', pluginListVersion: 'highlight-dark-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: false}, theme: false};
</script></head><body style="margin:16px">${body}<script src="/distr/core/js/core.js"></script></body></html>`;

const plain = '<pre><code class="language-js">const a = 1</code></pre>';
const withDoc = `${plain}
  <div class="source"><pre><code class="language-js">const a = 1</code></pre></div>
  <div class="sf-doc-example">Пример</div>
  <pre class="sf-doc-source"><code class="language-js">const a = 1</code></pre>`;
const pages = {};
for (const theme of ['dark', 'light']) {
  pages[`/plain-${theme}.html`] = page(theme, plain);
  pages[`/doc-${theme}.html`] = page(theme, withDoc);
}

const types = new Map([['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'], ['.woff2', 'font/woff2']]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (pages[url.pathname]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(pages[url.pathname]);
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    response.writeHead(200, {'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream'});
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

// The colours as they reach the eye: each translucent background composited over
// the ones under it, up to an opaque one (or white).
const MEASURE = `(root) => {
  const parse = (value) => { const m = value.match(/[\\d.]+/gu)?.map(Number) || [0, 0, 0, 0]; return {r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1}; };
  const over = (top, bottom) => { const a = top.a + bottom.a * (1 - top.a);
    const mix = (c) => (a === 0 ? 0 : (top[c] * top.a + bottom[c] * bottom.a * (1 - top.a)) / a);
    return {r: mix('r'), g: mix('g'), b: mix('b'), a}; };
  const backdrop = (element) => { const layers = [];
    for (let node = element; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
    let color = {r: 255, g: 255, b: 255, a: 1};
    const canvas = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (canvas.a > 0) color = over(canvas, color);
    for (const layer of layers.reverse()) color = over(layer, color);
    return color; };
  const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const code = root.querySelector('code');
  // The identifier: the text node «a» that no token span holds.
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let holder = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (/\\ba\\b/u.test(node.textContent) && !node.parentElement.className.startsWith('hljs-')) { holder = node.parentElement; break; }
    if (/\\ba\\b/u.test(node.textContent)) holder = node.parentElement;
  }
  const ink = over(parse(getComputedStyle(holder).color), backdrop(holder));
  const ground = backdrop(holder);
  const probe = document.createElement('i');
  probe.style.backgroundColor = 'var(--sf-surface-container)';
  root.parentElement.append(probe);
  const container = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const style = getComputedStyle(root);
  return {classes: [...root.classList], background: style.backgroundColor, container,
    holder: holder.tagName.toLowerCase() + (holder.className ? '.' + holder.className : ''),
    ink: [ink.r, ink.g, ink.b].map(Math.round), ground: [ground.r, ground.g, ground.b].map(Math.round),
    contrast: (Math.max(lum(ink), lum(ground)) + 0.05) / (Math.min(lum(ink), lum(ground)) + 0.05),
    radius: [style.borderStartStartRadius, style.borderStartEndRadius, style.borderEndStartRadius, style.borderEndEndRadius]};
}`;

const browser = await chromium.launch();
try {
  for (const theme of ['dark', 'light']) {
    // The plain page: nothing on it but highlighted code.
    const tab = await browser.newPage();
    const requests = [];
    tab.on('request', (request) => requests.push(new URL(request.url()).pathname));
    tab.on('pageerror', (error) => failures.push({name: `${theme} page error`, said: error.message}));
    await tab.goto(`${origin}/plain-${theme}.html`);
    await tab.waitForFunction(() => document.querySelector('code')?.dataset.highlightState === 'ready', null, {timeout: 20000});
    await tab.waitForTimeout(800);
    // A block inserted later, highlighted on demand.
    await tab.evaluate(async () => {
      const pre = document.createElement('pre');
      pre.innerHTML = '<code class="language-js">const a = 1</code>';
      pre.id = 'later';
      document.body.append(pre);
      const block = pre.querySelector('code');
      await window.SF.Highlight.highlight(block);
    });
    await tab.waitForFunction(() => document.querySelector('#later code, .sf-highlight #later code')?.dataset.highlightState === 'ready', null, {timeout: 10000});
    await tab.waitForTimeout(800);
    const roots = await tab.evaluate((measure) => [...document.querySelectorAll('.sf-highlight')].map((root) => eval(measure)(root)), MEASURE);
    const doc = requests.filter((path) => /\/component\/doc\//u.test(path));
    evidence[`${theme} plain`] = {roots: roots.map(({classes, background, container, holder, ink, ground, contrast}) => ({classes, background, container, holder, ink, ground, contrast: Number(contrast.toFixed(2))})), docRequests: doc};
    check(`${theme}: two highlighted roots`, roots.length === 2, {roots});
    check(`${theme}: no request for component/doc`, doc.length === 0, {doc});
    for (const [index, root] of roots.entries()) {
      const at = (what) => `${theme} plain root ${index}: ${what}`;
      check(at('is .sf-highlight.sf-code-surface without source'), root.classes.includes('sf-code-surface') && !root.classes.includes('source'), root);
      check(at('background is --sf-surface-container'), root.background === root.container, root);
      check(at('the identifier holds 4.5:1'), root.contrast >= 4.5, root);
    }
    await tab.close();

    // With the Doc component on the page, and an authored .source root.
    const docTab = await browser.newPage();
    docTab.on('pageerror', (error) => failures.push({name: `${theme} doc page error`, said: error.message}));
    const docRequests = [];
    docTab.on('request', (request) => docRequests.push(new URL(request.url()).pathname));
    await docTab.goto(`${origin}/doc-${theme}.html`);
    await docTab.waitForFunction(() => [...document.querySelectorAll('code')].every((code) => code.dataset.highlightState === 'ready'), null, {timeout: 20000});
    await docTab.waitForTimeout(800);
    const docRoots = await docTab.evaluate((measure) => [...document.querySelectorAll('.sf-highlight')].map((root) => eval(measure)(root)), MEASURE);
    const joined = await docTab.evaluate(() => {
      const example = document.querySelector('.sf-doc-example');
      const style = getComputedStyle(example);
      return {exampleEnd: [style.borderEndStartRadius, style.borderEndEndRadius], next: example.nextElementSibling.className};
    });
    evidence[`${theme} doc`] = {doc: docRequests.some((path) => /\/component\/doc\//u.test(path)),
      roots: docRoots.map(({classes, background, contrast, radius}) => ({classes, background, contrast: Number(contrast.toFixed(2)), radius})), joined};
    check(`${theme} doc: the Doc component is on this page`, evidence[`${theme} doc`].doc, {docRequests});
    check(`${theme} doc: three highlighted roots, the authored .source one among them`, docRoots.length === 3
      && docRoots.some((root) => root.classes.includes('source')), {docRoots});
    for (const [index, root] of docRoots.entries()) {
      const at = (what) => `${theme} doc root ${index} (${root.classes.join(' ')}): ${what}`;
      check(at('background is --sf-surface-container'), root.background === root.container, root);
      check(at('the identifier holds 4.5:1'), root.contrast >= 4.5, root);
    }
    const pair = docRoots.find((root) => root.classes.includes('sf-highlight') && !root.classes.includes('source') && root === docRoots[2]);
    check(`${theme} doc: the highlighted source joins the example (square corners between them)`,
      joined.exampleEnd.every((value) => value === '0px') && pair && pair.radius[0] === '0px' && pair.radius[1] === '0px', {joined, pair});
    await docTab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('HIGHLIGHT_DARK_SURFACE_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output   (PROBE_SHOTS=<dir> also saves screenshots)
// A Composition Document on a host's page, in a real browser, with the mouse
// and the keyboard:
//
// - simai/ui-source#61: layout.columns on a page that loads core/css/core.css
//   alone (no Loader, so no utilities) draws its columns side by side, as many
//   as it says, with the type's gap; with the Loader the utilities take over
//   and the columns stay where they were. Light and dark.
// - simai/ui-source#60: rendered with options.embedded into a host page that
//   holds its own main, the page has one main landmark; the default render
//   still draws layout.page as main.
// - simai/ui-source#62: sf-editor-overlay over a 'for' canvas in a focusable
//   scroller: after a click on a block, an action's shortcut sends apply for
//   that block, with focus where the click left it (no focus outline drawn);
//   a key typed in an editable inside a block stays the editable's.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const shots = process.env.PROBE_SHOTS ? resolve(process.env.PROBE_SHOTS) : '';
if (shots) mkdirSync(shots, {recursive: true});
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const loader = `<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<script src="/distr/core/js/core.js"></script>`;
const sheet = '<link rel="stylesheet" href="/distr/core/css/core.css">';

const pages = {
  // The host of #60 and #61: its own main around a canvas; core.css, and the Loader when asked.
  '/host': (query) => `<!doctype html><html lang="en" class="theme-${query.get('theme') || 'light'}"><head><meta charset="utf-8">${sheet}${query.get('loader') ? loader : ''}<style>
    html, body { margin: 0 }
    body { background: var(--sf-surface-1, #fff); color: var(--sf-on-surface, #111); font: 16px/24px sans-serif }
    #canvas { width: 640px; margin: 24px auto; }
    #canvas p { margin: 0; padding: 12px; background: var(--sf-surface-container, #eee); }
  </style></head><body><main id="editor"><h1 style="font-size:16px;margin:8px 24px">Editor</h1><div id="canvas"></div></main></body></html>`,
  // The editor of #62: a focusable scroller holding the overlay and the canvas.
  '/overlay': () => `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8">${sheet}${loader}<style>
    html, body { margin: 0; height: 100% }
    #well { height: 600px; overflow: auto; padding: 56px 24px 24px; background: #f4f4f8 }
    #canvas { width: 640px; margin-inline: auto; background: #fff }
    #canvas [data-sf-composition-id]:not(section) { margin: 0; padding: 16px; min-height: 60px; border-bottom: 1px solid #ccc }
    #ed { display: block; min-height: 24px; outline: 1px dashed #999 }
  </style></head><body><section id="well" tabindex="0">
    <sf-editor-overlay id="ov" for="canvas" label="Page"></sf-editor-overlay>
    <div id="canvas"><section data-sf-composition-id="root"><p data-sf-composition-id="a">First</p><div data-sf-composition-id="b">Second<div id="ed" contenteditable="true"></div></div><p data-sf-composition-id="c">Third</p></section></div>
  </section></body></html>`,
};

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path](url.searchParams));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = {};
const check = (value, name, details = null) => { if (!value) failures.push({name, details}); };
const near = (a, b, by = 1) => Math.abs(a - b) <= by;
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

const text = (value) => ({type: 'text', value});
const paragraph = (id, value) => ({id, type: 'content.paragraph', data: {content: [text(value)]}});
const columns = (count, ids) => ({schema: 'simai.composition.document.v1', id: 'cols', profile: 'ui-layout',
  root: {id: 'c', type: 'layout.columns', props: {columns: count}, slots: {columns: ids.map((id) => paragraph(id, id.toUpperCase()))}}});
const pageDocument = {schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout',
  root: {id: 'p', type: 'layout.page', slots: {default: [columns(2, ['a', 'b']).root]}}};

// Renders a Document with the distribution's Composition module into #canvas.
const draw = (page, document, options) => page.evaluate(async ({document, options}) => {
  const {render} = await import('/distr/core/js/composition/index.mjs');
  const result = await render(document, options ? {options} : {});
  window.document.getElementById('canvas').innerHTML = result.html;
  return {assets: result.assets, diagnostics: result.diagnostics.map(({code}) => code)};
}, {document, options});
const boxes = (page, ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const box = document.querySelector(`[data-sf-composition-id="${id}"]`).getBoundingClientRect();
  return [id, {x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10}];
})), ids);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({locale: 'en-US', viewport: {width: 1000, height: 700}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // ---- #61: the columns from core.css alone, light and dark ------------------
  for (const theme of ['light', 'dark']) {
    await page.goto(`${base}/host?theme=${theme}`);
    const drawn = await draw(page, columns(2, ['a', 'b']));
    await settle(page);
    const two = await boxes(page, ['c', 'a', 'b']);
    const gap = two.b.x - (two.a.x + two.a.width);
    report[`columns2_${theme}`] = {...drawn, boxes: two, gap, utilitiesLoaded: await page.evaluate(() => Boolean(window.SF?.Loader))};
    check(JSON.stringify(drawn.assets) === '["composition/layout"]' && drawn.diagnostics.length === 0, `${theme}: the render lists composition/layout and nothing wrong`, drawn);
    check(near(two.a.y, two.b.y) && two.b.x > two.a.x + two.a.width, `${theme}: A and B stand side by side on core.css alone`, two);
    check(near(two.a.width, two.b.width) && near(gap, 16), `${theme}: two equal columns 16 px apart (gap-4)`, {two, gap});
    if (shots) await page.screenshot({path: join(shots, `columns-core-css-${theme}.png`), clip: {x: 0, y: 0, width: 1000, height: 160}});
  }
  await draw(page, columns(3, ['a', 'b', 'd']));
  await settle(page);
  const three = await boxes(page, ['c', 'a', 'b', 'd']);
  report.columns3 = three;
  check(near(three.a.y, three.d.y) && near(three.a.width, three.d.width) && near(three.a.width * 3 + 32, three.c.width), 'three columns fill the row in thirds, two gaps between', three);

  // With the Loader: the utilities the renderer prints take over; nothing moves.
  await page.goto(`${base}/host?loader=1`);
  await page.waitForFunction(() => window.SF?.ready || document.readyState === 'complete', null, {timeout: 25000});
  await draw(page, columns(2, ['a', 'b']));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.sf-composition-columns')).gridTemplateColumns.split(' ').length === 2, null, {timeout: 25000});
  await settle(page);
  report.columnsWithLoader = await boxes(page, ['a', 'b']);
  const loaded = report.columnsWithLoader;
  const bare = report.columns2_light.boxes;
  check(near(loaded.a.x, bare.a.x) && near(loaded.b.x, bare.b.x) && near(loaded.a.width, bare.a.width), 'with the utilities loaded the columns stand where core.css put them', {loaded, bare});
  check(errors.length === 0, 'no page errors on the host', errors);

  // ---- #60: one main landmark in an embedded render -------------------------
  await page.goto(`${base}/host`);
  const embedded = await draw(page, pageDocument, {embedded: true});
  report.embedded = {...embedded, mains: await page.evaluate(() => document.querySelectorAll('main, [role="main"]').length), landmark: await page.evaluate(() => document.querySelector('[data-sf-composition-id="p"]').outerHTML.slice(0, 80))};
  check(report.embedded.mains === 1 && report.embedded.diagnostics.length === 0, 'embedded: the host page keeps one main', report.embedded);
  check(/^<div data-sf-composition-landmark="main"/u.test(report.embedded.landmark), 'embedded: the page is a plain element naming its landmark', report.embedded);
  const nested = await draw(page, pageDocument);
  report.nested = {...nested, mains: await page.evaluate(() => document.querySelectorAll('main').length)};
  check(report.nested.mains === 2, 'by default layout.page is a main (what a publishing host keeps)', report.nested);

  // ---- #62: the action keys after a click on a 'for' canvas ------------------
  await page.goto(`${base}/overlay`);
  await page.waitForFunction(() => customElements.get('sf-editor-overlay'), null, {timeout: 25000});
  await page.evaluate(() => {
    const overlay = document.getElementById('ov');
    overlay.setDocument({schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout', root: {id: 'root', type: 'layout.section', slots: {default: [{id: 'a', type: 'content.paragraph'}, {id: 'b', type: 'content.outlet'}, {id: 'c', type: 'content.paragraph'}]}}}, {describe: (node) => ({label: node.id})});
    overlay.setActions([
      {id: 'move-down', label: 'Down', icon: 'arrow_downward', shortcut: '⌥↓'},
      {id: 'remove', label: 'Remove', icon: 'delete', shortcut: '⌫'},
    ]);
    window.lab = {applied: []};
    overlay.addEventListener('sf-editor-overlay-apply', (event) => window.lab.applied.push(event.detail));
  });
  await settle(page);
  const centre = (id) => page.evaluate((id) => {
    const box = document.querySelector(`[data-sf-composition-id="${id}"]`).getBoundingClientRect();
    return {x: box.left + 40, y: box.top + 14};
  }, id);
  const applied = () => page.evaluate(() => window.lab.applied.splice(0).map(({action, ids}) => [action, ...ids]));
  let at = await centre('a');
  await page.mouse.click(at.x, at.y);
  await settle(page);
  report.afterClick = await page.evaluate(() => ({
    focus: document.activeElement?.id || document.activeElement?.localName,
    focusDrawn: document.getElementById('ov').hasAttribute('data-sf-overlay-focus'),
  }));
  check(report.afterClick.focus !== '' && !report.afterClick.focusDrawn, 'the click leaves focus where the browser put it; no focus outline', report.afterClick);
  await page.keyboard.press('Alt+ArrowDown');
  report.altDown = await applied();
  check(JSON.stringify(report.altDown) === '[["move-down","a"]]', '⌥↓ after the click sends apply move-down for the block', report.altDown);
  await page.keyboard.press('Backspace');
  report.backspace = await applied();
  check(JSON.stringify(report.backspace) === '[["remove","a"]]', '⌫ after the click sends apply remove for the block', report.backspace);
  if (shots) await page.screenshot({path: join(shots, 'overlay-after-click.png'), clip: {x: 0, y: 0, width: 1000, height: 360}});

  // Focus on the scroller itself (as the issue's page): the same.
  await page.evaluate(() => document.getElementById('well').focus({preventScroll: true}));
  await page.keyboard.press('Alt+ArrowDown');
  report.onScroller = await applied();
  check(JSON.stringify(report.onScroller) === '[["move-down","a"]]', 'with focus on the scroller the key is the action\'s', report.onScroller);

  // A key typed in an editable inside a block stays the editable's.
  at = await centre('b');
  await page.mouse.click(at.x, at.y);
  await settle(page);
  await page.click('#ed');
  await page.keyboard.type('xy');
  await page.keyboard.press('Backspace');
  report.inEditable = {applied: await applied(), text: await page.evaluate(() => document.getElementById('ed').textContent)};
  check(report.inEditable.applied.length === 0 && report.inEditable.text === 'x', 'Backspace in an editable in a block edits the text and sends nothing', report.inEditable);

  // The tree still takes its keys as before.
  await page.evaluate(() => document.querySelector('#ov [role="tree"]').focus());
  await page.keyboard.press('Alt+ArrowDown');
  report.inTree = await applied();
  check(report.inTree.length === 1 && report.inTree[0][0] === 'move-down', 'in the tree the shortcut works once, as before', report.inTree);
  check(errors.length === 0, 'no page errors in the editor', errors);
  await page.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('COMPOSITION_HOST_CANVAS_OK');

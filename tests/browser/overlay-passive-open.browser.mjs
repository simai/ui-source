#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-editor-overlay 1.5.0 in a real browser: the setting passive and the event
// open (ui-editor gaps G-16 and G-17). The page is an editor's: a scroller with
// the overlay and a Composition canvas whose block holds an editable, as a host
// that types in the chosen block holds its editor; and a framed canvas. Every
// click, double click and key below is the mouse's and the keyboard's, not a
// dispatched event.
//
// - passive: a click in the chosen block reaches the editable inside it, which
//   then takes typed text; nothing is selected, prevented or opened, a double
//   click and Enter open nothing; the selection is kept and the toolbar and
//   insertion points step aside. Off again, a click on the kept block opens it.
// - open: once with node and point for each trigger -- a second click on the
//   chosen block, a double click on another block, a double click on the chosen
//   one, and Enter in the tree (the centre of the block) -- and in framed mode
//   a double click on a block that is not editable; an editable one edits.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const head = `<meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>`;

const letter = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff;color:#111;font:16px/24px sans-serif}
  [data-b]{padding:16px 24px;height:80px;border-bottom:1px solid #ddd}
</style></head><body>
  <div data-b="f1">Обложка</div><div data-b="f2"><span data-t="t2">Заголовок письма</span></div><div data-b="f3">Подвал</div>
</body></html>`;

const pages = {
  '/canvas': () => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0; height: 100% }
    #well { height: 600px; overflow: auto; padding: 56px 24px 24px; background: #f4f4f8 }
    #canvas { width: 640px; margin-inline: auto; background: #fff }
    #canvas p, #canvas div[data-sf-composition-id] { margin: 0; padding: 16px; min-height: 60px; border-bottom: 1px solid #ccc }
    #ed { display: block; min-height: 24px; outline: 1px dashed #999 }
  </style></head><body><div id="well">
    <sf-editor-overlay id="ov" for="canvas" label="Страница"></sf-editor-overlay>
    <div id="canvas"><section data-sf-composition-id="root"><p data-sf-composition-id="a">Первый</p><div data-sf-composition-id="b">Область текста<div id="ed" contenteditable="true"></div></div><p data-sf-composition-id="c">Третий</p></section></div>
  </div></body></html>`,
  '/frame': () => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0; height: 100% }
    #well { height: 600px; overflow: auto; padding: 56px 24px 24px; background: #f4f4f8 }
    #letter { display: block; width: 600px; margin-inline: auto; border: 0; background: #fff }
  </style></head><body><div id="well">
    <sf-editor-overlay id="ov" label="Письмо"></sf-editor-overlay>
    <iframe id="letter" sandbox="allow-same-origin" tabindex="-1" title="Письмо"></iframe>
  </div></body></html>`,
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
  // utf-8 on every routed file: the Loader may bring a part as a classic script.
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = {};
const check = (value, name, details = null) => { if (!value) failures.push({name, details}); };
const near = (a, b) => Math.abs(a - b) <= 1;
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// What the host hears, cleared before each gesture.
const listen = (page) => page.evaluate(() => {
  const overlay = document.getElementById('ov');
  window.lab = {heard: []};
  for (const verb of ['select', 'open', 'apply', 'insert', 'move']) overlay.addEventListener(`sf-editor-overlay-${verb}`, (event) => window.lab.heard.push([verb, event.detail]));
});
const clear = (page) => page.evaluate(() => { window.lab.heard = []; });
const heard = (page, verb) => page.evaluate((verb) => window.lab.heard.filter(([name]) => name === verb).map(([, detail]) => detail), verb);
const chosen = (page) => page.evaluate(() => document.querySelector('#ov [role="treeitem"][aria-selected="true"]')?.dataset.nodeId ?? null);
// A point inside a canvas block, in page and canvas coordinates.
const spot = (page, id, dx = 30, dy = 12) => page.evaluate(({id, dx, dy}) => {
  const box = document.querySelector(`[data-sf-composition-id="${id}"]`).getBoundingClientRect();
  const canvas = document.getElementById('canvas').getBoundingClientRect();
  return {x: box.left + dx, y: box.top + dy, canvas: {x: box.left + dx - canvas.left, y: box.top + dy - canvas.top}, centre: {x: box.left - canvas.left + box.width / 2, y: box.top - canvas.top + box.height / 2}};
}, {id, dx, dy});
const pointMatches = (point, want) => Boolean(point) && near(point.x, want.x) && near(point.y, want.y);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({locale: 'ru-RU', viewport: {width: 1100, height: 760}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // ---- a Composition canvas -------------------------------------------------
  await page.goto(`${base}/canvas`);
  await page.waitForFunction(() => customElements.get('sf-editor-overlay'), null, {timeout: 25000});
  await page.evaluate(() => {
    const overlay = document.getElementById('ov');
    overlay.setDocument({schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout', root: {id: 'root', type: 'layout.section', slots: {default: [{id: 'a', type: 'content.paragraph'}, {id: 'b', type: 'content.outlet'}, {id: 'c', type: 'content.paragraph'}]}}}, {describe: (node) => ({label: node.id})});
    overlay.setActions([{id: 'up', label: 'Выше'}, {id: 'remove', label: 'Удалить'}]);
  });
  await listen(page);
  await settle(page);

  // A first click chooses, a second opens, at the pointer.
  let at = await spot(page, 'b');
  await page.mouse.click(at.x, at.y);
  await settle(page);
  report.firstClick = {select: await heard(page, 'select'), open: await heard(page, 'open')};
  check(report.firstClick.select.length === 1 && report.firstClick.select[0].id === 'b' && report.firstClick.open.length === 0, 'a first click chooses the block and opens nothing', report.firstClick);
  await clear(page);
  await page.waitForTimeout(600);
  at = await spot(page, 'b', 44, 20);
  await page.mouse.click(at.x, at.y);
  await settle(page);
  report.secondClick = {select: await heard(page, 'select'), open: await heard(page, 'open'), want: at.canvas};
  check(report.secondClick.open.length === 1 && report.secondClick.select.length === 0, 'a second click on the chosen block sends open once and no select', report.secondClick);
  const second = report.secondClick.open[0];
  check(second && second.id === 'b' && second.node === 'b' && JSON.stringify(second.ids) === '["b"]' && second.trigger === 'click' && pointMatches(second.point, at.canvas), 'open carries the node and the pointer in canvas coordinates', report.secondClick);

  // A double click on another block chooses it and opens it once.
  await clear(page);
  await page.waitForTimeout(600);
  at = await spot(page, 'a', 60, 18);
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  report.doubleOther = {select: await heard(page, 'select'), open: await heard(page, 'open'), chosen: await chosen(page)};
  check(report.doubleOther.open.length === 1 && report.doubleOther.open[0].id === 'a' && report.doubleOther.open[0].trigger === 'dblclick' && pointMatches(report.doubleOther.open[0].point, at.canvas), 'a double click on another block sends open once, at the pointer', report.doubleOther);
  check(report.doubleOther.chosen === 'a' && report.doubleOther.select.length === 1, 'the double click chooses the block', report.doubleOther);

  // A double click on the chosen block opens once: its first click did.
  await clear(page);
  await page.waitForTimeout(600);
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  report.doubleChosen = await heard(page, 'open');
  check(report.doubleChosen.length === 1 && report.doubleChosen[0].id === 'a', 'a double click on the chosen block sends open once', report.doubleChosen);

  // Enter in the tree: once, at the centre of the chosen block; the toolbar keeps its focus.
  await clear(page);
  await page.evaluate(() => document.querySelector('#ov [role="tree"]').focus());
  await page.keyboard.press('Enter');
  await settle(page);
  const centre = (await spot(page, 'a')).centre;
  report.enter = {open: await heard(page, 'open'), want: centre, focus: await page.evaluate(() => document.activeElement?.dataset?.action ?? document.activeElement?.localName)};
  check(report.enter.open.length === 1 && report.enter.open[0].id === 'a' && report.enter.open[0].trigger === 'enter' && pointMatches(report.enter.open[0].point, centre), 'Enter sends open once, at the centre of the chosen block', report.enter);
  check(report.enter.focus === 'up', 'Enter still reaches the toolbar', report.enter);

  // Passive: the chosen block's editable gets the click and the keys.
  await page.evaluate(() => document.getElementById('ov').select('b'));
  await settle(page);
  await page.evaluate(() => {
    window.lab.reached = [];
    const editable = document.getElementById('ed');
    for (const type of ['click', 'dblclick']) editable.addEventListener(type, (event) => window.lab.reached.push([type, event.defaultPrevented]));
    document.getElementById('ov').passive = true;
  });
  await settle(page);
  await clear(page);
  const ed = await page.evaluate(() => { const box = document.getElementById('ed').getBoundingClientRect(); return {x: box.left + 20, y: box.top + box.height / 2}; });
  await page.mouse.click(ed.x, ed.y);
  await page.keyboard.type('Текст');
  const typed = await page.evaluate(() => ({text: document.getElementById('ed').textContent, focus: document.activeElement?.id}));
  await page.mouse.dblclick(ed.x, ed.y);
  await page.keyboard.press('Enter');
  await page.mouse.move(ed.x + 5, ed.y - 30);
  await page.waitForTimeout(300);
  report.passive = await page.evaluate(() => {
    const overlay = document.getElementById('ov');
    const shown = (selector) => { const element = overlay.querySelector(selector); return Boolean(element) && !element.hidden && element.getBoundingClientRect().width > 0; };
    return {
      attribute: overlay.getAttribute('passive'),
      reached: window.lab.reached,
      heard: window.lab.heard.map(([verb]) => verb),
      chosen: document.querySelector('#ov [role="treeitem"][aria-selected="true"]')?.dataset.nodeId ?? null,
      tabIndex: overlay.querySelector('[role="tree"]').tabIndex,
      toolbar: shown('.sf-composition-overlay-toolbar'),
      inserts: overlay.querySelectorAll('.sf-composition-overlay-insert').length,
      hover: shown('.sf-composition-overlay-frame--hover'),
      frame: shown('.sf-composition-overlay-frame--selected'),
    };
  });
  report.passive.typed = typed;
  const reachedClicks = report.passive.reached.filter(([type]) => type === 'click');
  check(report.passive.attribute === '' && reachedClicks.length >= 1 && reachedClicks.every(([, prevented]) => !prevented), 'passive: the click reaches the editable inside the chosen block, not prevented', report.passive);
  check(typed.focus === 'ed' && typed.text === 'Текст', 'passive: the editable takes the focus and the typed text', report.passive);
  check(report.passive.reached.some(([type, prevented]) => type === 'dblclick' && !prevented), 'passive: the double click reaches the editable', report.passive);
  check(report.passive.heard.length === 0, 'passive: nothing is selected or opened', report.passive);
  check(report.passive.chosen === 'b' && report.passive.frame, 'passive: the selection is kept and drawn', report.passive);
  check(!report.passive.toolbar && report.passive.inserts === 0 && !report.passive.hover && report.passive.tabIndex === -1, 'passive: toolbar, insertion points and hover step aside, the tree leaves the Tab order', report.passive);

  // Off again: the same selection, and a click on it opens.
  await page.evaluate(() => { document.getElementById('ov').passive = false; document.activeElement?.blur(); });
  await settle(page);
  await clear(page);
  await page.waitForTimeout(600);
  at = await spot(page, 'b', 30, 12);
  await page.mouse.click(at.x, at.y);
  await settle(page);
  report.resumed = {open: await heard(page, 'open'), select: await heard(page, 'select'), tabIndex: await page.evaluate(() => document.querySelector('#ov [role="tree"]').tabIndex)};
  check(report.resumed.open.length === 1 && report.resumed.open[0].id === 'b' && report.resumed.select.length === 0 && report.resumed.tabIndex === 0, 'off again, a click on the kept selection sends open', report.resumed);
  check(errors.length === 0, 'no page errors on the canvas', errors);

  // ---- a framed canvas ------------------------------------------------------
  await page.goto(`${base}/frame`);
  await page.waitForFunction(() => customElements.get('sf-editor-overlay'), null, {timeout: 25000});
  await page.evaluate(async (letter) => {
    const frame = document.getElementById('letter');
    const overlay = document.getElementById('ov');
    overlay.attachFrame(frame);
    await new Promise((done) => { frame.addEventListener('load', done, {once: true}); frame.srcdoc = letter; });
    const doc = frame.contentDocument;
    frame.style.height = `${doc.documentElement.offsetHeight}px`;
    overlay.setNodes([
      {id: 'f1', kind: 'block', element: doc.querySelector('[data-b="f1"]')},
      {id: 'f2', kind: 'block', element: doc.querySelector('[data-b="f2"]')},
      {id: 't2', kind: 'text', element: doc.querySelector('[data-t="t2"]'), parent: 'f2', editable: true},
      {id: 'f3', kind: 'block', element: doc.querySelector('[data-b="f3"]')},
    ]);
  }, letter);
  await listen(page);
  await settle(page);
  const framed = (selector, dx = 30, dy = 12) => page.evaluate(({selector, dx, dy}) => {
    const frame = document.getElementById('letter');
    const inner = frame.contentDocument.querySelector(selector).getBoundingClientRect();
    const outer = frame.getBoundingClientRect();
    return {x: outer.left + inner.left + dx, y: outer.top + inner.top + dy, frame: {x: inner.left + dx, y: inner.top + dy}};
  }, {selector, dx, dy});
  at = await framed('[data-b="f1"]');
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  report.frameDouble = {open: await heard(page, 'open'), want: at.frame};
  check(report.frameDouble.open.length === 1 && report.frameDouble.open[0].id === 'f1' && report.frameDouble.open[0].trigger === 'dblclick' && pointMatches(report.frameDouble.open[0].point, at.frame), 'framed: a double click on a block sends open once, at the pointer in the frame', report.frameDouble);
  await clear(page);
  await page.waitForTimeout(600);
  at = await framed('[data-t="t2"]', 10, 8);
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  report.frameEditable = {open: await heard(page, 'open'), editing: await page.evaluate(() => document.getElementById('ov').hasAttribute('data-sf-overlay-editing'))};
  check(report.frameEditable.open.length === 0 && report.frameEditable.editing, 'framed: an editable node edits on a double click and sends no open', report.frameEditable);
  await page.keyboard.press('Escape');
  await settle(page);
  // Passive over the frame: a click in it is the letter's.
  await page.evaluate(() => {
    const doc = document.getElementById('letter').contentDocument;
    window.lab.frameClicks = [];
    doc.addEventListener('click', (event) => window.lab.frameClicks.push(event.defaultPrevented));
    document.getElementById('ov').passive = true;
  });
  await clear(page);
  await page.waitForTimeout(600);
  at = await framed('[data-b="f3"]');
  await page.mouse.click(at.x, at.y);
  await page.mouse.dblclick(at.x, at.y);
  await settle(page);
  report.framePassive = await page.evaluate(() => ({heard: window.lab.heard.map(([verb]) => verb), clicks: window.lab.frameClicks}));
  check(report.framePassive.heard.length === 0 && report.framePassive.clicks.length >= 1 && report.framePassive.clicks.every((prevented) => !prevented), 'framed and passive: clicks are the letter\'s, nothing selected or opened', report.framePassive);
  check(errors.length === 0, 'no page errors in framed mode', errors);

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
console.log('OVERLAY_PASSIVE_OPEN_OK');

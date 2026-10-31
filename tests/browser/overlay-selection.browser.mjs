#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Selecting, moving and adding a block: the owner's decision of 2026-10-31, the
// behaviour of prototypes/block-canvas.html ("top", the toolbar above the block)
// on sf-composition-overlay. The page is an editor's: a scroller holding the
// overlay and a same-origin frame as tall as its letter, one block taller than the
// scroller, and a host that moves blocks in the frame's DOM without reloading it.
// Every line below is measured frame by frame, not read from the code.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const letter = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff;color:#111;font:16px/24px sans-serif;overflow:hidden}
  [data-b]{padding:16px 24px;border-bottom:1px solid #ddd}
  .short{height:120px}.tall{height:900px}
</style></head><body>
  <div data-b="b1" class="short">Первый</div><div data-b="b2" class="short">Второй</div><div data-b="b3" class="short">Третий</div>
  <div data-b="b4" class="tall">Высокий</div><div data-b="b5" class="short">Пятый</div><div data-b="b6" class="short">Шестой</div>
</body></html>`;

const head = `<meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>`;

const pages = {
  // The toolbar's room above the first block is the host's: the scroller's own padding.
  '/frame': (attrs) => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0; height: 100% }
    .bar { height: 48px; background: #eee }
    #well { height: 500px; overflow: auto; padding: 56px 24px 24px; scroll-behavior: auto; background: #f4f4f8; ${attrs.get('contain') ? 'contain: layout;' : ''} }
    #letter { display: block; width: 600px; margin-inline: auto; border: 0; background: #fff }
  </style></head><body><div class="bar"></div><div id="well">
    <sf-composition-overlay id="ov" label="Письмо" ${attrs.get('side') ? 'placement="side"' : ''}></sf-composition-overlay>
    <iframe id="letter" sandbox="allow-same-origin" tabindex="-1" title="Письмо"></iframe>
  </div></body></html>`,
  // No room above the first block: the toolbar must still leave it alone.
  '/flush': () => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0; height: 100% }
    #well { height: 500px; overflow: auto; }
    #letter { display: block; width: 600px; margin-inline: auto; border: 0 }
  </style></head><body><div id="well">
    <sf-composition-overlay id="ov" label="Письмо"></sf-composition-overlay>
    <iframe id="letter" sandbox="allow-same-origin" tabindex="-1" title="Письмо"></iframe>
  </div></body></html>`,
  // Outside the scroller the overlay follows by script, as before.
  '/outside': () => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0; height: 100% }
    #well { height: 500px; overflow: auto; padding: 56px 24px 24px }
    #letter { display: block; width: 600px; margin-inline: auto; border: 0 }
  </style></head><body><sf-composition-overlay id="ov" label="Письмо"></sf-composition-overlay><div id="well">
    <iframe id="letter" sandbox="allow-same-origin" tabindex="-1" title="Письмо"></iframe>
  </div></body></html>`,
  // A Composition canvas on the page itself, with {id, label} callers.
  '/canvas': () => `<!doctype html><html lang="ru" class="theme-light"><head>${head}<style>
    html, body { margin: 0 }
    #canvas { padding: 120px 40px 900px; }
    #canvas p { margin: 0; height: 100px; background: #eee; border-bottom: 1px solid #ccc }
  </style></head><body>
    <sf-composition-overlay id="ov" for="canvas"></sf-composition-overlay>
    <div id="canvas"><section data-sf-composition-id="root"><p data-sf-composition-id="a">A</p><p data-sf-composition-id="b">B</p><p data-sf-composition-id="c">C</p></section></div>
  </body></html>`,
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

const ACTIONS = [
  {id: 'grip', label: 'Перетащить', icon: 'drag_indicator'},
  {id: 'up', label: 'Выше', icon: 'arrow_upward', shortcut: '⌥↑'},
  {id: 'down', label: 'Ниже', icon: 'arrow_downward', shortcut: '⌥↓'},
  {id: 'dup', label: 'Дублировать', icon: 'content_copy', shortcut: '⌘D'},
  {id: 'del', label: 'Удалить', icon: 'delete', shortcut: '⌫', tone: 'danger'},
];

const failures = [];
const report = {};
const check = (value, name, details = null) => { if (!value) failures.push({name, details}); };

// In the page: the host's side. It moves blocks in the frame's DOM, as a host that
// patches its letter does, and tells the overlay the new order.
const prepareFrame = async (page, path, {actions = ACTIONS} = {}) => {
  await page.goto(`${base}${path}`);
  await page.waitForFunction(() => customElements.get('sf-composition-overlay'), null, {timeout: 25000});
  await page.evaluate(async ({letter, actions}) => {
    const frame = document.getElementById('letter');
    const overlay = document.getElementById('ov');
    overlay.attachFrame(frame);
    await new Promise((done) => { frame.addEventListener('load', done, {once: true}); frame.srcdoc = letter; });
    const doc = frame.contentDocument;
    frame.style.height = `${doc.documentElement.offsetHeight}px`;
    window.lab = {loads: 0, heard: [], positions: 0};
    frame.addEventListener('load', () => { window.lab.loads += 1; });
    for (const verb of ['select', 'apply', 'insert', 'move']) overlay.addEventListener(`sf-composition-overlay-${verb}`, (event) => window.lab.heard.push([verb, event.detail]));
    const position = overlay.position;
    overlay.position = function counted() { window.lab.positions += 1; return position.call(this); };
    window.lab.block = (id) => doc.querySelector(`[data-b="${id}"]`);
    window.lab.sync = () => overlay.setNodes([...doc.querySelectorAll('[data-b]')].map((element) => ({id: element.dataset.b, kind: 'block', element, label: element.textContent})));
    window.lab.move = (id, beforeId) => {
      doc.body.insertBefore(window.lab.block(id), beforeId ? window.lab.block(beforeId) : null);
      window.lab.sync();
    };
    window.lab.boxes = (id) => {
      const inner = window.lab.block(id).getBoundingClientRect();
      const outer = frame.getBoundingClientRect();
      const box = (element) => { if (!element || element.hidden) return null; const r = element.getBoundingClientRect(); return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height}; };
      const scroller = document.getElementById('well').getBoundingClientRect();
      return {
        block: {left: outer.left + inner.left, top: outer.top + inner.top, right: outer.left + inner.right, bottom: outer.top + inner.bottom, width: inner.width, height: inner.height},
        frame: box(overlay.querySelector('.sf-composition-overlay-frame--selected')),
        hover: box(overlay.querySelector('.sf-composition-overlay-frame--hover')),
        toolbar: box(overlay.querySelector('.sf-composition-overlay-toolbar')),
        port: {top: scroller.top, bottom: scroller.bottom, left: scroller.left, right: scroller.right},
      };
    };
    // Samples per animation frame: run(sample) until it resolves.
    window.lab.trace = async (id, run, frames = 30) => {
      const samples = [];
      let on = true;
      const tick = () => { if (!on) return; samples.push(window.lab.boxes(id)); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await run();
      await new Promise((done) => { let left = frames; const wait = () => { left -= 1; if (left <= 0) done(); else requestAnimationFrame(wait); }; requestAnimationFrame(wait); });
      on = false;
      return samples;
    };
    window.lab.sync();
    overlay.setActions(actions);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, {letter, actions});
  // sf-icon-button and sf-tooltip load from setActions on, before the first selection.
  if (actions.some((action) => action.icon)) await page.waitForFunction(() => customElements.get('sf-icon-button') && customElements.get('sf-tooltip') && document.querySelector('.sf-composition-overlay-toolbar button'), null, {timeout: 25000});
};
const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
const well = (page, top) => page.evaluate((top) => { document.getElementById('well').scrollTop = top; }, top);
const select = async (page, id) => { await page.evaluate((id) => document.getElementById('ov').select(id), id); await settle(page); };
const boxes = (page, id) => page.evaluate((id) => window.lab.boxes(id), id);
const overlaps = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
const heard = (page, verb) => page.evaluate((verb) => window.lab.heard.filter(([name]) => name === verb).map(([, detail]) => detail), verb);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({locale: 'ru-RU', viewport: {width: 1100, height: 700}});
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push({name: 'page error', details: error.message}));
  await prepareFrame(page, '/frame');

  // Item 1, 2: icon-only at 32px, named by the label, a tooltip with the shortcut.
  await select(page, 'b2');
  const tools = await page.evaluate(() => [...document.querySelectorAll('.sf-composition-overlay-toolbar button')].map((button) => {
    const box = button.getBoundingClientRect();
    return {action: button.dataset.action, name: button.getAttribute('aria-label'), text: button.textContent.trim().length, width: Math.round(box.width), height: Math.round(box.height), left: Math.round(box.left)};
  }));
  report.tools = tools;
  check(tools.length === 5 && tools.every((tool) => tool.height === 32 && tool.width === 32), 'an action with an icon is an icon button of 32 px', tools);
  check(tools[1].name === 'Выше' && tools[4].name === 'Удалить', 'the label is the accessible name', tools);
  await page.hover('button[data-action="up"]');
  await page.waitForTimeout(400);
  const tip = await page.evaluate(() => {
    const surface = document.querySelector('button[data-action="up"]').closest('.sf-tooltip-anchor').querySelector('sf-tooltip');
    return {hidden: surface.hidden, text: surface.textContent.replace(/\s+/gu, ' ').trim()};
  });
  report.tip = tip;
  check(!tip.hidden && tip.text === 'Выше ⌥↑', 'the tooltip holds the label and the shortcut', tip);
  // tone danger colours hover only.
  const danger = await page.evaluate(() => { const icon = document.querySelector('button[data-action="del"] .sf-icon'); return getComputedStyle(icon).color; });
  const neutral = await page.evaluate(() => { const icon = document.querySelector('button[data-action="dup"] .sf-icon'); return getComputedStyle(icon).color; });
  await page.hover('button[data-action="del"]');
  await page.waitForTimeout(300);
  const dangerHover = await page.evaluate(() => getComputedStyle(document.querySelector('button[data-action="del"] .sf-icon')).color);
  report.danger = {danger, neutral, dangerHover};
  check(danger === neutral && dangerHover !== neutral, 'tone danger colours the hover only', report.danger);
  // An unavailable action dims in place.
  const before = tools.map((tool) => tool.left);
  await page.evaluate((actions) => document.getElementById('ov').setActions(actions.map((action) => (action.id === 'up' ? {...action, disabled: true} : action))), ACTIONS);
  await settle(page);
  const dimmed = await page.evaluate(() => [...document.querySelectorAll('.sf-composition-overlay-toolbar button')].map((button) => ({left: Math.round(button.getBoundingClientRect().left), disabled: button.disabled, action: button.dataset.action})));
  check(JSON.stringify(dimmed.map((one) => one.left)) === JSON.stringify(before) && dimmed[1].disabled && !dimmed[2].disabled, 'an unavailable action stays where it is, its neighbours do not move', {before, dimmed});
  await page.mouse.move(5, 5);
  const heardBefore = (await heard(page, 'apply')).length;
  await page.evaluate(() => document.querySelector('button[data-action="up"]').click());
  check((await heard(page, 'apply')).length === heardBefore, 'an unavailable action sends nothing', null);
  await page.evaluate((actions) => document.getElementById('ov').setActions(actions), ACTIONS);
  await settle(page);

  // Item 3: above the block, right-aligned, inside the canvas, never on the block.
  let m = await boxes(page, 'b2');
  report.above = m;
  check(m.toolbar.bottom <= m.block.top && Math.abs(m.toolbar.right - m.block.right) <= 1, 'the toolbar stands above the block, right-aligned', m);
  // Every block that fits, at every scroll position: the toolbar never covers it.
  const covered = [];
  for (const id of ['b1', 'b2', 'b3', 'b5', 'b6']) {
    await select(page, id);
    for (let top = 0; top <= 1400; top += 70) {
      await well(page, top);
      const one = await boxes(page, id);
      if (one.toolbar && overlaps(one.toolbar, one.block)) covered.push({id, top, toolbar: one.toolbar, block: one.block});
    }
  }
  report.coveredWhereItFits = covered.length;
  check(covered.length === 0, 'the toolbar never covers a selected block that fits the canvas', covered.slice(0, 3));
  await well(page, 0);

  // A tall block keeps its toolbar on screen while the block is, and until its top
  // is off screen the toolbar stands above it too.
  await select(page, 'b4');
  const offScreen = [];
  const coveredWhileTopShows = [];
  const tall = await boxes(page, 'b4');
  const tallTop = tall.block.top;
  for (let top = 0; top <= 2000; top += 40) {
    await well(page, top);
    const one = await boxes(page, 'b4');
    const showing = one.block.bottom > one.port.top + 60 && one.block.top < one.port.bottom - 60;
    if (showing && !(one.toolbar && one.toolbar.top >= one.port.top - 0.5 && one.toolbar.bottom <= one.port.bottom + 0.5)) offScreen.push({top, toolbar: one.toolbar, block: one.block, port: one.port});
    if (one.toolbar && one.block.top - one.toolbar.height - 4 >= one.port.top && overlaps(one.toolbar, one.block)) coveredWhileTopShows.push({top, toolbar: one.toolbar, block: one.block});
  }
  report.tall = {height: tall.block.height, top: tallTop, offScreen: offScreen.length, coveredWhileTopShows: coveredWhileTopShows.length};
  check(offScreen.length === 0, 'a tall block keeps its toolbar on screen while the block is', offScreen.slice(0, 3));
  check(coveredWhileTopShows.length === 0, 'while a tall block\'s top shows, the toolbar stands above it', coveredWhileTopShows.slice(0, 3));
  await well(page, 0);

  // Item 4: no script on scroll; frame and block share a position in every frame.
  await select(page, 'b4');
  await page.evaluate(() => { window.lab.positions = 0; });
  const scrollTrace = await page.evaluate(async () => {
    const well = document.getElementById('well');
    return window.lab.trace('b4', async () => {
      for (let top = 0; top <= 900; top += 30) {
        well.scrollTop = top;
        await new Promise((done) => requestAnimationFrame(done));
      }
    }, 3);
  });
  const scrollGaps = scrollTrace.map((one) => Math.max(Math.abs(one.frame.top - one.block.top), Math.abs(one.frame.left - one.block.left)));
  const scrollRuns = await page.evaluate(() => window.lab.positions);
  report.scroll = {samples: scrollTrace.length, worstGap: Math.max(...scrollGaps), positionCalls: scrollRuns};
  check(scrollTrace.length >= 25 && Math.max(...scrollGaps) <= 0.5, 'the frame and the block share a position in every frame of a scroll', report.scroll);
  check(scrollRuns === 0, 'nothing is measured on scroll', report.scroll);
  await well(page, 0);

  // Select: the frame is on the block in the first painted frame, with no transition.
  const selectTrace = await page.evaluate(async () => window.lab.trace('b3', async () => document.getElementById('ov').select('b3'), 8));
  const onSelect = selectTrace.filter((one) => one.frame).map((one) => Math.abs(one.frame.top - one.block.top));
  const toolbarTops = new Set(selectTrace.filter((one) => one.toolbar).map((one) => Math.round(one.toolbar.top)));
  report.select = {samples: selectTrace.length, worstGap: Math.max(...onSelect), toolbarTops: [...toolbarTops]};
  check(onSelect.length === selectTrace.length && Math.max(...onSelect) <= 0.5, 'on select the frame is on the block from the first frame', report.select);
  check(toolbarTops.size === 1, 'on select the toolbar arrives in its place and does not travel', report.select);

  // Item 5: bare frames.
  await page.evaluate(() => document.getElementById('ov').select('b1'));
  await settle(page);
  const hoverAt = await boxes(page, 'b3');
  await page.mouse.move(hoverAt.block.left + 100, hoverAt.block.top + 60);
  await settle(page);
  const look = await page.evaluate(() => {
    const read = (selector) => { const element = document.querySelector(selector); const style = getComputedStyle(element); return {width: style.borderTopWidth, style: style.borderTopStyle, fill: style.backgroundColor, text: element.textContent, hidden: element.hidden}; };
    return {hover: read('.sf-composition-overlay-frame--hover'), selected: read('.sf-composition-overlay-frame--selected')};
  });
  report.look = look;
  check(!look.hover.hidden && look.hover.width === '1px' && look.hover.style === 'solid' && look.hover.fill === 'rgba(0, 0, 0, 0)' && look.hover.text === '', 'hover is a 1 px frame with no label and no fill', look.hover);
  check(look.selected.width === '2px' && look.selected.fill === 'rgba(0, 0, 0, 0)', 'selection is a 2 px frame with no tint', look.selected);

  // Item 6: one place to add, at the seam under the pointer.
  await select(page, 'b2');
  await page.mouse.move(5, 5);
  await settle(page);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.sf-composition-overlay-insert[data-sf-insert-shown]')].map((button) => ({index: button.dataset.index, opacity: getComputedStyle(button).opacity, size: Math.round(button.querySelector('.sf-composition-overlay-insert-mark').getBoundingClientRect().width), line: Math.round(button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2)})));
  check((await shown()).length === 0, 'nothing to add is shown on the selected block', await shown());
  const seamBox = await boxes(page, 'b3');
  await page.mouse.move(seamBox.block.left + 200, seamBox.block.top + 9);
  await page.waitForTimeout(60);
  const seam = await shown();
  report.seam = seam;
  check(seam.length === 1 && seam[0].index === '2' && seam[0].size === 24 && Math.abs(seam[0].line - seamBox.block.top) <= 1, 'one line and one 24 px «+», only at the seam under the pointer', {seam, at: seamBox.block.top});
  await page.mouse.move(seamBox.block.left + 200, seamBox.block.top + 30);
  await page.waitForTimeout(40);
  const stays = (await shown()).length;
  await page.waitForTimeout(220);
  const gone = (await shown()).length;
  report.seamLeave = {after40ms: stays, after260ms: gone};
  check(stays === 1 && gone === 0, 'the place stays a moment after the pointer leaves, then goes', report.seamLeave);
  // The pointer reaches the button, however it comes.
  await page.mouse.move(seamBox.block.left + 300, seamBox.block.top - 5);
  await page.waitForTimeout(60);
  const mark = await page.evaluate(() => { const box = document.querySelector('.sf-composition-overlay-insert[data-sf-insert-shown] .sf-composition-overlay-insert-mark').getBoundingClientRect(); return {x: box.left + box.width / 2, y: box.top + box.height / 2}; });
  await page.mouse.move(mark.x, mark.y, {steps: 4});
  await page.waitForTimeout(260);
  check((await shown()).length === 1, 'the place stays while the pointer is on its button', null);
  await page.mouse.click(mark.x, mark.y);
  const inserted = (await heard(page, 'insert')).at(-1);
  check(inserted?.index === 2 && inserted?.parent === '' && inserted?.slot === 'default', 'the «+» asks for its place', inserted);
  await page.evaluate(() => document.getElementById('ov').setInsertionTarget(null));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(260);

  // Item 7: a move glides, the frame with the block, and scroll holds.
  await well(page, 60);
  await select(page, 'b2');
  await page.evaluate(() => { window.lab.scrollBefore = document.getElementById('well').scrollTop; });
  const moveTrace = await page.evaluate(async () => {
    const started = performance.now();
    const samples = await window.lab.trace('b2', async () => {
      window.lab.move('b2', 'b1');
    }, 18);
    return {samples, took: performance.now() - started, scroll: document.getElementById('well').scrollTop, before: window.lab.scrollBefore};
  });
  const moveGaps = moveTrace.samples.map((one) => Math.abs(one.frame.top - one.block.top));
  const blockPath = moveTrace.samples.map((one) => one.block.top);
  const steps = blockPath.slice(1).map((top, index) => top - blockPath[index]);
  const moved = await boxes(page, 'b2');
  report.move = {samples: moveTrace.samples.length, worstGap: Math.max(...moveGaps), path: blockPath.map((top) => Math.round(top)), scroll: moveTrace.scroll, before: moveTrace.before, frameAtEnd: Math.abs(moved.frame.top - moved.block.top)};
  const inMotion = new Set(blockPath.map((top) => Math.round(top))).size;
  check(inMotion >= 4, 'a move glides: the block is seen on its way', report.move);
  check(steps.every((step) => step <= 0.5), 'the block travels one way, without a jump back', report.move);
  check(Math.max(...moveGaps) <= 1.5, 'the frame and the block reach their place together', report.move);
  check(moveTrace.scroll === moveTrace.before, 'the scroll position holds across a move', report.move);
  check((await page.evaluate(() => window.lab.loads)) === 0, 'the frame never loads across a move', null);
  // The whole glide takes 180 ms.
  const clocked = await page.evaluate(async () => {
    document.getElementById('ov').select('b1');
    window.lab.move('b1', 'b4');
    const running = window.lab.block('b1').getAnimations();
    return {duration: running[0]?.effect.getTiming().duration ?? null, frame: document.querySelector('.sf-composition-overlay-frame--selected').getAnimations()[0]?.effect.getTiming().duration ?? null};
  });
  report.clock = clocked;
  check(clocked.duration === 180 && clocked.frame === 180, 'blocks and the frame glide for 180 ms', clocked);
  await page.waitForTimeout(260);

  // Item 8: dragging by the grip.
  await prepareFrame(page, '/frame');
  await select(page, 'b2');
  const grip = await page.evaluate(() => { const box = document.querySelector('button[data-action="grip"]').getBoundingClientRect(); return {x: box.left + box.width / 2, y: box.top + box.height / 2}; });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y + 3);
  check(await page.evaluate(() => getComputedStyle(window.lab.block('b2')).opacity) === '1', 'a press without a move is no drag', null);
  await page.mouse.move(grip.x, grip.y + 200, {steps: 6});
  await page.waitForTimeout(60);
  const dragging = await page.evaluate(() => {
    const hint = document.querySelector('.sf-composition-overlay-drop');
    const box = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
    return {opacity: getComputedStyle(window.lab.block('b2')).opacity, line: box ? {top: box.top, height: box.height, width: box.width} : null, lines: document.querySelectorAll('.sf-composition-overlay-drop:not([hidden])').length};
  });
  report.drag = dragging;
  check(Number(dragging.opacity) < 0.5, 'the dragged block dims', dragging);
  check(dragging.lines === 1 && dragging.line?.width > 100, 'one line shows where it lands', dragging);
  // Near the canvas's lower edge it scrolls.
  const scrollAtStart = await page.evaluate(() => document.getElementById('well').scrollTop);
  const edge = await page.evaluate(() => document.getElementById('well').getBoundingClientRect().bottom);
  await page.mouse.move(grip.x, edge - 10, {steps: 3});
  await page.waitForTimeout(300);
  const scrollAfter = await page.evaluate(() => document.getElementById('well').scrollTop);
  report.dragScroll = {from: scrollAtStart, to: scrollAfter};
  check(scrollAfter > scrollAtStart, 'the canvas scrolls near its edge', report.dragScroll);
  // Escape cancels: nothing moved, nothing said.
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const cancelled = await page.evaluate(() => ({opacity: getComputedStyle(window.lab.block('b2')).opacity, line: document.querySelectorAll('.sf-composition-overlay-drop:not([hidden])').length, order: [...window.lab.block('b1').parentElement.children].map((element) => element.dataset.b).join(' ')}));
  check(cancelled.opacity === '1' && cancelled.line === 0, 'Escape cancels the drag', cancelled);
  check((await heard(page, 'move')).length === 0 && (await heard(page, 'apply')).length === 0, 'a cancelled drag says nothing', await heard(page, 'move'));
  // A drop says move, with the index among the other blocks.
  await well(page, 0);
  await settle(page);
  const again = await page.evaluate(() => { const box = document.querySelector('button[data-action="grip"]').getBoundingClientRect(); return {x: box.left + box.width / 2, y: box.top + box.height / 2}; });
  const target = await boxes(page, 'b4');
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x, target.block.top + 2, {steps: 6});
  await page.waitForTimeout(60);
  await page.mouse.up();
  const drop = (await heard(page, 'move')).at(-1);
  report.drop = drop;
  check(drop?.id === 'b2' && drop?.position === 2 && drop?.parent === '' && drop?.slot === 'default', 'a drop sends move with the place among the other blocks', drop);

  // Item 9: the keys, as host-mapped actions, from inside the frame too.
  await prepareFrame(page, '/frame', {actions: [...ACTIONS, {id: 'edit', label: 'Править', shortcut: 'Enter'}]});
  const b3 = await boxes(page, 'b3');
  await page.mouse.click(b3.block.left + 80, b3.block.top + 60);
  await settle(page);
  check(await page.evaluate(() => document.getElementById('ov').selectedId) === 'b3', 'a click in the frame selects', null);
  const presses = [['Alt+ArrowUp', 'up'], ['Alt+ArrowDown', 'down'], ['Control+d', 'dup'], ['Backspace', 'del'], ['Enter', 'edit']];
  for (const [key, action] of presses) {
    await page.keyboard.press(key);
    const last = (await heard(page, 'apply')).at(-1);
    check(last?.action === action && last?.ids?.[0] === 'b3', `${key} asks for ${action} on the selected block`, last);
  }
  // From the tree too, and an unavailable action takes the key and does nothing.
  await page.evaluate((actions) => document.getElementById('ov').setActions(actions.map((action) => (action.id === 'up' ? {...action, disabled: true} : action))), ACTIONS);
  await page.evaluate(() => document.querySelector('.sf-composition-overlay-tree').focus());
  const applied = (await heard(page, 'apply')).length;
  await page.keyboard.press('Alt+ArrowUp');
  check((await heard(page, 'apply')).length === applied && await page.evaluate(() => document.getElementById('ov').selectedId) === 'b3', 'an unavailable action takes its key and does nothing', null);
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.getElementById('ov').selectedId) === 'b4', 'the documented keys stay: ArrowDown walks the nodes', null);

  // Item 3: the first block with no room above: inside the canvas, not on the block.
  await prepareFrame(page, '/flush');
  await select(page, 'b1');
  const flush = await boxes(page, 'b1');
  report.flush = flush;
  check(flush.toolbar.top >= flush.port.top - 0.5 && !overlaps(flush.toolbar, flush.block), 'with no room above, the toolbar stays inside the canvas and off the block', flush);

  // placement="side": beside the block, where there is room; above where there is none.
  await prepareFrame(page, '/frame?side=1');
  await select(page, 'b2');
  const side = await boxes(page, 'b2');
  report.side = side;
  check(side.toolbar.left >= side.block.right && !overlaps(side.toolbar, side.block), 'placement side stands beside the block', side);
  await page.setViewportSize({width: 640, height: 700});
  await page.evaluate(() => document.getElementById('ov').refresh());
  await settle(page);
  const narrow = await boxes(page, 'b2');
  report.sideNarrow = narrow;
  check(narrow.toolbar.bottom <= narrow.block.top + 0.5, 'placement side goes above where there is no room beside the block', narrow);
  await page.setViewportSize({width: 1100, height: 700});

  // Under an ancestor with contain: layout (#58), it all still holds.
  await prepareFrame(page, '/frame?contain=1');
  await select(page, 'b2');
  const contained = await boxes(page, 'b2');
  report.contained = {gap: Math.abs(contained.frame.top - contained.block.top)};
  check(Math.abs(contained.frame.top - contained.block.top) <= 0.5 && contained.toolbar.bottom <= contained.block.top, 'in a contained scroller the parts stay on the block', contained);

  // Reduced motion: none of it.
  await page.emulateMedia({reducedMotion: 'reduce'});
  await prepareFrame(page, '/frame');
  await select(page, 'b2');
  const still = await page.evaluate(async () => {
    window.lab.move('b2', 'b1');
    return {block: window.lab.block('b2').getAnimations().length, frame: document.querySelector('.sf-composition-overlay-frame--selected').getAnimations().length};
  });
  await settle(page);
  const stillBoxes = await boxes(page, 'b2');
  report.reduced = still;
  check(still.block === 0 && still.frame === 0 && Math.abs(stillBoxes.frame.top - stillBoxes.block.top) <= 0.5, 'with prefers-reduced-motion nothing glides', still);
  await page.emulateMedia({reducedMotion: 'no-preference'});

  // An overlay outside the scroller still follows by script, on the block.
  await prepareFrame(page, '/outside');
  await select(page, 'b2');
  await well(page, 90);
  await settle(page);
  const outside = await boxes(page, 'b2');
  report.outside = {place: await page.evaluate(() => document.getElementById('ov').getAttribute('data-sf-overlay-place')), gap: Math.abs(outside.frame.top - outside.block.top)};
  check(report.outside.place === 'viewport' && report.outside.gap <= 1, 'an overlay outside the scroller follows it by script', report.outside);

  // {id, label} callers: the same text buttons, the same events, on a canvas too.
  await page.goto(`${base}/canvas`);
  await page.waitForFunction(() => customElements.get('sf-composition-overlay'), null, {timeout: 25000});
  const plain = await page.evaluate(async () => {
    const overlay = document.getElementById('ov');
    const before = document.getElementById('canvas').innerHTML;
    const heard = [];
    overlay.addEventListener('sf-composition-overlay-apply', (event) => heard.push(event.detail));
    overlay.addEventListener('sf-composition-overlay-action', (event) => heard.push(event.detail));
    overlay.attach(document.getElementById('canvas'));
    overlay.setDocument({schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout', root: {id: 'root', type: 'layout.section', slots: {default: [{id: 'a', type: 'content.paragraph'}, {id: 'b', type: 'content.paragraph'}, {id: 'c', type: 'content.paragraph'}]}}}, {describe: (node) => ({label: node.id})});
    overlay.setActions([{id: 'up', label: 'Выше'}, {id: 'remove', label: 'Удалить'}]);
    overlay.select('b');
    // What the selection asks to observe has reported before the count starts.
    await new Promise((done) => setTimeout(done, 200));
    const buttons = [...overlay.querySelectorAll('.sf-composition-overlay-action')];
    const element = document.querySelector('[data-sf-composition-id="b"]').getBoundingClientRect();
    const toolbar = overlay.querySelector('.sf-composition-overlay-toolbar').getBoundingClientRect();
    const position = overlay.position;
    let runs = 0;
    overlay.position = function counted() { runs += 1; return position.call(this); };
    window.scrollTo(0, 70);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const after = document.querySelector('[data-sf-composition-id="b"]').getBoundingClientRect();
    const frame = overlay.querySelector('.sf-composition-overlay-frame--selected').getBoundingClientRect();
    buttons[0].click();
    return {
      labels: buttons.map((button) => [button.tagName, button.dataset.action, button.textContent]),
      above: toolbar.bottom <= element.top + 0.5,
      gap: Math.abs(after.top - frame.top),
      runs,
      heard,
      same: document.getElementById('canvas').innerHTML === before,
      place: overlay.getAttribute('data-sf-overlay-place'),
    };
  });
  report.plain = plain;
  check(JSON.stringify(plain.labels) === JSON.stringify([['BUTTON', 'up', 'Выше'], ['BUTTON', 'remove', 'Удалить']]), '{id, label} actions are the same text buttons', plain.labels);
  check(JSON.stringify(plain.heard) === JSON.stringify([{action: 'up', scope: 'entry', ids: ['b']}, {action_id: 'up', node_id: 'b'}]), '{id, label} actions send what they sent', plain.heard);
  check(plain.place === 'content' && plain.gap <= 0.5 && plain.runs === 0, 'on the page itself the parts travel with the content too', plain);
  check(plain.above && plain.same, 'the toolbar stands above the node and the canvas HTML is untouched', plain);

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
console.log('OVERLAY_SELECTION_OK');

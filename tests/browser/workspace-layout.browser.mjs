#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The workspace layout (core.css .sf-workspace, core.js SF.workspace; design
// 2026-10-30 for UI Chat), on the built core. The viewport stays 1280 wide the
// whole time: only the CONTAINER is resized, so every change seen here is the
// container query's, never the viewport's.
//   1. wide (from 64rem): rail | list | main | panel side by side, the widths
//      of the variables, the panel shown only while open;
//   2. middle (40-64rem): rail | list | main, the open panel a drawer over main
//      at the end edge; the other regions inert; Escape and a press on the
//      scrim close it and focus goes back to the opener; Tab stays inside;
//   3. the panel's open state survives a width change (column, drawer, column);
//   4. narrow: one region at a time; data-sf-workspace-view="main" shows main
//      with its back control; Back returns to the list and focus to the row
//      marked aria-current; the rail goes with the list;
//   5. data-sf-workspace-list="hidden": main without the list at every width,
//      no back control;
//   6. events sf-workspace-view {view} and sf-workspace-panel {open};
//   7. RTL mirrors the row and puts the drawer at the left edge;
//   8. prefers-reduced-motion: the drawer does not slide;
//   9. the width classes move the thresholds.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error('core.js not found');

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, detail}); };

const page = (dir = 'ltr', extraClass = '') => `<!doctype html><html lang="en" dir="${dir}" class="theme-light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>body{margin:0} #host{block-size:600px;inline-size:1100px} .row{display:block;padding:8px} .rail button{display:block}</style>
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'workspace', pluginListVersion: 'workspace', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
</head><body>
<button id="before">before</button>
<div id="host">
  <div class="sf-workspace ${extraClass}" id="ws" data-sf-workspace-view="list">
    <nav class="sf-workspace-rail rail" aria-label="Spaces"><button id="rail-a">A</button></nav>
    <section class="sf-workspace-list" aria-label="Conversations">
      <button class="row" id="row-1" data-open="1">One</button>
      <button class="row" id="row-2" data-open="2">Two</button>
      <button class="row" id="row-3" data-open="3">Three</button>
    </section>
    <section class="sf-workspace-main" aria-label="Conversation">
      <button class="sf-workspace-back" type="button" id="back">Back</button>
      <h2 id="title">Conversation</h2>
      <button id="opener" type="button">Sources</button>
      <input id="composer" aria-label="Message">
    </section>
    <aside class="sf-workspace-panel" aria-label="Sources">
      <button id="panel-first" type="button">First</button>
      <button id="panel-last" type="button">Last</button>
    </aside>
  </div>
</div>
<button id="after">after</button>
<script src="/distr/core/js/core.js"></script>
<script>
  window.__events = [];
  const ws = document.getElementById('ws');
  ws.addEventListener('sf-workspace-view', (event) => window.__events.push(['view', event.detail.view]));
  ws.addEventListener('sf-workspace-panel', (event) => window.__events.push(['panel', event.detail.open]));
  // The host opens a conversation: it marks the row and shows main.
  ws.querySelector('.sf-workspace-list').addEventListener('click', (event) => {
    const row = event.target.closest('[data-open]');
    if (!row) return;
    for (const other of ws.querySelectorAll('[data-open]')) other.removeAttribute('aria-current');
    row.setAttribute('aria-current', 'true');
    window.SF.workspace(ws).show('main');
  });
  document.getElementById('opener').addEventListener('click', () => window.SF.workspace(ws).panel(true));
</script>
</body></html>`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  let current = page();
  await tab.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: current});
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  const open = async (html) => {
    current = html;
    await tab.goto('http://probe.test/');
    await tab.waitForFunction(() => typeof window.SF?.workspace === 'function');
  };
  const width = async (px) => {
    await tab.evaluate((value) => { document.getElementById('host').style.inlineSize = `${value}px`; }, px);
    // The resize observer reports in the next frame.
    await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  // The drawer's slide: measured once it has come to rest.
  const settle = () => tab.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const boxes = async () => (await settle(), tab.evaluate(() => Object.fromEntries(['rail', 'list', 'main', 'panel'].map((name) => {
    const element = document.querySelector(`#ws > .sf-workspace-${name}`);
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return [name, {shown: style.display !== 'none' && box.width > 0, x: Math.round(box.x), right: Math.round(box.right), width: Math.round(box.width),
      position: style.position, inert: element.inert}];
  }))));
  const state = () => tab.evaluate(() => ({active: document.activeElement?.id ?? null, events: window.__events.splice(0),
    layout: window.SF.workspace(document.getElementById('ws')).layout, back: getComputedStyle(document.getElementById('back')).display}));

  // 1. Wide, panel closed, then open.
  await open(page());
  check('the viewport is never resized', (await tab.evaluate(() => innerWidth)) === 1280);
  let b = await boxes();
  evidence.wideClosed = b;
  check('wide: rail, list and main shown, the closed panel not', b.rail.shown && b.list.shown && b.main.shown && !b.panel.shown, b);
  check('wide: list is --sf-workspace-list (20rem)', b.list.width === 320 + 1 || b.list.width === 320, b);
  check('wide: rail, list, main in reading order', b.rail.x < b.list.x && b.list.x < b.main.x, b);
  check('wide: the back control is hidden', (await state()).back === 'none');
  await tab.click('#opener');
  b = await boxes();
  evidence.wideOpen = b;
  let s = await state();
  check('wide: the open panel is a column after main', b.panel.shown && b.panel.position !== 'absolute' && b.panel.x >= b.main.right && b.panel.right <= 1100, b);
  check('wide: the panel is --sf-workspace-panel (22rem)', b.panel.width === 352, b);
  check('wide: layout reads wide and nothing is inert', s.layout === 'wide' && !b.main.inert && !b.list.inert, s);
  check('wide: opening the panel fires sf-workspace-panel {open: true}', JSON.stringify(s.events) === JSON.stringify([['panel', true]]), s);
  check('wide: a column takes no focus', s.active === 'opener', s);

  // 3. The open panel survives a narrower container: it becomes a drawer.
  await width(800);
  b = await boxes();
  s = await state();
  evidence.middleOpen = {b, s};
  check('middle: layout reads split', s.layout === 'split', s);
  check('middle: rail, list and main side by side', b.rail.shown && b.list.shown && b.main.shown && b.list.x < b.main.x, b);
  check('middle: the open panel is a drawer at the end edge over main', b.panel.shown && b.panel.position === 'absolute' && b.panel.right === 800 && b.panel.x < b.main.right && b.panel.x > b.main.x, b);
  check('middle: the regions under the drawer are inert', b.main.inert && b.list.inert && b.rail.inert && !b.panel.inert, b);
  check('middle: focus moved into the drawer', s.active === 'panel-first', s);
  check('middle: no event for a width change', s.events.length === 0, s);
  const shadow = await tab.evaluate(() => getComputedStyle(document.querySelector('#ws > .sf-workspace-panel')).boxShadow);
  check('middle: the drawer carries the scrim', /(?:rgba\(0, 0, 0, 0\.6\)|color\(srgb 0 0 0 \/ 0\.6\)) 0px 0px 0px \d+px$/u.test(shadow), {shadow});
  // Tab stays in the drawer.
  await tab.keyboard.press('Tab');
  await tab.keyboard.press('Tab');
  s = await state();
  check('middle: Tab wraps inside the drawer', s.active === 'panel-first', s);
  await tab.keyboard.press('Shift+Tab');
  s = await state();
  check('middle: Shift+Tab wraps to the last control', s.active === 'panel-last', s);
  // Back to wide: a column again, still open, focus left where it is.
  await width(1100);
  b = await boxes();
  s = await state();
  check('wide again: still open, a column, nothing inert', b.panel.shown && b.panel.position !== 'absolute' && !b.main.inert, {b, s});
  check('wide again: focus stays in the panel', s.active === 'panel-last', s);

  // 2. Escape and the scrim close the drawer; focus returns to the opener.
  await width(800);
  await tab.focus('#panel-first');
  await tab.keyboard.press('Escape');
  b = await boxes();
  s = await state();
  check('Escape closes the drawer', !b.panel.shown && !b.main.inert, b);
  check('Escape: sf-workspace-panel {open: false}', JSON.stringify(s.events) === JSON.stringify([['panel', false]]), s);
  check('Escape: focus returns to what opened it', s.active === 'opener', s);
  await tab.click('#opener');
  s = await state();
  check('the drawer opens from main', s.active === 'panel-first', s);
  await tab.mouse.click(150, 300); // over the list, under the scrim
  b = await boxes();
  s = await state();
  check('a press on the scrim closes the drawer', !b.panel.shown, b);
  check('the scrim press reaches nothing under it', !s.events.some(([type]) => type === 'view'), s);
  check('after the scrim press focus returns to the opener', s.active === 'opener', s);
  // A host attribute alone opens it too.
  await tab.evaluate(() => document.getElementById('ws').setAttribute('data-sf-workspace-panel', 'open'));
  await tab.waitForFunction(() => document.querySelector('#ws > .sf-workspace-main').inert);
  s = await state();
  check('the attribute alone opens the drawer and fires the event', s.events.some(([type, open]) => type === 'panel' && open === true), s);
  await tab.keyboard.press('Escape');

  // 4. Narrow: one region at a time.
  await width(500);
  b = await boxes();
  s = await state();
  evidence.narrowList = b;
  check('narrow: layout reads narrow', s.layout === 'narrow', s);
  check('narrow list view: rail and list, no main', b.rail.shown && b.list.shown && !b.main.shown && !b.panel.shown, b);
  check('narrow list view: the list fills the rest of the row', b.list.right === 500, b);
  await tab.click('#row-2');
  b = await boxes();
  s = await state();
  evidence.narrowMain = {b, s};
  check('narrow main view: main alone, full width', b.main.shown && !b.list.shown && !b.rail.shown && b.main.x === 0 && b.main.width === 500, b);
  check('narrow main view: sf-workspace-view {view: main}', JSON.stringify(s.events) === JSON.stringify([['view', 'main']]), s);
  check('narrow main view: focus on the back control', s.active === 'back' && s.back !== 'none', s);
  await tab.click('#back');
  b = await boxes();
  s = await state();
  check('Back shows the list', b.list.shown && !b.main.shown, b);
  check('Back: sf-workspace-view {view: list}', JSON.stringify(s.events) === JSON.stringify([['view', 'list']]), s);
  check('Back: focus on the row that was open (aria-current)', s.active === 'row-2', s);
  check('Back: the attribute says list', (await tab.getAttribute('#ws', 'data-sf-workspace-view')) === 'list');
  // Keyboard: Enter on a row, Enter on Back.
  await tab.focus('#row-3');
  await tab.keyboard.press('Enter');
  await tab.keyboard.press('Enter');
  s = await state();
  check('keyboard: Enter on Back returns to the row it opened', s.active === 'row-3', s);
  // The narrow drawer.
  await tab.click('#row-1');
  await tab.click('#opener');
  await settle();
  b = await boxes();
  s = await state();
  check('narrow: the drawer fits the container', b.panel.shown && b.panel.position === 'absolute' && b.panel.right === 500 && b.panel.width === 352, b);
  await tab.keyboard.press('Escape');
  s = await state();
  check('narrow: Escape returns focus to the opener', s.active === 'opener', s);
  // Middle ignores the view: list and main both shown with view=main.
  await width(800);
  b = await boxes();
  check('middle ignores the view attribute', b.list.shown && b.main.shown && (await state()).back === 'none', b);

  // The container narrows with focus in the region it hides.
  await tab.focus('#row-2');
  await width(500);
  s = await state();
  check('narrowing with focus in the hidden list moves it to the back control', s.active === 'back', s);
  await width(800);

  // 5. Hidden list.
  await tab.evaluate(() => document.getElementById('ws').setAttribute('data-sf-workspace-list', 'hidden'));
  for (const px of [1100, 800, 500]) {
    await width(px);
    b = await boxes();
    s = await state();
    evidence[`hidden${px}`] = b;
    check(`hidden list at ${px}px: main without the list, no back`, !b.list.shown && b.main.shown && s.back === 'none', {b, s});
  }
  await tab.evaluate(() => document.getElementById('ws').setAttribute('data-sf-workspace-view', 'list'));
  b = await boxes();
  check('hidden list, narrow, view=list: main still shown', b.main.shown && !b.list.shown, b);

  // 9. A class moves the thresholds.
  await open(page('ltr', 'sf-workspace--split-h4 sf-workspace--wide-i0'));
  await width(1100);
  s = await state();
  check('wide-i0: 1100px (68.75rem) is middle', s.layout === 'split', s);
  await width(860);
  s = await state();
  check('split-h4: 860px (53.75rem) is narrow', s.layout === 'narrow', s);
  await width(1300);
  s = await state();
  check('wide-i0: 1300px is wide', s.layout === 'wide', s);

  // 7. RTL.
  await open(page('rtl'));
  await tab.evaluate(() => document.getElementById('ws').setAttribute('data-sf-workspace-panel', 'open'));
  await width(1100);
  b = await boxes();
  evidence.rtlWide = b;
  check('RTL wide: rail at the right, panel at the left', b.rail.x > b.list.x && b.list.x > b.main.x && b.main.x > b.panel.x, b);
  await width(800);
  b = await boxes();
  evidence.rtlMiddle = b;
  const hostLeft = await tab.evaluate(() => Math.round(document.getElementById('host').getBoundingClientRect().x));
  check('RTL middle: the drawer at the container\'s left edge', b.panel.position === 'absolute' && b.panel.x === hostLeft, {b, hostLeft});

  // 8. Reduced motion.
  await tab.emulateMedia({reducedMotion: 'reduce'});
  const motion = await tab.evaluate(() => getComputedStyle(document.querySelector('#ws > .sf-workspace-panel')).transitionDuration);
  check('reduced motion: the drawer does not slide', motion === '0s', {motion});
  await tab.emulateMedia({reducedMotion: 'no-preference'});
  const slide = await tab.evaluate(() => getComputedStyle(document.querySelector('#ws > .sf-workspace-panel')).transitionDuration);
  check('motion: the drawer slides', slide !== '0s', {slide});

  check('no page errors', errors.length === 0, {errors});
} finally {
  await browser.close();
}
console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('WORKSPACE_LAYOUT_OK');

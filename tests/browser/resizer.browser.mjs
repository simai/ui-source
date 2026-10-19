#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-resizer (owner, 2026-10-14): a panel widened and narrowed by its edge.
// Measured on the built bytes: a drag changes the width the panel's
// stylesheet reads and stops at max and min; the keys move it by a step and to
// a limit; the width is remembered under the storage key and restored on the
// next page; a double click returns the stylesheet's width and forgets it; the
// handle is a separator with its value; sf-resize says move, end and reset.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'smart/smart/resizer/css/resizer.css'];
const modules = ['core/core/js/core.js', 'smart/smart/resizer/js/resizer.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport: {width: 1000, height: 600}});
  const origin = 'http://probe.test';
  await context.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    const path = join(out, product, product, ...rest);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  const load = async () => {
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await page.setContent(`<!doctype html><html lang="ru"><body style="margin:0">
      <div style="display:flex">
        <nav id="panel" style="inline-size: var(--menu-width, 256px); block-size: 300px; background: #eee">
          <aside id="menu-layer" style="position:relative; z-index:60; block-size:100%; background:#ddd">Меню</aside>
          <sf-resizer id="handle" min="200px" max="400px" property="--menu-width" storage-key="probe-menu" label="Ширина меню"></sf-resizer>
        </nav>
        <main style="flex:1">Страница</main>
      </div></body></html>`);
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
    // Core takes its distr from its own script URL when sfPath is unset
    // (simai/ui-source#8); here that is the build output's core/ root, not a
    // distr, so the page names the distr this probe routes.
    await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => customElements.get('sf-resizer'), null, {timeout: 8000});
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      window.resized = [];
      document.addEventListener('sf-resize', (event) => window.resized.push(event.detail));
    });
    return page;
  };
  const width = (page) => page.evaluate(() => Math.round(document.getElementById('panel').getBoundingClientRect().width));

  const page = await load();
  const handle = await page.evaluate(() => {
    const element = document.getElementById('handle');
    const box = element.getBoundingClientRect();
    return {x: box.left + box.width / 2, y: box.top + 100, role: element.getAttribute('role'),
      now: element.getAttribute('aria-valuenow'), min: element.getAttribute('aria-valuemin'),
      max: element.getAttribute('aria-valuemax'), label: element.getAttribute('aria-label'), tab: element.tabIndex};
  });
  if (handle.role !== 'separator' || handle.now !== '256' || handle.min !== '200' || handle.max !== '400'
    || handle.label !== 'Ширина меню' || handle.tab !== 0) {
    note({case: 'a separator with its value', got: handle});
  }
  if (Math.abs(handle.x - 256) > 2) note({case: 'the handle stands on the edge', got: handle.x, expected: 256});
  // A layer in the panel that lifts itself (the larena menu: z-6 = 60) does
  // not cover the handle's inner half (docs trial 5).
  const onTop = await page.evaluate(({x, y}) => document.elementFromPoint(x - 2, y)?.closest('sf-resizer')?.id ?? document.elementFromPoint(x - 2, y)?.id ?? null, handle);
  if (onTop !== 'handle') note({case: 'the handle is above a lifted layer in its panel', got: onTop});

  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y, {steps: 6});
  const during = await width(page);
  await page.mouse.move(handle.x + 400, handle.y, {steps: 6});
  const capped = await width(page);
  await page.mouse.up();
  await page.mouse.move(400, handle.y);
  await page.mouse.down();
  await page.mouse.move(0, handle.y, {steps: 8});
  await page.mouse.up();
  const floored = await width(page);
  if (during !== 316 || capped !== 400 || floored !== 200) note({case: 'a drag stops at the limits', got: {during, capped, floored}});

  await page.focus('#handle');
  await page.keyboard.press('ArrowRight');
  const stepped = await width(page);
  await page.keyboard.press('Shift+ArrowRight');
  const shifted = await width(page);
  await page.keyboard.press('End');
  const end = await width(page);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  const kept = await width(page);
  if (stepped !== 216 || shifted !== 280 || end !== 400 || kept !== 216) note({case: 'the keys', got: {stepped, shifted, end, kept}});
  const phases = await page.evaluate(() => [...new Set(window.resized.map((event) => event.phase))].join(','));
  if (!phases.includes('move') || !phases.includes('end')) note({case: 'sf-resize', got: phases, expected: 'move and end'});

  const again = await load();
  const restored = await width(again);
  if (restored !== 216) note({case: 'remembered under the storage key', got: restored, expected: 216});
  await again.dblclick('#handle');
  await again.waitForTimeout(100);
  const reset = await width(again);
  // Kept as a view preference (SF.Preferences): gone from it on reset.
  const forgotten = await again.evaluate(() => localStorage.getItem('sf-pref:sf-resizer/probe-menu') ?? localStorage.getItem('sf-resizer:probe-menu'));
  const resetPhase = await again.evaluate(() => window.resized.at(-1)?.phase);
  if (reset !== 256 || forgotten !== null || resetPhase !== 'reset') note({case: 'a double click restores and forgets', got: {reset, forgotten, resetPhase}});
  // A width the host keeps (value) wins over the browser's memory.
  await again.evaluate(() => document.getElementById('handle').setAttribute('value', '333'));
  await again.waitForTimeout(50);
  const valued = await width(again);
  if (valued !== 333) note({case: 'value is the host-kept width', got: valued, expected: 333});

  // SF.Resizer.attach: the same gesture on edges the page draws itself.
  const attached = await again.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', `<table id="grid" style="table-layout:fixed;border-collapse:collapse;margin-top:20px">
      <thead><tr><th id="a" style="width:120px;position:relative">A<button class="edge" type="button" style="position:absolute;right:-4px;top:0;width:8px;height:100%">|</button></th>
      <th style="width:120px">B</th></tr></thead></table>`);
    const table = document.getElementById('grid');
    window.log = [];
    window.SF.Resizer.attach(table, {
      handles: '.edge',
      session: (edge) => {
        const th = edge.closest('th');
        return {
          measure: () => th.getBoundingClientRect().width,
          limits: () => ({min: 80, max: 260}),
          apply: (next) => { th.style.width = `${next}px`; return next; },
          commit: (next) => window.log.push(['commit', next]),
          reset: () => { th.style.width = '120px'; window.log.push(['reset']); },
          direction: () => 1, step: 10,
        };
      },
    });
    const edge = table.querySelector('.edge');
    const box = edge.getBoundingClientRect();
    return {x: box.left + box.width / 2, y: box.top + box.height / 2};
  });
  await again.mouse.move(attached.x, attached.y);
  await again.mouse.down();
  await again.mouse.move(attached.x + 40, attached.y, {steps: 5});
  await again.mouse.up();
  const dragged = await again.evaluate(() => Math.round(document.getElementById('a').getBoundingClientRect().width));
  await again.focus('#grid .edge');
  await again.keyboard.press('End');
  const ended = await again.evaluate(() => ({width: Math.round(document.getElementById('a').getBoundingClientRect().width),
    role: document.querySelector('#grid .edge').getAttribute('aria-valuenow')}));
  await again.dblclick('#grid .edge');
  const log = await again.evaluate(() => window.log);
  if (dragged !== 160 || ended.width !== 260 || ended.role !== '260' || JSON.stringify(log) !== JSON.stringify([['commit', 160], ['commit', 260], ['reset']])) {
    note({case: 'SF.Resizer.attach on drawn edges', got: {dragged, ended, log}});
  }
  console.log(JSON.stringify({handle, during, capped, floored, stepped, shifted, end, kept, phases, restored, reset, valued, dragged, ended, log}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('RESIZER_OK');

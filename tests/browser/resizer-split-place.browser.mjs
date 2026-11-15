#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-resizer: below the layout's split step (40rem, owner decision C158 (4))
// the handle is not there. The step is read on the split the panel stands
// in: the nearest box around the panel whose width does not come from the
// panels it holds. A wrapper as wide as its columns is passed.
//
// The ui-pro release over ui-141822273efe (probe admin-navigation-resize)
// found the admin menu's column handles hidden at 1400 px in every admin:
// sf-admin-menu's host is display contents and its navigation box is
// inline-size max-content, a flex item of the page row; sf-resizer 1.3.1 read
// that box (about 31rem) as the split. The admin case below copies that DOM
// and its layout CSS (ui-pro components/src/smart/admin-menu/js/navigation/
// navigation.css): handles at 1400 and 1440, none at 390. The other cases
// keep C158 (4)'s intent: a wrapper in a 36rem row, in a 36rem container, a
// 30rem flex item of a length and a 480px row hide the handles; two columns in
// a wrapper of a wide row keep them (fix/gb5-answers' case), and a drag still
// widens a kept column. Measured on the built bytes.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const assets = ['core/core/css/core.css', 'smart/smart/resizer/css/resizer.css', 'core/core/js/core.js', 'smart/smart/resizer/js/resizer.js'];
const absent = assets.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});

// The admin menu's navigation, as sf-admin-menu renders it (template.js) with
// the layout rules of navigation.css that place it.
const adminStyle = `<style>
  .sf-admin-nav { display:flex; inline-size:max-content; block-size:100%; max-block-size:100dvh; min-block-size:0; position:sticky; inset-block-start:0 }
  .sf-admin-nav-first, .sf-admin-nav-second { position:relative; display:flex; min-inline-size:0; flex-direction:column; min-block-size:0; block-size:100%; border-inline-end:1px solid var(--sf-outline-variant) }
  .sf-admin-nav-first { inline-size:var(--sf-admin-nav-first--inline-size, var(--sf-f6)); flex:0 0 auto; background:var(--sf-surface-1) }
  .sf-admin-nav-second { inline-size:var(--sf-admin-nav-second--inline-size, var(--sf-f5)); flex:0 0 auto; background:var(--sf-surface-0) }
</style>`;
const admin = `<div id="admin" style="block-size:300px; display:flex"><sf-admin-menu style="display:contents" aria-label="Меню"><nav class="sf-admin-nav">
  <div class="sf-admin-nav-first"><div class="sf-admin-nav-scroll">Разделы</div>
    <sf-resizer id="admin-h1" min="13rem" max="24rem" property="--sf-admin-nav-first--inline-size" label="Ширина меню"></sf-resizer></div>
  <div class="sf-admin-nav-second"><div class="sf-admin-nav-scroll">Страницы раздела</div>
    <sf-resizer id="admin-h2" min="13rem" max="28rem" property="--sf-admin-nav-second--inline-size" label="Ширина колонки"></sf-resizer></div>
</nav></sf-admin-menu><main style="flex:1">Страница</main></div>`;
const columns = (id, row = '', wrapper = 'flex:0 0 auto') => `<div id="${id}" style="display:flex; block-size:100px; ${row}"><div style="display:flex; ${wrapper}">
  <nav id="${id}-1" style="inline-size:var(--${id}-1, 16rem); background:#eee"><p>Колонка 1</p><sf-resizer id="${id}-h1" min="13rem" max="24rem" property="--${id}-1"></sf-resizer></nav>
  <nav id="${id}-2" style="inline-size:var(--${id}-2, 15rem); flex:1 1 auto; background:#ddd"><p>Колонка 2</p><sf-resizer id="${id}-h2" min="13rem" max="28rem" property="--${id}-2"></sf-resizer></nav>
</div><main style="flex:1 1 auto; min-inline-size:0">Страница</main></div>`;
const body = `${adminStyle}${admin}
  ${columns('wide')}
  ${columns('row', 'inline-size:36rem')}
  <div style="container-type:inline-size; inline-size:36rem">${columns('box')}</div>
  ${columns('basis', '', 'flex:0 0 30rem')}
  <div style="display:flex; inline-size:480px; block-size:80px"><nav id="thin" style="inline-size:200px"><sf-resizer id="thin-h" min="160px" max="300px"></sf-resizer></nav><main style="flex:1">Узко</main></div>
  <div id="full" style="display:flex; block-size:80px"><nav id="full-1" style="inline-size:var(--full-1, 16rem)"><sf-resizer id="full-h" min="13rem" max="24rem" property="--full-1"></sf-resizer></nav><main style="flex:1">Страница</main></div>`;
const ids = ['admin-h1', 'admin-h2', 'wide-h1', 'wide-h2', 'row-h1', 'row-h2', 'box-h1', 'box-h2', 'basis-h1', 'basis-h2', 'thin-h', 'full-h'];
// Shown on a wide page (>= 40rem split); a phone shows none.
const wideShown = new Set(['admin-h1', 'admin-h2', 'wide-h1', 'wide-h2', 'full-h']);

const failures = [];
const browser = await chromium.launch();
try {
  for (const [width, theme] of [[1400, 'light'], [1440, 'dark'], [390, 'light']]) {
    const phone = width < 768;
    const context = await browser.newContext({viewport: {width, height: 900}, isMobile: phone, hasTouch: phone});
    await context.route('http://probe.test/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== '/') return serve(route, join(out, url.pathname));
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/core/core/css/core.css"><link rel="stylesheet" href="/smart/smart/resizer/css/resizer.css">
        <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
        <script type="module" src="/core/core/js/core.js"></script><script type="module" src="/smart/smart/resizer/js/resizer.js"></script></head>
        <body style="margin:0">${body}</body></html>`});
    });
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    const view = `${width} ${theme}`;
    page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction((count) => customElements.get('sf-resizer') && document.querySelectorAll('sf-resizer').length === count, ids.length, {timeout: 15000});
    await page.waitForTimeout(400);
    const shown = await page.evaluate((list) => Object.fromEntries(list.map((id) => {
      const handle = document.getElementById(id);
      return [id, getComputedStyle(handle).display !== 'none' && !handle.hasAttribute('data-sf-resizer-narrow')];
    })), ids);
    for (const id of ids) {
      const expected = !phone && wideShown.has(id);
      if (shown[id] !== expected) failures.push({view, id, name: expected ? 'a split of 40rem or more keeps its handle' : 'a split under 40rem hides its handle', shown: shown[id]});
    }
    let drag = null;
    if (!phone && shown['admin-h1']) {
      const edge = await page.evaluate(() => { const box = document.querySelector('.sf-admin-nav-first').getBoundingClientRect(); return {x: box.right, y: box.top + box.height / 2, width: box.width}; });
      await page.mouse.move(edge.x, edge.y);
      await page.mouse.down();
      await page.mouse.move(edge.x + 48, edge.y, {steps: 8});
      await page.mouse.up();
      drag = {before: Math.round(edge.width), after: await page.evaluate(() => Math.round(document.querySelector('.sf-admin-nav-first').getBoundingClientRect().width))};
      if (drag.after - drag.before !== 48) failures.push({view, name: 'the admin menu column widens by a drag', drag});
    }
    // A wide page narrowed to a phone hides the handles, and widened again
    // brings them back: the split is observed.
    if (!phone) {
      await page.setViewportSize({width: 390, height: 900});
      await page.waitForTimeout(300);
      const narrowed = await page.evaluate(() => document.getElementById('admin-h1').hasAttribute('data-sf-resizer-narrow'));
      await page.setViewportSize({width, height: 900});
      await page.waitForTimeout(300);
      const widened = await page.evaluate(() => document.getElementById('admin-h1').hasAttribute('data-sf-resizer-narrow'));
      if (!narrowed || widened) failures.push({view, name: 'the split is followed when the page changes width', narrowed, widened});
    }
    console.log(JSON.stringify({view, shown, drag}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`resizer split place: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('resizer split place: pass');

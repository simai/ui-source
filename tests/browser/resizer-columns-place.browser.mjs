#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-resizer: the layout's split step (40rem, owner decision C158 (4)) is
// read on the width of the columns' place, never the page (C181 (2); DEV GB5
// answers, 2026-11-15). Two resizable columns in one wrapper that takes its
// width from them (a flex item that does not grow, as an admin menu's two
// columns) on a wide page keep their handles and widen by a drag; the same
// wrapper in a narrow row, in a narrow container (container-type), and on a
// phone hides them. Group build 5: the wrapper (31rem) was read as the place
// and both handles were hidden on a 1440 page. Measured on the built bytes.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const columns = (id, row = '') => `<div id="${id}" style="display:flex; block-size:120px; ${row}"><div style="display:flex; flex:0 0 auto">
  <nav id="${id}-1" style="inline-size:var(--${id}-1, 16rem); background:#eee"><p>Колонка 1</p><sf-resizer id="${id}-h1" min="13rem" max="24rem" property="--${id}-1"></sf-resizer></nav>
  <nav id="${id}-2" style="inline-size:var(--${id}-2, 15rem); background:#ddd"><p>Колонка 2</p><sf-resizer id="${id}-h2" min="13rem" max="28rem" property="--${id}-2"></sf-resizer></nav>
</div><main style="flex:1 1 auto; min-inline-size:0">Страница</main></div>`;

const browser = await chromium.launch();
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light']]) {
    const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 768, hasTouch: width < 768});
    await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/css/core.css">
      <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
      <script type="module" src="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/js/core.js"></script></head>
      <body style="margin:0">${columns('wide')}${columns('row', 'inline-size:36rem')}<div style="container-type:inline-size; inline-size:36rem">${columns('box')}</div></body></html>`}));
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    const view = `${width} ${theme}`;
    page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => customElements.get('sf-resizer') && document.querySelectorAll('sf-resizer').length === 6, null, {timeout: 15000});
    await page.waitForTimeout(400);
    const shown = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('sf-resizer')].map((handle) => [handle.id, getComputedStyle(handle).display !== 'none' && !handle.hasAttribute('data-sf-resizer-narrow')])));
    const wide = width >= 1440;
    for (const id of ['wide-h1', 'wide-h2']) if (shown[id] !== wide) failures.push({view, name: wide ? 'two columns side by side on a wide page keep their handles' : 'a phone hides the handles', id, shown: shown[id]});
    for (const id of ['row-h1', 'row-h2', 'box-h1', 'box-h2']) if (shown[id]) failures.push({view, name: 'a place narrower than 40rem hides the handles', id});
    let drag = null;
    if (wide && shown['wide-h1']) {
      const edge = await page.evaluate(() => { const box = document.getElementById('wide-1').getBoundingClientRect(); return {x: box.right, y: box.top + box.height / 2, width: box.width}; });
      await page.mouse.move(edge.x, edge.y);
      await page.mouse.down();
      await page.mouse.move(edge.x + 48, edge.y, {steps: 8});
      await page.mouse.up();
      drag = {before: edge.width, after: await page.evaluate(() => document.getElementById('wide-1').getBoundingClientRect().width)};
      if (!(drag.after - drag.before > 40)) failures.push({view, name: 'the kept handle widens its column by a drag', drag});
    }
    console.log(JSON.stringify({view, shown, drag}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`resizer columns place: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('resizer columns place: pass');

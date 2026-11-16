#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// C181 (2) (DEV GB5 answers, 2026-11-15): a component restyles by the width
// of its own place on the one threshold ladder, not by the screen's.
//   - sf-tile-metric's row (.sf-tile-metric-grid) below container-step(g6)
//     (32rem): the 1/2 tiles two in a row, sizes 1 and 2 across the row
//     (C168 (4)) -- in a narrow column of a wide page too; above the step
//     columns of --sf-tile-metric-min-width.
//   - sf-gallery's full-screen viewer below container-step(h1) (44rem) of its
//     own width: no side arrows (C150 (7)); its built sheet holds a
//     container condition and no screen query.
// Measured on the built bytes at 1440 and 390.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const tiles = (id, style) => `<div id="${id}" style="${style}"><div class="sf-tile-metric-grid">
  <sf-tile-metric size="1/2" label="Заказы" value="128" format="integer"></sf-tile-metric>
  <sf-tile-metric size="1/2" label="Возвраты" value="4" format="integer"></sf-tile-metric>
  <sf-tile-metric size="1/2" label="Отзывы" value="31" format="integer"></sf-tile-metric>
  <sf-tile-metric label="Посетители" value="12480" previous="11020" format="integer"></sf-tile-metric>
</div></div>`;

const sheet = join(out, 'smart/smart/gallery/css/gallery.css');
if (!existsSync(sheet)) failures.push({name: 'the gallery sheet is built', path: sheet});
else {
  const css = readFileSync(sheet, 'utf8');
  if (!/@container sf-gallery-viewer \(width ?< ?44rem\)/u.test(css)) failures.push({name: 'the viewer reads its own width at container step h1'});
  if (/@media[^{]*width/u.test(css)) failures.push({name: 'the gallery sheet has no screen query', found: css.match(/@media[^{]*width[^{]*/u)[0]});
}

const browser = await chromium.launch();
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light']]) {
    const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 768, hasTouch: width < 768});
    await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/css/core.css">
      <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
      <script type="module" src="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/js/core.js"></script></head>
      <body style="margin:16px">${tiles('narrow', 'inline-size:25rem')}${tiles('wide', 'inline-size:min(100%, 62.5rem); margin-top:16px')}
      <sf-gallery id="g" inline="false"></sf-gallery></body></html>`}));
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    const view = `${width} ${theme}`;
    page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => document.querySelectorAll('.sf-tile-metric').length === 8, null, {timeout: 15000});
    await page.waitForTimeout(300);
    const grids = await page.evaluate(() => Object.fromEntries(['narrow', 'wide'].map((id) => {
      const grid = document.querySelector(`#${id} .sf-tile-metric-grid`);
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const rows = [...grid.querySelectorAll('.sf-tile-metric')].map((tile) => { const box = tile.getBoundingClientRect(); return [Math.round(box.left - grid.getBoundingClientRect().left), Math.round(box.width)]; });
      return [id, {width: Math.round(grid.getBoundingClientRect().width), columns, rows}];
    })));
    for (const [id, grid] of Object.entries(grids)) {
      const narrow = grid.width < 512;
      if (narrow) {
        if (grid.columns !== 2) failures.push({view, name: 'a grid narrower than 32rem has two columns', id, grid});
        const [x1, w1] = grid.rows[0]; const [x2] = grid.rows[1]; const [, wide] = grid.rows[3];
        if (!(x2 > x1 && Math.abs(w1 * 2 - grid.width) < 40)) failures.push({view, name: 'two 1/2 tiles in a row', id, grid});
        if (Math.abs(wide - grid.width) > 1) failures.push({view, name: 'a size 1 tile takes the row', id, grid});
      } else if (grid.columns < 2 || grid.rows.some(([, w]) => w < 223)) failures.push({view, name: 'above the step the columns are min-width wide', id, grid});
    }
    await page.evaluate(async () => { await window.SF.Loader.ensure(['sf-gallery']); window.SF.Gallery.view(['data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2230%22/%3E', 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2240%22/%3E']); });
    await page.waitForFunction(() => document.querySelector('.sf-gallery-viewer[open] .sf-gallery-viewer-side'), null, {timeout: 10000});
    await page.waitForTimeout(200);
    const arrows = await page.evaluate(() => [...document.querySelectorAll('.sf-gallery-viewer[open] .sf-gallery-viewer-side')].map((side) => getComputedStyle(side).display));
    const phone = width < 704;
    if (arrows.some((display) => (display === 'none') !== phone)) failures.push({view, name: phone ? 'a narrow viewer has no side arrows' : 'a wide viewer shows its side arrows', arrows});
    console.log(JSON.stringify({view, grids, arrows}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`container place (gallery, tile-metric): ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('container place (gallery, tile-metric): pass');

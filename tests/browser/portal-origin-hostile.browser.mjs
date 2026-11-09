#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// What a layer draws outside its host must look and draw as if it stood
// where its host stands, however the page's sheets and scripts arrive:
//
// - simai/ui-source#56 and the record window's edge Close button: an sf-icon
//   a drawer moves into its portal -- a static icon of a docked drawer, the
//   icon buttons a record window puts on its edge -- draws on every load and
//   after every open and close, and an icon button whose icon changes draws
//   the new glyph through its sf-icon (the sf-icon's own name follows);
// - simai/ui-source#46: an sf-modal opened inside an assembly takes the
//   variables the assembly sets for its parts (a switch's on colour, the
//   window's own public background), and one opened inside a block of the
//   other theme (a dark block of a light page, a light one of a dark page)
//   draws in that block's theme.
//
// Timing-hostile: every sheet is held back 150-1200 ms and every script
// 0-400 ms, at random per request; each page is loaded SF_PROBE_LOADS times
// (default 4) in a fresh context, in the light and the dark theme, and each
// layer is opened and closed three times, the record window also moved to
// another parent between the rounds. The console must stay clean.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const head = (theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head>`;

// The record window as sf-view-properties builds it; its host stands in one
// of two boxes, so a round can move it.
const WINDOW = `<sf-drawer id="w" placement="inline-end" modal="true" overlay="true" show-close="false" close-on-esc="false" label="Запись">
  <div class="flex flex-col gap-1/2" slot="edge" aria-label="Закрыть">
    <sf-button-icon id="close" appearance="tonal" scheme="on-surface" size="1" icon="close" aria-label="Закрыть"></sf-button-icon>
    <sf-button-icon id="copy" appearance="tonal" scheme="on-surface" size="1" icon="link" aria-label="Ссылка"></sf-button-icon>
  </div>
  <div><sf-icon id="row" icon="tune" size="1"></sf-icon> Параметры</div>
</sf-drawer>`;
const recordPage = (theme, when) => `${head(theme)}<body><main>
  <section id="box-a"></section><section id="box-b"></section>
  <sf-drawer id="dock" side="left" docked open size="1/2"><div><sf-icon id="docked" icon="tune" size="2"></sf-icon> text</div></sf-drawer>
</main><template id="window">${WINDOW}</template>
<script>
  const build = () => document.getElementById('box-a').append(document.importNode(document.getElementById('window').content, true));
  ${when === 'at-once' ? 'build();' : when === 'after-load' ? "addEventListener('load', build);" : "customElements.whenDefined('sf-drawer').then(() => requestAnimationFrame(build));"}
</script></body></html>`;

// An assembly that sets values for its parts, a modal inside it with a
// checked switch and an icon; a block in the other theme with a modal.
const ASSEMBLY = '--sf-switch-checked-background-color: rgb(0, 128, 0); --sf-modal-background-color: rgb(220, 232, 255); --order-accent: rgb(200, 0, 0)';
const modalPage = (theme) => `${head(theme)}<body><main>
  <section id="order" style="${ASSEMBLY}">
    <sf-modal id="m-order" heading="Заказ"><div slot="content"><sf-switch id="gift" label="Подарок" checked></sf-switch>
      <sf-icon id="m-icon" icon="tune"></sf-icon><span id="accent" style="color: var(--order-accent)">accent</span></div></sf-modal>
  </section>
  <section id="other" class="${theme === 'theme-light' ? 'theme-dark' : 'theme-light'}"><sf-modal id="m-other" heading="Другая тема"><p slot="content">Фон</p></sf-modal></section>
  <sf-modal id="m-page" heading="Страница"><p slot="content">Фон</p></sf-modal>
</main></body></html>`;

const pages = {};
for (const theme of ['theme-light', 'theme-dark']) {
  for (const when of ['at-once', 'after-load', 'defined']) pages[`/record-${when}-${theme}.html`] = recordPage(theme, when);
}
for (const theme of ['theme-light', 'theme-dark']) pages[`/modal-${theme}.html`] = modalPage(theme);

const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
const serve = () => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    await new Promise((done) => setTimeout(done, ext === '.css' ? rand(150, 1200) : ext === '.js' ? rand(0, 400) : 0));
    response.writeHead(200, {'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

const LOADS = Number(process.env.SF_PROBE_LOADS || 4);
const failures = [];
const counts = {};
const server = serve();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

// Every icon drawn: a glyph inside, and the glyph's text is the icon's name.
const readIcons = (selectors) => Object.fromEntries(selectors.map((selector) => {
  const icon = document.querySelector(selector);
  const glyph = icon?.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon');
  return [selector, {name: icon?.getAttribute('icon') ?? null, text: glyph?.textContent.trim() ?? null,
    upgraded: icon?.constructor === customElements.get('sf-icon'), connected: Boolean(icon?.isConnected)}];
}));
const iconFaults = (icons, wanted = {}) => Object.entries(icons)
  .filter(([selector, icon]) => !icon.upgraded || !icon.connected || !icon.text || icon.text !== icon.name
    || (wanted[selector] && icon.name !== wanted[selector]))
  .map(([selector, icon]) => ({selector, ...icon}));

try {
  for (const path of Object.keys(pages)) {
    counts[path] = {loads: LOADS, clean: 0};
    for (let load = 0; load < LOADS; load += 1) {
      // The runtime follows the colour scheme: a dark page needs a dark one too.
      const context = await browser.newContext({viewport: {width: 1050, height: 800}, colorScheme: path.includes('theme-dark') ? 'dark' : 'light'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`); });
      const before = failures.length;
      await page.goto(`${base}${path}`);
      if (path.startsWith('/record')) {
        // Drawn at the latest 10 s after load, however late its script came.
        await page.waitForFunction(() => document.querySelector('[data-sf-drawer-portal] #docked > i.sf-icon'), null, {timeout: 10000}).catch(() => {});
        const docked = await page.evaluate(readIcons, ['#docked']);
        for (const fault of iconFaults(docked)) failures.push({path, load, round: 'load', ...fault});
        const icons = ['[data-sf-drawer-edge] #close sf-icon', '[data-sf-drawer-edge] #copy sf-icon', '[data-sf-drawer-portal] #row'];
        for (let round = 0; round < 3; round += 1) {
          // Round 1 changes the close button's icon, round 2 changes it back.
          const wanted = round === 1 ? 'arrow_back' : 'close';
          await page.evaluate(async ({round, wanted}) => {
            await customElements.whenDefined('sf-drawer');
            const drawer = document.getElementById('w');
            // Held before the move: a closed drawer that moves takes its edge
            // out of the page, and the icon changes while it is out.
            const close = document.getElementById('close');
            if (round > 0) document.getElementById(round % 2 ? 'box-b' : 'box-a').append(drawer);
            close?.setAttribute('icon', wanted);
            drawer.open();
          }, {round, wanted});
          await page.waitForFunction(() => document.getElementById('w')?.openState === true
            && document.querySelector('[data-sf-drawer-edge] #close'), null, {timeout: 10000}).catch(() => {});
          await page.waitForTimeout(rand(400, 1400));
          // Then up to 10 s more for every icon to draw its name.
          await page.waitForFunction(({icons, wanted}) => icons.every((selector, index) => {
            const icon = document.querySelector(selector);
            const text = icon?.querySelector(':scope > i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon')?.textContent.trim();
            return text && text === icon.getAttribute('icon') && (index > 0 || text === wanted);
          }), {icons, wanted}, {timeout: 10000}).catch(() => {});
          const result = await page.evaluate(readIcons, icons);
          for (const fault of iconFaults(result, {[icons[0]]: wanted})) failures.push({path, load, round, ...fault});
          await page.evaluate(() => document.getElementById('w').close());
          await page.waitForTimeout(rand(50, 400));
        }
      } else {
        await page.waitForFunction(() => customElements.get('sf-modal') && customElements.get('sf-switch'), null, {timeout: 15000}).catch(() => {});
        await page.waitForTimeout(800);
        const surfaces = {};
        for (let round = 0; round < 3; round += 1) {
          for (const id of ['m-order', 'm-other', 'm-page']) {
            await page.evaluate((id) => document.getElementById(id).open(), id);
            await page.waitForFunction((id) => document.querySelector(`[data-sf-modal-portal="${id}"] [data-sf-modal-state="open"] .sf-modal-surface`), id, {timeout: 10000}).catch(() => {});
            await page.waitForTimeout(rand(400, 1000));
            if (id === 'm-order') {
              await page.waitForFunction(() => document.querySelector('[data-sf-modal-portal="m-order"] #gift .sf-switch-toggler')
                && document.querySelector('[data-sf-modal-portal="m-order"] #m-icon > i.sf-icon'), null, {timeout: 10000}).catch(() => {});
            }
            surfaces[id] = await page.evaluate(({id, round}) => {
              const portal = document.querySelector(`[data-sf-modal-portal="${id}"]`);
              const surface = portal?.querySelector('.sf-modal-surface');
              const track = portal?.querySelector('#gift .sf-switch-toggler');
              const icon = portal?.querySelector('#m-icon');
              return {round, surface: surface ? getComputedStyle(surface).backgroundColor : null,
                track: track ? getComputedStyle(track).backgroundColor : null,
                accent: portal?.querySelector('#accent') ? getComputedStyle(portal.querySelector('#accent')).color : null,
                other: Boolean(surface && surface.closest('.theme-dark, .theme-light') !== document.documentElement),
                icon: icon ? icon.querySelector(':scope > i.sf-icon')?.textContent.trim() ?? '' : null};
            }, {id, round});
            await page.keyboard.press('Escape');
            await page.waitForFunction((id) => !document.querySelector(`[data-sf-modal-portal="${id}"] [data-sf-modal-state="open"]`), id, {timeout: 5000}).catch(() => {});
            await page.waitForTimeout(rand(50, 300));
          }
          const {'m-order': order, 'm-other': other, 'm-page': plain} = surfaces;
          const check = (name, ok, detail) => { if (!ok) failures.push({path, load, round, check: name, ...detail}); };
          check('the modal takes the assembly\'s --sf-modal-background-color', order.surface === 'rgb(220, 232, 255)', {surface: order.surface});
          check('a switch in the modal takes the assembly\'s on colour', order.track === 'rgb(0, 128, 0)', {track: order.track});
          check('a page variable of the assembly reaches the modal\'s content', order.accent === 'rgb(200, 0, 0)', {accent: order.accent});
          check('an icon in the modal draws', order.icon === 'tune', {icon: order.icon});
          check('a modal in a block of the other theme draws in that theme', other.other && other.surface && other.surface !== plain.surface, {other, plain});
        }
      }
      if (errors.length) failures.push({path, load, errors});
      if (failures.length === before) counts[path].clean += 1;
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({counts, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}

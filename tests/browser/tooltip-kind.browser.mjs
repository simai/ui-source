#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// The tooltip and «?» kinds of C59 (owner decision 2026-11-11) on the built
// bytes over the Loader, light and dark, three loads each:
//
//   1. desktop: a hover opens the tooltip after 0.5 s (closed at 300 ms, open
//      by 800 ms), its neighbour at once, again after 0.5 s once the group
//      cooled; keyboard focus opens it at once, Escape hides it and the focus
//      stays; the default tooltip has no tail; the shortcut is the kbd
//      component's keys; the light look has no frame and its shadow is a
//      filter over the surface and the tail;
//   2. touch (390): a tap shows nothing; a long press shows it, it stays while
//      held and is gone 2 s after the release, which sends no click;
//   3. «?»: the window has no visible frame and a shadow; the button is at
//      least 24 px and, in running text, the whole of it takes the press.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const report = process.argv.includes('--report');
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
const pageOf = (body, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const tooltips = `<div style="padding:80px 40px;display:flex;gap:4px">
  ${['b1', 'b2', 'b3'].map((id) => `<span class="sf-tooltip-anchor"><button id="${id}" type="button" data-tooltip="${id}-tip" aria-label="${id}" style="inline-size:40px;block-size:40px">${id}</button><sf-tooltip id="${id}-tip" text="Подсказка ${id}"${id === 'b3' ? ' shortcut="mod+s"' : ''} hidden></sf-tooltip></span>`).join('')}
  <button id="away" type="button" style="margin-inline-start:160px;inline-size:40px;block-size:40px">·</button>
</div>
<div style="display:flex;gap:40px;padding:16px">
  <sf-tooltip id="t-default" text="По умолчанию"></sf-tooltip>
  <sf-tooltip id="t-light" text="Светлая со стрелкой" appearance="light" arrow="top-center"></sf-tooltip>
</div>`;
const marks = `<div style="padding:40px">
  <label for="f">Код решения</label> <sf-help-mark id="hm" label="Подробнее" text="Пояснение."></sf-help-mark> <input id="f">
  <p style="max-inline-size:320px;font-size:var(--sf-text-size-1\\/3);line-height:var(--sf-text-height-1\\/3)">Мелкий текст со знаком<sf-help-mark id="hm-text" size="1/3" text="Сноска."></sf-help-mark> посреди абзаца, который переносится на следующую строку и дальше.</p>
</div>`;
const pages = {};
for (const theme of ['light', 'dark']) {
  pages[`/${theme}/tooltips.html`] = pageOf(tooltips, theme);
  pages[`/${theme}/marks.html`] = pageOf(marks, theme);
}
const server = createServer(async (request, response) => {
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
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((done) => server.once('listening', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const measures = {};
const note = (failure) => failures.push(failure);
try {
  for (const theme of ['light', 'dark']) for (let load = 1; load <= 3; load++) {
    // 1. desktop
    {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}, colorScheme: theme});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/${theme}/tooltips.html`);
      await page.waitForFunction(() => ['b1', 'b2', 'b3'].every((id) => document.getElementById(id).getAttribute('data-tooltip') === `${id}-tip`
        && document.querySelector(`#${id}-tip .sf-tooltip-text`)) && document.querySelector('#t-light .sf-tooltip-tail'), null, {timeout: 15000});
      const shown = (id) => page.evaluate((key) => !document.getElementById(key).hidden, id);
      const centre = (id) => page.evaluate((key) => { const box = document.getElementById(key).getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; }, id);
      const m = {};
      await page.mouse.move(2, 2); await page.waitForTimeout(500);
      await page.mouse.move(...await centre('b1'));
      await page.waitForTimeout(300); m.closedAt300 = !(await shown('b1-tip'));
      await page.waitForTimeout(500); m.openBy800 = await shown('b1-tip');
      await page.mouse.move(...await centre('b2')); await page.waitForTimeout(50);
      m.neighbourAtOnce = await shown('b2-tip');
      await page.mouse.move(...await centre('away')); await page.waitForTimeout(700);
      await page.mouse.move(...await centre('b3')); await page.waitForTimeout(300);
      m.cooledWaits = !(await shown('b3-tip'));
      await page.waitForTimeout(500);
      m.keys = await page.evaluate(() => [...document.querySelectorAll('#b3-tip .sf-tooltip-shortcut kbd')].map((key) => key.textContent));
      await page.mouse.move(2, 2); await page.waitForTimeout(500);
      await page.focus('#away'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(50);
      m.focusAtOnce = await page.evaluate(() => document.activeElement?.id) === 'b3' && await shown('b3-tip');
      await page.keyboard.press('Escape'); await page.waitForTimeout(50);
      m.escape = !(await shown('b3-tip')) && await page.evaluate(() => document.activeElement?.id) === 'b3';
      m.look = await page.evaluate(() => {
        const tail = document.querySelector('#t-default .sf-tooltip-tail');
        const light = document.querySelector('#t-light .sf-tooltip');
        return {
          defaultTail: tail ? getComputedStyle(tail).display !== 'none' && tail.getBoundingClientRect().width > 0 : false,
          lightBorder: getComputedStyle(light.querySelector('.sf-tooltip-content')).borderTopWidth,
          lightBoxShadow: getComputedStyle(light.querySelector('.sf-tooltip-content')).boxShadow,
          lightFilter: getComputedStyle(light).filter,
        };
      });
      measures[`desktop ${theme} ${load}`] = m;
      const ok = m.closedAt300 && m.openBy800 && m.neighbourAtOnce && m.cooledWaits && m.keys.length === 2 && m.focusAtOnce && m.escape
        && !m.look.defaultTail && m.look.lightBorder === '0px' && m.look.lightBoxShadow === 'none' && /drop-shadow/u.test(m.look.lightFilter);
      if (!ok) note({case: `tooltip kind, desktop (${theme}, load ${load})`, got: m});
      if (errors.length) note({case: `no page errors, desktop (${theme})`, errors});
      await context.close();
    }
    // 2. touch
    {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: theme, hasTouch: true, isMobile: true});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/${theme}/tooltips.html`);
      await page.waitForFunction(() => document.getElementById('b1').getAttribute('data-tooltip') === 'b1-tip' && document.querySelector('#b1-tip .sf-tooltip-text'), null, {timeout: 15000});
      const cdp = await context.newCDPSession(page);
      const [x, y] = await page.evaluate(() => { const box = document.getElementById('b1').getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; });
      const touch = (type) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
      const shown = () => page.evaluate(() => !document.getElementById('b1-tip').hidden);
      const m = {};
      await touch('touchStart'); await page.waitForTimeout(80); await touch('touchEnd'); await page.waitForTimeout(700);
      m.tapShowsNothing = !(await shown());
      await page.evaluate(() => { window.clicks = 0; document.getElementById('b1').addEventListener('click', () => { window.clicks += 1; }); });
      await touch('touchStart'); await page.waitForTimeout(300);
      m.notYet = !(await shown());
      await page.waitForTimeout(500);
      m.heldShows = await shown();
      await touch('touchEnd'); await page.waitForTimeout(800);
      m.staysAfter = await shown();
      await page.waitForTimeout(1200);
      m.goneAfter = !(await shown());
      m.noClick = await page.evaluate(() => window.clicks === 0);
      measures[`touch ${theme} ${load}`] = m;
      if (!Object.values(m).every(Boolean)) note({case: `tooltip kind, touch (${theme}, load ${load})`, got: m});
      if (errors.length) note({case: `no page errors, touch (${theme})`, errors});
      await context.close();
    }
    // 3. «?»
    {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}, colorScheme: theme});
      const page = await context.newPage();
      await page.goto(`${base}/${theme}/marks.html`);
      await page.waitForFunction(() => document.querySelector('#hm .sf-help-mark-button button') && document.querySelector('#hm-text .sf-help-mark-button button'), null, {timeout: 15000});
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const button = document.querySelector('#hm-text .sf-help-mark-button button');
        const box = button.getBoundingClientRect();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const ours = (dx, dy) => Boolean(document.elementFromPoint(cx + dx, cy + dy)?.closest('#hm-text .sf-help-mark-button'));
        const reach = (fx, fy) => { let n = 0; for (let d = 0.5; d <= 30; d += 0.5) { if (!ours(fx * d, fy * d)) break; n = d; } return n; };
        return {size: [box.width, box.height], hit: [reach(-1, 0) + reach(1, 0), reach(0, -1) + reach(0, 1)]};
      });
      await page.click('#hm .sf-help-mark-button button'); await page.waitForTimeout(250);
      m.window = await page.evaluate(() => {
        const panel = document.querySelector('#hm .sf-help-mark-panel');
        const style = getComputedStyle(panel);
        return {open: panel.matches(':popover-open'), border: style.borderTopColor, shadow: style.boxShadow !== 'none', inputUntouched: document.activeElement?.id !== 'f'};
      });
      measures[`mark ${theme} ${load}`] = m;
      const ok = m.size[0] >= 24 && m.size[1] >= 24 && m.hit[0] >= m.size[0] - 1 && m.hit[1] >= m.size[1] - 1
        && m.window.open && /rgba\(0, 0, 0, 0\)|transparent/u.test(m.window.border) && m.window.shadow && m.window.inputUntouched;
      if (!ok) note({case: `«?» kind (${theme}, load ${load})`, got: m});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (report) console.log(JSON.stringify(measures, null, 1));
if (failures.length && !report) {
  console.error(JSON.stringify(failures, null, 1));
  process.exit(1);
}
console.log(`tooltip-kind: ${failures.length ? failures.length + ' failure(s)' : 'ok'}`);

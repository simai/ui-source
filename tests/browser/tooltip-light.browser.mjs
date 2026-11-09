#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// The light tooltip and the popup density (owner 2026-11-09: tooltips were
// heavy and coarse; DEV: popups ignored density), on the built bytes over the
// Loader, light and dark themes, desktop width, three loads each:
//
//   1. look: the default sf-tooltip, the bare .sf-tooltip class and the
//      shortcut tooltip are regular text at the small step (12/16), padded
//      4 x 8, radius 4, on the inverse surface; a rich tooltip keeps a bold
//      title; the shortcut is the kbd component's plain keys, quieter than
//      the words, with no cap (a compact region is measured and reported);
//   2. behaviour of a data-tooltip trigger: hover opens; a mouse press hides
//      it and the focus it leaves does not show it; leaving and hovering
//      again shows it; keyboard focus (Tab) shows it; Enter hides it;
//   3. density (C22): two menus opened from the same compact toolbar draw
//      the same size whether the menu element stands in the toolbar or on
//      the body; a menu with a size the page gave stays normal; a menu
//      opened from outside the region is normal; a submenu follows its menu.
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
const pageOf = (body, theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
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
});

const look = `<div style="padding:40px;display:flex;flex-direction:column;align-items:flex-start;gap:24px">
  <sf-tooltip id="plain" text="Свернуть меню"></sf-tooltip>
  <sf-tooltip id="keys" text="Свернуть меню" shortcut="mod+b"></sf-tooltip>
  <sf-tooltip id="rich" text="Доступ" supporting-text="Только чтение"></sf-tooltip>
  <span id="bare" class="sf-tooltip"><span class="sf-tooltip-content"><span class="sf-tooltip-text">Свернуть меню</span></span></span>
  <div data-sf-density="compact"><sf-tooltip id="compact" text="Свернуть меню"></sf-tooltip></div>
  <span id="inverse" style="background:var(--sf-surface-inverse);color:var(--sf-on-surface-inverse)">x</span>
</div>`;
const behaviour = `<div style="padding:80px;display:flex;gap:80px">
  <button id="away" type="button">away</button>
  <span class="sf-tooltip-anchor"><button id="trig" type="button" data-tooltip="trig-tip" aria-label="Свернуть меню"
    aria-keyshortcuts="Meta+B" style="inline-size:40px;block-size:40px">⟨</button>
    <sf-tooltip id="trig-tip" text="Свернуть меню" shortcut="mod+b" arrow="inline-start" hidden></sf-tooltip></span>
</div>`;
const menus = `<div style="padding:40px;display:flex;gap:16px">
  <div id="region" data-sf-density="compact" style="display:flex;gap:8px">
    <button id="a-in" type="button">in</button><button id="a-out" type="button">out</button><button id="a-sized" type="button">sized</button>
    <sf-menu-context id="m-in" popup aria-label="В панели"></sf-menu-context>
  </div>
  <button id="a-plain" type="button">plain</button>
</div>
<sf-menu-context id="m-out" popup aria-label="На странице"></sf-menu-context>
<sf-menu-context id="m-sized" popup size="1/2" aria-label="С размером"></sf-menu-context>`;

const THEMES = ['theme-light', 'theme-dark'];
const pages = {};
for (const theme of THEMES) {
  pages[`/${theme}/look.html`] = pageOf(look, theme);
  pages[`/${theme}/behaviour.html`] = pageOf(behaviour, theme);
  pages[`/${theme}/menus.html`] = pageOf(menus, theme);
}

const LOADS = 3;
const failures = [];
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const samples = {};
const tick = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 30))));
const near = (a, b) => Math.abs(a - b) < 0.6;

const measureLook = (page) => page.evaluate(() => {
  const box = (id) => document.getElementById(id).matches('.sf-tooltip') ? document.getElementById(id) : document.querySelector(`#${id} .sf-tooltip`);
  const one = (id) => {
    const root = box(id);
    const text = getComputedStyle(root.querySelector('.sf-tooltip-text'));
    const content = getComputedStyle(root.querySelector('.sf-tooltip-content'));
    const kbd = root.querySelector('.sf-tooltip-shortcut kbd');
    const keys = kbd ? getComputedStyle(kbd) : null;
    return {
      font: `${parseFloat(text.fontSize)}/${parseFloat(text.lineHeight)}`, weight: Number(text.fontWeight),
      padding: `${parseFloat(content.paddingTop)}x${parseFloat(content.paddingInlineStart)}`,
      radius: parseFloat(content.borderTopLeftRadius), background: content.backgroundColor, color: text.color,
      height: Math.round(root.querySelector('.sf-tooltip-content').getBoundingClientRect().height * 10) / 10,
      keys: keys ? {count: root.querySelectorAll('.sf-tooltip-shortcut > kbd').length, text: root.querySelector('.sf-tooltip-shortcut').textContent,
        color: keys.color, background: keys.backgroundColor, border: keys.borderTopWidth, font: parseFloat(keys.fontSize)} : null,
    };
  };
  const inverse = getComputedStyle(document.getElementById('inverse'));
  // compact is reported, not asserted: the space ladder moves a step down
  // there (C22), so 4 x 8 is 4 x 4 in a compact region.
  return {plain: one('plain'), keys: one('keys'), rich: one('rich'), bare: one('bare'), compact: one('compact'),
    inverse: {background: inverse.backgroundColor, color: inverse.color}};
});

const lookOk = (m) => {
  const plain = (s) => s.font === '12/16' && s.weight === 400 && s.padding === '4x8' && s.radius === 4
    && s.background === m.inverse.background && s.color === m.inverse.color;
  return plain(m.plain) && plain(m.bare) && plain(m.keys) && m.rich.weight === 700
    && m.keys.keys?.count === 2 && /,\s*0\)$/u.test(m.keys.keys.background) && m.keys.keys.border === '0px'
    && m.keys.keys.color !== m.keys.color;
};

try {
  for (const theme of THEMES) {
    for (let load = 0; load < LOADS; load += 1) {
      // The Loader keeps the theme the person's system asks for, so the
      // page's class alone does not make it dark: the scheme is emulated too.
      const context = await browser.newContext({viewport: {width: 1280, height: 800}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      const result = {theme, load};

      // 1. look
      await page.goto(`${base}/${theme}/look.html`);
      // The keys are waited for where the build draws them; a build before the
      // shortcut setting (--report on the base) draws the words alone.
      await page.waitForFunction(() => document.querySelector('#keys .sf-tooltip-text') && document.querySelector('#rich .sf-tooltip-supporting-text'), null, {timeout: 15000});
      await page.waitForFunction(() => document.querySelector('#keys .sf-tooltip-shortcut kbd'), null, {timeout: 3000}).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await tick(page);
      result.look = await measureLook(page);
      result.look.theme = await page.evaluate(() => document.documentElement.className);
      result.look.ok = lookOk(result.look) && result.look.theme.includes(theme);

      // 2. behaviour
      await page.goto(`${base}/${theme}/behaviour.html`);
      await page.waitForFunction(() => document.getElementById('trig').getAttribute('aria-describedby') === 'trig-tip'
        && document.querySelector('#trig-tip .sf-tooltip-text'), null, {timeout: 15000});
      const shown = () => page.evaluate(() => !document.getElementById('trig-tip').hidden);
      const centre = await page.evaluate(() => { const r = document.getElementById('trig').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const steps = {};
      await page.mouse.move(1, 1); await tick(page);
      await page.mouse.move(...centre); await tick(page);
      steps.hover = await shown();
      await page.mouse.down(); await tick(page);
      steps.pressHides = !(await shown());
      await page.mouse.up(); await tick(page);
      await page.waitForTimeout(250);
      steps.afterClickHidden = !(await shown());
      steps.clickFocused = await page.evaluate(() => document.activeElement?.id === 'trig');
      await page.mouse.move(1, 1); await tick(page);
      steps.leaveHidden = !(await shown());
      await page.mouse.move(...centre); await tick(page);
      steps.hoverAgain = await shown();
      await page.mouse.move(1, 1); await tick(page);
      steps.leaveWithMouseFocus = !(await shown());
      await page.click('#away'); await page.mouse.move(1, 1); await tick(page);
      steps.awayHidden = !(await shown());
      await page.keyboard.press('Tab'); await tick(page);
      steps.tabFocus = await page.evaluate(() => document.activeElement?.id === 'trig');
      steps.keyboardShows = await shown();
      await page.keyboard.press('Enter'); await tick(page);
      steps.enterHides = !(await shown());
      await page.keyboard.press('Shift+Tab'); await tick(page);
      await page.keyboard.press('Tab'); await tick(page);
      steps.tabAgainShows = await shown();
      await page.keyboard.press('Escape'); await tick(page);
      steps.escapeHides = !(await shown());
      result.behaviour = {...steps, ok: Object.values(steps).every(Boolean)};

      // 3. menus in a compact region
      await page.goto(`${base}/${theme}/menus.html`);
      await page.waitForFunction(() => ['m-in', 'm-out', 'm-sized'].every((id) => document.getElementById(id)?.openFor), null, {timeout: 15000});
      await page.evaluate(() => {
        const entries = [{id: 'copy', text: 'Копировать', shortcut: 'mod+c'}, {id: 'more', text: 'Ещё', submenu: [{id: 'a', text: 'Первый'}, {id: 'b', text: 'Второй'}]}];
        for (const id of ['m-in', 'm-out', 'm-sized']) document.getElementById(id).entries = entries;
      });
      await tick(page);
      const openAndMeasure = (menu, anchor, sub = false) => page.evaluate(async ({menu, anchor, sub}) => {
        const element = document.getElementById(menu);
        await element.openFor(document.getElementById(anchor), {focus: 'none'});
        await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 30)));
        const measure = (root) => {
          const row = root.querySelector('[role="menuitem"]');
          const text = row.querySelector('.sf-context-menu-item-text, span');
          return {row: Math.round(row.getBoundingClientRect().height * 10) / 10, font: parseFloat(getComputedStyle(text).fontSize)};
        };
        const own = measure(element.querySelector('.sf-context-menu'));
        let child = null;
        if (sub) {
          const rows = element.querySelectorAll('[role="menuitem"]');
          await element.openSubmenu(rows[1], element.entries[1], {focus: 'none'});
          await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 30)));
          child = measure(element._submenu.querySelector('.sf-context-menu'));
        }
        element.close({restoreFocus: false});
        return {...own, sub: child, density: element.querySelector('.sf-context-menu').getAttribute('data-sf-density')};
      }, {menu, anchor, sub});
      const menusResult = {
        inRegion: await openAndMeasure('m-in', 'a-in'),
        onBody: await openAndMeasure('m-out', 'a-out', true),
        sized: await openAndMeasure('m-sized', 'a-sized'),
        fromOutside: await openAndMeasure('m-out', 'a-plain'),
      };
      const m = menusResult;
      menusResult.ok = near(m.inRegion.row, m.onBody.row) && m.inRegion.font === m.onBody.font
        && m.onBody.sub && near(m.onBody.sub.row, m.onBody.row)
        && m.sized.row > m.inRegion.row && near(m.fromOutside.row, m.sized.row)
        && m.onBody.density === null;
      result.menus = menusResult;

      result.errors = errors;
      (samples[theme] ||= []).push(result);
      if (errors.length || !result.look.ok || !result.behaviour.ok || !result.menus.ok) failures.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({loads: LOADS, themes: THEMES, failures: failures.length, samples}, null, 2));
if (failures.length && !report) {
  console.error(`${failures.length} of ${LOADS * THEMES.length} load(s) failed`);
  process.exit(1);
}

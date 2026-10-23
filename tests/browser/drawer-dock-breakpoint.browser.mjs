#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The width from which a docked sf-drawer is a column of the page is the
// drawer's own (simai/ui-source#25, the ui-chat kit needs 64rem), and a switch
// outside the panel hides and shows a docked column. On the built bytes:
//   - in a 900px dock host: a drawer without a threshold is a column (48rem),
//     one with dock-breakpoint="64rem" floats and takes no room, one under
//     --sf-drawer-dock-breakpoint: 64rem floats too, and the attribute wins
//     over the variable; widened to 1100px all three are columns; at 700px
//     the 48rem one is not, the 40rem one still is;
//   - without a host the window decides: at 900px a 64rem drawer floats, at
//     1100px it is a column, and changing the attribute redraws it;
//   - a data-drawer="toggle" switch hides the docked column (the page gets
//     its room back), shows it again, and its aria-expanded follows: true
//     while the column is shown, false while it is hidden.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/close/css/close.css', 'smart/smart/drawer/css/drawer.css'].map((p) => join(out, p));
const modules = ['core/core/js/smart-base.js', 'smart/smart/drawer/js/drawer.js'].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const hostPage = `<!doctype html><html lang="ru" class="theme-dark"><head><meta charset="utf-8"></head><body style="margin:0">
<div id="host" data-sf-drawer-dock-host style="inline-size:900px;block-size:400px">
  <button type="button" id="switch" data-drawer="toggle" aria-controls="plain">Панель</button> Страница
</div>
<sf-drawer id="plain" docked open placement="inline-start" size="1/2" label="Обычная"><p>Текст</p></sf-drawer>
<sf-drawer id="own" docked open dock-breakpoint="64rem" placement="inline-end" size="1/2" label="Своя"><p>Текст</p></sf-drawer>
<div style="--sf-drawer-dock-breakpoint: 64rem">
  <sf-drawer id="themed" docked placement="inline-end" size="1/2" label="Из переменной"><p>Текст</p></sf-drawer>
  <sf-drawer id="both" docked dock-breakpoint="40rem" placement="inline-end" size="1/2" label="Атрибут сильнее"><p>Текст</p></sf-drawer>
</div>
</body></html>`;
const windowPage = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0">
<sf-drawer id="chat" docked open dock-breakpoint="64rem" placement="inline-end" size="1/2" label="Чат"><p>Текст</p></sf-drawer>
</body></html>`;

const load = async (browser, html, width) => {
  const context = await browser.newContext({viewport: {width, height: 700}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(html);
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path});
  await page.waitForFunction(() => customElements.get('sf-drawer') && [...document.querySelectorAll('sf-drawer')].every((d) => document.querySelector(`[data-sf-drawer-id="${d.id}"]`)));
  await page.waitForTimeout(300);
  return {context, page};
};
const state = (page, id) => page.evaluate((id) => {
  const root = document.querySelector(`[data-sf-drawer-id="${id}"]`);
  const css = getComputedStyle(document.documentElement);
  const panel = root.querySelector('[data-sf-drawer-panel]');
  return {column: root.getAttribute('data-sf-drawer-column'), open: document.getElementById(id).hasAttribute('open'),
    shadow: getComputedStyle(panel).boxShadow !== 'none', visible: root.getAttribute('aria-hidden') === 'false',
    start: css.getPropertyValue('--sf-drawer-dock-inline-start').trim(), end: css.getPropertyValue('--sf-drawer-dock-inline-end').trim(),
    host: document.getElementById('host') ? getComputedStyle(document.getElementById('host')).paddingInlineStart : null};
}, id);
const width = (page, value) => page.evaluate((value) => { document.getElementById('host').style.inlineSize = value; }, value);

const browser = await chromium.launch();
try {
  let {context, page} = await load(browser, hostPage, 1280);
  await page.evaluate(() => { document.getElementById('themed').open(); document.getElementById('both').open(); });
  await page.waitForTimeout(300);
  let read = {plain: await state(page, 'plain'), own: await state(page, 'own'), themed: await state(page, 'themed'), both: await state(page, 'both')};
  evidence.host900 = read;
  check('900px host: no threshold is a column (48rem)', read.plain.column === 'true' && read.plain.start !== '', read);
  check('900px host: dock-breakpoint="64rem" floats', read.own.column === 'false' && read.own.shadow, read);
  check('900px host: --sf-drawer-dock-breakpoint 64rem floats', read.themed.column === 'false', read);
  check('900px host: the attribute wins over the variable', read.both.column === 'true', read);
  check('900px host: the floating ones take no room, the column on that side does', read.both.end !== '' && read.plain.start !== '', read);

  await width(page, '1100px');
  await page.waitForTimeout(300);
  read = {own: await state(page, 'own'), themed: await state(page, 'themed')};
  evidence.host1100 = read;
  check('1100px host: the 64rem drawers are columns', read.own.column === 'true' && read.themed.column === 'true' && !read.own.shadow, read);

  // The reserved padding is part of the host's box, so the 64rem pair closes
  // first: a fixed-width host cannot be narrower than what it reserves.
  await page.evaluate(() => { document.getElementById('own').close(); document.getElementById('themed').close(); });
  await page.waitForTimeout(300);
  await width(page, '700px');
  await page.waitForTimeout(300);
  read = {plain: await state(page, 'plain'), both: await state(page, 'both')};
  evidence.host700 = read;
  check('700px host: under 48rem the default is not a column', read.plain.column === 'false' && read.plain.start === '', read);
  check('700px host: 40rem on the attribute still is', read.both.column === 'true', read);
  await width(page, '1100px');
  await page.waitForTimeout(300);

  // The switch hides and shows the docked column; aria-expanded follows.
  const expanded = () => page.evaluate(() => document.getElementById('switch').getAttribute('aria-expanded'));
  check('the switch says the column is shown', (await expanded()) === 'true', {said: await expanded()});
  const before = await state(page, 'plain');
  await page.locator('#switch').click();
  await page.waitForTimeout(300);
  const hidden = await state(page, 'plain');
  evidence.hidden = {before, hidden};
  check('the switch hides the docked column', !hidden.open && !hidden.visible, hidden);
  check('the page gets its room back', hidden.start === '' && hidden.host === '0px', hidden);
  check('the switch says it is hidden', (await expanded()) === 'false', {said: await expanded()});
  await page.locator('#switch').click();
  await page.waitForTimeout(300);
  const shown = await state(page, 'plain');
  check('the switch shows it again, a column', shown.open && shown.column === 'true' && shown.start === before.start, shown);
  check('and says so', (await expanded()) === 'true', {said: await expanded()});
  await context.close();

  // Without a host the window decides, by the drawer's threshold.
  ({context, page} = await load(browser, windowPage, 900));
  let chat = await state(page, 'chat');
  evidence.window900 = chat;
  check('900px window: a 64rem drawer floats', chat.column === 'false' && chat.end === '', chat);
  await page.evaluate(() => document.getElementById('chat').setAttribute('dock-breakpoint', '48rem'));
  await page.waitForTimeout(300);
  chat = await state(page, 'chat');
  check('changing the attribute redraws it: 48rem, a column', chat.column === 'true' && chat.end !== '', chat);
  await page.evaluate(() => document.getElementById('chat').setAttribute('dock-breakpoint', '64rem'));
  await page.setViewportSize({width: 1100, height: 700});
  await page.waitForTimeout(400);
  chat = await state(page, 'chat');
  evidence.window1100 = chat;
  check('1100px window: a column', chat.column === 'true' && chat.end !== '', chat);
  await page.setViewportSize({width: 900, height: 700});
  await page.waitForTimeout(400);
  chat = await state(page, 'chat');
  check('back to 900px: it floats again', chat.column === 'false' && chat.end === '', chat);
  await context.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DRAWER_DOCK_BREAKPOINT_OK');

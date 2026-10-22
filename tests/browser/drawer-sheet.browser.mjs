#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-drawer as a bottom sheet (simai/ui-source#20, ui-mail F7) and the panels
// against an app bar (simai/ui-source#29, ui-mail P-13), on the built bytes:
//   - sheet, on a touch phone at 390px under a 56px app bar: it opens from the
//     bottom edge across the whole width; snap="half" is half the room under
//     the bar, "full" is all of it and starts exactly under the bar, "auto" is
//     the content's height; a grab handle a control 1/2 tall stands on top;
//   - the handle: a press toggles half and full, ArrowDown steps down, and
//     each change says drawer:snap; a swipe down on it closes the sheet;
//   - a modal sheet takes the focus and keeps it (Tab cycles inside); Escape
//     closes only the innermost layer (a side drawer opened over the sheet);
//   - prefers-reduced-motion: no transition;
//   - side panels under the app bar: a sliding panel and its scrim start under
//     the bar (--sf-drawer-block-start), the attribute block-start overrides
//     it, and the bar's switch stays in reach;
//   - controlled: while the outside switch that names the panel in
//     aria-controls is on screen there is no close button; when the switch
//     leaves the screen, the button comes back; without controlled it stays.
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
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const BAR = 56;

const html = `<!doctype html><html lang="ru" class="theme-light" style="--sf-drawer-block-start:${BAR}px"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">
<header id="bar" style="position:fixed;inset:0 0 auto;block-size:${BAR}px;display:flex;align-items:center;gap:8px;padding-inline:8px;background:#eee;z-index:1">
  <button id="nav-switch" type="button" aria-controls="nav" data-drawer="toggle">Структура</button>
  <button id="other-switch" type="button" aria-controls="plain-side" data-drawer="toggle">Свойства</button>
</header>
<main style="padding-block-start:${BAR}px;block-size:2000px">Страница</main>
<sf-drawer id="sheet" placement="bottom" snap="half" title="Блоки">
  <button type="button" id="first">Первый</button><button type="button">Второй</button><button type="button" id="last">Последний</button>
</sf-drawer>
<sf-drawer id="short" placement="bottom" title="Коротко"><p style="margin:0">Одна строка</p></sf-drawer>
<sf-drawer id="side" placement="inline-end" size="1/2" title="Поверх"><button type="button">Кнопка</button></sf-drawer>
<sf-drawer id="nav" controlled modal="false" placement="inline-start" size="1/2" title="Структура"><p>Блоки</p></sf-drawer>
<sf-drawer id="plain-side" modal="false" placement="inline-end" size="1/2" title="Свойства"><p>Поля</p></sf-drawer>
<sf-drawer id="modal-side" placement="inline-end" size="1/2" title="Модальная"><p>Текст</p></sf-drawer>
<sf-drawer id="own" block-start="64px" modal="false" placement="inline-end" size="1/2" title="Своя высота"><p>Текст</p></sf-drawer>
</body></html>`;

const load = async (browser, options, motion = 'no-preference') => {
  const context = await browser.newContext({...options, reducedMotion: motion});
  const page = await context.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(html);
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path});
  await page.waitForFunction(() => customElements.get('sf-drawer') && document.querySelectorAll('[data-sf-drawer-root]').length === 7);
  await page.evaluate(() => {
    window.snaps = [];
    document.addEventListener('drawer:snap', (event) => window.snaps.push(event.detail.drawer.getAttribute('snap')));
  });
  return {context, page};
};
const panel = (page, id) => page.evaluate((id) => {
  const root = document.querySelector(`[data-sf-drawer-id="${id}"]`);
  const box = root.querySelector('[data-sf-drawer-panel]').getBoundingClientRect();
  const handle = root.querySelector('[data-sf-drawer-handle]')?.getBoundingClientRect() ?? null;
  const overlay = root.querySelector('[data-sf-drawer-overlay]');
  return {top: box.top, bottom: box.bottom, left: box.left, width: box.width, height: box.height,
    handle: handle && {height: handle.height, top: handle.top}, close: Boolean(root.querySelector('.sf-drawer-close')),
    open: document.getElementById(id).hasAttribute('open'), snap: document.getElementById(id).getAttribute('snap'),
    overlayTop: overlay.hidden ? null : overlay.getBoundingClientRect().top,
    transition: getComputedStyle(root.querySelector('[data-sf-drawer-panel]')).transitionDuration};
}, id);
const settle = (page) => page.waitForTimeout(450);

const browser = await chromium.launch();
try {
  // The sheet on a touch phone.
  {
    const {context, page} = await load(browser, {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    const room = 844 - BAR;
    const control = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.blockSize = 'var(--sf-ui-1\\/2--control-height)';
      document.body.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      return height;
    });
    await page.evaluate(() => document.getElementById('sheet').open());
    await settle(page);
    const half = await panel(page, 'sheet');
    evidence.half = half;
    check('the sheet opens from the bottom edge', near(half.bottom, 844), half);
    check('the sheet spans the whole width', near(half.left, 0) && near(half.width, 390), half);
    check('snap half is half the room under the app bar', near(half.height, room / 2), {half, room});
    check('the handle is a control 1/2 tall on top of the sheet', half.handle && near(half.handle.height, control) && near(half.handle.top, half.top + 1, 1.01), {half, control});
    const inside = await page.evaluate(() => document.querySelector('[data-sf-drawer-id="sheet"] [data-sf-drawer-panel]').contains(document.activeElement));
    check('a modal sheet takes the focus', inside);
    for (let press = 0; press < 7; press += 1) await page.keyboard.press('Tab');
    const kept = await page.evaluate(() => document.querySelector('[data-sf-drawer-id="sheet"] [data-sf-drawer-panel]').contains(document.activeElement));
    check('Tab stays inside the sheet', kept);

    await page.click('[data-sf-drawer-id="sheet"] [data-sf-drawer-handle]');
    await settle(page);
    const full = await panel(page, 'sheet');
    evidence.full = full;
    check('a press on the handle opens the sheet to full', full.snap === 'full' && near(full.height, room), full);
    check('full starts exactly under the app bar', near(full.top, BAR), full);
    await page.focus('[data-sf-drawer-id="sheet"] [data-sf-drawer-handle]');
    await page.keyboard.press('ArrowDown');
    await settle(page);
    const down = await panel(page, 'sheet');
    check('ArrowDown on the handle steps down to half', down.snap === 'half' && near(down.height, room / 2), down);
    const snaps = await page.evaluate(() => window.snaps);
    check('each change says drawer:snap', JSON.stringify(snaps) === JSON.stringify(['full', 'half']), {snaps});

    // Escape: the innermost layer only.
    await page.evaluate(() => document.getElementById('side').open());
    await settle(page);
    await page.keyboard.press('Escape');
    await settle(page);
    const afterOne = {side: (await panel(page, 'side')).open, sheet: (await panel(page, 'sheet')).open};
    await page.keyboard.press('Escape');
    await settle(page);
    const afterTwo = {sheet: (await panel(page, 'sheet')).open};
    evidence.escape = {afterOne, afterTwo};
    check('Escape closes the side drawer over the sheet, not the sheet', afterOne.side === false && afterOne.sheet === true, afterOne);
    check('a second Escape closes the sheet', afterTwo.sheet === false, afterTwo);

    // Swipe down on the handle closes it.
    await page.evaluate(() => document.getElementById('sheet').open());
    await settle(page);
    const handle = await page.locator('[data-sf-drawer-id="sheet"] [data-sf-drawer-handle]').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + step * 30);
    const dragging = await panel(page, 'sheet');
    await page.mouse.up();
    await settle(page);
    const swiped = await panel(page, 'sheet');
    evidence.swipe = {during: dragging.top, after: swiped.open};
    check('the sheet follows the finger down', dragging.top > handle.y + 200, {dragging, handle});
    check('a swipe down closes the sheet', swiped.open === false, swiped);

    // auto: the content's height.
    await page.evaluate(() => document.getElementById('short').open());
    await settle(page);
    const auto = await panel(page, 'short');
    evidence.auto = auto;
    check('snap auto is the content\'s height, at the bottom', auto.height < room / 2 && near(auto.bottom, 844), auto);
    await context.close();
  }

  // Reduced motion.
  {
    const {context, page} = await load(browser, {viewport: {width: 390, height: 844}}, 'reduce');
    await page.evaluate(() => document.getElementById('sheet').open());
    await settle(page);
    const still = await panel(page, 'sheet');
    check('reduced motion: the sheet has no transition', still.transition === '0s', still);
    await context.close();
  }

  // Side panels under the app bar, and the controlled close button.
  {
    const {context, page} = await load(browser, {viewport: {width: 1024, height: 768}});
    await page.evaluate(() => { for (const id of ['nav', 'plain-side']) document.getElementById(id).open(); });
    await settle(page);
    const nav = await panel(page, 'nav');
    const side = await panel(page, 'plain-side');
    evidence.bar = {nav, side};
    check('a sliding panel starts under the app bar', near(nav.top, BAR) && near(side.top, BAR), {nav, side});
    const reach = await page.evaluate(() => {
      const box = document.getElementById('nav-switch').getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.id;
    });
    check('the app bar\'s switch stays in reach', reach === 'nav-switch', {reach});
    check('controlled: no close button while its switch is on screen', nav.close === false, nav);
    check('without controlled the close button stays', side.close === true, side);
    await page.evaluate(() => { document.getElementById('nav-switch').style.display = 'none'; window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(200);
    const navAlone = await panel(page, 'nav');
    check('controlled: the close button comes back when the switch leaves the screen', navAlone.close === true, navAlone);
    await page.evaluate(() => { for (const id of ['nav', 'plain-side']) document.getElementById(id).close(); document.getElementById('modal-side').open(); });
    await settle(page);
    const modal = await panel(page, 'modal-side');
    check('a modal panel and its scrim start under the app bar', near(modal.top, BAR) && near(modal.overlayTop, BAR), modal);
    await page.evaluate(() => { document.getElementById('modal-side').close(); document.getElementById('own').open(); });
    await settle(page);
    const own = await panel(page, 'own');
    check('the block-start attribute sets a panel\'s own offset', near(own.top, 64), own);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('DRAWER_SHEET_OK');

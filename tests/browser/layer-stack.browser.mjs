#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The one document layer stack (standard simai.smart-component 1.3.8 §19.1-19.3,
// §4.5), measured with real key presses on the built runtime:
//   - #36: Escape over a modal opened from a drawer closes the modal only, and
//     focus goes back to the button in the drawer;
//   - #37: a drawer opened from a modal is drawn above it;
//   - focus returns through three stacked layers, each to its own opener;
//   - a drawer closed under an open modal moves no focus and leaves the page
//     locked;
//   - #42: a page button with a page listener in sf-modal's footer is the same
//     node after opening and closing twice, keeps a property, and its listener
//     fires; the window's root no longer repeats the element's id;
//   - the modal portal carries the host's lang, dir and theme;
//   - the close request says why: escape, outside, close.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/modal/css/modal.css',
  'smart/smart/drawer/css/drawer.css',
];
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/drawer/js/drawer.js',
  'smart/smart/modal/js/modal.js',
];
const absent = [...styles, ...modules].map((p) => join(out, p)).filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const html = '<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8">'
  + styles.map((p) => `<link rel="stylesheet" href="/${p}">`).join('')
  + '</head><body style="margin:0;padding:40px">'
  + '<main style="height:200vh">'
  + '<button id="page-opener" type="button" data-sf-drawer-open="d1">Панель</button>'
  + '<button id="modal-opener" type="button" data-sf-modal-open="m1">Окно</button>'
  + '<section lang="en" dir="rtl" class="theme-dark"><sf-modal id="m-en" title="English"><p slot="content">Hello</p></sf-modal></section>'
  + '</main>'
  + '<sf-drawer id="d1" title="Панель"><button id="d1-open-modal" type="button" data-sf-modal-open="m3">Окно из панели</button></sf-drawer>'
  + '<sf-modal id="m3" title="Над панелью"><div slot="content"><button id="m3-open-drawer" type="button" data-sf-drawer-open="d2">Панель из окна</button></div></sf-modal>'
  + '<sf-drawer id="d2" title="Третья"><button id="d2-button" type="button">Внутри</button></sf-drawer>'
  + '<sf-modal id="m1" title="Письмо"><p slot="content">Текст</p>'
  + '<button slot="footer" id="page-button" type="button">Готово</button></sf-modal>'
  // The page's own listener and property on the footer button, before upgrade.
  + '<script>window.pageButton = document.getElementById("page-button");'
  + 'window.pageButton.pagesOwn = 7; window.pageClicks = 0;'
  + 'window.pageButton.addEventListener("click", () => { window.pageClicks += 1; });'
  + 'window.reasons = [];'
  + 'document.addEventListener("modal:before-close", (e) => window.reasons.push(["modal", e.detail.modalId, e.detail.reason, e.detail.unsaved]));'
  + 'document.addEventListener("drawer:before-close", (e) => window.reasons.push(["drawer", e.detail.drawerId, e.detail.reason]));'
  + '</script>'
  + modules.map((p) => `<script type="module" src="/${p}"></script>`).join('')
  + '</body></html>';

const failures = [];
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, expected: wanted});
};
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
    const path = join(out, decodeURIComponent(url.pathname));
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${origin}/`);
  await page.waitForTimeout(1500);
  const unupgraded = await page.evaluate(() => ['sf-drawer', 'sf-modal'].filter((tag) => !customElements.get(tag)));
  if (unupgraded.length) throw new Error(`${unupgraded.join(', ')} not defined`);

  const settle = (ms = 500) => page.waitForTimeout(ms);
  // A person's press: the control takes focus, then the click.
  const press = async (selector) => {
    await page.evaluate((s) => { const el = document.querySelector(s); el.focus(); el.click(); }, selector);
    await settle();
  };
  const state = () => page.evaluate(() => ({
    d1: document.getElementById('d1').hasAttribute('open'),
    d2: document.getElementById('d2').hasAttribute('open'),
    m1: document.getElementById('m1').openState,
    m3: document.getElementById('m3').openState,
    active: document.activeElement?.id || document.activeElement?.tagName,
    locked: document.documentElement.classList.contains('overflow-hidden')
      || getComputedStyle(document.documentElement).overflow === 'hidden',
  }));
  const zOf = (selector) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).zIndex), selector);

  // #36 and three layers: page -> drawer -> modal -> drawer.
  await press('#page-opener');
  await press('#d1-open-modal');
  const twoOpen = await state();
  expect('#36 drawer then modal open', [twoOpen.d1, twoOpen.m3], [true, true]);
  await press('#m3-open-drawer');
  const threeOpen = await state();
  expect('three layers open', [threeOpen.d1, threeOpen.m3, threeOpen.d2], [true, true, true]);
  const z = {
    d1: await zOf('[data-sf-drawer-portal="d1"] [data-sf-drawer-root]'),
    m3: await zOf('[data-sf-modal-portal="m3"] .sf-modal'),
    d2: await zOf('[data-sf-drawer-portal="d2"] [data-sf-drawer-root]'),
  };
  expect('#37 each layer above the one it was opened from', z.d1 < z.m3 && z.m3 < z.d2, true);

  await page.keyboard.press('Escape');
  await settle();
  const afterFirst = await state();
  expect('Escape 1 closes the top drawer only, focus back in the modal',
    [afterFirst.d2, afterFirst.m3, afterFirst.d1, afterFirst.active], [false, true, true, 'm3-open-drawer']);
  await page.keyboard.press('Escape');
  await settle(800);
  const afterSecond = await state();
  expect('#36 Escape 2 closes the modal only, focus back on the button in the drawer',
    [afterSecond.m3, afterSecond.d1, afterSecond.active], [false, true, 'd1-open-modal']);
  await page.keyboard.press('Escape');
  await settle();
  const afterThird = await state();
  expect('Escape 3 closes the drawer, focus back on the page opener',
    [afterThird.d1, afterThird.active, afterThird.locked], [false, 'page-opener', false]);

  // #37 on its own: a modal, then a drawer opened by script, drawn above it.
  await press('#modal-opener');
  await page.evaluate(() => document.getElementById('d1').open());
  await settle();
  expect('#37 a drawer opened from a modal is drawn above it',
    await zOf('[data-sf-drawer-portal="d1"] [data-sf-drawer-root]') > await zOf('[data-sf-modal-portal="m1"] .sf-modal'), true);
  await page.keyboard.press('Escape');
  await settle();
  await page.keyboard.press('Escape');
  await settle(800);

  // A drawer closed from a script under an open modal: no focus moves, the page stays locked.
  await press('#page-opener');
  await press('#d1-open-modal');
  await page.evaluate(() => document.querySelector('[data-sf-modal-portal="m3"] [data-sf-modal-panel]').focus());
  await page.evaluate(() => document.getElementById('d1').close());
  await settle();
  const background = await state();
  expect('a background drawer closing keeps focus in the modal and the page locked',
    [background.d1, background.m3, background.active === 'SECTION' || background.active === 'm3-open-drawer', background.locked],
    [false, true, true, true]);
  await page.keyboard.press('Escape');
  await settle(800);
  expect('the last layer closed unlocks the page', (await state()).locked, false);

  // #42: the page's footer button is placed, not copied.
  for (let round = 1; round <= 2; round += 1) {
    await press('#modal-opener');
    const placed = await page.evaluate(() => {
      const shown = document.querySelector('[data-sf-modal-portal="m1"] #page-button');
      return {same: shown === window.pageButton, connected: window.pageButton.isConnected, own: shown?.pagesOwn};
    });
    expect(`#42 round ${round}: the footer button is the page's node`, placed, {same: true, connected: true, own: 7});
    await page.click('[data-sf-modal-portal="m1"] #page-button');
    await settle(100);
    await page.keyboard.press('Escape');
    await settle(800);
  }
  expect('#42 the page listener fired once per round', await page.evaluate(() => window.pageClicks), 2);
  expect('#42 one element holds the id m1', await page.evaluate(() => document.querySelectorAll('#m1').length), 1);

  // §19.1: the portal keeps where it came from.
  await page.evaluate(() => document.getElementById('m-en').open());
  await settle();
  const origin19 = await page.evaluate(() => {
    const portal = document.querySelector('[data-sf-modal-portal="m-en"]');
    return {lang: portal.getAttribute('lang'), dir: portal.getAttribute('dir'),
      dark: portal.classList.contains('theme-dark'),
      scheme: getComputedStyle(portal.querySelector('[data-sf-modal-panel]')).colorScheme,
      close: portal.querySelector('.sf-modal-close-button')?.getAttribute('aria-label')};
  });
  expect('§19.1 the portal carries lang, dir and theme', origin19, {lang: 'en', dir: 'rtl', dark: true, scheme: 'dark', close: 'Close'});
  await page.click('[data-sf-modal-portal="m-en"] .sf-modal-close-button');
  await settle(800);

  // §19.3: the close request says why.
  await press('#modal-opener');
  await page.mouse.click(5, 5);
  await settle(800);
  const reasons = await page.evaluate(() => window.reasons.map((entry) => entry.join(':')));
  expect('§19.3 reasons', reasons, [
    'drawer:d2:escape', 'modal:m3:escape:false', 'drawer:d1:escape',
    'drawer:d1:escape', 'modal:m1:escape:false',
    'drawer:d1:api', 'modal:m3:escape:false',
    'modal:m1:escape:false', 'modal:m1:escape:false',
    'modal:m-en:close:false',
    'modal:m1:outside:false',
  ]);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify({failures}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({passed: 'layer-stack'}));

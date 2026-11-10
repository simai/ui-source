#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-modal initial-focus (decisions C25, C39): a delete window opens with the
// focus on its safe answer, «Отмена», without the page marking it -- opened from
// the keyboard and by the mouse, light and dark, 3 loads -- and no ring is drawn
// around the panel. Also: an sf-confirm in a window gives its declining answer
// the focus; a window that asks nothing still focuses its panel (auto, as
// before); initial-focus="first" and "panel" name the target; the page's
// [autofocus] still wins under auto. Only answers make a question window: a
// red sf-badge in the body of a plain window leaves the focus on the panel, on
// the first open and on the next (recipes gaps acceptance D3).
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const page404 = new Set();

// One page of the probe over the built bytes: <body> markup, the core, nothing else.
async function open(browser, body, viewport = {width: 1200, height: 800}, theme = "light") {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'probe', pluginListVersion: 'probe', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = product === 'rule' ? join(out, 'core', 'rule', ...rest) : join(out, product, product, ...rest);
    if (existsSync(file) && statSync(file).isFile()) return route.fulfill({status: 200, contentType: types[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
    page404.add(url.pathname);
    return route.fulfill({status: 404, body: ''});
  });
  page.errors = errors;
  await page.goto('http://probe.test/');
  return page;
}
const defined = (page, tags) => page.waitForFunction((list) => list.every((tag) => customElements.get(tag)), tags, {timeout: 15000});

const deleteWindow = (extra = '', cancelExtra = '') => `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button" data-sf-modal-open="m">Удалить сайт</button>
  <sf-modal modal-id="m" heading="Удалить сайт shop-example?" show-footer="false" width="var(--sf-g4)"${extra}>
    <form slot="content" class="flex flex-col"><p class="m-0">Вернуть будет нельзя.</p>
      <div class="m-top-3 flex gap-2"><sf-button native-type="submit" status="danger" text="Удалить сайт" data-probe="danger"></sf-button><sf-button appearance="ghost" scheme="on-surface" text="Отмена" data-sf-modal-close="m" data-probe="safe"${cancelExtra}></sf-button></div></form>
  </sf-modal></div>`;
const confirmWindow = `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button" data-sf-modal-open="m">Удалить</button>
  <sf-modal modal-id="m" heading="Удаление" show-footer="false">
    <div slot="content"><sf-confirm question="Удалить «Смета.xlsx»?" accept-text="Удалить" status="danger"></sf-confirm></div>
  </sf-modal></div>`;
const plainWindow = (extra = '') => `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button" data-sf-modal-open="m">Настройки</button>
  <sf-modal modal-id="m" heading="Настройки" show-footer="false"${extra}>
    <form slot="content" class="flex flex-col"><label>Имя <input id="name" data-probe="first"></label>
      <div class="m-top-3 flex gap-2"><sf-button text="Сохранить"></sf-button><sf-button appearance="ghost" text="Отмена" data-sf-modal-close="m"></sf-button></div></form>
  </sf-modal></div>`;

const badgeWindow = `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button" data-sf-modal-open="m">Статус</button>
  <!-- sf-button is loaded before the window opens, so its answers are drawn at
       once while the badge, fetched when the window draws it, still carries
       status="danger" (on the first open only; it then reads error). -->
  <sf-button text="Обновить"></sf-button>
  <sf-modal modal-id="m" heading="Обычное окно с красным бейджем" show-footer="false">
    <div slot="content" class="flex flex-col"><p class="m-0">Статус: <sf-badge status="danger" text="Ошибка"></sf-badge></p>
      <div class="m-top-3 flex gap-2"><sf-button text="Повторить"></sf-button><sf-button appearance="ghost" text="Закрыть" data-sf-modal-close="m"></sf-button></div></div>
  </sf-modal></div>`;

async function opened(page, how) {
  if (how === 'keyboard') { await page.focus('#open'); await page.keyboard.press('Enter'); } else await page.click('#open');
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const active = document.activeElement;
    const panel = document.querySelector('[data-sf-modal-panel]');
    const css = getComputedStyle(panel);
    const host = active?.closest('[data-probe]');
    return {active: active === panel ? 'panel' : host ? host.dataset.probe : active?.closest('[data-action]')?.dataset.action || active?.id || active?.tagName.toLowerCase(),
      text: active?.textContent?.trim().slice(0, 20), activeRing: active?.matches(':focus-visible') ?? false,
      panelRing: css.outlineStyle !== 'none' && panel.matches(':focus-visible')};
  });
}

const cases = [
  {name: 'delete window: «Отмена» without autofocus', body: deleteWindow(), want: 'safe'},
  {name: 'sf-confirm in a window: its declining answer', body: confirmWindow, want: 'decline'},
  {name: 'a window that asks nothing: the panel, as before', body: plainWindow(), want: 'panel'},
  {name: 'initial-focus="first": the first control', body: plainWindow(' initial-focus="first"'), want: 'first'},
  {name: 'initial-focus="panel" in a delete window: the panel', body: deleteWindow(' initial-focus="panel"'), want: 'panel'},
  {name: 'initial-focus="safe" in a window that asks nothing: its closing answer', body: plainWindow(' initial-focus="safe"'), want: 'Отмена'},
  {name: 'a red badge in a plain window: the panel, first open', body: badgeWindow, want: 'panel', again: true},
  {name: '[autofocus] still wins under auto', body: deleteWindow('', '').replace('data-probe="danger"', 'data-probe="danger" autofocus'), want: 'danger'},
];

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    for (const theme of ['light', 'dark']) {
      for (const how of ['keyboard', 'mouse']) {
        for (const item of cases) {
          // The main case runs in every combination; the others once per load.
          if (item !== cases[0] && (theme !== 'light' || how !== 'keyboard')) continue;
          const page = await open(browser, item.body, {width: 1200, height: 800}, theme);
          await defined(page, item.again ? ['sf-modal', 'sf-button'] : ['sf-modal']);
          await page.waitForTimeout(500);
          const got = await opened(page, how);
          const hit = item.want === 'Отмена' ? got.text === 'Отмена' : got.active === item.want;
          if (!hit) note({load, theme, how, case: item.name, got});
          if (got.panelRing) note({load, theme, how, case: `${item.name}: no ring around the panel`, got});
          if (item === cases[0] && how === 'keyboard' && !got.activeRing) note({load, theme, how, case: 'from the keyboard «Отмена» shows its ring', got});
          if (page.errors.length) note({load, theme, how, case: `${item.name}: console clean`, errors: page.errors});
          console.log(JSON.stringify({load, theme, how, case: item.name, ...got}));
          if (item.again) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(700);
            const second = await opened(page, how);
            if (second.active !== item.want) note({load, theme, how, case: `${item.name}: the second open too`, got: second});
            console.log(JSON.stringify({load, theme, how, case: `${item.name} (again)`, ...second}));
          }
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('MODAL_INITIAL_FOCUS_OK');

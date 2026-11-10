#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A question window left without an answer (C39 acceptance D1, R069): the
// window of sf-confirm appearance="window" require="shop-example" in sf-modal
// size="question" is closed by the × (keyboard), the backdrop (mouse), Escape
// on the ×, or the host's close() -- after the name was typed in full, or in
// part with the explanation shown. Each way out:
//
// - reports the decline once ({accepted: false}), as «Отмена» does;
// - gives the focus back to the opener;
// - and the window opened again is a fresh question: an empty field, no
//   explanation, live answers, the focus on «Отмена»; one press on the red
//   answer sends no answer and explains (it does not delete).
//
// Also (L3, C35 on the window form): a decline the host takes (state
// "declined") folds the question away; opened again, it is put again.
// Light and dark, 3 loads; the console stays clean.
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const page404 = new Set();

async function open(browser, body, theme) {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
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

const body = `<main style="padding:16px"><button id="open" type="button" data-sf-modal-open="q">Удалить сайт</button></main>
  <sf-modal modal-id="q" heading="Удалить сайт shop-example?" size="question">
    <sf-confirm slot="content" appearance="window" status="danger" question="Удалить сайт shop-example?" accept-text="Удалить сайт" consequence="Вернуть сайт будет нельзя." require="shop-example">
      <p slot="description">Вместе с сайтом удалятся 1&nbsp;240 страниц, 3&nbsp;200 файлов и заказы.</p>
    </sf-confirm>
  </sf-modal>`;

const state = (page) => page.evaluate(() => {
  const portal = document.querySelector('[data-sf-modal-portal]');
  const confirm = portal?.querySelector('sf-confirm');
  const field = portal?.querySelector('.sf-confirm__field');
  const input = field?.querySelector('input');
  const active = document.activeElement;
  return {
    open: document.querySelector('sf-modal').hasAttribute('open'),
    state: confirm?.getAttribute('state') || 'open',
    focus: active === input ? 'field' : active?.closest('[data-action]')?.dataset.action || active?.id || active?.tagName.toLowerCase(),
    invalid: field?.hasAttribute('invalid') ?? null,
    error: field?.getAttribute('error-message') || '',
    shownError: [...(field?.querySelectorAll('*') ?? [])].some((node) => node.children.length === 0 && /так же, как выше/u.test(node.textContent) && node.getBoundingClientRect().height > 0),
    value: input?.value ?? null,
    label: portal?.querySelector('.sf-confirm__require-label')?.textContent.replace(/\s+/gu, ' ').trim(),
    name: input?.getAttribute('aria-label') || field?.getAttribute('aria-label'),
    disabled: [...(portal?.querySelectorAll('.sf-confirm__actions button') ?? [])].map((button) => button.disabled),
    answers: window.__answers,
  };
});
const settle = (page, ms = 400) => page.waitForTimeout(ms);
async function openWindow(page) {
  await page.focus('#open');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-modal-portal] .sf-confirm__actions button').length === 2
    && document.querySelector('.sf-modal')?.getAttribute('data-sf-modal-state') === 'open', null, {timeout: 15000});
  await settle(page, 700);
}
const expect = (ctx, what, ok, got) => { if (!ok) note({...ctx, what, got}); };
const closeBy = {
  x: async (page) => { await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    const on = await page.evaluate(() => document.activeElement?.classList.contains('sf-modal-close-button'));
    if (!on) await page.focus('[data-sf-modal-portal] .sf-modal-close-button');
    await page.keyboard.press('Enter'); },
  escape: async (page) => { await page.focus('[data-sf-modal-portal] .sf-modal-close-button'); await page.keyboard.press('Escape'); },
  backdrop: async (page) => { await page.mouse.click(8, 450); },
  host: async (page) => { await page.evaluate(() => document.querySelector('sf-modal').close()); },
};
async function typeName(page, text) {
  await page.focus('[data-sf-modal-portal] .sf-confirm__field input');
  await page.keyboard.type(text);
}
const closed = (page) => page.waitForFunction(() => document.querySelector('.sf-modal')?.getAttribute('data-sf-modal-state') !== 'open'
  && !document.querySelector('sf-modal').hasAttribute('open'), null, {timeout: 15000}).then(() => settle(page, 500));

const browser = await chromium.launch();
let runs = 0;
try {
  for (let load = 1; load <= 3; load++) {
    for (const theme of ['light', 'dark']) {
      for (const way of Object.keys(closeBy)) {
        for (const typed of ['full', 'partial']) {
          const ctx = {load, theme, way, typed};
          const page = await open(browser, body, theme);
          await defined(page, ['sf-modal']);
          await page.evaluate(() => {
            window.__answers = [];
            document.addEventListener('sf-confirm-answer', (event) => { window.__answers.push(event.detail.accepted); });
          });
          await openWindow(page);
          if (typed === 'full') await typeName(page, 'shop-example');
          else {
            await typeName(page, 'shop');
            await page.click('[data-sf-modal-portal] .sf-confirm__actions [data-action="accept"]');
            await settle(page);
          }
          let s = await state(page);
          expect(ctx, 'before closing: no answer yet', s.answers.length === 0, s.answers);
          if (typed === 'partial') expect(ctx, 'before closing: the explanation is shown', s.shownError, s);
          await closeBy[way](page);
          await closed(page);
          s = await state(page);
          expect(ctx, 'closing without an answer reports the decline once', JSON.stringify(s.answers) === '[false]', s.answers);
          expect(ctx, 'the focus goes back to the opener', s.focus === 'open', s.focus);
          await openWindow(page);
          s = await state(page);
          expect(ctx, 'reopened: the field is empty', s.value === '', s.value);
          expect(ctx, 'reopened: no explanation', !s.invalid && !s.shownError, s);
          expect(ctx, 'reopened: live answers', s.disabled.every((value) => !value), s.disabled);
          expect(ctx, 'reopened: the focus on «Отмена»', s.focus === 'decline', s.focus);
          await page.click('[data-sf-modal-portal] .sf-confirm__actions [data-action="accept"]');
          await settle(page);
          s = await state(page);
          expect(ctx, 'reopened: one press on the red answer sends nothing', JSON.stringify(s.answers) === '[false]', s.answers);
          expect(ctx, 'reopened: the press explains in the field', s.focus === 'field' && s.shownError, s);
          expect(ctx, 'console clean', page.errors.length === 0, page.errors);
          runs++;
          await page.close();
        }
      }
      // L3: the host takes the decline; the question folds away, the window closes.
      const ctx = {load, theme, way: 'host takes the decline'};
      const page = await open(browser, body, theme);
      await defined(page, ['sf-modal']);
      await page.evaluate(() => {
        window.__answers = [];
        document.addEventListener('sf-confirm-answer', (event) => { window.__answers.push(event.detail.accepted); if (!event.detail.accepted) event.target.setAttribute('state', 'declined'); });
      });
      await openWindow(page);
      await page.click('[data-sf-modal-portal] .sf-confirm__actions [data-action="decline"]');
      await closed(page);
      let s = await page.evaluate(() => ({hidden: document.querySelector('[data-sf-modal-portal] .sf-confirm')?.hidden, focus: document.activeElement?.id, answers: window.__answers}));
      expect(ctx, 'declined: folded away (hidden)', s.hidden === true, s);
      expect(ctx, 'declined: the focus back on the opener', s.focus === 'open', s);
      expect(ctx, 'declined: one decline', JSON.stringify(s.answers) === '[false]', s.answers);
      await openWindow(page);
      s = await page.evaluate(() => ({hidden: document.querySelector('[data-sf-modal-portal] .sf-confirm')?.hidden, state: document.querySelector('[data-sf-modal-portal] sf-confirm')?.getAttribute('state')}));
      expect(ctx, 'reopened after a taken decline: put again, shown', s.hidden === false && s.state === 'open', s);
      expect(ctx, 'console clean', page.errors.length === 0, page.errors);
      runs++;
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 60), count: failures.length, missing: [...page404]}, null, 1)); process.exit(1); }
console.log(`CONFIRM_WINDOW_CLOSE_OK ${runs} runs`);

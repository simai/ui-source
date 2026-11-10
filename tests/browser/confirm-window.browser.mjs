#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-confirm appearance="window" in sf-modal size="question" (decision C39,
// R064, R069): the typed confirm, from the keyboard and by the mouse, light
// and dark, 3 loads.
//
// - The window opens with the focus on «Отмена»; the label says «Чтобы
//   подтвердить, введите shop-example» with the name as code; the field is
//   named by the same words.
// - The danger answer is filled and pressable before the name is typed: a
//   press (mouse) or Enter in the empty field (keyboard) sends no answer, puts
//   the focus in the field and says «Введите «shop-example» — так же, как
//   выше» under it.
// - Pasting the name is allowed (a paste event is not refused); the typed
//   name takes the words away; then Enter in the field (keyboard) or the
//   press (mouse) sends {accepted: true} once.
// - «Отмена» closes the window with {accepted: false}; a host that cancels the
//   answer keeps it open with the question live.
// - Reopened after a decline with no outcome from the host (Escape), the
//   question is put again: the answers are live, the field is empty.
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

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    for (const theme of ['light', 'dark']) {
      for (const how of ['keyboard', 'mouse']) {
        const ctx = {load, theme, how};
        const page = await open(browser, body, theme);
        await defined(page, ['sf-modal']);
        await page.evaluate(() => {
          window.__answers = [];
          window.__refuse = false;
          document.addEventListener('sf-confirm-answer', (event) => { window.__answers.push(event.detail.accepted); if (window.__refuse) event.preventDefault(); });
        });
        await openWindow(page);
        let s = await state(page);
        expect(ctx, 'opens on «Отмена»', s.focus === 'decline', s);
        expect(ctx, 'the label', s.label === 'Чтобы подтвердить, введите shop-example', s.label);
        expect(ctx, 'the field is named by the label', s.name === 'Чтобы подтвердить, введите shop-example', s.name);
        expect(ctx, 'the danger answer is pressable before the name', s.disabled.every((value) => !value), s.disabled);
        // An early answer.
        if (how === 'keyboard') {
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Shift+Tab');
          s = await state(page);
          expect(ctx, 'Shift+Tab twice from «Отмена» reaches the field', s.focus === 'field', s.focus);
          await page.keyboard.press('Enter');
        } else {
          await page.click('[data-sf-modal-portal] .sf-confirm__actions button[data-action="accept"]');
        }
        await settle(page);
        s = await state(page);
        expect(ctx, 'an early answer: no answer sent', s.answers.length === 0, s.answers);
        expect(ctx, 'an early answer: the focus in the field', s.focus === 'field', s.focus);
        expect(ctx, 'an early answer: the explanation shown', s.invalid && s.shownError && s.error === 'Введите «shop-example» — так же, как выше', s);
        // A paste is the person's own: not refused.
        const pasteRefused = await page.evaluate(() => {
          const input = document.querySelector('[data-sf-modal-portal] .sf-confirm__field input');
          const event = new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: new DataTransfer()});
          input.dispatchEvent(event);
          return event.defaultPrevented;
        });
        expect(ctx, 'paste allowed', !pasteRefused, pasteRefused);
        if (how === 'keyboard') await page.keyboard.type('shop-example');
        else { await page.click('[data-sf-modal-portal] .sf-confirm__field input'); await page.keyboard.insertText('shop-example'); }
        await settle(page);
        s = await state(page);
        expect(ctx, 'the typed name takes the explanation away', !s.invalid && !s.shownError, s);
        if (how === 'keyboard') await page.keyboard.press('Enter');
        else await page.click('[data-sf-modal-portal] .sf-confirm__actions button[data-action="accept"]');
        await settle(page);
        s = await state(page);
        expect(ctx, 'the answer: accepted once', JSON.stringify(s.answers) === '[true]', s.answers);
        expect(ctx, 'the answer: pending until the host sets the outcome', s.state === 'pending', s.state);
        // The host closes the window; reopened, the question is put again.
        await page.evaluate(() => { const c = document.querySelector('[data-sf-modal-portal] sf-confirm'); c.setAttribute('state', 'open'); document.querySelector('sf-modal').close(); });
        await settle(page, 600);
        await openWindow(page);
        // «Отмена» with a host that refuses the answer: the window stays.
        await page.evaluate(() => { window.__answers = []; window.__refuse = true; });
        if (how === 'keyboard') await page.keyboard.press('Enter');
        else await page.click('[data-sf-modal-portal] .sf-confirm__actions button[data-action="decline"]');
        await settle(page);
        s = await state(page);
        expect(ctx, '«Отмена» refused by the host: the window and the question stay', s.open && s.state === 'open' && JSON.stringify(s.answers) === '[false]', s);
        // «Отмена» taken: the window closes.
        await page.evaluate(() => { window.__answers = []; window.__refuse = false; });
        await page.click('[data-sf-modal-portal] .sf-confirm__actions button[data-action="decline"]');
        await settle(page, 700);
        s = await state(page);
        expect(ctx, '«Отмена»: the window closes with {accepted: false}', !s.open && JSON.stringify(s.answers) === '[false]', s);
        // Reopened after the decline (pending, no outcome): put again.
        await openWindow(page);
        await page.evaluate(() => { document.querySelector('[data-sf-modal-portal] .sf-confirm__field input').value = 'shop'; });
        await page.keyboard.press('Escape');
        await settle(page, 700);
        s = await state(page);
        expect(ctx, 'Escape: the window closes, the decline pending', !s.open && s.state === 'pending', s);
        await openWindow(page);
        s = await state(page);
        expect(ctx, 'reopened: the question is put again, answers live, field empty', s.state === 'open' && s.disabled.every((value) => !value) && s.value === '' && s.focus === 'decline', s);
        if (page.errors.length) note({...ctx, what: 'console clean', errors: page.errors});
        console.log(JSON.stringify({...ctx, final: s}));
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('CONFIRM_WINDOW_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-confirm on the built bytes (block confirm, 2026-11-03):
// - a group named by its question; a dangerous acceptance (status="danger")
//   filled in the danger colour, the declining answer quiet (ghost), C25;
// - Confirm reports the answer and waits (pending: the pressed answer busy with
//   its spinner, the other disabled, focus on the status); the host's outcome
//   is then all there is;
// - a host that cancels keeps the question open, focus on the safe (declining) answer;
// - Escape inside the open question declines and goes no further;
// - an offer runs out at expires-at, said once;
// - inline has no frame, card has one; at 375 px the answers share the width;
// - the words in both languages.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'smart/smart/confirm/css/confirm.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/confirm/js/confirm.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const errors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  page.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(error.message)) errors.push(error.message); });
  await page.setContent('<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0"><button id="before">до</button><div id="box" style="width:420px;padding:16px"></div></body></html>');
  for (const style of styles) await page.addStyleTag({path: style}).catch(() => {});
  for (const module of modules) await page.addScriptTag({path: module, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(customElements.get('sf-confirm')));

  const make = async ({attributes = {}, cancel = null} = {}) => {
    await page.evaluate(async ({attributes, cancel}) => {
      const box = document.getElementById('box');
      box.replaceChildren();
      window.events = [];
      window.keysBelow = 0;
      box.addEventListener('keydown', (event) => { if (event.key === 'Escape') window.keysBelow += 1; });
      const ask = document.createElement('sf-confirm');
      ask.id = 'ask';
      for (const [name, value] of Object.entries(attributes)) ask.setAttribute(name, value);
      ask.addEventListener('sf-confirm-answer', (event) => {
        const name = event.detail.accepted ? 'accept' : 'decline';
        window.events.push({name, id: event.detail.id});
        if (cancel === name) event.preventDefault();
      });
      ask.addEventListener('sf-confirm-expired', (event) => window.events.push({name: 'expire', id: event.detail.id}));
      box.append(ask);
      await new Promise((done) => setTimeout(done, 250));
    }, {attributes, cancel});
  };
  const read = () => page.evaluate(() => {
    const ask = document.getElementById('ask');
    return {
      state: ask.querySelector('.sf-confirm').dataset.state,
      status: (ask.querySelector('.sf-confirm__status > span')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      actions: !ask.querySelector('.sf-confirm__actions').hidden,
      buttons: [...ask.querySelectorAll('.sf-confirm__actions button')].map((node) => ({
        busy: node.getAttribute('aria-busy') === 'true', disabled: node.disabled,
        spinner: Boolean(node.querySelector('.sf-button-spinner')),
      })),
      focus: document.activeElement?.className ?? null,
      events: window.events.slice(),
    };
  });

  // 1. What is read.
  await make({attributes: {question: 'Удалить файл «Отчёт.pdf»?', 'confirm-id': 'f1', 'accept-text': 'Удалить', status: 'danger'}});
  const shape = await page.evaluate(() => {
    const ask = document.getElementById('ask');
    const group = ask.querySelector('section');
    const accept = ask.querySelector('[data-action="accept"]');
    return {
      role: group.getAttribute('role'),
      named: group.getAttribute('aria-labelledby') === ask.querySelector('.sf-confirm__question').id,
      buttons: [...ask.querySelectorAll('.sf-confirm__actions button')].map((node) => node.textContent.trim()),
      error: accept.classList.contains('sf-button--error'),
      filled: accept.classList.contains('sf-button--default') && accept.classList.contains('sf-button--danger'),
      quiet: ask.querySelector('[data-action="decline"]').classList.contains('sf-button--link'),
      live: ask.querySelector('.sf-confirm__status').getAttribute('role'),
      frame: getComputedStyle(group).borderTopWidth,
    };
  });
  const expected = {role: 'group', named: true, buttons: ['Удалить', 'Отмена'], error: true, filled: true, quiet: true, live: 'status', frame: '0px'};
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(shape[key]) !== JSON.stringify(value)) note({case: `what is read: ${key}`, got: shape[key], expected: value});
  }

  // 2. Confirm: pending, focus on the status, the host's outcome.
  await page.click('#ask [data-action="accept"]');
  await page.waitForTimeout(200);
  let now = await read();
  if (now.state !== 'pending' || !now.actions || now.status !== 'Выполняется…' || !String(now.focus).includes('sf-confirm__status')
      || JSON.stringify(now.events) !== JSON.stringify([{name: 'accept', id: 'f1'}])) {
    note({case: 'Confirm reports the answer and waits, focus on what happens', got: now});
  }
  if (!(now.buttons[0]?.busy && now.buttons[0]?.spinner && now.buttons[0]?.disabled) || now.buttons[1]?.busy || !now.buttons[1]?.disabled) {
    note({case: 'while the answer is applied the pressed button is busy and the other disabled', got: now.buttons});
  }
  await page.evaluate(() => { document.getElementById('ask').state = 'accepted'; });
  await page.waitForTimeout(150);
  now = await read();
  if (now.state !== 'accepted' || now.actions || now.status !== 'Готово') note({case: 'the host\'s outcome is all there is', got: now});

  // 3. A host that cancels keeps the question open.
  await make({attributes: {question: 'Убрать участника?', 'confirm-id': 'm2'}, cancel: 'accept'});
  await page.click('#ask [data-action="accept"]');
  await page.waitForTimeout(250);
  now = await read();
  // The focus goes back to the safe (declining) answer (decision C25).
  const backOn = await page.evaluate(() => document.activeElement?.closest?.('[data-action]')?.getAttribute('data-action') ?? null);
  if (now.state !== 'open' || !now.actions || !String(now.focus).includes('sf-button') || backOn !== 'decline') note({case: 'a cancelled answer keeps the question open, focus on the safe answer', got: {...now, backOn}});

  // 4. Escape declines and goes no further; the keyboard confirms as the pointer.
  await make({attributes: {question: 'Вернуть вид?', 'confirm-id': 'v3'}});
  await page.focus('#ask [data-action="decline"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  now = await read();
  const below = await page.evaluate(() => window.keysBelow);
  if (now.state !== 'pending' || now.status !== 'Отменяется…' || JSON.stringify(now.events) !== JSON.stringify([{name: 'decline', id: 'v3'}]) || below !== 0) {
    note({case: 'Escape declines and stops there', got: {now, below}});
  }
  await make({attributes: {question: 'Вернуть вид?', 'confirm-id': 'v4'}});
  await page.focus('#before');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  now = await read();
  if (JSON.stringify(now.events) !== JSON.stringify([{name: 'accept', id: 'v4'}])) note({case: 'Tab and Enter confirm', got: now.events});

  // 5. An offer runs out.
  const soon = await page.evaluate(() => new Date(Date.now() + 1500).toISOString());
  await make({attributes: {question: 'Принять приглашение?', 'confirm-id': 'i5', 'expires-at': soon}});
  now = await read();
  if (!/^Ответить можно до \d{2}:\d{2}$/u.test(now.status) || !now.actions) note({case: 'an open offer says until when', got: now});
  await page.waitForTimeout(2000);
  now = await read();
  if (now.state !== 'expired' || now.actions || now.status !== 'Время ответа истекло'
      || JSON.stringify(now.events) !== JSON.stringify([{name: 'expire', id: 'i5'}])) note({case: 'past its time the answers go, said once', got: now});

  // 6. The card, and the narrow screen.
  await make({attributes: {question: 'Вернуть вид?', appearance: 'card'}});
  const card = await page.evaluate(() => {
    const group = document.querySelector('#ask section');
    const style = getComputedStyle(group);
    return {frame: style.borderTopWidth, padding: parseFloat(style.paddingTop) > 0, label: group.getAttribute('aria-labelledby') !== null};
  });
  if (card.frame !== '1px' || !card.padding) note({case: 'the card has a frame and an inset', got: card});
  await page.setViewportSize({width: 375, height: 700});
  await page.evaluate(() => { document.getElementById('box').style.width = '343px'; });
  await page.waitForTimeout(150);
  const narrow = await page.evaluate(() => [...document.querySelectorAll('#ask .sf-confirm__actions button')].map((node) => Math.round(node.getBoundingClientRect().width)));
  if (narrow.length !== 2 || Math.abs(narrow[0] - narrow[1]) > 1) note({case: 'at 375 px the answers share the width', got: narrow});
  await page.setViewportSize({width: 900, height: 700});

  // 7. Words.
  await page.evaluate(() => document.documentElement.setAttribute('lang', 'en'));
  await make();
  const english = await page.evaluate(() => ({
    label: document.querySelector('#ask section').getAttribute('aria-label'),
    buttons: [...document.querySelectorAll('#ask .sf-confirm__actions button')].map((node) => node.textContent.trim()),
  }));
  if (JSON.stringify(english) !== JSON.stringify({label: 'Confirmation', buttons: ['Confirm', 'Cancel']})) note({case: 'an English page speaks English', got: english});

  if (errors.length) note({case: 'no page errors', got: errors});
  console.log(JSON.stringify({checked: 7}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('CONFIRM_OK');

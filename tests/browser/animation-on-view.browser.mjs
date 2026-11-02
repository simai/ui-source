#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//   (the build output root holding core/ and utility/; PLAYWRIGHT_MODULE=/abs/
//   playwright/index.mjs picks another Playwright)
//
// Animate when scrolled into view (utility.animation 1.1.0,
// src/core/js/on-view.js), on the built core and the built sheet, with core.js
// in <head> and the utility sheet already there, as a page has it:
//   - an element in the first screen is shown and plays;
//   - an element below the fold waits: data-sf-on-view="waiting", the
//     animation paused, the element at its from-state (opacity 0), still so
//     after a second;
//   - scrolled into view it is shown and plays once to opacity 1; scrolled away
//     and back it does not play again;
//   - an element added later below the fold waits too;
//   - under prefers-reduced-motion: reduce nothing waits, and turning reduced
//     motion on shows a waiting element at once;
//   - without core the class does nothing: the element ends visible.
import {readFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ORIGIN = 'http://on-view.test/';
const DISTR = `${ORIGIN}distr/`;
const TYPES = {css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', woff2: 'font/woff2', json: 'application/json; charset=utf-8'};
const page = (withCore) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
  <script>window.sfPath=${JSON.stringify(DISTR)};window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
  <link rel="stylesheet" href="${DISTR}core/css/core.css"><link rel="stylesheet" href="${DISTR}core/css/utility.full.css">
  ${withCore ? `<script src="${DISTR}core/js/core.js"></script>` : ''}</head>
  <body style="margin:0">
  <div id="top" class="animation animation-on-view" style="block-size:200px">Первый экран</div>
  <div style="block-size:3000px"></div>
  <div id="below" class="animation animation-from-bottom animation-on-view" style="block-size:200px">Ниже сгиба</div>
  <div style="block-size:3000px"></div>
  </body></html>`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); evidence[name] = pass; };
const state = (selector) => (one) => {
  const element = document.querySelector(one);
  const style = getComputedStyle(element);
  return {mark: element.getAttribute('data-sf-on-view'), play: style.animationPlayState, name: style.animationName,
    opacity: Number(style.opacity), running: element.getAnimations().map((animation) => animation.playState)};
};

async function open(browser, {withCore = true, reducedMotion = 'no-preference'} = {}) {
  const context = await browser.newContext({viewport: {width: 1200, height: 800}, reducedMotion});
  const tab = await context.newPage();
  tab.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await tab.route(`${ORIGIN}**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/page.html') return route.fulfill({contentType: 'text/html; charset=utf-8', body: page(withCore)});
    const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
    const file = match && join(out, match[1], match[1], match[2]);
    if (!file || !existsSync(file)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({contentType: TYPES[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
  });
  await tab.goto(`${ORIGIN}page.html`);
  return {context, tab, read: (selector) => tab.evaluate(state(), selector)};
}

const browser = await chromium.launch();
try {
  {
    const {context, tab, read} = await open(browser);
    await tab.waitForFunction(() => document.querySelector('#top')?.getAttribute('data-sf-on-view') === 'shown', null, {timeout: 15000});
    await tab.waitForTimeout(1000);
    const top = await read('#top');
    check('the first screen is shown and played', top.mark === 'shown' && top.opacity === 1, top);
    const below = await read('#below');
    check('below the fold it waits', below.mark === 'waiting' && below.play === 'paused' && below.name === 'sf-animation-from-bottom', below);
    check('waiting, it keeps its from-state after a second', below.opacity === 0, below);
    await tab.evaluate(() => document.querySelector('#below').scrollIntoView({block: 'center'}));
    await tab.waitForFunction(() => document.querySelector('#below').getAttribute('data-sf-on-view') === 'shown', null, {timeout: 5000});
    const started = await read('#below');
    check('scrolled into view it starts', started.play === 'running' && started.opacity < 1, started);
    await tab.waitForTimeout(1000);
    const ended = await read('#below');
    check('it plays to its end state', ended.opacity === 1 && !ended.running.includes('running'), ended);
    await tab.evaluate(() => window.scrollTo(0, 0));
    await tab.waitForTimeout(200);
    await tab.evaluate(() => document.querySelector('#below').scrollIntoView({block: 'center'}));
    await tab.waitForTimeout(100);
    const again = await read('#below');
    check('scrolled away and back it does not play again', again.mark === 'shown' && again.opacity === 1 && !again.running.includes('running'), again);
    await tab.evaluate(() => {
      window.scrollTo(0, 0);
      const late = document.createElement('div');
      late.id = 'late';
      late.className = 'animation animation-on-view';
      late.textContent = 'Добавлен позже';
      document.body.append(late);
    });
    await tab.waitForTimeout(300);
    const late = await read('#late');
    check('an element added later below the fold waits', late.mark === 'waiting' && late.play === 'paused' && late.opacity === 0, late);
    await tab.emulateMedia({reducedMotion: 'reduce'});
    await tab.waitForTimeout(100);
    const turned = await read('#late');
    check('turning reduced motion on shows a waiting element at once', turned.mark === 'shown' && turned.play === 'running', turned);
    evidence.waitingLeft = await tab.evaluate(() => window.__sfOnView?.waiting);
    await context.close();
  }
  {
    const {context, tab, read} = await open(browser, {reducedMotion: 'reduce'});
    await tab.waitForFunction(() => window.SF?.RuleLoader && window.__sfOnView, null, {timeout: 15000});
    await tab.waitForTimeout(1000);
    const below = await read('#below');
    check('under reduced motion nothing waits', below.mark === null && below.play === 'running' && below.opacity === 1, below);
    await context.close();
  }
  {
    const {context, tab, read} = await open(browser, {withCore: false});
    await tab.waitForTimeout(1000);
    const below = await read('#below');
    check('without core the element ends visible', below.mark === null && below.opacity === 1, below);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures, count: failures.length}, null, 1)); process.exit(1); }
console.log('ANIMATION_ON_VIEW_OK');

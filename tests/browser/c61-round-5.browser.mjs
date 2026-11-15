#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> writes c61-round-5.json (every measure of
//        every load) and a picture per theme x width x density.
//        SF_RELOADS=<n> loads each page n times (3 by default).
//        SF_PORT=<port> serves on that port (any free one by default).
//
// C61 round 5 (DEV answer msg-bf5253ac, 2026-11-14), drawn by the real
// Framework over the Loader from the built bytes, at 1440 and 390, light and
// dark, normal and compact density (C22), Russian and English pages:
//
//   (1) icon to text is a role (C105 H2), not a screen step: the ink of a step
//       marker -- the current step's ring included -- stands 8 before its
//       text at every width and density, in sf-list-timeline (icon and dot
//       steps) and in sf-steps (row and column, number and dot). Read off the
//       pixels: the last ink left of the text on the marker's centre line.
//       A list of events keeps H2 by the screen step (12 / 8 / 8), and the
//       «Показать ещё» button of a steps list stands on the text's axis;
//   (2) a step of sf-list-timeline says its status in step words after its
//       state («Пройдено, с предупреждением», «Done, with a warning»), never
//       the event word «Готово» / «Done»;
//   (3) one upcoming word: «Впереди» / «Upcoming» in sf-list-timeline and
//       sf-steps;
//   no console error, no failed request, no horizontal scroll on any load.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const page = ({lang, theme, density}) => `<!doctype html><html lang="${lang}" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C61 round 5</title>
<script>window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}
.grid{display:flex;flex-wrap:wrap;gap:24px}.grid>div{inline-size:min(320px,100%)}</style></head><body><main class="grid">
<div><sf-list-timeline id="tl-icon" group="none" has-more></sf-list-timeline></div>
<div><sf-list-timeline id="tl-dot" group="none"></sf-list-timeline></div>
<div><sf-list-timeline id="tl-events" group="none"></sf-list-timeline></div>
<div><sf-steps id="st-column" layout="column" current="1"></sf-steps></div>
<div><sf-steps id="st-dot" layout="column" marker="dot" current="1"></sf-steps></div>
<div><sf-steps id="st-row" layout="row" current="1"></sf-steps></div>
</main></body></html>`;

const STEPS = [
  {id: 'd', title: 'Оформлен', state: 'done'},
  {id: 'c', title: 'Собран', state: 'current'},
  {id: 'u', title: 'В пути', state: 'upcoming'},
  {id: 'dw', title: 'Пересобран', state: 'done', status: 'warning'},
  {id: 'ce', title: 'Оплата', state: 'current', status: 'error'},
  {id: 'us', title: 'Проверка', state: 'upcoming', status: 'success'},
  {id: 'ue', title: 'Доставка', state: 'upcoming', status: 'error'},
];
const EVENTS = [
  {id: 'e1', title: 'Заказ создан', icon: 'inventory_2'},
  {id: 'e2', title: 'Оплата не прошла', icon: 'error', status: 'error'},
];
const STEPS_ITEMS = JSON.stringify([{label: 'Корзина'}, {label: 'Доставка'}, {label: 'Оплата'}]);
// The hidden words each page must say (state, then the step's status).
const WORDS = {
  ru: {d: 'Пройдено', c: 'Сейчас', u: 'Впереди', dw: 'Пройдено, с предупреждением', ce: 'Сейчас, с ошибкой', us: 'Впереди, успешно', ue: 'Впереди, с ошибкой', ahead: 'Впереди'},
  en: {d: 'Done', c: 'Now', u: 'Upcoming', dw: 'Done, with a warning', ce: 'Now, with an error', us: 'Upcoming, successful', ue: 'Upcoming, with an error', ahead: 'Upcoming'},
};

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  if (url.pathname === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page({lang: url.searchParams.get('lang'), theme: url.searchParams.get('theme'), density: url.searchParams.get('density')}));
  }
  const match = decodeURIComponent(url.pathname).match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(Number(process.env.SF_PORT || 0), '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// Every marker: its box, the text's start, the hidden word.
const MEASURE = () => {
  const list = [];
  const word = (element) => (element?.textContent || '').replace(/^[,\s]+|[:\s]+$/gu, '').trim();
  for (const id of ['tl-icon', 'tl-dot', 'tl-events']) {
    for (const item of document.querySelectorAll(`#${id} .sf-list-timeline-item`)) {
      const marker = item.querySelector('.sf-list-timeline-dot, .sf-featured-icon');
      const text = item.querySelector('.sf-list-timeline-body');
      list.push({list: id, id: item.dataset.id, state: item.dataset.state || '', box: marker.getBoundingClientRect().toJSON(), text: text.getBoundingClientRect().left, word: word(item.querySelector('.sr-only'))});
    }
  }
  for (const id of ['st-column', 'st-dot', 'st-row']) {
    document.querySelectorAll(`#${id} .sf-step`).forEach((item, index) => {
      const marker = item.querySelector('.sf-step-marker');
      const text = item.querySelector('.sf-step-container');
      const state = (item.className.match(/sf-step--state-(\w+)/u) || [])[1] || '';
      list.push({list: id, id: String(index), state, box: marker.getBoundingClientRect().toJSON(), text: text.getBoundingClientRect().left, word: word(item.querySelector('.sr-only'))});
    });
  }
  const button = document.querySelector('#tl-icon .sf-list-timeline-more button');
  const body = document.querySelector('#tl-icon .sf-list-timeline-body');
  return {list, more: button && body ? Math.round((button.getBoundingClientRect().left - body.getBoundingClientRect().left) * 100) / 100 : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
};

// The last ink left of the text on the marker's centre line (device pixels / DPR).
const INK = async ([b64, list, dpr]) => {
  const image = new Image();
  image.src = `data:image/png;base64,${b64}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixel = (x, y) => { const i = (Math.round(y) * canvas.width + Math.round(x)) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const ground = pixel(4 * dpr, 4 * dpr);
  return list.map((one) => {
    const y = (one.box.y + one.box.height / 2) * dpr;
    for (let x = Math.floor(one.text * dpr) - 1; x > (one.box.x - 8) * dpr; x -= 1) {
      if (near(pixel(x, y), ground) >= 24) return Math.round((one.text - (x + 1) / dpr) * 100) / 100;
    }
    return null;
  });
};

const failures = [];
const runs = [];
const browser = await chromium.launch();
try {
  for (const lang of ['ru', 'en']) for (const theme of ['light', 'dark']) for (const density of ['normal', 'compact']) for (const width of [1440, 390]) for (let load = 1; load <= reloads; load += 1) {
    if (lang === 'en' && (theme === 'dark' || density === 'compact')) continue;
    const label = `${lang} ${theme} ${density} ${width} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, deviceScaleFactor: 4, colorScheme: theme, ...(width === 390 ? {isMobile: true, hasTouch: true} : {})});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    tab.on('response', (answer) => answer.status() >= 400 && errors.push(`${answer.status()} ${answer.url()}`));
    await tab.goto(`${origin}/?lang=${lang}&theme=${theme}&density=${density}`);
    await tab.waitForFunction(() => customElements.get('sf-list-timeline') && customElements.get('sf-steps'), null, {timeout: 60000});
    await tab.evaluate(([steps, events, items]) => {
      document.getElementById('tl-icon').items = steps.map((one) => ({...one, icon: 'inventory_2'}));
      document.getElementById('tl-dot').items = steps;
      document.getElementById('tl-events').items = events;
      for (const id of ['st-column', 'st-dot', 'st-row']) document.getElementById(id).setAttribute('items', items);
    }, [STEPS, EVENTS, STEPS_ITEMS]);
    await tab.waitForFunction(() => document.querySelectorAll('.sf-list-timeline-item').length >= 16 && document.querySelectorAll('.sf-step').length >= 9, null, {timeout: 30000});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(500);
    const got = await tab.evaluate(MEASURE);
    const b64 = (await tab.screenshot({fullPage: true})).toString('base64');
    const ink = await tab.evaluate(INK, [b64, got.list, 4]);
    got.list.forEach((one, index) => { one.ink = ink[index]; });
    runs.push({lang, theme, density, width, load, errors, ...got});
    if (evidence && load === 1) await tab.screenshot({path: join(evidence, `c61-round-5-${lang}-${theme}-${density}-${width}.png`), fullPage: true, scale: 'css'});
    await context.close();

    if (errors.length) failures.push(`${label}: console/network ${errors.join(' | ')}`);
    if (got.overflow > 0) failures.push(`${label}: horizontal scroll ${got.overflow}`);
    // (1) a step's ink 8 or more before its text, at every width and density; the
    // ringed circles (icon steps, numbers) exactly 8 -- a dot is small on its rail.
    for (const one of got.list.filter((x) => x.list !== 'tl-events')) {
      if (one.ink === null || one.ink < 7.5) failures.push(`${label}: ${one.list} ${one.id} ${one.state} ink ${one.ink} before its text (want >= 8)`);
    }
    for (const one of got.list.filter((x) => x.state === 'current' && ['tl-icon', 'st-column', 'st-row'].includes(x.list))) {
      if (Math.abs(one.ink - 8) > 0.75) failures.push(`${label}: ${one.list} ${one.id} current ring ${one.ink} before its text (want 8)`);
    }
    if (got.more !== 0) failures.push(`${label}: «Показать ещё» ${got.more} off the text's axis`);
    // A list of events keeps H2 by the screen step: 12 on a desktop, 8 on a phone and in compact density.
    const h2 = width === 1440 && density === 'normal' ? 12 : 8;
    for (const one of got.list.filter((x) => x.list === 'tl-events')) {
      if (Math.abs(one.ink - h2) > 0.75) failures.push(`${label}: event ${one.id} icon ${one.ink} before its text (want ${h2})`);
    }
    // (2) and (3): the words.
    for (const one of got.list.filter((x) => x.list === 'tl-icon' || x.list === 'tl-dot')) {
      if (one.word !== WORDS[lang][one.id]) failures.push(`${label}: ${one.list} ${one.id} says «${one.word}», want «${WORDS[lang][one.id]}»`);
    }
    for (const one of got.list.filter((x) => x.list.startsWith('st-') && x.state === 'ahead')) {
      if (one.word !== WORDS[lang].ahead) failures.push(`${label}: ${one.list} ${one.id} ahead says «${one.word}», want «${WORDS[lang].ahead}»`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (evidence) writeFileSync(join(evidence, 'c61-round-5.json'), `${JSON.stringify(runs, null, 1)}\n`);
if (failures.length) {
  console.error(`C61_ROUND_5_FAIL ${failures.length}\n${[...new Set(failures)].slice(0, 80).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`C61_ROUND_5_OK ${runs.length} loads`);
}

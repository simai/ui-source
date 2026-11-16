#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A ring around an avatar and the tariff's remainder, owner decision C191
// (4)-(8) (control/research/2026-11-14-recipe-parts.md #q-ar-*), on the built
// bytes:
//
// (4) #q-ar-where -- the remainder is a meter row in the person menu
//     (sf-menu-context {type: 'meter'}): the name and the words on one line
//     over an sf-progress-bar meter; the row is read, not chosen (no focus,
//     the arrows skip it).
// (5) #q-ar-direction -- the bar shows the share used (aria-valuenow 83, fill
//     83 % of the track) so the threshold fires (warning at 80); the words say
//     the remainder (aria-valuetext and the visible line).
// (6) #q-ar-number -- the ring with an avatar has no number of its own; the
//     page's words beside it are the number (checked: no text in the middle).
// (7) #q-ar-done -- at 100 % the ring around the avatar goes away (no line, no
//     role), the avatar stays in the same box; a meter keeps its ring at 100.
// (8) #q-ar-upload -- a photo upload is an indeterminate ring round the
//     avatar, then a value, and the ring goes away at 100.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const html = `<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head>
<body style="margin:0;padding:16px">
<button id="me" type="button">Анна Белова</button>
<sf-menu-context id="menu" popup aria-label="Анна Белова"></sf-menu-context>
<div style="display:flex;gap:16px;align-items:center;margin-top:320px">
  <sf-progress-ring id="complete" size="3" value="70" label="Профиль заполнен на 70 %"><sf-avatar slot="content" size="2" heading="Анна Петрова"></sf-avatar></sf-progress-ring>
  <sf-progress-ring id="upload" size="3" indeterminate label="Загрузка фото"><sf-avatar slot="content" size="2" heading="Анна Петрова"></sf-avatar></sf-progress-ring>
  <sf-progress-ring id="quota" size="3" value="100" meter label="Использовано"><sf-avatar slot="content" size="2" heading="Анна Петрова"></sf-avatar></sf-progress-ring>
  <sf-progress-ring id="plain" size="3" value="100" show-text label="Готово"></sf-progress-ring>
</div>
<script>
  customElements.whenDefined('sf-menu-context').then(() => {
    const menu = document.getElementById('menu');
    menu.entries = [
      {type: 'header', text: 'Анна Белова', caption: ['anna@example.com', 'Тариф «Команда»']},
      {type: 'meter', text: 'Место', value: 83, valueText: 'Осталось 1,7 из 10 ГБ', warningAt: 80, errorAt: 95},
      {type: 'separator'},
      {id: 'profile', text: 'Профиль', icon: 'person'},
      {id: 'sign-out', text: 'Выйти', icon: 'logout'},
    ];
    document.getElementById('me').addEventListener('click', (event) => menu.openFor(event.currentTarget));
  });
</script>
</body></html>`;
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(html);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, what, detail) => { if (!ok) failures.push({what, detail}); };
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1440, height: 900}});
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-menu-context') && customElements.get('sf-progress-ring'), null, {timeout: 15000});

  // (4)-(6): the meter row in the person menu.
  await tab.click('#me');
  await tab.waitForSelector('.sf-context-menu-meter sf-progress-bar [role="meter"]', {timeout: 15000}).catch(() => {});
  await tab.waitForTimeout(300);
  const meter = await tab.evaluate(() => {
    const row = document.querySelector('.sf-context-menu-meter');
    if (!row) return null;
    const head = row.querySelector('.sf-context-menu-meter-head');
    const bar = row.querySelector('[role="meter"]');
    const track = row.querySelector('.sf-progress-bar-main');
    const fill = row.querySelector('.sf-progress-bar-progress');
    const name = row.querySelector('.sf-context-menu-meter-name').getBoundingClientRect();
    const icon = document.querySelector('.sf-context-menu-item .sf-context-menu-item-icon, .sf-context-menu-item .sf-icon')?.getBoundingClientRect();
    return {
      role: row.getAttribute('role'),
      headHidden: head?.getAttribute('aria-hidden'),
      name: row.querySelector('.sf-context-menu-meter-name')?.textContent,
      words: row.querySelector('.sf-context-menu-meter-value')?.textContent,
      label: bar?.getAttribute('aria-label'),
      now: bar?.getAttribute('aria-valuenow'),
      text: bar?.getAttribute('aria-valuetext'),
      status: row.querySelector('sf-progress-bar')?.getAttribute('data-status'),
      share: track && fill ? Math.round(fill.getBoundingClientRect().width / track.getBoundingClientRect().width * 100) : null,
      thickness: track ? Math.round(track.getBoundingClientRect().height) : null,
      gap: track ? Math.round(track.getBoundingClientRect().top - head.getBoundingClientRect().bottom) : null,
      nameStart: Math.round(name.left),
      iconStart: icon ? Math.round(icon.left) : null,
      focusable: row.querySelectorAll('[tabindex], button, a, input').length,
    };
  });
  check(meter, 'the meter row is drawn', meter);
  if (meter) {
    check(meter.role === 'none', 'the row is a block (role none)', meter.role);
    check(meter.headHidden === 'true', 'the line over the bar is aria-hidden', meter.headHidden);
    check(meter.name === 'Место' && meter.words === 'Осталось 1,7 из 10 ГБ', '(5) the words say the remainder', meter);
    check(meter.label === 'Место' && meter.now === '83' && meter.text === 'Осталось 1,7 из 10 ГБ', '(5) the meter says the share used and the remainder', meter);
    check(meter.status === 'warning', '(5) the threshold fires at 83 of warning-at 80', meter.status);
    check(Math.abs(meter.share - 83) <= 1, '(5) the fill is the share used', meter.share);
    check(meter.thickness === 8, 'the bar is 8 (size 1, C131 (3))', meter.thickness);
    check(meter.gap === 4, '4 between the line and the bar', meter.gap);
    check(meter.iconStart === null || meter.nameStart === meter.iconStart, 'the name starts on the rows\' start', meter);
    check(meter.focusable === 0, 'nothing in the row takes the focus', meter.focusable);
  }
  // The arrows walk the rows only.
  const walked = [];
  for (let step = 0; step < 4; step += 1) {
    await tab.keyboard.press('ArrowDown');
    walked.push(await tab.evaluate(() => document.activeElement?.textContent?.trim() ?? ''));
  }
  check(walked.every((text) => /Профиль|Выйти/u.test(text)), '(4) the arrows skip the meter row', walked);
  await tab.keyboard.press('Escape');

  // (6)-(8): the ring around an avatar.
  const ring = (id) => tab.evaluate((id) => {
    const host = document.getElementById(id);
    const root = host.querySelector('.sf-progress-ring');
    const indicator = root.querySelector('.sf-progress-ring-indicator');
    const avatar = root.querySelector('.sf-progress-ring-content').getBoundingClientRect();
    const box = root.getBoundingClientRect();
    return {
      line: Boolean(indicator),
      role: indicator?.getAttribute('role') ?? null,
      now: indicator?.getAttribute('aria-valuenow') ?? null,
      spinning: root.classList.contains('sf-progress-ring--indeterminate'),
      box: [Math.round(box.width), Math.round(box.height)],
      avatar: [Math.round(avatar.left - box.left), Math.round(avatar.width)],
      middleText: root.querySelector('.sf-progress-ring-content[aria-hidden]')?.textContent ?? '',
    };
  }, id);

  const complete = await ring('complete');
  check(complete.line && complete.role === 'progressbar' && complete.now === '70', '(6) completeness 70 draws the ring and says 70', complete);
  check(complete.middleText === '', '(6) no number in the middle: the page writes it beside', complete);
  await tab.evaluate(() => { document.getElementById('complete').value = 100; });
  await tab.waitForTimeout(200);
  const done = await ring('complete');
  check(!done.line && done.role === null, '(7) at 100 the ring goes away', done);
  check(String(done.box) === String(complete.box) && String(done.avatar) === String(complete.avatar), '(7) the avatar stays in the same box', {complete, done});

  const upload = await ring('upload');
  check(upload.line && upload.spinning && upload.now === null, '(8) an upload of unknown size spins round the avatar', upload);
  await tab.evaluate(() => { const ring = document.getElementById('upload'); ring.indeterminate = false; ring.value = 40; });
  await tab.waitForTimeout(200);
  const going = await ring('upload');
  check(going.line && !going.spinning && going.now === '40', '(8) then the known share', going);
  await tab.evaluate(() => document.getElementById('upload').chunk({done: 120, total: 120}));
  await tab.waitForTimeout(200);
  const sent = await ring('upload');
  check(!sent.line, '(8) at 100 the ring goes away', sent);

  const quota = await ring('quota');
  check(quota.line && quota.role === 'meter' && quota.now === '100', '(7) a meter keeps its ring at 100', quota);
  const plain = await ring('plain');
  check(plain.line && plain.now === '100', '(7) a ring without a picture keeps its line at 100', plain);

  check(errors.length === 0, 'console errors 0', errors);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('AVATAR_RING_C191_OK');

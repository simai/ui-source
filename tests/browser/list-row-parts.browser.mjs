#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-list 1.1.0 (owner decision q-3b313e2246, 2026-11-06): a row's avatar, its
// count and badge, and pinned rows, on the built bytes through the real Loader
// (so the rule brings sf-avatar, sf-badge and their sheets), at 1280 and 390,
// at each size of the ladder (1/2, 1, 2):
// - no item with an avatar: no leading place at all, and the row is as tall as
//   a 1.0 row;
// - an avatar in a one-line list: the avatar is the row's line square (as the
//   row's icon is), the row keeps its control height;
// - an avatar in a list with a second line: the avatar is the control height
//   of the row's step, the row is as tall as a two-line row without one, and
//   a one-line row of the same list keeps its control height;
// - every row of a list with an avatar keeps the leading place, so the titles
//   start at one x (an image, initials, a sign, an icon alone, nothing);
// - the avatar, the count and the badge stand centred on the row; the count
//   and the badge end before the «⋯» and inside the row; «99+» above 99, the
//   count named in plural forms; the badge carries the tone as status;
// - pinned items lead under «Закреплённые» («Pinned») before the day groups
//   (whose «Сегодня» carries its quiet date, owner decision C40);
//   ungrouped, first and with no heading;
// - a narrow list (sf-list 1.5.0, owner decision C47: the list's own width
//   below 20rem, or a title that would keep less than half of its text column
//   or less than 10rem): a row with a badge or a count puts them under its
//   text, at the text's start; the row is the control height, the band step
//   and the badge's height; the picture stands on the title's band;
// - a count that comes and goes keeps the row's node and the focus on it;
// - no sideways scroll, no page error.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(shell(new URL(request.url, 'http://x').searchParams.get('lang') || 'ru'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  // utf-8 on every routed file: the Loader may bring a part as a classic script.
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// The page prints one list of each kind the probe measures; their items are
// given from the probe, so every list is drawn from data, as a host draws it.
const shell = (lang) => `<!doctype html><html lang="${lang}" class="theme-light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface)}.box{inline-size:min(420px,100%);box-sizing:border-box;padding:8px}</style></head>
<body>
<div class="box"><sf-list id="plain" label="Без аватаров"></sf-list></div>
<div class="box"><sf-list id="one" label="Одна строка"></sf-list></div>
<div class="box"><sf-list id="two" label="Две строки" group-by="day"></sf-list></div>
<div class="box"><sf-list id="flat" label="Без групп"></sf-list></div>
<div class="box"><sf-list id="long" label="Длинное"></sf-list></div>
</body></html>`;

const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#3a7"/></svg>')}`;
const now = Date.now();
const day = 24 * 3600 * 1000;
const data = {
  plain: [
    {id: 'a', text: 'Письмо директору', count: 4},
    {id: 'b', text: 'Отчёт', icon: 'description', badge: {text: 'Новое', tone: 'info'}},
  ],
  one: [
    {id: 'a', text: 'Анна Белова', avatar: {text: 'АБ'}, count: 3},
    {id: 'b', text: 'Картинка', avatar: {'image-url': image}},
    {id: 'c', text: 'Канал', avatar: {icon: 'campaign', shape: 'square'}, badge: {text: 'Ждёт', tone: 'warning'}, count: 120},
    {id: 'd', text: 'Только иконка', icon: 'mail'},
    {id: 'e', text: 'Без всего'},
  ],
  // A title longer than its row, beside a count: it wraps inside the row, the
  // count stays at the end.
  long: [
    {id: 'l', text: 'Очень длинное название беседы, которому не хватит места в одной строке списка', avatar: {text: 'ДИ'}, count: 12},
  ],
  two: [
    {id: 'p', text: 'Закреплённая беседа', supporting: 'Пётр: отчёт', avatar: {icon: 'push_pin', shape: 'square'}, pinned: true, date: new Date(now - 9 * day).toISOString()},
    {id: 'a', text: 'Анна Белова', supporting: 'Пришлю договор после обеда', avatar: {text: 'АБ'}, count: 1, date: new Date(now).toISOString()},
    {id: 'b', text: 'Ассистент', supporting: 'Нужен ответ', avatar: {icon: 'smart_toy'}, badge: {text: 'Ждёт', tone: 'warning'}, date: new Date(now).toISOString()},
    {id: 'c', text: 'Одна строка', avatar: {text: 'ОС'}, count: 5, date: new Date(now - day).toISOString()},
    {id: 'd', text: 'Без аватара', supporting: 'Вторая строка', date: new Date(now - day).toISOString()},
  ],
  flat: [
    {id: 'x', text: 'Обычная'},
    {id: 'p', text: 'Закреплённая', pinned: true},
    {id: 'y', text: 'Ещё одна'},
  ],
};

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail: pass ? '' : detail});
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
try {
  for (const width of [1280, 390]) {
    for (const size of ['1/2', '1', '2']) {
      const label = `${width} size ${size}`;
      const context = await browser.newContext({viewport: {width, height: 1400}, locale: 'ru-RU', reducedMotion: 'reduce'});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.goto(`${base}/page?lang=ru`);
      await tab.waitForFunction(() => Boolean(customElements.get('sf-list') && customElements.get('sf-list-item')), null, {timeout: 20000});
      await tab.evaluate(({data, size}) => {
        for (const [id, items] of Object.entries(data)) {
          const list = document.getElementById(id);
          list.setAttribute('size', size);
          list.setItems(items);
        }
      }, {data, size});
      await tab.waitForFunction(() => customElements.get('sf-badge')
        && document.querySelectorAll('.sf-list__count .sf-badge, .sf-list__count.sf-badge, sf-badge.sf-list__count > .sf-badge').length >= 4
        && document.querySelectorAll('#one .sf-list__lead .sf-avatar').length >= 2, null, {timeout: 20000});
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(250);

      const got = await tab.evaluate(({size}) => {
        const esc = size.replace('/', '\\/');
        const probe = document.createElement('div');
        document.body.append(probe);
        const length = (name) => { probe.style.width = `var(${name})`; return parseFloat(getComputedStyle(probe).width); };
        const tokens = {
          control: length(`--sf-ui-${esc}--control-height`),
          line: length(`--sf-text-height-${esc}`),
          spaceX: length(`--sf-ui-${esc}--space-x`),
          band: length('--sf-space-1\\/4'),
        };
        probe.remove();
        const box = (node) => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, cy: r.y + r.height / 2}; };
        // The drawn box of a part: the host of a Smart part is display: contents.
        const drawn = (node) => (node && getComputedStyle(node).display === 'contents' ? node.firstElementChild : node);
        const rows = (id) => [...document.querySelectorAll(`#${id} .sf-list__row`)].map((row) => {
          const item = row.querySelector('.sf-list-item');
          const title = row.querySelector('.sf-list-item-title') || row.querySelector('.sf-list-item-container');
          const lead = row.querySelector('.sf-list__lead');
          const avatar = row.querySelector('.sf-list__lead .sf-avatar:not(.sf-list__sign)') || row.querySelector('.sf-list__sign');
          const count = drawn(row.querySelector('sf-badge.sf-list__count'));
          const badge = drawn(row.querySelector('sf-badge.sf-list__badge'));
          const dots = row.querySelector('.sf-list__actions');
          const meta = row.querySelector('.sf-list__meta');
          return {
            id: row.dataset.id,
            row: box(row),
            item: box(item),
            // Where the title's text starts: a one-line row's text is the
            // container's own, after its inline padding.
            title: (() => { const b = box(title); const pad = title.classList.contains('sf-list-item-container') ? parseFloat(getComputedStyle(title).paddingInlineStart) : 0; return {...b, x: b.x + pad}; })(),
            lead: lead ? box(lead) : null,
            avatar: avatar ? box(avatar) : null,
            count: count ? {...box(count), text: count.querySelector('.sf-badge-text')?.textContent.trim(), label: row.querySelector('sf-badge.sf-list__count').getAttribute('aria-label')} : null,
            badge: badge ? {...box(badge), status: row.querySelector('sf-badge.sf-list__badge').getAttribute('status')} : null,
            dots: dots ? box(dots) : null,
            twoLine: item.classList.contains('sf-list-item--two-line'),
            meta: meta && meta.children.length ? box(meta) : null,
            // C47 (sf-list 1.5.0): a narrow list puts a row's badge and count
            // under its text, at the text's start.
            narrow: row.closest('.sf-list__frame').hasAttribute('data-sf-list-narrow'),
          };
        });
        return {
          tokens,
          plain: rows('plain'),
          one: rows('one'),
          two: rows('two'),
          flat: rows('flat'),
          long: rows('long'),
          groups: [...document.querySelectorAll('#two .sf-list__group')].map((group) => ({key: group.dataset.group, heading: [...group.querySelector('.sf-list__heading').childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('').trim(),
            date: group.querySelector('.sf-list__heading sf-time.sf-group-heading-date')?.textContent.trim() ?? '', ids: [...group.querySelectorAll('.sf-list__row')].map((row) => row.dataset.id)})),
          flatHeadings: document.querySelectorAll('#flat .sf-list__heading').length,
          leadsPlain: document.querySelectorAll('#plain .sf-list__lead').length,
          scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          wide: document.querySelector('#two .sf-list__frame').classList.contains('sf-list--lead-wide'),
        };
      }, {size});

      const {tokens} = got;
      // No avatar: no leading place; the 1.0 row; the count and badge still drawn.
      ok(`${label}: no avatar, no leading place`, got.leadsPlain === 0, got.leadsPlain);
      ok(`${label}: a one-line row without an avatar is the control height`, near(got.plain[0].row.h, tokens.control), {row: got.plain[0].row.h, tokens});
      ok(`${label}: a count without an avatar column, centred on the row`, got.plain[0].count && near(got.plain[0].count.cy, got.plain[0].row.cy), got.plain[0]);
      ok(`${label}: a badge beside an icon, centred, tone as status`, got.plain[1].badge && near(got.plain[1].badge.cy, got.plain[1].row.cy) && got.plain[1].badge.status === 'info', got.plain[1]);

      // One-line list with avatars.
      // C47: in a narrow list a row with a badge or a count is «picture | text»
      // with the badge and count under the text, at the text's start; the row
      // grows by whole bands: the control height, the band step, the badge.
      const under = (row) => row.narrow && row.meta;
      for (const row of got.one.filter(under)) {
        ok(`${label}: narrow row ${row.id}: control height + band + the badge's height`, near(row.row.h, tokens.control + tokens.band + row.meta.h), {row: row.row.h, meta: row.meta.h, tokens});
        ok(`${label}: narrow row ${row.id}: the badge and count under the title, at its start`, row.meta.y >= row.title.y + row.title.h - 0.5 && near(row.meta.x, row.title.x, 1) && row.meta.right <= row.item.right + 0.5, {meta: row.meta, title: row.title, item: row.item});
        if (row.avatar) ok(`${label}: narrow avatar ${row.id} centred on the title's band`, near(row.avatar.cy, row.row.y + tokens.control / 2), {avatar: row.avatar.cy, band: row.row.y + tokens.control / 2});
      }
      for (const row of got.one) {
        if (under(row)) continue;
        ok(`${label}: one-line row ${row.id} keeps the control height`, near(row.row.h, tokens.control), {row: row.row.h, tokens});
        ok(`${label}: one-line row ${row.id} has the leading place, the line wide`, row.lead && near(row.lead.w, tokens.line), {lead: row.lead, tokens});
        if (row.avatar) {
          ok(`${label}: one-line avatar ${row.id} is the line square`, near(row.avatar.w, tokens.line) && near(row.avatar.h, tokens.line), {avatar: row.avatar, tokens});
          ok(`${label}: one-line avatar ${row.id} centred on the row`, near(row.avatar.cy, row.row.cy), {avatar: row.avatar.cy, row: row.row.cy});
          ok(`${label}: one-line avatar ${row.id} starts at the row's inline inset`, near(row.avatar.x - row.row.x, tokens.spaceX), {x: row.avatar.x - row.row.x, tokens});
        }
      }
      const titleX = got.one.map((row) => row.title.x);
      ok(`${label}: one-line titles start at one x`, Math.max(...titleX) - Math.min(...titleX) <= 0.5, titleX);
      const [anna, , channel] = got.one;
      const [long] = got.long;
      ok(`${label}: the count reads 3, named in plural forms`, anna.count?.text === '3' && anna.count?.label === '3 непрочитанных', anna.count);
      ok(`${label}: above 99 the count reads 99+`, channel.count?.text === '99+' && channel.count?.label === '120 непрочитанных', channel.count);
      for (const row of [...got.plain, ...got.one]) {
        const last = row.count ?? row.badge;
        if (last && !under(row)) ok(`${label}: the row's parts end at the row's end (${row.id})`, near(last.right, row.item.right - tokens.spaceX), {last, item: row.item, tokens});
      }
      const line = under(channel) ? channel.meta.y + channel.meta.h / 2 : channel.row.cy;
      ok(`${label}: the badge before the count, both centred${under(channel) ? ' on the line under the title' : ''}, inside the row`, channel.badge && channel.count && channel.badge.right <= channel.count.x + 0.5
        && near(channel.badge.cy, line) && near(channel.count.cy, line) && channel.count.right <= channel.row.right + 0.5, {badge: channel.badge, count: channel.count, row: channel.row, line});
      ok(`${label}: a long title wraps inside the row, the count at its end, centred`, long.title.right <= long.count.x + 0.5 && long.count.right <= long.row.right + 0.5
        && near(long.count.cy, long.row.cy) && near(long.avatar.cy, long.row.cy) && long.row.right <= got.one[0].row.right + 0.5, long);

      // Two-line list.
      ok(`${label}: a list with a second line widens the leading place`, got.wide, got.wide);
      const twoLineBare = got.two.find((row) => row.id === 'd');
      for (const row of got.two) {
        ok(`${label}: row ${row.id} has the leading place, the control height wide`, row.lead && near(row.lead.w, tokens.control), {lead: row.lead, tokens});
        if (row.twoLine) ok(`${label}: two-line row ${row.id} as tall as a two-line row without an avatar`, near(row.row.h, twoLineBare.row.h), {row: row.row.h, bare: twoLineBare.row.h});
        else ok(`${label}: one-line row ${row.id} in a two-line list keeps the control height`, near(row.row.h, tokens.control), {row: row.row.h, tokens});
        if (row.avatar) {
          const side = row.twoLine ? tokens.control : tokens.line;
          ok(`${label}: avatar ${row.id} is ${row.twoLine ? 'the control height' : 'the line'} square`, near(row.avatar.w, side) && near(row.avatar.h, side), {avatar: row.avatar, side});
          ok(`${label}: avatar ${row.id} centred on the row`, near(row.avatar.cy, row.row.cy), {avatar: row.avatar.cy, row: row.row.cy});
          ok(`${label}: avatar ${row.id} centred in the leading place`, near(row.avatar.x + row.avatar.w / 2, row.lead.x + row.lead.w / 2), {avatar: row.avatar, lead: row.lead});
        }
        if (row.count) ok(`${label}: two-line count ${row.id} centred on the row`, near(row.count.cy, row.row.cy), {count: row.count.cy, row: row.row.cy});
        if (row.badge) ok(`${label}: two-line badge ${row.id} centred on the row`, near(row.badge.cy, row.row.cy), {badge: row.badge.cy, row: row.row.cy});
      }
      const titleTwo = got.two.map((row) => row.title.x);
      ok(`${label}: two-line list titles start at one x`, Math.max(...titleTwo) - Math.min(...titleTwo) <= 0.5, titleTwo);

      // Pinned.
      ok(`${label}: pinned leads under «Закреплённые» before the days`, got.groups[0]?.key === 'pinned' && got.groups[0]?.heading === 'Закреплённые'
        && JSON.stringify(got.groups[0].ids) === '["p"]' && got.groups[1]?.heading === 'Сегодня' && Boolean(got.groups[1]?.date) && got.groups.length === 3, got.groups);
      ok(`${label}: ungrouped, pinned leads with no heading`, got.flat[0]?.id === 'p' && got.flatHeadings === 0 && got.flat.map((row) => row.id).join() === 'p,x,y', {flat: got.flat.map((row) => row.id), headings: got.flatHeadings});

      ok(`${label}: no sideways scroll`, got.scroll <= 0, got.scroll);

      // A count that comes and goes keeps the row and the focus.
      const kept = await tab.evaluate(async () => {
        const list = document.getElementById('one');
        const before = list.querySelector('.sf-list__row[data-id="a"] .sf-list-item');
        before.focus();
        const frames = () => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle)));
        list.upsert({id: 'a', text: 'Анна Белова', avatar: {text: 'АБ'}, count: 0});
        await frames();
        const gone = !list.querySelector('.sf-list__row[data-id="a"] .sf-list__count');
        list.upsert({id: 'a', text: 'Анна Белова', avatar: {text: 'АБ'}, count: 7, badge: {text: 'Важно', tone: 'error'}});
        await frames();
        await new Promise((settle) => setTimeout(settle, 150));
        const after = list.querySelector('.sf-list__row[data-id="a"] .sf-list-item');
        return {gone, same: before === after, focus: document.activeElement === after,
          count: list.querySelector('.sf-list__row[data-id="a"] sf-badge.sf-list__count .sf-badge-text')?.textContent.trim(),
          badge: list.querySelector('.sf-list__row[data-id="a"] sf-badge.sf-list__badge')?.getAttribute('status')};
      });
      ok(`${label}: a count that comes and goes keeps the row and the focus`, kept.gone && kept.same && kept.focus && kept.count === '7' && kept.badge === 'error', kept);

      ok(`${label}: no page error`, errors.length === 0, errors);
      await context.close();
    }
  }

  // English words.
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, locale: 'en-US', reducedMotion: 'reduce'});
  const tab = await context.newPage();
  await tab.goto(`${base}/page?lang=en`);
  await tab.waitForFunction(() => Boolean(customElements.get('sf-list')), null, {timeout: 20000});
  await tab.evaluate(({items}) => document.getElementById('two').setItems(items), {items: data.two});
  await tab.waitForFunction(() => document.querySelector('#two sf-badge.sf-list__count')?.getAttribute('aria-label'), null, {timeout: 20000});
  const english = await tab.evaluate(() => ({
    heading: document.querySelector('#two .sf-list__heading').textContent.trim(),
    count: document.querySelector('#two sf-badge.sf-list__count').getAttribute('aria-label'),
  }));
  ok('en: Pinned and «1 unread»', english.heading === 'Pinned' && english.count === '1 unread', english);
  await context.close();
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((result) => !result.pass);
for (const result of failed) console.error(`FAIL ${result.name}: ${JSON.stringify(result.detail)}`);
console.log(JSON.stringify({checked: results.length, failed: failed.length}));
if (failed.length) process.exit(1);
console.log('LIST_ROW_PARTS_OK');

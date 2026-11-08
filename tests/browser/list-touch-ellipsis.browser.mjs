#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--headed] [--shots <dir>]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-list 1.2.0 (the UI Chat thread's request msg-f44b9ece, item b): what
// sf-chat-threads 2.0.0 bridged for its own rows now lives in the list, on the
// built bytes through the real Loader, at 1280 and 390, with a fine and a
// coarse pointer (hasTouch: the page's (pointer: coarse) is checked, not
// assumed), light and dark, at each step of the ladder (1/2, 1, 2):
// - a fine pointer keeps the ladder: a one-line row is the control height of
//   its step, a two-line row the control height and one line of the step
//   below (as 1.1.1 drew them), the «⋯» the icon button of the step;
// - a coarse pointer: every row is at least --sf-d1 (44px), a step whose
//   control height is taller keeps it; the row's content stays on its centre
//   line; the «⋯» is at least 44 x 44 and inside its row; the rename field and
//   the loading rows are as tall as a row;
// - the «⋯» is shown whatever the pointer and whether or not the pointer is
//   over the row: opacity 1, visible, a box;
// - no-wrap: a long title and a long second line are one line each, cut with
//   an ellipsis (the text box is narrower than its text), the whole text is
//   in the row and is the row's tooltip (title on its sf-list-item); the
//   avatar, the count, the badge and the «⋯» stay whole, inside the row; a
//   short title is not cut; a row's height is the same as without no-wrap
//   for a text that fits;
// - without no-wrap a long one-line title wraps as in 1.1 and carries no
//   tooltip;
// - the geometry is the same in light and dark; no sideways scroll, no page error.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const headed = process.argv.includes('--headed');
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(shell(url.searchParams.get('theme') || 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// A sidebar column (280px, or the phone's width) holding the same rows with
// and without no-wrap, and a list that is loading.
const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface)}.box{inline-size:min(280px,100%);box-sizing:border-box;padding:8px}</style></head>
<body>
<div class="box"><sf-list id="cut" label="Обрезка" no-wrap renamable></sf-list></div>
<div class="box"><sf-list id="wrap" label="Перенос" renamable></sf-list></div>
<div class="box"><sf-list id="flat" label="Без второй строки" no-wrap renamable></sf-list></div>
<div class="box"><sf-list id="wait" label="Загрузка" loading></sf-list></div>
</body></html>`;

const LONG = 'Подготовка годового отчёта для совета директоров и акционеров компании';
const SECOND = 'Пётр: прислал последнюю версию таблицы с цифрами за весь год';
const data = {
  cut: [
    {id: 'a', text: LONG, supporting: SECOND, avatar: {text: 'ПГ'}, count: 12},
    {id: 'b', text: 'Анна', supporting: 'Да', avatar: {text: 'АБ'}},
    {id: 'c', text: LONG, avatar: {icon: 'smart_toy'}, badge: {text: 'Ждёт', tone: 'warning'}},
  ],
  wrap: [
    {id: 'a', text: LONG, supporting: SECOND, avatar: {text: 'ПГ'}, count: 12},
    {id: 'b', text: 'Анна', supporting: 'Да', avatar: {text: 'АБ'}},
    {id: 'c', text: LONG, avatar: {icon: 'smart_toy'}, badge: {text: 'Ждёт', tone: 'warning'}},
  ],
  flat: [
    {id: 'a', text: LONG, icon: 'mail', count: 4},
    {id: 'b', text: 'Да', icon: 'mail'},
  ],
};

const results = [];
const measures = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail: pass ? '' : detail});
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
// Headed runs take the installed Google Chrome (channel chrome).
const browser = await chromium.launch(headed ? {headless: false, channel: 'chrome'} : {});
const geometry = {};
try {
  for (const width of [1280, 390]) {
    for (const pointer of ['fine', 'coarse']) {
      for (const theme of ['light', 'dark']) {
        for (const size of ['1/2', '1', '2']) {
          const label = `${width} ${pointer} ${theme} size ${size}`;
          const context = await browser.newContext({viewport: {width, height: 1000}, locale: 'ru-RU', reducedMotion: 'reduce',
            hasTouch: pointer === 'coarse', colorScheme: theme});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(error.message));
          await tab.goto(`${base}/page?theme=${theme}`);
          await tab.waitForFunction(() => Boolean(customElements.get('sf-list') && customElements.get('sf-list-item')), null, {timeout: 20000});
          await tab.evaluate(({data, size}) => {
            for (const list of document.querySelectorAll('sf-list')) list.setAttribute('size', size);
            for (const [id, items] of Object.entries(data)) document.getElementById(id).setItems(items);
            for (const list of document.querySelectorAll('sf-list:not(#wait)')) list.actions = [{id: 'archive', text: 'В архив', icon: 'archive'}];
          }, {data, size});
          await tab.waitForFunction(() => customElements.get('sf-avatar') && customElements.get('sf-badge')
            && document.querySelectorAll('#cut .sf-list__actions').length === 3
            && document.querySelectorAll('#cut sf-badge > *').length >= 2, null, {timeout: 20000});
          await tab.evaluate(() => document.fonts.ready);
          await tab.waitForTimeout(250);
          // The pointer rests away from every row: nothing may wait for a hover.
          await tab.mouse.move(width - 2, 990);

          const got = await tab.evaluate(({size}) => {
            const esc = size.replace('/', '\\/');
            const below = {'1/2': '1\\/3', 1: '1\\/2', 2: '1'}[size];
            const probe = document.createElement('div');
            document.body.append(probe);
            const length = (value) => { probe.style.width = value; return parseFloat(getComputedStyle(probe).width); };
            const tokens = {
              control: length(`var(--sf-ui-${esc}--control-height)`),
              line: length(`var(--sf-text-height-${esc})`),
              lineBelow: length(`var(--sf-text-height-${below})`),
              d1: length('var(--sf-d1)'),
            };
            probe.remove();
            const box = (node) => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cy: r.y + r.height / 2}; };
            const drawn = (node) => (node && getComputedStyle(node).display === 'contents' ? node.firstElementChild : node);
            const text = (node) => {
              if (!node) return null;
              const style = getComputedStyle(node);
              return {...box(node), whiteSpace: style.whiteSpace, textOverflow: style.textOverflow, overflow: style.overflowX,
                cut: node.scrollWidth > node.clientWidth + 0.5, lineHeight: parseFloat(style.lineHeight), content: node.textContent.trim()};
            };
            const rows = (id) => [...document.querySelectorAll(`#${id} .sf-list__row`)].map((row) => {
              const item = row.querySelector('.sf-list-item');
              const host = row.querySelector('sf-list-item');
              const dots = row.querySelector('.sf-list__actions');
              const dotsStyle = dots && getComputedStyle(dots);
              const title = row.querySelector('.sf-list-item-title');
              const container = row.querySelector('.sf-list-item-container');
              const parts = [drawn(row.querySelector('.sf-list__lead sf-avatar')) || row.querySelector('.sf-list__sign') || row.querySelector('.sf-list__glyph'),
                drawn(row.querySelector('sf-badge.sf-list__count')), drawn(row.querySelector('sf-badge.sf-list__badge'))].filter(Boolean);
              return {
                id: row.dataset.id,
                row: box(row),
                item: box(item),
                content: [...item.querySelectorAll('.sf-list-item-wrap')].map(box)[0],
                tip: host.getAttribute('title'),
                title: text(title || container),
                supporting: text(row.querySelector('.sf-list-item-supporting')),
                twoLine: item.classList.contains('sf-list-item--two-line'),
                parts: parts.map((node) => ({...box(node), natural: node.scrollWidth})),
                dots: dots ? {...box(dots), opacity: dotsStyle.opacity, visibility: dotsStyle.visibility, display: dotsStyle.display} : null,
                colour: getComputedStyle(container).color,
              };
            });
            // The rename field, as F2 opens it, on the first row of #flat.
            return {
              tokens,
              coarse: matchMedia('(pointer: coarse)').matches,
              cut: rows('cut'),
              wrap: rows('wrap'),
              flat: rows('flat'),
              skeleton: [...document.querySelectorAll('#wait .sf-list__skeleton > span')].map(box),
              scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              background: getComputedStyle(document.body).backgroundColor,
            };
          }, {size});

          const {tokens} = got;
          const touch = pointer === 'coarse';
          const one = touch ? Math.max(tokens.control, tokens.d1) : tokens.control;
          const two = tokens.control + tokens.lineBelow;
          ok(`${label}: the page's pointer is ${pointer}`, got.coarse === touch, got.coarse);
          ok(`${label}: --sf-d1 is 44px`, near(tokens.d1, 44), tokens);
          for (const [name, list] of [['cut', got.cut], ['wrap', got.wrap], ['flat', got.flat]]) {
            for (const row of list) {
              const where = `${label}: #${name} row ${row.id}`;
              // Without no-wrap a long one-line title wraps (1.1); a two-line
              // row's title and second line were already one line each
              // (sf-list-item's own two-line rule).
              const fits = !(row.title.content === LONG && name === 'wrap' && !row.twoLine);
              if (fits) {
                const want = row.twoLine ? (touch ? Math.max(two, tokens.d1) : two) : one;
                ok(`${where} is ${want}px high`, near(row.row.h, want), {h: row.row.h, want, tokens});
              } else {
                ok(`${where}: a long title wraps without no-wrap`, row.title.h > row.title.lineHeight * 1.5 && row.row.h > (row.twoLine ? two : one), {title: row.title, row: row.row});
              }
              if (touch) ok(`${where} is at least 44px under a finger`, row.row.h >= 44 - 0.5, row.row.h);
              ok(`${where}: its content on the row's centre line`, near(row.content.cy, row.row.cy), {content: row.content, row: row.row});
              ok(`${where}: «⋯» shown without a hover`, row.dots && row.dots.opacity === '1' && row.dots.visibility === 'visible' && row.dots.display !== 'none' && row.dots.w > 0, row.dots);
              ok(`${where}: «⋯» inside its row, centred`, row.dots.right <= row.row.right + 0.5 && row.dots.x >= row.row.x && near(row.dots.cy, row.row.cy), {dots: row.dots, row: row.row});
              if (touch) ok(`${where}: «⋯» at least 44 x 44`, row.dots.w >= 44 - 0.5 && row.dots.h >= 44 - 0.5, row.dots);
              else ok(`${where}: «⋯» the step's icon button`, near(row.dots.h, tokens.control) && near(row.dots.w, tokens.control), {dots: row.dots, tokens});
              for (const part of row.parts) ok(`${where}: a part stays whole, inside the row`, part.natural <= part.w + 0.5 && part.right <= row.item.right + 0.5 && part.x >= row.row.x, {part, item: row.item});
              ok(`${where}: the text ends before the parts and the «⋯»`, row.title.right <= Math.min(row.dots.x, ...row.parts.filter((part) => part.x > row.title.x).map((part) => part.x)) + 0.5, {title: row.title, parts: row.parts, dots: row.dots});
            }
          }
          // no-wrap.
          for (const row of [...got.cut, ...got.flat]) {
            const where = `${label}: no-wrap row ${row.id}`;
            const long = row.title.content === LONG;
            ok(`${where}: the title is one line`, near(row.title.h, row.title.lineHeight, 1), row.title);
            ok(`${where}: the title is cut with an ellipsis${long ? '' : ' only when long'}`, row.title.whiteSpace === 'nowrap' && row.title.textOverflow === 'ellipsis' && row.title.cut === long, row.title);
            ok(`${where}: the whole title stays in the row`, row.title.content === (long ? LONG : row.title.content), row.title.content);
            if (row.supporting) {
              const longer = row.supporting.content === SECOND;
              ok(`${where}: the second line is one line, cut only when long`, near(row.supporting.h, row.supporting.lineHeight, 1) && row.supporting.textOverflow === 'ellipsis' && row.supporting.cut === longer, row.supporting);
            }
            const want = row.supporting ? `${row.title.content} · ${row.supporting.content}` : row.title.content;
            ok(`${where}: the whole text is the tooltip`, row.tip === want, {tip: row.tip, want});
          }
          for (const row of got.wrap) ok(`${label}: without no-wrap row ${row.id} has no tooltip`, row.tip === null, row.tip);
          ok(`${label}: the loading rows are as tall as a row`, got.skeleton.length === 3 && got.skeleton.every((span) => near(span.h, one)), {skeleton: got.skeleton, one});
          ok(`${label}: no sideways scroll`, got.scroll <= 0, got.scroll);
          ok(`${label}: the text has its colour on the surface`, got.cut[0].colour !== got.background, {colour: got.cut[0].colour, background: got.background});

          // The rename field is as tall as the row it replaces.
          const renamed = await tab.evaluate(async () => {
            const list = document.getElementById('flat');
            const before = list.querySelector('.sf-list__row[data-id="b"]').getBoundingClientRect().height;
            list.rename('b');
            await new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle)));
            const field = list.querySelector('.sf-list__rename');
            const after = field ? field.getBoundingClientRect().height : 0;
            field?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            return {before, after};
          });
          ok(`${label}: the rename field is as tall as its row`, near(renamed.after, renamed.before), renamed);
          ok(`${label}: no page error`, errors.length === 0, errors);

          const key = `${width} ${pointer} ${size}`;
          // Heights and the «⋯» exactly; a title's width to the pixel (the
          // dark theme's text antialiasing moves a glyph run by half a pixel).
          // A title that wraps (#wrap c, without no-wrap) is left out: its
          // line breaks follow that half pixel, in 1.1.1 as well.
          const shape = ([got.cut, got.wrap, got.flat].map((list) => list
            .filter((row) => !(list === got.wrap && row.title.content === LONG && !row.twoLine))
            .map((row) => [row.row.h, row.title.w, row.dots.w, row.dots.h])));
          geometry[key] = geometry[key] ?? {};
          geometry[key][theme] = shape;
          measures.push({width, pointer, theme, size, tokens, rows: Object.fromEntries(['cut', 'wrap', 'flat'].map((name) => [name, got[name].map((row) => ({id: row.id, h: row.row.h, twoLine: row.twoLine, dots: [row.dots.w, row.dots.h], titleW: row.title.w, cut: row.title.cut, tip: row.tip}))]))});
          if (shots && size === '1') await tab.screenshot({path: join(shots, `list-${width}-${pointer}-${theme}.png`), fullPage: true});
          await context.close();
        }
      }
    }
  }
  // Heights and the «⋯» exactly, a title's width within 2px (the face of a short word may land a run apart between loads).
  const same = (a, b) => a.length === b.length && a.every((list, i) => list.length === b[i].length
    && list.every((row, j) => row[0] === b[i][j][0] && Math.abs(row[1] - b[i][j][1]) <= 2 && row[2] === b[i][j][2] && row[3] === b[i][j][3]));
  for (const [key, themes] of Object.entries(geometry)) ok(`${key}: light and dark draw the same geometry`, same(themes.light, themes.dark), themes);
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((result) => !result.pass);
for (const result of failed) console.error(`FAIL ${result.name}: ${JSON.stringify(result.detail)}`);
if (shots) {
  const {writeFileSync} = await import('node:fs');
  writeFileSync(join(shots, 'measures.json'), `${JSON.stringify({headed, checked: results.length, failed: failed.length, measures}, null, 2)}\n`);
}
console.log(JSON.stringify({headed, checked: results.length, failed: failed.length}));
if (failed.length) process.exit(1);
console.log('LIST_TOUCH_ELLIPSIS_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-modal's edges (pair next 2 follow-ups, 2026-11-11):
//   C56  a side panel stands flush to its edge of the screen (owner decision,
//        variant B): no border on the screen's edge, the top and the bottom,
//        square corners there, the inner corners the window's radius and the
//        inner side its border; inline-start and inline-end follow the
//        writing direction (and so do left and right, which the window
//        places at the line's start and end; an open inline-start or
//        inline-end panel in a right-to-left page stood off the screen); on a phone (390) the panel is the whole screen
//        with no radius and no border. The centre window keeps all four.
//   D1   one start line (C39): the title and the content's text start on
//        one line, in the Smart window (centre and side panels) and in the
//        class window (component.modal); they stood 4 px apart (ui-control
//        evidence 2026-11-11-nav-followup-hue-accept, N1).
//   L1   the body's scroll box never stands outside the window's frame: a
//        page's --sf-modal-padding-inline below 1/4 (2px, 0px) keeps it
//        inside the surface; the question window's frame is never negative.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
let current = '';
const shell = (dir, theme, body) => `<!doctype html><html lang="ru" dir="${dir}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>modal edges</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}, smart: {base: true}, theme: false};</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-1)}</style></head><body>${body}</body></html>`;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  const file = mount && resolve(mount[1], path.slice(mount[0].length));
  if (!file || !file.startsWith(mount[1] + sep)) {
    response.writeHead(404);
    return response.end();
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream'});
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const content = '<p slot="content" style="margin:0">Текст окна.</p><div slot="footer"><sf-button>Применить</sf-button></div>';

const failures = [];
const evidence = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
const measure = async (width, touch, dir, theme, modal) => {
  const context = await browser.newContext({viewport: {width, height: 800}, isMobile: touch, hasTouch: touch});
  const tab = await context.newPage();
  tab.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  current = shell(dir, theme, modal === 'class' ? '<div id="box"><div sf-asset="modal" class="hidden"></div></div>' : modal);
  await tab.goto(`${base}/probe`);
  if (modal === 'class') {
    await tab.waitForFunction(() => window.SF?.Loader?.ready, null, {timeout: 15000});
    await tab.evaluate(() => new Promise((done) => window.SF.Loader.ready('Modal', (Modal) => {
      const m = new Modal({id: 'cm', param: {container: '#box', title: 'Опубликовать изменения?', html: '<p class="m-0">Новая версия станет доступна участникам проекта.</p>'}});
      m.open();
      done();
    })));
  }
  await tab.waitForFunction(() => {
    const s = document.querySelector('[data-sf-modal-surface]');
    return s && !s.closest('[data-sf-style-pending]') && getComputedStyle(s.closest('.sf-modal')).position === 'fixed' && s.getBoundingClientRect().width > 0;
  }, null, {timeout: 15000});
  await tab.waitForTimeout(600);
  const m = await tab.evaluate(() => {
    const s = document.querySelector('[data-sf-modal-surface]');
    const c = getComputedStyle(s);
    const r = s.getBoundingClientRect();
    const scroll = s.querySelector('[data-sf-modal-body-scroll]')?.getBoundingClientRect();
    const title = s.querySelector('.sf-modal-title')?.getBoundingClientRect();
    const textNode = s.querySelector('[data-sf-modal-body] p, .sf-modal-body p');
    const text = textNode ? (() => { const range = document.createRange(); range.selectNodeContents(textNode); return range.getClientRects()[0]; })() : null;
    const px = (v) => Math.round(parseFloat(v) * 100) / 100;
    return {
      radius: {tl: px(c.borderTopLeftRadius), tr: px(c.borderTopRightRadius), br: px(c.borderBottomRightRadius), bl: px(c.borderBottomLeftRadius)},
      border: {l: px(c.borderLeftWidth), r: px(c.borderRightWidth), t: px(c.borderTopWidth), b: px(c.borderBottomWidth)},
      padding: {l: px(c.paddingLeft), r: px(c.paddingRight)},
      box: {left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)},
      inner: scroll ? {left: Math.round((scroll.left - r.left) * 100) / 100, right: Math.round((r.right - scroll.right) * 100) / 100} : null,
      viewport: innerWidth,
      startLine: title && text ? Math.round((text.left - title.left) * 100) / 100 : null,
    };
  });
  await context.close();
  return m;
};
try {
  for (const theme of ['light', 'dark']) {
    // C56 on a desktop: the edge side, the top and the bottom have no border
    // and square corners; the inner side keeps both.
    const sides = [
      ['right', 'ltr', 'r'], ['left', 'ltr', 'l'],
      ['inline-end', 'ltr', 'r'], ['inline-start', 'ltr', 'l'],
      ['inline-end', 'rtl', 'l'], ['inline-start', 'rtl', 'r'],
      // right and left stand at the end and the start of the line, as the
      // window places them (justify-content), in a right-to-left page too.
      ['right', 'rtl', 'l'], ['left', 'rtl', 'r'],
    ];
    for (const [position, dir, edge] of sides) {
      const m = await measure(1440, false, dir, theme, `<sf-modal position="${position}" heading="Панель" width="25rem" open>${content}</sf-modal>`);
      const name = `${theme} 1440 ${position} ${dir}`;
      evidence.push({name, ...m});
      const inner = edge === 'r' ? 'l' : 'r';
      const [edgeTop, edgeBottom, innerTop, innerBottom] = edge === 'r' ? [m.radius.tr, m.radius.br, m.radius.tl, m.radius.bl] : [m.radius.tl, m.radius.bl, m.radius.tr, m.radius.br];
      check(`${name}: flush to the ${edge === 'r' ? 'right' : 'left'} edge`, edge === 'r' ? m.box.right === m.viewport : m.box.left === 0, m.box);
      check(`${name}: no border on the edge, top or bottom`, m.border[edge] === 0 && m.border.t === 0 && m.border.b === 0, m.border);
      check(`${name}: the inner side keeps its border`, m.border[inner] > 0, m.border);
      check(`${name}: square corners on the edge`, edgeTop === 0 && edgeBottom === 0, m.radius);
      check(`${name}: the inner corners are the window's radius (8)`, innerTop === 8 && innerBottom === 8, m.radius);
      if (dir === 'ltr') check(`${name}: the text starts on the title's line`, m.startLine !== null && Math.abs(m.startLine) < 0.5, {startLine: m.startLine});
    }
    // C56 on a phone: the whole screen, no radius, no border.
    for (const position of ['right', 'left', 'inline-end']) {
      for (const width of ['', ' width="25rem"']) {
        const m = await measure(390, true, 'ltr', theme, `<sf-modal position="${position}" heading="Панель"${width} open>${content}</sf-modal>`);
        const name = `${theme} 390 ${position}${width}`;
        evidence.push({name, ...m});
        check(`${name}: the whole screen`, m.box.left === 0 && m.box.width === m.viewport, m.box);
        check(`${name}: no radius`, Object.values(m.radius).every((v) => v === 0), m.radius);
        check(`${name}: no border`, Object.values(m.border).every((v) => v === 0), m.border);
      }
    }
    // The centre window keeps its four corners and its border.
    for (const [width, touch] of [[1440, false], [390, true]]) {
      const m = await measure(width, touch, 'ltr', theme, `<sf-modal heading="Окно" open>${content}</sf-modal>`);
      const name = `${theme} ${width} centre`;
      evidence.push({name, ...m});
      check(`${name}: four rounded corners`, Object.values(m.radius).every((v) => v === 8), m.radius);
      check(`${name}: a border on every side`, Object.values(m.border).every((v) => v > 0), m.border);
      check(`${name}: the text starts on the title's line`, m.startLine !== null && Math.abs(m.startLine) < 0.5, {startLine: m.startLine});
      check(`${name}: the scroll box stands 1/4 into the frame`, m.inner && m.inner.left === m.border.l + m.padding.l - 4, {inner: m.inner, padding: m.padding});
    }
    // D1 in the class window (component.modal).
    for (const [width, touch] of [[1440, false], [390, true]]) {
      const m = await measure(width, touch, 'ltr', theme, 'class');
      const name = `${theme} ${width} class window`;
      evidence.push({name, ...m});
      check(`${name}: the text starts on the title's line`, m.startLine !== null && Math.abs(m.startLine) < 0.5, {startLine: m.startLine});
    }
    // L1: a page's frame below 1/4 keeps the scroll box inside the window.
    for (const pad of ['2px', '0px', '4px', '12px']) {
      const m = await measure(1440, false, 'ltr', theme, `<sf-modal heading="Окно" style="--sf-modal-padding-inline:${pad}" open>${content}</sf-modal>`);
      const name = `${theme} 1440 centre --sf-modal-padding-inline:${pad}`;
      evidence.push({name, ...m});
      const outset = Math.min(4, parseFloat(pad));
      check(`${name}: the scroll box inside the surface`, m.inner && m.inner.left >= m.border.l - 0.01 && m.inner.right >= m.border.r - 0.01, {inner: m.inner, border: m.border});
      check(`${name}: the outset is min(1/4, the frame)`, m.inner && Math.abs(m.inner.left - (m.border.l + m.padding.l - outset)) < 0.02, {inner: m.inner, padding: m.padding, outset});
    }
    for (const pad of ['2px', '0px']) {
      const m = await measure(1440, false, 'ltr', theme, `<sf-modal size="question" heading="Удалить?" style="--sf-modal-padding-inline:${pad}" open><p slot="content" style="margin:0">Текст.</p><div slot="footer"><sf-button status="error">Удалить</sf-button></div></sf-modal>`);
      const name = `${theme} 1440 question --sf-modal-padding-inline:${pad}`;
      evidence.push({name, ...m});
      check(`${name}: the frame is not negative`, m.padding.l === 0 && m.padding.r === 0, m.padding);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('MODAL_SIDE_EDGES_OK');

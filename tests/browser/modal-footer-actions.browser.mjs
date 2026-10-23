#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The sf-modal footer puts its actions at the end, with a step of the ladder
// between them (simai/ui-source#26 C2, ui-mail P-12: the slotted actions sat
// at the start with a wide gap). On the built bytes, through the loader, at
// 1280px:
//   - actions slotted directly: the last one ends where the footer's content
//     ends, the gap between them is --sf-space-1/2, they keep their order
//     and stand on one centre line;
//   - the audit's repro, a wrapper div in the slot: it stands at the end;
//   - right to left: the actions stand at the left end;
//   - footer-class with a utility (content-main-between) still wins: a
//     checkbox at the start, the action at the end;
//   - --sf-modal-footer-gap changes the gap.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const CASES = {
  direct: {dir: 'ltr', body: `<sf-modal id="m" open title="Удалить письмо?"><p slot="content">Письмо нельзя будет восстановить.</p>
    <button slot="footer" type="button" class="action">Отмена</button><button slot="footer" type="button" class="action">Удалить</button></sf-modal>`},
  wrapper: {dir: 'ltr', body: `<sf-modal id="m" open show-footer title="Удалить письмо?"><p slot="content">Текст</p>
    <div slot="footer" class="flex content-main-end gap-1/2"><button type="button" class="action">Отмена</button><button type="button" class="action">Удалить</button></div></sf-modal>`},
  rtl: {dir: 'rtl', body: `<sf-modal id="m" open title="Удалить?"><p slot="content">Текст</p>
    <button slot="footer" type="button" class="action">Отмена</button><button slot="footer" type="button" class="action">Удалить</button></sf-modal>`},
  between: {dir: 'ltr', body: `<sf-modal id="m" open title="Настройки" footer-class="content-main-between"><p slot="content">Текст</p>
    <label slot="footer" class="action"><input type="checkbox"> Не спрашивать</label><button slot="footer" type="button" class="action">Готово</button></sf-modal>`},
  gap: {dir: 'ltr', style: '--sf-modal-footer-gap: 23px', body: `<sf-modal id="m" open title="Окно"><p slot="content">Текст</p>
    <button slot="footer" type="button" class="action">Отмена</button><button slot="footer" type="button" class="action">Да</button></sf-modal>`},
};
const page = (name) => {
  const item = CASES[name];
  return `<!doctype html><html lang="ru" dir="${item.dir}" class="theme-light" style="${item.style ?? ''}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{preloaderActive:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>${item.body}</body></html>`;
};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const name = path.slice(1);
  if (CASES[name]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(name));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();
try {
  for (const name of Object.keys(CASES)) {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
    tab.on('pageerror', (error) => failures.push({name: `${name}: page error`, said: error.message}));
    await tab.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    await tab.waitForFunction(() => {
      const footer = document.querySelector('.sf-modal-footer');
      return footer && getComputedStyle(footer).display === 'flex' && getComputedStyle(footer).justifyContent !== 'normal';
    }, null, {timeout: 15000}).catch(() => {});
    await tab.waitForTimeout(400);
    const m = await tab.evaluate(() => {
      const footer = document.querySelector('.sf-modal-footer');
      if (!footer) return {missing: true};
      const style = getComputedStyle(footer);
      const box = footer.getBoundingClientRect();
      const content = {
        left: box.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
        right: box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth),
      };
      const rect = (element) => { const r = element.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: element.textContent.trim()}; };
      const step = document.createElement('div');
      step.style.inlineSize = 'var(--sf-space-1\\/2)';
      document.body.append(step);
      const ladder = step.getBoundingClientRect().width;
      step.remove();
      return {
        justify: style.justifyContent, gap: style.columnGap, content, ladder,
        actions: [...footer.querySelectorAll('.action')].map(rect),
        items: [...footer.children].map(rect),
      };
    });
    evidence[name] = m;
    if (m.missing) { check(`${name}: the footer is drawn`, false); await tab.close(); continue; }
    const [first, last] = [m.actions[0], m.actions.at(-1)];
    if (name === 'direct') {
      check('direct: the last action ends where the footer\'s content ends', near(last.right, m.content.right), m);
      check('direct: the gap between the actions is space-1/2', m.ladder > 0 && near(m.actions[1].left - m.actions[0].right, m.ladder, 0.5) && m.gap === `${m.ladder}px`, m);
      check('direct: the actions keep their order, the primary last', first.text === 'Отмена' && last.text === 'Удалить', m);
      check('direct: they stand on one centre line', near((first.top + first.bottom) / 2, (last.top + last.bottom) / 2, 0.5), m);
    }
    if (name === 'wrapper') {
      check('wrapper: the slotted wrapper stands at the end', near(m.items.at(-1).right, m.content.right), m);
      check('wrapper: its last action ends there', near(last.right, m.content.right), m);
    }
    if (name === 'rtl') {
      check('rtl: the actions stand at the left end', near(m.actions.reduce((x, a) => Math.min(x, a.left), Infinity), m.content.left), m);
      check('rtl: the first action stands on the right', first.left > last.left, m);
    }
    if (name === 'between') {
      check('between: footer-class still wins over the default', m.justify === 'space-between', m);
      check('between: the checkbox stands at the start, the action at the end', near(first.left, m.content.left) && near(last.right, m.content.right), m);
    }
    if (name === 'gap') {
      check('gap: --sf-modal-footer-gap sets the gap', m.gap === '23px' && near(m.actions[1].left - m.actions[0].right, 23, 0.5), m);
    }
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('MODAL_FOOTER_ACTIONS_OK');

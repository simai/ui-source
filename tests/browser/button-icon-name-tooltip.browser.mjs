#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Owner decision C160 (2026-11-14), measured on the built bytes: an icon
// button shows its own name as the shared tooltip after 0.5 s of hover and at
// once on keyboard focus, below the button, flipped above at the bottom edge;
// Escape hides it and keeps the focus; the native title is not drawn and the
// title's words describe the button; tooltip="off" shows none; the tooltip is
// one size (12/16, padding 4 x 8) and at most two lines.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body style="margin:40px">
  <div style="display:flex;gap:8px">
    <sf-button-icon id="bold" icon="format_bold" aria-label="Полужирный"></sf-button-icon>
    <sf-button-icon id="italic" icon="format_italic" aria-label="Курсив"></sf-button-icon>
    <sf-button-icon id="titled" icon="close" aria-label="Отменить" title="Отменить загрузку файла"></sf-button-icon>
    <sf-button-icon id="off" icon="help" aria-label="Справка" tooltip="off"></sf-button-icon>
  </div>
  <div style="position:fixed;inset-block-end:4px;inset-inline-start:40px"><sf-button-icon id="low" icon="settings" aria-label="Настройки"></sf-button-icon></div>
  <button id="before" type="button">before</button>
</body></html>`;
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  const errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/page`);
  await page.waitForFunction(() => document.querySelector('#low .sf-icon-button'));
  await page.waitForTimeout(800);
  const tips = () => page.evaluate(() => [...document.querySelectorAll('.sf-icon-button-tooltip')].filter((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && getComputedStyle(t).visibility !== 'hidden' && !t.hidden; }).map((t) => {
    const r = t.getBoundingClientRect(); const b = t.previousElementSibling.getBoundingClientRect(); const text = t.querySelector('.sf-tooltip-text') || t; const c = t.querySelector('.sf-tooltip-content') || t;
    return {id: t.id, text: t.textContent.trim(), gapBelow: Math.round(r.top - b.bottom), gapAbove: Math.round(b.top - r.bottom), h: Math.round(r.height), font: `${getComputedStyle(text).fontSize}/${getComputedStyle(text).lineHeight}`, pad: `${getComputedStyle(c).paddingTop} ${getComputedStyle(c).paddingLeft}`};
  }));
  const center = async (id) => { const r = await page.locator(`#${id} .sf-icon-button`).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const titles = await page.evaluate(() => ['bold', 'titled', 'off'].map((id) => document.querySelector(`#${id} .sf-icon-button`).getAttribute('title')));
  await page.mouse.move(...await center('bold'));
  await page.waitForTimeout(250);
  const early = await tips();
  await page.waitForTimeout(700);
  const shown = await tips();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const escaped = await tips();
  await page.mouse.move(...await center('titled'));
  await page.waitForTimeout(900);
  const titled = await tips();
  const described = await page.evaluate(() => { const b = document.querySelector('#titled .sf-icon-button'); const ids = (b.getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean); return ids.map((id) => document.getElementById(id)?.textContent.trim()).join(' ') || b.getAttribute('aria-description'); });
  await page.mouse.move(...await center('off'));
  await page.waitForTimeout(900);
  const off = await tips();
  await page.mouse.move(...await center('low'));
  await page.waitForTimeout(900);
  const low = await tips();
  await page.mouse.move(5, 300);
  await page.waitForTimeout(600);
  await page.focus('#before');
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(150);
  const focused = await tips();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const focusKept = await page.evaluate(() => document.activeElement?.closest('sf-button-icon')?.id);
  if (titles[0] !== null || titles[1] !== '' || titles[2] !== 'Справка' && titles[2] !== null) note({case: 'no native title drawn', got: titles});
  if (early.length) note({case: 'nothing before 0.5 s', got: early});
  const bold = shown.find((t) => t.text === 'Полужирный');
  if (!bold || bold.gapBelow < 0 || bold.gapBelow > 8 || bold.h !== 24 || bold.font !== '12px/16px' || bold.pad !== '4px 8px') note({case: 'the name below, one size', got: shown});
  if (escaped.length) note({case: 'Escape hides', got: escaped});
  if (!titled.some((t) => t.text === 'Отменить загрузку файла') || described !== 'Отменить загрузку файла') note({case: 'title words as tooltip and description', got: {titled, described}});
  if (off.length) note({case: 'tooltip="off" shows none', got: off});
  const flipped = low.find((t) => t.text === 'Настройки');
  if (!flipped || flipped.gapAbove < 0 || flipped.gapAbove > 8) note({case: 'flips above at the bottom edge', got: low});
  if (!focused.some((t) => t.text === 'Настройки' || t.text === 'Справка' || t.text === 'Отменить загрузку файла' || t.text === 'Курсив' || t.text === 'Полужирный') || focusKept === undefined) note({case: 'keyboard focus shows at once, Escape keeps focus', got: {focused, focusKept}});
  if (errors.length) note({case: 'console clean', got: errors});
  console.log(JSON.stringify({titles, shown, titled, described, low, focused, focusKept}, null, 1));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('BUTTON_ICON_NAME_TOOLTIP_OK');

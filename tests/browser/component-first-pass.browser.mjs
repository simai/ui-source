#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Components the first documentation pass found broken, held on a page that
// loads Core and lets the Loader bring them: <kbd> and .sf-file-preview get
// their CSS (their rules were never imported); a menu item written expanded is
// open; a carousel keeps the names its slides were given and is as tall as its
// box; a slider's thumbnail moves it and its arrows speak the page's language.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<p><kbd id="key">Ctrl</kbd></p><div class="sf-file-preview" id="preview">x</div>
<nav aria-label="m"><ul class="sf-menu"><li class="sf-menu-item" id="parent" expanded><a class="sf-menu-element" href="#">Parent</a><ul class="sf-menu"><li class="sf-menu-item"><a class="sf-menu-element" href="#">Child</a></li></ul></li></ul></nav>
<div class="sf-carousel" id="car" style="height:416px" aria-label="Gallery"><div class="sf-carousel-slider swiper"><div class="swiper-wrapper">
<div class="swiper-slide" aria-label="Закат"><div style="height:50px">A</div></div><div class="swiper-slide" aria-label="Море"><div style="height:50px">B</div></div></div></div></div>
<sf-breadcrumbs id="crumbs" max-items="4"><sf-breadcrumbs-item href="/">Главная</sf-breadcrumbs-item><sf-breadcrumbs-item href="/a">Раздел</sf-breadcrumbs-item><sf-breadcrumbs-item href="/b">Подраздел</sf-breadcrumbs-item><sf-breadcrumbs-item href="/c">Ещё</sf-breadcrumbs-item><sf-breadcrumbs-item href="/d">Глубже</sf-breadcrumbs-item><sf-breadcrumbs-item current>Страница</sf-breadcrumbs-item></sf-breadcrumbs>
<sf-button-group id="group" scheme="secondary" value="b" items="a::Первый|b::Второй|c::Третий"></sf-button-group>
<sf-slider id="s" thumbs arrows><div slot="slide">S1</div><div slot="slide">S2</div><div slot="slide">S3</div></sf-slider>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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
let seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1200, height: 900}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => customElements.get('sf-slider') && document.querySelectorAll('#s .sf-slider-thumbnails .swiper-slide').length >= 3, null, {timeout: 15000})
    .catch(() => failures.push('the slider never drew its thumbnails'));
  await tab.waitForTimeout(600);
  const before = await tab.evaluate(() => document.querySelector('#s .sf-slider-main')?.swiper?.activeIndex ?? null);
  await tab.locator('#s .sf-slider-thumbnails .swiper-slide').nth(2).click().catch(() => {});
  await tab.waitForTimeout(400);
  const crumbs = await tab.evaluate(async () => {
    const root = document.querySelector('#crumbs');
    const expand = root.querySelector('button');
    const label = expand?.getAttribute('aria-label') ?? null;
    expand?.click();
    await new Promise((settle) => setTimeout(settle, 400));
    const visible = [...root.querySelectorAll('a, [aria-current]')].filter((item) => item.getBoundingClientRect().width > 0).length;
    const ellipsis = [...root.querySelectorAll('button')].filter((button) => button.getBoundingClientRect().width > 0).length;
    return {label, visible, ellipsis};
  });
  if (crumbs.label !== 'Показать скрытые крошки') failures.push(`breadcrumbs «…» named ${JSON.stringify(crumbs.label)}`);
  if (crumbs.visible < 6 || crumbs.ellipsis) failures.push(`breadcrumbs did not stay expanded: ${JSON.stringify(crumbs)}`);
  // A selected segment at scheme=secondary: appearance default + secondary had
  // no styles -- no fill, the browser's 13.33px text.
  const group = await tab.evaluate(() => {
    const buttons = [...document.querySelectorAll('#group .sf-button')];
    const style = (button) => { const text = button.querySelector('.sf-button-text-container') || button; return {bg: getComputedStyle(button).backgroundColor, size: getComputedStyle(text).fontSize}; };
    return buttons.map(style);
  });
  if (group.length !== 3) failures.push(`button group drew ${group.length} segments`);
  else {
    const selected = group[1];
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(selected.bg)) failures.push(`selected secondary segment has no fill (${selected.bg})`);
    if (selected.size !== group[0].size) failures.push(`selected secondary segment text ${selected.size} against ${group[0].size}`);
  }
  seen = await tab.evaluate(() => {
    const main = document.querySelector('#s .swiper:not(.sf-slider-thumbnails)');
    const css = [...document.querySelectorAll('link[rel=stylesheet]')].map((link) => link.href);
    const parent = document.querySelector('#parent');
    const car = document.querySelector('#car');
    return {
      kbdCss: css.some((href) => /component\/kbd\//.test(href)),
      previewCss: css.some((href) => /component\/file-preview\//.test(href)),
      menuOpen: parent.classList.contains('open') && getComputedStyle(parent.querySelector(':scope > .sf-menu')).display !== 'none',
      slideLabels: [...car.querySelectorAll('.swiper-slide')].map((slide) => slide.getAttribute('aria-label')),
      wrapper: Math.round(car.querySelector('.swiper-wrapper').getBoundingClientRect().height),
      thumbActive: [...document.querySelectorAll('#s .sf-slider-thumbnails .swiper-slide')].findIndex((slide) => slide.classList.contains('swiper-slide-thumb-active')),
      arrows: [...document.querySelectorAll('#s sf-icon-button')].map((button) => button.getAttribute('aria-label')),
    };
  });
  if (!seen.kbdCss) failures.push('<kbd> got no CSS');
  if (!seen.previewCss) failures.push('.sf-file-preview got no CSS');
  if (!seen.menuOpen) failures.push('a menu item written expanded is shut');
  if (JSON.stringify(seen.slideLabels) !== JSON.stringify(['Закат', 'Море'])) failures.push(`slide names replaced: ${seen.slideLabels}`);
  if (seen.wrapper !== 416) failures.push(`carousel wrapper ${seen.wrapper}px in a 416px carousel`);
  if (seen.thumbActive !== 2) failures.push(`the third thumbnail did not move the slider (active ${seen.thumbActive})`);
  if (seen.arrows.join('|') !== 'Предыдущий слайд|Следующий слайд') failures.push(`arrows named ${seen.arrows.join(', ')}`);
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;

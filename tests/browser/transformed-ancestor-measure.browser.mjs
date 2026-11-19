#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Parts that measure themselves keep layout pixels under a transformed
// ancestor (docs hero study 2026-11-19, ui-control control/research/
// 2026-11-19-docs-hero section 9; sf-segmented 1.8.1, sf-tabs 1.4.7):
//   - sf-segmented, rendered untransformed and inside scale(.7), rotate(-14deg)
//     and perspective(200rem) rotateX(24deg) rotateZ(-14deg), ltr and rtl: the
//     plate variables --sf-button-group--plate-x, -y, -inline-size and
//     -block-size equal the selected segment's offset box within 1 px, and on
//     the screen the plate covers its segment within 1 px;
//   - sf-tabs overflow="more" in rows of four widths, rendered the same four
//     ways: every transformed row makes the «Ещё» decision of its
//     untransformed twin (the same tabs in the row, the same count in «Ещё»).
// 1.8.0 measured with getBoundingClientRect: inside rotate(-14deg) the plate
// stood 21 px below its segment, inside scale(.7) at 70 % of its size; sf-tabs
// 1.4.6 put more tabs into «Ещё» inside rotate().
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'component/component/button-group/css/button-group.css',
  'component/component/tabs/css/tabs.css', 'component/component/context-menu/css/context-menu.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'component/component/button-group/js/button-group.js', 'smart/smart/segmented/js/segmented.js', 'smart/smart/menu-context/js/menu-context.js',
  'smart/smart/tabs/js/tabs.js'];
const STAGES = {none: 'none', scale: 'scale(.7)', rotate: 'rotate(-14deg)', perspective: 'perspective(200rem) rotateX(24deg) rotateZ(-14deg)'};
const SEGMENTS = JSON.stringify([{value: 'd', label: 'День'}, {value: 'w', label: 'Неделя'}, {value: 'm', label: 'Месяц'}, {value: 'y', label: 'Год'}]);
const TABS = 'Обзор|Параметры|Доступ|История изменений|Журнал|Интеграции|Уведомления|Связи';
const ROOMS = Array.from({length: 13}, (_, at) => 300 + at * 25);

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({name: 'page error', said: error.message}); });
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  const stage = (name, transform, dir) => `<section class="stage" data-stage="${name}" dir="${dir}" style="inline-size:600px;padding:16px">
    <div style="transform:${transform};transform-origin:50% 0;display:flex;flex-direction:column;align-items:flex-start;gap:12px">
      <sf-segmented class="seg" style="inline-size:256px" appearance="track" aria-label="Период" value="w" items='${SEGMENTS}'></sf-segmented>
      <sf-segmented class="seg" size="1/2" appearance="track" aria-label="Период" value="m" items='${SEGMENTS}'></sf-segmented>
      ${ROOMS.map((room) => `<div class="room" data-room="${room}" style="inline-size:${room}px"><sf-tabs overflow="more" aria-label="Разделы" items="${TABS}" active-index="1"></sf-tabs></div>`).join('')}
    </div></section>`;
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:0;display:flex;flex-wrap:wrap">
    ${['ltr', 'rtl'].map((dir) => Object.entries(STAGES).map(([name, transform]) => stage(name, transform, dir)).join('')).join('')}
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'}).catch(() => {});
  const stages = Object.keys(STAGES).length * 2;
  await page.waitForFunction(({count, rows}) => document.querySelectorAll('.seg > .sf-button-group[data-plate]').length === count * 2
    && document.querySelectorAll('sf-tabs .sf-tabs-more').length === count * rows, {count: stages, rows: ROOMS.length}, {timeout: 15000});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const read = await page.evaluate(() => [...document.querySelectorAll('.stage')].map((section) => ({
    stage: section.dataset.stage,
    dir: section.getAttribute('dir'),
    plates: [...section.querySelectorAll('.seg')].map((host) => {
      const root = host.querySelector(':scope > .sf-button-group');
      const plate = root.querySelector(':scope > .sf-button-group-plate');
      const active = root.querySelector(':scope > .sf-button-group-segment.active');
      const value = (name) => parseFloat(plate.style.getPropertyValue(`--sf-button-group--plate-${name}`));
      const rtl = getComputedStyle(root).direction === 'rtl';
      const expected = {
        x: rtl ? active.offsetLeft + active.offsetWidth - root.clientWidth : active.offsetLeft,
        y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight,
      };
      const got = {x: value('x'), y: value('y'), w: value('inline-size'), h: value('block-size')};
      const a = plate.getBoundingClientRect();
      const b = active.getBoundingClientRect();
      return {
        parent: active.offsetParent === root,
        delta: Math.max(...Object.keys(expected).map((key) => Math.abs(got[key] - expected[key]))),
        screen: Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom)),
        got, expected,
      };
    }),
    rows: [...section.querySelectorAll('.room')].map((room) => {
      const tabs = room.querySelector('sf-tabs');
      const kept = [...tabs.querySelectorAll('[role="tab"]')].filter((tab) => !tab.closest('.sf-tabs-overflowed')).map((tab) => tab.textContent.trim());
      return `${room.dataset.room}: ${tabs.querySelector('[data-sf-tabs-more]') ? 'more' : 'row'} ${kept.join(', ')}`;
    }),
  })));

  for (const entry of read) {
    entry.plates.forEach((plate, at) => {
      if (!plate.parent) note({name: 'the track is the segment\'s offsetParent', stage: entry.stage, dir: entry.dir, at});
      if (!(plate.delta <= 1)) note({name: 'the plate variables are the segment\'s offset box within 1 px', stage: entry.stage, dir: entry.dir, at, got: plate.got, expected: plate.expected});
      if (!(plate.screen <= 1)) note({name: 'on the screen the plate covers its segment within 1 px', stage: entry.stage, dir: entry.dir, at, screen: plate.screen});
    });
    const twin = read.find((other) => other.stage === 'none' && other.dir === entry.dir);
    if (entry.stage !== 'none' && JSON.stringify(entry.rows) !== JSON.stringify(twin.rows)) {
      note({name: 'sf-tabs makes the «Ещё» decision of its untransformed twin', stage: entry.stage, dir: entry.dir, rows: entry.rows, untransformed: twin.rows});
    }
  }
  const none = read.find((entry) => entry.stage === 'none' && entry.dir === 'ltr');
  if (!none.rows.some((row) => row.includes(' more '))) note({name: 'at least one row lays out with «Ещё» (the test must reach the decision)', rows: none.rows});
  console.log(JSON.stringify(read.map((entry) => ({stage: entry.stage, dir: entry.dir, plates: entry.plates.map((plate) => [plate.delta, Math.round(plate.screen * 10) / 10]), rows: entry.rows}))));
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TRANSFORMED_ANCESTOR_MEASURE_OK');

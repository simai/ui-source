#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// C59 stage S1 (owner decision 2026-11-11): sf-popover in the browser's top
// layer on one positioning engine. The prototype's popover scenes
// (control/research/2026-11-11-popover.md, prototypes/popover.html) on the
// component: a popover inside an overflow: hidden, contain: paint box and
// inside a scroll container is not clipped and follows its trigger; near all
// four window edges it flips and shifts and stays on screen; RTL mirrors it;
// the optional arrow points at the trigger and carries the panel's shadow
// (a drop-shadow filter, not a box-shadow); a dialog surface takes the focus,
// Tab goes on into it, Escape closes it and gives the focus back, a press
// outside closes it (mouse and touch); a window opened above it is drawn over
// it. Each at 1440 and 390, light and dark, LTR and RTL, by CSS anchor
// positioning and by the script (<html data-sf-position-engine="script">),
// three loads each, the console clean; then a first paint with the popover's
// sheet held back.
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const LOADS = Number(process.env.POPOVER_LOADS || 3);

const body = `
<div style="padding:40px 24px">
  <div id="clip" style="position:relative;overflow:hidden;contain:paint;block-size:120px;inline-size:280px;border:1px dashed">
    <sf-popover id="pc" label="Доступ к проекту" placement="bottom-start" width="20rem">
      <button slot="trigger" id="tc" type="button">Доступ</button>
      <div slot="content" id="cc" style="padding:16px"><strong>Доступ к проекту</strong>
        <p style="margin:4px 0">Пригласите коллег по почте. Они увидят все страницы проекта.</p><a href="#" id="link">Как работают роли</a>
        <p><button type="button" id="open-modal">Пригласить</button></p></div>
    </sf-popover>
  </div>
  <div id="scroller" style="overflow:auto;block-size:200px;inline-size:280px;margin-block-start:24px;border:1px dashed">
    <div style="block-size:800px;padding-block-start:120px;padding-inline-start:16px">
      <sf-popover id="ps" label="В прокрутке" placement="bottom-start" offset="var(--sf-space-1\\/4)">
        <button slot="trigger" id="ts" type="button">В прокрутке</button>
        <div slot="content" id="cs" style="padding:8px;inline-size:180px">Панель в прокрутке</div>
      </sf-popover>
    </div>
  </div>
  <div style="display:grid;place-items:center;block-size:220px">
    <sf-popover id="pa" label="Со стрелкой" placement="bottom" arrow>
      <button slot="trigger" id="ta" type="button">Со стрелкой</button>
      <div slot="content" id="ca" style="padding:16px;inline-size:200px">Стрелка указывает на кнопку</div>
    </sf-popover>
  </div>
  <div style="block-size:1200px"></div>
</div>
${[['tl', 'top:4px;inset-inline-start:4px', 'top-start'], ['tr', 'top:4px;inset-inline-end:4px', 'bottom-start'],
    ['bl', 'bottom:4px;inset-inline-start:4px', 'bottom-end'], ['br', 'bottom:4px;inset-inline-end:4px', 'end']]
    .map(([id, at, placement]) => `<div style="position:fixed;${at};z-index:1"><sf-popover id="p-${id}" label="Угол ${id}" placement="${placement}" width="300px">
  <button slot="trigger" id="t-${id}" type="button">Угол</button><div slot="content" id="c-${id}" style="padding:12px">Панель у края окна шириной 300px</div></sf-popover></div>`).join('')}
<sf-modal id="modal" title="Пригласить"><div slot="content">Окно над поповером</div></sf-modal>`;

async function open(browser, {viewport, theme = 'light', dir = 'ltr', engine = 'auto', touch = false, hold = 0}) {
  const context = await browser.newContext({viewport, hasTouch: touch, isMobile: touch});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" dir="${dir}" class="theme-${theme}"${engine === 'script' ? ' data-sf-position-engine="script"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'probe', pluginListVersion: 'probe', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = product === 'rule' ? join(out, 'core', 'rule', ...rest) : join(out, product, product, ...rest);
    if (hold && /\/popover\/css\//u.test(url.pathname)) await new Promise((done) => setTimeout(done, hold));
    if (existsSync(file) && statSync(file).isFile()) return route.fulfill({status: 200, contentType: types[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
    return route.fulfill({status: 404, body: ''});
  });
  page.errors = errors;
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => ['sf-popover', 'sf-modal'].every((tag) => customElements.get(tag)), null, {timeout: 20000});
  return {page, context};
}

const frames = (page, count = 3) => page.evaluate((n) => new Promise((done) => {
  const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : done()); step(n);
}), count);

// Everything one open surface says about itself.
const read = (page, id) => page.evaluate((id) => {
  const host = document.getElementById(`p${id}`) || document.getElementById(`p-${id}`);
  const surface = host.querySelector(':scope > [slot="content"]');
  const trigger = host.querySelector(':scope > [slot="trigger"]');
  const s = surface.getBoundingClientRect();
  const t = trigger.getBoundingClientRect();
  const css = getComputedStyle(surface);
  const arrow = getComputedStyle(surface, '::before');
  const px = (value) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
    host.parentElement.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  return {
    open: host.open, topLayer: surface.matches(':popover-open'), side: surface.dataset.sfSide || null,
    engine: host._anchor?.engine || null, positionArea: surface.style.getPropertyValue('position-area'),
    s: {left: s.left, right: s.right, top: s.top, bottom: s.bottom, width: s.width, height: s.height},
    t: {left: t.left, right: t.right, top: t.top, bottom: t.bottom, width: t.width, height: t.height},
    viewport: {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
    scrollWidth: document.documentElement.scrollWidth,
    hit: (() => { const x = s.left + s.width / 2; const y = s.bottom - 4; const at = document.elementFromPoint(x, y); return Boolean(at && surface.contains(at)); })(),
    active: document.activeElement === surface ? 'surface' : document.activeElement?.id || document.activeElement?.tagName,
    expanded: trigger.getAttribute('aria-expanded'),
    boxShadow: css.boxShadow, filter: css.filter, background: css.backgroundColor,
    arrow: {content: arrow.content, background: arrow.backgroundColor, x: parseFloat(surface.style.getPropertyValue('--sf-position-arrow-x')), left: parseFloat(arrow.left), width: parseFloat(arrow.width)},
    gapArrow: px('var(--sf-space-1\\/2)'), gapQuarter: px('var(--sf-space-1\\/4)'),
    // Read beside the host, not inside the surface: inside a popup place the
    // token names the nested popup's step.
    popup: (() => { const probe = document.createElement('span'); probe.style.background = 'var(--sf-surface-popup)'; host.parentElement.append(probe); const v = getComputedStyle(probe).backgroundColor; probe.remove(); return v; })(),
  };
}, id);

const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance;
const onScreen = (got) => got.s.left >= -0.5 && got.s.top >= -0.5 && got.s.right <= got.viewport.width + 0.5 && got.s.bottom <= got.viewport.height + 0.5;

async function scenes(browser, config, load) {
  const where = {...config, viewport: `${config.viewport.width}`, load};
  const {page, context} = await open(browser, config);
  const press = (selector) => (config.touch ? page.tap(selector) : page.click(selector));
  try {
    await page.waitForTimeout(300);
    const rtl = config.dir === 'rtl';

    // 1. The rich popover in a clipping box: top layer, not clipped, focus in.
    await press('#tc');
    await frames(page, 4);
    let got = await read(page, 'c');
    if (!got.open || !got.topLayer) note({where, case: 'the open surface stands in the top layer', got: {open: got.open, topLayer: got.topLayer}});
    if (!got.hit) note({where, case: 'a box with overflow: hidden and contain: paint does not clip it: its bottom edge is hit-tested on the surface', got: got.s});
    if (got.expanded !== 'true') note({where, case: 'the trigger says aria-expanded', got: got.expanded});
    const wantEngine = config.engine === 'script' ? 'script' : 'css';
    if (got.engine !== wantEngine) note({where, case: `the engine is ${wantEngine}`, got: got.engine});
    if (wantEngine === 'css' && !got.positionArea) note({where, case: 'CSS anchor positioning writes position-area', got: got.positionArea});
    if (onScreen(got)) {
      const aligned = rtl ? near(got.s.right, got.t.right) : near(got.s.left, got.t.left);
      if (got.side === 'block-end' && (!aligned || !near(got.s.top, got.t.bottom))) note({where, case: 'with room, bottom-start hangs from the trigger\'s start corner (mirrored in RTL)', got: {s: got.s, t: got.t, side: got.side}});
    } else note({where, case: 'the rich popover is on screen', got});
    if (got.active !== 'surface') note({where, case: 'a dialog surface takes the focus as it opens', got: got.active});
    if (!config.touch) {
      await page.keyboard.press('Tab');
      const tabbed = await page.evaluate(() => document.activeElement?.id);
      if (tabbed !== 'link') note({where, case: 'Tab from the surface goes into its content', got: tabbed});
      await page.keyboard.press('Escape');
      await frames(page, 2);
      const after = await page.evaluate(() => ({open: document.getElementById('pc').open, active: document.activeElement?.id, layer: document.getElementById('cc').matches(':popover-open'), inline: document.getElementById('cc').style.position}));
      if (after.open || after.active !== 'tc' || after.layer || after.inline) note({where, case: 'Escape closes it, takes it out of the top layer and returns focus to the trigger', got: after});
      // Keyboard opening: Enter on the trigger.
      await page.focus('#tc');
      await page.keyboard.press('Enter');
      await frames(page, 3);
      const keyed = await read(page, 'c');
      if (!keyed.open || keyed.active !== 'surface') note({where, case: 'Enter on the trigger opens it and focus moves in', got: {open: keyed.open, active: keyed.active}});
    }

    // 2. A window opened from it is drawn over it; it comes back when it closes.
    await page.evaluate(() => document.getElementById('modal').setAttribute('open', ''));
    await page.waitForTimeout(500);
    const under = await page.evaluate(() => {
      const surface = document.getElementById('cc');
      const r = surface.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(20, r.height / 2));
      return {stillOpen: document.getElementById('pc').open, topLayer: surface.matches(':popover-open'), covered: !surface.contains(at)};
    });
    if (!under.stillOpen || under.topLayer || !under.covered) note({where, case: 'a window opened above it steps it down from the top layer and covers it', got: under});
    await page.evaluate(() => document.getElementById('modal').removeAttribute('open'));
    await page.waitForFunction(() => !document.getElementById('modal').hasAttribute('open'), null, {timeout: 5000});
    await page.waitForTimeout(500);
    const back = await read(page, 'c');
    if (back.open && !back.topLayer) note({where, case: 'the window closed, the surface is back in the top layer', got: {open: back.open, topLayer: back.topLayer}});

    // 3. A press outside closes it (mouse or touch), reason outside.
    if (!back.open) await press('#tc');
    await frames(page, 3);
    await page.evaluate(() => { window.reasons = []; document.getElementById('pc').addEventListener('sf-popover-closed', (event) => window.reasons.push(event.detail.reason)); });
    if (config.touch) await page.touchscreen.tap(config.viewport.width - 10, config.viewport.height / 2 + 40);
    else await page.mouse.click(config.viewport.width - 10, config.viewport.height / 2 + 40);
    await frames(page, 2);
    const outside = await page.evaluate(() => ({open: document.getElementById('pc').open, reasons: window.reasons}));
    if (outside.open || outside.reasons.join() !== 'outside') note({where, case: 'a press outside closes it with reason outside', got: outside});

    // 4. A scroll container: it follows its trigger and is not clipped.
    await press('#ts');
    await frames(page, 3);
    const before = await read(page, 's');
    // The press may have scrolled the trigger into view first: the move is
    // the container's own change, read on both sides (instant: the page's
    // scrolling is smooth).
    const scrolledBy = await page.evaluate(() => { const box = document.getElementById('scroller'); const from = box.scrollTop; box.scrollTo({top: from + 60, behavior: 'instant'}); return box.scrollTop - from; });
    await frames(page, 4);
    const scrolled = await read(page, 's');
    const gapBefore = before.s.top - before.t.bottom;
    const gapAfter = scrolled.s.top - scrolled.t.bottom;
    if (!scrolled.topLayer || !near(gapBefore, before.gapQuarter) || !near(gapAfter, gapBefore) || scrolledBy < 30 || !near(scrolled.t.top, before.t.top - scrolledBy)) {
      note({where, case: 'inside a scroll container it keeps its gap (offset 1/4) to the trigger as the container scrolls', got: {gapBefore, gapAfter, gap: before.gapQuarter, moved: before.t.top - scrolled.t.top, scrolledBy, side: scrolled.side}});
    }
    await press('#ts');
    await frames(page, 2);

    // 5. The arrow: at the trigger's centre, with the panel's shadow.
    await page.evaluate(() => document.getElementById('ta').scrollIntoView({block: 'center'}));
    await press('#ta');
    await frames(page, 4);
    got = await read(page, 'a');
    const centre = got.t.left + got.t.width / 2;
    const arrowCentre = got.s.left + got.arrow.left + got.arrow.width / 2;
    if (got.arrow.content === 'none' || !near(arrowCentre, centre, 1.5)) note({where, case: 'the arrow stands at the trigger\'s centre', got: {arrowCentre, centre, arrow: got.arrow}});
    if (got.arrow.background !== got.background) note({where, case: 'the arrow has the surface\'s fill', got: {arrow: got.arrow.background, surface: got.background}});
    if (got.boxShadow !== 'none' || !/drop-shadow/u.test(got.filter)) note({where, case: 'with an arrow the overlay shadow is a drop-shadow filter over panel and arrow', got: {boxShadow: got.boxShadow, filter: got.filter}});
    if (got.side !== 'block-end' || !near(got.s.top - got.t.bottom, got.gapArrow)) note({where, case: 'with an arrow and no offset the gap is space 1/2', got: {gap: got.s.top - got.t.bottom, want: got.gapArrow, side: got.side}});
    if (!near(got.s.left + got.s.width / 2, centre)) note({where, case: 'placement bottom centres it on the trigger', got: {surface: got.s, centre}});
    if (got.background !== got.popup) note({where, case: 'the surface is on the popup place', got: {background: got.background, popup: got.popup}});
    await press('#ta');
    await frames(page, 2);

    // 6. Four window edges: it flips and shifts, and stays on screen.
    for (const [id, side] of [['tl', 'block-end'], ['tr', 'block-end'], ['bl', 'block-start'], ['br', null]]) {
      await press(`#t-${id}`);
      await frames(page, 4);
      got = await read(page, id);
      const overlaps = got.s.left < got.t.right - 0.5 && got.s.right > got.t.left + 0.5 && got.s.top < got.t.bottom - 0.5 && got.s.bottom > got.t.top + 0.5;
      if (!onScreen(got) || overlaps || got.scrollWidth > got.viewport.width) note({where, case: `corner ${id}: on screen, beside the trigger, no sideways scroll`, got: {s: got.s, t: got.t, viewport: got.viewport, side: got.side, engine: got.engine}});
      if (side && got.side !== side) note({where, case: `corner ${id}: it took the side with room`, got: got.side, expected: side});
      if (id === 'br' && !got.side) note({where, case: 'corner br: the side it took is said', got: got.side});
      await press(`#t-${id}`);
      await frames(page, 2);
    }
    if (page.errors.length) note({where, case: 'console clean', errors: page.errors});
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (let load = 1; load <= LOADS; load += 1) {
    for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
      for (const theme of ['light', 'dark']) {
        for (const dir of ['ltr', 'rtl']) {
          for (const engine of ['auto', 'script']) await scenes(browser, {viewport, theme, dir, engine}, load);
        }
      }
      await scenes(browser, {viewport, theme: 'light', dir: 'ltr', engine: 'auto', touch: true}, load);
    }
    // Timing-hostile first paint: the popover's sheet arrives 1.5 s late; the
    // trigger is pressed the moment the element is defined.
    for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
      const {page, context} = await open(browser, {viewport, hold: 1500});
      try {
        await page.click('#tc');
        const early = await page.evaluate(() => ({open: document.getElementById('pc').open}));
        await page.waitForTimeout(2500);
        await frames(page, 3);
        const got = await read(page, 'c');
        const where = {hostile: true, viewport: viewport.width, load};
        if (!got.open || !got.topLayer || !onScreen(got) || !near(got.s.top, got.t.bottom) || !near(got.s.left, got.t.left) || !near(got.s.width, 320, 1)) {
          note({where, case: 'opened before its sheet arrived, it stands where its placement says once the sheet is there', got: {early, open: got.open, topLayer: got.topLayer, s: got.s, t: got.t}});
        }
        if (page.errors.length) note({where, case: 'console clean', errors: page.errors});
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log(`popover-top-layer: ${LOADS} loads x (1440, 390) x (light, dark) x (ltr, rtl) x (css, script) + touch + hostile first paint, all scenes pass`);

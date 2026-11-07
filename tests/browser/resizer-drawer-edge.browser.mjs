#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-resizer in sf-drawer stands on the panel's real edge (simai/ui-source#59).
// .sf-drawer-panel scrolls (overflow: hidden auto) and keeps a scrollbar's
// room on both sides (scrollbar-gutter: stable both-edges). The handle is
// positioned against the panel's padding box, which stops that room short of
// each edge, and moves with what scrolls: with classic scrollbars a 320px
// panel had its handle centred at 305px, its line a second line beside the
// panel's border, and a scrolled panel took the handle up with its rows.
// A panel holding a handle now scrolls its body. Here, with classic
// scrollbars (the headless shell's --hide-scrollbars taken off, so the gutter
// is real), the handle's centre is within 1px of the panel's border edge
// before and after the content is scrolled, it spans the panel's height, the
// content keeps the inset it has in a drawer without a handle, and a drag by
// the handle -- its outer half, past the scrollbar -- changes the width: for a panel on
// the inline start (handle at its end) and one on the inline end (handle at
// its start, edge="inline-start"), light and dark.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const required = ['core/core/js/core.js', 'core/core/css/core.css', 'smart/smart/drawer/js/drawer.js', 'smart/smart/resizer/js/resizer.js'];
const absent = required.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`asset(s) not found under ${out}: ${absent.join(', ')}`);

const rows = Array.from({length: 60}, (_, at) => `<p style="margin:0 0 8px">Строка ${at + 1}</p>`).join('');
const body = `
  <sf-drawer id="start" docked open modal="false" placement="inline-start" width="var(--w, 20rem)" title="Письма">
    <div>${rows}</div>
    <sf-resizer id="start-handle" target=".sf-drawer-panel" property="--w" min="240px" max="480px"></sf-resizer>
  </sf-drawer>
  <sf-drawer id="end" docked open modal="false" placement="inline-end" width="var(--v, 20rem)" title="Свойства">
    <div>${rows}</div>
    <sf-resizer id="end-handle" edge="inline-start" target=".sf-drawer-panel" property="--v" min="240px" max="480px"></sf-resizer>
  </sf-drawer>
  <main style="padding:24px">Холст</main>`;

const failures = [];
const note = (detail) => failures.push(detail);
const measures = {};
// The headless shell hides scrollbars; a scrollbar that takes room is what the
// fault needs.
const browser = await chromium.launch({ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 1280, height: 700}});
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.route('http://probe.test/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') {
        return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
          <link rel="stylesheet" href="/distr/core/css/core.css">
          <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
          <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
      }
      const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
      const file = join(out, product, product, ...rest);
      return existsSync(file)
        ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
        : route.fulfill({status: 404, body: ''});
    });
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => customElements.get('sf-drawer') && customElements.get('sf-resizer')
      && document.querySelector('[data-sf-drawer-portal="start"] sf-resizer') && document.querySelector('[data-sf-drawer-portal="end"] sf-resizer'), null, {timeout: 15000});
    await page.waitForTimeout(800);

    const read = (id) => page.evaluate((key) => {
      const handle = document.getElementById(`${key}-handle`);
      const panel = handle.closest('.sf-drawer-panel');
      const p = panel.getBoundingClientRect();
      const h = handle.getBoundingClientRect();
      const end = key === 'start';
      // Whichever of the panel and its body scrolls.
      const body = panel.querySelector(':scope > .sf-drawer-body');
      const scroller = /auto|scroll/u.test(getComputedStyle(body).overflowY) ? body : panel;
      const row = body.querySelector('p').getBoundingClientRect();
      return {
        scroller: scroller === body ? 'body' : 'panel',
        text: Math.round(end ? row.left - p.left : p.right - row.right),
        panel: {left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width},
        gutter: scroller.offsetWidth - scroller.clientWidth - (parseFloat(getComputedStyle(scroller).borderLeftWidth) || 0) - (parseFloat(getComputedStyle(scroller).borderRightWidth) || 0),
        scrollTop: scroller.scrollTop,
        centre: h.left + h.width / 2,
        edge: end ? p.right : p.left,
        off: Math.round(((h.left + h.width / 2) - (end ? p.right : p.left)) * 10) / 10,
        top: Math.round(h.top - p.top),
        bottom: Math.round(p.bottom - h.bottom),
      };
    }, id);

    for (const id of ['start', 'end']) {
      const at = `${id} ${theme}`;
      const before = await read(id);
      // The content keeps the inset it has in a drawer without a handle: the
      // scrollbar's room on both sides plus the gutter.
      const plain = await page.evaluate((key) => {
        const panel = document.getElementById(`${key}-handle`).closest('.sf-drawer-panel');
        const handle = document.getElementById(`${key}-handle`);
        const parent = handle.parentElement;
        handle.remove();
        const p = panel.getBoundingClientRect();
        const row = panel.querySelector('.sf-drawer-body p').getBoundingClientRect();
        const text = Math.round(key === 'start' ? row.left - p.left : p.right - row.right);
        parent.append(handle);
        return text;
      }, id);
      await page.waitForTimeout(200);
      if (Math.abs(plain - before.text) > 1) note({case: `${at}: the content keeps the inset of a drawer without a handle`, got: {plain, withHandle: before.text}});
      if (!(before.gutter > 0)) note({case: `${at}: the panel keeps a scrollbar's room (the case needs classic scrollbars)`, got: before});
      if (Math.abs(before.off) > 1) note({case: `${at}: the handle is centred on the panel's edge`, got: before});
      if (Math.abs(before.top) > 1 || Math.abs(before.bottom) > 1) note({case: `${at}: the handle spans the panel`, got: before});
      await page.evaluate((key) => {
        const panel = document.getElementById(`${key}-handle`).closest('.sf-drawer-panel');
        const body = panel.querySelector(':scope > .sf-drawer-body');
        (/auto|scroll/u.test(getComputedStyle(body).overflowY) ? body : panel).scrollTop = 400;
      }, id);
      await page.waitForTimeout(150);
      const scrolled = await read(id);
      if (scrolled.scrollTop < 100) note({case: `${at}: the panel scrolls`, got: scrolled});
      if (Math.abs(scrolled.off) > 1) note({case: `${at}: a scrolled panel keeps the handle on its edge`, got: scrolled});
      if (Math.abs(scrolled.top) > 1 || Math.abs(scrolled.bottom) > 1) note({case: `${at}: a scrolled panel keeps the handle along its height`, got: scrolled});
      // A drag by the handle still changes the width.
      const y = Math.round((scrolled.panel.top + scrolled.panel.bottom) / 2);
      const x = Math.round(scrolled.centre);
      const towards = id === 'start' ? 40 : -40;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + towards / 2, y, {steps: 4});
      await page.mouse.move(x + towards, y, {steps: 4});
      await page.mouse.up();
      await page.waitForTimeout(150);
      const dragged = await read(id);
      if (Math.abs(dragged.panel.width - scrolled.panel.width - 40) > 2) note({case: `${at}: a drag by the handle widens the panel by the drag`, got: {before: scrolled.panel.width, after: dragged.panel.width}});
      if (Math.abs(dragged.off) > 1) note({case: `${at}: after a drag the handle is on the new edge`, got: dragged});
      measures[at] = {before, scrolled, dragged};
    }
    if (errors.length) note({case: `no page errors (${theme})`, errors});
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({measures}, null, 1));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('RESIZER_DRAWER_EDGE_OK');

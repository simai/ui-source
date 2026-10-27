#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-pagination in a narrow column on a wide screen (owner, 2026-10-19). In a
// column about 26rem wide «Показать ещё» lay over «Последняя» and took its
// clicks: the page row did not wrap, and the screen-width query that stacks it
// never applies on a wide screen. Measured on the built bytes, with Show more,
// first/previous, the page field, next/last and the page size, in columns of
// 26rem, 20rem and 60rem on a 1440px window:
//   - no two interactive controls overlap;
//   - every control lies wholly inside the column;
//   - every control is what a click at its centre reaches (elementFromPoint is
//     the control or something inside it);
//   - every button keeps the height of its size step (tap targets do not shrink);
//   - at 60rem the row is still one line.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/inputs/css/inputs.css',
  'component/component/pagination/css/pagination.css', 'component/component/dropdown/css/dropdown.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js', 'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/pagination/js/pagination.js'];
const WIDTHS = ['26rem', '20rem', '60rem'];

const failures = [];
const evidence = {};
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const origin = 'http://probe.test';
    const serve = (path, route) => (existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''}));
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
      // The Loader asks <sfPath><product>/...; sfPath below is /distr/.
      const distr = url.pathname.match(/^\/distr\/([^/]+)\/(.+)$/u);
      if (distr) return serve(join(out, distr[1], distr[1], distr[2]), route);
      return serve(join(out, url.pathname), route);
    });
    await page.goto(`${origin}/`);
    await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
      <div id="column" style="width:${width};border:1px solid #ccc">
        <sf-pagination id="p" total="450" page-size="20" current="5" top></sf-pagination>
      </div></body></html>`);
    await page.evaluate(() => { window.sfPath = '/distr/'; });
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => customElements.get('sf-pagination')
      && document.querySelector('#p .sf-pagination-more button')
      && document.querySelector('#p .sf-pagination-direction--last button')
      && document.querySelector('#p .sf-pagination-count .sf-dropdown-field, #p .sf-pagination-count sf-dropdown'), null, {timeout: 10000});
    await page.waitForTimeout(500);

    const got = await page.evaluate(() => {
      const column = document.querySelector('#column').getBoundingClientRect();
      const root = document.querySelector('#p');
      const named = (node) => node.getAttribute('aria-label') || node.textContent.trim().replace(/\s+/gu, ' ') || node.tagName.toLowerCase();
      const visible = (node) => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      // The controls a person clicks: buttons, the page field and the page-size field.
      const controls = [...root.querySelectorAll('button, input, .sf-dropdown-field, [role="combobox"]')]
        .filter(visible)
        .filter((node, index, all) => !all.some((other) => other !== node && other.contains(node)));
      const boxes = controls.map((node) => {
        const box = node.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          name: named(node),
          left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          height: Math.round(box.height * 100) / 100, width: Math.round(box.width * 100) / 100,
          inside: box.left >= column.left - 0.5 && box.right <= column.right + 0.5,
          reachable: Boolean(hit && (hit === node || node.contains(hit))),
          hit: hit ? (hit.className || hit.tagName) : null,
          isButton: node.tagName === 'BUTTON',
        };
      });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 0.5 && h > 0.5) overlaps.push([a.name, b.name, Math.round(w), Math.round(h)]);
        }
      }
      const main = root.querySelector('.sf-pagination-main');
      // Parts of one line share its middle (the row centres them).
      const tops = new Set([...main.children].filter(visible).map((child) => { const box = child.getBoundingClientRect(); return Math.round(box.top + box.height / 2); }));
      return {column: Math.round(column.width), controls: boxes, overlaps, lines: tops.size,
        scrollOverflow: main.scrollWidth - main.clientWidth};
    });
    // A tap target is as tall as its size step: the same as a lone button of the step.
    const reference = await page.evaluate(async () => {
      const probe = document.createElement('sf-button');
      probe.setAttribute('text', 'x');
      document.body.append(probe);
      await new Promise((done) => setTimeout(done, 300));
      const height = probe.querySelector('button')?.getBoundingClientRect().height ?? 0;
      probe.remove();
      return height;
    });
    evidence[width] = {column: got.column, lines: got.lines, controls: got.controls.map(({name, width: w, height, inside, reachable}) => ({name, w, height, inside, reachable})), overlaps: got.overlaps};
    if (got.controls.length < 6) failures.push({width, case: 'all controls drawn (show more, first, prev, field, next, last, page size)', count: got.controls.length});
    if (got.overlaps.length) failures.push({width, case: 'no two controls overlap', overlaps: got.overlaps});
    for (const control of got.controls) {
      if (!control.inside) failures.push({width, case: 'control wholly inside the column', control: control.name, left: control.left, right: control.right});
      if (!control.reachable) failures.push({width, case: 'a click at the centre reaches the control', control: control.name, hit: control.hit});
      if (control.isButton && control.height + 0.5 < reference && !/sf-page-number/u.test(control.name)) {
        failures.push({width, case: 'a button keeps the height of its step', control: control.name, height: control.height, reference});
      }
    }
    if (got.scrollOverflow > 0) failures.push({width, case: 'the row does not overflow', by: got.scrollOverflow});
    if (width === '60rem' && got.lines !== 1) failures.push({width, case: 'a wide column keeps one line', lines: got.lines});
    // The click itself: «Последняя» goes to the last page.
    const lastWent = await page.evaluate(async () => {
      const root = document.querySelector('#p');
      const button = root.querySelector('.sf-pagination-direction--last button');
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      hit?.click();
      await new Promise((done) => setTimeout(done, 300));
      return Number(root.getAttribute('current') ?? root.current);
    });
    if (lastWent !== 23) failures.push({width, case: '«Последняя» takes a click at its centre', current: lastWent});
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({evidence, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('PAGINATION_NARROW_OK');

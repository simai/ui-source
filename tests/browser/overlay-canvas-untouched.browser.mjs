#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build/output
//
// sf-editor-overlay is a pure overlay: whatever a person does with it, the
// canvas it edits keeps the HTML SF.Composition.render wrote, byte for byte --
// a host saves the canvas or diffs it against its model, and a stray attribute
// would be saved into the page. Moved here from the lab probe
// composition-overlay (2026-11-09), which only a served lab ran: the canvas
// changed for several pairs while every release check was green (a modal
// drawer closing with nothing focused gave the canvas's own <main> the focus
// and a temporary tabindex; core.runtime 1.48.0).
//
// On the built bytes, in the light and the dark theme, three loads each, with
// the mouse and the keyboard (no dispatched events):
// - hover, a click on a block, a click on a link inside a block, a toolbar
//   action, the «+» at a seam and its press, the tree by keyboard (Tab, Home,
//   arrows, Enter into the toolbar, Escape back, Escape to clear);
// - a modal sf-drawer opened while nothing has focus, closed by Escape, and
//   opened again from the page and closed by its close button;
// - five remounts of the overlay;
// after each step the canvas HTML equals what render wrote, and once the
// overlay is removed from the page it still does. No page error, no console
// error, no failed request.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const name of ['core', 'smart', 'component', 'utility']) if (!existsSync(parts[name])) throw new Error(`the output has no ${name}: ${parts[name]}`);
const model = readFileSync(fileURLToPath(new URL('../fixtures/composition/regions-lab.json', import.meta.url)), 'utf8');

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},theme:false};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:var(--sf-space-2);background:var(--sf-surface-1);color:var(--sf-on-surface)} #canvas{padding-block:3rem}</style>
</head><body>
  <button id="opener" type="button">Публикация</button>
  <sf-editor-overlay id="overlay" for="canvas"></sf-editor-overlay>
  <div id="canvas"></div>
  <sf-drawer id="drawer" label="Публикация">Подтверждение</sf-drawer>
  <script>
    window.addEventListener('load', async () => {
      const model = ${model};
      const rendered = await window.SF.Composition.render(model);
      document.getElementById('canvas').innerHTML = rendered.html;
      window.rendered = rendered.html;
      const names = {'layout.regions': 'Раскладка', 'layout.region': 'Область', 'content.heading': 'Заголовок', 'content.paragraph': 'Абзац'};
      await customElements.whenDefined('sf-editor-overlay');
      const overlay = document.getElementById('overlay');
      overlay.attach(document.getElementById('canvas'));
      overlay.setDocument(model, {describe: (node) => ({label: (names[node.type] || node.type) + ' ' + node.id, badges: []})});
      overlay.setActions([{id: 'move-up', label: 'Выше'}, {id: 'move-down', label: 'Ниже'}, {id: 'remove', label: 'Удалить'}]);
      await customElements.whenDefined('sf-drawer');
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      document.documentElement.dataset.ready = 'true';
    });
  </script>
</body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      const tab = await browser.newPage({viewport: {width: 1280, height: 800}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      const tag = `${theme} load ${load}`;
      const frame = () => tab.waitForTimeout(80);
      await tab.goto(`${base}/?theme=${theme}`);
      await tab.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, {timeout: 30000});
      const untouched = async (step) => {
        const now = await tab.evaluate(() => {
          const html = document.getElementById('canvas').innerHTML;
          let at = 0;
          while (at < html.length && html[at] === window.rendered[at]) at += 1;
          return html === window.rendered ? null : {at, got: html.slice(Math.max(0, at - 60), at + 60), active: document.activeElement?.outerHTML?.slice(0, 120) ?? null};
        });
        if (now) failures.push({case: `${tag}: the canvas is untouched after ${step}`, ...now});
      };
      await untouched('the first draw');

      await tab.locator('#canvas [data-sf-composition-id="main-lead"]').hover();
      await frame();
      await untouched('hover');
      await tab.locator('#canvas [data-sf-composition-id="link-main"] a').click();
      await frame();
      await untouched('a click on a link in a block');
      await tab.locator('.sf-composition-overlay-action[data-action="move-up"]').click();
      await frame();
      await untouched('a toolbar action');
      const seam = await tab.evaluate(() => {
        const overlay = document.getElementById('overlay');
        const children = overlay.byId.get('shell-main').slots.default;
        // The seam before the fourth child, as a person points at it (lab composition-overlay).
        const before = overlay.nodeBox(children[3]);
        const after = overlay.nodeBox(children[2]);
        const edge = before || after;
        return {x: edge.left + edge.width / 2, y: before && after ? (after.bottom + before.top) / 2 : before ? before.top : after.bottom};
      });
      await tab.mouse.move(seam.x, seam.y);
      await frame();
      const mark = tab.locator('.sf-composition-overlay-insert[data-sf-insert-shown] .sf-composition-overlay-insert-mark');
      if (await mark.count()) await mark.first().click();
      else failures.push({case: `${tag}: the «+» shows at a seam`});
      await frame();
      await untouched('the «+» at a seam');

      await tab.locator('#opener').focus();
      await tab.keyboard.press('Tab');
      for (const key of ['Home', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ArrowRight', 'Escape', 'Escape']) await tab.keyboard.press(key);
      await frame();
      await untouched('the tree by keyboard');

      // A modal drawer opened while nothing has focus: on close, focus goes
      // back to nothing -- not to the canvas's <main>.
      await tab.locator('#canvas [data-sf-composition-id="footer-text"]').click();
      await tab.evaluate(() => { document.activeElement?.blur?.(); document.getElementById('drawer').open(); });
      await tab.waitForTimeout(400);
      await tab.keyboard.press('Escape');
      await tab.waitForTimeout(400);
      await untouched('a modal drawer opened with nothing focused, closed by Escape');
      await tab.locator('#opener').focus();
      await tab.evaluate(() => document.getElementById('drawer').open());
      await tab.waitForTimeout(400);
      await tab.evaluate(() => document.getElementById('drawer').close());
      await tab.waitForTimeout(400);
      if (await tab.evaluate(() => document.activeElement?.id) !== 'opener') failures.push({case: `${tag}: a drawer opened from the page gives focus back to its opener`});
      await untouched('a modal drawer opened from the page');

      await tab.evaluate(async () => {
        const overlay = document.getElementById('overlay');
        for (let index = 0; index < 5; index += 1) { const canvas = document.getElementById('canvas'); overlay.remove(); canvas.before(overlay); }
        await new Promise((done) => requestAnimationFrame(done));
      });
      await untouched('five remounts');
      await tab.evaluate(() => document.getElementById('overlay').remove());
      await frame();
      await untouched('the overlay removed');
      if (errors.length) failures.push({case: `${tag}: no page error, console error or failed request`, got: errors});
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({status: failures.length ? 'failed' : 'passed', failures}, null, 2));
process.exitCode = failures.length ? 1 : 0;

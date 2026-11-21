#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A drawer's box at the end of the body carries what the Smart element around
// it drew into it, so it waits for that element's sheets as well as its own
// (smart-base holdPortalUntilStyled, group build 16 G2). Found by view round
// 10, L-4 (ui-control control/evidence/2026-11-21-view-r10): an
// sf-view-properties panel made after the page loaded drew its record head in
// sf-drawer's box before its own sheet came -- its host was held by the style
// gate, but the box is outside the host -- and the head moved 16 px up and
// 14 px left when the sheet arrived.
//
// Here a carrier element (a page-defined Smart element whose sheets "arrive"
// 700 ms after it is made) draws an open sf-drawer with a line of text. The
// drawer's own sheet is in before (a closed drawer on the page made the Loader
// fetch it). Every animation frame from the carrier's creation reads whether
// the text is visible: it must not be before the carrier's sheets are in, and
// must be once they are. 1440 and 390, light and dark, three loads each.
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
const HELD = 700;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>portal carrier</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}, smart: {base: true}, theme: false};</script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page)}</style></head><body>
<sf-drawer id="warm" heading="Прогрев"><p slot="content">Закрыто.</p></sf-drawer>
</body></html>`;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
let theme = 'light';
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
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

const failures = [];
const evidence = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (theme of ['light', 'dark']) for (let load = 1; load <= 3; load++) {
    const where = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 800}});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/probe?n=${Date.now()}`);
    await tab.waitForFunction(() => window.SF?.SfBaseElement && customElements.get('sf-drawer')
      && [...document.querySelectorAll('link[rel~="stylesheet"]')].some((link) => /\/drawer(\.min)?\.css/.test(link.href) && link.sheet), null, {timeout: 15000});
    await tab.waitForTimeout(300);
    const frames = await tab.evaluate((held) => new Promise((done) => {
      const {SfBaseElement, html} = window.SF;
      class Carrier extends SfBaseElement {
        hasBuiltInTemplate() { return true; }
        template() {
          return html`<sf-drawer open heading="Карточка" placement="right"><p slot="content" id="carried">Текст карточки.</p></sf-drawer>`;
        }
        // The carrier's sheets, held: as a component whose sheet comes late.
        stylesReadiness() {
          if (this._styleReady) return null;
          if (!this._held) {
            this._held = new Promise((resolve) => setTimeout(resolve, held));
            this._styleAppliedPromise = this._held.then(() => { this._styleApplied = true; });
          }
          return this._held;
        }
      }
      if (!customElements.get('sf-probe-carrier')) Carrier.define('sf-probe-carrier');
      const t0 = performance.now();
      const seen = [];
      document.body.append(document.createElement('sf-probe-carrier'));
      const tick = () => {
        const text = document.getElementById('carried');
        const box = text?.getBoundingClientRect();
        seen.push({t: Math.round(performance.now() - t0), there: Boolean(text), visible: Boolean(text && box.width > 0
          && text.checkVisibility({visibilityProperty: true, opacityProperty: true}))});
        if (performance.now() - t0 < held + 1500) requestAnimationFrame(tick);
        else done(seen);
      };
      requestAnimationFrame(tick);
    }), HELD);
    const early = frames.filter((frame) => frame.visible && frame.t < HELD - 50);
    const last = frames[frames.length - 1];
    evidence.push({where, frames: frames.length, firstVisible: frames.find((frame) => frame.visible)?.t ?? null, early: early.length});
    if (early.length) failures.push({where, said: `the carried text showed ${early.length} frame(s) before the carrier's sheets (first at ${early[0].t} ms, sheets at ${HELD} ms)`});
    if (!last?.visible) failures.push({where, said: 'the carried text never showed after the carrier\'s sheets came'});
    if (errors.length) failures.push({where, said: `console: ${errors.slice(0, 3).join(' | ')}`});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({held: HELD, evidence}));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('PORTAL_CARRIER_OK');

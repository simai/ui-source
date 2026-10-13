#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.Position.anchor keeps a stylesheet cap on the panel's size. A percentage
// cap is returned by getComputedStyle as written, and read as pixels it made
// max-inline-size: 100% -- the tooltip's own rule -- a 100px column: every
// anchored tooltip wrapped its hint word by word. The panel is fixed, so a
// percentage is of the viewport.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/tooltip/css/tooltip.css'].map((p) => join(out, p));
const modules = ['core/core/js/core.js'].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 600}});
  // The bundles find their chunks from their own URL, so they are served, not inlined.
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const path = join(out, new URL(route.request().url()).pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    const type = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html';
    return route.fulfill({status: 200, contentType: type, body: readFileSync(path)});
  });
  await page.route(`${origin}/`, (route) => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html class="theme-light"><body></body></html>'}));
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html class="theme-light"><body style="margin:0">'
    + '<button id="ref" type="button" style="position:fixed;top:40px;left:300px">Hint</button>'
    + '<div id="tip" class="sf-tooltip">A hint long enough to need far more than a hundred pixels on one line</div>'
    + '</body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path.slice(out.length + 1)}`});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path.slice(out.length + 1)}`, type: 'module'});
  await page.waitForFunction(() => window.SF?.Position?.anchor, null, {timeout: 5000});
  const measured = await page.evaluate(async () => {
    const tip = document.getElementById('tip');
    const cap = getComputedStyle(tip).maxWidth;
    const controller = window.SF.Position.anchor(document.getElementById('ref'), tip, {autoUpdate: false});
    await controller.update();
    const {width} = tip.getBoundingClientRect();
    const written = tip.style.maxWidth;
    controller.stop();
    return {cap, width, written};
  });
  console.log(JSON.stringify(measured, null, 1));
  if (!String(measured.cap).endsWith('%')) {
    console.error('the tooltip rule no longer caps by a percentage; this probe measures nothing');
    failed = true;
  } else if (measured.width <= 300) {
    console.error('a percentage cap was read as pixels');
    failed = true;
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
console.log('ANCHOR_PERCENT_CAP_OK');

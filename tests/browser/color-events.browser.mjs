#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-input-color: input while the value moves, change once when it is committed,
// and nothing else. The window's own fields keep their native input and change
// inside (C83: the window replaced the platform picker, whose change bubbled out
// as a second change with no detail); an unset colour submits empty; a swatch
// name with a space is not cut into two swatches.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'smart/smart/input-color/css/input-color.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/segmented/js/segmented.js', 'smart/smart/input-color/js/input-color.js'];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 900, height: 600}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html class="theme-light" lang="en"><body></body></html>'});
    const path = join(out, url.pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html class="theme-light" lang="en"><body>'
    + '<form id="form"><sf-input-color id="color" name="brand" label="Brand" clearable inherited-value="#336699"'
    + ' swatches="#1f6feb|Brand blue, #e5534b|Alert, #111 #222"></sf-input-color></form></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  // Drawn and past its style gate (core.runtime 1.0.7): the element's after-render
  // work, its form value among it, runs once its sheets are applied.
  await page.waitForFunction(() => customElements.get('sf-input-color') && document.querySelector('#color[data-sf-style-ready] .sf-color'), null, {timeout: 8000});

  const measured = await page.evaluate(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 80));
    const color = document.getElementById('color');
    const seen = [];
    color.addEventListener('input', (event) => seen.push(['input', event.detail?.value ?? null]));
    color.addEventListener('change', (event) => seen.push(['change', event.detail?.value ?? null]));
    const unsetForm = [...new FormData(document.getElementById('form')).entries()];
    // The window (C83): the product's colours are its first swatches.
    color.querySelector('.sf-color-trigger').click();
    await settle();
    // An own colour (here the inherited #336699) opens the window on «Своё»
    // (C83), where the product swatches are not drawn: read them on «Палитра».
    color.showView('palette');
    await settle();
    const swatches = [...color.querySelectorAll('.sf-color-options--product .sf-color-option')].map((button) => button.getAttribute('aria-label'));
    // «Своё»: the code field's own input and change stay inside the window.
    color.showView('own');
    await settle();
    const code = color.querySelector('.sf-color-code');
    for (const value of ['#101010', '#202020', '#303030']) {
      code.value = value;
      code.dispatchEvent(new Event('input', {bubbles: true}));
    }
    code.dispatchEvent(new Event('change', {bubbles: true}));
    await settle();
    const afterTyping = seen.splice(0);
    color.showView('palette');
    await settle();
    color.querySelector('.sf-color-options--product .sf-color-option').click();
    await settle();
    const afterSwatch = seen.splice(0);
    const closed = !color.querySelector('.sf-color-window');
    const setForm = [...new FormData(document.getElementById('form')).entries()];
    return {unsetForm, swatches, afterTyping, afterSwatch, closed, setForm};
  });
  console.log(JSON.stringify(measured));
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  expect(JSON.stringify(measured.unsetForm) === '[["brand",""]]', 'an unset colour submits an empty value under its name');
  expect(JSON.stringify(measured.swatches) === '["Brand blue","Alert","#111111","#222222"]', 'a swatch name keeps its spaces');
  expect(JSON.stringify(measured.afterTyping) === '[["input","#101010"],["input","#202020"],["input","#303030"],["change","#303030"]]',
    'typing sends input per colour and one change with a value; the code field\'s own events stay inside');
  expect(JSON.stringify(measured.afterSwatch) === '[["input","#1f6feb"],["change","#1f6feb"]]', 'a swatch sends input then change');
  expect(measured.closed, 'a pressed swatch closes the window');
  expect(JSON.stringify(measured.setForm) === '[["brand","#1f6feb"]]', 'the form carries the chosen colour');
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('COLOR_EVENTS_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-color: input while the value moves, change once when it is committed, and
// nothing else. The platform picker's own change bubbled out of the host as a
// second change with no detail; a named colour input submitted #000000 for a
// colour nobody had chosen; a swatch name with a space was cut into two swatches.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'smart/smart/color/css/color.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/color/js/color.js'];
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
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: readFileSync(path)});
  });
  await page.goto(`${origin}/`);
  await page.setContent('<!doctype html><html class="theme-light" lang="en"><body>'
    + '<form id="form"><sf-color id="color" name="brand" label="Brand" clearable inherited-value="#336699"'
    + ' swatches="#1f6feb|Brand blue, #e5534b|Alert, #111 #222"></sf-color></form></body></html>');
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-color') && document.querySelector('#color .sf-color'), null, {timeout: 8000});

  const measured = await page.evaluate(async () => {
    const settle = () => new Promise((done) => setTimeout(done, 50));
    const color = document.getElementById('color');
    const seen = [];
    color.addEventListener('input', (event) => seen.push(['input', event.detail?.value ?? null]));
    color.addEventListener('change', (event) => seen.push(['change', event.detail?.value ?? null]));
    const unsetForm = [...new FormData(document.getElementById('form')).entries()];
    const swatches = [...color.querySelectorAll('.sf-color-preset')].map((button) => button.getAttribute('aria-label'));
    const picker = color.querySelector('input[type="color"]');
    for (const value of ['#101010', '#202020', '#303030']) {
      picker.value = value;
      picker.dispatchEvent(new Event('input', {bubbles: true}));
    }
    picker.dispatchEvent(new Event('change', {bubbles: true}));
    await settle();
    const afterDrag = seen.splice(0);
    color.querySelector('.sf-color-preset').click();
    await settle();
    const afterSwatch = seen.splice(0);
    const setForm = [...new FormData(document.getElementById('form')).entries()];
    return {unsetForm, swatches, afterDrag, afterSwatch, setForm};
  });
  console.log(JSON.stringify(measured));
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  expect(JSON.stringify(measured.unsetForm) === '[["brand",""]]', 'an unset colour submits an empty value under its name');
  expect(JSON.stringify(measured.swatches) === '["Brand blue","Alert","#111","#222"]', 'a swatch name keeps its spaces');
  expect(JSON.stringify(measured.afterDrag) === '[["input","#101010"],["input","#202020"],["input","#303030"],["change","#303030"]]',
    'a drag sends input per step and one change with a value, and the picker change stays inside');
  expect(JSON.stringify(measured.afterSwatch) === '[["input","#1f6feb"],["change","#1f6feb"]]', 'a swatch sends input then change');
  expect(JSON.stringify(measured.setForm) === '[["brand","#1f6feb"]]', 'the form carries the chosen colour');
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('COLOR_EVENTS_OK');

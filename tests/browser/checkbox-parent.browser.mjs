#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Owner decision C165 (2026-11-14), measured on the built bytes: a parent
// checkbox (controls) computes its state from its children -- mixed when some
// are checked -- follows a child's press, property and a native child; Space
// on it checks them all and then unchecks them all, each changed child saying
// change; a disabled child is counted and left alone; the input carries
// aria-controls. A switch in a form with a submit button and a one-word help
// each say one development warning (C165 (4), CK-7); an instant switch none.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body style="margin:40px">
  <sf-checkbox id="pa" label="Все уведомления" controls="c-mail c-push c-sms"></sf-checkbox>
  <sf-checkbox id="c-mail" label="Почта" checked></sf-checkbox><sf-checkbox id="c-push" label="Push"></sf-checkbox><sf-checkbox id="c-sms" label="SMS"></sf-checkbox>
  <sf-checkbox id="pd" label="Все отчёты" controls="d-1 d-2 d-3"></sf-checkbox>
  <sf-checkbox id="d-1" label="Неделя"></sf-checkbox><sf-checkbox id="d-2" label="Месяц"></sf-checkbox><sf-checkbox id="d-3" label="Год" disabled></sf-checkbox>
  <sf-checkbox id="pn" label="Все строки" controls="n-1 n-2"></sf-checkbox><input type="checkbox" id="n-1" checked><input type="checkbox" id="n-2" checked>
  <sf-switch id="instant" label="Тёмная тема"></sf-switch>
  <form><sf-switch id="fs" name="prices" label="Показывать цены"></sf-switch><button type="submit">Сохранить</button></form>
  <sf-checkbox id="hinfo" label="Справка" help="info"></sf-checkbox>
</body></html>`;
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 700}});
  const errors = [];
  const warnings = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/page`);
  await page.waitForFunction(() => document.querySelector('#hinfo input') && document.querySelector('#fs input'));
  await page.waitForTimeout(500);
  const state = (ids) => page.evaluate((list) => Object.fromEntries(list.map((id) => { const h = document.getElementById(id); const i = h.localName === 'sf-checkbox' ? h.querySelector('input[type=checkbox]') : h; return [id, i.indeterminate ? 'mixed' : i.checked ? 'on' : 'off']; })), ids);
  await page.evaluate(() => { window.changes = []; document.addEventListener('change', (event) => window.changes.push((event.target.closest('sf-checkbox') || event.target).id), true); });
  const initial = await state(['pa', 'pd', 'pn']);
  const controls = await page.evaluate(() => document.querySelector('#pa input').getAttribute('aria-controls'));
  const snapshot = await page.locator('#pa').ariaSnapshot();
  await page.focus('#pa input');
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const allOn = await state(['pa', 'c-mail', 'c-push', 'c-sms']);
  const changesOn = await page.evaluate(() => window.changes.splice(0));
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const allOff = await state(['pa', 'c-mail', 'c-push', 'c-sms']);
  await page.locator('#c-push label').first().click();
  await page.waitForTimeout(150);
  const childPressed = await state(['pa']);
  await page.evaluate(() => { document.getElementById('c-mail').setChecked(true); document.getElementById('c-sms').setChecked(true); });
  await page.waitForTimeout(150);
  const childProperty = await state(['pa']);
  await page.focus('#pd input');
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const disabledOn = await state(['pd', 'd-1', 'd-2', 'd-3']);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const disabledOff = await state(['pd', 'd-1', 'd-2', 'd-3']);
  await page.click('#n-1');
  await page.waitForTimeout(150);
  const native = await state(['pn']);
  if (initial.pa !== 'mixed' || initial.pd !== 'off' || initial.pn !== 'on') note({case: 'initial state from the children', got: initial});
  if (controls !== 'c-mail c-push c-sms' || !/checked=mixed/u.test(snapshot)) note({case: 'aria-controls and mixed', got: {controls, snapshot}});
  if (Object.values(allOn).some((value) => value !== 'on') || changesOn.join() !== 'pa,c-push,c-sms') note({case: 'Space checks all, one change per changed child', got: {allOn, changesOn}});
  if (Object.values(allOff).some((value) => value !== 'off')) note({case: 'Space again unchecks all', got: allOff});
  if (childPressed.pa !== 'mixed' || childProperty.pa !== 'on') note({case: 'follows a press and a property', got: {childPressed, childProperty}});
  if (disabledOn.pd !== 'mixed' || disabledOn['d-1'] !== 'on' || disabledOn['d-3'] !== 'off' || disabledOff.pd !== 'off' || disabledOff['d-1'] !== 'off') note({case: 'a disabled child is counted and left alone', got: {disabledOn, disabledOff}});
  if (native.pn !== 'mixed') note({case: 'a native child', got: native});
  const formWarnings = warnings.filter((text) => text.includes('#fs is a switch in a form'));
  const helpWarnings = warnings.filter((text) => text.includes('help="info"'));
  if (formWarnings.length !== 1 || warnings.some((text) => text.includes('#instant'))) note({case: 'one form-switch warning, none for an instant switch', got: warnings});
  if (helpWarnings.length !== 1) note({case: 'one bare-help warning', got: warnings});
  if (errors.length) note({case: 'console clean', got: errors});
  console.log(JSON.stringify({initial, controls, snapshot, allOn, changesOn, allOff, childPressed, childProperty, disabledOn, disabledOff, native, warnings}, null, 1));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('CHECKBOX_PARENT_OK');

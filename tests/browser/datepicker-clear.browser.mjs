#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A date set by the `value` attribute can be cleared (ui-admin, 2026-10-22: the
// getter fell back to the attribute once the date was emptied, so clearing gave
// the old date back, and the field set's date editor could not clear either).
// On the built bytes:
// - the person empties the field: the value is '', the field stays empty, and
//   change is emitted once with detail.value '' (sf-datepicker-change too);
// - code clears it (element.value = '', element.date = ''): the value is '';
// - a cleared value stays cleared through a re-render, and a new date can be
//   picked or typed after it;
// - the attribute stays the initial value: it is not rewritten, and a picker
//   without one still clears as before.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/datepicker/css/datepicker.css', 'smart/smart/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js', 'smart/smart/datepicker/js/datepicker.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
    <p><sf-datepicker id="typed" value="2026-11-20" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="code" value="2026-11-20" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="plain" aria-label="Дата"></sf-datepicker></p>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-datepicker') && document.querySelector('#typed input') && document.querySelector('#plain input'), null, {timeout: 8000});
  await page.waitForTimeout(400);

  // Every change each picker says.
  await page.evaluate(() => {
    window.said = {};
    for (const node of document.querySelectorAll('sf-datepicker')) {
      window.said[node.id] = [];
      node.addEventListener('change', (event) => { if (event.target === node) window.said[node.id].push(['change', event.detail?.value]); });
      node.addEventListener('sf-datepicker-change', (event) => window.said[node.id].push(['sf-datepicker-change', event.detail?.value]));
    }
  });
  const state = (id) => page.evaluate((id) => {
    const node = document.getElementById(id);
    return {value: node.value, date: node.date, field: node.querySelector('input').value,
      valueAttr: node.getAttribute('value'), dateAttr: node.getAttribute('date'), said: window.said[id].splice(0)};
  }, id);
  const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

  const before = await state('typed');
  check('the attribute is the initial value', before.value === '2026-11-20' && before.field === '20.11.2026', before);

  // The person empties the field and leaves it.
  await page.fill('#typed input', '');
  await page.press('#typed input', 'Tab');
  await settle();
  const typed = await state('typed');
  check('emptying the field clears the value', typed.value === '' && typed.date === '' && typed.field === '', typed);
  check('the clear is said once, as change and its alias, with value \'\'', JSON.stringify(typed.said) === JSON.stringify([['change', ''], ['sf-datepicker-change', '']]), typed);
  check('the value attribute stays the initial value', typed.valueAttr === '2026-11-20', typed);

  // A re-render keeps the cleared value.
  await page.evaluate(() => { const node = document.getElementById('typed'); node.setAttribute('placeholder', 'дд.мм.гггг'); });
  await settle();
  const rerendered = await state('typed');
  check('a re-render keeps it cleared', rerendered.value === '' && rerendered.field === '', rerendered);

  // A new date after the clear lands, typed with Enter.
  await page.fill('#typed input', '05.12.2026');
  await page.press('#typed input', 'Enter');
  await settle();
  const again = await state('typed');
  check('a date typed after the clear lands', again.value === '2026-12-05' && again.field === '05.12.2026'
    && JSON.stringify(again.said) === JSON.stringify([['change', '2026-12-05'], ['sf-datepicker-change', '2026-12-05']]), again);
  // And emptying it again clears again.
  await page.fill('#typed input', '');
  await page.press('#typed input', 'Enter');
  await settle();
  const twice = await state('typed');
  check('emptying it again clears again', twice.value === '' && twice.field === '' && twice.said.length === 2, twice);

  // Code clears it: element.value = '' and element.date = ''.
  await page.evaluate(() => { document.getElementById('code').value = ''; });
  await settle();
  const byValue = await state('code');
  check('element.value = \'\' clears a value set by the attribute', byValue.value === '' && byValue.field === '', byValue);
  check('a value set from code is not a change', byValue.said.length === 0, byValue);
  await page.evaluate(() => { document.getElementById('code').value = '2026-01-02'; });
  await settle();
  const set = await state('code');
  check('a date set from code after the clear lands', set.value === '2026-01-02' && set.field === '02.01.2026', set);
  await page.evaluate(() => { document.getElementById('code').date = ''; });
  await settle();
  const byDate = await state('code');
  check('element.date = \'\' clears too', byDate.value === '' && byDate.field === '', byDate);

  // A picker with no value attribute clears as it did.
  await page.evaluate(() => { document.getElementById('plain').value = '2026-03-04'; });
  await settle();
  await page.fill('#plain input', '');
  await page.press('#plain input', 'Tab');
  await settle();
  const plain = await state('plain');
  check('a picker without the attribute clears as before', plain.value === '' && plain.field === '' && plain.dateAttr === null
    && JSON.stringify(plain.said) === JSON.stringify([['change', ''], ['sf-datepicker-change', '']]), plain);
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DATEPICKER_CLEAR_OK');

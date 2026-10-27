#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Core step 2 of standard simai.smart-component 1.3.8 on the built bytes, with
// the real Loader:
// - sf-switch from its component.json: the reset of an inherited value sends
//   sf-field-reset first and the old sf-field:reset once each, with one
//   detail, and the old name is noted in SF.deprecations with its dates
//   (§16.20); a checked switch without value submits "on" from the host
//   (ElementInternals, §17.1, simai/ui-source#38), its checkbox carries no
//   name, and nothing is submitted while unchecked, disabled or inherited;
//   form.reset() returns it to its default;
// - language (§11.1, simai/ui-source#45): on a ru page that called
//   SF.language.use('ru'), a section with lang="en" speaks English, and
//   changing the section's lang at runtime redraws the switch in it;
// - ids (§7.1.1, simai/ui-source#41): a class sf-quantity and an
//   <sf-quantity> share no id, and each label points at its own field;
// - the boot preloader (§5.4): never shown on a page with static markup,
//   taken down at DOMContentLoaded when asked for at once, and still shown on
//   a bare page.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const head = (boot = '') => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';${boot}
window.__loaderSeen = [];
new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains('sf-loader')) window.__loaderSeen.push(performance.now()); })
  .observe(document.documentElement, {childList: true, subtree: true});</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head>`;

const pages = {
  '/switch': `${head()}<body>
<form id="form">
  <sf-switch id="plain" name="notify" checked label="Уведомления"></sf-switch>
  <sf-switch id="valued" name="mode" value="yes" label="Режим"></sf-switch>
  <sf-switch id="off" name="silent" label="Тихо"></sf-switch>
  <sf-switch id="inherited" name="inherit" inherited-value="true" label="Наследуемое"></sf-switch>
</form></body></html>`,
  '/lang': `${head()}<body>
<sf-switch id="page" inherited-value="true" label="Страница"></sf-switch>
<section id="section" lang="en"><sf-switch id="part" inherited-value="true" label="Section"></sf-switch></section>
</body></html>`,
  '/ids': `${head()}<body>
<label class="sf-quantity sf-quantity--size-1" id="class-q-host"><span class="sf-quantity-label"><span class="sf-quantity-text">Класс</span></span><span class="sf-quantity-wrap"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Меньше"><i class="sf-icon">remove</i></button><input type="text" value="1" step="1" min="0" max="9"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Больше"><i class="sf-icon">add</i></button></span></label>
<label class="sf-quantity sf-quantity--size-1"><span class="sf-quantity-label"><span class="sf-quantity-text">Класс без id</span></span><span class="sf-quantity-wrap"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Меньше"><i class="sf-icon">remove</i></button><input type="text" value="1" step="1" min="0" max="9"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--secondary sf-icon-button--tonal sf-icon-button--size-1/3" aria-label="Больше"><i class="sf-icon">add</i></button></span></label>
<sf-quantity label="Smart" value="2"></sf-quantity>
<sf-quantity id="named" label="Smart с id" value="3"></sf-quantity>
</body></html>`,
  '/static': `${head()}<body><sf-switch label="Статичный"><div data-sf-static><label class="sf-switch"><span class="sf-switch-toggler"><input type="checkbox" role="switch"></span></label></div></sf-switch><p>Текст</p></body></html>`,
  '/static-now': `${head('window.SF_BOOT_CONFIG={preloader:{delay:0}};')}<body><sf-skeleton data-sf-skeleton="rows"></sf-skeleton><p>Текст</p></body></html>`,
  '/bare-now': `${head('window.SF_BOOT_CONFIG={preloader:{delay:0}};')}<body></body></html>`,
};

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path]);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${['.js', '.css', '.json'].includes(extname(file)) ? '; charset=utf-8' : ''}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const results = {};
const check = (name, pass, detail = {}) => { results[name] = pass; if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
const open = async (path) => {
  const tab = await browser.newPage();
  tab.on('pageerror', (error) => failures.push({name: `${path}: page error`, said: error.message}));
  await tab.goto(`${base}${path}`);
  return tab;
};
const settle = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)))));

try {
  // ---------- sf-switch: events, journal, form ----------
  {
    const tab = await open('/switch');
    await tab.waitForFunction(() => customElements.get('sf-switch') && document.querySelectorAll('sf-switch .sf-switch').length === 4, null, {timeout: 15000});
    await settle(tab);
    const form = await tab.evaluate(() => {
      const data = new FormData(document.getElementById('form'));
      const inner = [...document.querySelectorAll('sf-switch input[type="checkbox"]')].map((input) => input.getAttribute('name'));
      return {
        notify: data.get('notify'), mode: data.get('mode'), silent: data.get('silent'), inherit: data.get('inherit'),
        entries: [...data.entries()], inner,
        listed: [...document.getElementById('form').elements].filter((one) => one.localName === 'sf-switch').length,
        value: document.getElementById('plain').value,
      };
    });
    check('form: a checked switch without value submits "on" (#38)', form.notify === 'on', form);
    check('form: an unchecked switch submits nothing', form.mode === null && form.silent === null, form);
    check('form: an inherited switch submits nothing', form.inherit === null, form);
    check('form: the inner checkboxes carry no name (§17.1 item 6)', form.inner.every((name) => name === null), form);
    check('form: the hosts are the form controls (ElementInternals)', form.listed === 4 && form.entries.length === 1, form);
    check('form: value reads "on" without the attribute', form.value === 'on', form);

    await tab.locator('#valued .sf-switch-inner').click();
    await tab.evaluate(() => document.getElementById('plain').setAttribute('disabled', ''));
    await settle(tab);
    const after = await tab.evaluate(() => {
      const data = new FormData(document.getElementById('form'));
      return {mode: data.get('mode'), notify: data.get('notify'), on: document.querySelector('#valued .sf-switch-inner').getBoundingClientRect().x
        - document.querySelector('#valued .sf-switch-toggler').getBoundingClientRect().x, active: document.querySelector('#valued .sf-switch').classList.contains('active')};
    });
    check('form: a flipped switch submits its value', after.mode === 'yes', after);
    check('form: a disabled switch submits nothing', after.notify === null, after);
    check('look: the checked thumb has travelled (from :checked, #46)', after.on > 4, after);
    await tab.evaluate(() => document.getElementById('form').reset());
    await settle(tab);
    const reset = await tab.evaluate(() => ({mode: new FormData(document.getElementById('form')).get('mode'), checked: document.getElementById('valued').checked}));
    check('form: reset returns to the default', reset.mode === null && reset.checked === false, reset);

    // The inherited switch: a value of its own, then back.
    await tab.locator('#inherited .sf-switch-inner').click();
    await settle(tab);
    const events = await tab.evaluate(() => {
      SF.deprecations.clear();
      const host = document.getElementById('inherited');
      const heard = [];
      host.addEventListener('sf-field-reset', (event) => heard.push(['new', event.type, event.detail]));
      host.addEventListener('sf-field:reset', (event) => heard.push(['old', event.type, event.detail]));
      host.querySelector('[data-inherited-reset]').click();
      const journal = SF.deprecations.list().filter((note) => note.from === 'sf-field:reset');
      return {
        order: heard.map(([who, type]) => `${who}:${type}`),
        sameDetail: heard.length === 2 && heard[0][2] === heard[1][2],
        detail: heard[0]?.[2],
        journal,
        inherited: host.getAttribute('data-inherited'),
      };
    });
    check('events: sf-field-reset then sf-field:reset, once each', JSON.stringify(events.order) === JSON.stringify(['new:sf-field-reset', 'old:sf-field:reset']), events);
    check('events: one detail object for both names', events.sameDetail, events);
    check('events: the old name is noted with its dates', events.journal.length === 1 && events.journal[0].count === 1
      && events.journal[0].since === '2026-10-27' && events.journal[0].remove_after === '2026-12-01' && events.journal[0].tag === 'sf-switch', events);
    check('events: the reset applied', events.inherited === 'true', events);
    results.events = events.order;
    await tab.close();
  }

  // ---------- language ----------
  {
    const tab = await open('/lang');
    await tab.waitForFunction(() => customElements.get('sf-switch') && document.querySelectorAll('sf-switch .sf-switch').length === 2, null, {timeout: 15000});
    await tab.evaluate(() => SF.language.use('ru'));
    await settle(tab);
    const words = () => tab.evaluate(() => Object.fromEntries(['page', 'part'].map((id) => {
      const host = document.getElementById(id);
      return [id, {marker: host.querySelector('[data-inherited-marker]')?.textContent.trim(), described: host.querySelector('input[type="checkbox"]').getAttribute('aria-description')}];
    })));
    const first = await words();
    check('lang: the ru page speaks Russian', first.page.marker === 'наследуется' && first.page.described === 'Наследуется: включено', first);
    check('lang: a lang="en" section wins over SF.language.use("ru")', first.part.marker === 'inherited' && first.part.described === 'Inherited: on', first);
    await tab.evaluate(() => document.getElementById('section').setAttribute('lang', 'ru'));
    await settle(tab);
    const second = await words();
    check('lang: a runtime lang change redraws the switch under it', second.part.marker === 'наследуется' && second.part.described === 'Наследуется: включено', second);
    await tab.evaluate(() => document.getElementById('section').setAttribute('lang', 'en'));
    await settle(tab);
    const third = await words();
    check('lang: and back', third.part.marker === 'inherited' && third.page.marker === 'наследуется', third);
    results.lang = {first, second, third};
    await tab.close();
  }

  // ---------- ids ----------
  {
    const tab = await open('/ids');
    await tab.waitForFunction(() => customElements.get('sf-quantity') && document.querySelectorAll('sf-quantity .sf-quantity input').length === 2
      && [...document.querySelectorAll('label.sf-quantity:not(sf-quantity *) input')].every((input) => input.id), null, {timeout: 15000});
    await settle(tab);
    const ids = await tab.evaluate(() => {
      const inputs = [...document.querySelectorAll('.sf-quantity input[type="text"], sf-quantity input')];
      const all = [...document.querySelectorAll('[id]')].map((node) => node.id);
      const labels = [...document.querySelectorAll('label[for]')].map((label) => ({for: label.getAttribute('for'), own: label.querySelector('input')?.id ?? null}));
      return {inputs: [...new Set(inputs)].map((input) => input.id), duplicates: all.filter((id, index) => all.indexOf(id) !== index), labels};
    });
    check('ids: no two elements share an id (#41)', ids.duplicates.length === 0, ids);
    check('ids: each class label points at its own field', ids.labels.every((label) => label.own === null || label.for === label.own), ids);
    check('ids: class and Smart ids differ by kind, Smart ids follow the path', ids.inputs.includes('sf-quantity-1--control')
      && ids.inputs.includes('page-named--control') && ids.inputs.some((id) => id.startsWith('class-sf-quantity-') || id.startsWith('page-class-q-host')), ids);
    results.ids = ids.inputs;
    await tab.close();
  }

  // ---------- the boot preloader ----------
  {
    const tab = await open('/static');
    await tab.waitForTimeout(700);
    const seen = await tab.evaluate(() => ({seen: window.__loaderSeen.length, shown: [...document.querySelectorAll('.sf-loader')].filter((node) => !node.classList.contains('hidden')).length}));
    check('preloader: never shown on a page with static markup', seen.seen === 0 && seen.shown === 0, seen);
    await tab.close();
  }
  {
    const tab = await open('/static-now');
    await tab.waitForTimeout(300);
    const seen = await tab.evaluate(() => ({seen: window.__loaderSeen.length, shown: [...document.querySelectorAll('.sf-loader')].filter((node) => !node.classList.contains('hidden') && getComputedStyle(node).display !== 'none').length}));
    check('preloader: asked for at once, it gives way to skeletons at DOMContentLoaded', seen.shown === 0, seen);
    await tab.close();
  }
  {
    const tab = await open('/bare-now');
    await tab.waitForTimeout(150);
    const seen = await tab.evaluate(() => ({seen: window.__loaderSeen.length}));
    check('preloader: a bare page still has it', seen.seen === 1, seen);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({results}, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('SWITCH_MANIFEST_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-empty-state (2026-10-14), measured on the built bytes: each kind draws its
// icon, a real heading at heading-level and its sentence in the page language;
// nothing-found and error are a polite status, the others are not; an error
// without actions offers «Повторить» and says so with sf-empty-state-action;
// the actions property draws buttons at the component's size; the title role
// grows with the size; the column is at most 28rem.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'component/component/featured-icon/css/featured-icon.css', 'smart/smart/empty-state/css/empty-state.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js', 'smart/smart/empty-state/js/empty-state.js'];
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><body style="margin:20px">
    <sf-empty-state id="none"></sf-empty-state>
    <sf-empty-state id="found" kind="nothing-found" size="1/2" heading-level="4"></sf-empty-state>
    <sf-empty-state id="denied" kind="no-access" size="2" heading-level="2"></sf-empty-state>
    <sf-empty-state id="failed" kind="error"></sf-empty-state>
    <sf-empty-state id="custom" title="Нет заказов" text="Создайте первый заказ"></sf-empty-state>
    <div style="width:320px"><sf-empty-state id="line" kind="nothing-found" size="1/3" text="Ничего не найдено по «зz»"></sf-empty-state></div>
    <div style="width:320px"><sf-empty-state id="line-error" kind="error" layout="inline" live="alert"></sf-empty-state></div>
    <sf-button id="half" size="1/2" text="x"></sf-button>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-empty-state'), null, {timeout: 8000});
  await page.evaluate(() => {
    window.acts = [];
    document.addEventListener('sf-empty-state-action', (event) => window.acts.push(event.detail.id));
    document.getElementById('custom').actions = [{id: 'create', text: 'Создать заказ'}];
  });
  // Drawn, not timed: under a full probe run a fixed wait was too short.
  await page.waitForFunction(() => [...document.querySelectorAll('sf-empty-state')].every((element) => element.querySelector('.sf-empty-state'))
    && document.querySelector('#custom sf-button button') && document.querySelector('#failed sf-button button')
    && document.querySelector('#line-error sf-button button') && document.querySelector('#half button')
    && document.querySelector('#line .sf-empty-state-icon')?.getBoundingClientRect().width > 0, null, {timeout: 8000});
  await page.waitForTimeout(150);
  const states = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('sf-empty-state')].map((element) => {
    const heading = element.querySelector('.sf-empty-state-title');
    const root = element.querySelector('.sf-empty-state');
    return [element.id, {
      tag: heading?.tagName, title: heading?.textContent.trim(), text: element.querySelector('.sf-empty-state-text')?.textContent.trim(),
      role: root?.getAttribute('role'), icon: element.querySelector('.sf-empty-state-icon .sf-icon')?.textContent.trim(),
      titleSize: heading ? getComputedStyle(heading).fontSize : null, width: Math.round(root?.getBoundingClientRect().width ?? 0),
      buttons: [...element.querySelectorAll('sf-button')].map((button) => `${button.getAttribute('text')}:${button.getAttribute('size')}`),
    }];
  })));
  // The inline form: one line, no heading, at a 1/2 control's height; the
  // first action a link; an alert when the host says the person caused it.
  const inline = await page.evaluate(() => {
    const line = document.querySelector('#line .sf-empty-state');
    const failed = document.querySelector('#line-error .sf-empty-state');
    return {
      heading: Boolean(document.querySelector('#line :is(h1,h2,h3,h4,h5,h6), #line-error :is(h1,h2,h3,h4,h5,h6)')),
      text: line?.textContent.replace(/\s+/gu, ' ').trim(), role: line?.getAttribute('role'),
      height: Math.round(line?.getBoundingClientRect().height ?? 0), half: Math.round(document.querySelector('#half button').getBoundingClientRect().height),
      errorRole: failed?.getAttribute('role'), errorLink: failed?.querySelector('sf-button')?.getAttribute('appearance'),
      errorText: failed?.querySelector('.sf-empty-state-line')?.textContent.trim(),
    };
  });
  if (inline.heading || inline.role !== 'status' || !inline.text?.startsWith('search_off Ничего не найдено по') || inline.height !== inline.half
    || inline.errorRole !== 'alert' || inline.errorLink !== 'link' || inline.errorText !== 'Не удалось загрузить') note({case: 'inline', got: inline});
  await page.evaluate(() => { document.querySelector('#failed sf-button button')?.click(); document.querySelector('#custom sf-button button')?.click(); });
  await page.waitForTimeout(150);
  const acts = await page.evaluate(() => window.acts);
  const s = states;
  if (s.none.tag !== 'H3' || s.none.title !== 'Пока ничего нет' || !s.none.text || s.none.role !== null || s.none.icon !== 'inbox') note({case: 'no-data', got: s.none});
  if (s.found.tag !== 'H4' || s.found.title !== 'Ничего не найдено' || s.found.role !== 'status') note({case: 'nothing-found', got: s.found});
  if (s.denied.tag !== 'H2' || s.denied.title !== 'Нет доступа' || s.denied.role !== null || s.denied.icon !== 'lock') note({case: 'no-access', got: s.denied});
  if (s.failed.role !== 'status' || s.failed.buttons.join() !== 'Повторить:1') note({case: 'error', got: s.failed});
  if (s.custom.title !== 'Нет заказов' || s.custom.buttons.join() !== 'Создать заказ:1') note({case: 'custom', got: s.custom});
  if (!(parseFloat(s.found.titleSize) < parseFloat(s.none.titleSize) && parseFloat(s.none.titleSize) < parseFloat(s.denied.titleSize))) {
    note({case: 'the title grows with the size', got: [s.found.titleSize, s.none.titleSize, s.denied.titleSize]});
  }
  if (s.none.width > 448) note({case: 'at most 28rem', got: s.none.width});
  if (acts.join() !== 'retry,create') note({case: 'actions are announced', got: acts});
  console.log(JSON.stringify({states, acts, inline}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('EMPTY_STATE_OK');

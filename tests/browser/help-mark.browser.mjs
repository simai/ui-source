#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-help-mark (2026-10-14), measured on the built bytes: a press opens the
// explanation beside the button (aria-expanded true), it is announced
// politely, Escape closes it and focus stays on the button; a hover opens
// nothing; an explanation with a link takes Tab after the button and closes
// when the focus leaves both; it is at most 20rem wide; a label line with a
// mark in it is as tall as one without (docs trial 4: the 24px button made a
// 20px line 24px).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css', 'component/component/icon-buttons/css/icon-buttons.css', 'smart/smart/help-mark/css/help-mark.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/icon-button/js/icon-button.js', 'smart/smart/help-mark/js/help-mark.js'];
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 700}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
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
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><body style="margin:40px">
    <p>Код решения <sf-help-mark id="plain" label="Подробнее: код решения" title="Код решения"
      text="Уникальное имя модуля латиницей, например simai.billing. Оно не меняется после установки и служит адресом модуля в обновлениях."></sf-help-mark></p>
    <p>Доступ <sf-help-mark id="linked" label="Подробнее: доступ"><span slot="content">Подробнее — в <a href="#access">руководстве</a>.</span></sf-help-mark>
      <button id="after" type="button">Дальше</button></p>
    <div style="font-size:var(--sf-text-size-1\\/2);line-height:var(--sf-text-height-1\\/2)">
      <span id="bare" style="display:block">Подпись</span>
      <span id="marked" style="display:block">Подпись <sf-help-mark label="Подробнее" text="Пояснение"></sf-help-mark></span>
    </div>
    <div class="sf-input sf-input--size-1 sf-input--bordered flex flex-col">
      <span class="sf-input-label flex items-center gap-1" id="field-bare"><label class="sf-input-text" for="f1">Название</label></span>
      <span class="sf-input-field flex"><input id="f1"></span>
    </div>
    <div class="sf-input sf-input--size-1 sf-input--bordered flex flex-col">
      <span class="sf-input-label flex items-center gap-1" id="field-marked"><label class="sf-input-text" for="f2">Код решения</label>
        <sf-help-mark label="Подробнее: код решения" size="1/3" text="Пояснение"></sf-help-mark></span>
      <span class="sf-input-field flex"><input id="f2"></span>
    </div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-help-mark'), null, {timeout: 8000});
  await page.waitForTimeout(400);
  const state = (id) => page.evaluate((key) => {
    const element = document.getElementById(key);
    const button = element.querySelector('.sf-help-mark-button button');
    const panel = element.querySelector('.sf-help-mark-panel');
    return {expanded: button?.getAttribute('aria-expanded'), name: button?.getAttribute('aria-label'), open: panel?.matches(':popover-open') ?? false,
      live: element.querySelector('.sf-help-mark-live')?.textContent.trim(), width: Math.round(panel?.getBoundingClientRect().width ?? 0),
      focused: document.activeElement === button};
  }, id);
  const lines = await page.evaluate(() => ({
    bare: document.getElementById('bare').getBoundingClientRect().height,
    marked: document.getElementById('marked').getBoundingClientRect().height,
    button: document.querySelector('#marked .sf-help-mark-button button')?.getBoundingClientRect().height ?? 0,
    fieldBare: document.getElementById('field-bare').getBoundingClientRect().height,
    fieldMarked: document.getElementById('field-marked').getBoundingClientRect().height,
    fieldButton: document.querySelector('#field-marked .sf-help-mark-button button')?.getBoundingClientRect().height ?? 0,
    // The mark's button is centred on the label text, not on the row's top.
    centred: (() => {
      const text = document.querySelector('#field-marked .sf-input-text').getBoundingClientRect();
      const button = document.querySelector('#field-marked .sf-help-mark-button button')?.getBoundingClientRect();
      return button ? Math.abs((text.top + text.bottom) / 2 - (button.top + button.bottom) / 2) : null;
    })(),
    title: document.querySelector('#marked .sf-help-mark-button button')?.getAttribute('title') ?? document.querySelector('#marked .sf-help-mark-button')?.getAttribute('title') ?? null,
  }));
  if (Math.abs(lines.marked - lines.bare) > 0.5 || lines.button < 24) note({case: 'a mark does not make its line taller, and keeps its target', got: lines});
  if (Math.abs(lines.fieldMarked - lines.fieldBare) > 0.5 || lines.fieldButton < 24 || lines.centred === null || lines.centred > 1) note({case: 'a mark does not make a field label row taller, centred on the label (docs trial 5)', got: lines});
  if (lines.title) note({case: 'the button does not repeat its name as a title', got: lines.title});
  await page.hover('#plain .sf-help-mark-button button');
  await page.waitForTimeout(200);
  const hovered = await state('plain');
  await page.click('#plain .sf-help-mark-button button');
  await page.waitForTimeout(300);
  const opened = await state('plain');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const escaped = await state('plain');
  await page.focus('#linked .sf-help-mark-button button');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  const intoPanel = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  const left = await state('linked');
  const after = await page.evaluate(() => document.activeElement?.id);
  if (hovered.open || hovered.expanded !== 'false') note({case: 'a hover opens nothing', got: hovered});
  if (!opened.open || opened.expanded !== 'true' || !opened.live?.startsWith('Код решения') || opened.width > 320 || opened.name !== 'Подробнее: код решения') note({case: 'a press opens', got: opened});
  if (escaped.open || escaped.expanded !== 'false' || !escaped.focused) note({case: 'Escape closes, focus stays', got: escaped});
  if (intoPanel !== '#access' || left.open || after !== 'after') note({case: 'Tab into the link, then out closes', got: {intoPanel, left, after}});
  console.log(JSON.stringify({hovered, opened, escaped, intoPanel, left, after}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('HELP_MARK_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Names, descriptions, ids and closed panels of the form parts, read from the
// browser's accessibility tree on the built bytes with the real Loader:
//   - sf-switch (simai/ui-source#44 item 1): the name is the label alone, the
//     description is the description (aria-describedby), for the Smart
//     element (setting and slot), the class markup, a switch named by
//     aria-label, a description changed after the first paint, and an
//     inherited switch (its marker and reset are no part of the name);
//   - sf-input-textarea (#30 item 1): the host's aria-label and
//     aria-labelledby name the native textarea, a visible label still wins
//     over aria-label;
//   - .sf-accordion (#30 item 2): a panel closed by the `hidden` class alone
//     carries the hidden attribute from the first paint -- out of the tab
//     order and the tree -- and still opens;
//   - class .sf-quantity beside <sf-input-quantity> (#41): no id twice on the
//     page, and each label names its own field.
// Light and dark; no page errors.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const classSwitch = `
  <label class="sf-switch sf-switch--size-1 flex" id="class-switch">
    <span class="sf-switch-toggler transition flex items-cross-center content-main-start">
      <input type="checkbox" role="switch"><span class="sf-switch-inner transition"></span>
    </span>
    <span class="sf-switch-container-wrap flex flex-col">
      <span class="sf-switch-top flex"><span class="sf-switch-container flex items-cross-center content-main-center"><span class="sf-switch-text">Рассылка</span></span></span>
      <span class="sf-switch-description">Раз в неделю</span>
    </span>
  </label>`;

const classQuantity = `
  <div id="class-quantity-root"><label class="sf-quantity sf-quantity--size-1"><span class="sf-quantity-label"><span class="sf-quantity-text">Классовое количество</span></span><span class="sf-quantity-wrap"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--on-surface-variant sf-icon-button--size-1/3" aria-label="Меньше"><i class="sf-icon">remove</i></button><input type="text" value="1" step="1" min="0" max="9"><button type="button" class="sf-quantity-count sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--on-surface-variant sf-icon-button--size-1/3" aria-label="Больше"><i class="sf-icon">add</i></button></span></label></div>`;

const section = (id, title, closedBy) => `
  <article class="sf-accordion sf-accordion--size-1" id="${id}">
    <h3 class="sf-accordion-heading"><button class="sf-accordion-trigger" type="button" aria-expanded="false">
      <span class="sf-accordion-title">${title}</span><i class="sf-icon" aria-hidden="true">chevron_right</i></button></h3>
    <div class="sf-accordion-content ${closedBy === 'class' ? 'hidden' : ''}" role="region" ${closedBy === 'attribute' ? 'hidden' : ''}>
      <a href="#x" id="${id}-link">Ссылка в разделе «${title}»</a></div>
  </article>`;

const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface);color:var(--sf-on-surface)}</style></head>
<body>
<sf-switch id="smart-switch" label="Уведомления" description="Письма о новых заказах"></sf-switch>
<sf-switch id="slot-switch"><span slot="label">Звук</span><span slot="description">Сигнал при сообщении</span></sf-switch>
<sf-switch id="aria-switch" aria-label="Тёмная тема"></sf-switch>
<sf-switch id="plain-switch" label="Без пояснения"></sf-switch>
<sf-switch id="inherited-switch" label="Показывать цены" description="Для всех разделов" inherited-value="on"></sf-switch>
${classSwitch}
<span id="outer-label">Комментарий снаружи</span>
<sf-input-textarea id="aria-textarea" aria-label="Комментарий к заказу"></sf-input-textarea>
<sf-input-textarea id="labelledby-textarea" aria-labelledby="outer-label"></sf-input-textarea>
<sf-input-textarea id="label-textarea" label="Видимая подпись" aria-label="Другое имя"></sf-input-textarea>
<div class="sf-accordion-group" id="group">${section('by-class', 'Классом', 'class')}${section('by-attribute', 'Атрибутом', 'attribute')}</div>
${classQuantity}
<sf-input-quantity id="smart-quantity" label="Smart количество" value="2"></sf-input-quantity>
</body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

// The computed name and description of the element the selector finds.
async function axOf(tab, cdp, selector) {
  const {root} = await cdp.send('DOM.getDocument', {depth: -1});
  const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
  if (!nodeId) return null;
  const {nodes} = await cdp.send('Accessibility.getPartialAXTree', {nodeId, fetchRelatives: false});
  const node = nodes.find((one) => !one.ignored) || nodes[0];
  const value = (field) => node?.[field]?.value ?? '';
  return {role: value('role'), name: String(value('name')).trim(), description: String(value('description')).trim(), ignored: Boolean(node?.ignored)};
}

for (const theme of ['light', 'dark']) {
  page = shell(theme);
  const context = await browser.newContext({viewport: {width: 900, height: 1200}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('response', (r) => { if (r.status() === 404 && !/\.woff2$/u.test(r.url())) errors.push(`404 ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => ['sf-switch', 'sf-input-textarea', 'sf-input-quantity'].every((tag) => customElements.get(tag))
    && document.querySelector('#smart-switch input') && document.querySelector('#aria-textarea textarea')
    && document.querySelector('#smart-quantity input') && document.querySelector('#class-quantity-root input')?.id && document.getElementById('by-class')?.dataset.sfAccordionInit === '1', null, {timeout: 20000});
  await tab.waitForTimeout(400);
  const cdp = await context.newCDPSession(tab);
  const t = `[${theme}]`;

  // sf-switch
  let ax = await axOf(tab, cdp, '#smart-switch input');
  ok(`${t} switch: the name is the label alone`, ax?.name === 'Уведомления', ax);
  ok(`${t} switch: the description is the description`, ax?.description === 'Письма о новых заказах', ax);
  ok(`${t} switch: the role is switch`, ax?.role === 'switch', ax);
  ax = await axOf(tab, cdp, '#slot-switch input');
  ok(`${t} switch, slots: the name is the label slot`, ax?.name === 'Звук' && ax.description === 'Сигнал при сообщении', ax);
  ax = await axOf(tab, cdp, '#aria-switch input');
  ok(`${t} switch, aria-label: named by it, no description`, ax?.name === 'Тёмная тема' && ax.description === '', ax);
  ax = await axOf(tab, cdp, '#plain-switch input');
  ok(`${t} switch without a description: the label, nothing described`, ax?.name === 'Без пояснения' && ax.description === '', ax);
  ax = await axOf(tab, cdp, '#inherited-switch input');
  ok(`${t} inherited switch: neither the marker nor the reset is in the name`, ax?.name === 'Показывать цены', ax);
  ok(`${t} inherited switch: the description is still read`, /Для всех разделов/u.test(ax?.description || ''), ax);
  ax = await axOf(tab, cdp, '#class-switch input');
  ok(`${t} class switch: the label alone and the description`, ax?.name === 'Рассылка' && ax.description === 'Раз в неделю', ax);
  // A description that changes after the first paint is followed.
  await tab.evaluate(() => document.getElementById('smart-switch').setAttribute('description', 'Только важные письма'));
  await tab.waitForTimeout(200);
  ax = await axOf(tab, cdp, '#smart-switch input');
  ok(`${t} switch: a changed description is followed`, ax?.name === 'Уведомления' && ax.description === 'Только важные письма', ax);
  await tab.evaluate(() => document.getElementById('smart-switch').removeAttribute('description'));
  await tab.waitForTimeout(200);
  ax = await axOf(tab, cdp, '#smart-switch input');
  const dangling = await tab.evaluate(() => (document.querySelector('#smart-switch input').getAttribute('aria-describedby') || '').split(/\s+/u).filter(Boolean).filter((id) => !document.getElementById(id)));
  ok(`${t} switch: a removed description leaves nothing behind`, ax?.name === 'Уведомления' && ax.description === '' && dangling.length === 0, {ax, dangling});
  // The press still flips it: the label is unchanged.
  const flipped = await tab.evaluate(() => { const host = document.getElementById('smart-switch'); host.querySelector('.sf-switch-container').click(); return host.querySelector('input').checked; });
  ok(`${t} switch: a press on the label still flips it`, flipped === true);

  // sf-input-textarea
  ax = await axOf(tab, cdp, '#aria-textarea textarea');
  ok(`${t} textarea: the host's aria-label names the textarea`, ax?.name === 'Комментарий к заказу', ax);
  ax = await axOf(tab, cdp, '#labelledby-textarea textarea');
  ok(`${t} textarea: the host's aria-labelledby names the textarea`, ax?.name === 'Комментарий снаружи', ax);
  ax = await axOf(tab, cdp, '#label-textarea textarea');
  ok(`${t} textarea: a visible label wins over aria-label`, ax?.name === 'Видимая подпись', ax);
  await tab.evaluate(() => document.getElementById('aria-textarea').setAttribute('aria-label', 'Новое имя'));
  await tab.waitForTimeout(200);
  ax = await axOf(tab, cdp, '#aria-textarea textarea');
  ok(`${t} textarea: a changed aria-label is followed`, ax?.name === 'Новое имя', ax);

  // .sf-accordion
  const panel = await tab.evaluate(() => {
    const content = document.querySelector('#by-class .sf-accordion-content');
    return {hidden: content.hidden, shown: getComputedStyle(content).display !== 'none', expanded: document.querySelector('#by-class .sf-accordion-trigger').getAttribute('aria-expanded')};
  });
  ok(`${t} accordion: a panel closed by the class carries the hidden attribute`, panel.hidden === true && !panel.shown && panel.expanded === 'false', panel);
  ax = await axOf(tab, cdp, '#by-class-link');
  ok(`${t} accordion: its content is out of the accessibility tree`, !ax || ax.ignored, ax);
  const tabbable = await tab.evaluate(async () => {
    document.querySelector('#by-class .sf-accordion-trigger').focus();
    return document.activeElement?.id || document.activeElement?.className;
  });
  await tab.keyboard.press('Tab');
  const next = await tab.evaluate(() => document.activeElement?.id || document.activeElement?.className || '');
  ok(`${t} accordion: Tab from the closed heading skips its content`, next !== 'by-class-link', {from: tabbable, to: next});
  await tab.click('#by-class .sf-accordion-trigger');
  const opened = await tab.evaluate(() => {
    const content = document.querySelector('#by-class .sf-accordion-content');
    return {hidden: content.hidden, hasClass: content.classList.contains('hidden'), shown: getComputedStyle(content).display !== 'none'};
  });
  ok(`${t} accordion: it still opens`, !opened.hidden && !opened.hasClass && opened.shown, opened);

  // Quantity ids (#41)
  const ids = await tab.evaluate(() => {
    const all = [...document.querySelectorAll('[id]')].map((node) => node.id);
    const twice = [...new Set(all.filter((id, index) => all.indexOf(id) !== index))];
    const classInput = document.querySelector('#class-quantity-root input');
    const smartInput = document.querySelector('#smart-quantity input');
    return {twice, classId: classInput?.id, smartId: smartInput?.id, classLabels: [...(classInput?.labels || [])].map((label) => label.id || label.className), smartLabels: [...(smartInput?.labels || [])].map((label) => label.closest('sf-input-quantity')?.id || 'class')};
  });
  ok(`${t} no id twice on the page`, ids.twice.length === 0, ids);
  ok(`${t} class and Smart quantity take different ids`, ids.classId && ids.smartId && ids.classId !== ids.smartId, ids);
  ax = await axOf(tab, cdp, '#class-quantity-root input');
  const smartAx = await axOf(tab, cdp, '#smart-quantity input');
  ok(`${t} each quantity's label names its own field`, ax?.name === 'Классовое количество' && smartAx?.name === 'Smart количество', {class: ax, smart: smartAx});

  ok(`${t} no page errors`, errors.length === 0, errors);
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((one) => !one.pass);
console.log(JSON.stringify({passed: results.length - failed.length, failed}, null, 2));
if (failed.length) process.exit(1);

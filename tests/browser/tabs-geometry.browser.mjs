#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-tabs (owner, 2026-10-14), measured on the built bytes:
// - underline tabs have no inline padding; label to label is the gap of the
//   size, 20/24/32px at 1/2, 1, 2; heights 32/40/48; the line 2/2/3px; the
//   tab's own font is its size's text role;
// - overflow="more" moves what does not fit into «Ещё (n)», the active tab
//   always staying, and choosing in that menu activates the tab;
// - a count is drawn after the label; a link tab is aria-current when active;
// - configurable: setSettings orders and hides tabs (unknown keys ignored,
//   unnamed items appended, pinned never hidden, an active hidden tab shown),
//   the settings menu lists every tab, and a visibility change is announced.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/tabs/css/tabs.css', 'smart/smart/tabs/css/tabs.css', 'component/component/context-menu/css/context-menu.css',
  'component/component/checkbox/css/checkbox.css', 'smart/smart/sortable/css/sortable.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/checkbox/js/checkbox.js', 'smart/smart/context-menu/js/context-menu.js',
  'smart/smart/sortable/js/sortable.js', 'smart/smart/tabs/js/tabs.js'];

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
    ${['1/2', '1', '2'].map((size) => `<sf-tabs class="g" data-s="${size}" type="underline" size="${size}" items="Обзор|Настройки|История"></sf-tabs>`).join('<br>')}
    <div style="width:360px;display:flex"><sf-tabs id="more" style="flex:1;min-width:0" type="underline" size="1/2" overflow="more"></sf-tabs></div>
    <sf-tabs id="conf" type="underline" size="1/2" configurable></sf-tabs>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-tabs'), null, {timeout: 8000});
  await page.waitForTimeout(800);

  const geometry = await page.evaluate(() => [...document.querySelectorAll('sf-tabs.g')].map((tabs) => {
    const buttons = [...tabs.querySelectorAll('[role="tab"]')];
    const label = (at) => buttons[at].querySelector('.sf-button-text-container').getBoundingClientRect();
    const style = getComputedStyle(buttons[0]);
    return {size: tabs.dataset.s, height: Math.round(buttons[0].getBoundingClientRect().height),
      padding: style.paddingLeft, gap: Math.round(label(1).left - label(0).right), line: style.borderBottomWidth, font: style.fontSize};
  }));
  const want = {'1/2': [32, 20, '2px'], 1: [40, 24, '2px'], 2: [48, 32, '3px']};
  for (const entry of geometry) {
    const [height, gap, line] = want[entry.size];
    if (entry.height !== height || entry.gap !== gap || entry.line !== line || entry.padding !== '0px' || entry.font === '13.3333px') {
      note({case: 'underline geometry', got: entry, expected: {height, gap, line, padding: '0px'}});
    }
  }

  // «Ещё»: eight tabs in 360px, the seventh active.
  const more = await page.evaluate(async () => {
    const tabs = document.getElementById('more');
    tabs.setItems(['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая', 'Седьмая', 'Восьмая'].map((label, at) => ({key: `t${at}`, label, count: at === 1 ? 3 : undefined})));
    tabs.setAttribute('active-index', '6');
    await new Promise((done) => setTimeout(done, 400));
    const indexOf = (host) => Number((host.dataset.sfTabIndex ?? host.querySelector('[data-sf-tab-index]')?.dataset.sfTabIndex));
    const shown = [...tabs.querySelectorAll('.sf-tabs-top > :not(.sf-tabs-overflowed)')].map(indexOf).filter(Number.isInteger);
    const button = tabs.querySelector('.sf-tabs-more');
    const list = tabs.querySelector('.sf-tabs-top').getBoundingClientRect();
    const count = tabs.querySelector('.sf-tabs-count')?.textContent;
    // The trigger is one line on the tab row's height.
    const inner = button?.querySelector('button');
    const text = inner?.querySelector('.sf-button-text-container');
    const tab = tabs.querySelector('.sf-tabs-top [role="tab"]');
    const trigger = inner ? {height: Math.round(inner.getBoundingClientRect().height), tab: Math.round(tab.getBoundingClientRect().height),
      lines: text ? Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)) : null,
      bottom: Math.round(inner.getBoundingClientRect().bottom - tab.getBoundingClientRect().bottom)} : null;
    return {shown, more: button && !button.hidden ? button.getAttribute('text') : null, right: Math.round(list.right), count, trigger};
  });
  if (!more.trigger || more.trigger.height !== more.trigger.tab || more.trigger.lines !== 1 || more.trigger.bottom !== 0) note({case: '«Ещё» is one line on the row height', got: more.trigger});
  if (!more.more || !more.shown.includes(6) || more.shown.length >= 8 || more.count !== '3') note({case: 'overflow more', got: more});
  await page.click('#more .sf-tabs-more button');
  await page.waitForTimeout(300);
  const menu = await page.evaluate(() => [...document.querySelectorAll('sf-context-menu .sf-context-menu-item-label')].map((node) => node.textContent.trim()));
  const hiddenLabels = ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая', 'Седьмая', 'Восьмая'].filter((_, at) => !more.shown.includes(at));
  if (menu.join() !== hiddenLabels.join()) note({case: 'the «Ещё» menu lists what does not fit', got: menu, expected: hiddenLabels});
  await page.evaluate(() => [...document.querySelectorAll('sf-context-menu .sf-context-menu-item')].pop()?.click());
  await page.waitForTimeout(300);
  const chosen = await page.evaluate(() => document.getElementById('more').getAttribute('active-index'));
  if (chosen !== '7') note({case: 'choosing in «Ещё» activates the tab', got: chosen});

  // Settings.
  const conf = await page.evaluate(async () => {
    const tabs = document.getElementById('conf');
    window.settings = [];
    tabs.addEventListener('sf-tabs-settings-change', (event) => window.settings.push({order: event.detail.order, hidden: event.detail.hidden, reason: event.detail.reason}));
    tabs.setItems([{key: 'a', label: 'A', pinned: true}, {key: 'b', label: 'B'}, {key: 'c', label: 'C', href: '#c'}, {key: 'd', label: 'D'}]);
    tabs.setSettings({order: ['zz', 'd', 'c', 'b'], hidden: ['b', 'a']});
    await new Promise((done) => setTimeout(done, 300));
    const order = () => [...tabs.querySelectorAll('.sf-tabs-top > *')].map((host) => host.textContent.trim()).filter(Boolean);
    const first = order();
    tabs.setAttribute('active-index', '1');
    await new Promise((done) => setTimeout(done, 300));
    const activeHidden = order();
    tabs.setAttribute('active-index', '2');
    await new Promise((done) => setTimeout(done, 300));
    const linkCurrent = tabs.querySelector('[role="tab"][aria-current="page"]')?.textContent.trim() ?? null;
    return {first, activeHidden, linkCurrent, gear: tabs.querySelector('.sf-tabs-settings button')?.getAttribute('aria-label') ?? tabs.querySelector('.sf-tabs-settings')?.getAttribute('aria-label')};
  });
  if (conf.first.join() !== 'D,C,A') note({case: 'setSettings orders and hides', got: conf.first, expected: 'D,C,A (zz ignored, b hidden, pinned a never hidden, appended)'});
  if (conf.activeHidden.join() !== 'D,C,B,A') note({case: 'an active hidden tab is shown in place', got: conf.activeHidden});
  if (conf.linkCurrent !== 'C') note({case: 'a link tab is aria-current when active', got: conf.linkCurrent});
  if (conf.gear !== 'Настроить вкладки') note({case: 'the gear is named', got: conf.gear});
  await page.click('#conf .sf-tabs-settings button');
  await page.waitForTimeout(600);
  const list = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.sf-tabs-settings-row')];
    return {rows: rows.map((row) => row.textContent.trim().replace(/\s+/gu, ' ')), boxes: rows.map((row) => Boolean(row.querySelector('sf-checkbox'))),
      footer: Boolean(document.querySelector('.sf-tabs-settings-body')?.closest('sf-context-menu')?.querySelector('.sf-context-menu-footer'))};
  });
  if (list.rows.length !== 4 || list.boxes.join() !== 'true,true,true,false' || !list.footer) note({case: 'the settings list', got: list});
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.sf-tabs-settings-row')].find((entry) => entry.textContent.includes('B'));
    (row?.querySelector('input[type="checkbox"]') ?? row?.querySelector('sf-checkbox'))?.click();
  });
  await page.waitForTimeout(300);
  const announced = await page.evaluate(() => window.settings);
  if (!announced.length || announced.at(-1).reason !== 'visibility' || announced.at(-1).hidden.includes('b')) {
    note({case: 'showing a tab is announced', got: announced});
  }
  console.log(JSON.stringify({geometry, more, menu, chosen, conf, list, announced}, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TABS_GEOMETRY_OK');

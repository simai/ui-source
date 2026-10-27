#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The tab's own colour is its label's ink (simai/ui-source#23), measured on the
// built bytes. The ui-mail visual audit read sf-tabs labels as raw #000 in the
// light theme and #fff in the dark: the label and the icon carried their roles,
// but the button element under them kept the browser's ButtonText, and an icon
// tab its icon button's resting grey. Here, in both themes, for every skin
// (default, underline, pills, full, vertical), every scheme (default, outline,
// link) and both variants (text, icons):
//   - the tab element's colour equals its label's colour (the icon's, for an
//     icon tab) for the selected, the resting and the disabled tab;
//   - the same under the pointer, for underline, full and outline tabs;
//   - an underline tab's colour is --sf-on-surface at rest and
//     --sf-on-surface-active when selected, resolved in the theme; no text tab
//     computes the browser's ButtonText.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/tabs/css/tabs.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/icon-button/js/icon-button.js', 'smart/smart/tabs/js/tabs.js'];
const TYPES = ['', 'underline', 'pills', 'full', 'vertical'];
const SCHEMES = ['default', 'outline', 'link'];
const VARIANTS = ['', 'icons'];
const ITEMS = 'Один::icon=home|Два::icon=star|Три::icon=edit,disabled';

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
    const body = TYPES.flatMap((type) => SCHEMES.flatMap((scheme) => VARIANTS.map((variant) =>
      `<sf-tabs data-k="${type || 'default'}/${scheme}/${variant || 'text'}" ${type ? `type="${type}"` : ''} scheme="${scheme}"
        ${variant ? 'variant="icons"' : ''} items="${ITEMS}" aria-label="Вкладки"></sf-tabs>`))).join('');
    await page.setContent(`<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"></head><body style="margin:16px">${body}<i id="role"></i></body></html>`);
    for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
    for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
    await page.waitForFunction((count) => document.querySelectorAll('.sf-tabs-top :is(.sf-button, .sf-icon-button)').length === count,
      TYPES.length * SCHEMES.length * VARIANTS.length * 3);
    await page.waitForTimeout(300);

    const READ = `(tab) => {
      const label = tab.querySelector('.sf-button-text-container') || tab.querySelector('.sf-icon');
      return {tab: getComputedStyle(tab).color, label: getComputedStyle(label).color};
    }`;
    const roles = await page.evaluate(() => Object.fromEntries(['--sf-on-surface', '--sf-on-surface-active'].map((name) => {
      const probe = document.getElementById('role');
      probe.style.color = `var(${name})`;
      return [name, getComputedStyle(probe).color];
    })));
    const buttonText = await page.evaluate(() => {
      const probe = document.getElementById('role');
      probe.style.color = 'ButtonText';
      return getComputedStyle(probe).color;
    });
    const rows = await page.evaluate((read) => [...document.querySelectorAll('sf-tabs')].flatMap((host) =>
      [...host.querySelectorAll('.sf-tabs-top :is(.sf-button, .sf-icon-button)')].map((tab, index) => ({
        key: host.dataset.k, index, selected: tab.classList.contains('selected'), disabled: tab.disabled,
        ...eval(read)(tab)}))), READ);
    let matched = 0;
    for (const row of rows) {
      const at = `${theme} ${row.key} tab ${row.index}${row.selected ? ' (selected)' : ''}${row.disabled ? ' (disabled)' : ''}`;
      check(`${at}: the tab's colour is its label's`, row.tab === row.label, row);
      if (row.tab === row.label) matched += 1;
      if (row.key.endsWith('/text')) check(`${at}: not the browser's ButtonText`, row.tab !== buttonText || row.label === buttonText, {...row, buttonText});
      if (row.key.startsWith('underline/') && !row.disabled) {
        const role = row.selected ? '--sf-on-surface-active' : '--sf-on-surface';
        check(`${at}: an underline tab takes ${role}`, row.tab === roles[role], {...row, expected: roles[role]});
      }
    }

    // Under the pointer: the resting tab of underline, full and outline rows.
    const hovered = [];
    for (const key of ['underline/default/text', 'underline/default/icons', 'full/default/text', 'full/default/icons',
      'default/outline/text', 'default/link/text']) {
      const selector = `sf-tabs[data-k="${key}"] .sf-tabs-top :is(.sf-button, .sf-icon-button) >> nth=1`;
      await page.hover(selector);
      // The control eases its colours in; read them once the transition is over
      // (given up to two seconds, so a loaded machine reads the settled colour).
      await page.waitForTimeout(600);
      await page.waitForFunction(({key, read}) => {
        const row = eval(read)(document.querySelectorAll(`sf-tabs[data-k="${key}"] .sf-tabs-top :is(.sf-button, .sf-icon-button)`)[1]);
        return row.tab === row.label;
      }, {key, read: READ}, {timeout: 2000}).catch(() => {});
      const row = await page.evaluate(({key, read}) => eval(read)(document.querySelectorAll(`sf-tabs[data-k="${key}"] .sf-tabs-top :is(.sf-button, .sf-icon-button)`)[1]), {key, read: READ});
      hovered.push({key, ...row});
      check(`${theme} ${key} hovered tab: the tab's colour is its label's`, row.tab === row.label, row);
    }
    await page.mouse.move(0, 0);
    evidence[theme] = {tabs: rows.length, matched, roles, buttonText, hovered};
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 40), count: failures.length}, null, 1)); process.exit(1); }
console.log('TABS_INK_OK');

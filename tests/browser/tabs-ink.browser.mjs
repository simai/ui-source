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
//   - an underline tab's colour is --sf-on-surface-variant at rest and
//     --sf-on-surface when selected, resolved in the theme, and the selected
//     tab's line is --sf-primary, at least 2px; no text tab
//     computes the browser's ButtonText.
//
// Pills (owner, effects.simai.io, 2026-11-01): the selected pill is the only
// filled one. In both themes, with the default theme colour and a green one,
// for every scheme and both variants:
//   - a resting unselected pill has a transparent background and border, and
//     its label reads on the page at 4.5:1 or more;
//   - the selected pill is filled with --sf-primary-active, and its label
//     reads on that fill at 4.5:1 or more;
//   - under the pointer an unselected pill takes the surface state layer
//     (--sf-surface-transparent-hover), not a fill of the theme colour.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';
import {themeFromColor, themeVariables} from '../../src/core/js/theme-palette.js';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/tabs/css/tabs.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js', 'smart/smart/tabs/js/tabs.js'];
const TYPES = ['', 'underline', 'pills', 'full', 'vertical'];
const SCHEMES = ['default', 'outline', 'link'];
const VARIANTS = ['', 'icons'];
const ITEMS = 'Один::icon=home|Два::icon=star|Три::icon=edit,disabled';

// A green theme colour, as effects.simai.io offers it, for the pills.
const GREEN = themeVariables(themeFromColor('#2e7d32'));

// Every pill tab of the page: its background, border, ink and state, and the
// page and the selected fill resolved in the theme.
const PILLS = () => {
  const probe = document.getElementById('role');
  probe.style.backgroundColor = 'var(--sf-primary-active)';
  const fill = getComputedStyle(probe).backgroundColor;
  probe.style.backgroundColor = '';
  const rows = [...document.querySelectorAll('sf-tabs[type="pills"]')].flatMap((host) =>
    [...host.querySelectorAll('.sf-tabs-top :is(.sf-button, .sf-icon-button)')].map((tab, index) => {
      const style = getComputedStyle(tab);
      const label = tab.querySelector('.sf-button-text-container') || tab.querySelector('.sf-icon');
      return {key: host.dataset.k.replace(/^pills\//u, ''), index, selected: tab.classList.contains('selected'),
        disabled: tab.disabled, background: style.backgroundColor, border: style.borderTopColor, ink: getComputedStyle(label).color};
    }));
  const body = getComputedStyle(document.body).backgroundColor;
  return {rows, fill, page: /^rgba\(.*, 0\)$/u.test(body) || body === 'transparent'
    ? getComputedStyle(document.documentElement).backgroundColor : body};
};
const parse = (colour) => {
  const parts = String(colour).match(/[\d.]+/gu)?.map(Number) ?? [0, 0, 0, 0];
  return {r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1};
};
const transparent = (colour) => parse(colour).a === 0;
const over = (top, bottom) => {
  const a = parse(top);
  const b = typeof bottom === 'string' ? parse(bottom) : bottom;
  return {r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1};
};
const luminance = ({r, g, b}) => {
  const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (ink, background, page) => {
  const ground = over(background, transparent(page) ? {r: 255, g: 255, b: 255, a: 1} : page);
  const one = luminance(over(ink, ground));
  const two = luminance(ground);
  return Math.round(((Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)) * 100) / 100;
};

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
      const style = getComputedStyle(tab);
      return {tab: style.color, label: getComputedStyle(label).color, line: style.borderBottomColor, lineWidth: style.borderBottomWidth};
    }`;
    const roles = await page.evaluate(() => Object.fromEntries(['--sf-on-surface', '--sf-on-surface-variant', '--sf-primary'].map((name) => {
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
        const role = row.selected ? '--sf-on-surface' : '--sf-on-surface-variant';
        check(`${at}: an underline tab takes ${role}`, row.tab === roles[role], {...row, expected: roles[role]});
        if (row.selected) check(`${at}: the selected underline tab's line is --sf-primary, at least 2px`,
          row.line === roles['--sf-primary'] && parseFloat(row.lineWidth) >= 2, {...row, expected: roles['--sf-primary']});
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

    // Pills: the selected one is the only filled one, with the default theme
    // colour and with a green one.
    evidence[theme].pills = {};
    for (const [colour, variables] of [['default', null], ['green', GREEN]]) {
      if (variables) {
        await page.evaluate((variables) => {
          for (const [name, value] of Object.entries(variables)) document.documentElement.style.setProperty(name, value);
        }, variables);
        await page.waitForTimeout(600);
      }
      const pills = await page.evaluate(PILLS);
      evidence[theme].pills[colour] = {count: pills.rows.length, fill: pills.fill};
      check(`${theme} ${colour}: pill rows were read`, pills.rows.length === SCHEMES.length * VARIANTS.length * 3, {count: pills.rows.length});
      for (const row of pills.rows) {
        if (row.disabled) continue;
        const at = `${theme} ${colour} pills/${row.key} tab ${row.index}${row.selected ? ' (selected)' : ''}`;
        if (row.selected) {
          check(`${at}: the selected pill is filled with --sf-primary-active`, row.background === pills.fill && !transparent(row.background),
            {...row, expected: pills.fill});
          check(`${at}: its label reads on the fill at 4.5:1`, contrast(row.ink, row.background, pills.page) >= 4.5,
            {...row, ratio: contrast(row.ink, row.background, pills.page)});
        } else {
          check(`${at}: an unselected pill has no fill`, transparent(row.background), row);
          check(`${at}: an unselected pill has no border`, transparent(row.border), row);
          check(`${at}: its label reads on the page at 4.5:1`, contrast(row.ink, row.background, pills.page) >= 4.5,
            {...row, ratio: contrast(row.ink, row.background, pills.page)});
        }
      }
      for (const key of ['default/text', 'outline/text', 'default/icons']) {
        await page.hover(`sf-tabs[data-k="pills/${key}"] .sf-tabs-top :is(.sf-button, .sf-icon-button) >> nth=1`);
        await page.waitForTimeout(600);
        const row = await page.evaluate((key) => {
          const tab = document.querySelectorAll(`sf-tabs[data-k="pills/${key}"] .sf-tabs-top :is(.sf-button, .sf-icon-button)`)[1];
          const probe = document.getElementById('role');
          probe.style.backgroundColor = 'var(--sf-surface-transparent-hover)';
          return {background: getComputedStyle(tab).backgroundColor, layer: getComputedStyle(probe).backgroundColor};
        }, key);
        check(`${theme} ${colour} pills/${key}: a hovered unselected pill takes the surface state layer`, row.background === row.layer, row);
      }
      await page.mouse.move(0, 0);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 40), count: failures.length}, null, 1)); process.exit(1); }
console.log('TABS_INK_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-modal draws at the end of the body, and looks as it would where it is
// declared (simai/ui-source#46 item 1; stand 21 A7.11/A7.12), light and dark:
//   - an area (an assembly) that retunes a role (--sf-primary), sets a part's
//     public variable (--sf-button-background-color) and a page variable of
//     its own (--brand): the window's content reads all three in the portal;
//   - the window's own public variable set on the area reaches the surface;
//   - a .theme-dark area: the portal carries the theme, the surface is dark;
//   - a window declared outside the area carries none of it;
//   - a window opened from inside another window takes the outer area's
//     values, but none of the outer window's private --sf-modal--* names;
//   - a host moved out of the area and opened again gives the values back;
//   - sf-drawer, the other window on the same core rule (carryLayerOrigin
//     area), carries the area's values to its panel's content, none of its
//     private --sf-drawer--* names, and a drawer outside the area none of it.
// With SF_EVIDENCE=<dir>, a screenshot per theme lands there.
import {join, resolve} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE || '';
const styles = ['core/core/css/core.css', 'component/component/modal/css/modal.css', 'component/component/buttons/css/buttons.css', 'smart/smart/drawer/css/drawer.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/button/js/button.js', 'smart/smart/modal/js/modal.js', 'smart/smart/drawer/js/drawer.js'];
const absent = [...styles, ...modules].map((p) => join(out, p)).filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const content = (id) => `<div slot="content"><p id="${id}-brand" style="color: var(--brand, rgb(9, 9, 9))">Brand</p>`
  + `<p id="${id}-primary" style="color: var(--sf-primary)">Primary</p>`
  + `<sf-button id="${id}-button" text="Button"></sf-button></div>`;
const drawerContent = (id) => `<p id="${id}-brand" style="color: var(--brand, rgb(9, 9, 9))">Brand</p>`
  + `<p id="${id}-primary" style="color: var(--sf-primary)">Primary</p>`;
const html = (theme) => `<!doctype html><html class="theme-${theme}" lang="en"><head><meta charset="utf-8">`
  // The page keeps the theme it is written with: Core would follow the
  // system's preference otherwise.
  + '<script>window.SF_BOOT_CONFIG = {theme: false};</script>'
  + styles.map((p) => `<link rel="stylesheet" href="/${p}">`).join('')
  + '<style>body{margin:0;padding:24px;background:var(--sf-surface-0);color:var(--sf-on-surface)}'
  + '#area{--sf-primary: rgb(200, 0, 0); --brand: rgb(1, 120, 3); --sf-button-background-color: rgb(0, 90, 200); --sf-modal-background-color: rgb(220, 232, 255)}</style>'
  + '</head><body>'
  + `<section id="area"><sf-modal id="m-area" title="In the area">${content('a')}`
  + '<button slot="footer" id="open-inner" type="button" data-sf-modal-open="m-inner">Inner</button></sf-modal>'
  + `<sf-modal id="m-inner" title="Opened from the window">${content('i')}</sf-modal>`
  + `<sf-drawer id="d-area" title="Drawer in the area">${drawerContent('da')}</sf-drawer></section>`
  + `<sf-drawer id="d-out" title="Drawer outside">${drawerContent('do')}</sf-drawer>`
  + `<section id="dark" class="theme-${theme === 'dark' ? 'light' : 'dark'}"><sf-modal id="m-dark" title="Other theme">${content('d')}</sf-modal></section>`
  + `<sf-modal id="m-out" title="Outside">${content('o')}</sf-modal>`
  + modules.map((p) => `<script type="module" src="/${p}"></script>`).join('')
  + '</body></html>';

const failures = [];
const missing = new Set();
const seen = {};
const expect = (name, got, wanted) => {
  if (JSON.stringify(got) !== JSON.stringify(wanted)) failures.push({case: name, got, expected: wanted});
};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 1000, height: 800}});
    page.on('pageerror', (error) => failures.push({case: `${theme}: page error`, got: String(error)}));
    page.on('console', (message) => { if (message.type() === 'error') failures.push({case: `${theme}: console error`, got: message.text()}); });
    const origin = 'http://probe.test';
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html(theme)});
      // The Loader asks for the parts' code and sheets under the core's base
      // (/core/component/…, /core/smart/…): served from the build's folders.
      const wanted = decodeURIComponent(url.pathname).replace(/^\/core\/(component|utility|smart|rule)\//u, '/$1/$1/');
      const path = join(out, wanted);
      return existsSync(path)
        ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
        : (missing.add(url.pathname), route.fulfill({status: 404, body: ''}));
    });
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => customElements.get('sf-modal') && customElements.get('sf-button') && customElements.get('sf-drawer'), null, {timeout: 10000});
    await page.waitForTimeout(300);
    const look = (id, prefix) => page.evaluate(([id, prefix]) => {
      const portal = document.querySelector(`[data-sf-modal-portal="${id}"]`);
      const surface = portal?.querySelector('.sf-modal-surface');
      const color = (sel) => { const node = portal?.querySelector(sel); return node ? getComputedStyle(node).color : null; };
      const button = portal?.querySelector(`#${prefix}-button button`);
      return {
        surface: surface ? getComputedStyle(surface).backgroundColor : null,
        brand: color(`#${prefix}-brand`),
        primary: color(`#${prefix}-primary`),
        button: button ? getComputedStyle(button).backgroundColor : null,
        dark: portal?.classList.contains('theme-dark') ?? null,
        carried: (portal?.getAttribute('style') || '').match(/--[\w-]+/gu)?.filter((name) => name.startsWith('--sf-modal-')) ?? [],
      };
    }, [id, prefix]);
    const open = async (id) => { await page.evaluate((id) => document.getElementById(id).open(), id); await page.waitForTimeout(500); };
    const close = async (id) => { await page.evaluate((id) => document.getElementById(id).close(), id); await page.waitForTimeout(500); };

    await open('m-out');
    const outside = await look('m-out', 'o');
    await close('m-out');
    await open('m-area');
    const area = await look('m-area', 'a');
    if (evidence) await page.screenshot({path: join(evidence, `modal-assembly-${theme}.png`)});
    await page.click('#open-inner');
    await page.waitForTimeout(500);
    const inner = await look('m-inner', 'i');
    await close('m-inner');
    await close('m-area');
    await open('m-dark');
    const other = await look('m-dark', 'd');
    if (evidence) await page.screenshot({path: join(evidence, `modal-other-theme-${theme}.png`)});
    await close('m-dark');
    // Moved out of the area, the same window takes the page's values again.
    await page.evaluate(() => document.body.append(document.getElementById('m-area')));
    await open('m-area');
    const moved = await look('m-area', 'a');
    await close('m-area');
    const drawerLook = (id, prefix) => page.evaluate(([id, prefix]) => {
      const portal = document.querySelector(`[data-sf-drawer-portal="${id}"]`);
      const color = (sel) => { const node = portal?.querySelector(sel); return node ? getComputedStyle(node).color : null; };
      return {
        brand: color(`#${prefix}-brand`),
        primary: color(`#${prefix}-primary`),
        carried: (portal?.getAttribute('style') || '').match(/--[\w-]+/gu)?.filter((name) => name.startsWith('--sf-drawer--')) ?? [],
      };
    }, [id, prefix]);
    await open('d-area');
    const drawerArea = await drawerLook('d-area', 'da');
    if (evidence) await page.screenshot({path: join(evidence, `drawer-assembly-${theme}.png`)});
    await close('d-area');
    await open('d-out');
    const drawerOut = await drawerLook('d-out', 'do');
    await close('d-out');
    seen[theme] = {outside, area, inner, other, moved, drawerArea, drawerOut};
    expect(`${theme}: the area's variables reach the drawer's content`, {brand: drawerArea.brand, primary: drawerArea.primary, carried: drawerArea.carried},
      {brand: 'rgb(1, 120, 3)', primary: 'rgb(200, 0, 0)', carried: []});
    expect(`${theme}: a drawer outside the area takes none of it`, {brand: drawerOut.brand, primaryRetuned: drawerOut.primary === 'rgb(200, 0, 0)'},
      {brand: 'rgb(9, 9, 9)', primaryRetuned: false});

    expect(`${theme}: the area's variables reach the window's content`, {brand: area.brand, primary: area.primary, button: area.button, surface: area.surface},
      {brand: 'rgb(1, 120, 3)', primary: 'rgb(200, 0, 0)', button: 'rgb(0, 90, 200)', surface: 'rgb(220, 232, 255)'});
    expect(`${theme}: a window opened from the window stands in the same area`, {brand: inner.brand, primary: inner.primary, button: inner.button},
      {brand: 'rgb(1, 120, 3)', primary: 'rgb(200, 0, 0)', button: 'rgb(0, 90, 200)'});
    expect(`${theme}: no private --sf-modal--* name travels to the inner window`, inner.carried.filter((name) => name.startsWith('--sf-modal--')), []);
    expect(`${theme}: a window outside the area takes none of it`, {brand: outside.brand, primaryRetuned: outside.primary === 'rgb(200, 0, 0)', surface: outside.surface === 'rgb(220, 232, 255)'},
      {brand: 'rgb(9, 9, 9)', primaryRetuned: false, surface: false});
    expect(`${theme}: moved out of the area, the window gives the values back`, {brand: moved.brand, primaryRetuned: moved.primary === 'rgb(200, 0, 0)'},
      {brand: 'rgb(9, 9, 9)', primaryRetuned: false});
    expect(`${theme}: the other theme's area carries its theme`, {dark: other.dark, differs: other.surface !== outside.surface}, {dark: theme === 'light', differs: true});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(seen));
console.log(`not served: ${[...missing].sort().join(" ")}`);
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('MODAL_ASSEMBLY_VARIABLES_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The C36 follow-ups (accepted by DEV, 2026-11-10), measured on the built
// bytes through the Loader, light and dark, desktop (1440) and phone (390):
//   - a loading sf-button-icon keeps its scheme colour, as C36 made sf-button
//     do: fill, edge and edge width of the resting button in every appearance
//     x colour pair; the spinner takes the icon's colour; the button stays
//     natively disabled and busy. A disabled one, and one disabled and loading,
//     wear the disabled look and the disabled ink; turning disabled on and off
//     on a loading one moves between the two;
//   - the spinner's background ring (track) in sf-button and sf-button-icon is
//     the label's (the icon's) ink at 16 %, the fill family's step of the alpha
//     scale, drawn at full opacity, so it stays visible on a light filled
//     button in dark; in a disabled button it is the disabled ink at 16 %.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:0">${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

// sf-button-icon: four appearances, three schemes and the danger status.
const ICON_APPEARANCES = ['default', 'tonal', 'outline', 'ghost'];
const ICON_COLOURS = [['scheme', 'primary'], ['scheme', 'on-surface'], ['scheme', 'on-surface-variant'], ['status', 'danger']];
const iconCombos = ICON_APPEARANCES.flatMap((appearance) => ICON_COLOURS.map(([key, colour]) => ({appearance, key, colour})));
// sf-button: C36's 24 pairs (surface with on-surface-variant is retired).
const APPEARANCES = ['default', 'tonal', 'outline', 'ghost', 'surface'];
const COLOURS = [['scheme', 'primary'], ['scheme', 'secondary'], ['scheme', 'on-surface'], ['scheme', 'on-surface-variant'], ['status', 'danger']];
const buttonCombos = APPEARANCES.flatMap((appearance) => COLOURS
  .filter(([, colour]) => !(appearance === 'surface' && colour === 'on-surface-variant'))
  .map(([key, colour]) => ({appearance, key, colour})));

const iconRows = iconCombos.map(({appearance, key, colour}) => {
  const common = `appearance="${appearance}" ${key}="${colour}" icon="save" aria-label="Сохранить"`;
  return `<div data-icon-combo="${appearance}|${colour}" style="display:flex;gap:8px;margin:4px 0">
    <sf-button-icon data-role="rest" ${common}></sf-button-icon>
    <sf-button-icon data-role="loading" ${common} loading></sf-button-icon>
    <sf-button-icon data-role="disabled" ${common} disabled></sf-button-icon>
    <sf-button-icon data-role="disabled-loading" ${common} disabled loading></sf-button-icon>
    <sf-button-icon data-role="toggle" ${common} loading></sf-button-icon>
  </div>`;
}).join('');
const buttonRows = buttonCombos.map(({appearance, key, colour}) => {
  const common = `appearance="${appearance}" ${key}="${colour}" text="Сохранить"`;
  return `<div data-button-combo="${appearance}|${colour}" style="display:flex;gap:8px;margin:4px 0">
    <sf-button data-role="rest" ${common} icon-start="save"></sf-button>
    <sf-button data-role="loading" ${common} icon-start="save" loading></sf-button>
    <sf-button data-role="loading-text" ${common} loading></sf-button>
    <sf-button data-role="disabled-loading" ${common} icon-start="save" disabled loading></sf-button>
  </div>`;
}).join('');
const body = `<div style="padding:16px">${iconRows}${buttonRows}</div>`;
const pages = {'/light.html': pageOf(body, 'light'), '/dark.html': pageOf(body, 'dark')};

const failures = [];
const report = {};
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const READ = () => {
  // A host moves its data-* to the native button, so a role names the button
  // itself or a host that kept it.
  const button = (node) => (node.matches('button') ? node : node.querySelector('button'));
  // The colour a colour-mix of this ink at 16 % serialises to, for comparison.
  const mix16 = (ink) => { const probe = document.createElement('span'); probe.style.color = `color-mix(in srgb, ${ink} 16%, transparent)`; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; };
  const ink = (name) => { const probe = document.createElement('span'); probe.style.color = `var(${name})`; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; };
  const read = (host) => {
    const control = button(host);
    const style = getComputedStyle(control);
    const icon = control.querySelector('.sf-icon');
    const label = control.querySelector('.sf-button-text-container');
    const spinner = control.querySelector('.sf-icon-button-spinner, .sf-button-spinner');
    const accent = control.querySelector('.sf-loader-ring-accent');
    const track = control.querySelector('.sf-loader-ring-filled');
    return {
      background: style.backgroundColor,
      border: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      icon: icon ? getComputedStyle(icon).color : null,
      label: label ? getComputedStyle(label).color : null,
      spinner: spinner ? getComputedStyle(spinner).color : null,
      arc: accent ? getComputedStyle(accent).stroke : null,
      track: track ? getComputedStyle(track).stroke : null,
      trackOpacity: track ? getComputedStyle(track).opacity : null,
      trackShown: track ? getComputedStyle(track).display !== 'none' : null,
      disabled: control.disabled,
      busy: control.getAttribute('aria-busy'),
    };
  };
  const rows = (attr) => Object.fromEntries([...document.querySelectorAll(`[${attr}]`)].map((row) => [row.getAttribute(attr),
    Object.fromEntries([...row.querySelectorAll('[data-role]')].map((host) => [host.dataset.role, read(host)]))]));
  const icons = rows('data-icon-combo');
  const buttons = rows('data-button-combo');
  const expect = {};
  for (const [combo, row] of Object.entries(icons)) expect[`icon ${combo}`] = mix16(row.rest.icon);
  for (const [combo, row] of Object.entries(buttons)) expect[`button ${combo}`] = mix16(row.rest.label);
  const onDisable = ink('--sf-on-disable');
  return {icons, buttons, expect, onDisable, onDisable16: mix16(onDisable)};
};

try {
  for (const theme of ['light', 'dark']) {
    for (const [view, width] of [['desktop', 1440], ['phone', 390]]) {
      // The Loader follows the system scheme, so the page asks for the theme's.
      const page = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme});
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/${theme}.html`);
      await page.waitForFunction(() => ['sf-button', 'sf-button-icon'].every((tag) => customElements.get(tag)), null, {timeout: 15000});
      await page.waitForFunction(() => [...document.querySelectorAll('sf-button, sf-button-icon')].every((host) => host.querySelector('button')), null, {timeout: 15000});
      await page.waitForTimeout(400);
      const where = `${theme} ${view}`;
      const dark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
      if (dark !== (theme === 'dark')) failures.push({where, check: 'the page draws the asked theme', dark});
      const data = await page.evaluate(READ);

      // Turn disabled on, then off, on a loading sf-button-icon (the element
      // patches disabled in place).
      const host = (node) => node.closest('sf-button-icon') || node;
      await page.evaluate(() => { for (const node of document.querySelectorAll('[data-icon-combo] [data-role="toggle"]')) (node.closest('sf-button-icon') || node).setAttribute('disabled', ''); });
      await page.waitForTimeout(250);
      const toggledOn = await page.evaluate(READ);
      await page.evaluate(() => { for (const node of document.querySelectorAll('[data-icon-combo] [data-role="toggle"]')) (node.closest('sf-button-icon') || node).removeAttribute('disabled'); });
      await page.waitForTimeout(250);
      const toggledOff = await page.evaluate(READ);
      void host;

      report[where] = {
        icon: Object.fromEntries(Object.entries(data.icons).map(([combo, row]) => [combo, {
          rest: [row.rest.background, row.rest.border, row.rest.icon],
          loading: [row.loading.background, row.loading.border, row.loading.spinner, `track ${row.loading.track} x${row.loading.trackOpacity}`],
          disabled: [row.disabled.background, row.disabled.icon],
          disabledLoading: [row['disabled-loading'].background, row['disabled-loading'].spinner, `track ${row['disabled-loading'].track} x${row['disabled-loading'].trackOpacity}`],
        }])),
        button: Object.fromEntries(Object.entries(data.buttons).map(([combo, row]) => [combo, {
          rest: [row.rest.background, row.rest.label],
          loading: [row.loading.arc, `track ${row.loading.track} x${row.loading.trackOpacity}`],
        }])),
      };

      for (const [combo, row] of Object.entries(data.icons)) {
        const rest = row.rest; const loading = row.loading;
        for (const key of ['background', 'border', 'borderWidth']) {
          if (rest[key] !== loading[key]) failures.push({where, combo, check: `sf-button-icon loading ${key} is the resting one`, rest: rest[key], loading: loading[key]});
        }
        if (loading.spinner !== rest.icon || loading.arc !== rest.icon) failures.push({where, combo, check: 'sf-button-icon spinner takes the icon colour', icon: rest.icon, spinner: loading.spinner, arc: loading.arc});
        if (loading.busy !== 'true' || !loading.disabled) failures.push({where, combo, check: 'sf-button-icon loading is busy and natively disabled', busy: loading.busy, disabled: loading.disabled});
        if (row.disabled.icon !== data.onDisable) failures.push({where, combo, check: 'disabled sf-button-icon has the disabled ink', icon: row.disabled.icon, onDisable: data.onDisable});
        if (row.disabled.background === rest.background && rest.background !== 'rgba(0, 0, 0, 0)') failures.push({where, combo, check: 'disabled sf-button-icon is not the resting fill', background: rest.background});
        for (const key of ['background', 'border', 'borderWidth']) {
          if (row['disabled-loading'][key] !== row.disabled[key]) failures.push({where, combo, check: `disabled+loading sf-button-icon ${key} is the disabled one`, disabled: row.disabled[key], both: row['disabled-loading'][key]});
        }
        if (row['disabled-loading'].spinner !== data.onDisable) failures.push({where, combo, check: 'disabled+loading sf-button-icon spinner is the disabled ink', spinner: row['disabled-loading'].spinner});
        // The ring.
        const expected = data.expect[`icon ${combo}`];
        if (loading.track !== expected || loading.trackOpacity !== '1' || !loading.trackShown) failures.push({where, combo, check: 'sf-button-icon ring is the icon colour at 16 %, fully drawn', expected, track: loading.track, opacity: loading.trackOpacity});
        const dl = row['disabled-loading'];
        if (dl.track !== data.onDisable16 || dl.trackOpacity !== '1') failures.push({where, combo, check: 'disabled+loading sf-button-icon ring is the disabled ink at 16 %', expected: data.onDisable16, track: dl.track, opacity: dl.trackOpacity});
        // Disabled on and off on a loading one.
        const on = toggledOn.icons[combo].toggle; const off = toggledOff.icons[combo].toggle;
        for (const key of ['background', 'border']) {
          if (on[key] !== row.disabled[key]) failures.push({where, combo, check: `disabled turned on: loading sf-button-icon ${key} is the disabled one`, disabled: row.disabled[key], toggled: on[key]});
          if (off[key] !== rest[key]) failures.push({where, combo, check: `disabled turned off: loading sf-button-icon ${key} is the resting one`, rest: rest[key], toggled: off[key]});
        }
        if (on.spinner !== data.onDisable) failures.push({where, combo, check: 'disabled turned on: spinner is the disabled ink', spinner: on.spinner});
        if (off.spinner !== rest.icon || off.busy !== 'true' || !off.disabled) failures.push({where, combo, check: 'disabled turned off: spinner is the icon colour, still busy and disabled', spinner: off.spinner, busy: off.busy, disabled: off.disabled});
      }

      for (const [combo, row] of Object.entries(data.buttons)) {
        const expected = data.expect[`button ${combo}`];
        for (const role of ['loading', 'loading-text']) {
          const b = row[role];
          if (b.track !== expected || b.trackOpacity !== '1' || !b.trackShown) failures.push({where, combo, role, check: 'sf-button ring is the label colour at 16 %, fully drawn', expected, track: b.track, opacity: b.trackOpacity});
          if (b.arc !== row.rest.label) failures.push({where, combo, role, check: 'sf-button arc is the label ink', label: row.rest.label, arc: b.arc});
        }
        const dl = row['disabled-loading'];
        if (dl.track !== data.onDisable16 || dl.trackOpacity !== '1') failures.push({where, combo, check: 'disabled+loading sf-button ring is the disabled ink at 16 %', expected: data.onDisable16, track: dl.track, opacity: dl.trackOpacity});
      }

      if (errors.length) failures.push({where, check: 'console clean', errors});
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({report, failures}, null, 1));
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('BUTTON_LOADING_SCHEME_OK');

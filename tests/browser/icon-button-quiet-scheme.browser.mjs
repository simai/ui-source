#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// scheme="on-surface-variant" on sf-icon-button, on the built bytes: the
// on-surface family one step quieter. The glyph takes --sf-on-surface-variant
// wherever the glyph is the control -- outline, link, surface, ghost -- and a
// close control's cross with it; a tonal control takes its container's quieter
// role, and a filled one keeps on-surface's inverse glyph, because on a dark
// fill there is no quieter step. The colours are set on the control, never on
// the glyph: a rule on the glyph would stand over the value a state hands
// down, and a disabled quiet control kept its resting colour (measured
// 2026-10-30, before this probe).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const APPEARANCES = ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'];
const SCHEMES = ['on-surface', 'on-surface-variant'];
const control = (scheme, appearance) => `<sf-icon-button icon="share" aria-label="Поделиться" scheme="${scheme}" appearance="${appearance}"></sf-icon-button>`;
const PAGE = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<div id="grid">${SCHEMES.flatMap((scheme) => APPEARANCES.map((appearance) => control(scheme, appearance))).join('')}</div>
<sf-icon-button id="cross" kind="close" scheme="on-surface-variant" appearance="link" aria-label="Закрыть"></sf-icon-button>
<sf-icon-button id="loud-cross" kind="close" scheme="on-surface" appearance="link" aria-label="Закрыть"></sf-icon-button>
<sf-icon-button id="off" icon="share" scheme="on-surface-variant" appearance="link" aria-label="Поделиться" disabled></sf-icon-button>
<!-- The roles as the browser paints them, so a measured colour is compared with
     a colour and not with the light-dark() pair a variable declares. -->
<span id="role-variant" style="color: var(--sf-on-surface-variant)"></span>
<span id="role-surface" style="color: var(--sf-on-surface)"></span>
<span id="role-disable" style="color: var(--sf-on-disable)"></span>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const expect = (name, ok, detail) => { if (!ok) failures.push({name, detail}); };
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1200, height: 900}});
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  await tab.goto(`${origin}/`);
  await tab.waitForFunction(() => document.querySelectorAll('#grid sf-icon-button .sf-icon').length === 12
    && document.querySelector('#cross .sf-close-icon') && document.querySelector('#off .sf-icon'), null, {timeout: 30000});
  const seen = await tab.evaluate(() => {
    const colour = (node) => (node ? getComputedStyle(node).color : null);
    const grid = {};
    for (const host of document.querySelectorAll('#grid sf-icon-button')) {
      const button = host.querySelector('button');
      grid[`${host.getAttribute('scheme')}/${host.getAttribute('appearance')}`] = {
        glyph: colour(button.querySelector('.sf-icon')),
        box: `${Math.round(button.getBoundingClientRect().width)}x${Math.round(button.getBoundingClientRect().height)}`,
        fill: getComputedStyle(button).backgroundColor,
      };
    }
    const fill = (selector) => { const node = document.querySelector(selector); return node ? getComputedStyle(node).backgroundColor : null; };
    const role = (name) => colour(document.querySelector(`#role-${name}`));
    return {grid, cross: fill('#cross .sf-close-icon'), loudCross: fill('#loud-cross .sf-close-icon'),
      off: colour(document.querySelector('#off .sf-icon')),
      roles: {variant: role('variant'), surface: role('surface'), disable: role('disable')}};
  });
  const {grid, roles} = seen;
  for (const appearance of ['outline', 'link', 'surface', 'ghost']) {
    const quiet = grid[`on-surface-variant/${appearance}`];
    const loud = grid[`on-surface/${appearance}`];
    expect(`${appearance}: the glyph is the quieter role`, quiet.glyph === roles.variant && loud.glyph === roles.surface, {quiet, loud, roles});
    expect(`${appearance}: the fill and the box are on-surface's`, quiet.fill === loud.fill && quiet.box === loud.box, {quiet, loud});
  }
  expect('tonal: the container has its own quieter role', grid['on-surface-variant/tonal'].glyph !== grid['on-surface/tonal'].glyph
    && grid['on-surface-variant/tonal'].fill === grid['on-surface/tonal'].fill, {quiet: grid['on-surface-variant/tonal'], loud: grid['on-surface/tonal']});
  expect('default: a filled control keeps the inverse glyph', grid['on-surface-variant/default'].glyph === grid['on-surface/default'].glyph
    && grid['on-surface-variant/default'].fill === grid['on-surface/default'].fill, {quiet: grid['on-surface-variant/default'], loud: grid['on-surface/default']});
  expect('close: the cross is quieter too', seen.cross === roles.variant && seen.loudCross === roles.surface, {cross: seen.cross, loud: seen.loudCross, roles});
  expect('disabled: the state still wins', seen.off === roles.disable, {off: seen.off, roles});
  expect('no page errors', errors.length === 0, errors);
  console.log(JSON.stringify(seen, null, 1));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('ICON_BUTTON_QUIET_SCHEME_OK');

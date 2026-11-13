#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-button-copy inside a field (sf-input class markup), on the built bytes,
// loaded by the real Loader from its rule, at sizes 1/2, 1 and 2 in a normal
// and a compact region (R214 FA-2, FA-9; decision C79):
// - the button is the field's height and stays inside it: a compact region
//   takes the explicit size one step down with the field (28 / 32 / 40);
// - its keyboard focus ring stays inside the field's inner box, top, bottom
//   and end (sf-button-copy 1.4.2: it stood 3 px out of the field top and
//   bottom, 2 px round the box with the 1 px offset);
// - outside a field the ring is the button's own, round the box.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// The sheets first (the first paint's), then the Loader.
const sheets = ['core/css/core.css', 'component/icons/css/icons.css', 'component/buttons/css/buttons.css', 'component/icon-buttons/css/icon-buttons.css',
  'component/inputs/css/inputs.css', 'component/tooltip/css/tooltip.css', 'smart/button-copy/css/button-copy.css',
  'utility/display/default/css/default.css', 'utility/flex/default/css/default.css', 'utility/flex-direction/default/css/default.css', 'utility/align-items/default/css/default.css'];
const field = (id, size) => `<label class="sf-input sf-input--size-${size} sf-input--bordered flex flex-col" style="inline-size:18rem">
  <span class="sf-input-label flex"><span class="sf-input-text">Token ${size}</span></span>
  <span class="sf-input-field items-cross-center flex"><input id="${id}" readonly value="tok_9Fh2Lq7Xc4Vb1Nm8Pz3"><sf-button-copy target="#${id}" size="${size}" label="Copy the token"></sf-button-copy></span></label>`;
const SIZES = [['h', '1/2'], ['o', '1'], ['t', '2']];
current = `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr';window.SF_BOOT_CONFIG={preloader:{enabled:false},theme:false};</script>
${sheets.map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('\n')}
<script defer src="/distr/core/js/smart-base.js"></script><script defer src="/distr/core/js/core.js"></script></head>
<body style="margin:0;padding:24px;display:grid;gap:24px;background:var(--sf-surface-page)">
<div id="normal" style="display:flex;gap:24px">${SIZES.map(([id, size]) => field(`n${id}`, size)).join('')}</div>
<div id="compact" data-sf-density="compact" style="display:flex;gap:24px">${SIZES.map(([id, size]) => field(`c${id}`, size)).join('')}</div>
<div><sf-button-copy id="alone" value="A-1042" label="Copy the number"></sf-button-copy></div>
</body></html>`;

// Field heights on the control ladder (C79: compact takes an explicit size a step down).
const EXPECTED = {nh: 32, no: 40, nt: 48, ch: 28, co: 32, ct: 40};
const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => {
  if (!pass) failures.push({name, ...detail});
};

const ring = (page, selector) => page.evaluate((one) => {
  const button = document.querySelector(one);
  const cs = getComputedStyle(button);
  const width = parseFloat(cs.outlineWidth) || 0;
  const offset = parseFloat(cs.outlineOffset) || 0;
  const box = button.getBoundingClientRect();
  return {focused: document.activeElement === button, style: cs.outlineStyle, width, offset,
    top: box.top - offset - width, bottom: box.bottom + offset + width, start: box.left - offset - width, end: box.right + offset + width, box: {top: box.top, bottom: box.bottom, height: box.height}};
}, selector);

const browser = await chromium.launch();
try {
  for (let run = 1; run <= 3; run++) {
    const page = await browser.newPage({viewport: {width: 1200, height: 700}});
    const said = [];
    page.on('pageerror', (error) => said.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') said.push(message.text()); });
    await page.goto(`${base}/probe`, {waitUntil: 'load'});
    await page.waitForFunction(() => document.querySelectorAll('sf-button-copy button').length === 7, null, {timeout: 20000});
    await page.waitForTimeout(200);
    const rows = {};
    for (const id of Object.keys(EXPECTED)) {
      await page.focus(`#${id}`);
      await page.keyboard.press('Tab');
      const selector = `#${id} ~ sf-button-copy button`;
      const r = await ring(page, selector);
      const f = await page.evaluate((one) => {
        const fieldBox = document.getElementById(one).closest('.sf-input-field');
        const rect = fieldBox.getBoundingClientRect();
        const cs = getComputedStyle(fieldBox);
        return {height: rect.height, top: rect.top + parseFloat(cs.borderTopWidth), bottom: rect.bottom - parseFloat(cs.borderBottomWidth), end: rect.right - parseFloat(cs.borderRightWidth), outer: {top: rect.top, bottom: rect.bottom}};
      }, id);
      rows[id] = {field: f.height, button: r.box.height, ring: `${r.width}px offset ${r.offset}px`,
        ringPastTop: +(f.top - r.top).toFixed(2), ringPastBottom: +(r.bottom - f.bottom).toFixed(2), ringPastEnd: +(r.end - f.end).toFixed(2)};
      check(`run ${run} ${id}: keyboard focus is on the button`, r.focused, rows[id]);
      check(`run ${run} ${id}: the field is ${EXPECTED[id]}`, f.height === EXPECTED[id], rows[id]);
      check(`run ${run} ${id}: the button is the field's height and inside it`, r.box.height === f.height && r.box.top >= f.outer.top && r.box.bottom <= f.outer.bottom, rows[id]);
      check(`run ${run} ${id}: a ring is drawn`, r.style !== 'none' && r.width > 0, rows[id]);
      check(`run ${run} ${id}: the ring stays inside the field's inner box`, rows[id].ringPastTop <= 0 && rows[id].ringPastBottom <= 0 && rows[id].ringPastEnd <= 0, rows[id]);
    }
    await page.focus('#alone button');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const alone = await ring(page, '#alone button');
    check(`run ${run}: outside a field the ring stands round the box`, alone.focused && alone.offset > 0, alone);
    check(`run ${run}: no console error`, said.length === 0, {said});
    evidence[`run ${run}`] = {rows, alone: {width: alone.width, offset: alone.offset}};
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('COPY_BUTTON_IN_FIELD_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The Framework parts the owner-approved Larena Panel sign-in screen needs
// (DEV order msg-cfe379b5d6aa492c8ba6, decisions C378-C383; group build 14):
//
// - item 2, sf-button appearance="plain" (component.buttons 1.22.0, sf-button
//   1.18.0): the background stays transparent at rest, on hover, on a press,
//   with aria-expanded and on keyboard focus; the label is underlined in
//   those states and not at rest; the focus ring is drawn; the first glyph
//   stands on the box's start edge (no side padding).
// - item 3, C123 (4) on a touch phone: the password eye's hit square
//   (sf-input C191 (2)) keeps the value half an inset (6 at size 2, 4 at size 1
//   at 390) before the glyph; it was 12 and 10.
// - item 4: sf-input-code's label is sf-input's label of the same size (font
//   size and line) at 1440, 1024 and 390, normal and compact.
// - item 5: --sf-verification-cell-size sets the cell width and height, and a
//   cell without it is square at its size (component.verification 1.9.0).
//
// Three loads per view in fresh contexts, light and dark; the console must
// stay clean.
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
const body = `
<div style="display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:16px;max-inline-size:384px">
  <sf-button id="plain" appearance="plain" scheme="on-surface" size="1" icon="translate" text="Русский"></sf-button>
  <button id="expanded" class="sf-button sf-button--ghost sf-button--plain sf-button--on-surface sf-button--size-1" type="button" aria-haspopup="menu" aria-expanded="true"><i class="sf-icon" aria-hidden="true">translate</i><span class="sf-button-text-container">Deutsch</span></button>
  <sf-input id="in-1" size="1" label="Почта"></sf-input>
  <sf-input-code id="code-1" size="1" length="6" groups="3" label="Код"></sf-input-code>
  <sf-input id="in-2" size="2" label="Почта"></sf-input>
  <sf-input-code id="code-2" size="2" length="6" groups="3" label="Код"></sf-input-code>
  <sf-input id="pw-1" size="1" label="Пароль" input-type="password"></sf-input>
  <sf-input id="pw-2" size="2" label="Пароль" input-type="password"></sf-input>
  <sf-input-code id="cell-40" style="--sf-verification-cell-size:40px" size="2" length="6" label="Код"></sf-input-code>
  <sf-input-code id="cell-1" size="1" length="6" label="Код"></sf-input-code>
</div>`;
const pageOf = (theme, density) => `<!doctype html><html lang="ru" class="${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const serve = () => createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/parts.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pageOf(url.searchParams.get('theme') || 'theme-light', url.searchParams.get('density') || 'normal'));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(bytes);
  } catch {
    response.writeHead(404); response.end();
  }
});

const LOADS = 3;
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
const server = serve();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const transparent = (colour) => colour === 'rgba(0, 0, 0, 0)' || colour === 'transparent';
const views = [
  {width: 1440, density: 'normal'}, {width: 1440, density: 'compact'},
  {width: 1024, density: 'normal'}, {width: 1024, density: 'compact'},
  {width: 390, density: 'normal'}, {width: 390, density: 'compact'},
];
try {
  for (const view of views) for (const theme of ['theme-light', 'theme-dark']) for (let load = 1; load <= LOADS; load += 1) {
    const where = `${view.width} ${view.density} ${theme} load ${load}`;
    const phone = view.width === 390;
    const context = await browser.newContext(phone
      ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce'}
      : {viewport: {width: view.width, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    await page.goto(`${base}/parts.html?theme=${theme}&density=${view.density}`);
    await page.waitForFunction(() => document.querySelector('#plain > .sf-button') && document.querySelector('#pw-2 .sf-input-reveal') && document.querySelector('#cell-1 .sf-verification-cell'), null, {timeout: 30000});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const read = () => page.evaluate(() => {
      const button = document.querySelector('#plain > .sf-button');
      const style = getComputedStyle(button);
      return {
        background: style.backgroundColor,
        before: getComputedStyle(button, '::before').backgroundColor,
        after: getComputedStyle(button, '::after').backgroundColor,
        line: getComputedStyle(button.querySelector('.sf-button-text-container')).textDecorationLine,
        outline: style.outlineStyle,
      };
    });
    const states = {rest: await read()};
    if (!phone) {
      await page.hover('#plain > .sf-button');
      await page.waitForTimeout(150);
      states.hover = await read();
      await page.mouse.down();
      states.press = await read();
      await page.mouse.up();
      await page.mouse.move(1, 1);
      await page.evaluate(() => document.activeElement?.blur());
    }
    // Keyboard focus: Tab, or back one stop when the pointer's press left the
    // sequential focus point on the button (then Tab passes it).
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement?.closest('#plain')))) await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(150);
    states.focus = await read();
    for (const [state, seen] of Object.entries(states)) {
      for (const part of ['background', 'before', 'after']) if (!transparent(seen[part])) fail(where, `plain ${state} ${part} ${seen[part]}`);
      const wantLine = state === 'rest' ? 'none' : 'underline';
      if (seen.line !== wantLine) fail(where, `plain ${state} line ${seen.line}, want ${wantLine}`);
    }
    if (states.focus.outline === 'none') fail(where, 'plain focus ring not drawn');

    const facts = await page.evaluate(() => {
      const box = (element) => element.getBoundingClientRect();
      const plain = document.querySelector('#plain > .sf-button');
      const glyph = plain.querySelector('i.sf-icon, .sf-icon');
      const expanded = document.querySelector('#expanded');
      const label = (id) => {
        const element = document.querySelector(`#${id} :is(.sf-input-label .sf-input-text, .sf-verification-form-label)`);
        const style = getComputedStyle(element);
        return `${style.fontSize}/${style.lineHeight}`;
      };
      const cell = (id) => { const rect = box(document.querySelector(`#${id} .sf-verification-cell`)); return {w: Math.round(rect.width), h: Math.round(rect.height)}; };
      const gap = (id) => {
        const field = document.querySelector(`#${id} .sf-input-field`);
        const input = field.querySelector('input');
        const icon = field.querySelector('.sf-input-reveal .sf-icon');
        const inset = parseFloat(getComputedStyle(field.closest('.sf-input')).getPropertyValue('--sf-field-action--inset')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
        return {gap: Math.round((box(icon).left - (box(input).right - parseFloat(getComputedStyle(input).paddingRight))) * 10) / 10, half: inset / 2};
      };
      return {
        glyphOffset: Math.round(box(glyph).left - box(plain).left),
        expanded: {background: getComputedStyle(expanded).backgroundColor, line: getComputedStyle(expanded.querySelector('.sf-button-text-container')).textDecorationLine},
        labels: [[label('in-1'), label('code-1')], [label('in-2'), label('code-2')]],
        cell40: cell('cell-40'), cell1: cell('cell-1'),
        pw: [gap('pw-1'), gap('pw-2')],
      };
    });
    if (facts.glyphOffset !== 0) fail(where, `plain glyph ${facts.glyphOffset} from the box start, want 0`);
    if (!transparent(facts.expanded.background)) fail(where, `plain aria-expanded background ${facts.expanded.background}`);
    if (facts.expanded.line !== 'underline') fail(where, `plain aria-expanded line ${facts.expanded.line}`);
    facts.labels.forEach(([input, code], at) => { if (input !== code) fail(where, `size ${at + 1} label: sf-input ${input}, sf-input-code ${code}`); });
    if (facts.cell40.w !== 40 || facts.cell40.h !== 40) fail(where, `--sf-verification-cell-size 40px drew ${facts.cell40.w} x ${facts.cell40.h}`);
    if (facts.cell1.w !== facts.cell1.h) fail(where, `size 1 cell ${facts.cell1.w} x ${facts.cell1.h}, not square`);
    facts.pw.forEach(({gap, half}, at) => { if (Math.abs(gap - half) > 0.5) fail(where, `size ${at + 1} password value -> eye ${gap}, want ${half}`); });
    if (errors.length) fail(where, `console: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`signin-parts: ${failures.length} failure(s)\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`signin-parts: ${views.length * 2 * LOADS} runs green (plain button states, password eye step, code labels, cell size)`);

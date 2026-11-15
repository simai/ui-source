#!/usr/bin/env node
// Usage: node tests/browser/input-color-c209.browser.mjs <build output root> [port] [out.json] [shots-folder]
//        SF_EXPECT=0 only measures (for a build without the change).
//
// Owner decision C209 and defect CF-1 for sf-input-color «Своё», drawn by the
// real Framework over the Loader from the built bytes (a group-build stand:
// core/core, core/rule, component/component, smart/smart, utility/utility).
// 1440, 1440 compact, 390 (touch, DPR 2) x light, dark x 3 loads. Per load:
//   - the window: background colour, size, sheet or popover; a format menu
//     button or not; text under the code row;
//   - the bottom row: code field box, Apply box, the gap between them, the
//     code text start, the copy glyph and its hit area, glyph end -> row end;
//   - typed rgb() / hsl() / oklch() / a name / a hex without # -> the field's
//     value and text while typing (before Enter or Apply), then Apply (or
//     Enter where there is no Apply): value, window closed, focus;
//   - a pointer move on the shade area then Apply: closes, value kept;
//   - copy: the clipboard text, the glyph at 0.1 s, 1.0 s, 1.5 s;
//   - keyboard: Tab from the area to the end -- every stop, where the focus
//     leaves the window, whether the window is still open; Shift+Tab from the
//     area back to the field; Esc -> closed, focus on the field;
//   - console errors, failed requests, horizontal scroll.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

const out = resolve(process.argv[2]);
const port = Number(process.argv[3] || 0);
const outFile = process.argv[4] ? resolve(process.argv[4]) : '';
const expect = process.env.SF_EXPECT !== '0';
const shots = process.argv[5] ? resolve(process.argv[5]) : '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const page = ({theme, density}) => `<!doctype html><html lang="ru" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C209 colour field</title>
<script>window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}
form{display:flex;flex-direction:column;gap:16px;max-inline-size:480px}#ink{color:var(--sf-surface-popup)}</style></head><body>
<form id="f"><i id="ink"></i>
<input id="before" aria-label="before">
<sf-input-color id="c" name="c" label="Фирменный цвет" value="#1d9367"></sf-input-color>
<input id="after" aria-label="after">
</form></body></html>`;

const failed = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  if (url.pathname === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page({theme: url.searchParams.get('theme'), density: url.searchParams.get('density')}));
  }
  const match = decodeURIComponent(url.pathname).match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    failed.push(url.pathname);
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  response.end(readFileSync(file));
});
await new Promise((done) => server.listen(port, '127.0.0.1', done));
const served = server.address().port;

const VIEWS = [
  {name: '1440', width: 1440, height: 900, density: 'normal'},
  {name: '1440 compact', width: 1440, height: 900, density: 'compact'},
  {name: '390', width: 390, height: 844, density: 'normal', touch: true},
];
const TYPED = ['rgb(21, 101, 192)', 'hsl(291 64% 42%)', 'oklch(0.6 0.15 250)', 'rebeccapurple', 'c2185b', 'не цвет'];

const browser = await chromium.launch({headless: true});
const results = [];
for (const view of VIEWS) for (const theme of ['light', 'dark']) for (let load = 1; load <= 3; load += 1) {
  const context = await browser.newContext({
    viewport: {width: view.width, height: view.height},
    deviceScaleFactor: view.touch ? 2 : 1, hasTouch: Boolean(view.touch), isMobile: Boolean(view.touch),
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const tab = await context.newPage();
  const errors = [];
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('pageerror', (error) => errors.push(String(error)));
  await tab.goto(`http://127.0.0.1:${served}/?theme=${theme}&density=${view.density}`);
  await tab.waitForFunction(() => document.querySelector('#c .sf-color-trigger'));
  await tab.evaluate(() => document.fonts.ready);
  const r = {view: view.name, theme, load};

  const openOwn = async () => {
    await tab.evaluate(() => { const c = document.getElementById('c'); c.closePicker({restoreFocus: false}); c.openPicker({view: 'own'}); });
    await tab.waitForFunction(() => document.querySelector('#c .sf-color-code'));
    await tab.waitForFunction(() => !document.querySelector('#c .sf-color-apply') || document.querySelector('#c .sf-color-apply button'));
    await tab.waitForTimeout(150);
  };

  // --- geometry
  await openOwn();
  if (shots && load === 1) {
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(1200);
  }
  if (shots && load === 1) await tab.locator('#c .sf-color-window').screenshot({path: join(shots, `${view.name.replace(' ', '-')}-${theme}.png`)});
  Object.assign(r, await tab.evaluate(() => {
    const c = document.getElementById('c');
    const win = c.querySelector('.sf-color-window');
    const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return {x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), r: +b.right.toFixed(1)}; };
    const row = c.querySelector('.sf-color-code-row');
    const code = c.querySelector('.sf-color-code');
    const apply = c.querySelector('.sf-color-apply button');
    const copyHit = c.querySelector('.sf-color-copy .sf-field-action, .sf-color-copy button');
    const copyGlyph = copyHit?.querySelector('.sf-icon');
    const rowBox = box(row);
    const applyBox = box(apply);
    const cs = (el) => el ? getComputedStyle(el) : null;
    const ink = getComputedStyle(document.getElementById('ink')).color;
    const area = c.querySelector('.sf-color-area');
    const eye = c.querySelector('[data-action="eyedropper"]');
    const hue = c.querySelector('.sf-color-strip--hue');
    const below = [...win.querySelectorAll('.sf-color-error, .sf-color-hint')].map((el) => el.textContent.trim()).filter(Boolean);
    return {
      windowBg: cs(win).backgroundColor, popupToken: ink, sheet: win.hasAttribute('data-sf-sheet'), window: box(win),
      formatMenuButton: Boolean(c.querySelector('.sf-color-format')),
      textUnderRow: below.join(' | '),
      area: box(area), eyedropper: box(eye), hue: box(hue), eyeLeftOfHue: eye && hue ? box(eye).r <= box(hue).x : null,
      row: rowBox, rowBorder: cs(row)?.borderTopColor,
      code: box(code), codeTextStart: code ? +(code.getBoundingClientRect().left + parseFloat(cs(code).paddingLeft) - rowBox.x).toFixed(1) : null,
      codeText: code?.value ?? null,
      apply: applyBox, applyText: c.querySelector('.sf-color-apply')?.getAttribute('text') ?? null,
      rowToApply: rowBox && applyBox ? +(applyBox.x - rowBox.r).toFixed(1) : null,
      copyHit: box(copyHit), copyGlyph: box(copyGlyph), copyIcon: copyHit?.querySelector('sf-icon')?.getAttribute('icon') ?? null,
      copyName: copyHit?.getAttribute('aria-label') ?? null,
      glyphEndToRowEnd: copyGlyph && rowBox ? +(rowBox.r - copyGlyph.getBoundingClientRect().right).toFixed(1) : null,
      codeToGlyph: copyGlyph && code ? +(copyGlyph.getBoundingClientRect().left - code.getBoundingClientRect().right).toFixed(1) : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  }));

  // --- typed colours -> hex, then Apply (Enter where there is none)
  r.typed = [];
  for (const text of TYPED) {
    await openOwn();
    const before = await tab.evaluate(() => document.getElementById('c').value);
    await tab.locator('#c .sf-color-code').fill(text);
    await tab.waitForTimeout(60);
    const typing = await tab.evaluate(() => {
      const c = document.getElementById('c');
      return {value: c.value, fieldText: c.querySelector('.sf-color-trigger .sf-color-text').textContent.trim(), form: new FormData(document.getElementById('f')).get('c'), codeText: c.querySelector('.sf-color-code').value};
    });
    const hasApply = await tab.locator('#c .sf-color-apply').count();
    if (hasApply) await tab.locator('#c .sf-color-apply').click();
    else await tab.locator('#c .sf-color-code').press('Enter');
    await tab.waitForTimeout(80);
    const after = await tab.evaluate(() => {
      const c = document.getElementById('c');
      const a = document.activeElement;
      return {value: c.value, open: c.isOpen, focus: a?.classList?.contains('sf-color-trigger') ? 'field' : (a?.className || a?.tagName),
        error: c.querySelector('.sf-color-error')?.textContent.trim() || '', rowBorder: c.isOpen ? getComputedStyle(c.querySelector('.sf-color-code-row')).borderTopColor : ''};
    });
    r.typed.push({text, before, typing, via: hasApply ? 'apply' : 'enter', after});
    await tab.evaluate(() => { document.getElementById('c').value = '#1d9367'; });
  }

  // --- pointer move, then Apply
  await openOwn();
  const areaBox = await tab.locator('#c .sf-color-area').boundingBox();
  if (view.touch) await tab.touchscreen.tap(areaBox.x + areaBox.width * 0.8, areaBox.y + areaBox.height * 0.3);
  else await tab.mouse.click(areaBox.x + areaBox.width * 0.8, areaBox.y + areaBox.height * 0.3);
  await tab.waitForTimeout(60);
  const moved = await tab.evaluate(() => document.getElementById('c').value);
  if (await tab.locator('#c .sf-color-apply').count()) {
    await tab.locator('#c .sf-color-apply').click();
    await tab.waitForTimeout(80);
    r.pointerThenApply = {moved, ...(await tab.evaluate(() => ({value: document.getElementById('c').value, open: document.getElementById('c').isOpen, focusOnField: document.activeElement?.classList?.contains('sf-color-trigger')})))};
  } else r.pointerThenApply = {moved, apply: 'none'};

  // --- copy
  await openOwn();
  if (await tab.locator('#c .sf-color-copy').count()) {
    await tab.evaluate(() => navigator.clipboard.writeText(''));
    const t0 = Date.now();
    await tab.locator('#c .sf-color-copy button').click();
    const glyph = () => tab.evaluate(() => document.querySelector('#c .sf-color-copy button sf-icon')?.getAttribute('icon'));
    await tab.waitForTimeout(100); const g1 = await glyph();
    await tab.waitForTimeout(Math.max(0, 1000 - (Date.now() - t0))); const g2 = await glyph();
    await tab.waitForTimeout(Math.max(0, 1500 - (Date.now() - t0))); const g3 = await glyph();
    r.copy = {clipboard: await tab.evaluate(() => navigator.clipboard.readText()), code: await tab.evaluate(() => document.querySelector('#c .sf-color-code').value), at100ms: g1, at1000ms: g2, at1500ms: g3, open: await tab.evaluate(() => document.getElementById('c').isOpen)};
  } else r.copy = 'none';

  // --- keyboard
  const where = () => tab.evaluate(() => {
    const a = document.activeElement; const c = document.getElementById('c');
    const inWin = Boolean(a?.closest?.('.sf-color-window'));
    const name = a?.id || a?.getAttribute?.('aria-label') || a?.getAttribute?.('role') || a?.className || a?.tagName;
    return {name: String(name).slice(0, 40), inWin, open: c.isOpen};
  });
  await tab.evaluate(() => { const c = document.getElementById('c'); c.closePicker({restoreFocus: false}); });
  await tab.locator('#c .sf-color-trigger').focus();
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(150);
  // to «Своё» by the segmented control: open on own directly for the path
  await openOwn();
  await tab.locator('#c .sf-color-area').focus();
  const forward = [await where()];
  for (let i = 0; i < 12; i += 1) {
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(40);
    const w = await where();
    forward.push(w);
    if (!w.inWin) break;
  }
  r.tabForward = forward;
  await openOwn();
  await tab.locator('#c .sf-color-area').focus();
  const backward = [await where()];
  for (let i = 0; i < 6; i += 1) {
    await tab.keyboard.press('Shift+Tab');
    await tab.waitForTimeout(40);
    const w = await where();
    backward.push(w);
    if (!w.inWin) break;
  }
  r.tabBack = backward;
  await openOwn();
  await tab.locator('#c .sf-color-code').focus();
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(60);
  r.escape = await where();
  r.errors = errors;
  results.push(r);
  await context.close();
}
await browser.close();
server.close();
if (outFile) writeFileSync(outFile, JSON.stringify({failed, results}, null, 2));
console.log('loads', results.length, 'failed requests', failed.length, 'errors', results.reduce((n, r) => n + r.errors.length, 0));
if (expect) {
  const problems = [];
  const say = (r, what) => problems.push(`${r.view} ${r.theme} load ${r.load}: ${what}`);
  if (failed.length) problems.push(`failed requests: ${failed.join(', ')}`);
  for (const r of results) {
    if (r.errors.length) say(r, `console: ${r.errors.join(' | ')}`);
    if (r.overflowX) say(r, 'sideways scroll');
    if (r.windowBg !== r.popupToken) say(r, `window ${r.windowBg}, not --sf-surface-popup ${r.popupToken}`);
    if (r.formatMenuButton) say(r, 'a format menu button');
    if (r.textUnderRow) say(r, `text under the code row: ${r.textUnderRow}`);
    if (!r.eyeLeftOfHue) say(r, 'the eyedropper is not left of the hue strip');
    if (r.applyText !== 'Применить' || !r.apply || Math.abs(r.apply.h - r.row.h) > 0.5) say(r, 'Применить is not a button of the row height');
    const gap = r.view.includes('compact') ? 4 : 8;
    if (Math.abs(r.rowToApply - gap) > 0.5) say(r, `code -> Применить ${r.rowToApply}, not ${gap}`);
    if (r.copyIcon !== 'content_copy' || r.copyName !== 'Скопировать код') say(r, `copy action ${r.copyIcon} ${r.copyName}`);
    if (Math.abs(r.glyphEndToRowEnd - r.codeTextStart) > 0.5) say(r, `copy glyph ends ${r.glyphEndToRowEnd} from the edge, the code starts ${r.codeTextStart}`);
    for (const t of r.typed) {
      const bad = t.text === 'не цвет';
      if (bad ? (!t.after.open || !t.after.error || t.after.value !== t.before) : (t.after.open || t.after.focus !== 'field' || t.typing.value === t.before || !/^#[0-9a-f]{6}$/u.test(t.typing.value) || t.typing.form !== t.typing.value || t.after.value !== t.typing.value)) {
        say(r, `typed ${t.text}: ${JSON.stringify(t)}`);
      }
    }
    const p = r.pointerThenApply;
    if (p.open || p.value !== p.moved || !p.focusOnField) say(r, `pointer then Apply: ${JSON.stringify(p)}`);
    const c = r.copy;
    if (c === 'none' || c.clipboard !== c.code || c.at100ms !== 'check' || c.at1000ms !== 'check' || c.at1500ms !== 'content_copy') say(r, `copy: ${JSON.stringify(c)}`);
    const last = r.tabForward.at(-1);
    if (last.inWin || last.open || last.name !== 'after') say(r, `Tab out of the window: ${JSON.stringify(last)}`);
    const back = r.tabBack.at(-1);
    if (back.inWin || !back.open || !back.name.startsWith('Фирменный цвет')) say(r, `Shift+Tab back to the field: ${JSON.stringify(back)}`);
    if (r.escape.open || !r.escape.name.startsWith('Фирменный цвет')) say(r, `Esc: ${JSON.stringify(r.escape)}`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('C209 / CF-1: 0 problems');
}

#!/usr/bin/env node
// Usage: node tests/browser/inherited-reset-c123.browser.mjs <build output root> <evidence.json> [shots-folder]
//   SF_RELOADS=<n> (3), SF_PORT=<port>, SF_EXPECT=0 only measures (the build without the change).
//
// Owner decision C123 (variant A) for the shared reset to the inherited value (src/smart/helpers/inherited-value.js),
// in every field that draws it -- sf-input, sf-input-textarea, sf-dropdown, sf-input-color, sf-switch,
// sf-input-quantity, at every size each takes -- over the Loader from the built bytes, at 1440, 1440 compact and 390
// (touch, DPR 2), light and dark, 3 loads each (+ one English load for the names):
//   (1) the reset is a .sf-field-action button: no plate at rest, under the pointer, pressed; on-surface-variant at
//       rest, on-surface under the pointer and pressed; the keyboard ring round the glyph, the button none;
//   (2) the glyph is the field's text line; the hit area invisible, the field's inner height in a box (the box's
//       inner height beside the quantity box, a square of glyph + half inset under the textarea and by the switch),
//       never under 24;
//   (6) in a box: value -> glyph and glyph -> chevron half the inset; the last glyph ends on the inset;
//   Tab from the value reaches the reset; its name (aria-label = title, the accessibility tree) is unchanged.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve, dirname} from 'node:path';
import {chromium} from 'playwright';

const SIZES = {
  input: ['1/3', '1/2', '1', '2', '3'],
  'input-textarea': ['1/3', '1/2', '1', '2', '3'],
  dropdown: ['1/2', '1', '2'],
  'input-color': ['1/3', '1/2', '1', '2', '3'],
  switch: ['1/2', '1', '2'],
  'input-quantity': ['1/3', '1/2', '1', '2', '3'],
};
const id = (tag, size) => `${tag}-${size.replace('/', '-')}`;
const FIELDS = Object.entries(SIZES).flatMap(([tag, sizes]) => sizes.map((size) => ({tag, size, id: id(tag, size)})));
// sf-input with its own clear after the reset (clearable): reset -> clear is two actions side by side.
FIELDS.push(...['1/3', '1/2', '1'].map((size) => ({tag: 'input', size, id: `input-clear-${size.replace('/', '-')}`, clearable: true})));
const markup = ({tag, size, id, clearable}) => {
  switch (tag) {
    case 'input': return `<sf-input id="${id}" size="${size}" label="Цвет" value="#1a7f37" inherited-value="#336699"${clearable ? ' clearable' : ''}></sf-input>`;
    case 'input-textarea': return `<sf-input-textarea id="${id}" size="${size}" label="Подпись" value="Своя" inherited-value="С уважением"></sf-input-textarea>`;
    case 'dropdown': return `<sf-dropdown id="${id}" size="${size}" label="Город" search="false" value="moscow" inherited-value="kazan"><sf-list-item value="kazan" text="Казань"></sf-list-item><sf-list-item value="moscow" text="Москва"></sf-list-item></sf-dropdown>`;
    case 'input-color': return `<sf-input-color id="${id}" size="${size}" label="Цвет" value="#1a7f37" inherited-value="#d1242f"></sf-input-color>`;
    case 'switch': return `<sf-switch id="${id}" size="${size}" label="Уведомления" checked="false" inherited-value="true"></sf-switch>`;
    case 'input-quantity': return `<sf-input-quantity id="${id}" size="${size}" label="Количество" value="7" inherited-value="5"></sf-input-quantity>`;
  }
};
const page = ({lang = 'ru', theme = 'light', density = 'normal'} = {}) => `<!doctype html><html lang="${lang}" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C123 inherited reset</title>
<script>window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px 24px;min-inline-size:0}
#ink-variant{color:var(--sf-on-surface-variant)}#ink-text{color:var(--sf-on-surface)}#ink-off{color:var(--sf-on-surface-disabled)}</style></head><body>
<i id="ink-variant"></i><i id="ink-text"></i><i id="ink-off"></i><main>
${FIELDS.map((f) => `<div data-probe="${f.id}">${markup(f)}</div>`).join('\n')}
</main></body></html>`;

const out = resolve(process.argv[2]);
const evidence = resolve(process.argv[3]);
const shots = process.argv[4] ? resolve(process.argv[4]) : '';
if (shots) mkdirSync(shots, {recursive: true});
mkdirSync(dirname(evidence), {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const expect = process.env.SF_EXPECT !== '0';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const failed = [];
const server = createServer((q, s) => {
  const url = new URL(q.url, 'http://probe');
  if (url.pathname === '/') { s.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'}); return s.end(page(Object.fromEntries(url.searchParams))); }
  const m = decodeURIComponent(url.pathname).match(/^\/distr\/([^/]+)\/(.+)$/u);
  const f = m && parts[m[1]] ? join(parts[m[1]], m[2]) : '';
  if (!f || !existsSync(f) || statSync(f).isDirectory()) { failed.push(url.pathname); s.writeHead(404); return s.end(); }
  s.writeHead(200, {'content-type': types[extname(f)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'}); s.end(readFileSync(f));
}).listen(Number(process.env.SF_PORT || 0), '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const MEASURE = ({id, tag}) => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const host = document.getElementById(id);
  const button = host?.querySelector('[data-inherited-reset]');
  if (!button || button.hidden) return null;
  const glyph = button.querySelector('.sf-icon') || button;
  const probe = (where, css) => { const n = document.createElement('i'); n.style.cssText = `position:absolute;visibility:hidden;block-size:1px;inline-size:${css}`; where.append(n); const w = n.getBoundingClientRect().width; n.remove(); return r2(w); };
  const contentEnd = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.right - parseFloat(c.paddingRight) - parseFloat(c.borderRightWidth); };
  const box = {
    input: () => host.querySelector('.sf-input-field'), dropdown: () => host.querySelector('.sf-dropdown-field'),
    'input-color': () => host.querySelector('.sf-color-frame'), 'input-textarea': () => host.querySelector('textarea'),
    'input-quantity': () => host.querySelector('.sf-quantity-wrap'), switch: () => host.querySelector('.sf-switch'),
  }[tag]();
  const value = {
    input: () => host.querySelector('.sf-input-field > input'), dropdown: () => host.querySelector('.sf-dropdown-field > input:not([type="hidden"])'),
    'input-color': () => host.querySelector('.sf-color-trigger'), 'input-textarea': () => null,
    'input-quantity': () => host.querySelector('.sf-quantity-wrap'), switch: () => host.querySelector('.sf-switch-container-wrap, .sf-switch-container'),
  }[tag]();
  const chevron = {dropdown: () => host.querySelector('.sf-dropdown-chevron .sf-icon'), 'input-color': () => host.querySelector('.sf-color-chevron'), input: () => host.querySelector('.sf-input-clear:not([hidden]) .sf-icon')}[tag]?.();
  const hit = button.getBoundingClientRect(); const icon = glyph.getBoundingClientRect(); const b = box.getBoundingClientRect();
  const s = getComputedStyle(button); const gs = getComputedStyle(glyph);
  const inBox = ['input', 'dropdown', 'input-color'].includes(tag);
  const valueEnd = value ? (tag === 'input-quantity' ? value.getBoundingClientRect().right : (tag === 'switch' ? value.getBoundingClientRect().right : contentEnd(value))) : null;
  return {
    cls: button.className, fieldAction: button.classList.contains('sf-field-action'), name: button.getAttribute('aria-label'), title: button.getAttribute('title'),
    background: s.backgroundColor, shadow: s.boxShadow, ink: gs.color, ring: `${gs.outlineStyle} ${gs.outlineWidth}`, buttonRing: s.outlineStyle,
    hitW: r2(hit.width), hitH: r2(hit.height), glyph: r2(icon.width), glyphH: r2(icon.height),
    text: probe(button, `var(--sf-field-action--glyph-size, var(--sf-text-height-1))`), inset: probe(button, 'var(--sf-field-action--inset, 0px)'),
    boxH: r2(b.height), boxInner: r2(b.height - 2 * probe(box, 'var(--sf-px)')),
    valueToGlyph: valueEnd === null ? null : r2(icon.left - valueEnd),
    glyphToChevron: chevron ? r2(chevron.getBoundingClientRect().left - icon.right) : null,
    chevron: chevron ? r2(chevron.getBoundingClientRect().width) : null,
    lastGlyphToEdge: inBox ? r2(b.right - (chevron ? chevron.getBoundingClientRect().right : icon.right)) : (tag === 'input-textarea' ? r2(b.right - icon.right) : null),
    boxToGlyphBlock: tag === 'input-textarea' ? r2(icon.top - b.bottom) : null,
    hitInside: inBox ? (hit.top >= b.top - 0.5 && hit.bottom <= b.bottom + 0.5) : null,
    inBox,
  };
};
const TOKENS = () => ({variant: getComputedStyle(document.getElementById('ink-variant')).color, text: getComputedStyle(document.getElementById('ink-text')).color, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth});
const CONTROL = {input: '.sf-input-field > input', dropdown: '.sf-dropdown-field > input:not([type="hidden"])', 'input-color': '.sf-color-trigger', 'input-textarea': 'textarea', 'input-quantity': '.sf-quantity-wrap > input', switch: 'input[role="switch"]'};
const near = (a, b, t = 0.6) => a !== null && b !== null && Math.abs(a - b) <= t;
const noPlate = (m) => (m.background === 'rgba(0, 0, 0, 0)' || m.background === 'transparent') && (!m.shadow || m.shadow === 'none');

const VIEWS = [
  {width: 1440, density: 'normal'}, {width: 1440, density: 'compact'}, {width: 390, density: 'normal'},
];
const browser = await chromium.launch();
const loads = []; const problems = [];
for (const view of VIEWS) for (const theme of ['light', 'dark']) for (const lang of ['ru', 'en']) {
  if (lang === 'en' && !(theme === 'light' && view.width === 1440 && view.density === 'normal')) continue;
  for (let load = 1; load <= (lang === 'en' ? 1 : reloads); load += 1) {
    const ctx = await browser.newContext(view.width === 390
      ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce'}
      : {viewport: {width: 1440, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    tab.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text()}`); });
    tab.on('requestfailed', (r) => errors.push(`requestfailed ${r.url()}`));
    await tab.goto(`${origin}/?lang=${lang}&theme=${theme}&density=${view.density}`, {waitUntil: 'load'});
    // Drawn and shown (the slot is first drawn before the field knows its own value).
    await tab.waitForFunction((ids) => ids.every((id) => { const b = document.getElementById(id)?.querySelector('[data-inherited-reset]'); return b && !b.hidden && b.getBoundingClientRect().width > 0; }), FIELDS.map((f) => f.id), {timeout: 20000});
    await tab.evaluate(() => document.fonts.ready); await tab.waitForTimeout(500);
    const tokens = await tab.evaluate(TOKENS);
    const name = `${view.width} ${view.density} ${theme} ${lang} #${load}`;
    if (shots && load === 1 && lang === 'ru') await tab.screenshot({path: join(shots, `${view.width}-${view.density}-${theme}.png`), fullPage: true});
    const fields = {};
    for (const f of FIELDS) {
      const rest = await tab.evaluate(MEASURE, f);
      let hover = null, pressed = null, ring = null, tabTo = null, aria = null;
      if (rest && view.width === 1440) {
        const sel = `#${f.id} [data-inherited-reset]`;
        await tab.hover(sel); await tab.waitForTimeout(200); hover = await tab.evaluate(MEASURE, f);
        await tab.mouse.down(); await tab.waitForTimeout(200); pressed = await tab.evaluate(MEASURE, f);
        await tab.mouse.move(0, 0); await tab.mouse.up(); await tab.waitForTimeout(60);
        // Tab from the field's own control: the next stops, by name.
        await tab.focus(`#${f.id} ${CONTROL[f.tag]}`);
        const stops = [];
        for (let i = 0; i < 2; i += 1) {
          await tab.keyboard.press('Tab'); await tab.waitForTimeout(60);
          stops.push(await tab.evaluate((id) => { const a = document.activeElement; const inside = document.getElementById(id).contains(a); return `${inside ? '' : 'out:'}${a?.hasAttribute?.('data-inherited-reset') ? 'reset' : (a?.getAttribute?.('aria-label') || a?.className || a?.tagName)}`; }, f.id));
          if (stops.at(-1) === 'reset') { ring = await tab.evaluate(MEASURE, f); break; }
        }
        tabTo = stops;
        aria = await tab.locator(sel).ariaSnapshot();
      }
      fields[f.id] = {tag: f.tag, size: f.size, rest, hover, pressed, ring, tabTo, aria};
    }
    loads.push({name, ...view, theme, lang, load, errors, tokens, fields});
    if (errors.length) problems.push(`${name}: ${errors.join('; ')}`);
    if (tokens.overflow > 0) problems.push(`${name}: horizontal scroll ${tokens.overflow}`);
    if (expect) for (const [id, {tag, rest, hover, pressed, ring, tabTo, aria}] of Object.entries(fields)) {
      const say = (t) => problems.push(`${name}: ${id} ${t}`);
      if (!rest) { say('no reset'); continue; }
      if (!rest.fieldAction) say(`not a .sf-field-action: ${rest.cls}`);
      for (const [st, m] of [['rest', rest], ['hover', hover], ['pressed', pressed], ['focus', ring]]) if (m && !noPlate(m)) say(`${st}: a plate ${m.background} ${m.shadow}`);
      if (rest.ink !== tokens.variant) say(`rest ink ${rest.ink} wants ${tokens.variant}`);
      if (hover && hover.ink !== tokens.text) say(`hover ink ${hover.ink} wants ${tokens.text}`);
      if (pressed && pressed.ink !== tokens.text) say(`pressed ink ${pressed.ink} wants ${tokens.text}`);
      if (!near(rest.glyph, rest.text)) say(`glyph ${rest.glyph} wants the text line ${rest.text}`);
      if (rest.hitW < 23.5 || rest.hitH < 23.5) say(`hit ${rest.hitW}x${rest.hitH} under 24`);
      if (!near(rest.hitW, Math.max(rest.glyph + rest.inset / 2, 24))) say(`hit width ${rest.hitW} wants max(glyph + inset/2, 24) = ${Math.max(rest.glyph + rest.inset / 2, 24)}`);
      if (rest.inBox) {
        if (!near(rest.hitH, Math.max(rest.boxInner, 24))) say(`hit height ${rest.hitH} wants the box's inner ${rest.boxInner}`);
        if (!rest.hitInside) say('hit stands out of the box');
        if (!near(rest.valueToGlyph, rest.inset / 2)) say(`value -> glyph ${rest.valueToGlyph} wants ${rest.inset / 2}`);
        if (rest.glyphToChevron !== null && !near(rest.glyphToChevron, rest.inset / 2)) say(`glyph -> chevron ${rest.glyphToChevron} wants ${rest.inset / 2}`);
        if (tag !== 'input-color' && !near(rest.lastGlyphToEdge, rest.inset)) say(`last glyph -> edge ${rest.lastGlyphToEdge} wants the inset ${rest.inset}`);
      }
      if (tag === 'input-textarea' && !near(rest.lastGlyphToEdge, rest.inset)) say(`glyph end -> box edge ${rest.lastGlyphToEdge} wants the inset ${rest.inset}`);
      if (ring && (!ring.ring.startsWith('solid') || ring.buttonRing !== 'none')) say(`focus ring glyph ${ring.ring} button ${ring.buttonRing}`);
      if (tabTo && !tabTo.includes('reset')) say(`Tab from the control reached ${tabTo.join(' > ')}`);
      const want = lang === 'en' ? 'Reset to inherited' : 'Сбросить к наследуемому';
      if (rest.name !== want || rest.title !== want) say(`name «${rest.name}» / «${rest.title}» wants «${want}»`);
      if (aria && !aria.includes(`button "${want}"`)) say(`accessibility tree ${aria}`);
    }
    await ctx.close();
  }
}
await browser.close(); server.close();
if (failed.length) problems.push(`not served: ${[...new Set(failed)].join(', ')}`);
writeFileSync(evidence, `${JSON.stringify({loads, problems}, null, 1)}\n`);
console.log(`${loads.length} loads, ${problems.length} problem(s)`);
for (const p of problems.slice(0, 80)) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);

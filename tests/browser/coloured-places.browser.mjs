#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Coloured places (owner decision C16, step S4d; owner confirmation
// msg-4d8fc65f, 2026-11-08) on the built bytes with the real Loader, light and
// dark, three loads each:
//
// - bg-primary and bg-primary-container paint the block and set its PLACE:
//   --sf-surface-place is the colour, and what stands on it -- the fill of a
//   tonal button, a tag and the segmented track, a bordered field's line, the
//   state layers -- comes from that colour. On the strong colour the controls'
//   own ink is on-primary; on the container the theme's ink stays.
// - They set no text colour: a bare bg- block keeps the text colour it
//   inherits; the author's color-on-primary / color-on-primary-container is
//   what paints the text.
// - An opaque block inside (sf-card) is its own place: the theme's fill,
//   line and ink come back, and its text is readable on it (4.5:1).
// - hover:bg-* and active:bg-* only paint: on hover and on press the
//   background changes and the place variables of the block and of what is in
//   it do not. On a block with both, pressing shows the active: colour (the
//   pressed state comes after the hover state, as :active follows :hover).
// - The page has no errors and a clean console.
// With a screenshot folder, each theme is saved there as a PNG.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// What stands in each place: text, a tonal button, a bordered field, a tag,
// a segmented track, and a card holding a field of its own.
const inside = (id) => `<p id="${id}-text">Текст места</p>
<sf-button id="${id}-button" appearance="tonal" scheme="on-surface" text="Кнопка"></sf-button>
<sf-input id="${id}-field" appearance="bordered" placeholder="Поле" default-value="Значение"></sf-input>
<sf-tag id="${id}-tag" text="Метка"></sf-tag>
<sf-segmented id="${id}-segmented" scheme="on-surface" name="${id}-seg"><script type="application/json" data-sf-settings>${JSON.stringify({items: [{value: 'a', text: 'Один'}, {value: 'b', text: 'Два'}]})}</script></sf-segmented>
<div class="sf-card" id="${id}-card"><p id="${id}-card-text">Карточка</p><sf-input id="${id}-card-field" appearance="bordered" default-value="Поле карточки"></sf-input></div>`;

const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}.place{display:flex;flex-direction:column;align-items:flex-start;gap:var(--sf-space-1);padding:var(--sf-space-2);margin-bottom:var(--sf-space-2);border-radius:var(--sf-radius-2)}.place>.sf-card{align-self:stretch}</style></head>
<body>
<section class="place bg-primary color-on-primary" id="strong">${inside('strong')}</section>
<section class="place bg-primary-container color-on-primary-container" id="soft">${inside('soft')}</section>
<section class="place bg-primary" id="bare"><p id="bare-text">Без цвета текста</p></section>
<section class="place" id="variants">
<div class="place hover:bg-primary" id="hover-only"><sf-button appearance="tonal" scheme="on-surface" text="Кнопка"></sf-button></div>
<div class="place active:bg-primary-container" id="active-only"><sf-button appearance="tonal" scheme="on-surface" text="Кнопка"></sf-button></div>
<div class="place hover:bg-primary active:bg-primary-container" id="both"><sf-button appearance="tonal" scheme="on-surface" text="Кнопка"></sf-button></div>
</section>
</body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

// Everything a place says, resolved on an element: the variables as colours.
const VARS = ['--sf-surface-place', '--sf-on-surface', '--sf-surface-container', '--sf-surface-state-hover', '--sf-outline', '--sf-outline-variant'];

async function run(theme, round) {
  page = shell(theme);
  const context = await browser.newContext({viewport: {width: 900, height: 1600}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  await tab.goto(`${base}/page`, {waitUntil: 'load'});
  await tab.waitForFunction(() => ['strong', 'soft'].every((id) => document.querySelector(`#${id}-button button.sf-button`)
    && document.querySelector(`#${id}-field input`) && document.querySelector(`#${id}-tag .sf-tag, #${id}-tag[class*="sf-tag"]`)
    && document.querySelector(`#${id}-segmented .sf-button-group, #${id}-segmented [class*="segmented"]`))
    && getComputedStyle(document.getElementById('strong')).backgroundColor !== 'rgba(0, 0, 0, 0)', null, {timeout: 20000});
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);

  const read = () => tab.evaluate((VARS) => {
    const probe = document.createElement('i');
    const at = (host, css) => { host.append(probe); probe.style.cssText = `position:absolute;${css}`; const s = getComputedStyle(probe); const value = css.startsWith('color') ? s.color : css.startsWith('border') ? s.borderTopColor : s.backgroundColor; probe.remove(); return value; };
    const vars = (host) => Object.fromEntries(VARS.map((name) => [name, at(host, `background-color:var(${name})`)]));
    const style = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
    const place = (id) => {
      const block = document.getElementById(id);
      const button = document.querySelector(`#${id}-button button.sf-button`);
      const field = document.querySelector(`#${id}-field input`);
      const fieldBox = field?.closest('.sf-input, [class*="sf-input"]') ?? field;
      const tag = document.querySelector(`#${id}-tag .sf-tag`) ?? document.querySelector(`#${id}-tag`);
      const track = document.querySelector(`#${id}-segmented .sf-button-group`) ?? document.querySelector(`#${id}-segmented [class*="segmented"]`);
      const card = document.getElementById(`${id}-card`);
      const cardField = document.querySelector(`#${id}-card-field input`);
      const cardFieldBox = cardField?.closest('.sf-input, [class*="sf-input"]') ?? cardField;
      return {
        background: getComputedStyle(block).backgroundColor,
        color: getComputedStyle(block).color,
        text: style(`#${id}-text`)?.color,
        vars: vars(block),
        button: {background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button.querySelector('.sf-button-text-container') ?? button).color},
        field: {background: getComputedStyle(fieldBox).backgroundColor, border: getComputedStyle(fieldBox).borderTopColor, color: getComputedStyle(field).color, cls: fieldBox.className},
        tag: tag ? {background: getComputedStyle(tag).backgroundColor, color: getComputedStyle(tag).color, cls: tag.className} : null,
        track: track ? {background: getComputedStyle(track).backgroundColor, cls: track.className} : null,
        card: card ? {
          background: getComputedStyle(card).backgroundColor, color: getComputedStyle(card).color, text: style(`#${id}-card-text`)?.color, vars: vars(card),
          field: cardFieldBox ? {background: getComputedStyle(cardFieldBox).backgroundColor, border: getComputedStyle(cardFieldBox).borderTopColor, color: getComputedStyle(cardField).color} : null,
        } : null,
      };
    };
    const root = document.body;
    return {
      theme: {vars: vars(root), color: getComputedStyle(root).color, card: at(root, 'background-color:var(--sf-surface-card)'), page: getComputedStyle(root).backgroundColor},
      expect: {
        primary: at(root, 'background-color:var(--sf-primary)'), container: at(root, 'background-color:var(--sf-primary-container)'),
        onPrimary: at(root, 'background-color:var(--sf-on-primary)'), onContainer: at(root, 'background-color:var(--sf-on-primary-container)'),
        hover: at(root, 'background-color:var(--sf-primary-hover)'), containerActive: at(root, 'background-color:var(--sf-primary-container-active)'),
        inkFill: at(root, 'background-color:light-dark(var(--sf-white--alfa-12), var(--sf-primary-20--alfa-12))'),
        inkLine: at(root, 'background-color:light-dark(var(--sf-white--alfa-64), var(--sf-primary-20--alfa-64))'),
        containerOutline: at(root, 'background-color:var(--sf-primary-outline)'),
      },
      strong: place('strong'), soft: place('soft'),
      bare: {background: getComputedStyle(document.getElementById('bare')).backgroundColor, color: getComputedStyle(document.getElementById('bare')).color, text: style('#bare-text').color, vars: vars(document.getElementById('bare'))},
      variants: Object.fromEntries(['hover-only', 'active-only', 'both'].map((id) => { const el = document.getElementById(id); return [id, {background: getComputedStyle(el).backgroundColor, vars: vars(el), button: getComputedStyle(el.querySelector('button.sf-button')).backgroundColor}]; })),
    };
  }, VARS);

  const s = await read();
  const where = `${theme} #${round}`;
  const {expect: e, theme: t} = s;
  const rgb = (c) => { const m = c.match(/[\d.]+/gu).map(Number); return {r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1}; };
  const over = (top, bottom) => { const f = rgb(top), b = rgb(bottom); return {r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1}; };
  const lum = ({r, g, b}) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (ink, ground) => { const a = lum(typeof ink === 'string' ? over(ink, 'rgb(255,255,255)') : ink), b = lum(typeof ground === 'string' ? rgb(ground) : ground); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const pageGround = rgb(t.page);
  const ground = (fill) => over(fill, `rgb(${pageGround.r},${pageGround.g},${pageGround.b})`);

  // 1. bg-primary: a strong place.
  const st = s.strong;
  ok(`${where} strong: paints the primary colour`, st.background === e.primary, st.background);
  ok(`${where} strong: --sf-surface-place is the colour`, st.vars['--sf-surface-place'] === e.primary, st.vars['--sf-surface-place']);
  ok(`${where} strong: control fill from its ink (12)`, st.vars['--sf-surface-container'] === e.inkFill && st.vars['--sf-surface-container'] !== t.vars['--sf-surface-container'], st.vars['--sf-surface-container']);
  ok(`${where} strong: boundary from its ink (64)`, st.vars['--sf-outline'] === e.inkLine, st.vars['--sf-outline']);
  ok(`${where} strong: states re-declared`, st.vars['--sf-surface-state-hover'] !== t.vars['--sf-surface-state-hover'], st.vars['--sf-surface-state-hover']);
  ok(`${where} strong: the author's color-on-primary paints the text`, st.color === e.onPrimary && st.text === e.onPrimary, `${st.color} / ${st.text}`);
  ok(`${where} strong: tonal button fill is the place fill`, st.button.background === e.inkFill, st.button.background);
  ok(`${where} strong: tonal button ink is on-primary`, st.button.color === e.onPrimary, st.button.color);
  ok(`${where} strong: field is transparent, its line the place boundary`, /, 0\)$/u.test(st.field.background) && st.field.border === e.inkLine, `${st.field.background} / ${st.field.border} (${st.field.cls})`);
  ok(`${where} strong: field text is on-primary`, st.field.color === e.onPrimary, st.field.color);
  ok(`${where} strong: tag stands on the place fill`, st.tag && st.tag.background === e.inkFill, JSON.stringify(st.tag));
  ok(`${where} strong: segmented track is the place fill`, st.track && st.track.background === e.inkFill, JSON.stringify(st.track));
  ok(`${where} strong: field text 4.5:1 on the colour`, contrast(st.field.color, ground(st.background)) >= 4.5, contrast(st.field.color, ground(st.background)).toFixed(2));

  // 2. bg-primary-container: a soft place.
  const so = s.soft;
  ok(`${where} soft: paints the primary container`, so.background === e.container, so.background);
  ok(`${where} soft: --sf-surface-place is the container`, so.vars['--sf-surface-place'] === e.container, so.vars['--sf-surface-place']);
  ok(`${where} soft: control fill is the colour's container`, so.vars['--sf-surface-container'] === e.container, so.vars['--sf-surface-container']);
  ok(`${where} soft: boundary is the colour's outline`, so.vars['--sf-outline'] === e.containerOutline, so.vars['--sf-outline']);
  ok(`${where} soft: the theme's ink stays for the controls`, so.vars['--sf-on-surface'] === t.vars['--sf-on-surface'], so.vars['--sf-on-surface']);
  ok(`${where} soft: the author's color-on-primary-container paints the text`, so.color === e.onContainer && so.text === e.onContainer, `${so.color} / ${so.text}`);
  ok(`${where} soft: tonal button fill is the place fill`, so.button.background === e.container, so.button.background);
  ok(`${where} soft: field is transparent, its line the place boundary`, /, 0\)$/u.test(so.field.background) && so.field.border === e.containerOutline, `${so.field.background} / ${so.field.border}`);
  ok(`${where} soft: tag stands on the place fill`, so.tag && so.tag.background === e.container, JSON.stringify(so.tag));
  ok(`${where} soft: segmented track is the place fill`, so.track && so.track.background === e.container, JSON.stringify(so.track));

  // 3. Opaque blocks inside reset to their own place.
  for (const [name, p] of [['strong', st], ['soft', so]]) {
    const c = p.card;
    ok(`${where} ${name} card: the card colour`, c && c.background === t.card, c?.background);
    ok(`${where} ${name} card: its place is the card`, c && c.vars['--sf-surface-place'] === t.card, c?.vars['--sf-surface-place']);
    ok(`${where} ${name} card: the theme's fill, line and ink come back`, c && ['--sf-surface-container', '--sf-outline', '--sf-outline-variant', '--sf-on-surface', '--sf-surface-state-hover'].every((v) => c.vars[v] === t.vars[v]), JSON.stringify(c?.vars));
    ok(`${where} ${name} card: field on the card has the theme line and ink`, c?.field && c.field.border === t.vars['--sf-outline'] && c.field.color === t.vars['--sf-on-surface'], JSON.stringify(c?.field));
    ok(`${where} ${name} card: its text is readable on it (4.5:1)`, c && contrast(c.text, rgb(c.background)) >= 4.5, `${c?.text} on ${c?.background}: ${c ? contrast(c.text, rgb(c.background)).toFixed(2) : '-'}`);
  }

  // 4. A bg- utility sets no text colour.
  ok(`${where} bare bg-primary: text colour is inherited, not set`, s.bare.color === t.color && s.bare.text === t.color, `${s.bare.color} / ${s.bare.text} (body ${t.color})`);
  ok(`${where} bare bg-primary: still a place`, s.bare.vars['--sf-surface-place'] === e.primary, s.bare.vars['--sf-surface-place']);

  // 5. hover: and active: only paint; pressed, the active: colour shows over the hover: one.
  const same = (a, b) => VARS.every((v) => a.vars[v] === b.vars[v]) && a.button === b.button;
  for (const [id, hoverWant, pressWant] of [['hover-only', e.hover, e.hover], ['active-only', null, e.containerActive], ['both', e.hover, e.containerActive]]) {
    const rest = s.variants[id];
    ok(`${where} ${id}: at rest no fill`, /, 0\)$/u.test(rest.background), rest.background);
    await tab.hover(`#${id}`, {position: {x: 4, y: 4}});
    await tab.waitForTimeout(300);
    const hovered = (await read()).variants[id];
    if (hoverWant) ok(`${where} ${id}: hover paints the hover colour`, hovered.background === hoverWant, hovered.background);
    else ok(`${where} ${id}: hover alone paints nothing`, hovered.background === rest.background, hovered.background);
    ok(`${where} ${id}: hover does not change the place`, same(hovered, rest), JSON.stringify({rest: rest.vars, hovered: hovered.vars}));
    await tab.mouse.down();
    await tab.waitForTimeout(300);
    const pressed = (await read()).variants[id];
    await tab.mouse.up();
    ok(`${where} ${id}: pressed paints ${pressWant === e.hover ? 'the hover colour' : 'the active colour'}`, pressed.background === pressWant, pressed.background);
    ok(`${where} ${id}: pressing does not change the place`, same(pressed, rest), JSON.stringify(pressed.vars));
    await tab.mouse.move(890, 1590);
    await tab.waitForTimeout(200);
  }

  if (shots && round === 1) await tab.screenshot({path: join(shots, `coloured-places-${theme}.png`), fullPage: true});
  ok(`${where} no page errors, clean console`, errors.length === 0, errors.join(' | '));
  await context.close();
  return s;
}

const seen = {};
try {
  for (const theme of ['light', 'dark']) for (const round of [1, 2, 3]) seen[`${theme} #${round}`] = await run(theme, round);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.pass);
for (const r of results) if (!r.pass || process.env.VERBOSE) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ` -- ${r.detail}` : ''}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
console.log('COLOURED_PLACES_OK');

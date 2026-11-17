#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> writes input-color-reset-c123.json (every
//        measure of every load).
//        SF_RELOADS=<n> loads each page n times (3 by default).
//        SF_PORT=<port> serves on that port (any free one by default).
//        SF_EXPECT=0 only measures (for a build without the change).
//        SF_SHOTS=<folder> keeps a picture of each view.
//
// Owner decision C123 (variant A) for the reset inside sf-input-color's frame,
// drawn by the real Framework over the Loader from the built bytes, at 1440 and
// 390 (touch), light and dark, normal and compact density, Russian and English:
//
//   (1) the reset is the field layer's action (.sf-field-action, the glyph
//       sf-input's clear and reveal draw): no plate at rest, under the pointer
//       and pressed (background and shadow none); the quiet ink
//       (on-surface-variant) at rest, the text's ink (on-surface) under the
//       pointer, primary on a press (owner decision C201, variant B1, which
//       made the field's action the plain icon button's ink; C123 (1) had the
//       text's ink on a press too); while the pointer is on it the frame shows the field's own
//       hover state layer (surface-state-hover), as the field does anywhere;
//   (2) the glyph is the field's icon of the step (its text line; at size 3
//       under 60rem the icon ladder's 28 over a 24 line, C151 (1)), the swatch's and the chevron's
//       size; the hit area is the frame's inner height and the glyph plus half
//       the inset wide, never under 24 either way;
//   (3) value -> glyph and glyph -> chevron are half the frame's inset
//       (C123 (6)), --sf-field-action--inset / 2;
//   (4) the keyboard ring stands round the glyph, the frame draws none;
//   (5) its name (aria-label = title) is «Вернуть цвет SIMAI» / «Restore SIMAI
//       colour» in the brand variant, «Вернуть унаследованный» / «Use the
//       inherited colour» in the field variant; a press resets the colour;
//   (6) the theme variant's reset beside the circle stays a plated
//       sf-button-icon (C123 (7));
//   no console error, no failed request, no horizontal scroll on any load.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const expect = process.env.SF_EXPECT !== '0';
// SF_SHOTS=<folder>: a picture of the fields at rest, the first Russian load of each view.
const shots = process.env.SF_SHOTS ? resolve(process.env.SF_SHOTS) : '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const FIELDS = [
  ['c-field-13', 'field', '1/3'], ['c-field-12', 'field', '1/2'], ['c-field', 'field', '1'], ['c-field-2', 'field', '2'], ['c-field-3', 'field', '3'],
  ['c-brand-12', 'brand', '1/2'], ['c-brand', 'brand', '1'],
];
const page = ({lang, theme, density}) => `<!doctype html><html lang="${lang}" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C123 colour reset</title>
<script>window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:24px;min-inline-size:0;max-inline-size:480px}
#ink-variant{color:var(--sf-on-surface-variant)}#ink-text{color:var(--sf-on-surface)}#ink-primary{color:var(--sf-primary)}#state-hover{background-color:var(--sf-surface-state-hover)}</style></head><body><main>
<i id="ink-variant"></i><i id="ink-text"></i><i id="ink-primary"></i><i id="state-hover"></i>
${FIELDS.map(([id, variant, size]) => `<sf-input-color id="${id}"${variant === 'brand' ? ' variant="brand"' : ''} label="${variant === 'brand' ? 'Фирменный цвет' : 'Цвет'}" size="${size}" value="${variant === 'brand' ? '#0b57d0' : '#1a7f37'}" clearable></sf-input-color>`).join('\n')}
<sf-input-color id="c-theme" variant="theme" value="#0b57d0" clearable target="#theme-target"></sf-input-color><div id="theme-target"></div>
</main></body></html>`;

const WORDS = {
  ru: {field: 'Вернуть унаследованный', brand: 'Вернуть цвет SIMAI'},
  en: {field: 'Use the inherited colour', brand: 'Restore SIMAI colour'},
};

const failed = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  if (url.pathname === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page({lang: url.searchParams.get('lang'), theme: url.searchParams.get('theme'), density: url.searchParams.get('density')}));
  }
  const match = decodeURIComponent(url.pathname).match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    failed.push(url.pathname);
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(Number(process.env.SF_PORT || 0), '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// One field's reset: its box, its glyph, its neighbours, its paint.
const MEASURE = (id) => {
  const round = (value) => Math.round(value * 100) / 100;
  const element = document.getElementById(id);
  const frame = element.querySelector('.sf-color-frame');
  const trigger = frame?.querySelector('.sf-color-trigger');
  const clear = frame?.querySelector('[data-action="clear"]');
  if (!frame || !trigger || !clear) return null;
  const button = clear.matches('button') ? clear : clear.querySelector('button') || clear;
  const glyph = button.querySelector('.sf-icon') || button;
  const chevron = frame.querySelector('.sf-color-chevron');
  const chevronBox = (chevron?.matches('.sf-icon') ? chevron : chevron?.querySelector('.sf-icon')) || chevron;
  const probe = (css) => {
    const node = document.createElement('i');
    node.style.cssText = `position:absolute;visibility:hidden;block-size:1px;inline-size:${css}`;
    frame.append(node);
    const width = node.getBoundingClientRect().width;
    node.remove();
    return round(width);
  };
  const frameBox = frame.getBoundingClientRect();
  const triggerBox = trigger.getBoundingClientRect();
  const hit = button.getBoundingClientRect();
  const icon = glyph.getBoundingClientRect();
  const chev = chevronBox?.getBoundingClientRect();
  const style = getComputedStyle(button);
  const iconStyle = getComputedStyle(glyph);
  const inset = probe('var(--sf-color--space-x)');
  return {
    tag: button.tagName.toLowerCase(),
    fieldAction: button.classList.contains('sf-field-action'),
    host: clear.tagName.toLowerCase(),
    word: button.getAttribute('aria-label') || clear.getAttribute('aria-label'),
    title: button.getAttribute('title') || clear.getAttribute('title'),
    background: style.backgroundColor,
    shadow: style.boxShadow,
    ink: iconStyle.color,
    frameBackground: getComputedStyle(frame).backgroundColor,
    frameOutline: getComputedStyle(frame).outlineStyle,
    ring: `${iconStyle.outlineStyle} ${iconStyle.outlineWidth}`,
    hitW: round(hit.width), hitH: round(hit.height),
    glyph: round(icon.width), glyphH: round(icon.height),
    chevron: chev ? round(chev.width) : null,
    text: probe('var(--sf-color--text-height)'),
    inset,
    frameInner: round(frameBox.height - 2 * probe('var(--sf-px)')),
    valueToGlyph: round(icon.left - triggerBox.right),
    glyphToChevron: chev ? round(chev.left - icon.right) : null,
    glyphToEdge: round(frameBox.right - icon.right),
    hitInside: hit.top >= frameBox.top - 0.5 && hit.bottom <= frameBox.bottom + 0.5,
  };
};

const TOKENS = () => ({
  variant: getComputedStyle(document.getElementById('ink-variant')).color,
  text: getComputedStyle(document.getElementById('ink-text')).color,
  primary: getComputedStyle(document.getElementById('ink-primary')).color,
  hover: getComputedStyle(document.getElementById('state-hover')).backgroundColor,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
});

const near = (a, b, tolerance = 0.5) => a !== null && b !== null && Math.abs(a - b) <= tolerance;
const clearPlate = (value) => value === 'rgba(0, 0, 0, 0)' || value === 'transparent';

const browser = await chromium.launch();
const loads = [];
const problems = [];
for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    for (const density of ['normal', 'compact']) {
      for (const lang of ['ru', 'en']) {
        if (lang === 'en' && (theme === 'dark' || density === 'compact')) continue;
        for (let load = 1; load <= reloads; load += 1) {
          const context = await browser.newContext(width === 390
            ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce'}
            : {viewport: {width: 1440, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
          tab.on('console', (message) => { if (message.type() === 'error') errors.push(`console ${message.text()}`); });
          tab.on('requestfailed', (request) => errors.push(`requestfailed ${request.url()}`));
          await tab.goto(`${origin}/?lang=${lang}&theme=${theme}&density=${density}`, {waitUntil: 'load'});
          await tab.waitForFunction(() => [...document.querySelectorAll('sf-input-color')].every((element) => element.querySelector('[data-action="clear"]')), null, {timeout: 20000});
          await tab.evaluate(() => document.fonts.ready);
          await tab.waitForTimeout(600);
          const tokens = await tab.evaluate(TOKENS);
          const view = `${width} ${theme} ${density} ${lang} #${load}`;
          if (shots && load === 1 && lang === 'ru') await tab.locator('main').screenshot({path: join(shots, `reset-${width}-${theme}-${density}.png`)});
          const fields = {};
          for (const [id, variant] of FIELDS) {
            const rest = await tab.evaluate(MEASURE, id);
            if (!rest) { fields[id] = null; continue; }
            const selector = `#${id} .sf-color-frame [data-action="clear"]`;
            let hover = null;
            let pressed = null;
            if (width === 1440) {
              await tab.hover(selector);
              await tab.waitForTimeout(300);
              hover = await tab.evaluate(MEASURE, id);
              await tab.mouse.down();
              await tab.waitForTimeout(300);
              pressed = await tab.evaluate(MEASURE, id);
              // Released away from the reset: a press, not a click.
              await tab.mouse.move(0, 0);
              await tab.mouse.up();
              await tab.waitForTimeout(80);
            }
            fields[id] = {variant, rest, hover, pressed};
          }
          // (4) the keyboard ring: Tab from the field's value to its reset.
          let ring = null;
          if (width === 1440) {
            await tab.focus('#c-field .sf-color-trigger');
            await tab.keyboard.press('Tab');
            await tab.waitForTimeout(80);
            ring = await tab.evaluate(() => {
              const active = document.activeElement;
              const frame = document.querySelector('#c-field .sf-color-frame');
              const glyph = active?.querySelector?.('.sf-icon') || active;
              return {focused: active?.getAttribute('data-action') || active?.closest?.('[data-action]')?.getAttribute('data-action') || active?.tagName,
                glyph: glyph ? `${getComputedStyle(glyph).outlineStyle} ${getComputedStyle(glyph).outlineWidth}` : null,
                button: active ? getComputedStyle(active).outlineStyle : null,
                frame: getComputedStyle(frame).outlineStyle};
            });
          }
          // (5) a press resets the colour (field variant; the first load of a view).
          let pressReset = null;
          if (load === 1) {
            await tab.click('#c-field .sf-color-frame [data-action="clear"]');
            await tab.waitForTimeout(150);
            pressReset = await tab.evaluate(() => ({value: document.getElementById('c-field').value, open: document.querySelector('#c-field .sf-color')?.dataset.open, reset: Boolean(document.querySelector('#c-field .sf-color-frame [data-action="clear"]'))}));
          }
          const theme6 = await tab.evaluate(() => {
            const clear = document.querySelector('#c-theme [data-action="clear"]');
            const host = clear?.closest('sf-button-icon');
            return clear ? {tag: host ? 'sf-button-icon' : clear.tagName.toLowerCase(), plated: clear.matches('.sf-icon-button') || Boolean(clear.querySelector('.sf-icon-button')) || Boolean(host)} : null;
          });
          loads.push({view, width, theme, density, lang, load, errors, tokens, fields, ring, pressReset, themeVariant: theme6});
          if (errors.length) problems.push(`${view}: ${errors.join('; ')}`);
          if (tokens.overflow > 0) problems.push(`${view}: horizontal scroll ${tokens.overflow}`);
          if (expect) {
            for (const [id, reading] of Object.entries(fields)) {
              if (!reading) { problems.push(`${view}: ${id} drew no reset`); continue; }
              const {rest, hover, pressed, variant} = reading;
              const say = (text) => problems.push(`${view}: ${id} ${text}`);
              if (!rest.fieldAction || rest.tag !== 'button') say(`reset is <${rest.host}> ${rest.tag}, not a .sf-field-action button`);
              for (const [state, m] of [['rest', rest], ['hover', hover], ['pressed', pressed]]) {
                if (!m) continue;
                if (!clearPlate(m.background) || (m.shadow && m.shadow !== 'none')) say(`${state}: a plate (${m.background}, ${m.shadow})`);
              }
              if (rest.ink !== tokens.variant) say(`rest ink ${rest.ink}, wants on-surface-variant ${tokens.variant}`);
              if (hover && hover.ink !== tokens.text) say(`hover ink ${hover.ink}, wants on-surface ${tokens.text}`);
              if (pressed && pressed.ink !== tokens.primary) say(`pressed ink ${pressed.ink}, wants primary ${tokens.primary} (C201)`);
              if (hover && hover.frameBackground !== tokens.hover) say(`hover: the frame's state layer ${hover.frameBackground}, wants ${tokens.hover}`);
              // The glyph is the field's icon of the step (C151 (1)): its text
              // line, except size 3 under 60rem, where the line is 24 and the
              // icon the ladder's --sf-icon-size-4 (28), as the chevron.
              const phoneThree = id === 'c-field-3' && width < 960;
              if ((!phoneThree && !near(rest.glyph, rest.text)) || !near(rest.glyph, rest.chevron)) say(`glyph ${rest.glyph}, text line ${rest.text}, chevron ${rest.chevron}`);
              if (!near(rest.hitH, Math.max(rest.frameInner, 24))) say(`hit height ${rest.hitH}, wants the frame's inner ${rest.frameInner}`);
              if (!near(rest.hitW, Math.max(rest.glyph + rest.inset / 2, 24))) say(`hit width ${rest.hitW}, wants max(${rest.glyph} + ${rest.inset}/2, 24)`);
              if (rest.hitW < 23.5 || rest.hitH < 23.5) say(`hit area ${rest.hitW} x ${rest.hitH} under 24`);
              if (!rest.hitInside) say('hit area stands out of the frame');
              if (!near(rest.valueToGlyph, rest.inset / 2)) say(`value -> glyph ${rest.valueToGlyph}, C123 wants ${rest.inset / 2}`);
              if (!near(rest.glyphToChevron, rest.inset / 2)) say(`glyph -> chevron ${rest.glyphToChevron}, C123 wants ${rest.inset / 2}`);
              const want = WORDS[lang][variant];
              if (rest.word !== want || rest.title !== want) say(`reset says «${rest.word}» / «${rest.title}», wants «${want}»`);
            }
            if (ring) {
              if (ring.focused !== 'clear') problems.push(`${view}: Tab from the value reached ${ring.focused}, not the reset`);
              else if (!ring.glyph?.startsWith('solid') || ring.frame !== 'none' || ring.button !== 'none') problems.push(`${view}: keyboard ring glyph ${ring.glyph}, button ${ring.button}, frame ${ring.frame}`);
            }
            if (pressReset && (pressReset.value !== '' || pressReset.reset || pressReset.open === 'true')) problems.push(`${view}: a press on the reset left ${JSON.stringify(pressReset)}`);
            if (!theme6 || theme6.tag !== 'sf-button-icon') problems.push(`${view}: the theme variant's reset is ${JSON.stringify(theme6)}, C123 (7) keeps the plated sf-button-icon`);
          }
          await context.close();
        }
      }
    }
  }
}
await browser.close();
server.close();
if (failed.length) problems.push(`not served: ${[...new Set(failed)].join(', ')}`);
if (evidence) writeFileSync(join(evidence, 'input-color-reset-c123.json'), `${JSON.stringify({loads, problems}, null, 1)}\n`);
console.log(`${loads.length} loads, ${problems.length} problem(s)`);
for (const problem of problems.slice(0, 60)) console.log(`  ${problem}`);
process.exit(problems.length ? 1 : 0);

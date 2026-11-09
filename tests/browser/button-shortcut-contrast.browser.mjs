#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The keys of an sf-button shortcut read on every look of the button
// (docs review R009; rule C04: the key's colour comes from the button's text
// and reads on a filled button too). On pair ui-b4a77681f0a7 the caps wore the
// label's ink at 80 % on a fill of 12 % of that ink (about 9.6 % of the label),
// and the key letters fell under 4.5:1 -- 4.03:1 on the default primary button
// in light, 4.45:1 in dark, 4.12:1 on default primary danger, 3.71:1 / 3.88:1
// on the outline on-surface-variant search trigger (buttons review
// 2026-11-09).
//
// Through the real Loader, in light and in dark, for every appearance and
// scheme of sf-button and for status danger on every appearance, it takes the
// first key of the shortcut and composes, as the screen does: the page's
// background, the button's background over it, the key's plate over that, the
// key's ink over the plate. The contrast of that ink against that plate
// (WCAG 2.x relative luminance) holds at 4.5:1 or more on every look, with no
// exception.
//
// Danger reads as danger on every appearance (C13): the label and the icon of
// a danger button wear the error role of its appearance (on-error on default,
// on-error-container on tonal, error on outline, ghost and surface) at 4.5:1 or
// more against the button. surface danger drew the plain ink before sf-button
// 1.11.0 (black in light, white in dark).
//
// surface + on-surface-variant is retired (sf-button 1.11.0, as C15 did on the
// icon buttons; it read 4.38:1 in dark): it draws as surface + on-surface and
// the page warns once, naming the replacement. The page raises no error.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const APPEARANCES = ['default', 'tonal', 'outline', 'ghost', 'surface'];
const SCHEMES = ['primary', 'secondary', 'on-surface', 'on-surface-variant'];
const LOOKS = [
  ...APPEARANCES.flatMap((appearance) => SCHEMES.map((scheme) => ({appearance, scheme, status: ''}))),
  ...APPEARANCES.map((appearance) => ({appearance, scheme: 'primary', status: 'danger'})),
];
const MINIMUM = 4.5;
// The error role a danger button's label and icon wear, by appearance.
const DANGER_INK = {default: '--sf-on-error', tonal: '--sf-on-error-container', outline: '--sf-error', ghost: '--sf-error', surface: '--sf-error'};
const RETIRED = 'surface on-surface-variant';
const keyOf = ({appearance, scheme, status}) => [appearance, status || scheme].join(' ');

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}
main{display:flex;flex-wrap:wrap;gap:12px;padding:16px;align-items:center}</style></head><body><main>
${LOOKS.map((look) => `<sf-button data-look="${keyOf(look)}" text="Поиск" shortcut="mod+k" appearance="${look.appearance}" scheme="${look.scheme}"${look.status ? ` status="${look.status}" icon-start="delete"` : ''}></sf-button>`).join('\n')}
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
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

// In the page: every colour read through a canvas, so rgb(), color(srgb ...)
// and color-mix() results all come back as 8-bit sRGB with alpha.
const MEASURE = (DANGER_INK_ROLES) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const rgba = (colour) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = colour;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    // Un-premultiplied by the canvas already; alpha back to 0..1.
    return {r, g, b, a: a / 255};
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return {r: 0, g: 0, b: 0, a: 0};
    const mix = (channel) => (top[channel] * top.a + bottom[channel] * bottom.a * (1 - top.a)) / a;
    return {r: mix('r'), g: mix('g'), b: mix('b'), a};
  };
  const luminance = ({r, g, b}) => {
    const linear = (value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const ratio = (one, two) => {
    const [light, dark] = [luminance(one), luminance(two)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const hex = ({r, g, b}) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  // The backdrop of an element: every background from the root down to it.
  const backdrop = (element) => {
    const chain = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
    return chain.reduce((below, node) => over(rgba(getComputedStyle(node).backgroundColor), below), {r: 255, g: 255, b: 255, a: 1});
  };
  // The host hands its data attributes to the native button it draws.
  return Array.from(document.querySelectorAll('[data-look]')).map((host) => {
    const button = host.matches('button.sf-button') ? host : host.querySelector('button.sf-button');
    const label = button?.querySelector('.sf-button-text-container');
    const key = button?.querySelector('.sf-button-shortcut .sf-kbd--group > kbd');
    if (!button || !key || !label) return {look: host.dataset.look, missing: true};
    const surface = backdrop(button);
    const plate = backdrop(key);
    const keyStyle = getComputedStyle(key);
    const ink = over(rgba(keyStyle.color), plate);
    const labelInk = over(rgba(getComputedStyle(label).color), surface);
    const icon = button.querySelector('.sf-icon');
    // A role's colour as this button's scope resolves it.
    const role = (name) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${name})`;
      button.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const appearance = host.dataset.look.split(' ')[0];
    const danger = host.dataset.look.endsWith(' danger');
    return {
      classes: button.className,
      labelColour: getComputedStyle(label).color,
      iconColour: icon ? getComputedStyle(icon).color : null,
      dangerInk: danger ? role(DANGER_INK_ROLES[appearance]) : null,
      iconContrast: icon ? Math.round(ratio(over(rgba(getComputedStyle(icon).color), surface), surface) * 100) / 100 : null,
      look: host.dataset.look,
      button: hex(surface),
      plate: hex(plate),
      keyColour: keyStyle.color,
      keyBackground: keyStyle.backgroundColor,
      ink: hex(ink),
      contrast: Math.round(ratio(ink, plate) * 100) / 100,
      againstButton: Math.round(ratio(ink, surface) * 100) / 100,
      label: Math.round(ratio(labelInk, surface) * 100) / 100,
    };
  });
};

const failures = [];
const warnings = {};
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const tab = await browser.newPage({viewport: {width: 1280, height: 900}, colorScheme: theme});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    const warned = [];
    warnings[theme] = warned;
    tab.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
      if (message.type() === 'warning' && /on-surface-variant/u.test(message.text())) warned.push(message.text());
    });
    await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
    await tab.waitForFunction((count) => customElements.get('sf-button')
      && document.querySelectorAll('[data-look] .sf-button-shortcut kbd kbd').length >= count, LOOKS.length, {timeout: 20000})
      .catch(() => failures.push(`${theme}: not every button drew its keys`));
    await tab.waitForFunction(() => Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 15000})
      .catch(() => failures.push(`${theme}: the kbd sheet never arrived`));
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(300);
    const rows = await tab.evaluate(MEASURE, DANGER_INK);
    seen[theme] = rows;
    if (evidence) await tab.screenshot({path: join(evidence, `button-shortcut-contrast-${theme}.png`), fullPage: true});
    if (rows.length !== LOOKS.length) failures.push(`${theme}: ${rows.length} buttons measured, ${LOOKS.length} drawn`);
    for (const row of rows) {
      if (row.missing) failures.push(`${theme} ${row.look}: no button or no key`);
      else if (!(row.contrast >= MINIMUM)) failures.push(`${theme} ${row.look}: key ink ${row.ink} on plate ${row.plate} is ${row.contrast}:1, under ${MINIMUM}:1`);
      if (row.missing) continue;
      if (row.dangerInk) {
        if (row.labelColour !== row.dangerInk) failures.push(`${theme} ${row.look}: the label is ${row.labelColour}, not the danger ink ${row.dangerInk}`);
        if (row.iconColour !== row.dangerInk) failures.push(`${theme} ${row.look}: the icon is ${row.iconColour}, not the danger ink ${row.dangerInk}`);
        if (!(row.label >= MINIMUM) || !(row.iconContrast >= MINIMUM)) failures.push(`${theme} ${row.look}: danger label ${row.label}:1, icon ${row.iconContrast}:1, under ${MINIMUM}:1`);
      }
      if (row.look === RETIRED && (!/\bsf-button--on-surface\b/u.test(row.classes) || /sf-button--on-surface-variant/u.test(row.classes))) failures.push(`${theme} ${RETIRED}: not drawn as on-surface (${row.classes})`);
    }
    if (warned.length !== 1 || !/scheme="on-surface"/u.test(warned[0] ?? '')) failures.push(`${theme}: ${warned.length} console warnings for the retired pair, expected one naming scheme="on-surface"`);
    if (errors.length) failures.push(`${theme}: console ${JSON.stringify(errors)}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (evidence) writeFileSync(join(evidence, 'button-shortcut-contrast.json'), `${JSON.stringify({minimum: MINIMUM, seen, warnings, failures}, null, 1)}\n`);
const table = Object.fromEntries(Object.entries(seen).map(([theme, rows]) => [theme, Object.fromEntries(rows.map((row) => [row.look, row.contrast]))]));
console.log(JSON.stringify({checked: LOOKS.length * 2, minimum: MINIMUM, contrast: table, failures}, null, 1));
if (failures.length) process.exit(1);

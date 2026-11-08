#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-button's joins and keys on the built bytes, over the Loader as a page
// uses it, in the light and the dark theme:
//
//   - joins: three sf-button segments (start, middle, end) side by side, every
//     appearance at every size, and the mixed control the docs show (an
//     outline segment beside link segments), draw one line where two segments
//     meet -- the painted width at the join is the width of one edge
//     (--sf-px), not two; sf-button-group (default) the same;
//   - keys' ink: a shortcut's keys are the kbd component's soft caps (owner
//     decision 2026-11-07, docs review R030, rule C04, which supersedes the
//     inverse caps of R009): the label's ink at 80 % on a fill of that ink at
//     12 %, no edge, so they follow the button they sit on. The key's text
//     against its fill is at least 3:1 (the ink family's measure: the keys are
//     a quieter hint beside the label, which keeps its own contrast), and the
//     fill shows on the button (above 1.05:1), for every appearance x scheme
//     (status error included) x theme;
//   - keys' widths: a key of one character -- a letter, ⇧, ⌘, ⌥, ↵ -- is a
//     square of the key's height at every size; a key of several letters
//     (Esc, Ctrl, Shift) hugs its text with the one key padding on each side.
//
// --report prints the measurements and exits 0 whatever they say (the
// before-and-after table of a fix).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const APPEARANCES = ['default', 'tonal', 'outline', 'link', 'surface'];
const SCHEMES = [['primary', ''], ['secondary', ''], ['on-surface', ''], ['on-surface-variant', ''], ['primary', 'error']];
const attr = (name, value) => (value ? ` ${name}="${value}"` : '');

const joinRows = [];
for (const appearance of APPEARANCES) {
  for (const size of SIZES) {
    joinRows.push({id: `j-${appearance}-${size.replace('/', '_')}`, label: `${appearance} ${size}`, html: ['start', 'middle', 'end'].map((segment, index) =>
      `<sf-button appearance="${appearance}" scheme="on-surface" size="${size}" segment="${segment}" text="${['День', 'Неделя', 'Месяц'][index]}"></sf-button>`).join('')});
  }
}
for (const size of SIZES) {
  joinRows.push({id: `j-docs-${size.replace('/', '_')}`, label: `outline + link ${size}`, html:
    `<sf-button appearance="outline" scheme="on-surface" size="${size}" segment="start" text="День"></sf-button>`
    + `<sf-button appearance="link" scheme="on-surface" size="${size}" segment="middle" text="Неделя"></sf-button>`
    + `<sf-button appearance="link" scheme="on-surface" size="${size}" segment="end" text="Месяц"></sf-button>`});
  joinRows.push({id: `j-group-${size.replace('/', '_')}`, label: `sf-button-group ${size}`, group: true, html:
    `<sf-button-group aria-label="Период" size="${size}" value="week"><script type="application/json" data-sf-settings>{"items":[{"value":"day","label":"День"},{"value":"week","label":"Неделя"},{"value":"month","label":"Месяц"}]}</script></sf-button-group>`});
}

const keyRows = [];
for (const appearance of APPEARANCES) {
  for (const [scheme, status] of SCHEMES) {
    keyRows.push({id: `k-${appearance}-${scheme}-${status || 'none'}`, appearance, scheme, status});
  }
}
const widthRows = SIZES.map((size) => ({id: `w-${size.replace('/', '_')}`, size}));

const body = () => `
<style>.row{display:flex;align-items:center;gap:0;margin:8px 16px}.stack{display:flex;flex-wrap:wrap;gap:8px;margin:8px 16px}</style>
${joinRows.map((row) => `<div class="row" id="${row.id}" role="group" aria-label="Период">${row.html}</div>`).join('\n')}
<div class="stack">${keyRows.map((row) => `<sf-button id="${row.id}" appearance="${row.appearance}" scheme="${row.scheme}"${attr('status', row.status)} text="Сохранить" shortcut="shift+mod+p"></sf-button>`).join('')}</div>
${widthRows.map((row) => `<div class="stack" id="${row.id}">
  <sf-button size="${row.size}" appearance="outline" scheme="on-surface" text="Вкладка" shortcut="shift+mod+p"></sf-button>
  <sf-button size="${row.size}" appearance="outline" scheme="on-surface" text="Закрыть" shortcut="escape"></sf-button>
  <sf-button size="${row.size}" appearance="outline" scheme="on-surface" text="Отправить" shortcut="alt+enter"></sf-button>
</div>`).join('\n')}`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">${body()}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/light' || path === '/dark') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
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

// Everything is measured in the page: colours through a canvas (any CSS colour
// to sRGB bytes), translucent fills composited over what lies under them.
const MEASURE = ({joinIds, keyIds, widthIds}) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const rgba = (colour) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = colour;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    // getImageData hands back unpremultiplied bytes.
    return [r, g, b, a / 255];
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  // The opaque colour a node's background shows: its fill over its ancestors'.
  const backdrop = (node) => {
    const chain = [];
    for (let at = node; at && at.nodeType === 1; at = at.parentElement) chain.push(getComputedStyle(at).backgroundColor);
    let colour = [255, 255, 255, 1];
    for (const fill of chain.reverse()) colour = over(rgba(fill), colour);
    return colour;
  };
  const luminance = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  const hex = (c) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  const edge = (style, side) => {
    const width = parseFloat(style[`border${side}Width`]);
    const visible = style[`border${side}Style`] !== 'none' && style[`border${side}Style`] !== 'hidden' && rgba(style[`border${side}Color`])[3] > 0;
    return visible ? width : 0;
  };
  const joins = {};
  for (const id of joinIds) {
    const row = document.getElementById(id);
    const buttons = Array.from(row.querySelectorAll('button.sf-button'));
    const seams = [];
    for (let i = 0; i + 1 < buttons.length; i += 1) {
      const a = buttons[i].getBoundingClientRect();
      const b = buttons[i + 1].getBoundingClientRect();
      const sa = getComputedStyle(buttons[i]);
      const sb = getComputedStyle(buttons[i + 1]);
      // The painted intervals at the seam, then their union: two edges that
      // overlap are one line.
      const spans = [];
      const ae = edge(sa, 'Right');
      const bs = edge(sb, 'Left');
      if (ae) spans.push([a.right - ae, a.right]);
      if (bs) spans.push([b.left, b.left + bs]);
      spans.sort((m, n) => m[0] - n[0]);
      let painted = 0;
      let reach = -Infinity;
      for (const [from, to] of spans) {
        const start = Math.max(from, reach);
        if (to > start) painted += to - start;
        reach = Math.max(reach, to);
      }
      seams.push({painted: Math.round(painted * 100) / 100, gap: Math.round((b.left - a.right) * 100) / 100, end: ae, start: bs});
    }
    const px = (() => { const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;inline-size:var(--sf-px)'; row.append(probe); const w = probe.getBoundingClientRect().width; probe.remove(); return w; })();
    const outer = buttons.map((button) => { const s = getComputedStyle(button); return [edge(s, 'Top'), edge(s, 'Bottom')]; });
    joins[id] = {seams, px, heights: buttons.map((button) => Math.round(button.getBoundingClientRect().height * 100) / 100), outer};
  }

  const keys = {};
  for (const id of keyIds) {
    const button = document.querySelector(`#${id} button.sf-button`);
    const key = button.querySelector('.sf-button-shortcut .sf-kbd--group > kbd');
    const label = button.querySelector('.sf-button-text-container');
    const ks = getComputedStyle(key);
    const buttonFill = backdrop(button);
    const keyFill = backdrop(key);
    const ink = over(rgba(ks.color), keyFill);
    const keyEdge = over(rgba(ks.borderTopColor), buttonFill);
    keys[id] = {
      button: hex(buttonFill), label: hex(over(rgba(getComputedStyle(label).color), buttonFill)), keyFill: hex(keyFill), keyInk: hex(ink), keyEdge: hex(keyEdge),
      text: contrast(ink, keyFill), fillAgainstButton: contrast(keyFill, buttonFill), edgeAgainstButton: contrast(keyEdge, buttonFill),
    };
  }

  const widths = {};
  for (const id of widthIds) {
    widths[id] = Array.from(document.querySelectorAll(`#${id} .sf-button-shortcut .sf-kbd--group > kbd`)).map((key) => {
      const r = key.getBoundingClientRect();
      const s = getComputedStyle(key);
      const range = document.createRange();
      range.selectNodeContents(key);
      const text = range.getBoundingClientRect().width;
      const pad = [parseFloat(s.paddingLeft), parseFloat(s.paddingRight)];
      const border = [parseFloat(s.borderLeftWidth), parseFloat(s.borderRightWidth)];
      return {cap: key.textContent.trim(), width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100, text: Math.round(text * 100) / 100, pad, border};
    });
  }
  return {joins, keys, widths};
};

const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      const tab = await browser.newPage({viewport: {width: 1280, height: 900}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
      await tab.waitForFunction(() => customElements.get('sf-button') && customElements.get('sf-button-group')
        && document.querySelectorAll('.sf-button-shortcut .sf-kbd--group > kbd').length > 0
        && document.querySelectorAll('.row button.sf-button').length > 0
        && Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 30000})
        .catch(() => failures.push(`${theme}: the page never drew its buttons with the kbd sheet`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const themeClass = await tab.evaluate(() => document.documentElement.className);
      if (!themeClass.includes(`theme-${theme}`)) failures.push(`${theme} load ${load}: <html> is «${themeClass}»`);
      const seen = await tab.evaluate(MEASURE, {joinIds: joinRows.map((row) => row.id), keyIds: keyRows.map((row) => row.id), widthIds: widthRows.map((row) => row.id)});
      if (errors.length) failures.push(`${theme} load ${load}: console ${JSON.stringify(errors)}`);
      if (load === 1) {
        report[theme] = seen;
        await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-joins-keys-${theme}.png`), fullPage: true}).catch(() => {});
      } else if (JSON.stringify(seen) !== JSON.stringify(report[theme])) {
        failures.push(`${theme} load ${load}: the measurements differ from the first load`);
      }
      await tab.close();
    }

    const seen = report[theme];
    for (const row of joinRows) {
      const {seams, px, heights} = seen.joins[row.id];
      for (const seam of seams) {
        if (seam.painted > px + 0.01) failures.push(`${theme} ${row.label}: a join paints ${seam.painted}px, one edge is ${px}px`);
      }
      if (new Set(heights).size > 1) failures.push(`${theme} ${row.label}: segments of different heights ${heights}`);
    }
    for (const row of keyRows) {
      const key = seen.keys[row.id];
      if (key.text < 3) failures.push(`${theme} ${row.id}: the key's text is ${key.text}:1 on its fill`);
      if (key.fillAgainstButton <= 1.05) failures.push(`${theme} ${row.id}: the key's fill does not show on the button (${key.fillAgainstButton}:1)`);
    }
    for (const row of widthRows) {
      for (const key of seen.widths[row.id]) {
        if ([...key.cap].length === 1) {
          if (Math.abs(key.width - key.height) > 0.5) failures.push(`${theme} size ${row.size}: the one-character key ${key.cap} is ${key.width}x${key.height}, not a square`);
        } else {
          const hug = key.text + key.pad[0] + key.pad[1] + key.border[0] + key.border[1];
          if (Math.abs(key.width - hug) > 0.5) failures.push(`${theme} size ${row.size}: the key ${key.cap} is ${key.width}px, its text and padding ${Math.round(hug * 100) / 100}px`);
          if (key.pad[0] !== key.pad[1]) failures.push(`${theme} size ${row.size}: the key ${key.cap} has uneven padding ${key.pad}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report, failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;

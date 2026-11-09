#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// The dropping panels that are not sf-menu-context -- sf-dropdown's list (what
// sf-select and the field renderers draw), sf-input-lookup's list and
// sf-profile-picker's panel -- on the context menu's geometry, owner rules
// C05-C07 (docs review R029, 2026-11-07; R017's 1/3 inset replaced), loaded
// by the real Loader from their rules, at sizes 1/2 and 1, light and dark:
//  - C05: a row's highlight stands --sf-space-1/4 from the panel's inner edge,
//    is as tall as a control of the panel's size and rounded --sf-radius--ui;
//    its picture or text starts --sf-space-1/2 inside it, a picture
//    --sf-space-1/2 before the text.
//  - C06 (sf-dropdown): the search is a header: no frame, across the panel's
//    inner width, a row's height and the inset above and below, a hairline
//    under it; its text over the rows' text, its icon over their icon (at the
//    header's end, when they have none); only the rows scroll.
//  - C07: a scrollbar only when the rows do not fit; in the inline-end inset
//    while it takes room: the area's inline-end padding 0, the track the
//    inset, a thumb of --sf-space-1/4 and the inset. Headless Chrome draws no
//    scrollbar, so with SF_PROBE_HEADED=1 the probe runs the installed Chrome
//    headed with classic scrollbars (--disable-features=OverlayScrollbar),
//    reads the track's width and finds the thumb's columns on a screenshot:
//    highlight-to-thumb = thumb = thumb-to-edge = the inset.
// SF_PROBE_EVIDENCE=1 prints the measurements; SF_PROBE_SHOTS=<dir> saves a
// picture of every panel measured.
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

const shell = (theme, body) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;background:var(--sf-surface-1)">
${body}
</body></html>`;

const headed = process.env.SF_PROBE_HEADED === '1';
const failures = [];
const note = (detail) => failures.push(detail);
const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 0.5;
const browser = await chromium.launch(headed
  ? {channel: 'chrome', headless: false, args: ['--disable-features=OverlayScrollbar']}
  : {});

const FEW = ['Русский', 'English', 'Deutsch'];
const MANY = ['Русский', 'English', 'Deutsch', 'Français', 'Español', 'Italiano', 'Português', 'Polski', 'Čeština', 'Nederlands', 'Svenska', 'Suomi', 'Dansk', 'Norsk', 'Magyar', 'Română'];

// The three panels: where the panel is, what scrolls its rows, its rows and
// the first thing in a row, how to fill and open it.
const KINDS = {
  dropdown: {
    body: (size) => `<div style="width:280px"><sf-dropdown id="x" label="Язык" size="${size}"></sf-dropdown></div>`,
    ready: () => customElements.get('sf-dropdown') && document.querySelector('#x .sf-dropdown-field'),
    fill: ([count, icons, search, list]) => {
      const x = document.getElementById('x');
      x.setAttribute('search', search ? 'true' : 'false');
      x.setAttribute('options', JSON.stringify(list.slice(0, count).map((text, index) => (icons ? {value: `l${index}`, text, type: 'icon', icon: 'language'} : {value: `l${index}`, text}))));
    },
    open: () => document.getElementById('x').openDropdown(),
    close: () => document.getElementById('x').closeDropdown(),
    panel: '#x .sf-list',
    area: '#x .sf-list-container-wrap',
    mark: 'sf-list-container-wrap--scrollbar',
    rows: '#x .sf-list-item[role="option"]',
    // An icon row's picture is the glyph of an sf-icon (display: contents, sf-list-item 1.2.7).
    first: (row) => { const first = row.querySelector('.sf-list-item-wrap')?.firstElementChild; return first?.localName === 'sf-icon' ? first.firstElementChild : first; },
    icon: (row) => row.querySelector('.sf-list-item-wrap > .sf-icon, .sf-list-item-wrap > sf-icon > .sf-icon'),
    text: (row) => row.querySelector('.sf-list-item-container'),
    search: '#x .sf-list-search',
    searchIcon: '#x .sf-list-search-icon',
    searchInput: '#x .sf-list-search-input',
  },
  lookup: {
    body: (size) => `<div style="width:280px"><sf-input-lookup id="x" label="Язык" size="${size}"></sf-input-lookup></div>`,
    ready: () => customElements.get('sf-input-lookup') && document.querySelector('#x .sf-lookup-input'),
    fill: ([count, icons, , list]) => {
      const x = document.getElementById('x');
      x.close?.();
      x.options = list.slice(0, count).map((label, index) => (icons ? {value: `l${index}`, label, avatar: {initials: label.slice(0, 2)}} : {value: `l${index}`, label}));
    },
    open: () => document.getElementById('x').search(''),
    close: () => document.getElementById('x').close(),
    panel: '#x .sf-lookup-panel',
    area: '#x .sf-lookup-panel',
    mark: 'sf-lookup-panel--scrollbar',
    rows: '#x .sf-lookup-option',
    first: (row) => row.firstElementChild,
    icon: (row) => row.querySelector('.sf-lookup-option-avatar'),
    text: (row) => row.querySelector('.sf-lookup-option-text'),
  },
  picker: {
    body: (size) => `<div style="width:280px"><sf-profile-picker id="x" label="Профиль" size="${size}"></sf-profile-picker></div>`,
    ready: () => customElements.get('sf-profile-picker') && document.querySelector('#x .sf-profile-picker-trigger'),
    fill: ([count, , , list]) => {
      const x = document.getElementById('x');
      x.profiles = list.slice(0, count).map((label, index) => ({id: `p${index}`, label, shared: index % 2 === 0}));
      x.rights = {create: {personal: false, shared: false}};
      x.setAttribute('current', 'p1');
    },
    open: () => document.getElementById('x').open(),
    close: () => document.getElementById('x').close({restoreFocus: false}),
    panel: '#x .sf-profile-picker-panel',
    area: '#x .sf-profile-picker-panel',
    mark: 'sf-profile-picker-panel--scrollbar',
    rows: '#x .sf-profile-picker-row[data-id]',
    first: (row) => row.firstElementChild,
    icon: (row) => row.querySelector('.sf-profile-picker-kind'),
    text: (row) => row.querySelector('.sf-profile-picker-text'),
  },
};

// Everything measured, in the page: the panel's inner edges, the rows, the
// header, the scroll area, and the tokens they are made of (the ladder is
// adaptive, so they are read, not assumed).
async function measure(p, kind, size) {
  const k = KINDS[kind];
  return p.evaluate(([spec, step]) => {
    const fn = (source) => (source ? (0, eval)(`(${source})`) : () => null);
    const panel = document.querySelector(spec.panel);
    const area = document.querySelector(spec.area);
    const ps = getComputedStyle(panel);
    const pr = panel.getBoundingClientRect();
    const inner = {left: pr.left + parseFloat(ps.borderLeftWidth), right: pr.right - parseFloat(ps.borderRightWidth), top: pr.top + parseFloat(ps.borderTopWidth)};
    const read = (value) => { const n = document.createElement('span'); n.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`; panel.append(n); const w = n.getBoundingClientRect().width; n.remove(); return w; };
    const tokens = {
      inset: read('var(--sf-space-1\\/4)'), pad: read('var(--sf-space-1\\/2)'), radius: read('var(--sf-radius--ui)'),
      rowHeight: read(step === '1' ? 'var(--sf-ui-1--control-height)' : 'var(--sf-ui-1\\/2--control-height)'),
    };
    const first = fn(spec.first), icon = fn(spec.icon), text = fn(spec.text);
    const rows = [...document.querySelectorAll(spec.rows)].filter((row) => row.getClientRects().length).map((row) => {
      const box = row.getBoundingClientRect();
      const rs = getComputedStyle(row);
      const lead = first(row)?.getBoundingClientRect() ?? box;
      const i = icon(row)?.getBoundingClientRect() ?? null;
      const t = text(row)?.getBoundingClientRect() ?? null;
      return {text: row.textContent.trim().split('\n')[0].trim(), start: box.left - inner.left, end: inner.right - box.right, height: box.height,
        contentStart: lead.left - box.left, iconText: i && t && i.width ? t.left - i.right : null, iconLeft: i && i.width ? i.left : null, textLeft: t?.left ?? null,
        radius: parseFloat(rs.borderTopLeftRadius)};
    });
    const search = spec.search && document.querySelector(spec.search);
    let header = null;
    if (search) {
      const s = search.getBoundingClientRect();
      const ss = getComputedStyle(search);
      const input = document.querySelector(spec.searchInput);
      header = {start: s.left - inner.left, end: inner.right - s.right, top: s.top - inner.top, height: s.height, line: parseFloat(ss.borderBottomWidth),
        frame: parseFloat(ss.borderTopWidth) + parseFloat(ss.borderLeftWidth), fill: ss.backgroundColor,
        iconLeft: document.querySelector(spec.searchIcon)?.getBoundingClientRect().left ?? null, textLeft: input?.getBoundingClientRect().left ?? null,
        fieldBorder: input ? parseFloat(getComputedStyle(input).borderTopWidth) : null, fieldFill: input ? getComputedStyle(input).backgroundColor : null};
    }
    const as = getComputedStyle(area);
    const ar = area.getBoundingClientRect();
    const borders = parseFloat(as.borderLeftWidth) + parseFloat(as.borderRightWidth);
    const firstRow = document.querySelector(spec.rows)?.getBoundingClientRect() ?? null;
    return {tokens, rows, header,
      scroll: {
        marked: area.classList.contains(spec.mark),
        bar: area.offsetWidth - area.clientWidth - borders,
        overflows: area.scrollHeight - area.clientHeight > 1,
        paddingEnd: parseFloat(as.paddingRight),
        rowEnd: firstRow ? Math.round(firstRow.right * 100) / 100 : null,
        rowToBar: firstRow ? Math.round((ar.left + parseFloat(as.borderLeftWidth) + area.clientWidth - firstRow.right) * 100) / 100 : null,
        innerRight: inner.right,
        sampleY: Math.round(ar.top + parseFloat(as.borderTopWidth) + 12),
        areaTop: ar.top,
      },
      box: {x: pr.left, y: pr.top, width: pr.width, height: pr.height}};
  }, [{...k, first: String(k.first), icon: String(k.icon), text: String(k.text), body: undefined, ready: undefined, fill: undefined, open: undefined, close: undefined}, size]);
}

function checkRows(where, got) {
  const {inset, pad, rowHeight, radius} = got.tokens;
  if (!got.rows.length) note({case: `${where}: rows drawn`, got});
  for (const row of got.rows) {
    if (!near(row.start, inset)) note({case: `${where}: «${row.text}» stands the inset from the panel's start`, got: {row, inset}});
    if (!got.scroll.marked && !near(row.end, inset)) note({case: `${where}: «${row.text}» stands the inset from the panel's end`, got: {row, inset}});
    if (row.height < rowHeight - 0.5) note({case: `${where}: «${row.text}» is a control's height`, got: {row, rowHeight}});
    if (!near(row.contentStart, pad)) note({case: `${where}: «${row.text}»'s picture or text starts --sf-space-1/2 inside its highlight`, got: {row, pad}});
    if (row.iconText !== null && !near(row.iconText, pad)) note({case: `${where}: «${row.text}»'s picture stands --sf-space-1/2 before its text`, got: {row, pad}});
    if (!near(row.radius, radius)) note({case: `${where}: «${row.text}»'s highlight is rounded --sf-radius--ui`, got: {row, radius}});
  }
  const h = got.header;
  if (h) {
    if (!near(h.start, 0) || !near(h.end, 0) || !near(h.top, 0)) note({case: `${where}: the search header spans the panel at its top`, got: h});
    if (!near(h.height, rowHeight + 2 * inset) || !near(h.line, 1) || h.frame !== 0 || h.fieldBorder !== 0) note({case: `${where}: the search header is a row and the inset above and below, a hairline under it, no frame`, got: {h, rowHeight, inset}});
    // Text over text, always; the icon over the rows' icons, or at the
    // header's end when the rows have no picture (C06, DEV measurement
    // 2026-11-08: the text stood 24-32px right of the rows').
    const row = got.rows[0];
    if (!near(h.textLeft, row.textLeft)) note({case: `${where}: the search text stands over the rows' text`, got: {text: h.textLeft, row: row.textLeft}});
    if (row.iconLeft !== null && !near(h.iconLeft, row.iconLeft)) note({case: `${where}: the search icon stands over the rows' icon`, got: {icon: h.iconLeft, row: row.iconLeft}});
    if (row.iconLeft === null && !(h.iconLeft > h.textLeft)) note({case: `${where}: rows without pictures: the search icon stands at the header's end`, got: {icon: h.iconLeft, text: h.textLeft}});
  }
}

async function thumbColumns(p, got) {
  const s = got.scroll;
  const startX = Math.floor(s.rowEnd) - 2;
  const shot = await p.screenshot({clip: {x: startX, y: s.sampleY, width: Math.ceil(s.innerRight - s.rowEnd) + 6, height: 1}});
  const columns = await p.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = 1;
    const g = canvas.getContext('2d');
    g.drawImage(image, 0, 0);
    const px = g.getImageData(0, 0, image.width, 1).data;
    const columns = [];
    for (let x = 0; x < image.width; x += 1) columns.push([px[x * 4], px[x * 4 + 1], px[x * 4 + 2]]);
    return columns;
  }, shot.toString('base64'));
  const baseColour = columns[2];
  const differs = columns.map((rgb) => rgb.some((v, i) => Math.abs(v - baseColour[i]) > 24));
  const runs = [];
  for (let x = 3; x < differs.length; x += 1) {
    if (differs[x] && !differs[x - 1]) runs.push([x, x]);
    if (differs[x] && runs.length) runs.at(-1)[1] = x;
  }
  const thumb = runs[0] ?? null;
  return {
    measured: thumb && {gapBefore: startX + thumb[0] - s.rowEnd, thumb: thumb[1] - thumb[0] + 1, gapAfter: s.innerRight - (startX + thumb[1] + 1)},
    runs: runs.map(([a, b]) => [startX + a, startX + b]),
  };
}

const evidence = {rows: {}, scrollbar: []};
try {
  for (const theme of ['light', 'dark']) {
    for (const [kind, k] of Object.entries(KINDS)) {
      for (const size of ['1/2', '1']) {
        for (const height of [800, 300]) {
          // Core writes the theme class from the page's colour scheme, so the scheme
          // is emulated as well as the class written.
          const context = await browser.newContext({viewport: {width: 700, height}, deviceScaleFactor: 1, colorScheme: theme});
          const p = await context.newPage();
          const errors = [];
          p.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
          current = shell(theme, k.body(size));
          await p.goto(`${base}/probe`, {waitUntil: 'load'});
          await p.waitForFunction(k.ready, null, {timeout: 20000});
          await p.waitForTimeout(200);
          if (!(await p.evaluate((t) => document.documentElement.classList.contains(`theme-${t}`), theme))) note({case: `${kind} (${theme}, ${size}): the page is in the ${theme} theme`});
          const cases = height === 800
            ? [['few', FEW.length, false, false], ['few with pictures', FEW.length, true, false], ...(kind === 'dropdown' ? [['search', FEW.length, false, true], ['search with icons', FEW.length, true, true]] : [])]
            : [['fits', FEW.length, true, kind === 'dropdown'], ['scrolls', MANY.length, true, kind === 'dropdown'], ['scrolls without search', MANY.length, true, false]].filter(([name]) => kind === 'dropdown' || name !== 'scrolls without search');
          for (const [name, count, icons, search] of cases) {
            const where = `${kind} ${name} (${theme}, size ${size}${height === 300 ? ', 300px window' : ''})`;
            await p.evaluate(k.close).catch(() => {});
            await p.waitForTimeout(80);
            await p.evaluate(k.fill, [count, icons, search, MANY]);
            await p.waitForTimeout(150);
            await p.evaluate(k.open);
            await p.waitForTimeout(350);
            const got = await measure(p, kind, size);
            checkRows(where, got);
            const s = got.scroll;
            if (!s.overflows && (s.marked || s.bar > 0)) note({case: `${where}: rows that fit show no scrollbar and keep the inset on both sides`, got: s});
            if (s.bar > 0) {
              if (!s.marked || !near(s.paddingEnd, 0)) note({case: `${where}: a scrollbar that takes room marks its area, which gives up its end padding`, got: s});
              if (!near(s.bar, 3 * got.tokens.inset)) note({case: `${where}: the track is the inset, the thumb and the inset`, got: s});
              if (!near(s.rowToBar, 0)) note({case: `${where}: the track starts where the rows' highlight ends`, got: s});
              const columns = await thumbColumns(p, got);
              const m = columns.measured;
              if (!m || !near(m.gapBefore, got.tokens.inset) || Math.abs(m.thumb - got.tokens.inset) > 1 || !near(m.gapAfter, got.tokens.inset)) note({case: `${where}: highlight-to-thumb, thumb and thumb-to-edge are each the inset`, got: {columns, s}});
              evidence.scrollbar.push({where, inset: got.tokens.inset, bar: s.bar, marked: s.marked, paddingEnd: s.paddingEnd, ...columns});
            } else if (height === 300) {
              if (headed && s.overflows) note({case: `${where}: headed with classic scrollbars, rows that do not fit draw a scrollbar`, got: s});
              evidence.scrollbar.push({where, inset: got.tokens.inset, bar: s.bar, marked: s.marked, overflows: s.overflows});
            }
            evidence.rows[where] = {tokens: got.tokens, rows: got.rows.slice(0, 2), header: got.header};
            if (process.env.SF_PROBE_SHOTS) {
              const b = got.box;
              await p.screenshot({path: `${process.env.SF_PROBE_SHOTS}/${kind}-${theme}-${size.replace('/', '-')}-${name.replace(/ /gu, '-')}${height === 300 ? '-300' : ''}.png`, clip: {x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.width + 16, height: Math.min(b.height + 16, height - Math.max(0, b.y - 8))}});
            }
          }
          if (errors.length) note({case: `console clean (${kind}, ${theme}, ${size})`, got: errors});
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (process.env.SF_PROBE_EVIDENCE) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) {
  const kinds = {};
  for (const failure of failures) {
    const kind = failure.case.replace(/«[^»]*»/u, 'a row');
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  console.error(JSON.stringify({kinds, first: failures.slice(0, 12)}, null, 2));
  throw new Error(`${failures.length} dropping panel inset check(s) failed`);
}
process.stdout.write(`Dropping panels (sf-dropdown, sf-input-lookup, sf-profile-picker) on R029: PASS — rows --sf-space-1/4 inside the panel, a control's height, picture and text --sf-space-1/2 inside the highlight; the dropdown's search header across the panel, its icon and text over the rows'; at 1/2 and 1, light and dark; no scrollbar beside rows that fit${headed ? ', and a scrollbar in the inset (gap, thumb, gap each --sf-space-1/4), headed Chrome with classic scrollbars' : ''}\n`);

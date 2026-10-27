#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build-output [--json report.json]
//
// simai/ui-source#49 and #50: the Native checkbox and radio constructors built
// their parts but never applied the layout utilities the stylesheets moved into
// utility hints, so the root drew inline: a 26×21 checkbox mark with no gap on a
// 21px row, radio rings 2px wide and selected marks 0px. And the Smart checkbox
// drew its size-2 mixed and help marks 16×16 where the line is 28.
//
// Measured on the built bytes, through the Loader as a page gets them (it
// fetches every utility sheet a class on the page names): for each size 1/2, 1
// and 2 at a desktop (1000) and a phone (390) width, a Native control made by
// its constructor and the Smart element with the same label, description and
// help stand side by side. Zero tolerance:
//   - Native and Smart draw the same box, mark, gap and row height;
//   - the box is as tall as the label's line (VISUAL-DECISIONS 2026-10-05: one
//     ladder, the mark is the line height);
//   - checkbox: the help mark is the line; the checked and mixed marks fill
//     the box inside its border (the line less the two border widths), the
//     same in Native and Smart -- the size-2 Smart marks were 16px;
//   - radio: the ring is the box (wider than its border), the selected mark is
//     wider than 0.
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonAt = process.argv.indexOf('--json');
const reportPath = jsonAt > 0 ? process.argv[jsonAt + 1] : null;

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const needed = [
  join(out, 'core', 'core', 'js', 'core.js'),
  join(out, 'component', 'component', 'checkbox', 'js', 'checkbox.js'),
  join(out, 'component', 'component', 'radio', 'js', 'radio.js'),
].filter((path) => !existsSync(path));
if (needed.length) throw new Error(`missing assets: ${needed.join(', ')}`);

const page = `<!doctype html><html lang="en" class="theme-light"><head>
<meta charset="utf-8"><title>choice geometry</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'choice-geometry-probe', pluginListVersion: 'choice-geometry-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false,
  };
</script>
<style>body{margin:16px} .row{display:block;margin-block:8px}</style>
</head><body><main id="stand"></main>
<script src="/distr/core/js/core.js"></script>
</body></html>`;

const types = new Map([
  ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'],
]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (url.pathname === '/stand.html') {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(page);
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    response.writeHead(200, {'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream'});
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const SIZES = ['1/2', '1', '2'];
const WIDTHS = [1000, 390];
const failures = [];
const rows = [];
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({viewport: {width, height: 900}});
    const tab = await context.newPage();
    tab.on('pageerror', (error) => failures.push({width, said: error.message}));
    await tab.goto(`${origin}/stand.html`);
    await tab.waitForFunction(() => window.SF?.Loader?.registerComponent, null, {timeout: 15000});
    await tab.evaluate(async () => {
      const load = (src) => new Promise((done, fail) => {
        const script = document.createElement('script');
        script.src = src; script.onload = done; script.onerror = fail;
        document.body.append(script);
      });
      for (const name of ['checkbox', 'radio']) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = `/distr/component/${name}/css/${name}.css`;
        document.head.append(link);
        await load(`/distr/component/${name}/js/${name}.js`);
      }
    });
    await tab.waitForFunction(() => window.SF.Loader.ComponentRegistry.Checkbox && window.SF.Loader.ComponentRegistry.Radio, null, {timeout: 15000});
    await tab.evaluate((sizes) => {
      const stand = document.querySelector('#stand');
      const registry = window.SF.Loader.ComponentRegistry;
      const native = (Class, param) => new Class({param, attrs: {}}).render();
      const row = (key) => Object.assign(document.createElement('div'), {className: 'row', id: key});
      for (const size of sizes) {
        const id = size.replace('/', '-');
        for (const [state, extra] of [['checked', {checked: true}], ['mixed', {indeterminate: true}]]) {
          const a = row(`checkbox-native-${state}-${id}`);
          a.append(native(registry.Checkbox, {size, title: 'Receive updates', description: 'Only important news', help: 'help', ...extra}));
          const b = row(`checkbox-smart-${state}-${id}`);
          b.innerHTML = `<sf-checkbox size="${size}" label="Receive updates" description="Only important news" help="help" ${state === 'checked' ? 'checked' : 'indeterminate'}></sf-checkbox>`;
          stand.append(a, b);
        }
        const c = row(`radio-native-checked-${id}`);
        c.append(native(registry.Radio, {size, title: 'Monthly plan', description: 'Billed every month', name: `n${id}`, checked: true}));
        const d = row(`radio-smart-checked-${id}`);
        d.innerHTML = `<sf-radio size="${size}" label="Monthly plan" description="Billed every month" name="s${id}" checked></sf-radio>`;
        stand.append(c, d);
      }
    }, SIZES);
    await tab.waitForFunction((n) => document.querySelectorAll('sf-checkbox .sf-checkbox-box, sf-radio .sf-radio-button-box').length === n,
      SIZES.length * 3, {timeout: 15000});
    // Utility sheets arrive after the classes do: wait until every Native root
    // is laid out as its hint says (or give up and measure what is drawn).
    await tab.waitForFunction(() => [...document.querySelectorAll('.row')].every((row) => {
      const root = row.querySelector('.sf-checkbox, .sf-radio-button');
      return root && getComputedStyle(root).display === 'flex';
    }), null, {timeout: 8000}).catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(400);
    const measured = await tab.evaluate(() => {
      const r = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100, left: b.left, right: b.right, top: b.top};
      };
      return [...document.querySelectorAll('.row')].map((row) => {
        const [kind, impl, state, ...rest] = row.id.split('-');
        const size = rest.join('/');
        const root = row.querySelector('.sf-checkbox, .sf-radio-button');
        const box = row.querySelector('.sf-checkbox-box, .sf-radio-button-box');
        const label = row.querySelector('.sf-checkbox-label, .sf-radio-button-text');
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = [...range.getClientRects()][0];
        const mark = kind === 'checkbox'
          ? row.querySelector('.sf-checkbox-box .sf-icon')
          : row.querySelector('.sf-radio-button-mark');
        const help = kind === 'checkbox' ? row.querySelector('.sf-checkbox-top .sf-icon') : null;
        const boxStyle = getComputedStyle(box);
        const markStyle = mark ? getComputedStyle(mark) : null;
        return {
          kind, impl, state, size,
          display: getComputedStyle(root).display,
          row: r(root).h,
          line: parseFloat(getComputedStyle(label).lineHeight),
          box: [r(box).w, r(box).h],
          border: parseFloat(boxStyle.borderLeftWidth),
          mark: mark ? [r(mark).w, r(mark).h] : null,
          // A glyph clipped by its box: the declared size is larger than drawn.
          markDeclared: markStyle ? [parseFloat(markStyle.width), parseFloat(markStyle.height)] : null,
          help: help ? [r(help).w, r(help).h] : null,
          gap: Math.round((text.left - r(box).right) * 100) / 100,
        };
      });
    });
    for (const m of measured) rows.push({width, ...m});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const width of WIDTHS) {
  for (const size of SIZES) {
    for (const [kind, state] of [['checkbox', 'checked'], ['checkbox', 'mixed'], ['radio', 'checked']]) {
      const pick = (impl) => rows.find((m) => m.width === width && m.size === size && m.kind === kind && m.state === state && m.impl === impl);
      const n = pick('native');
      const s = pick('smart');
      const where = `${width}px ${kind} ${state} size ${size}`;
      if (!n || !s) { failures.push(`${where}: not drawn`); continue; }
      for (const key of ['display', 'row', 'box', 'gap', 'mark', 'help']) {
        if (!same(n[key], s[key])) failures.push(`${where}: ${key} Native ${JSON.stringify(n[key])} vs Smart ${JSON.stringify(s[key])}`);
      }
      for (const m of [n, s]) {
        if (m.box[1] !== m.line) failures.push(`${where} ${m.impl}: box ${m.box[1]} vs label line ${m.line}`);
        if (m.box[0] !== m.box[1]) failures.push(`${where} ${m.impl}: box not square ${m.box}`);
        if (!(m.gap > 0)) failures.push(`${where} ${m.impl}: no gap after the mark (${m.gap})`);
        if (!(m.mark?.[0] > 0 && m.mark?.[1] > 0)) failures.push(`${where} ${m.impl}: mark ${JSON.stringify(m.mark)}`);
        if (kind === 'radio' && !(m.box[0] > 2 * m.border)) failures.push(`${where} ${m.impl}: ring ${m.box[0]}px wide, border ${m.border}`);
        if (kind === 'checkbox') {
          // The help mark is the line; the box mark fills the box inside its border.
          if (m.help?.[1] !== m.line) failures.push(`${where} ${m.impl}: help ${JSON.stringify(m.help)} vs line ${m.line}`);
          const inner = m.box[1] - 2 * m.border;
          if (m.mark[1] !== inner) failures.push(`${where} ${m.impl}: mark ${JSON.stringify(m.mark)} vs box inside ${inner}`);
        }
      }
    }
  }
}

const table = rows.map((m) => `${m.width} ${m.kind.padEnd(8)} ${m.impl.padEnd(6)} ${m.state.padEnd(7)} ${m.size.padEnd(3)} display=${m.display} row=${m.row} line=${m.line} box=${m.box.join('x')} mark=${m.mark?.join('x')} declared=${m.markDeclared?.join('x')} help=${m.help?.join('x') ?? '-'} gap=${m.gap}`);
process.stdout.write(`${table.join('\n')}\n`);
if (reportPath) await writeFile(reportPath, JSON.stringify({rows, failures}, null, 2));
if (failures.length) {
  process.stdout.write(`${failures.length} failure(s):\n${failures.map((f) => `  ${typeof f === 'string' ? f : JSON.stringify(f)}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Choice geometry: PASS — ${rows.length} controls, Native and Smart equal at sizes ${SIZES.join(', ')} on ${WIDTHS.join(' and ')}px\n`);

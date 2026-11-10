#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The card title (R082, C19): a heading inside .sf-card is the title step of
// the text ladder -- --sf-text-size-1 on --sf-text-height-1, semibold --
// whatever its level: 16/24 on a desktop, 14/20 on a phone and in a compact
// region. It is read on the built sheets with the bare heading sizes of the
// headers utility loaded too, at 1440 and 390, light and dark, three loads
// each, for every way the Framework draws a card title:
//   - the .sf-card class with h2..h6 written by hand;
//   - content.card of Composition (its render), a heading block inside;
//   - both inside a data-sf-density="compact" region.
// Each value must equal the system variable resolved in the title's own
// place, and the absolute numbers above, so a raw size cannot pass.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const sheets = ['core/core/css/core.css', 'utility/utility/headers/default/css/default.css', 'component/component/card/css/card.css'];
for (const sheet of sheets) if (!existsSync(join(out, sheet))) throw new Error(`Missing sheet ${sheet}`);
const {render} = await import(pathToFileURL(resolve(import.meta.dirname, '../../src/core/js/composition/index.mjs')).href);

const text = (value) => [{type: 'text', value}];
const levels = [2, 3, 4, 5, 6];
const composed = (prefix) => ({
  schema: 'simai.composition.document', schema_version: 1, id: `${prefix}-doc`, profile: 'ui-layout', locale: 'ru',
  root: {id: `${prefix}-root`, type: 'layout.page', slots: {default: [
    {id: `${prefix}-section`, type: 'layout.section', slots: {default: levels.map((level) => ({
      id: `${prefix}-card-${level}`, type: 'content.card', slots: {default: [
        {id: `${prefix}-h${level}`, type: 'content.heading', data: {level, content: text('Импорт прайса из файла Прайс_ноябрь.xlsx')}},
        {id: `${prefix}-p${level}`, type: 'content.paragraph', data: {content: text('Строки добавляются в каталог.')}},
      ]},
    }))}},
  ]}},
});
const handMade = levels.map((level) => `<div class="sf-card"><h${level}>Импорт прайса</h${level}><p>Строки добавляются в каталог.</p></div>`).join('');
const drawn = async (prefix) => {
  const result = await render(composed(prefix));
  if (!result.html || result.diagnostics?.some((entry) => entry.severity === 'error')) throw new Error(`content.card did not render: ${JSON.stringify(result.diagnostics)}`);
  return result.html;
};
const normalHtml = await drawn('normal');
const compactHtml = await drawn('compact');
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
${sheets.map((sheet) => `<link rel="stylesheet" href="/distr/${sheet}">`).join('\n')}
</head><body style="margin:16px">
<div id="normal">${handMade}${normalHtml}</div>
<div id="compact" data-sf-density="compact">${handMade}${compactHtml}</div>
</body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme')));
  }
  const file = path.startsWith('/distr/') ? join(out, path.slice('/distr/'.length)) : '';
  if (!file || !file.startsWith(out) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': extname(file) === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

// Desktop 16/24 and phone 14/20 (C21 rung 1, R082); a compact region on a
// desktop takes the phone's step (C22), on a phone it already is it.
const expected = (width, region) => (width >= 960 && region === 'normal' ? {size: 16, line: 24} : {size: 14, line: 20});
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      for (let load = 1; load <= 3; load += 1) {
        const where = `${theme} ${width} load ${load}`;
        const tab = await browser.newPage({viewport: {width, height: 900}});
        const errors = [];
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        tab.on('pageerror', (error) => errors.push(String(error)));
        await tab.goto(`http://127.0.0.1:${server.address().port}/page?theme=${theme}`, {waitUntil: 'load'});
        const titles = await tab.evaluate(() => [...document.querySelectorAll('.sf-card > :is(h1, h2, h3, h4, h5, h6)')].map((title) => {
          const probe = document.createElement('span');
          title.parentElement.append(probe);
          probe.style.cssText = 'font-size:var(--sf-text-size-1);line-height:var(--sf-text-height-1)';
          const system = {size: parseFloat(getComputedStyle(probe).fontSize), line: parseFloat(getComputedStyle(probe).lineHeight)};
          probe.style.cssText = 'font-weight:var(--sf-text--font-weight-6)';
          system.weight = Number(getComputedStyle(probe).fontWeight);
          probe.remove();
          const style = getComputedStyle(title);
          const region = title.closest('#compact') ? 'compact' : 'normal';
          const id = `${title.hasAttribute('data-sf-composition-id') ? 'content.card' : '.sf-card'} ${title.tagName.toLowerCase()} (${region})`;
          return {id, region,
            size: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), weight: Number(style.fontWeight), system};
        }));
        seen[where] = titles;
        const check = (ok, said, detail) => { if (!ok) failures.push({where, said, ...detail}); };
        check(titles.length === levels.length * 4, 'every title is on the page', {count: titles.length});
        for (const title of titles) {
          const want = expected(width, title.region);
          check(title.size === want.size && title.line === want.line, `${title.id}: ${want.size}/${want.line}`, {title});
          check(title.weight === 600, `${title.id}: semibold`, {title});
          check(title.size === title.system.size && title.line === title.system.line && title.weight === title.system.weight, `${title.id}: the system's step (--sf-text-size-1 / --sf-text-height-1 / weight 6)`, {title});
        }
        check(errors.length === 0, 'the console stays clean', {errors});
        await tab.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
const summary = Object.fromEntries(Object.entries(seen).filter(([where]) => where.endsWith('load 1')).map(([where, titles]) => [where, Object.fromEntries(['normal', 'compact'].map((region) => [region, [...new Set(titles.filter((title) => title.region === region).map((title) => `${title.size}/${title.line} w${title.weight}`))].join(', ')]))]));
console.log(JSON.stringify(summary, null, 1));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 20), total: failures.length}, null, 1)); process.exit(1); }
console.log('CARD_TITLE_OK');

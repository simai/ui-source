#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Name and value in one badge on the built bytes (owner decisions C317-C319,
// component.badges 1.13.0, sf-badge 1.7.0; study ui-control
// prototypes/composite-badge-study.html, variant A). At 1440 and 390, light and
// dark, three loads each:
//   - every size (1/3, 1/2, 1) and look (tonal, outline, the filled error count)
//     keeps the height of the same badge without a value (C01, C140 (5)), in
//     sf-badge and in class markup;
//   - the divider is one pixel wide and as high as the text line, with
//     --sf-space-1/3 on each side of it (text to text: two steps and the pixel);
//   - the divider is the border colour on outline, --sf-outline on a fill and
//     the text colour on the filled count; the value is the text colour;
//   - a long name truncates with an ellipsis, the value never; a row of pairs
//     swept from 120 to 400 px wide never breaks a pair;
//   - a screen reader reads «sf-wizard, версия 1.5.3»; the divider is hidden
//     (the accessibility tree joins the name's box and the hidden word with a
//     space, «sf-wizard , версия»: said the same, so the space is not counted);
//   - no page errors, no console errors.
// With BADGE_COMPOSITE_SHOTS=<folder> each first load is written as a screenshot.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const shots = process.env.BADGE_COMPOSITE_SHOTS ? resolve(process.env.BADGE_COMPOSITE_SHOTS) : '';
if (shots) mkdirSync(shots, {recursive: true});

const SIZES = ['1/3', '1/2', '1'];
const LOOKS = [
  {look: 'tonal', colour: 'scheme="neutral"', cls: 'sf-badge--tonal sf-badge--neutral', divider: 'outline'},
  {look: 'outline', colour: 'scheme="on-surface"', cls: 'sf-badge--outline sf-badge--on-surface', divider: 'border'},
  {look: 'outline-primary', appearance: 'outline', colour: 'scheme="primary"', cls: 'sf-badge--outline sf-badge--primary', divider: 'border'},
  {look: 'main', colour: 'status="error"', cls: 'sf-badge--main sf-badge--error', divider: 'text'},
];
const key = (value) => value.replace('/', '-');
const LAYOUT = 'inline-flex flex-row flex-nowrap justify-center items-center';
const rows = [];
const cases = [];
for (const size of SIZES) {
  for (const {look, appearance, colour, cls, divider} of LOOKS) {
    const id = `${key(size)}-${look}`;
    const app = appearance ?? look;
    rows.push(`<p class="row"><sf-badge id="v-${id}" size="${size}" appearance="${app}" ${colour} text="sf-wizard" value="1.5.3" value-label="версия"></sf-badge>`
      + `<sf-badge id="p-${id}" size="${size}" appearance="${app}" ${colour} text="sf-wizard"></sf-badge>`
      + `<span id="c-${id}" class="sf-badge ${cls} sf-badge--size-${size} ${LAYOUT}"><span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">sf-wizard</span></span><span class="sf-badge-divider" aria-hidden="true"></span><span class="sf-badge-value"><span class="sr-only">, версия </span>1.5.3</span></span></p>`);
    cases.push({id, size, look, divider});
  }
}
const page = (theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{background:var(--sf-surface-page);margin:0}main{display:flex;flex-direction:column;gap:8px;padding:16px}.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0}
#narrow{inline-size:160px}#sweep{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;inline-size:400px}</style></head><body><main>
${rows.join('\n')}
<div id="narrow"><sf-badge id="long" appearance="outline" scheme="on-surface" size="1/2" text="sf-view-table-column-settings" value="1.20.4" value-label="версия"></sf-badge></div>
<div id="sweep"><sf-badge appearance="outline" scheme="on-surface" size="1/2" text="sf-tree" value="2.4.1" value-label="версия"></sf-badge><sf-badge appearance="outline" scheme="on-surface" size="1/2" text="sf-tree-item" value="1.3.4" value-label="версия"></sf-badge><sf-badge appearance="outline" scheme="on-surface" size="1/2" text="sf-tree-editor" value="1.0.0" value-label="версия"></sf-badge></div>
<sf-badge id="word" text="Ключ" value="Значение"></sf-badge>
<sf-badge id="labelled" text="sf-tabs" value="1.5.2" aria-label="Компонент sf-tabs, версия 1.5.2"></sf-badge>
<sf-badge id="slot" text="PHP" appearance="outline"><span slot="value"><b>8.2</b></span></sf-badge>
<span id="disabled" class="sf-badge sf-badge--outline sf-badge--on-surface sf-badge--size-1/2 sf-badge--disabled ${LAYOUT}"><span class="sf-badge-text-container flex items-center"><span class="sf-badge-text">sf-wizard</span></span><span class="sf-badge-divider" aria-hidden="true"></span><span class="sf-badge-value">1.5.3</span></span>
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${/\.(js|css|json)$/u.test(file) ? '; charset=utf-8' : ''}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const url = (theme) => `http://127.0.0.1:${server.address().port}/page?theme=${theme}`;

const measure = (cases) => {
  const length = (name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${name})`;
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  const colour = (name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const round = (value) => Math.round(value * 100) / 100;
  const box = (root) => {
    const badge = root.matches('.sf-badge') ? root : root.querySelector('.sf-badge');
    if (!badge) return null;
    const rect = badge.getBoundingClientRect();
    const text = badge.querySelector(':scope > .sf-badge-text-container');
    const divider = badge.querySelector(':scope > .sf-badge-divider');
    const value = badge.querySelector(':scope > .sf-badge-value');
    const t = text?.getBoundingClientRect();
    const d = divider?.getBoundingClientRect();
    const v = value?.getBoundingClientRect();
    const style = getComputedStyle(badge);
    return {
      height: round(rect.height), width: round(rect.width), top: round(rect.top),
      textTop: t && round(t.top), textHeight: t && round(t.height), textRight: t && round(t.right),
      dividerLeft: d && round(d.left), dividerRight: d && round(d.right), dividerWidth: d && round(d.width), dividerHeight: d && round(d.height),
      dividerColour: divider && getComputedStyle(divider).backgroundColor, dividerHidden: divider?.getAttribute('aria-hidden'),
      valueLeft: v && round(v.left), valueTop: v && round(v.top), valueColour: value && getComputedStyle(value).color,
      textColour: badge.querySelector('.sf-badge-text') && getComputedStyle(badge.querySelector('.sf-badge-text')).color,
      borderColour: style.borderTopColor, colour: style.color, gap: parseFloat(style.columnGap),
      lineHeight: parseFloat(getComputedStyle(badge.querySelector('.sf-badge-text') ?? badge).lineHeight),
      rects: badge.getClientRects().length,
    };
  };
  const byId = (id) => box(document.getElementById(id));
  const result = {px: length('--sf-px'), step: length('--sf-space-1\\/3'), outline: colour('--sf-outline'), cases: {}};
  for (const {id} of cases) result.cases[id] = {v: byId(`v-${id}`), p: byId(`p-${id}`), c: byId(`c-${id}`)};
  const long = document.querySelector('#long .sf-badge');
  const name = long.querySelector('.sf-badge-text');
  const value = long.querySelector('.sf-badge-value');
  result.long = {
    width: round(long.getBoundingClientRect().width), room: 160,
    nameCut: name.scrollWidth > name.clientWidth, ellipsis: getComputedStyle(name).textOverflow,
    valueWhole: value.scrollWidth <= Math.ceil(value.getBoundingClientRect().width) && value.textContent.endsWith('1.20.4'),
    valueRight: round(value.getBoundingClientRect().right), badgeRight: round(long.getBoundingClientRect().right),
  };
  result.disabled = byId('disabled');
  result.disabledRoles = {outline: colour('--sf-outline-disabled'), text: colour('--sf-on-surface-disabled')};
  result.word = document.querySelector('#word .sf-badge-value .sr-only')?.textContent;
  result.labelledHidden = document.querySelector('#labelled .sf-badge-value')?.getAttribute('aria-hidden');
  result.slot = document.querySelector('#slot .sf-badge-value b')?.textContent;
  return result;
};

// A row of three pairs from 120 to 400 px: no pair ever breaks.
const sweep = () => {
  const row = document.getElementById('sweep');
  const broken = [];
  for (let width = 120; width <= 400; width += 1) {
    row.style.inlineSize = `${width}px`;
    for (const badge of row.querySelectorAll('.sf-badge')) {
      const text = badge.querySelector(':scope > .sf-badge-text-container').getBoundingClientRect();
      const value = badge.querySelector(':scope > .sf-badge-value').getBoundingClientRect();
      const rect = badge.getBoundingClientRect();
      if (Math.abs(text.top - value.top) > 1 || badge.getClientRects().length !== 1 || value.right > rect.right + 0.5) broken.push(width);
    }
  }
  row.style.inlineSize = '';
  return [...new Set(broken)];
};

const near = (one, two, within = 0.02) => Math.abs(one - two) <= within;
const failures = [];
const seen = {};
const browser = await chromium.launch({headless: true});
try {
  for (const [viewport, width] of [['1440', 1440], ['390', 390]]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      for (const load of [1, 2, 3]) {
        const label = `${viewport} ${theme} load ${load}`;
        const tab = await browser.newPage({viewport: {width, height: 900}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await tab.goto(url(theme));
        await tab.waitForFunction(() => customElements.get('sf-badge') && document.querySelector('#v-1-main .sf-badge-value') && document.querySelector('#slot .sf-badge-value b'), null, {timeout: 20000})
          .catch(() => failures.push(`${label}: the badges never drew`));
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(250);
        const m = await tab.evaluate(measure, cases);
        const broken = await tab.evaluate(sweep);
        const spoken = (await tab.locator('#v-1-2-outline').ariaSnapshot()).replace(/\s+/gu, ' ').replace(/ ,/gu, ',');
        const spokenClass = (await tab.locator('#c-1-2-outline').ariaSnapshot()).replace(/\s+/gu, ' ').replace(/ ,/gu, ',');
        if (shots && load === 1) await tab.screenshot({path: join(shots, `badge-composite-${viewport}-${theme}.png`), fullPage: true});
        await tab.close();
        if (errors.length) failures.push(`${label}: errors ${JSON.stringify(errors)}`);
        if (broken.length) failures.push(`${label}: a pair broke at widths ${broken.slice(0, 8).join(', ')}`);
        if (!spoken.includes('sf-wizard, версия 1.5.3')) failures.push(`${label}: sf-badge reads «${spoken}»`);
        if (!spokenClass.includes('sf-wizard, версия 1.5.3')) failures.push(`${label}: class markup reads «${spokenClass}»`);
        for (const {id, look, divider} of cases) {
          const {v, p, c} = m.cases[id];
          if (!v || !p || !c) { failures.push(`${label} ${id}: not drawn`); continue; }
          for (const [form, b] of [['sf-badge', v], ['class', c]]) {
            if (!near(b.height, p.height)) failures.push(`${label} ${id} ${form}: ${b.height}px high, the same badge without a value ${p.height}px`);
            if (!near(b.dividerWidth, m.px)) failures.push(`${label} ${id} ${form}: divider ${b.dividerWidth}px wide`);
            if (!near(b.dividerHeight, b.textHeight, 0.5)) failures.push(`${label} ${id} ${form}: divider ${b.dividerHeight}px high, the text line ${b.textHeight}px`);
            if (!near(b.dividerLeft - b.textRight, m.step, 0.05) || !near(b.valueLeft - b.dividerRight, m.step, 0.05)) failures.push(`${label} ${id} ${form}: ${b.dividerLeft - b.textRight} / ${b.valueLeft - b.dividerRight} around the divider, wants ${m.step}`);
            if (!near(b.textTop, b.valueTop, 1)) failures.push(`${label} ${id} ${form}: the value is not on the name's line`);
            if (b.dividerHidden !== 'true') failures.push(`${label} ${id} ${form}: the divider is not aria-hidden`);
            const want = divider === 'border' ? b.borderColour : divider === 'text' ? b.colour : m.outline;
            if (b.dividerColour !== want) failures.push(`${label} ${id} ${form}: divider ${b.dividerColour}, wants ${want} (${divider})`);
            if (b.valueColour !== b.textColour) failures.push(`${label} ${id} ${form}: value ${b.valueColour}, text ${b.textColour}`);
          }
          if (load === 1) {
            seen[`${viewport} ${theme}`] ??= {px: m.px, step: m.step, cases: {}};
            seen[`${viewport} ${theme}`].cases[id] = {height: v.height, plain: p.height, divider: [v.dividerWidth, v.dividerHeight, v.dividerColour], inside: Math.round((v.valueLeft - v.textRight) * 100) / 100, value: v.valueColour, look};
          }
        }
        if (!(m.long.width <= m.long.room + 0.5) || !m.long.nameCut || m.long.ellipsis !== 'ellipsis' || !m.long.valueWhole || m.long.valueRight > m.long.badgeRight) failures.push(`${label}: the long name did not truncate with the value whole ${JSON.stringify(m.long)}`);
        if (m.disabled.dividerColour !== m.disabledRoles.outline || m.disabled.valueColour !== m.disabledRoles.text) failures.push(`${label}: disabled divider ${m.disabled.dividerColour} / value ${m.disabled.valueColour}`);
        if (!['значение', 'value'].includes(String(m.word).trim().replace(/^, /u, ''))) failures.push(`${label}: the default word is «${m.word}»`);
        if (m.labelledHidden !== 'true') failures.push(`${label}: with aria-label the value is not hidden`);
        if (m.slot !== '8.2') failures.push(`${label}: the slot value did not draw`);
        if (load === 1) Object.assign(seen[`${viewport} ${theme}`], {long: m.long, spoken, word: m.word});
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(seen, null, 1));
if (failures.length) {
  console.error(failures.slice(0, 60).join('\n'));
  console.error(`BADGE_COMPOSITE_FAIL ${failures.length}`);
  process.exit(1);
}
console.log('BADGE_COMPOSITE_OK');

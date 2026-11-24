#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The line at a join of segments is seen on every fill in both themes (owner
// remark VL-77, 2026-11-24: the View filter split button and the removable
// field chips showed the line in the dark theme only). Joined sf-button and
// sf-button-icon hosts (segment start / middle / end, the View chip markup)
// in every look and tone, the danger status and every size; a class row with
// the icon part first. For each join the line, drawn over the part's fill,
// stands at least 1.3:1 against that fill (the register's VL-77 bound), and a
// filled look is within 1.3-3:1 so a join reads alike in light and dark.
// A real click on each part of a chip reaches it. 1440 and 390, light and
// dark, three loads; console clean.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const LOOKS = [['default', 'primary', ''], ['default', 'on-surface', ''], ['tonal', 'primary', ''], ['tonal', 'on-surface', ''],
  ['default', 'primary', 'danger'], ['outline', 'on-surface', ''], ['outline', 'primary', ''], ['ghost', 'on-surface', ''], ['ghost', 'primary', '']];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const rows = [];
for (const [appearance, scheme, status] of LOOKS) for (const size of SIZES) {
  const look = `appearance="${appearance}" scheme="${scheme}" size="${size}"${status ? ` status="${status}"` : ''}`;
  const key = `${appearance}|${scheme}${status ? '|' + status : ''}|${size}`;
  rows.push(`<div class="flex" data-row="chip ${key}"><sf-button segment="start" ${look} text="Состояние 2"></sf-button><sf-button-icon segment="end" ${look} icon="close" aria-label="Убрать"></sf-button-icon></div>`);
  rows.push(`<div class="flex" data-row="three ${key}"><sf-button segment="start" ${look} text="День"></sf-button><sf-button segment="middle" ${look} text="Неделя"></sf-button><sf-button segment="end" ${look} text="Месяц"></sf-button></div>`);
}
for (const [appearance, scheme] of [['default', 'primary'], ['tonal', 'primary'], ['tonal', 'on-surface'], ['ghost', 'on-surface']]) {
  const icon = (position, glyph) => `<button type="button" class="sf-icon-button sf-icon-button--${appearance} sf-icon-button--${scheme} sf-icon-button--icon sf-icon-button--size-1 ${position}" aria-label="${glyph}"><i class="sf-icon" aria-hidden="true">${glyph}</i></button>`;
  rows.push(`<div class="flex" data-row="icon-first ${appearance}|${scheme}|1">${icon('segment-start', 'filter_list')}${icon('segment-middle', 'bookmark_add')}<button type="button" class="sf-button sf-button--${appearance} sf-button--${scheme} sf-button--size-1 segment-end"><span class="sf-button-text-container">Вид</span></button></div>`);
}
const BODY = `<main style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">${rows.join('\n')}</main>`;

const MEASURE = () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const pen = canvas.getContext('2d', {willReadFrequently: true});
  const rgba = (colour) => { pen.clearRect(0, 0, 1, 1); pen.fillStyle = '#000'; pen.fillStyle = colour; pen.fillRect(0, 0, 1, 1); const d = pen.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c) => c.slice(0, 3).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
  const page = over(rgba(getComputedStyle(document.body).backgroundColor), [255, 255, 255, 1]);
  const part = (node) => node.matches('.sf-button, .sf-icon-button') ? node : node.querySelector('.sf-button, .sf-icon-button');
  const out = [];
  for (const row of document.querySelectorAll('[data-row]')) {
    const parts = [...row.children].map(part);
    for (let i = 0; i + 1 < parts.length; i += 1) {
      const [a, b] = [parts[i], parts[i + 1]];
      if (!a || !b) { out.push({row: row.dataset.row, join: i, ratio: 0, why: 'a part is missing'}); continue; }
      const [sa, sb] = [getComputedStyle(a), getComputedStyle(b)];
      const own = parseFloat(sa.borderInlineEndWidth) > 0;
      const style = own ? sa : sb;
      const fill = over(rgba(style.backgroundColor), page);
      const line = over(rgba(own ? sa.borderInlineEndColor : sb.borderInlineStartColor), fill);
      const width = own ? parseFloat(sa.borderInlineEndWidth) : parseFloat(sb.borderInlineStartWidth);
      out.push({row: row.dataset.row, join: i, width, ratio: width >= 1 ? ratio(line, fill) : 0, line: own ? sa.borderInlineEndColor : sb.borderInlineStartColor, fill: style.backgroundColor});
    }
  }
  return out;
};

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction((count) => document.querySelectorAll('[data-row] .sf-button, [data-row] .sf-icon-button').length >= count, rows.length * 2, {timeout: 30_000}).catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(400);
    const joins = await tab.evaluate(MEASURE);
    evidence[at] = joins;
    const low = joins.filter((join) => join.ratio < 1.3);
    ok(`${at}: every join (${joins.length}) is a line of at least 1.3:1 on its fill`, joins.length >= rows.length && low.length === 0, low.slice(0, 6));
    const filled = joins.filter((join) => /^(chip|three|icon-first) (default|tonal)\|/u.test(join.row));
    const off = filled.filter((join) => join.ratio > 3);
    ok(`${at}: a filled join (${filled.length}) is a quiet line, at most 3:1`, filled.length > 0 && off.length === 0, off.slice(0, 6));
    let heard = 0;
    await tab.evaluate(() => { window.__parts = 0; document.addEventListener('click', (event) => { if (event.target.closest('[data-row]')) window.__parts += 1; }, true); });
    for (const key of ['default|primary|1', 'tonal|primary|1', 'tonal|on-surface|1']) {
      const chip = tab.locator(`[data-row="chip ${key}"]`);
      await chip.locator('.sf-button').first().click();
      await chip.locator('.sf-icon-button').first().click();
    }
    heard = await tab.evaluate(() => window.__parts);
    ok(`${at}: a real click on each part of three chips reaches it (6)`, heard === 6, heard);
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
if (process.env.EVIDENCE) console.log(JSON.stringify(evidence));
report();

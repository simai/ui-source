#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every theme x viewport x density.
//        SF_RELOADS=<n> loads each page n times (3 by default).
//
// The record card (owner decision C33, 2026-11-09; ui-control
// control/research/2026-11-09-list-description.md, prototypes/
// list-description.html scenes A and B), drawn by sf-list-description 1.1.0
// over the Loader from the built bytes: tests/fixtures/
// list-description-record-lab.html, at 1440 and 390, light and dark,
// normal and compact density (C22), each page loaded SF_RELOADS times.
//
//   - one label column across the sections of a record: every label starts
//     on one axis, every value on another, the column no wider than 40% of
//     the list and as wide as the widest label; on a phone each label over
//     its value;
//   - heights on the ladder: a one-line row and a section head are the
//     rung's control height (40, 32 compact; a badge, a help mark, a copy
//     button and an action add nothing); a badge stands within the line;
//   - an empty value says its words («Не указан», «Не назначена»), draws no
//     status (the defect: the icon before «—»), and carries its action
//     («Указать: Владелец»); a press asks apply {action, scope, ids, id, kind};
//   - the copy buttons are visible without a pointer over the row;
//   - Tab walks the record in reading order: the section's action, the help
//     mark, links, copy buttons, the item's action, top to bottom, start to
//     end in a row;
//   - the summary (layout grid): four columns at 1440, label over value,
//     each value on one line;
//   - numbers in tabular figures; console clean on every load.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, '..', 'fixtures', 'list-description-record-lab.html'));
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/lab') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(fixture);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const box = (element) => element.getBoundingClientRect();
  const length = (host, value) => {
    const probe = document.createElement('i');
    probe.style.cssText = `position:absolute;display:block;block-size:${value}`;
    host.append(probe);
    const height = box(probe).height;
    probe.remove();
    return round(height);
  };
  const shown = (element) => {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility === 'hidden' || Number(style.opacity) < 1 || style.display === 'none') return false;
    }
    const r = box(element);
    return r.width > 0 && r.height > 0;
  };
  const list = (id) => {
    const host = document.getElementById(id);
    const root = host.querySelector('.sf-list-description');
    const grid = host.querySelector('.sf-list-description-list');
    const rows = [...host.querySelectorAll('.sf-list-description-row')].map((row) => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      const text = row.querySelector('.sf-list-description-text');
      const badge = row.querySelector('.sf-badge');
      const action = row.querySelector('.sf-list-description-action :is(button, a)');
      return {
        id: row.dataset.id,
        height: round(box(row).height),
        dtLeft: round(box(dt).left), dtRight: round(box(dt).right), dtTop: round(box(dt).top), dtBottom: round(box(dt).bottom),
        dtWidth: round(box(dt).width),
        // The label's own width: its text and help mark on one line.
        labelNatural: round((() => { const range = document.createRange(); range.selectNodeContents(dt); return [...range.getClientRects()].reduce((a, r) => Math.max(a, r.right), 0) - box(dt).left; })()),
        ddLeft: round(box(dd).left), ddTop: round(box(dd).top),
        ddRight: round(box(dd).right), cellRight: round(box(row).right), textRight: text ? round(box(text).right) : 0,
        lines: text ? Math.round(box(text).height / parseFloat(getComputedStyle(text).lineHeight)) : 1,
        hint: Boolean(row.querySelector('.sf-list-description-hint')),
        empty: row.querySelector('.sf-list-description-empty')?.textContent ?? null,
        status: Boolean(row.querySelector('.sf-list-description-icon')) || Boolean(row.querySelector('.sr-only')),
        badge: badge ? {height: round(box(badge).height), top: round(box(badge).top - box(dd).top)} : null,
        action: action ? {name: action.getAttribute('aria-label'), text: action.textContent.trim(), shown: shown(action)} : null,
        copies: [...row.querySelectorAll('sf-button-copy button')].map((button) => ({shown: shown(button), name: button.getAttribute('aria-label')})),
        numeric: text ? getComputedStyle(text).fontVariantNumeric : '',
        help: Boolean(row.querySelector('dt sf-help-mark')),
        // From the label's text to the help mark's box (--sf-space-1/4) and to its glyph.
        helpGap: (() => { const mark = row.querySelector('dt .sf-help-mark'); if (!mark) return null; const range = document.createRange(); range.selectNodeContents(dt.firstChild ?? dt); const textRight = [...range.getClientRects()].reduce((a, r) => Math.max(a, r.right), 0); const glyph = mark.querySelector('.sf-icon') ?? mark; return {box: round(box(mark).left - textRight), glyph: round(box(glyph).left - textRight)}; })(),
        space: length(row, 'var(--sf-space-1\\/4)'),
      };
    });
    const heads = [...host.querySelectorAll('.sf-list-description-head')].map((head) => ({
      id: head.dataset.id,
      height: round(box(head).height),
      title: head.querySelector('[role=heading]')?.textContent.trim(),
      level: head.querySelector('[role=heading]')?.getAttribute('aria-level'),
      action: head.querySelector('.sf-list-description-action button')?.getAttribute('aria-label') ?? null,
    }));
    return {
      width: round(box(grid).width),
      control: length(root, 'var(--sf-list-description--control)'),
      line: length(root, 'var(--sf-list-description--line)'),
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      rows, heads,
    };
  };
  const focusables = [...document.querySelectorAll('#order :is(a[href], button, [tabindex="0"])')]
    .filter((element) => !element.disabled && element.tabIndex >= 0 && box(element).width > 0)
    .map((element) => element.getAttribute('aria-label') || element.textContent.trim());
  return {order: list('order'), server: list('server'), summary: list('summary'), focusables};
};

const near = (a, b, tolerance = 0.5) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport] of [['1440', {width: 1440, height: 1000}], ['390', {width: 390, height: 1600}]]) {
      for (const density of ['normal', 'compact']) {
        const name = `${theme}-${device}-${density}`;
        for (let load = 1; load <= reloads; load += 1) {
          const run = `${name} #${load}`;
          const fail = (detail) => failures.push(`${run}: ${detail}`);
          const context = await browser.newContext({viewport, colorScheme: theme, reducedMotion: 'reduce'});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(error.message));
          tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
          tab.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
          tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
          await tab.goto(`http://127.0.0.1:${server.address().port}/lab?theme=${theme}&density=${density}`);
          await tab.waitForFunction(() => document.querySelectorAll('.sf-list-description-row').length === 29
            && document.querySelectorAll('.sf-list-description sf-button-copy button').length === 8
            && document.querySelectorAll('.sf-list-description-action button').length === 5
            && document.querySelectorAll('.sf-list-description .sf-badge').length === 4
            && document.querySelectorAll('.sf-list-description .sf-help-mark button').length === 2,
          null, {timeout: 30000}).catch(() => fail('the page never drew both scenes with their buttons, badges and help marks'));
          await tab.waitForFunction(() => Array.from(document.querySelectorAll('.sf-icon')).every((icon) => icon.classList.contains('sf-icon-loaded')), null, {timeout: 10000}).catch(() => {});
          await tab.evaluate(() => document.fonts.ready);
          await tab.mouse.move(0, 0);
          await tab.waitForTimeout(300);
          const m = await tab.evaluate(MEASURE);
          if (load === 1) seen[name] = m;
          if (evidence && load === 1) await tab.screenshot({path: join(evidence, `record-card-${name}.png`), fullPage: true});
          const phone = device === '390';
          const H = density === 'compact' && !phone ? 32 : (phone ? m.order.control : 40);

          // The ladder: the rung's control height (40; compact 32 on a desktop).
          if (!phone && !near(m.order.control, H)) fail(`control height ${m.order.control}, expected ${H}`);

          for (const list of [m.order, m.server]) {
            // One label column across the sections, one axis for the values.
            const dts = new Set(list.rows.map((row) => Math.round(row.dtLeft)));
            const dds = new Set(list.rows.map((row) => Math.round(row.ddLeft)));
            if (dts.size !== 1) fail(`labels start at ${[...dts]}`);
            if (dds.size !== 1) fail(`values start at ${[...dds]}`);
            if (phone) {
              for (const row of list.rows) if (!(row.ddTop >= row.dtBottom - 0.5) || !near(row.ddLeft, row.dtLeft)) fail(`${row.id}: on a phone the label is not over its value`);
            } else {
              const column = Math.max(...list.rows.map((row) => row.dtWidth));
              const widest = Math.max(...list.rows.map((row) => row.labelNatural));
              if (column > list.width * 0.4 + 0.5) fail(`label column ${column} wider than 40% of ${list.width}`);
              if (!near(column, Math.min(widest, list.width * 0.4), 1)) fail(`label column ${column}, widest label ${widest}`);
              for (const row of list.rows) {
                if (!(row.ddLeft > row.dtRight)) fail(`${row.id}: the value does not stand beside its label`);
                if (!near(row.dtTop, row.ddTop)) fail(`${row.id}: label and value tops ${row.dtTop} / ${row.ddTop}`);
                // A one-line row is H: a badge, a help mark, a copy button, an action add nothing.
                if (!row.hint && row.lines === 1 && !near(row.height, H)) fail(`${row.id}: one-line row ${row.height}, expected ${H}`);
              }
              for (const head of list.heads) if (!near(head.height, H)) fail(`section ${head.id}: head ${head.height}, expected ${H}`);
            }
            for (const row of list.rows) {
              if (row.badge && !(row.badge.height <= list.line + 0.5)) fail(`${row.id}: badge ${row.badge.height} taller than the line ${list.line}`);
              for (const copy of row.copies) if (!copy.shown) fail(`${row.id}: copy button hidden without a pointer`);
            }
          }

          // Sections: heads, levels, actions named by the section.
          const heads = m.order.heads.map((head) => `${head.title}/${head.level}/${head.action}`).join(', ');
          if (heads !== 'Заказ/3/Изменить: Заказ, Покупатель/3/Изменить: Покупатель, Доставка/3/Изменить: Доставка') fail(`heads ${heads}`);

          // Empty values: words, no status, the action.
          const row = (list, id) => list.rows.find((one) => one.id === id) ?? {};
          const comment = row(m.order, 'comment');
          const date = row(m.order, 'date');
          const owner = row(m.server, 'owner');
          if (comment.empty !== 'Не указан' || comment.status) fail(`comment: empty ${comment.empty}, status ${comment.status}`);
          if (date.empty !== 'Не назначена' || date.status) fail(`date: empty ${date.empty}, status drawn ${date.status} (the C33 defect)`);
          if (date.action?.name !== 'Назначить: Дата доставки' || date.action?.text !== 'Назначить' || !date.action?.shown) fail(`date action ${JSON.stringify(date.action)}`);
          if (owner.empty !== 'Не указан' || owner.action?.name !== 'Указать: Владелец') fail(`owner ${owner.empty} ${JSON.stringify(owner.action)}`);
          if (!row(m.order, 'state').badge) fail('state: no badge');
          if (!row(m.order, 'way').help) fail('way: no help mark');
          const way = row(m.order, 'way');
          if (!way.helpGap || !near(way.helpGap.box, way.space)) fail(`way: help mark ${JSON.stringify(way.helpGap)} from the label, expected --sf-space-1/4 = ${way.space}`);
          if (load === 1) seen[name].helpGap = way.helpGap;
          for (const id of ['sum', 'phone']) if (!row(m.order, id).numeric.includes('tabular-nums')) fail(`${id}: not tabular figures (${row(m.order, id).numeric})`);

          // The summary (scene B): four columns at 1440, label over value, one line.
          if (!phone && m.summary.columns !== 4) fail(`summary: ${m.summary.columns} columns at 1440`);
          if (phone && m.summary.columns > 2) fail(`summary: ${m.summary.columns} columns at 390`);
          for (const one of m.summary.rows) {
            if (!(one.ddTop >= one.dtBottom - 0.5) || !near(one.ddLeft, one.dtLeft)) fail(`summary ${one.id}: the label is not over its value`);
            if (one.lines > 1) fail(`summary ${one.id}: ${one.lines} lines`);
          }
          // A value longer than its column is cut, not let out of the cell.
          for (const one of m.summary.rows) if (one.ddRight > one.cellRight + 0.5 || one.textRight > one.cellRight + 0.5) fail(`summary ${one.id}: the value overflows its column (${one.textRight} > ${one.cellRight})`);

          if (load === 1) {
            // Keyboard: Tab through the order card in reading order.
            const expected = ['Изменить: Заказ', 'Скопировать: Номер', 'Изменить: Покупатель', 'Анна Сергеевна Королёва', 'Скопировать: Телефон', 'a.koroleva@mail.ru',
              'Скопировать: Эл. почта', 'Изменить: Доставка', 'Подробнее: Способ', 'Скопировать: Трек-номер', 'Назначить: Дата доставки'];
            if (JSON.stringify(m.focusables) !== JSON.stringify(expected)) fail(`focusable order ${JSON.stringify(m.focusables)}`);
            await tab.evaluate(() => { const start = document.querySelector('#order').closest('.card').querySelector('.card-title'); start.tabIndex = -1; start.focus(); });
            const walked = [];
            let previous = null;
            for (let step = 0; step < expected.length; step += 1) {
              await tab.keyboard.press('Tab');
              const at = await tab.evaluate(() => { const element = document.activeElement; const r = element.getBoundingClientRect(); return {name: element.getAttribute('aria-label') || element.textContent.trim(), top: r.top, left: r.left, bottom: r.bottom, inside: Boolean(element.closest('#order'))}; });
              walked.push(at.name);
              if (!at.inside) { fail(`Tab ${step + 1} left the card (${at.name})`); break; }
              // Reading order: below the previous, or on its line further along.
              if (previous && !(at.top >= previous.bottom - 2 || (Math.abs(at.top - previous.top) < H && at.left > previous.left) || at.top > previous.top + 2)) fail(`Tab ${step + 1} (${at.name}) goes back up or left from ${previous.name}`);
              previous = at;
            }
            if (JSON.stringify(walked) !== JSON.stringify(expected)) fail(`Tab order ${JSON.stringify(walked)}`);
            seen[name].tab = walked;

            // A press asks apply: an item's action and a section's.
            await tab.click('#order [data-id=date] .sf-list-description-action button');
            await tab.click('#order .sf-list-description-head[data-id=customer] .sf-list-description-action button');
            const applied = await tab.evaluate(() => window.__applied ?? []);
            const want = [{action: 'schedule', scope: 'entry', ids: ['date'], id: 'date', kind: 'item'}, {action: 'edit', scope: 'entry', ids: ['customer'], id: 'customer', kind: 'section'}];
            if (JSON.stringify(applied) !== JSON.stringify(want)) fail(`apply ${JSON.stringify(applied)}`);
          }
          if (errors.length) fail(`console ${JSON.stringify(errors)}`);
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
const rows = (list) => list.rows.map((one) => `${one.id} ${one.height}`).join(', ');
console.log(JSON.stringify({
  reloads,
  seen: Object.fromEntries(Object.entries(seen).map(([name, m]) => [name, {
    control: m.order.control, line: m.order.line,
    labelColumn: `${Math.max(...m.order.rows.map((one) => one.dtWidth))} of ${m.order.width} (order), ${Math.max(...m.server.rows.map((one) => one.dtWidth))} of ${m.server.width} (server)`,
    valueAxis: `${[...new Set(m.order.rows.map((one) => one.ddLeft))]} (order), ${[...new Set(m.server.rows.map((one) => one.ddLeft))]} (server)`,
    heads: m.order.heads.map((head) => head.height),
    orderRows: rows(m.order),
    summaryColumns: m.summary.columns,
    badges: m.order.rows.concat(m.server.rows).filter((one) => one.badge).map((one) => `${one.id} ${one.badge.height}`),
    tab: m.tab,
    helpGap: m.helpGap,
  }])),
  failures,
}, null, 1));
process.exitCode = failures.length ? 1 : 0;

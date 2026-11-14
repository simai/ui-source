#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// .table-frame: the frame a table stands in. Consumers restyled .table for
// this by hand (the documentation site did, with its own numbers), and what
// made it fiddly is exactly what a unit cannot see: a collapsed border is
// drawn over the frame's own and the corners come out square, the gridlines
// double at the frame's edge, and the scroll belongs to the frame, not the
// page. Measured on the built bytes, at 1440px:
//   - the frame draws one border of var(--sf-px) and a surface radius, and it
//     is the scroll area: a table wider than the frame scrolls inside it and
//     the page does not;
//   - the table keeps its borders separate, so the frame's corners clip it;
//   - every cell has a gridline after it and under it, except the last column
//     (no line after) and the last row (no line under) -- the frame draws
//     those edges;
//   - the head is quiet (C146 (2)): no fill of its own (the frame's
//     background, laid so a still first cell covers what scrolls), the
//     medium weight and the supporting text role, the page's, as the body's;
//   - the cell rhythm comes from the ladder (C146 (1)): head and body stand
//     on size 1, the block padding the step less a text line and the row's
//     line, halved; inline a --sf-space-1;
//   - a table wider than the frame scrolls under its first column, which
//     stands still (C146 (9)), and a number column is end aligned (C146 (3)).
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'core/core/css/utility.full.css'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;

const cell = (row, column) => `<td data-cell="${row}-${column}">Значение ${row}.${column}</td>`;
const page_html = `
<div class="table-frame" data-probe="frame" style="inline-size:420px">
  <table class="table">
    <thead><tr><th data-head="1">Имя</th><th data-head="2">Состояние</th><th data-head="3">Обновлено</th></tr></thead>
    <tbody>
      <tr>${cell(1, 1)}${cell(1, 2)}${cell(1, 3)}</tr>
      <tr>${cell(2, 1)}${cell(2, 2)}${cell(2, 3)}</tr>
    </tbody>
  </table>
</div>
<div class="table-frame" data-probe="wide" style="inline-size:320px">
  <table class="table">
    <thead><tr><th>Один</th><th>Два</th><th>Три</th><th>Четыре</th><th>Пять</th><th class="table-numeric">Шесть</th></tr></thead>
    <tbody><tr><td data-wide="first">Значение один</td><td data-wide="second">Значение два</td><td>Значение три</td><td>Значение четыре</td><td>Значение пять</td><td class="table-numeric" data-wide="number">1 234 567,89</td></tr></tbody>
  </table>
</div>
<div class="table-frame" data-probe="own" style="--sf-table-frame-head-background:rgb(1, 2, 3)">
  <table class="table">
    <thead><tr><th data-head="own">Имя</th></tr></thead>
    <tbody><tr><td>Значение</td></tr></tbody>
  </table>
</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  // A file:// link from a setContent page is not fetched; the sheets are added
  // as style tags from the built bytes, as the other probes do.
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">${page_html}</body></html>`);
  for (const sheet of SHEETS) await page.addStyleTag({path: join(out, sheet)});

  const measured = await page.evaluate(async () => {
    const measure = (value) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
      document.body.append(probe);
      const width = getComputedStyle(probe).inlineSize;
      probe.remove();
      return width;
    };
    const read = (node, ...names) => {
      const style = getComputedStyle(node);
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
    };
    const frame = document.querySelector('[data-probe="frame"]');
    const wide = document.querySelector('[data-probe="wide"]');
    const table = frame.querySelector('.table');
    const head = frame.querySelector('[data-head="1"]');
    const headLast = frame.querySelector('[data-head="3"]');
    const body = frame.querySelector('[data-cell="1-1"]');
    const bodyLastColumn = frame.querySelector('[data-cell="1-3"]');
    const lastRow = frame.querySelector('[data-cell="2-1"]');
    return {
      frame: {
        ...read(frame, 'overflow-x', 'overflow-y', 'border-top-width', 'border-top-style', 'border-top-left-radius', 'background-color'),
        scrolls: frame.scrollWidth <= frame.clientWidth,
      },
      wide: {scrolls: wide.scrollWidth > wide.clientWidth, pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ...await (async () => {
          const at = (key) => wide.querySelector(`[data-wide="${key}"]`).getBoundingClientRect().left;
          const before = {first: at('first'), second: at('second')};
          wide.scrollLeft = 120;
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          const moved = {first: before.first - at('first'), second: before.second - at('second')};
          wide.scrollLeft = 0;
          const number = wide.querySelector('[data-wide="number"]');
          return {moved, firstBackground: getComputedStyle(wide.querySelector('[data-wide="first"]')).backgroundColor, numberAlign: getComputedStyle(number).textAlign, numberWrap: getComputedStyle(number).whiteSpace};
        })()},
      table: read(table, 'border-collapse', 'border-spacing', 'margin-bottom', 'border-top-width', 'border-top-left-radius', 'inline-size'),
      head: {
        ...read(head, 'background-color', 'font-weight', 'padding-top', 'padding-left', 'border-right-width', 'border-bottom-width', 'text-align', '--sf-on-surface-variant'),
        mediumWeight: getComputedStyle(document.documentElement).getPropertyValue('--sf-font-weight-medium').trim(),
        variantInk: (() => { const probe = document.createElement('span'); probe.style.color = 'var(--sf-on-surface-variant)'; head.append(probe); const ink = getComputedStyle(probe).color; probe.remove(); return ink; })(),
        color: getComputedStyle(head).color,
      },
      headLast: read(headLast, 'border-right-width'),
      ownHead: read(document.querySelector('[data-head="own"]'), 'background-color'),
      words: read(head, 'word-break', 'overflow-wrap'),
      body: {
        ...read(body, 'padding-top', 'padding-left', 'border-right-width', 'border-bottom-width', 'vertical-align', '--sf-on-surface-variant'),
        pageInk: getComputedStyle(document.documentElement).getPropertyValue('--sf-on-surface-variant').trim(),
      },
      bodyLastColumn: read(bodyLastColumn, 'border-right-width'),
      lastRow: read(lastRow, 'border-bottom-width', 'border-bottom-color'),
      // A step is a token, so its value is a length the page resolves, not a
      // number: it is measured the way the cell resolves it.
      steps: {
        one: measure('var(--sf-space-1)'),
        row: measure('calc((var(--sf-ui-1--control-height) - var(--sf-text-height-1) - var(--sf-px)) / 2)'),
        hairline: measure('var(--sf-px)'),
      },
    };
  });
  evidence.measured = measured;
  const px = (value) => Number.parseFloat(value);

  check('the frame is the scroll area', measured.frame['overflow-x'] === 'auto' && measured.frame['overflow-y'] === 'auto', measured.frame);
  check('the frame draws one hairline border', near(px(measured.frame['border-top-width']), px(measured.steps.hairline)) && measured.frame['border-top-style'] === 'solid', measured.frame);
  check('the frame has a corner', px(measured.frame['border-top-left-radius']) > 0, measured.frame);
  check('a wide table scrolls inside the frame, not the page', measured.wide.scrolls && !measured.wide.pageScrolls, measured.wide);
  check('the table keeps its borders separate', measured.table['border-collapse'] === 'separate' && px(measured.table['border-spacing']) === 0, measured.table);
  check('the table gives up its own margin, border and corner', px(measured.table['margin-bottom']) === 0 && px(measured.table['border-top-width']) === 0 && px(measured.table['border-top-left-radius']) === 0, measured.table);

  check('a cell has a gridline after it and under it', near(px(measured.body['border-right-width']), px(measured.steps.hairline)) && near(px(measured.body['border-bottom-width']), px(measured.steps.hairline)), measured.body);
  check('the last column leaves its edge to the frame', px(measured.bodyLastColumn['border-right-width']) === 0 && px(measured.headLast['border-right-width']) === 0, {body: measured.bodyLastColumn, head: measured.headLast});
  // The last row's line keeps its room, unpainted, so the row stands on the
  // ladder like the others (TB-2).
  check('the last row leaves its edge to the frame', measured.lastRow['border-bottom-color'] === 'rgba(0, 0, 0, 0)', measured.lastRow);

  check('the head has no fill of its own: the frame\'s background', measured.head['background-color'] === measured.frame['background-color'], {head: measured.head['background-color'], frame: measured.frame['background-color']});
  check('the head is quiet: the medium weight and the supporting role', measured.head['font-weight'] === measured.head.mediumWeight.replace(/[^0-9]/gu, '') && measured.head.color === measured.head.variantInk, measured.head);
  check('head and body read the page\'s dimmed role', measured.head['--sf-on-surface-variant'] === measured.body.pageInk && measured.body['--sf-on-surface-variant'] === measured.body.pageInk, {head: measured.head['--sf-on-surface-variant'], body: measured.body['--sf-on-surface-variant']});
  check('the first column stands still while the rest scroll', near(measured.wide.moved.first, 0) && measured.wide.moved.second > 100, measured.wide);
  check('the still first column covers what scrolls under it', measured.wide.firstBackground === measured.frame['background-color'], measured.wide);
  check('a number column is end aligned on one line', measured.wide.numberAlign === 'end' && measured.wide.numberWrap === 'nowrap', measured.wide);

  check('a cell keeps its words whole: the frame scrolls instead', measured.words['word-break'] === 'normal' && measured.words['overflow-wrap'] === 'normal', measured.words);
  check('a head fill set on the frame reaches the head cells', measured.ownHead['background-color'] === 'rgb(1, 2, 3)', measured.ownHead);
  check('the head block padding stands the head on the row\'s step', near(px(measured.head['padding-top']), px(measured.steps.row)), {head: measured.head['padding-top'], step: measured.steps.row});
  check('the body block padding stands a row on the step', near(px(measured.body['padding-top']), px(measured.steps.row)), {body: measured.body['padding-top'], step: measured.steps.row});
  // The first cell's inline padding holds the frame's border inside the edge
  // inset (C77): the text stands a step from the frame's outer edge.
  check('the inline padding is the same step in head and body', near(px(measured.head['padding-left']) + px(measured.steps.hairline), px(measured.steps.one)) && near(px(measured.body['padding-left']) + px(measured.steps.hairline), px(measured.steps.one)), {head: measured.head['padding-left'], body: measured.body['padding-left'], step: measured.steps.one});
  check('a cell starts at the top, at the start', measured.body['vertical-align'] === 'top' && measured.head['text-align'] === 'start', {body: measured.body, head: measured.head});

  await page.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({probe: 'table-frame', passed: failures.length === 0, failures, evidence}, null, 2));
process.exit(failures.length === 0 ? 0 : 1);

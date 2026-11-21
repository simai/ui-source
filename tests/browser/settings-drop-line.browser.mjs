#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads] [shots-dir]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-settings column drag (owner remark VR11-5, view round 11 order 3, group
// build 16 G10): a real drag by a row's handle in the look="panel" popup
// marks the landing place with SF.Sortable's drop line -- one
// .sf-sortable-indicator, 2 px, straight across the list, in the primary
// colour of sf-sortable's sheet -- and no row draws a mark of its own (the
// panel's inset shadow on the landing row bent at its corners). Let go, the
// row is in its new place and the line is gone. 1440 and 390, light and
// dark, three loads; a screenshot of the panel mid-drag per width and theme
// when a shots directory is given.
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const SHOTS = process.argv[4] || '';
if (SHOTS) mkdirSync(SHOTS, {recursive: true});
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;

const options = Array.from({length: 6}, (_, index) => ({id: `c${index}`, text: `Колонка ${index + 1}`, checked: true}));
const BODY = `<main><sf-settings id="s" look="panel" size="1" label="Колонки">
  <sf-button-icon slot="trigger" id="open" icon="view_column" appearance="outline" scheme="on-surface" aria-label="Колонки"></sf-button-icon>
  <script type="application/json" data-sf-settings>${JSON.stringify({items: [{id: 'cols', type: 'fields', text: 'Колонки', sortable: true, options}]})}</script>
</sf-settings></main>`;

const READ = () => {
  const rows = [...document.querySelectorAll('.sf-settings-row')].filter((row) => row.getBoundingClientRect().height > 0 && row.querySelector('.sf-settings-row-handle'));
  const line = [...document.querySelectorAll('.sf-sortable-indicator')].find((node) => !node.hidden && node.getBoundingClientRect().height > 0);
  const box = line?.getBoundingClientRect();
  const list = rows[0]?.parentElement?.getBoundingClientRect();
  return {
    lines: document.querySelectorAll('.sf-sortable-indicator:not([hidden])').length,
    owner: line?.getAttribute('data-sf-drop-line-owner') ?? null,
    line: box ? {left: box.left, top: box.top, width: box.width, height: box.height} : null,
    colour: line ? getComputedStyle(line).backgroundColor : null,
    primary: (() => { const probe = document.createElement('i'); probe.style.color = 'var(--sf-primary)'; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })(),
    list: list ? {left: list.left, width: list.width} : null,
    rowTops: rows.map((row) => row.getBoundingClientRect().top),
    rowMarks: rows.filter((row) => getComputedStyle(row).boxShadow !== 'none').length,
    order: rows.map((row) => row.querySelector('.sf-settings-row-label')?.textContent.trim()),
  };
};

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction(() => customElements.get('sf-settings') && document.querySelector('#open > button'), null, {timeout: 20_000});
    await tab.evaluate(() => document.fonts.ready);
    await tab.click('#open > button');
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-settings-row-handle')].filter((node) => node.getBoundingClientRect().height > 0).length >= 6, null, {timeout: 10_000}).catch(() => {});
    // The line's sheet is a lazy relation: wait until sf-sortable's sheet is in.
    await tab.waitForFunction(() => [...document.styleSheets].some((sheet) => /sortable/u.test(sheet.href ?? '')), null, {timeout: 10_000}).catch(() => {});
    await tab.waitForTimeout(400);
    const before = await tab.evaluate(READ);
    const handle = tab.locator('.sf-settings-row .sf-settings-row-handle').first();
    const grip = await handle.boundingBox();
    // A real drag: press the first row's handle and move below the fourth row's middle.
    const target = before.rowTops[4] + 4;
    await tab.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await tab.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await tab.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + (target - grip.y - grip.height / 2) * step / 8);
      await tab.waitForTimeout(30);
    }
    await tab.waitForTimeout(150);
    const during = await tab.evaluate(READ);
    if (SHOTS && load === 1) {
      const panel = tab.locator('.sf-settings-panel').first();
      await panel.screenshot({path: join(SHOTS, `settings-drag-${width}-${theme}.png`)}).catch(() => {});
    }
    await tab.mouse.up();
    await tab.waitForTimeout(400);
    const after = await tab.evaluate(READ);
    evidence[at] = {before: before.order, during, after: {lines: after.lines, order: after.order}};
    ok(`${at}: one drop line while dragging, SF.Sortable's (.sf-sortable-indicator)`, during.lines === 1 && during.owner === 'sf-settings', during);
    ok(`${at}: the line is 2 px and straight across the list`, during.line !== null && near(during.line.height, 2, 0.1)
      && near(during.line.left, during.list.left) && near(during.line.width, during.list.width), during);
    ok(`${at}: the line stands at the landing row's top edge`, during.line !== null && near(during.line.top + 1, during.rowTops[4], 1.5), during);
    ok(`${at}: the line is the primary colour of sf-sortable's sheet`, during.colour === during.primary, during);
    ok(`${at}: no row draws a mark of its own`, during.rowMarks === 0, during);
    ok(`${at}: let go, the row lands before the fifth and the line is gone`, after.lines === 0
      && after.order[3] === before.order[0] && after.order[0] === before.order[1], {before: before.order, after: after.order, lines: after.lines});
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();

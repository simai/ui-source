#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Framework order FO-2 (the view set study, ui-control control/research/
// 2026-11-17-view-round-1/framework-orders.md): sf-list 1.22.0 draws a long
// list by core/js/rows-window.js. A list of 10 000 rows on the page's own
// scroll, at 1440 and 390, light and dark, `loads` fresh loads each (3 by
// default). Measured: the rows drawn are a range around the visible ones (far
// fewer than the list), the spacers keep the page as tall as the whole list,
// every row says its place in the list; a scroll to the middle is held where
// it was put while the range follows it (the row at the top of the window is
// the row the scroll position names), and still held a moment later; End and
// Home on a focused row go to the list's last and first row; a clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const COUNT = 10_000;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: '<main><h1 style="margin:0 0 16px">Список</h1><div id="box"></div></main>'})));
    await tab.waitForFunction(() => customElements.get('sf-list') && customElements.get('sf-list-item'), null, {timeout: 20_000});
    await tab.evaluate((count) => {
      const list = document.createElement('sf-list');
      list.id = 'list';
      list.setAttribute('label', 'Строки');
      document.getElementById('box').append(list);
      list.setItems(Array.from({length: count}, (_, index) => ({id: `r${index}`, text: `Строка ${index + 1}`, supporting: `Описание ${index + 1}`})));
    }, COUNT);
    await tab.waitForFunction(() => document.querySelectorAll('#list [aria-posinset]').length > 0
      && document.querySelector('#list [data-sf-rows-spacer]'), null, {timeout: 20_000});
    await tab.waitForTimeout(300);

    const first = await tab.evaluate(() => {
      const rows = [...document.querySelectorAll('#list [aria-posinset]')];
      const list = document.getElementById('list');
      const height = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
      return {
        drawn: rows.length,
        setsize: new Set(rows.map((row) => row.getAttribute('aria-setsize'))),
        firstPlace: Number(rows[0].getAttribute('aria-posinset')),
        height,
        listHeight: list.getBoundingClientRect().height,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    ok(`${key}: only a range is drawn (${first.drawn} of ${COUNT})`, first.drawn > 0 && first.drawn < 200, first);
    ok(`${key}: every row says its place in the whole list`, first.setsize.size === 1 && first.setsize.has(String(COUNT)) && first.firstPlace === 1, {...first, setsize: [...first.setsize]});
    ok(`${key}: the spacers keep the list as tall as its ${COUNT} rows`, Math.abs(first.listHeight - COUNT * first.height) < first.height * 3 && first.pageHeight >= first.listHeight, first);

    // A scroll to the middle: held where it was put, the range follows it.
    const target = await tab.evaluate((count) => {
      const rows = [...document.querySelectorAll('#list [aria-posinset]')];
      const top = rows[0].getBoundingClientRect().top + window.scrollY;
      const height = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
      const y = Math.round(top + (count / 2) * height);
      window.scrollTo(0, y);
      return {y, top, height};
    }, COUNT);
    await tab.waitForTimeout(400);
    const middle = await tab.evaluate(({top, height}) => {
      const rows = [...document.querySelectorAll('#list [aria-posinset]')];
      const atTop = rows.find((row) => row.getBoundingClientRect().bottom > 1);
      const atTopVisible = atTop && atTop.getBoundingClientRect().top < window.innerHeight;
      return {
        scrollY: window.scrollY,
        drawn: rows.length,
        place: atTop ? Number(atTop.getAttribute('aria-posinset')) : null,
        expected: Math.floor((window.scrollY - top) / height) + 1,
        visible: Boolean(atTopVisible),
        range: [Number(rows[0]?.getAttribute('aria-posinset')), Number(rows.at(-1)?.getAttribute('aria-posinset'))],
      };
    }, target);
    ok(`${key}: the scroll to the middle is held`, Math.abs(middle.scrollY - target.y) <= 1, {middle, target});
    ok(`${key}: the row at the top is the row the position names, drawn`, middle.visible && middle.place !== null && Math.abs(middle.place - middle.expected) <= 1, middle);
    ok(`${key}: still a range in the middle`, middle.drawn < 200 && middle.range[0] > 1 && middle.range[1] < COUNT, middle);
    await tab.waitForTimeout(600);
    const later = await tab.evaluate(() => window.scrollY);
    ok(`${key}: the position holds after the range is drawn again`, Math.abs(later - target.y) <= 1, {later, y: target.y});

    // End and Home on a focused row: the whole list's last and first row.
    await tab.evaluate(() => {
      const row = [...document.querySelectorAll('#list .sf-list-item[data-sf-list-roving]')].find((one) => one.getBoundingClientRect().top > 0);
      row?.focus();
    });
    await tab.keyboard.press('End');
    await tab.waitForTimeout(400);
    const end = await tab.evaluate(() => {
      const row = document.activeElement?.closest?.('[aria-posinset]');
      const box = document.activeElement?.getBoundingClientRect();
      return {place: row ? Number(row.getAttribute('aria-posinset')) : null, inView: Boolean(box) && box.bottom > 0 && box.top < window.innerHeight};
    });
    ok(`${key}: End goes to the last row of the list, in view`, end.place === COUNT && end.inView, end);
    await tab.keyboard.press('Home');
    await tab.waitForTimeout(400);
    const home = await tab.evaluate(() => {
      const row = document.activeElement?.closest?.('[aria-posinset]');
      const box = document.activeElement?.getBoundingClientRect();
      return {place: row ? Number(row.getAttribute('aria-posinset')) : null, inView: Boolean(box) && box.bottom > 0 && box.top < window.innerHeight};
    });
    ok(`${key}: Home goes to the first row of the list, in view`, home.place === 1 && home.inView, home);
    const sideways = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${key}: no sideways scroll`, sideways <= 0, {sideways});
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
await server.close();
report();

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Round two for the page row: the window and its field, the ends, and the bulk
// band as part of the card rather than a panel floating over the page.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css',
  'core/core/css/utility.full.css',
  'component/component/pagination/css/pagination.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/icon-buttons/js/icon-buttons.js',
  'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/input/js/input.js',
  'smart/smart/spinner/js/spinner.js',
  'smart/smart/pagination/js/pagination.js',
].map((p) => join(out, p));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

const open = async (markup) => {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html class="theme-light"><body style="margin:0">${markup}</body></html>`);
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.pages = [];
    document.getElementById('p').addEventListener('sf-page-change', (event) => window.pages.push(event.detail.current));
  });
  return page;
};

try {
  const pager = await open('<div style="width:900px"><sf-pagination id="p" top="false" bottom="false" total="450" page-size="10"></sf-pagination></div>');
  const look = (current) => pager.evaluate(async (page) => {
    const element = document.getElementById('p');
    element.setAttribute('current', String(page));
    await new Promise((done) => setTimeout(done, 200));
    const list = element.querySelector('.sf-pagination-list');
    return {
      numbers: [...list.querySelectorAll('.sf-page-number')].map((button) => Number(button.textContent.trim())),
      first: Boolean(element.querySelector('.sf-pagination-direction--first')),
      prev: Boolean(element.querySelector('.sf-pagination-direction--prev')),
      next: Boolean(element.querySelector('.sf-pagination-direction--next')),
      last: Boolean(element.querySelector('.sf-pagination-direction--last')),
      // The row of numbers was replaced by the page field on 2026-10-05, so
      // what has to stay readable is the number in the field: the row's width
      // now follows the digits, by the owner's own request.
      field: element.querySelector('.sf-pagination-page-input input')?.value ?? null,
      fieldFits: (() => {
        const input = element.querySelector('.sf-pagination-page-input input');
        if (!input) return null;
        return Math.ceil(input.scrollWidth) <= Math.ceil(input.getBoundingClientRect().width) + 1;
      })(),
      betweenArrows: Boolean(list.querySelector('.sf-pagination-item-field')),
    };
  }, current);

  for (const current of [1, 2, 5, 20, 45]) {
    const shown = await look(current);
    if (shown.numbers.length) {
      note({case: `window on page ${current}`, got: shown.numbers, expected: 'no row of numbers'});
    }
    if (shown.field !== String(current) || shown.fieldFits !== true || !shown.betweenArrows) {
      note({case: `field on page ${current}`, got: shown, expected: 'the page in a field between the arrows, and the number fits it'});
    }
    if (current === 1 && (shown.first || shown.prev)) {
      note({case: 'ends', expected: 'no first and no back on the first page'});
    }
    if (current > 1 && !(shown.first && shown.prev)) {
      note({case: `ends on page ${current}`, expected: 'first and back appear'});
    }
    if (current === 45 && (shown.next || shown.last)) {
      note({case: 'ends', expected: 'no forward and no last on the last page'});
    }
    if (current < 45 && !(shown.next && shown.last)) {
      note({case: `ends on page ${current}`, expected: 'forward and last appear'});
    }
  }


  // The field takes a page and is held to the pages there are.
  const typed = await pager.evaluate(async () => {
    const element = document.getElementById('p');
    const field = element.querySelector('.sf-pagination-page-field input');
    window.pages = [];
    field.value = '12';
    field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    await new Promise((done) => setTimeout(done, 200));
    const afterTyped = [...window.pages];
    field.value = '999';
    field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    await new Promise((done) => setTimeout(done, 200));
    return {afterTyped, afterTooFar: [...window.pages]};
  });
  if (String(typed.afterTyped) !== '12') {
    note({case: 'field', got: typed.afterTyped, expected: 'Enter goes to the page typed'});
  }
  if (!typed.afterTooFar.includes(45)) {
    note({case: 'field', got: typed.afterTooFar, expected: 'a number past the end lands on the last page'});
  }
  await pager.close();

  // A page row on its own still carries the band, in flow as its last row: the
  // surface, the line above it and the shadow. Holding the bottom of the window
  // is the card's job now — a sticky box cannot leave the box that contains it,
  // and the consumer saw the whole row floating over its own rows when the row
  // was made to stick. That arrangement is measured in data-view-reloads
  // (package larena, with sf-data-view).
  const card = await open(
    `<div id="card" style="width:900px;border:1px solid #ccc;display:flex;flex-direction:column">
       <sf-pagination id="p" top="false" total="450" page-size="10" current="1" selected-count="3"
         actions="archive:В архив" show-action-for-all="true"></sf-pagination>
     </div>`,
  );
  const band = await card.evaluate(async () => {
    await new Promise((done) => setTimeout(done, 200));
    const dock = document.querySelector('.sf-pagination-actions');
    if (!dock) return null;
    const style = getComputedStyle(dock);
    const root = document.querySelector('.sf-pagination');
    const rootBox = root.getBoundingClientRect();
    const dockBox = dock.getBoundingClientRect();
    return {
      rootPosition: getComputedStyle(root).position,
      left: Math.round(dockBox.left - rootBox.left),
      right: Math.round(rootBox.right - dockBox.right),
      shadow: style.boxShadow !== 'none',
      borderTop: style.borderBlockStartWidth,
      opaque: !/rgba\(0, 0, 0, 0\)/u.test(style.backgroundColor),
      last: dock === root.lastElementChild,
    };
  });
  if (!band) {
    note({case: 'bulk band', expected: 'a band once rows are marked'});
  } else {
    if (band.rootPosition === 'sticky') {
      note({case: 'bulk band', expected: 'the page row does not stick on its own'});
    }
    if (Math.abs(band.left) > 2 || Math.abs(band.right) > 2) {
      note({case: 'bulk band', got: band, expected: 'the full width of the row'});
    }
    if (!band.last) note({case: 'bulk band', expected: 'the last thing in the row'});
    if (!band.shadow) note({case: 'bulk band', expected: 'a shadow over the rows'});
    if (band.borderTop === '0px') note({case: 'bulk band', expected: 'a line where the band starts'});
    if (!band.opaque) note({case: 'bulk band', expected: 'an opaque surface'});
  }
  await card.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('PAGINATION_ROUND_2_OK');

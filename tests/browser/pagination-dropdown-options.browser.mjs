#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built bytes. A pagination with no page-sizes attribute offers the
// default sizes, and a later change of that attribute reaches the rows-per-page
// list -- the two things that were broken when Larena reported the list
// rendering empty. Since owner decision C97 (3) the compatible footer's rows
// per page are a quiet button «По 20 ▾» opening a menu of radio rows
// (sf-button + sf-menu-context), not an sf-dropdown: the probe opens that menu
// and reads its rows.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/menu-context/js/menu-context.js',
  'smart/smart/pagination/js/pagination.js',
];

const open = async (browser, markup) => {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html class="theme-light"><body>${markup}</body></html>`);
  for (const path of modules) await page.addScriptTag({path: join(out, path), type: 'module'});
  await page.waitForTimeout(600);
  return page;
};

// The rows per page: the quiet button opens its menu; the menu's radio rows
// are the sizes offered, the checked one the page size.
const readDropdown = async (page) => {
  const found = await page.evaluate(() => Boolean(document.querySelector('sf-pagination .sf-pagination-size button')));
  if (!found) return {found, value: null, options: null, strayChildren: 0};
  await page.evaluate(() => {
    const menu = document.querySelector('sf-pagination .sf-pagination-size-menu');
    if (menu?.open) menu.close?.({restoreFocus: false});
  });
  await page.click('sf-pagination .sf-pagination-size button');
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const host = document.querySelector('sf-pagination');
    const menu = host.querySelector('.sf-pagination-size-menu');
    const entries = Array.isArray(menu?.entries) ? menu.entries : null;
    return {
      found: true,
      value: entries?.find((entry) => entry.checked)?.id ?? null,
      options: entries ? entries.map((entry) => String(entry.id)) : null,
      rows: [...(menu?.querySelectorAll('[role="menuitemradio"]') ?? [])].map((row) => row.textContent.trim()),
      // Options travel as data, never as children the menu takes.
      strayChildren: menu ? Array.from(menu.children).filter((c) => c.tagName.toLowerCase() === 'sf-list-item').length : 0,
    };
  });
};

const failures = [];
const browser = await chromium.launch();
try {
  // 1. No page-sizes attribute at all: the default list, not a single zero.
  const plain = await open(browser, '<sf-pagination current="1" total="450" page-size="20"></sf-pagination>');
  const defaults = await readDropdown(plain);
  if (!defaults.found) failures.push({case: 'default sizes', expected: 'a rows-per-page button and menu'});
  else {
    if (String(defaults.options) !== String(['10', '20', '30', '40']))
      failures.push({case: 'default sizes', options: defaults.options, expected: '10, 20, 30 and 40'});
    if (defaults.rows.length !== 4)
      failures.push({case: 'default sizes', rows: defaults.rows, expected: 'four radio rows drawn'});
    if (defaults.value !== '20')
      failures.push({case: 'default sizes', value: defaults.value, expected: 'the page size it was given'});
  }
  await plain.close();

  // 2. A list given up front, then changed: the change has to arrive.
  const dynamic = await open(
    browser,
    '<sf-pagination current="1" total="450" page-size="20" page-sizes="10,20,30,40"></sf-pagination>',
  );
  const before = await readDropdown(dynamic);
  if (String(before.options) !== String(['10', '20', '30', '40']))
    failures.push({case: 'given sizes', options: before.options, expected: 'the sizes it was given'});
  if (before.strayChildren !== 0)
    failures.push({case: 'given sizes', strayChildren: before.strayChildren, expected: 'options travel as data'});

  await dynamic.evaluate(() => document.querySelector('sf-pagination').setAttribute('page-sizes', '15,25,35'));
  await dynamic.waitForTimeout(600);
  const after = await readDropdown(dynamic);
  if (String(after.options) !== String(['15', '25', '35']))
    failures.push({case: 'changed sizes', options: after.options, expected: '15, 25 and 35'});
  await dynamic.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('PAGINATION_DROPDOWN_OPTIONS_OK');

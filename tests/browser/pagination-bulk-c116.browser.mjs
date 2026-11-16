#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// C116 for the band of bulk actions sf-pagination still draws (until
// 2027-01-01): Apply is a regular button (outline on-surface), never the
// filled main one; while the chosen action deletes it is the outlined danger
// button, drawn anew as the choice changes; such an action is listed last;
// one press of Apply sends one sf-pagination-apply.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css',
  'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/pagination/css/pagination.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/input/js/input.js',
  'smart/smart/spinner/js/spinner.js',
  'smart/smart/menu-context/js/menu-context.js',
  'smart/smart/pagination/js/pagination.js',
].map((p) => join(out, p));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  // The actions are written with the deleting one first, and one more marked
  // by the danger flag alone, to see the order the band gives them.
  await page.setContent(`<!doctype html><html class="theme-light"><body style="margin:0"><div style="width:1100px">
    <sf-pagination id="p" top="false" total="120" selected-count="4"
      actions="delete:Удалить|archive:В архив|purge:Очистить::danger|export:Выгрузить"></sf-pagination></div></body></html>`);
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.applies = [];
    document.getElementById('p').addEventListener('sf-pagination-apply', (event) => window.applies.push(event.detail.action));
  });

  const look = () => page.evaluate(() => {
    const host = document.querySelector('#p .sf-pagination-actions sf-button');
    const button = host?.querySelector('button');
    if (!button) return null;
    const style = getComputedStyle(button);
    return {
      outline: button.classList.contains('sf-button--outline'),
      filled: button.classList.contains('sf-button--default'),
      primary: button.classList.contains('sf-button--primary'),
      onSurface: button.classList.contains('sf-button--on-surface'),
      danger: button.classList.contains('sf-button--danger'),
      background: style.backgroundColor,
      borderWidth: style.borderTopWidth,
    };
  });
  const choose = async (action) => {
    await page.evaluate((value) => document.getElementById('p').setAction(value), action);
    await page.waitForTimeout(250);
  };

  const order = await page.evaluate(() => (document.querySelector('#p .sf-pagination-actions sf-dropdown')?.options ?? []).map((option) => option.value));
  if (order.join(',') !== ',archive,export,delete,purge') {
    note({case: 'order', got: order, expected: 'the choice, then archive, export, and the deleting delete, purge last'});
  }

  const regular = (got, kase) => {
    if (!got || !got.outline || got.filled || got.primary || !got.onSurface || got.danger || got.borderWidth === '0px' || got.background !== 'rgba(0, 0, 0, 0)') {
      note({case: kase, got, expected: 'Apply outline on-surface, no fill, no danger'});
    }
  };
  const dangerous = (got, kase) => {
    if (!got || !got.outline || got.filled || got.primary || !got.danger || got.borderWidth === '0px' || got.background !== 'rgba(0, 0, 0, 0)') {
      note({case: kase, got, expected: 'Apply outlined danger, no fill'});
    }
  };

  regular(await look(), 'rest (nothing chosen)');
  await choose('archive');
  regular(await look(), 'archive');
  await choose('delete');
  dangerous(await look(), 'delete');
  await choose('export');
  regular(await look(), 'export after delete (repaints back)');
  await choose('purge');
  dangerous(await look(), 'purge (danger flag)');
  await choose('');
  regular(await look(), 'back to nothing');

  for (const action of ['archive', 'delete', 'purge']) {
    await choose(action);
    await page.evaluate(() => { window.applies = []; });
    await page.locator('#p .sf-pagination-actions sf-button button').click();
    await page.waitForTimeout(250);
    const sent = await page.evaluate(() => window.applies.slice());
    if (sent.length !== 1 || sent[0] !== action) note({case: `one press, ${action}`, got: sent, expected: [action]});
  }
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('PAGINATION_BULK_C116_OK');

#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// C116 for the band of bulk actions sf-pagination draws (until 2027-01-01).
// Since 1.9.0 (C295) the band is sf-bulk-actions: every action is a regular
// button (outline on-surface), never the filled main one; up to three safe
// actions are labelled buttons and the deleting ones wait in «⋯», last and
// red; one press of an action sends one sf-pagination-apply with that action
// and asks nothing (the host asks its own question, confirm false).
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
  'smart/smart/progress-bar/js/progress-bar.js',
  'smart/smart/bulk-actions/js/bulk-actions.js',
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

  const bar = () => page.evaluate(() => {
    const host = document.querySelector('#p sf-bulk-actions');
    const root = host?.querySelector('.sf-bulk-actions');
    if (!root) return null;
    // sf-button hands its data attributes to its inner native button.
    const buttons = [...root.querySelectorAll('[data-sf-bulk-action]')].map((one) => {
      const button = one.localName === 'button' ? one : one.querySelector('button');
      const style = button ? getComputedStyle(button) : null;
      return {
        id: one.dataset.sfBulkAction,
        outline: Boolean(button?.classList.contains('sf-button--outline')),
        filled: Boolean(button?.classList.contains('sf-button--default')),
        primary: Boolean(button?.classList.contains('sf-button--primary')),
        danger: Boolean(button?.classList.contains('sf-button--danger')),
        background: style?.backgroundColor ?? null,
      };
    });
    return {
      shown: !root.hidden,
      count: root.querySelector('.sf-bulk-actions__count')?.textContent.trim() ?? '',
      buttons,
    };
  });

  const shown = await bar();
  if (!shown || !shown.shown) {
    note({case: 'bar', got: shown, expected: 'sf-bulk-actions drawn while four rows are marked'});
  } else {
    const ids = shown.buttons.map((one) => one.id);
    if (ids.join(',') !== 'archive,export,more,clear') {
      note({case: 'order', got: ids, expected: 'archive, export labelled; delete and purge in «⋯»; the clear cross'});
    }
    for (const one of shown.buttons.filter((button) => button.id === 'archive' || button.id === 'export')) {
      if (!one.outline || one.filled || one.primary || one.danger || one.background !== 'rgba(0, 0, 0, 0)') {
        note({case: `look ${one.id}`, got: one, expected: 'outline on-surface, no fill, no danger (C116)'});
      }
    }
  }

  // «⋯» lists the dangerous ones last, after a line, marked danger.
  const menu = await page.evaluate(() => {
    const entries = [];
    window.SF = window.SF || {};
    const owner = window.SF.menu;
    window.SF.menu = {...(owner || {}), open: (options) => { entries.push(...(options.entries ?? [])); return Promise.resolve(null); }};
    document.querySelector('#p [data-sf-bulk-action="more"]').click();
    window.SF.menu = owner;
    return entries.map((entry) => (entry.type === 'separator' ? '|' : `${entry.id}${entry.status === 'danger' ? '!' : ''}`));
  });
  if (menu.join(',') !== 'delete!,purge!') {
    note({case: 'more menu', got: menu, expected: 'delete and purge, both danger (C295 (2))'});
  }

  for (const action of ['archive', 'delete', 'purge']) {
    await page.evaluate(() => { window.applies = []; });
    await page.evaluate((id) => document.querySelector('#p sf-bulk-actions').pressAction(id), action);
    await page.waitForTimeout(250);
    const sent = await page.evaluate(() => window.applies.slice());
    const asked = await page.evaluate(() => Boolean(document.querySelector('sf-modal')));
    if (sent.length !== 1 || sent[0] !== action) note({case: `one press, ${action}`, got: sent, expected: [action]});
    if (asked) note({case: `no question, ${action}`, expected: 'sf-pagination\'s actions ask nothing (confirm false)'});
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

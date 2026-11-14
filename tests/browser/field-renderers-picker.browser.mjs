#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The record picker -- sf-input-lookup since owner decision C139 (1) -- against
// the cases that break pickers, measured with the consumer's own numbers: 448
// targets, pages of 20, a record no page showed; and the deprecated
// {picker: 'dropdown'} path kept until 2027-01-01.
//
// The harness is the host: it holds 448 records, answers a page at a time and
// takes the write. That is the interface a record view will implement, and the
// consumer's own port already has this shape for the table's filter.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/dropdown/css/dropdown.css',
  'component/component/buttons/css/buttons.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/spinner/js/spinner.js',
  'smart/smart/tag/js/tag.js', 'smart/smart/avatar/js/avatar.js', 'smart/smart/input-lookup/js/input-lookup.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 900, height: 900}});
  await page.setContent(
    '<!doctype html><html class="theme-light" lang="ru"><body style="margin:0">'
    + '<div id="host" style="width:520px"></div></body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForTimeout(1300);

  const measured = await page.evaluate(async () => {
    const set = window.SF?.fieldRenderers;
    const {render} = window.SF || {};
    if (!set?.renderEditField || !render) return {missing: true, sf: Object.keys(window.SF || {})};
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));

    // 448 targets, as on the consumer's stand.
    const records = Array.from({length: 448}, (_, index) => ({
      value: `record-${String(index).padStart(4, '0')}`,
      label: index === 317 ? 'Решение о платежах' : `Решение ${index}`,
    }));
    const field = {key: 'linked_solution', label: 'Связанное решение', propertyType: 'record'};
    const state = {value: null, page: null, search: '', asked: []};
    let options;
    const host = {
      getFieldValue: () => state.value,
      setFieldValue: (item, next) => { state.value = next; draw(); },
      getFieldOptionsPage: () => state.page,
      getFieldOptionSearch: () => state.search,
      setFieldOptionSearch: (item, text) => { state.search = text; },
      // Pages of 20; the next page replaces the one held, as the consumer's port does.
      loadFieldOptions: (item, {cursor, search}) => {
        state.asked.push({cursor, search});
        const matching = search
          ? records.filter((record) => record.label.toLowerCase().includes(String(search).toLowerCase()))
          : records;
        const from = cursor ? Number(cursor) : 0;
        const items = matching.slice(from, from + 20);
        const next = from + 20 < matching.length ? String(from + 20) : null;
        state.page = {status: 'ready', items, nextCursor: next, total: matching.length};
        draw();
      },
    };
    const holder = document.getElementById('host');
    const draw = () => render(set.renderEditField(field, state.value, host, options), holder);
    const rows = () => [...holder.querySelectorAll('sf-input-lookup [role=option]')].map((row) => row.querySelector('.sf-lookup-option-label')?.textContent.trim());

    draw();
    await wait(400);
    const lookup = holder.querySelector('sf-input-lookup');
    const beforeLoad = {control: lookup ? 'sf-input-lookup' : null, dropdown: Boolean(holder.querySelector('sf-dropdown')), asked: state.asked.length};

    // C139 (3): a focus in the empty field asks the host for its first page.
    lookup?.querySelector('.sf-lookup-input')?.focus();
    await wait(500);
    const firstPage = {options: rows().length, hasMore: Boolean(holder.querySelector('.sf-lookup-more')), asked: state.asked.slice()};

    // The next page joins the first, asked for by Show more.
    holder.querySelector('.sf-lookup-more')?.click();
    await wait(500);
    const secondPage = {options: rows().length, distinct: new Set(rows()).size, asked: state.asked.length};

    // Searching reaches a record that no page has shown.
    lookup?.search('платеж');
    await wait(600);
    const searched = {options: rows().length, labels: rows().slice(0, 3)};

    // Choosing it writes the resolved object back, label included.
    [...holder.querySelectorAll('sf-input-lookup [role=option]')]
      .find((node) => /Решение о платежах/u.test(node.textContent))
      ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await wait(400);
    const afterChoice = {written: state.value, box: holder.querySelector('sf-input-lookup .sf-lookup-input')?.value};

    // The deprecated path: {picker: 'dropdown'} draws the searchable dropdown until 2027-01-01.
    options = {picker: 'dropdown'};
    draw();
    await wait(400);
    const deprecated = {dropdown: Boolean(holder.querySelector('sf-dropdown')), search: holder.querySelector('sf-dropdown')?.getAttribute('search'), lookup: Boolean(holder.querySelector('sf-input-lookup'))};

    return {beforeLoad, firstPage, secondPage, searched, afterChoice, deprecated, asked: state.asked};
  });

  if (measured.missing) {
    note({case: 'the set is reachable', got: measured, expected: 'window.SF.fieldRenderers on the page'});
  } else {
    if (measured.beforeLoad?.control !== 'sf-input-lookup' || measured.beforeLoad?.dropdown) {
      note({case: 'the picker is sf-input-lookup (C139 (1))', got: measured.beforeLoad, expected: 'sf-input-lookup, no dropdown'});
    }
    if (measured.firstPage?.options !== 20 || !measured.firstPage?.hasMore || measured.firstPage?.asked?.[0]?.search !== '') {
      note({case: 'a focus asks the first page', got: measured.firstPage, expected: '20 rows and Show more, asked with an empty search'});
    }
    if (measured.secondPage?.options !== 40 || measured.secondPage?.distinct !== 40) {
      note({case: 'Show more joins the next page', got: measured.secondPage, expected: '40 rows, none twice'});
    }
    if (measured.searched?.options !== 1 || !/Решение о платежах/u.test(measured.searched?.labels?.[0] ?? '')) {
      note({case: 'search reaches a record no page showed', got: measured.searched, expected: 'the one match'});
    }
    if (measured.afterChoice?.written?.value !== 'record-0317'
        || measured.afterChoice?.written?.label !== 'Решение о платежах' || measured.afterChoice?.box !== 'Решение о платежах') {
      note({case: 'choosing writes the resolved object', got: measured.afterChoice,
        expected: 'the value and the label, the box shows the label'});
    }
    if (!measured.deprecated?.dropdown || measured.deprecated?.search !== 'true' || measured.deprecated?.lookup) {
      note({case: 'the deprecated dropdown path', got: measured.deprecated, expected: 'a searchable sf-dropdown for {picker: dropdown}'});
    }
  }

  console.error(JSON.stringify(measured, null, 1));
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('FIELD_RENDERERS_PICKER_OK');

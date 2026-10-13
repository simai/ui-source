#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The record picker, against the three cases that break pickers, measured with
// the consumer's own numbers: 448 targets, pages of 20, and a chosen record that
// is not on the page in front of you.
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
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/checkbox/js/checkbox.js',
  'smart/smart/list-item/js/list-item.js', 'smart/smart/inputs/js/inputs.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/spinner/js/spinner.js',
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

    // 448 targets, as on the consumer's stand.
    const records = Array.from({length: 448}, (_, index) => ({
      value: `record-${String(index).padStart(4, '0')}`,
      label: index === 317 ? 'Решение о платежах' : `Решение ${index}`,
    }));
    const field = {key: 'linked_solution', label: 'Связанное решение', propertyType: 'record'};
    const state = {value: null, page: null, search: '', asked: []};
    const host = {
      getFieldValue: () => state.value,
      setFieldValue: (item, next) => { state.value = next; },
      getFieldOptionsPage: () => state.page,
      getFieldOptionSearch: () => state.search,
      setFieldOptionSearch: (item, text) => { state.search = text; },
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
    const draw = () => render(set.renderEditField(field, state.value, host), holder);

    draw();
    await new Promise((done) => setTimeout(done, 300));
    const beforeLoad = {
      control: holder.querySelector('sf-dropdown') ? 'sf-dropdown' : null,
      search: holder.querySelector('sf-dropdown')?.getAttribute('search'),
      options: holder.querySelectorAll('sf-dropdown .sf-list-item').length,
    };

    // A first page.
    host.loadFieldOptions(field, {cursor: null, search: ''});
    await new Promise((done) => setTimeout(done, 400));
    const firstPage = {
      options: holder.querySelectorAll('.sf-list-item').length,
      hasMore: Boolean([...holder.querySelectorAll('sf-button')].find((b) => b.getAttribute('text') === 'Загрузить ещё')),
    };

    // The next page, by pressing the control the picker offers.
    [...holder.querySelectorAll('sf-button')]
      .find((button) => button.getAttribute('text') === 'Загрузить ещё')
      ?.querySelector('button')?.click();
    await new Promise((done) => setTimeout(done, 450));
    const secondPage = {options: holder.querySelectorAll('.sf-list-item').length, asked: state.asked.length};

    // Searching reaches a record that no page has shown.
    host.loadFieldOptions(field, {cursor: null, search: 'платеж'});
    await new Promise((done) => setTimeout(done, 400));
    const searched = {
      options: holder.querySelectorAll('.sf-list-item').length,
      labels: [...holder.querySelectorAll('.sf-list-item')].map((node) => node.textContent.trim()).slice(0, 3),
    };

    // Choosing it writes the resolved object back, label included.
    const option = [...holder.querySelectorAll('.sf-list-item')]
      .find((node) => /Решение о платежах/u.test(node.textContent));
    (option?.querySelector('input, button') ?? option)?.click();
    await new Promise((done) => setTimeout(done, 400));
    const afterChoice = {written: state.value};

    // And the chosen record stays visible when the page no longer holds it.
    host.loadFieldOptions(field, {cursor: null, search: 'Решение 1'});
    await new Promise((done) => setTimeout(done, 400));
    const offPage = {
      pageHolds: (state.page.items || []).some((item) => item.value === 'record-0317'),
      shown: [...holder.querySelectorAll('.sf-list-item')]
        .some((node) => /Решение о платежах/u.test(node.textContent)),
      stillWritten: state.value?.value,
    };

    return {beforeLoad, firstPage, secondPage, searched, afterChoice, offPage, asked: state.asked};
  });

  if (measured.missing) {
    note({case: 'the set is reachable', got: measured, expected: 'window.SF.fieldRenderers on the page'});
  } else {
    if (measured.beforeLoad?.control !== 'sf-dropdown' || measured.beforeLoad?.search !== 'true') {
      note({case: 'the picker is a searchable dropdown', got: measured.beforeLoad, expected: 'a dropdown with search'});
    }
    if (measured.firstPage?.options !== 20 || !measured.firstPage?.hasMore) {
      note({case: 'a page at a time', got: measured.firstPage, expected: '20 options and an offer of more'});
    }
    if (measured.secondPage?.options !== 20) {
      note({case: 'the next page replaces the first', got: measured.secondPage,
        expected: 'another page of 20, asked for by the control'});
    }
    if (measured.searched?.options !== 1 || !/Решение о платежах/u.test(measured.searched?.labels?.[0] ?? '')) {
      note({case: 'search reaches a record no page showed', got: measured.searched, expected: 'the one match'});
    }
    if (measured.afterChoice?.written?.value !== 'record-0317'
        || measured.afterChoice?.written?.label !== 'Решение о платежах') {
      note({case: 'choosing writes the resolved object', got: measured.afterChoice,
        expected: 'the value and the label the host already knew'});
    }
    if (measured.offPage?.pageHolds !== false || measured.offPage?.shown !== true
        || measured.offPage?.stillWritten !== 'record-0317') {
      note({case: 'the chosen record stays visible off its page', got: measured.offPage,
        expected: 'shown and still chosen while the page does not hold it'});
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

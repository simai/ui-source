import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Smart Datepicker uses real Lit refs and exposes its date-value states', async () => {
  const [source, template] = await Promise.all([
    read('src/smart/datepicker/index.js'),
    read('src/smart/datepicker/js/templates/default.js'),
  ]);
  assert.doesNotMatch(template, /:ref=/);
  assert.match(template, /ref\(context\.component\.refs\.input\)/);
  assert.match(template, /aria-label=\$\{day\.label\}/);
  assert.match(template, /aria-current=\$\{day\.today/);
  assert.match(source, /'sf-datepicker-change'/);
  assert.match(source, /get closeOnSelect\(\)/);
  assert.match(source, /getBooleanAttr\('mask', false\)/);
});

test('Datepicker keyboard and calendar navigation are source-owned', async () => {
  const source = await read('src/smart/datepicker/index.js');
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /shiftMonth\(direction = 1\)/);
  assert.match(source, /window\.visualViewport/);
  assert.match(source, /requestAnimationFrame\(\(\) => this\._input\?\.focus/);
});

test('Datepicker surface and controls use semantic radius and typography tokens', async () => {
  const [surface, day, text] = await Promise.all([
    read('src/component/datepicker/scss/_css_datepicker.scss'),
    read('src/component/datepicker/scss/_css_day.scss'),
    read('src/component/datepicker/scss/_css_datepicker-text.scss'),
  ]);
  assert.match(surface, /var\(--sf-radius--surface\)/);
  assert.match(day, /var\(--sf-radius--ui\)/);
  assert.match(text, /var\(--sf-radius--ui\)/);
  assert.match(day, /var\(--sf-text--size\)/);
  assert.match(day, /:focus-visible/);
  assert.doesNotMatch(surface, /\b(?:8|4|9999)px\b/);
});

test('Datepicker distinguishes weekend, disabled and continuous selection paint', async () => {
  const [surface, day, text, variants] = await Promise.all([
    read('src/component/datepicker/scss/_css_datepicker.scss'),
    read('src/component/datepicker/scss/_css_day.scss'),
    read('src/component/datepicker/scss/_css_datepicker-text.scss'),
    read('src/component/datepicker/scss/_css_datepicker_custom.scss'),
  ]);

  assert.match(surface, /sf-datepicker-day-off:not\(:disabled\):not\(\.active\):not\(\.disabled\)/);
  assert.match(surface, /--sf-datepicker-day-date--color: var\(--sf-error\)/);
  assert.match(surface, /var\(--sf-transparent\)/);
  assert.match(day, /--sf-datepicker-day-date--color: var\(--sf-on-surface\)/);
  assert.match(day, /--sf-datepicker-day-info--color: var\(--sf-on-surface-variant\)/);
  assert.match(day, /\.sf-datepicker-day:is\(:disabled, \.disabled\)/);
  assert.match(variants, /another-month[\s\S]{0,700}--sf-datepicker-day-date--color: var\(--sf-on-surface-variant\)/);
  assert.doesNotMatch(variants, /--sf-datepicker-another-month--opacity: var\(--sf-opacity-50\)/, 'half opacity read 3.3:1');
  assert.match(variants, /--sf-datepicker-day-date--color: var\(--sf-on-primary-container\)/);
  assert.match(variants, /--sf-datepicker-text--border-end-end-radius/);
  assert.match(text, /--sf-datepicker-text--border-end-end-radius/);
  assert.doesNotMatch(variants, /opacity:\s*0\.5/);
});

test('Datepicker focus is keyboard-visible and system-color compatible', async () => {
  const [day, text, rule] = await Promise.all([
    read('src/component/datepicker/scss/_css_day.scss'),
    read('src/component/datepicker/scss/_css_datepicker-text.scss'),
    read('src/component/datepicker/rule.js'),
  ]);

  assert.match(day, /:focus:not\(:focus-visible\)/);
  assert.match(text, /:focus:not\(:focus-visible\)/);
  assert.match(day, /forced-colors: active/);
  assert.match(text, /outline-color: Highlight/);
  assert.match(rule, /regex: \/\(\?:\^\|\["'/);
  assert.match(rule, /js: false/);
});

test('Datepicker documentation preserves distinct states and continuous ranges', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, kinds, range, disabled, months] = await Promise.all([
    readUiDoc('content/ru/components/forms/datepicker.md'),
    readUiDoc('examples/components/datepicker/day-kinds/index.html'),
    readUiDoc('examples/components/datepicker/state-range/index.html'),
    readUiDoc('examples/components/datepicker/state-disabled/index.html'),
    readUiDoc('examples/components/datepicker/text-cells/index.html'),
  ]);

  for (const id of ['day-kinds', 'state-range', 'state-disabled', 'text-cells']) {
    assert.ok(page.includes(`components/datepicker/${id}`));
  }
  // A day off and an unavailable date are different states: the day off stays
  // selectable, unavailability is the native disabled state.
  assert.match(page, /выходной остаётся\s+доступным для выбора/);
  assert.match(page, /Нативный `disabled`/);
  assert.match(kinds, /sf-datepicker-day-off[^>]*aria-label="\d+ [а-я]+ 2026, выходной"(?![^>]*disabled)/);
  assert.match(disabled, /class="sf-datepicker-day (?![^"]*sf-datepicker-day-off)[^"]*"[^>]*aria-label="\d+ сентября 2026, недоступно" disabled/);
  assert.doesNotMatch(disabled, /sf-datepicker-day-off[^>]*aria-label="(?![^"]*выходной)[^"]*недоступно"/);
  assert.match(range, /sf-datepicker-day-start[^>]*aria-pressed="true"/);
  assert.match(range, /sf-datepicker-day-end[^>]*aria-pressed="true"/);
  // A month range is one continuous band: no gap between its cells, and each
  // cell in the range reports that it is selected.
  assert.match(months, /<div class="grid grid-col-3">\s*<button class="sf-datepicker-text[^"]*"/);
  assert.match(months, /sf-datepicker-text-start[^>]*aria-pressed="true"/);
  assert.match(months, /sf-datepicker-text-selected[^>]*aria-pressed="true"/);
  assert.match(months, /sf-datepicker-text-end[^>]*aria-pressed="true"/);
});

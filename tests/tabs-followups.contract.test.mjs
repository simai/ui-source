// sf-tabs 1.3.0 follow-ups (2026-11-12): R191 HS-10 and HS-15, R184 T4 and
// T7, «Ещё» sums the errors it holds, and the row on the shared row engine.
// Measured on the released pair with the branch's tabs sheet and bundle by
// ui-control control/evidence/2026-11-12-tabs-followups (probe/followups.probe.mjs).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {fitBesideMore, fitInOrder} from '../src/core/js/overflow-row.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/tabs/index.js');
const template = read('src/smart/tabs/js/templates/default.js');
const sheet = read('src/component/tabs/scss/_css__tabs.scss');
const manifest = JSON.parse(read('src/smart/tabs/component.json'));
const joinClasses = (...tokens) => tokens.flat().filter(Boolean).join(' ');

const parseItems = vm.runInNewContext(
  `${source.slice(source.indexOf('function parseItems'), source.indexOf('function normalizeIndex'))}\nparseItems;`,
);
const errorBadgeClasses = new Function('joinClasses',
  `${template.slice(template.indexOf('export function errorBadgeClasses'), template.indexOf('function renderErrorBadge')).replace(/^export /u, '')}\nreturn errorBadgeClasses;`)(joinClasses);

test('HS-10: the gap is no raw ladder value and the label keeps no inset of its own (C99)', () => {
  const spacing = sheet.slice(sheet.indexOf('// An underline tab is a control of its size'), sheet.indexOf("// The tab's own font is its size's text role"));
  assert.ok(spacing.length > 0);
  assert.doesNotMatch(spacing, /--sf-c[026]\b/u);
  assert.match(sheet, /--sf-tabs-gap, var\(--sf-space-0\)/u);
  // The count sits a quarter space after the label (was --sf-a6).
  assert.match(sheet, /\.sf-tabs-count \{[^}]*margin-inline-start: var\(--sf-space-1\\\/4\);/u);
});

test('HS-15: the docs markup "::icon=home" and the "::icon-start=home" form draw their own icon', () => {
  const icons = template.split("if(context.variant !== 'icons')")[1].split('<sf-button-icon')[1].split('>')[0];
  const draw = new Function('item', 'nothing', `return ${icons.match(/icon=\$\{([^}]+)\}/u)[1]};`);
  const computed = (items) => items.map((item) => ({...item, iconStart: item.iconStart ?? (item.iconLeft || item.icon || ''), iconEnd: item.iconEnd ?? (item.iconRight || '')}));
  const drawn = (items) => computed(parseItems(items)).map((item) => draw(item, null)).join();
  assert.equal(drawn('Обзор::icon=home|История::icon=history'), 'home,history');
  assert.equal(drawn('Главная::icon-start=home|Почта::icon-end=mail'), 'home,mail');
});

test('T4: an icon tab of a strip of links is an <a> in the icon button\'s class form', () => {
  assert.match(template, /\} else if \(context\.links\) \{\s*return renderIconLink\(item, context\);/u);
  const link = template.slice(template.indexOf('function renderIconLink'), template.indexOf('function renderTab('));
  assert.match(link, /return html`<a\n/u);
  assert.match(link, /'sf-icon-button', `sf-icon-button--size-\$\{size\}`, 'sf-icon-button--icon', 'sf-icon-button--default'/u);
  assert.match(link, /href=\$\{item\.disabled \? nothing : item\.href\}/u);
  assert.match(link, /aria-label=\$\{item\.label\}/u);
  assert.match(link, /aria-current=\$\{item\.selected \? 'page' : nothing\}/u);
  assert.match(link, /aria-disabled=\$\{item\.disabled \? 'true' : nothing\}/u);
  assert.match(link, /icon=\$\{item\.iconStart \|\| item\.icon \|\| item\.iconEnd \|\| nothing\}/u);
  // The row finds it as a target, and measures it as its own box.
  assert.match(source, /element\.matches\('\[role="tab"\], a\.sf-icon-button'\) \? element : null/u);
});

test('T7: a tab\'s errors are sf-badge line="text" in its class form, a figure round', () => {
  assert.equal(errorBadgeClasses(2), 'sf-badge sf-badge--tonal sf-badge--error sf-badge--size-1/3 sf-badge--line-text sf-badge--figure inline-flex flex-row flex-nowrap justify-center items-center');
  assert.doesNotMatch(errorBadgeClasses(12), /sf-badge--figure/u);
  assert.match(template, /\$\{renderErrorBadge\(item\.errors, 'sf-tabs-errors'\)\}<span class="sf-tabs-said">/u);
  assert.match(template, /aria-hidden="true"><span\s+class="sf-badge-text-container flex items-center"><span class="sf-badge-text">/u);
  assert.doesNotMatch(sheet, /\.sf-tabs-count\.sf-tabs-count--error/u);
  assert.match(sheet, /\.sf-tabs-errors,\s*\.sf-tabs-more-errors \{\s*margin-inline-start: var\(--sf-space-1\\\/4\);/u);
  assert.ok(manifest.relations.some((relation) => relation.name === 'badges' && !relation.lazy));
});

test('«Ещё» sums the errors of the tabs it holds, says them, and lays the row out with the badge', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  assert.match(layout, /if \(this\.syncMoreErrors\(more, this\.errorsOf\(this\._overflowed\)\)\) \{\s*laid = place\(\);/u);
  assert.match(layout, /more\.setAttribute\('aria-label', errors \? `\$\{text\}, \$\{this\.errorWords\(errors\)\}` : text\);/u);
  const errorsOf = new Function(`return function ${source.slice(source.indexOf('  errorsOf(indices = []) {') + 2, source.indexOf('\n  }\n', source.indexOf('  errorsOf(indices = []) {')) + 4)}`)();
  assert.equal(errorsOf.call({computedItems: [{errors: 0}, {errors: 2}, {errors: 0}, {errors: 3}]}, [2, 3]), 3);
  assert.equal(errorsOf.call({computedItems: [{errors: 1}]}, []), 0);
  for (const size of ['1\\\\/2', '1', '2']) {
    assert.match(sheet, new RegExp(`\\.sf-tabs-more > \\.sf-button\\.sf-button--size-${size} > \\.sf-badge\\.sf-tabs-more-errors \\{\\s*--sf-badge--line-height: var\\(--sf-text-height-${size}\\);`, 'u'));
  }
});

test('the row is laid out by the shared row engine, by the same rules', () => {
  assert.match(source, /from '\.\.\/\.\.\/core\/js\/overflow-row\.js';/u);
  assert.doesNotMatch(source, /function textWidth\(/u);
  assert.match(source, /standardMenu\(field, select\) \{\s*return standardMenu\(this, field, select\);/u);
  // C54: in order up to the first that does not fit; the current one stays.
  assert.deepEqual(fitInOrder([50, 50, 50], 0, 120), [0, 1]);
  assert.equal(fitInOrder([50, 50], 0, 100.4), null);
  const laid = fitBesideMore({widths: [60, 60, 60, 60], gap: 0, room: 200, must: [3], current: 3, extra: () => 20});
  assert.deepEqual(laid.kept, [0, 1, 3]);
  assert.equal(laid.squeezed, -1);
  assert.equal(fitBesideMore({widths: [300, 60], room: 200, must: [0], current: 0}).squeezed, 0);
});

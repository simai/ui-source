import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pagination 1.5.0: decision C97 (owner, 2026-11-12; ui-control
// control/research/2026-11-12-pagination.md, prototypes/pagination-study.html).
// The element is page navigation only, in five appearances; the footer parts
// it drew before (range, page size, Show more, band) are a compatible footer
// of an element without appearance until 2027-01-01. The methods are read out
// of the component and run on a plain object (the element needs a browser);
// the browser half is the group-build probes P6-P9 of the evidence.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/pagination/index.js');
const markup = read('src/smart/pagination/js/templates/default.js');
const sheet = read('src/component/pagination/scss/_css__pagination.scss');
const component = JSON.parse(read('src/smart/pagination/component.json'));
const en = JSON.parse(read('src/smart/pagination/lang/en.json'));
const ru = JSON.parse(read('src/smart/pagination/lang/ru.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));

const pageWindow = new Function(`${source.slice(source.indexOf('export function pageWindow')).replace('export ', '').split('\n}\n')[0]}\n}\nreturn pageWindow;`)();

// A getter of the class as a function of `self`.
function getter(name) {
  const start = source.indexOf(`\n  get ${name}() {\n`);
  assert.ok(start >= 0, `${name} is a getter of sf-pagination`);
  const open = source.indexOf('{\n', start);
  const end = source.indexOf('\n  }\n', open);
  return new Function('self', 'pageWindow', source.slice(open + 2, end).replace(/this\b/gu, 'self'));
}
// One method, as in tests/pagination-study-defects.contract.test.mjs, with the
// module's noteDeprecated in scope.
function method(name, scope = {}) {
  const start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `${name} is a method of sf-pagination`);
  const open = source.indexOf(') {\n', start);
  const params = source.slice(start + name.length + 4, open);
  const end = source.indexOf('\n  }\n', open);
  const body = source.slice(open + 4, end);
  return new Function('self', 'noteDeprecated', 'FOOTER_SINCE', 'FOOTER_UNTIL', `return function (${params}) {${body.replace(/this\b/gu, 'self')}};`)(
    scope.self, scope.noteDeprecated ?? (() => {}), '2026-11-12', '2027-01-01');
}
const words = (self, file = ru) => (key, {vars = {}} = {}) => String(file.runtime[key]).replace(/\{([a-z-]+)\}/gu, (_, name) => String(vars[name]));
const show = (places) => places.map((place) => (place === 'gap' ? '…' : place)).join(' ');

test('C97 point 1: five appearances, field the default; no appearance is the compatible footer', () => {
  assert.equal(component.version, '1.5.0');
  assert.deepEqual(component.settings.appearance.values, ['field', 'numbers', 'arrows', 'cursor', 'more']);
  assert.equal(component.settings.appearance.default, 'field');
  assert.match(source, /get footer\(\) \{\s*return !this\.hasAttribute\("appearance"\);/u);
  assert.match(markup, /const VIEWS = \{field: renderField, numbers: renderNumbers, arrows: renderArrows, cursor: renderCursor, more: renderMore\};/u);
  // Navigation only: an appearance draws its own view and nothing of the footer.
  assert.match(markup, /\$\{context\.footer \? renderFooter\(context, component\) : VIEWS\[appearance\]\(context, component\)\}/u);
  for (const view of ['renderField', 'renderNumbers', 'renderArrows', 'renderCursor', 'renderMore']) {
    const body = markup.slice(markup.indexOf(`function ${view}(`), markup.indexOf('\n}\n', markup.indexOf(`function ${view}(`)));
    assert.doesNotMatch(body, /renderRange|renderPageSize|renderBand|sf-dropdown/u, `${view} holds navigation only`);
  }
});

test('C97 numbers: up to seven places, five on a phone, the first and the last page always', () => {
  assert.equal(show(pageWindow(5, 12, 7)), '1 … 4 5 6 … 12');
  assert.equal(show(pageWindow(1, 12, 7)), '1 2 3 4 5 … 12');
  assert.equal(show(pageWindow(4, 12, 7)), '1 2 3 4 5 … 12');
  assert.equal(show(pageWindow(9, 12, 7)), '1 … 8 9 10 11 12');
  assert.equal(show(pageWindow(12, 12, 7)), '1 … 8 9 10 11 12');
  assert.equal(show(pageWindow(5, 12, 5)), '1 … 5 … 12');
  assert.equal(show(pageWindow(2, 12, 5)), '1 2 3 … 12');
  assert.equal(show(pageWindow(3, 6, 7)), '1 2 3 4 5 6', 'every page when they fit');
  // The row keeps its width while a person pages: always exactly seven places.
  for (let current = 1; current <= 40; current += 1) {
    assert.equal(pageWindow(current, 40, 7).length, 7, `page ${current} of 40`);
    assert.equal(pageWindow(current, 40, 5).length, 5, `page ${current} of 40 on a phone`);
    assert.ok(pageWindow(current, 40, 7).includes(current));
  }
  assert.match(source, /this\._sfNarrow = breakpointMedia\("sm", \{ below: true \}\);/u, 'five places below the sm step of the ladder');
  assert.match(source, /const slots = this\.narrow \? 5 : 7;/u);

  const slots = getter('pageSlots');
  const self = (over) => ({exactCount: true, total: 240, current: 5, pageCount: 12, countKnown: true, hasNextPage: false, narrow: false, ...over});
  assert.deepEqual(slots(self(), pageWindow).map((slot) => (slot.type === 'gap' ? '…' : slot.value)), [1, '…', 4, 5, 6, '…', 12]);
  assert.deepEqual(slots(self({narrow: true}), pageWindow).map((slot) => (slot.type === 'gap' ? '…' : slot.value)), [1, '…', 5, '…', 12]);
  assert.equal(slots(self(), pageWindow).filter((slot) => slot.selected).length, 1);
});

test('C97 numbers without an exact count: no last page to name, a gap while more follow', () => {
  const slots = (over) => new Function('self', 'pageWindow', source.slice(source.indexOf('\n  get pageSlots() {\n') + 22, source.indexOf('\n  }\n', source.indexOf('\n  get pageSlots() {\n'))).replace(/this\b/gu, 'self'))(
    {exactCount: false, countKnown: false, total: 0, pageCount: 1, hasNextPage: true, narrow: false, current: 5, ...over}, pageWindow);
  const shape = (list) => list.map((slot) => (slot.type === 'gap' ? '…' : slot.value)).join(' ');
  assert.equal(shape(slots()), '1 2 3 4 5 6 …', 'seven places: the next page has_next promises and a gap');
  assert.equal(shape(slots({current: 20})), '1 … 18 19 20 21 …');
  assert.equal(shape(slots({current: 3, hasNextPage: false})), '1 2 3', 'the last page read');
});

test('C97 numbers: links with href, the current page says aria-current, the gap is no control', () => {
  assert.match(markup, /const href = context\.href \? component\.pageHref\(slot\.value\) : "";/u);
  assert.match(markup, /aria-current=\$\{slot\.selected \? "page" : nothing\}/u);
  assert.match(markup, /slot\.selected \? "sf-button--tonal sf-button--primary sf-pagination-page--current" : "sf-button--ghost sf-button--link sf-button--on-surface"/u);
  // A place is as wide as the widest page number there is.
  assert.match(sheet, /\.sf-pagination \.sf-pagination-slot \{[^}]*inline-size: max\(var\(--sf-pagination--control-height\), calc\(var\(--sf-pagination--digits\) \* 1ch \+ 2 \* var\(--sf-pagination--space-x\)\)\);/u);
});

test('C97 point 4: the ends are disabled, not removed, in every appearance', () => {
  assert.doesNotMatch(markup, /\$\{context\.hasPrev\s*\?/u, 'no end is drawn only while it leads somewhere');
  assert.doesNotMatch(markup, /\$\{context\.hasNext\s*\?\s*html`\s*\$\{renderDirection/u);
  assert.equal((markup.match(/disabled: !context\.hasPrev,/gu) || []).length, 4, 'first, previous (field, numbers), Назад, В начало');
  assert.equal((markup.match(/disabled: !context\.hasNext,/gu) || []).length, 4, 'next, last, Далее, Дальше');
  assert.match(markup, /\?disabled=\$\{disabled\}/u);
  // The field is as wide as the longest page number: it does not grow as the pages do.
  assert.match(source, /fieldDigits: Math\.max\(String\(this\.current\)\.length, this\.exactCount \? String\(this\.pageCount\)\.length : 1, 1\),/u);
});

test('C97 field: «из 12» after the field, «из ~23» for an estimate, nothing without a count', () => {
  assert.equal(ru.runtime['of-pages'], 'из {count}');
  assert.equal(en.runtime['of-pages'], 'of {count}');
  assert.match(source, /ofPages: this\.countKnown\s*\? this\.sfWord\("of-pages", \{vars: \{count: this\.totalExact \? this\.pageCount : `~\$\{this\.pageCount\}`\}\}\)\s*: "",/u);
  assert.match(markup, /context\.ofPages \? html`<span class="sf-pagination-of" aria-hidden="true">\$\{context\.ofPages\}<\/span>`/u);
});

test('C97 arrows and cursor: «Назад · Страница 3 · Далее», «В начало · Дальше», never a last page', () => {
  assert.deepEqual([ru.runtime['previous-text'], ru.runtime['next-text'], ru.runtime['cursor-next-text'], ru.runtime['first-label']], ['Назад', 'Далее', 'Дальше', 'В начало']);
  const cursor = markup.slice(markup.indexOf('function renderCursor('), markup.indexOf('\n}\n', markup.indexOf('function renderCursor(')));
  assert.doesNotMatch(cursor, /kind: "last"|last\(context|renderPageField/u, 'a cursor list has no last page and no number');
  assert.match(cursor, /appearance: "outline",\s*scheme: "primary",/u);
  const arrows = markup.slice(markup.indexOf('function renderArrows('), markup.indexOf('\n}\n', markup.indexOf('function renderArrows(')));
  assert.match(arrows, /sf-pagination-place" role="status">\$\{context\.placeText\}/u);
  assert.doesNotMatch(arrows, /kind: "last"/u);
  // Text buttons are links with href (sf-button drops the address while disabled).
  assert.match(markup, /href=\$\{href \|\| nothing\}\s*rel=\$\{href && \(kind === "prev" \|\| kind === "next"\) \? kind : nothing\}/u);
});

test('C97 more: «Показать ещё 20», «Показано 40 из 240», a thin bar; the button goes at the end', () => {
  assert.equal(ru.runtime['show-more-count'], 'Показать ещё {count}');
  assert.equal(ru.runtime.shown, 'Показано {shown} из {total}');
  const more = markup.slice(markup.indexOf('function renderMore('), markup.indexOf('\n}\n', markup.indexOf('function renderMore(')));
  assert.match(more, /\$\{context\.hasNext\s*\?\s*html`[\s\S]*?<sf-button[\s\S]*?text=\$\{context\.showMoreCountText\}/u);
  assert.match(more, /<sf-progress-bar[\s\S]*?size="1\/3"[\s\S]*?text-position="none"/u);
  assert.doesNotMatch(more, /renderDirection|keyboard_arrow/u, 'never in one row with the arrows');
  const shown = getter('shown');
  assert.equal(shown({exactCount: true, total: 240, current: 2, pageSize: 20}), 40);
  assert.equal(shown({exactCount: true, total: 50, current: 3, pageSize: 20}), 50);
  assert.ok(component.relations.some((relation) => relation.name === 'cl-progress-bar'));
});

test('C97 point 2: the range «41–60 из 240» in place of «Всего: 240»', () => {
  const rangeText = getter('rangeText');
  const self = (over) => {
    const one = {current: 3, pageSize: 20, total: 240, countKnown: true, totalExact: true, exactCount: true, shownTotal: '240', counting: false, canCount: false,
      hasAttribute: () => false, totalLabel: 'Всего:', ...over};
    one.range = getter('range')(one);
    one.sfWord = words(one);
    return one;
  };
  assert.equal(rangeText(self()), '41–60 из 240');
  assert.equal(rangeText(self({current: 12, total: 230, shownTotal: '230'})), '221–230 из 230', 'the last page ends at the total');
  assert.equal(rangeText(self({totalExact: false, exactCount: false, shownTotal: '~450'})), '41–60 из ~450');
  assert.equal(rangeText(self({countKnown: false, exactCount: false})), '41–60 из многих');
  assert.equal(rangeText(self({total: 0})), '', 'an empty list has no range');
  assert.equal(rangeText(self({hasAttribute: (name) => name === 'total-label'})), 'Всего: 240', 'an author\'s total-label keeps the 1.4 line');
  assert.equal(en.runtime.range, '{from}–{to} of {total}');
});

test('C97 point 3: the page size is a quiet «По 20 ▾» button with a menu of radio rows', () => {
  assert.equal(ru.runtime['page-size-text'], 'По {size}');
  const size = markup.slice(markup.indexOf('function renderPageSize('), markup.indexOf('\n}\n', markup.indexOf('function renderPageSize(')));
  assert.match(size, /<sf-button[\s\S]*?appearance="ghost"[\s\S]*?scheme="on-surface"[\s\S]*?icon-end="arrow_drop_down"[\s\S]*?text=\$\{context\.pageSizeText\}[\s\S]*?aria-haspopup="menu"/u);
  assert.match(size, /<sf-menu-context[\s\S]*?popup[\s\S]*?@sf-menu-context-select=\$\{\(event\) => component\.choosePageSize\(event\)\}/u);
  assert.doesNotMatch(size, /sf-dropdown/u, 'no labelled select');
  const entries = [];
  let anchor = null;
  const menu = {set entries(list) { entries.push(...list); }, toggleFor(at) { anchor = at; }};
  const self = {pageSizes: [10, 20, 50], pageSize: 20, querySelector: () => menu, sfWord: words({})};
  const inner = {};
  method('togglePageSizeMenu', {self})({querySelector: () => inner});
  assert.deepEqual(entries.map(({id, text, kind, checked}) => [id, text, kind, checked]), [['10', 'По 10', 'radio', false], ['20', 'По 20', 'radio', true], ['50', 'По 50', 'radio', false]]);
  assert.equal(anchor, inner, 'the menu is placed against the button the host draws (display: contents)');
  const sizes = [];
  method('choosePageSize', {self: {setPageSize: (value) => sizes.push(value)}})({detail: {id: '50'}, currentTarget: {close() {}}});
  assert.deepEqual(sizes, [50]);
  assert.ok(component.relations.some((relation) => relation.name === 'cl-menu-context'));
});

test('C97 point 5: the footer is one row «41–60 из 240 · По 20 ▾ · ‹ [3] из 12 ›», Show more on its own line', () => {
  const footer = markup.slice(markup.indexOf('function renderFooter('), markup.indexOf('\n}\n', markup.indexOf('function renderFooter(')));
  // The markup keeps the 1.4 order the sf-view skeleton prints; the sheet puts the field last.
  assert.match(footer, /renderRange\(context, component\)[\s\S]*?sf-pagination-container[\s\S]*?renderField\(context, component\)[\s\S]*?renderPageSize\(context, component\)/u);
  assert.match(sheet, /\.sf-pagination \.sf-pagination-main > \.sf-pagination-left \{\s*flex: 1 1 auto;/u);
  assert.match(sheet, /\.sf-pagination \.sf-pagination-main > \.sf-pagination-container \{\s*order: 1;\s*margin-inline-start: auto;/u);
  // Show more is never in the row with the arrows.
  const main = footer.slice(footer.indexOf('<div class=${mainClasses}>'));
  assert.doesNotMatch(main.slice(0, main.indexOf('${context.bottom')), /showMore/u);
  assert.match(footer, /sf-pagination-top[\s\S]*?component\.showMore/u);
});

test('migration: what the footer keeps is noted once in SF.deprecations and recorded in the journal', () => {
  const notes = [];
  const self = {footer: true, top: true, hasNext: true, bottom: true, showActions: true, actions: [{value: 'a'}], selectedCount: 2,
    hasAttribute: (name) => name === 'total-label'};
  method('noteFooterParts', {self, noteDeprecated: (note) => notes.push(note)})();
  assert.deepEqual(notes.map(({kind, from, to}) => `${kind} ${from} -> ${to}`), [
    'value (none) -> field', 'setting top -> appearance="more"', 'setting actions -> sf-view', 'attribute total-label -> null',
  ]);
  assert.ok(notes.every((note) => note.component === 'sf-pagination' && note.since === '2026-11-12' && note.remove_after === '2027-01-01'));
  const quiet = [];
  method('noteFooterParts', {self: {...self, footer: false, hasAttribute: () => false}, noteDeprecated: (note) => quiet.push(note)})();
  assert.deepEqual(quiet, [], 'an element with an appearance keeps nothing for compatibility');
  for (const event of ['size-change', 'selection-clear', 'action-change', 'action-for-all-change', 'apply']) {
    assert.match(source, new RegExp(`this\\.noteFooterEvent\\("${event}"\\);\\s*this\\.sfEmit\\("${event}"`, 'u'));
  }
  for (const id of ['value-pagination-footer-parts-to-view', 'value-pagination-show-more-to-more', 'setting-pagination-band-to-view', 'attribute-pagination-footer-labels']) {
    const record = journal.records.find((one) => one.id === id);
    assert.ok(record, `${id} is recorded`);
    assert.equal(record.remove_after, '2027-01-01');
    assert.ok(record.items.every((item) => item.component === 'sf-pagination'));
  }
  // Every event name still sent: 8 of the vocabulary, 8 legacy (until 2026-12-01).
  assert.equal(Object.keys(component.events).length, 8);
  assert.equal(component.aliases.rows.filter((row) => row.kind === 'event').length, 8);
});

test('the words of 1.5.0 are in both languages', () => {
  for (const key of ['of-pages', 'range', 'range-many', 'page-size-text', 'previous-text', 'next-text', 'cursor-next-text', 'show-more-count', 'shown']) {
    assert.ok(key in ru.runtime && key in en.runtime, key);
    assert.ok(!component['x-words'].includes(key), `${key} is a runtime word, not a string setting`);
  }
});

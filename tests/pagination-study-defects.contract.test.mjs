import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pagination 1.4.0: the defects of the pagination study that stand without
// the split (ui-control control/research/2026-11-12-pagination.md, owner
// remark R182, decision C97). PG-05 narrow width, PG-10 links, address and
// title, PG-11 no last page without a count to ask for. The methods are read
// out of the component and run on a plain object, as the page-switcher test
// does: the element itself needs a browser.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/pagination/index.js');
const markup = read('src/smart/pagination/js/templates/default.js');
const sheet = read('src/component/pagination/scss/_css__pagination.scss');
const component = JSON.parse(read('src/smart/pagination/component.json'));
const en = JSON.parse(read('src/smart/pagination/lang/en.json'));
const ru = JSON.parse(read('src/smart/pagination/lang/ru.json'));

// One method of the class, as a function of `self`: its parameters and body.
function method(name) {
  const start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `${name} is a method of sf-pagination`);
  const open = source.indexOf(') {\n', start);
  const params = source.slice(start + name.length + 4, open);
  const end = source.indexOf('\n  }\n', open);
  const body = source.slice(open + 4, end);
  return new Function('self', 'globalThis', 'document', `return function (${params}) {${body.replace(/this\b/gu, 'self')}};`);
}
const bind = (self, name, scope = {}) => method(name)(self, scope.globalThis ?? globalThis, scope.document);

// The rule of the last-page button, from the template context.
const canJumpToLast = (self) => {
  const line = source.match(/canJumpToLast: ([^,]+),/u)[1];
  return new Function('self', `return ${line.replace(/this\b/gu, 'self')};`)(self);
};

test('PG-11: the last-page button is drawn only where the jump can be answered', () => {
  const host = (countKnown, totalExact, canCount) => ({countKnown, totalExact, canCount, exactCount: countKnown && totalExact});
  assert.equal(canJumpToLast(host(true, true, false)), true, 'an exact count');
  assert.equal(canJumpToLast(host(false, true, true)), true, 'no count, but one can be asked for');
  assert.equal(canJumpToLast(host(true, false, true)), true, 'an estimate the host can count');
  assert.equal(canJumpToLast(host(false, true, false)), false, 'a cursor list: no count and none to ask for');
  assert.equal(canJumpToLast(host(true, false, false)), false, 'an estimate the host cannot count (gate 29)');
  assert.doesNotMatch(source, /!this\.countKnown,\s*$/mu);
  assert.match(markup, /\(context\.canJumpToLast\s*\?\s*renderDirection\(context, \{\s*kind: "last",/u);
});

test('PG-10: three settings, all off by default, and the word of the title', () => {
  assert.equal(component.version, '1.5.1');
  assert.deepEqual(
    [component.settings.href.type, component.settings.href.default],
    ['string', ''],
  );
  assert.deepEqual([component.settings['page-param'].type, component.settings['page-param'].default], ['string', '']);
  assert.deepEqual([component.settings['page-in-title'].type, component.settings['page-in-title'].default], ['boolean', false]);
  assert.equal(en.runtime['title-page'], 'Page {page}');
  assert.equal(ru.runtime['title-page'], 'Страница {page}');
});

test('PG-10: with href the arrows are links, prev and next say rel', () => {
  const self = {href: '?page={page}&size={page-size}', pageSize: 20};
  self.pageHref = bind(self, 'pageHref');
  assert.equal(self.pageHref(3), '?page=3&size=20');
  assert.equal(self.pageHref(null), '', 'no page to name (an estimate\'s last page): a button');
  assert.equal(self.pageHref(0), '');
  assert.equal(bind({href: '', pageSize: 20}, 'pageHref')(3), '', 'no template: buttons, as before');

  // At an end the link keeps its place with no address (C97 point 4).
  assert.match(markup, /<a\s[\s\S]*?href=\$\{href \|\| nothing\}[\s\S]*?aria-disabled=\$\{href \? nothing : "true"\}[\s\S]*?rel=\$\{href && \(kind === "prev" \|\| kind === "next"\) \? kind : nothing\}/u);
  assert.match(markup, /@click=\$\{\(event\) => \(href \? context\.component\.followLink\(event, page\) : event\.preventDefault\(\)\)\}/u);
  // The link wears the ghost, on-surface icon button that sf-button-icon draws.
  assert.match(markup, /sf-icon-button sf-icon-button--size-\$\{size\} sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface/u);
  assert.match(sheet, /\.sf-pagination a\.sf-pagination-link \{\s*text-decoration: none;/u);
});

test('PG-10: a link press is reported cancelable; a cancel keeps the browser here', () => {
  const calls = [];
  const self = {href: '?page={page}', pageSize: 20, goToPage: (page, options) => { calls.push([page, options]); return {outcome: 'applied', taken: true}; }};
  self.pageHref = bind(self, 'pageHref');
  const follow = bind(self, 'followLink');
  let prevented = false;
  follow({button: 0, preventDefault: () => { prevented = true; }}, 4);
  assert.deepEqual(calls, [[4, {link: true}]]);
  assert.equal(prevented, true, 'the host took the move in place');

  calls.length = 0;
  follow({button: 0, metaKey: true, preventDefault() {}}, 4);
  follow({button: 1, preventDefault() {}}, 4);
  assert.deepEqual(calls, [], 'a new tab or window is the browser\'s alone');
  assert.match(source, /link \? \{ cancelable: true \} : \{\}/u);
});

// DEV's intent acceptance (2026-11-14) returned PG-10: «next» showed
// ?page=4 and opened ?page=5 on a click and on Enter. The move drew the
// arrows of page 4 (next → 5) before the browser read the link's href. A
// followed link now opens the address it showed, read before the move.
test('PG-10 return: a followed link opens the page its href showed', () => {
  const assigned = [];
  const scope = {globalThis: {location: {assign: (href) => assigned.push(href)}}};
  const self = {href: '?page={page}&size={page-size}', pageSize: 20, current: 3};
  self.pageHref = bind(self, 'pageHref');
  // The move re-renders: the template now names the page after the new one.
  self.goToPage = (page) => { self.current = page; return {outcome: 'applied'}; };
  const follow = bind(self, 'followLink', scope);
  for (const [from, page] of [[3, 4], [4, 3], [3, 1], [3, 12], [1, 2], [12, 11]]) {
    self.current = from;
    assigned.length = 0;
    let prevented = false;
    follow({button: 0, preventDefault: () => { prevented = true; }}, page);
    assert.deepEqual(assigned, [`?page=${page}&size=20`], `from ${from} the link to ${page} opens ${page}`);
    assert.equal(prevented, true, 'the browser does not follow the re-rendered href');
  }

  // Taken in place by the host: nothing is opened.
  assigned.length = 0;
  self.goToPage = () => ({outcome: 'applied', taken: true});
  follow({button: 0, preventDefault() {}}, 4);
  assert.deepEqual(assigned, []);

  // Refused (the current page): no move and no re-render, the browser keeps its default.
  self.goToPage = () => ({outcome: 'refused', reason: 'current'});
  let prevented = false;
  follow({button: 0, preventDefault: () => { prevented = true; }}, 3);
  assert.deepEqual([assigned, prevented], [[], false]);

  // The address is read before the move, in the source order.
  const body = source.slice(source.indexOf('\n  followLink('), source.indexOf('\n  }\n', source.indexOf('\n  followLink(')));
  assert.ok(body.indexOf('this.pageHref(page)') < body.indexOf('this.goToPage(page, { link: true })'));
});

test('PG-10: page-param reads the page from the address and writes a history entry', () => {
  const pushed = [];
  const scope = {
    globalThis: {
      location: {href: 'https://site.test/news/?q=a&page=3', search: '?q=a&page=3'},
      history: {state: null, pushState: (state, title, href) => pushed.push(href)},
    },
  };
  const self = {pageParam: 'page'};
  assert.equal(bind(self, 'addressPage', scope)(), 3);
  bind(self, 'writeAddress', scope)(4);
  bind(self, 'writeAddress', scope)(1);
  assert.deepEqual(pushed, ['https://site.test/news/?q=a&page=4', 'https://site.test/news/?q=a'], 'page 1 is the address without it');
  assert.equal(bind({pageParam: ''}, 'addressPage', scope)(), null, 'off: the address is not read');
  bind({pageParam: ''}, 'writeAddress', scope)(5);
  assert.equal(pushed.length, 2, 'off: the address is not written');

  const none = {globalThis: {location: {href: 'https://site.test/', search: ''}}};
  assert.equal(bind(self, 'addressPage', none)(), 1, 'no parameter is page 1');
  const bad = {globalThis: {location: {href: 'https://site.test/?page=x', search: '?page=x'}}};
  assert.equal(bind(self, 'addressPage', bad)(), null, 'a parameter that names no page is ignored');
  // Back and Forward follow the address, in the instance's scope.
  assert.match(source, /addEventListener\("popstate", \(\) => this\.followAddress\(\), \{ signal: this\.sfScope \}\)/u);
  assert.match(source, /if \(!address && \(!link \|\| taken\)\) this\.writeAddress\(next\);/u);
});

test('PG-10: page-in-title adds the page to the title and gives it back', () => {
  const document = {title: 'Новости'};
  const self = {pageInTitle: true, current: 3, sfWord: (key, {vars}) => `Страница ${vars.page}`};
  const scope = {document, globalThis: {document}};
  self.restoreTitle = bind(self, 'restoreTitle', scope);
  const apply = bind(self, 'applyTitle', scope);
  apply();
  assert.equal(document.title, 'Новости — Страница 3');
  self.current = 4;
  apply();
  assert.equal(document.title, 'Новости — Страница 4', 'not «— Страница 3 — Страница 4»');
  self.current = 1;
  apply();
  assert.equal(document.title, 'Новости', 'page 1 keeps the title');
  self.current = 2;
  apply();
  self.restoreTitle();
  assert.equal(document.title, 'Новости', 'a removed element gives the title back');
});

test('PG-05: a narrow screen keeps the page row a wrapping row, not a column', () => {
  const narrow = sheet.slice(sheet.indexOf('@media (max-width: map.get(bp.$breakpoint-array, md))'));
  assert.ok(narrow.length > 0);
  assert.doesNotMatch(narrow, /\.sf-pagination-main \{[^}]*flex-direction: column/u, 'the row is not stacked');
  assert.doesNotMatch(narrow, /\.sf-pagination-count[^{]*\{[^}]*flex-direction: column/u, 'the page size keeps its label beside it');
  assert.doesNotMatch(narrow, /inline-size: 100%/u, 'no part takes a line of its own by width');
  // The field ends its line at every width (C97 point 5 order: range, size, field).
  assert.match(sheet, /\.sf-pagination \.sf-pagination-main > \.sf-pagination-container \{\s*order: 1;\s*margin-inline-start: auto;/u);
  assert.match(narrow, /\.sf-pagination \.sf-pagination-pages-label \{\s*display: none;/u);
  // The page row wraps at every width, so what does not fit starts a line.
  assert.match(sheet, /\.sf-pagination \.sf-pagination-main \{\s*flex-wrap: wrap;/u);
});

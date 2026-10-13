import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

// The switcher is read out of the component rather than rendered, so the window
// itself is checked: the owner of the consumer stated it page by page.
const pageItems = async (current, pageCount, {countKnown = true, hasNextPage = false} = {}) => {
  const source = await read('src/smart/pagination/index.js');
  const body = source.slice(source.indexOf('get pageItems()'));
  const end = body.indexOf('\n  }\n');
  const code = body.slice(body.indexOf('{') + 1, end);
  const component = {total: pageCount * 10, current, pageCount, countKnown, hasNextPage};
  // eslint-disable-next-line no-new-func
  return new Function('component', code.replace(/this\./gu, 'component.'))(component);
};
const shape = (items) => items.map((item) => item.value);

// This file described a different switcher until 2026-10-04: pages 1 and 2, a
// gap that jumped into the middle of what it hid, and the two pages behind the
// current one — at most five places and never a page ahead. The owner of the
// consumer replaced it with a window around the page being read: the ends are
// reached by the first and last buttons, any page by the number field, and the
// numbers beside the current page are the ones a person actually reads. The old
// shape is recorded here so nobody restores it by analogy.
test('the window is five numbers around the page being read', async () => {
  assert.deepEqual(shape(await pageItems(1, 45)), [1, 2, 3, 4, 5]);
  assert.deepEqual(shape(await pageItems(2, 45)), [1, 2, 3, 4, 5]);
  assert.deepEqual(shape(await pageItems(5, 45)), [3, 4, 5, 6, 7], 'the current page sits in the middle');
  assert.deepEqual(shape(await pageItems(20, 45)), [18, 19, 20, 21, 22]);
  assert.deepEqual(shape(await pageItems(45, 45)), [41, 42, 43, 44, 45], 'and the window stops at the end');
  for (const current of [1, 2, 5, 20, 45]) {
    const items = await pageItems(current, 45);
    assert.equal(items.length, 5, `page ${current} keeps five places`);
    assert.deepEqual(items.filter((item) => item.selected).map((item) => item.value), [current]);
  }
});

test('a view shorter than the window shows only the pages it has', async () => {
  assert.deepEqual(shape(await pageItems(3, 4)), [1, 2, 3, 4]);
  assert.deepEqual(shape(await pageItems(1, 1)), [1]);
  assert.deepEqual(await pageItems(1, 0), [], 'and a view with nothing in it shows none');
});

test('without a count only the page that is known to exist is offered', async () => {
  // has_next says the next page is there; nothing says how many follow it, so
  // the window ends one past the current page and never guesses further.
  assert.deepEqual(
    shape(await pageItems(7, 0, {countKnown: false, hasNextPage: true})),
    [4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    shape(await pageItems(7, 0, {countKnown: false, hasNextPage: false})),
    [3, 4, 5, 6, 7],
  );
});

test('the ends are buttons, hidden where they lead nowhere', async () => {
  const markup = await read('src/smart/pagination/js/templates/default.js');

  assert.match(markup, /\$\{context\.hasPrev\s*\?\s*html`[\s\S]*?kind: "first",[\s\S]*?icon: "first_page",[\s\S]*?kind: "prev",/u);
  assert.match(markup, /\$\{context\.hasNext\s*\?\s*html`[\s\S]*?kind: "next",[\s\S]*?kind: "last",[\s\S]*?icon: "last_page",/u);
  // Each carries a tooltip and the same text as its accessible name.
  assert.match(
    markup,
    /function renderDirection\(context, \{kind, icon, label, page\}\) \{[\s\S]*?title=\$\{label\}[\s\S]*?aria-label=\$\{label\}/u,
  );
  // The gap that jumped into the middle of the hidden pages is gone with the
  // scheme it belonged to.
  assert.doesNotMatch(markup, /ellipsis/u);
});

test('the field takes any page and is held to the pages there are', async () => {
  const [source, markup] = await Promise.all([
    read('src/smart/pagination/index.js'),
    read('src/smart/pagination/js/templates/default.js'),
  ]);

  assert.match(markup, /class="sf-pagination-page-field flex items-cross-center"/u);
  // The field stands between the arrows now, in place of the row of numbers,
  // and its label is read rather than printed: a footer in one row has no space
  // for a second «Страница:» beside a field that already says which page it is.
  assert.doesNotMatch(markup, /<span>\$\{context\.pageFieldLabel\}<\/span>/u);
  assert.match(markup, /aria-label=\$\{context\.pageFieldLabel\}/u);
  assert.match(markup, /sf-pagination-item-field[\s\S]*?\$\{renderPageField\(context, component\)\}/u);
  assert.match(
    markup,
    /if \(event\.key !== "Enter"\) return;[\s\S]*?component\.goToTypedPage\(event\.target\?\.value\)/u,
    'Enter is what sends it',
  );
  // A number outside the range is brought back to it rather than refused: a
  // person typing 99 into a view of twelve pages means the end.
  assert.match(
    source,
    /goToTypedPage\(value\) \{[\s\S]*?return this\.goToPage\(Math\.min\(Math\.max\(parsed, 1\), Math\.max\(1, furthest\)\)\);/u,
  );
  assert.match(source, /firstPage\(\) \{\s*return this\.goToPage\(1\);/u);
});

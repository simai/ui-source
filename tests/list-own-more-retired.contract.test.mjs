import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-list 1.20.0, owner decision C167 (1): the end of a list is
// sf-pagination appearance="more" after it. The list's own «Показать ещё» and
// scroll request (has-more) keep working until 2027-01-01, noted once per
// element in SF.deprecations (journal attribute-list-has-more-to-pagination-more);
// the docs show sf-list with sf-pagination more.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/list/index.js');
const docs = read('src/smart/list/docs.md');
const component = JSON.parse(read('src/smart/list/component.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));

function method(name) {
  const start = source.indexOf(`\n    ${name}() {`);
  assert.ok(start >= 0, `method ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, at);
}

test('the own more button is noted once per element, dated 2027-01-01', () => {
  const notes = [];
  const ownMore = new Function('noteDeprecated', `return function () {${method('ownMore')}}`)((note) => notes.push(note));
  const list = {hasMore: true};
  assert.equal(ownMore.call(list), true);
  assert.equal(ownMore.call(list), true);
  assert.equal(ownMore.call({hasMore: false}), false);
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0], {component: 'sf-list', tag: 'sf-list', kind: 'attribute', from: 'has-more',
    to: 'sf-pagination appearance="more"', since: '2026-11-16', remove_after: '2027-01-01'});
  assert.match(source, /showMore: this\.ownMore\(\) && !loading,/u);
});

test('the contract, the journal and the docs say it', () => {
  assert.equal(component.version, '1.21.4'); // group build 9: 1.20.0 moved on by the merged branches or a GB9 patch // C282: 1.20.2 moved on by the language-file patch (Russian is a language file) // group build 10: 1.21.1 moved on by the merged branches or a GB10 patch
  for (const summary of [component.settings['has-more'].summary, component.events['load-more'].summary,
    component.actions['request-more'].summary, component.actions['more-failed'].summary]) {
    assert.match(summary, /^Deprecated until 2027-01-01 \(owner decision C167 \(1\)\)/u);
  }
  const record = journal.records.find((one) => one.id === 'attribute-list-has-more-to-pagination-more');
  assert.ok(record);
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items, [{component: 'sf-list', from: 'has-more', to: 'sf-pagination appearance="more"'}]);
  assert.match(docs, /<sf-list label="Письма"><\/sf-list>\n<sf-pagination appearance="more"/u);
  assert.doesNotMatch(docs, /setItems\(await api\.letters\(\), \{hasMore: true\}\)/u);
});

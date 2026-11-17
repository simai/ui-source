import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-list-feed 1.4.0, owner decision C167 (3) and (4): entries take sf-list's
// row fields date and unread. (3) The «Новые» line in primary before the first
// unread entry, whoever draws the entries. (4) The default entry reads
// «Автор · время».

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/list-feed/index.js');
const sheet = read('src/smart/list-feed/js/templates/default.css');
const component = JSON.parse(read('src/smart/list-feed/component.json'));

function block(start) {
  assert.ok(start >= 0);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, at);
}
const method = (name) => block(source.indexOf(`\n    ${name}(`));
const arrow = (name) => {
  const start = source.indexOf(`const ${name} = `);
  assert.ok(start >= 0, name);
  return new Function(`return ${source.slice(start + `const ${name} = `.length, source.indexOf('\n};', start) + 2)}`)();
};

// A small document: elements with classes, attributes, children and text.
class Node {
  constructor(name) { this.localName = name; this.attrs = {}; this.children = []; this.className = ''; this.nodeType = 1; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  append(...nodes) { for (const node of nodes) this.children.push(typeof node === 'string' ? {nodeType: 3, text: node} : node); }
  set textContent(value) { this.children = [{nodeType: 3, text: String(value)}]; }
  get text() { return this.children.map((child) => (child.nodeType === 3 ? child.text : child.text)).join(''); }
}
const doc = {createElement: (name) => new Node(name)};
const words = {'you-text': 'Вы', 'new-text': 'Новые'};

test('the contract: date and unread on entries, the word new-text, relations', () => {
  assert.equal(component.version, '1.5.3'); // group build 9: 1.4.0 moved on by the merged branches or a GB9 patch // C282: 1.4.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch
  assert.equal(component.settings.items.of.date.type, 'date');
  assert.equal(component.settings.items.of.unread.type, 'boolean');
  for (const lang of ['ru', 'en']) assert.ok(JSON.parse(read(`src/smart/list-feed/lang/${lang}.json`)).runtime['new-text']);
  assert.equal(JSON.parse(read('src/smart/list-feed/lang/ru.json')).runtime['new-text'], 'Новые');
  for (const name of ['group-heading', 'cl-time']) assert.ok(component.relations.some((one) => one.name === name), name);
});

test('(3) the first unread entry, not one\'s own, carries the line; the line is the divider in primary', () => {
  const unreadOf = arrow('unreadOf');
  assert.equal(unreadOf({unread: true}), true);
  assert.equal(unreadOf({unread: 2}), true);
  assert.equal(unreadOf({unread: 0}), false);
  assert.equal(unreadOf({unread: true, own: true}), false);
  assert.match(method('syncRuns'), /const unreadStart = items\.findIndex\(\(item\) => unreadOf\(item\.entry\)\);/u);
  assert.match(method('syncRuns'), /\|\| item\.flags\.unreadStart !== flags\.unreadStart/u);
  assert.match(method('draw'), /const node = item\.flags\.unreadStart \? this\.withNewLine\(drawn\) : drawn;/u);
  const withNewLine = new Function(`return function (content) {${method('withNewLine')}}`)();
  const entry = new Node('article');
  const box = withNewLine.call({ownerDocument: doc, sfWord: (key) => words[key]}, entry);
  const [line, kept] = box.children;
  assert.equal(line.className, 'sf-group-heading sf-group-heading--divider sf-list-feed__new');
  assert.equal(line.getAttribute('role'), 'separator');
  assert.equal(line.getAttribute('aria-label'), 'Новые');
  assert.equal(line.text, 'Новые');
  assert.equal(kept, entry);
  assert.match(sheet, /\.sf-list-feed__unread > \.sf-list-feed__new \{\s*color: var\(--sf-primary\);/u);
  assert.match(sheet, /\.sf-list-feed__new::after \{\s*background-color: var\(--sf-primary\);/u);
  assert.doesNotMatch(sheet, /--sf-group-heading-[a-z-]+\s*:/u, 'the divider\'s public variables are the page\'s');
});

test('(4) the default entry reads «Автор · время»', () => {
  const momentOf = arrow('momentOf');
  assert.equal(momentOf({date: '2026-11-16T09:30:00Z'}), '2026-11-16T09:30:00.000Z');
  assert.equal(momentOf({date: 'not a date'}), '');
  assert.equal(momentOf({}), '');
  const renderDefault = new Function('authorName', 'momentOf', `return function (entry, {first, own}) {${method('renderDefault')}}`)(
    (entry) => String(entry?.['author-name'] ?? ''), momentOf);
  const host = {ownerDocument: doc, sfWord: (key) => words[key]};
  const article = renderDefault.call(host, {'author-name': 'Анна', text: 'Готово', date: '2026-11-16T09:30:00Z'}, {first: true, own: false});
  const author = article.children[0];
  assert.equal(author.className, 'sf-list-feed__author');
  assert.equal(author.children[0].text, 'Анна');
  const time = author.children[1];
  assert.equal(time.className, 'sf-list-feed__time');
  assert.equal(time.children[0].text, ' · ');
  const element = time.children[1];
  assert.equal(element.localName, 'sf-time');
  assert.deepEqual(element.attrs, {datetime: '2026-11-16T09:30:00.000Z', format: 'auto', tooltip: 'none'});
  // No date: the author alone, as before.
  const plain = renderDefault.call(host, {'author-name': 'Анна', text: 'Готово'}, {first: true, own: false});
  assert.equal(plain.children[0].children.length, 1);
  // Not the first of a run: no author line.
  const next = renderDefault.call(host, {'author-name': 'Анна', text: 'Ещё', date: '2026-11-16T09:31:00Z'}, {first: false, own: false});
  assert.equal(next.children.length, 1);
  // C273: the ink stands in the sf.paint rule of the same selector (group build 10).
  assert.match([...sheet.matchAll(/\.sf-list-feed__time \{([^}]*)\}/gu)].map((match) => match[1]).join(''), /color: var\(--sf-on-surface-variant\);/u);
});

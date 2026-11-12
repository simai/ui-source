import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pager 1.3.0: decision C97 point 7 (owner, 2026-11-12). The neighbouring
// document in three looks, cards, row and counter; counter is the record
// card's «‹ 3 из 240 ›» across the list's pages, with keys and the way back to
// the list; steps (sf-wizard's) and course (no product) still draw until
// 2027-01-01, noted in SF.deprecations. The methods are read out of the
// component and run on a plain object; the browser half is probe P9.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/pager/index.js');
const markup = read('src/smart/pager/js/templates/default.js');
const component = JSON.parse(read('src/smart/pager/component.json'));
const ru = JSON.parse(read('src/smart/pager/lang/ru.json'));
const en = JSON.parse(read('src/smart/pager/lang/en.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));

function body(kind, name) {
  const head = kind === 'get' ? `\n  get ${name}() {\n` : `\n  ${name}(`;
  const start = source.indexOf(head);
  assert.ok(start >= 0, `${name} is in sf-pager`);
  const open = source.indexOf(') {\n', start);
  const end = source.indexOf('\n  }\n', open);
  return {params: kind === 'get' ? '' : source.slice(start + name.length + 4, open), code: source.slice(open + 4, end)};
}
const refused = (reason) => ({outcome: 'refused', reason});
const applied = () => ({outcome: 'applied'});
const run = (self, kind, name, ...args) => {
  const {params, code} = body(kind, name);
  return new Function('self', 'refused', 'applied', 'clampIndex', 'globalThis', `return (function (${params}) {${code.replace(/this\b/gu, 'self')}})`)(
    self, refused, applied, (value, length) => Math.max(0, Math.min(length - 1, Math.trunc(Number(value)) || 0)), {})(...args);
};
// A counter over a plain object: span and at as the element has them.
function counter(over = {}) {
  const self = {appearance: 'counter', list: [], current: 2, total: 0, hasNext: false, emitted: [], applied: [], ...over};
  Object.defineProperty(self, 'at0', {get: () => run(self, 'get', 'at0')});
  Object.defineProperty(self, 'span', {get: () => run(self, 'get', 'span')});
  Object.defineProperty(self, 'at', {get: () => run(self, 'get', 'at')});
  self.sfEmit = (name, detail) => { self.emitted.push([name, detail]); return !self.cancel; };
  self.apply = (index) => { self.applied.push(index); self.current = index; };
  return self;
}

test('version 1.3.0: three looks, steps and course still parse', () => {
  assert.equal(component.version, '1.3.0');
  assert.deepEqual(component.settings.appearance.values, ['cards', 'row', 'steps', 'course', 'counter']);
  assert.match(component.settings.appearance.summary, /Deprecated until 2027-01-01/u);
  for (const name of ['total', 'has-next', 'list-href']) assert.ok(component.settings[name], `${name} is a setting`);
});

test('counter walks the list across its pages: total, current in the whole list', () => {
  const self = counter({total: 240, current: 19, list: [{id: 'a', title: 'A', href: ''}]});
  assert.deepEqual(self.span, {count: 240, open: false});
  assert.deepEqual(run(self, 'method', 'moveRecord', 'next'), {outcome: 'applied'});
  assert.deepEqual(self.emitted[0], ['navigate', {direction: 'next', index: 20, id: null, href: null}], 'past the page it was opened from: the host loads it');
  assert.deepEqual(self.applied, [20]);
  self.current = 239;
  assert.deepEqual(run(self, 'method', 'moveRecord', 'next'), {outcome: 'refused', reason: 'last'});
  self.current = 0;
  assert.deepEqual(run(self, 'method', 'moveRecord', 'prev'), {outcome: 'refused', reason: 'first'});
  const kept = counter({total: 240, current: 5, cancel: true});
  assert.deepEqual(run(kept, 'method', 'moveRecord', 'next'), {outcome: 'refused', reason: 'prevented'}, 'a host that goes itself cancels');
  assert.deepEqual(kept.applied, []);
});

test('counter without a total: «3 из многих», next while has-next says so', () => {
  const self = counter({current: 2, hasNext: true});
  assert.equal(self.span.open, true);
  assert.deepEqual(run(self, 'method', 'moveRecord', 'next'), {outcome: 'applied'});
  self.hasNext = false;
  assert.deepEqual(run(self, 'method', 'moveRecord', 'next'), {outcome: 'refused', reason: 'last'});
  assert.equal(ru.runtime['position-many'], '{n} из многих');
  assert.equal(en.runtime['position-many'], '{n} of many');
  assert.match(source, /appearance === 'counter' \? \(open \? word\('position-many', \{n\}\) : word\('position', \{n, count\}\)\)/u);
});

test('counter: the way back to the list, quiet arrows, [ and ] as keys', () => {
  assert.equal(ru.runtime['to-list'], 'К списку');
  const view = markup.slice(markup.indexOf('function renderCounter('), markup.indexOf('\n}\n', markup.indexOf('function renderCounter(')));
  assert.match(view, /\$\{context\.listHref\s*\? html`<a class=\$\{`sf-pager-list sf-icon-button/u);
  assert.match(view, /href=\$\{context\.listHref\} title=\$\{words\.toList\} aria-label=\$\{words\.toList\}>\$\{icon\('arrow_back'\)\}/u);
  assert.equal((view.match(/appearance="ghost" scheme="on-surface"/gu) || []).length, 2, 'the record head\'s quiet arrows (prototype #pager-record)');
  assert.match(view, /\?disabled=\$\{!context\.hasNextRecord\}/u);
  assert.match(source, /if \(this\.appearance === 'counter' && \(event\.key === '\[' \|\| event\.key === '\]'\)\) \{/u);
  assert.ok(component.accessibility.keys.BracketLeft && component.accessibility.keys.BracketRight);
});

test('steps and course still draw, each use noted; the journal says where they go', () => {
  const notes = [];
  const {params, code} = body('method', 'noteRetired');
  const note = new Function('noteDeprecated', 'RETIRED', `return (function (${params}) {${code}})`)(
    (one) => notes.push(one), {steps: 'sf-wizard', course: null});
  note('steps');
  note('course');
  note('cards');
  assert.deepEqual(notes.map(({from, to, attribute, remove_after: until}) => [attribute, from, to, until]), [
    ['appearance', 'steps', 'sf-wizard', '2027-01-01'],
    ['appearance', 'course', null, '2027-01-01'],
  ]);
  assert.match(markup, /const VIEWS = \{cards: renderCards, row: renderRow, steps: renderSteps, course: renderCourse, counter: renderCounter\};/u);
  const record = journal.records.find((one) => one.id === 'value-pager-steps-course-retired');
  assert.ok(record);
  assert.deepEqual(record.items.map((item) => item.from), ['steps', 'course']);
});

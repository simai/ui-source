// Code block rows for a page that writes them at build time (component.highlight
// 1.10.0; DEV letter msg-dd9ece44, found while Docara moved its code blocks onto
// the Framework head, Docara PR 72): line marks are Framework classes of the row,
// and a number in data-lines is the first line's number.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {firstNumber} from '../src/component/highlight/js/line_numbers.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runtime = read('src/component/highlight/js/index.js');
const rows = read('src/component/highlight/js/line_numbers.js');
const defaults = read('src/component/highlight/scss/_default.scss');
const docs = read('src/component/highlight/docs/docs.md');
const CLASSES = ['added', 'removed', 'highlight', 'focus', 'prompt', 'output'];

test('every line mark is a class of the row the runtime writes', () => {
  for (const name of CLASSES) assert.match(rows, new RegExp(`\\['${name}', \\(mark\\) =>`, 'u'), name);
  assert.match(rows, /`sf-code-line--\$\{name\}`/u);
  assert.match(rows, /'sf-code-lines sf-code-lines--diff'/u);
  // The attributes the runtime wrote before stay.
  for (const key of ['lineDiff', 'lineMark', 'lineFocus', 'linePrompt', 'lineOutput']) assert.match(rows, new RegExp(`row\\.dataset\\.${key} =`, 'u'));
});

test('the stylesheet draws each class as its attribute', () => {
  for (const [name, attribute] of [['added', "[data-line-diff='add']"], ['removed', "[data-line-diff='remove']"], ['output', '[data-line-output]']]) {
    const selector = `.sf-code-line:is(.sf-code-line--${name}, ${attribute})`;
    assert.ok(defaults.includes(selector), selector);
    assert.ok(!defaults.includes(`.sf-code-line${attribute}`), `bare ${attribute} left`);
  }
  assert.ok(defaults.includes('.sf-code-line:is(.sf-code-line--highlight, .sf-code-line--focus, [data-line-mark], [data-line-focus])'));
  // Tokens only: the classes add no value of their own.
  assert.doesNotMatch(defaults, /\.sf-code-line--[a-z]+[^{]*\{[^}]*#[0-9a-f]{3}/iu);
});

test('a number in data-lines starts the numbering; data-start wins', () => {
  const fn = runtime.slice(runtime.indexOf('function lineStart'), runtime.indexOf('function ensureCodeId'));
  assert.match(fn, /\[blockOption\(block, 'data-start'\), blockOption\(block, 'data-lines'\), blockOption\(block, 'data-ln-start-from'\)\]/u);
  assert.match(runtime, /start: lineStart\(el\),/u);
  // data-lines and data-line-numbers are read from the code, its pre or the root.
  assert.match(runtime, /const lines = blockOption\(block, 'data-lines'\);/u);
  assert.match(runtime, /blockOption\(block, 'data-line-numbers'\) === 'true'/u);
  const element = (start, closest = null) => ({dataset: start === undefined ? {} : {start}, closest: () => closest});
  assert.equal(firstNumber(element(undefined), 40), 40);
  assert.equal(firstNumber(element('7'), undefined), 7);
  assert.equal(firstNumber(element(undefined, {dataset: {start: '12'}}), undefined), 12);
  assert.equal(firstNumber(element(undefined), undefined), 1);
  assert.equal(firstNumber(element('x'), undefined), 1);
  assert.equal(firstNumber(element('-3'), undefined), 1);
  // A number wider than the column widens it for every row.
  assert.match(rows, /table\.style\.setProperty\('--sf-code-line--number-size', `\$\{digits\}ch`\)/u);
});

test('the docs teach the classes and the start number', () => {
  for (const name of CLASSES) assert.match(docs, new RegExp(`\`sf-code-line--${name}\``, 'u'), name);
  assert.match(docs, /`data-lines="40"`/u);
  assert.match(docs, /1\.10\.0/u);
});

test('the boot script leaves a [!name] in code to the highlighter (C258)', () => {
  const boot = read('src/core/js/index.js');
  const hide = boot.slice(boot.indexOf('const hideShortCodes'), boot.indexOf('const isObserverIgnored'));
  assert.match(hide, /if \(node\.parentElement\?\.closest\?\.\('pre, code, script, style'\)\) continue;/u);
});

test('the number column holds three digits plus its room', () => {
  assert.match(defaults, /min-inline-size: calc\(var\(--sf-code-line--number-size, 3ch\) \+ var\(--sf-space-1\\\/2\)\);/u);
});

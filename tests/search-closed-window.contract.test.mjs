import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-search 1.10.3 (ui-pro K-1/K-2 acceptance, N2, 2026-11-16): a key that
// reaches the window's field after the window closed -- a host that closes it
// from a capture listener of the same key, a key typed during the close --
// found the portal gone and threw (getComputedStyle of null); an Enter there
// would have chosen a row of a closed list. Every handler the window's
// template binds returns at once while the window is not shown, and the
// direction is read without the portal.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'src/smart/search/index.js'), 'utf8');
const template = readFileSync(resolve(root, 'src/smart/search/js/templates/default.js'), 'utf8');

const body = (name) => {
  const start = source.search(new RegExp(`\\n  ${name}\\([^)]*\\) \\{\\n`, 'u'));
  assert.ok(start >= 0, `${name} is defined`);
  const open = source.indexOf('{\n', start);
  const end = source.indexOf('\n  }\n', open);
  return source.slice(open + 2, end);
};
const firstLines = (name, count) => body(name).split('\n').map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//')).slice(0, count).join('\n');

const HANDLERS = ['onInput', 'onFieldKeydown', 'onRowActionsKeydown', 'onScopeSelect', 'onStateAction', 'onRowClick',
  'hover', 'onClearPress', 'onBackPress', 'onTab'];

test('shown() is the window open with its portal mounted', () => {
  assert.match(body('shown'), /return this\.isOpen && Boolean\(this\._portal\);/u);
});

test('every handler the window binds returns while the window is not shown', () => {
  for (const name of HANDLERS) {
    assert.match(firstLines(name, 3), /if \([^\n]*!this\.shown\(\)[^\n]*\) (?:return|\{)/u, `${name} guards a closed window`);
  }
});

test('the guarded list covers the event handlers of the template', () => {
  const bound = new Set([...template.matchAll(/@(?:input|keydown|pointermove|click|sf-tag-group-select|sf-empty-state-action)=\$\{[^}]*?component\.(\w+)\(/gu)]
    .map((match) => match[1]));
  for (const name of ['onInput', 'onFieldKeydown', 'onRowActionsKeydown', 'onScopeSelect', 'onStateAction', 'onRowClick', 'hover']) {
    assert.ok(bound.has(name), `${name} is bound by the template`);
  }
});

test('a closed window still takes the keys the field always took', () => {
  assert.match(body('onFieldKeydown'), /if \(!this\.shown\(\)\) \{[\s\S]*?if \(event\.key === 'Enter' \|\| event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'\) event\.preventDefault\(\);\s*return;\s*\}/u);
});

test('the direction is never read from a removed portal', () => {
  assert.doesNotMatch(source, /getComputedStyle\(this\._portal\)/u);
  assert.match(body('rtl'), /const node = this\._portal \?\? this;/u);
  assert.match(body('rtl'), /node\.isConnected \?/u);
});

test('the note of 1.10.3 names the fix', () => {
  const component = JSON.parse(readFileSync(resolve(root, 'src/smart/search/component.json'), 'utf8'));
  assert.equal(component.version, '1.13.0'); // group build 9: 1.10.3 moved on by the merged branches or a GB9 patch // C282: 1.10.4 moved on by the language-file patch (Russian is a language file) // group build 10: 1.11.1 moved on by the merged branches or a GB10 patch // group build 14: 1.12.0 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.ok(component['x-decisions'].some((note) => note.startsWith('version 1.10.3') && /closed/u.test(note)));
});

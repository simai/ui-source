import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/component/tab/js/_tabs.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/component/tab/scss/_css__sf_tab.scss', import.meta.url), 'utf8');
const rule = await readFile(new URL('../src/component/tab/rule.js', import.meta.url), 'utf8');
const docs = await readFile(new URL('../src/component/tab/docs/docs.md', import.meta.url), 'utf8');

test('legacy Tab synchronizes one tab owner with one indexed panel', () => {
  assert.match(source, /setAttribute\('role', 'tablist'\)/);
  assert.match(source, /setAttribute\('role', 'tab'\)/);
  assert.match(source, /setAttribute\('role', 'tabpanel'\)/);
  assert.match(source, /toggleAttribute\('hidden', !active\)/);
  assert.match(source, /aria-controls/);
  assert.match(source, /aria-labelledby/);
});

test('legacy Tab supports concise initial state, disabled items and complete horizontal keyboard', () => {
  assert.match(source, /getAttribute\('data-active'\)/);
  assert.match(source, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /aria-disabled/);
  assert.match(source, /sf:tab-change/);
});

test('legacy Tab is live, instance-safe and does not double-own modern Tabs', () => {
  assert.match(source, /new WeakSet\(\)/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /closest\(ROOT_SELECTOR\) === root/);
  assert.match(rule, /sf-tab\(\?:\\s\|\["'\]\)/);
  assert.doesNotMatch(rule, /regex: \/sf-tab\//);
});

test('legacy Tab presentation uses Framework tokens and documents its compatibility boundary', () => {
  assert.match(css, /var\(--sf-focus--width\)/);
  assert.match(css, /var\(--sf-focus--color\)/);
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:px|rem|em)\b/);
  assert.match(docs, /presentation only/);
  assert.match(docs, /New interfaces should use the `Tabs` component/);
});

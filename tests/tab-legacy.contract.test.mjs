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

// Owner decision C263 (2026-11-16): sf-tab is deprecated, sf-tabs replaces it.
// The class is a C187 (8) retired class; SF.Tab is a dated alias whose read is
// noted in SF.deprecations, with the journal's dates in the public JS contract.
test('C263: SF.Tab is a dated alias of the journal, noted on read, replaced by sf-tabs', async () => {
  const journal = JSON.parse(await readFile(new URL('../contracts/changes/journal.json', import.meta.url), 'utf8'));
  const record = journal.records.find((entry) => entry.id === 'global-sf-tab-to-sf-tabs');
  assert.ok(record, 'journal global-sf-tab-to-sf-tabs');
  assert.equal(record.stage, 'compat');
  assert.equal(record.deprecated_on, '2026-11-16');
  assert.equal(record.remove_after, '2027-01-01');
  assert.deepEqual(record.items.map(({from, to}) => [from, to]), [['SF.Tab', 'sf-tabs']]);
  const retired = journal.records.find((entry) => entry.id === 'class-c187-retired-parts');
  assert.ok(retired.items.some(({from, to}) => from === 'sf-tab' && to === 'sf-tabs'), 'the class is retired to sf-tabs');
  const api = JSON.parse(await readFile(new URL('../src/core/contracts/public-js-api.json', import.meta.url), 'utf8'));
  const entry = api.globals.find((item) => item.name === 'SF.Tab');
  assert.deepEqual(entry.deprecated, {since: '2026-11-16', remove_after: '2027-01-01', journal: 'global-sf-tab-to-sf-tabs', to: 'sf-tabs'});
  assert.match(source, /SF_TAB_ALIAS = Object\.freeze\(\{since: '2026-11-16', remove_after: '2027-01-01'\}\)/u);
  assert.match(source, /get\(\) \{\s*noteDeprecated\(\{component: 'tab', kind: 'global', from: 'SF\.Tab', to: 'sf-tabs', \.\.\.SF_TAB_ALIAS\}\);/u);
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gmu, ''), /window\.SF\.Tab\s*\|\|/u, 'the file never reads its own alias');
  const passport = JSON.parse(await readFile(new URL('../src/component/tab/passport.json', import.meta.url), 'utf8'));
  assert.match(passport.summary, /^Deprecated .*C263.*sf-tabs.*2027-01-01/u);
  assert.match(docs, /Deprecated \(owner decision C263, 2026-11-16\)/u);
});

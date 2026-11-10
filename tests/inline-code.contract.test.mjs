import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Code in running text (owner, 2026-11-07, docs review R024, rule C10): the
// Gravity UI geometry, the neutral tone, the public variables and copy on
// click as an opt-in. The built look is measured by
// tests/browser/inline-code.browser.mjs; this holds the source to the decision.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = await read('src/core/scss/_sf_css__typograpy.scss');
const contract = JSON.parse(await read('src/core/contracts/public-variables.v1.json'));
const entry = contract.components.find(({component}) => component === 'code');

const rootValue = (name) => sheet.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'mu'))?.[1].trim();
const rule = sheet.slice(sheet.indexOf('code:where(:not('), sheet.indexOf('[data-sf-code-copy] code'));

test('the defaults are the decision: neutral plate, .2em .4em, 85 %, a 6px corner, mono', () => {
  assert.equal(rootValue('--sf-code--background'), 'var(--sf-surface-container)');
  assert.equal(rootValue('--sf-code--color'), 'var(--sf-on-surface)');
  assert.equal(rootValue('--sf-code--padding'), '0.2em 0.4em');
  assert.equal(rootValue('--sf-code--font-size'), '85%');
  // 6px is the a6 step of the one size ladder; the radius ladder has 4 and 8.
  assert.equal(rootValue('--sf-code--radius'), 'var(--sf-a6)');
  assert.equal(rootValue('--sf-code--font-family'), 'var(--sf-mono)');
});

test('the public variables are in the contract, read first, and default to the same values', () => {
  assert.ok(entry, 'code is a component of the public-variables contract');
  const names = entry.variables.map(({name}) => name).sort();
  assert.deepEqual(names, ['--sf-code-background-color', '--sf-code-color', '--sf-code-font-family', '--sf-code-font-size', '--sf-code-padding', '--sf-code-radius']);
  for (const variable of entry.variables) {
    // --sf-code-background-color (C16) reads its former name --sf-code-background under it.
    const former = variable.name === '--sf-code-background-color' ? '--sf-code-background' : null;
    const internal = (former ?? variable.name).replace('--sf-code-', '--sf-code--');
    assert.equal(variable.default, rootValue(internal), `${variable.name} documents the default it falls back to`);
    const read = former ? `var(${variable.name}, var(${former}, var(${internal})))` : `var(${variable.name}, var(${internal}))`;
    assert.ok(rule.includes(read), `${variable.name} is read by the running-text rule`);
  }
});

test('code wraps as text: inline, no nowrap, a run longer than the line breaks (C10)', () => {
  // Inline keeps the no-break with the punctuation around it and the line's
  // height; break-word (not anywhere) keeps a table's columns at whole words.
  assert.doesNotMatch(rule, /display:/u);
  assert.doesNotMatch(rule, /white-space:\s*nowrap;/u);
  assert.match(rule, /overflow-wrap:\s*break-word;/u);
  // In a table cell a long value breaks anywhere, so it never widens the
  // table (C10 variant A, owner 2026-11-11); no nowrap in a cell either.
  assert.match(sheet, /:where\(td, th\) code:where\(:not\([^{]+\{\s*overflow-wrap:\s*anywhere;\s*\}/u);
  assert.doesNotMatch(sheet, /:where\(td, th\)[^{]*\{[^}]*white-space:\s*nowrap/u);
  // The words of a cell stay whole: the cell resets the table's break-word.
  assert.match(sheet, /:where\(td, th\) \{\s*word-break:\s*normal;\s*overflow-wrap:\s*break-word;\s*\}/u);
});

test('the tones come from existing roles only: no palette of their own', () => {
  for (const role of ['--sf-secondary', '--sf-tertiary-container', '--sf-on-tertiary-container', '--sf-highlight-keyword']) {
    assert.ok(entry.variables.some(({summary}) => summary.includes(role)), `${role} is named as a tone`);
  }
  assert.doesNotMatch(sheet, /--sf-code-[a-z-]*(?:primary|secondary|tertiary|keyword)[a-z-]*\s*:/u, 'no tone variable is declared');
});

test('copy on click is opt-in and says what sf-button-copy says', async () => {
  const module = await read('src/core/js/code-copy.js');
  const index = await read('src/core/js/index.js');
  assert.match(index, /import '\.\/code-copy\.js';/u);
  // The base sheet never makes code a control: only the container attribute does.
  assert.match(sheet, /\[data-sf-code-copy\] code\[data-sf-code-copy-target\]/u);
  assert.doesNotMatch(rule, /cursor/u);
  assert.match(module, /from '\.\/clipboard\.js'/u, 'the copy and its fallback are core\'s copyText');
  assert.doesNotMatch(module, /from '\.\.\/\.\.\/smart\//u, 'core does not import a Smart component');
  // The words are sf-button-copy's.
  const {WORDS} = await import('../src/core/js/code-copy.js');
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(await read(`src/smart/button-copy/lang/${locale}.json`)).runtime;
    for (const key of ['copy', 'copied', 'selected']) assert.equal(WORDS[locale][key], words[key], `${locale}.${key}`);
  }
});

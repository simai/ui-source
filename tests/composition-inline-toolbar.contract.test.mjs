import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { INLINE_ENTER_MODES, INLINE_TOOLBAR_MODES, linkProblem, startInlineEdit, wordAround } from '../src/core/js/composition/inline-editor.mjs';

// simai/ui-source#67 and owner decision C172 (2026-11-14): the formatting
// toolbar of an edit shows only over a selection (the default) or for the
// whole session; Enter saves or, in a block editor, starts the next block;
// the link window names the reason an address is refused. The behaviour in a
// browser is tests/browser/composition-inline-toolbar.browser.mjs and
// composition-inline-editor.browser.mjs.

test('the toolbar modes are selection, the default, and session', () => {
  assert.deepEqual(INLINE_TOOLBAR_MODES, ['selection', 'session']);
  assert.ok(Object.isFrozen(INLINE_TOOLBAR_MODES));
});

test('Enter saves, or starts a new block where the host asks (C172 (2))', () => {
  assert.deepEqual(INLINE_ENTER_MODES, ['save', 'new-block']);
  assert.ok(Object.isFrozen(INLINE_ENTER_MODES));
});

const fakeElement = () => {
  class FakeElement {
    constructor() { this.touched = []; }
    hasAttribute(name) { this.touched.push(name); return false; }
  }
  return FakeElement;
};

test('an unknown toolbar mode or Enter mode is refused before the element is touched', () => {
  const saved = globalThis.Element;
  const FakeElement = fakeElement();
  globalThis.Element = FakeElement;
  try {
    let element = new FakeElement();
    assert.throws(() => startInlineEdit(element, { toolbar: 'always' }), /inline_toolbar_unknown: always/u);
    assert.deepEqual(element.touched, ['data-sf-inline-editing'], 'nothing drawn, nothing changed');
    element = new FakeElement();
    assert.throws(() => startInlineEdit(element, { enter: 'split' }), /inline_enter_unknown: split/u);
    assert.deepEqual(element.touched, ['data-sf-inline-editing'], 'nothing drawn, nothing changed');
  } finally {
    globalThis.Element = saved;
  }
});

test('a refused link address names its reason (C172 (4))', () => {
  for (const ok of ['https://simai.io', 'http://a.b/c', 'mailto:a@b.c', 'tel:+70000000000', '/about', '#top', './x', '../y']) assert.equal(linkProblem(ok), null, ok);
  assert.equal(linkProblem(''), 'link-empty');
  assert.equal(linkProblem('javascript:alert(1)'), 'link-scheme');
  assert.equal(linkProblem('ftp://files.test/'), 'link-scheme');
  assert.equal(linkProblem('example.com'), 'link-start');
  assert.equal(linkProblem('https://a b.c'), 'link-spaces');
  assert.equal(linkProblem('//evil.test'), 'link-slashes');
  assert.equal(linkProblem('/\\evil.test'), 'link-slashes');
  assert.equal(linkProblem(`https://a.test/${'x'.repeat(2100)}`), 'link-long');
});

test('Ctrl/⌘+K with no selection takes the word under the caret (IE-3)', () => {
  const content = [{ type: 'text', value: 'Доставка по городу — ' }, { type: 'text', value: 'бесплатно', marks: ['strong'] }];
  assert.deepEqual(wordAround(content, 15), [12, 18]);
  assert.deepEqual(wordAround(content, 12), [12, 18], 'at the start of a word');
  assert.deepEqual(wordAround(content, 18), [12, 18], 'at its end');
  assert.equal(wordAround(content, 20), null, 'beside the dash: no word');
  assert.deepEqual(wordAround(content, 25), [21, 30], 'a word across marks counts by its text');
  assert.deepEqual(wordAround([{ type: 'text', value: 'mail-merge, ok' }], 2), [0, 10], 'a hyphen joins a word');
});

test('C172 is sf-editor-inline 1.9.0: its edit action, its script API, its words and its sheet', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const manifest = JSON.parse(await read('src/smart/editor-inline/component.json'));
  // 1.5.0: the toolbar is the overlay place (C20); 1.6.0 it declares a popup place (C16); 1.6.1 one above the released 1.5.3; 1.6.2 its sheet takes back --sf-surface-underlay (C43); 1.6.3 the C16 role names; 1.7.0 Shift+Enter break, strike (F2.1), unknown marks survive, atoms never in a link (F1); 1.8.0 the language files (C177, fix/localization-lc); 1.9.0 C172; 1.10.1 the toolbar is one Tab stop through core's roving helper (C184).
  assert.equal(manifest.version, '1.11.2'); // group build 7: the integrated number (the branch wrote 1.10.1) // group build 8: 1.11.1 moved on by the merged branches or a GB8 patch
  assert.match(manifest.actions.edit.summary, /toolbar \(selection: [^)]+the default; session: [^)]+\)/u);
  assert.match(manifest.actions.edit.summary, /enter \(save: [^)]+; new-block: [^)]+\)/u);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['icon-buttons', 'icons', 'cl-input', 'cl-button', 'cl-menu-context']);
  assert.match(await read('src/smart/editor-inline/index.js'), /SF\.InlineEditor = Object\.freeze\(\{[^}]*INLINE_ENTER_MODES[^}]*INLINE_TOOLBAR_MODES[^}]*linkProblem/u);
  for (const locale of ['ru', 'en']) {
    const words = JSON.parse(await read(`src/smart/editor-inline/lang/${locale}.json`)).runtime;
    for (const key of ['link-hint', 'link-empty', 'link-scheme', 'link-start', 'link-spaces', 'link-slashes', 'link-long', 'more', 'editing-block']) assert.ok(words[key], `${locale}: ${key}`);
  }
  const sheet = await read('src/smart/editor-inline/scss/_smart__inline-editor.scss');
  // A hidden bar is not drawn: the sheet's display: flex would otherwise win over [hidden].
  assert.match(sheet, /\.sf-inline-editor-toolbar\[hidden\]/u);
  // RT-4 (C173 (2), C144): the toolbar's gap is the toolbar role, 4; it was --sf-space-1 (16).
  // Group build 7: the role alone (C173 (9) RT-ROLE-STEP); --sf-gap--toolbar is --sf-space-1/4.
  assert.match(sheet, /gap: var\(--sf-inline-editor-toolbar-gap, var\(--sf-gap--toolbar\)\);/u);
  assert.doesNotMatch(sheet, /var\(--sf-space-1\)/u);
  const source = await read('src/core/js/composition/inline-editor.mjs');
  assert.match(source, /const toolbarMode = options\.toolbar \?\? 'selection';/u, 'the default is selection (C172 (1))');
  assert.match(source, /const enterMode = options\.enter \?\? 'save';/u, 'Enter saves by default (C172 (2))');
});

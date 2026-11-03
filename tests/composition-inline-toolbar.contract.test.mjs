import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { INLINE_TOOLBAR_MODES, startInlineEdit } from '../src/core/js/composition/inline-editor.mjs';

// simai/ui-source#67: the formatting toolbar of an edit shows for the whole
// session (the default) or only over a selection. The behaviour in a browser
// is tests/browser/composition-inline-toolbar.browser.mjs.

test('the toolbar modes are session, the default, and selection', () => {
  assert.deepEqual(INLINE_TOOLBAR_MODES, ['session', 'selection']);
  assert.ok(Object.isFrozen(INLINE_TOOLBAR_MODES));
});

test('an unknown toolbar mode is refused before the element is touched', () => {
  const saved = globalThis.Element;
  class FakeElement {
    constructor() { this.touched = []; }
    hasAttribute(name) { this.touched.push(name); return false; }
  }
  globalThis.Element = FakeElement;
  try {
    const element = new FakeElement();
    assert.throws(() => startInlineEdit(element, { toolbar: 'always' }), /inline_toolbar_unknown: always/u);
    assert.deepEqual(element.touched, ['data-sf-inline-editing'], 'nothing drawn, nothing changed');
  } finally {
    globalThis.Element = saved;
  }
});

test('the option is part of sf-editor-inline 1.4.0 (sf-inline-editor 1.3.0): its edit action, its script API and its sheet', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const manifest = JSON.parse(await read('src/smart/editor-inline/component.json'));
  assert.equal(manifest.version, '1.4.0');
  assert.match(manifest.actions.edit.summary, /toolbar \(session: [^)]+; selection: [^)]+\)/u);
  assert.match(await read('src/smart/editor-inline/index.js'), /SF\.InlineEditor = Object\.freeze\(\{[^}]*INLINE_TOOLBAR_MODES/u);
  // A hidden bar is not drawn: the sheet's display: flex would otherwise win over [hidden].
  assert.match(await read('src/smart/editor-inline/scss/_smart__inline-editor.scss'), /\.sf-inline-editor-toolbar\[hidden\]\s*\{\s*display: none;/u);
  const source = await read('src/core/js/composition/inline-editor.mjs');
  assert.match(source, /const toolbarMode = options\.toolbar \?\? 'session';/u, 'the default is unchanged');
});

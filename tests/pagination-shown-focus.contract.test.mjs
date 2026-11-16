import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// component.pagination 1.5.1: the «Показано X из Y» line takes the focus when
// the last portion removes the more button (sf-pagination 1.7.0, tabindex -1).
// It drew no Framework ring of its own; it now has a link's ring of words
// (focus tokens, offset --sf-a2, the ui corner), and none on a focus the
// browser would not show.

const root = resolve(import.meta.dirname, '..');
const sheet = readFileSync(resolve(root, 'src/component/pagination/scss/_css__pagination.scss'), 'utf8');
const rule = (selector) => {
  const at = sheet.indexOf(`${selector} {`);
  assert.ok(at >= 0, selector);
  return sheet.slice(at, sheet.indexOf('}', at));
};

test('the shown line has the Framework focus ring', () => {
  const visible = rule('.sf-pagination .sf-pagination-shown:focus-visible');
  assert.match(visible, /outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);/u);
  assert.match(visible, /outline-offset: var\(--sf-a2\);/u);
  assert.match(visible, /border-radius: var\(--sf-radius--ui\);/u);
  assert.match(rule('.sf-pagination .sf-pagination-shown:focus'), /outline: none;/u);
});

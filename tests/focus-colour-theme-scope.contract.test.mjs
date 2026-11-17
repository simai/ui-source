// The focus ring's colour is declared where the theme roles are, on :root and
// on every theme class (GB10). Declared on :root alone, --sf-focus--color
// substituted var(--sf-focus) there: with the theme class on body or on a
// section, and a palette set with that class, the ring kept the root's
// primary while --sf-focus followed the class.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const theme = read('src/core/scss/_sf_css__theme.scss');
const border = read('src/core/scss/_sf_css__border.scss');

function themeRolesBlock() {
  const at = theme.indexOf(':root,\n  .theme-light,\n  .theme-dark {\n    --sf-neutral:');
  assert.ok(at >= 0, 'the theme roles block is :root, .theme-light, .theme-dark');
  return theme.slice(at, theme.indexOf('\n  }\n', at));
}

test('the focus colour is declared with the theme roles, on :root and every theme class', () => {
  const block = themeRolesBlock();
  assert.match(block, /--sf-focus: light-dark\(/u);
  assert.match(block, /--sf-focus--color: var\(--sf-focus\);/u);
  // The border sheet keeps its :root declaration (motion-and-focus-tokens).
  assert.match(border, /--sf-focus--color: var\(--sf-focus\);/u);
});

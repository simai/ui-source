// The code highlight reads its roles where the code stands (DEV 2026-11-11,
// variant C of the code comment contrast study): the place hooks in core,
// the code's own roles through them, and the page unchanged (no hook there).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const block = (text, selector) => {
  const at = text.indexOf(selector);
  assert.ok(at >= 0, `${selector} is declared`);
  // To the rule's closing brace: the first } at the start of a line (an
  // interpolation, #{$infix}, has one inside the selector).
  return text.slice(at, text.slice(at).search(/\n\s*\}/u) + at);
};

test('places declare the three hooks; the page declares none', async () => {
  const places = await read('src/core/scss/mix/_mix__places.scss');
  const opaque = places.slice(places.indexOf('@mixin sf-place('), places.indexOf('@mixin sf-place-fill'));
  assert.match(opaque, /--sf-place--ink-variant: var\(--sf-on-surface-container-variant\);/u);
  assert.match(opaque, /--sf-place--ink: initial;/u);
  assert.match(opaque, /--sf-place--fill-surface: light-dark\(var\(--sf-surface-container\), transparent\);/u);
  assert.match(opaque, /--sf-place--fill-surface: initial;/u);
  const strong = places.slice(places.indexOf('@mixin sf-place-strong('), places.indexOf('@mixin sf-place-strong-accent'));
  assert.match(strong, /--sf-place--ink-variant: var\(--sf-on-#\{\$c\}\);/u);
  assert.match(strong, /--sf-place--ink: var\(--sf-on-#\{\$c\}\);/u);
  // The inverse place reads its own inks (the branch's deviation 2, lost at
  // the group build 2 merge: every role read 1.13-1.94:1 on bg-surface-inverse).
  const inverse = places.slice(places.indexOf('@mixin sf-place-inverse('), places.indexOf('@mixin sf-place-inverse-accent'));
  assert.match(inverse, /--sf-place--ink-variant: var\(--sf-on-surface-container-variant\);/u);
  assert.match(inverse, /--sf-place--ink: var\(--sf-on-surface\);/u);
  assert.match(inverse, /--sf-place--fill-surface: initial;/u);
  const glass = block(await read('src/core/scss/_sf_css__surface_places.scss'), '.sf-surface-media {');
  assert.match(glass, /--sf-place--ink: var\(--sf-on-surface-media\);/u);
  const plate = block(await read('src/utility/background-color/default/scss/_sf_css__background_color.scss'), '.#{$infix}bg-surface-container {');
  assert.match(plate, /--sf-place--fill-surface: transparent;/u);
  const theme = await read('src/core/scss/_sf_css__theme.scss');
  assert.doesNotMatch(theme, /--sf-place--(ink-variant|ink|fill-surface):/u);
});

test('every highlight role is read through a place hook, falling back to the page role', async () => {
  const theme = await read('src/component/highlight/scss/_theme.scss');
  const own = block(theme, ':is(.sf-code-surface, .hljs) {');
  assert.match(own, /--sf-highlight--text: var\(--sf-place--ink, var\(--sf-highlight-text\)\);/u);
  for (const role of ['comment', 'punctuation', 'line-number']) {
    assert.match(own, new RegExp(`--sf-highlight--${role}: var\\(--sf-place--ink-variant, var\\(--sf-highlight-${role}\\)\\);`, 'u'));
  }
  for (const role of ['keyword', 'title', 'attribute', 'string', 'built-in', 'tag', 'section', 'bullet', 'addition', 'deletion']) {
    assert.match(own, new RegExp(`--sf-highlight--${role}: var\\(--sf-place--ink, var\\(--sf-highlight-${role}\\)\\);`, 'u'));
    assert.match(theme, new RegExp(`color: var\\(--sf-highlight--${role}\\);`, 'u'));
  }
  // No token is painted from a root-resolved role any more.
  assert.doesNotMatch(theme, /color: var\(--sf-highlight-(text|comment|keyword|title|attribute|string|built-in|tag|section|bullet|punctuation|addition|deletion)\);/u);
  // The page roles stay on the theme root, as a project overrides them.
  assert.match(theme, /--sf-highlight-comment: var\(--sf-on-surface-variant\);/u);
  const surface = await read('src/component/highlight/scss/_default.scss');
  assert.match(surface, /background: var\(--sf-highlight-background-color, var\(--sf-place--fill-surface, var\(--sf-surface-container\)\)\);/u);
  assert.match(surface, /color: var\(--sf-highlight--line-number\);/u);
});

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The Framework's own components show the focus ring on :focus-visible, so a
// project must be able to ask for the same trigger. The focus: variants fire on
// a mouse click too, which is the behaviour we removed from the components; they
// stay for the consumers that already use them, and are legacy.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const families = [
  'outline-color', 'outline-width',
  'ring-color', 'ring-inset', 'ring-offset-color', 'ring-offset-width', 'ring-opacity', 'ring-width',
];

test('every focus utility has a keyboard-only twin', () => {
  for (const family of families) {
    const dir = `src/utility/${family}/focus-visible`;
    assert.ok(existsSync(resolve(root, dir)), `${family}: the focus-visible variant exists`);
    assert.ok(existsSync(resolve(root, `src/utility/${family}/focus`)), `${family}: the legacy focus variant is kept`);
  }
});

test('the twin answers only to the keyboard', () => {
  for (const family of families) {
    const scss = read(`src/utility/${family}/focus-visible/scss/_sf_css__${family.replace(/-/gu, '_')}.scss`);
    assert.match(scss, /\$(?:infix|event): focus-visible;/u, `${family}: the variant is named focus-visible`);
    // A bare :focus or :focus-within would make it fire on a mouse click, which is
    // the whole reason this variant exists.
    const selectors = [...scss.matchAll(/:focus(?!-visible)[a-z-]*/gu)].map(([match]) => match);
    assert.deepEqual(selectors, [], `${family}: ${selectors.join(', ')} would fire on a mouse click`);
  }
});

test('the twin is registered in both places, or it would never load', () => {
  const styles = read('src/core/utility-full.js');
  const rules = read('src/core/js/rule.src.js');
  for (const family of families) {
    assert.ok(
      styles.includes(`import '../utility/${family}/focus-visible/index.scss';`),
      `${family}: the stylesheet is imported`,
    );
    assert.ok(
      rules.includes(`import '../../utility/${family}/focus-visible/rule.js';`),
      `${family}: the on-demand loader knows the class prefix`,
    );
    const rule = read(`src/utility/${family}/focus-visible/rule.js`);
    assert.ok(rule.includes(`SF.RuleLoader['${family}/focus-visible']`), `${family}: the loader key is its own`);
    assert.match(rule, /\^\(\?:focus-visible:/u, `${family}: the loader matches the focus-visible prefix`);
  }
});

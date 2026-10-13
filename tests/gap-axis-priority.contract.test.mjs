import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// This source contract protects generation order. Computed CSS behavior is
// checked separately against built assets in the browser acceptance corpus.
for (const variant of ['default', 'sm', 'md', 'lg', 'xl']) {
  test(`gap ${variant}: all shorthand values precede all explicit axes`, () => {
    const source=readFileSync(new URL(`../src/utility/gap/${variant}/scss/_sf_css__gap.scss`,import.meta.url),'utf8');
    const loops=[...source.matchAll(/^\s*@each \$size in \$space-size-array\s*\{/gm)];
    assert.equal(loops.length,2);
    const shorthand=source.slice(loops[0].index,loops[1].index);
    const axes=source.slice(loops[1].index);
    assert.match(shorthand,/gap: var\(--sf-space-#\{\$size\}\)/);
    assert.doesNotMatch(shorthand,/(?:column|row)-gap:/);
    assert.doesNotMatch(axes,/(?<![\w-])gap:/);
    for (const alias of ['col-gap','gap-x','g-x','row-gap','gap-y','g-y'])
      assert.ok(axes.includes(`${alias}-#{$size}`),alias);
    assert.match(axes,/column-gap: var\(--sf-space-#\{\$size\}\)/);
    assert.match(axes,/row-gap: var\(--sf-space-#\{\$size\}\)/);
  });
}

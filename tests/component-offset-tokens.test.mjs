import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(new URL(`../src/component/${file}`, import.meta.url), 'utf8');

test('overbox geometry uses existing rem primitives including negative offsets', () => {
  const source = read('overbox/scss/_css__overbox.scss');
  assert.doesNotMatch(source, /\d*\.?\d+rem\b/);
  for (const token of ['c1', 'c3', 'c6', 'a8', 'b6']) assert.ok(source.includes(`var(--sf-${token})`));
  assert.match(source, /top:\s*calc\(-1 \* var\(--sf-c1\)\)/);
});
test('centered modal entrance, closing and hidden offsets use the same primitive', () => {
  const source = read('modal/scss/_css__modal_custom.scss');
  assert.equal(source.split('translateY(var(--sf-space-1\\/2)) scale(0.98)').length-1, 3);
  assert.doesNotMatch(source, /translateY\([\d.]+rem\)/);
});
test('tab underline overlap follows the same pixel primitive as its border', () => {
  const source = read('tabs/scss/_css__tabs.scss');
  assert.match(source, /border-width:\s*var\(--sf-tabs-top-container--border-width, 0 0 var\(--sf-tabs--border-width, var\(--sf-px\)\) 0\)/);
  assert.match(source, /--sf-tabs-top--margin:\s*0 0 calc\(var\(--sf-tabs--border-width, var\(--sf-px\)\) \* -1\) 0/);
});

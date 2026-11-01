import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';
const read = file => withoutPublicVariables(readFileSync(new URL(`../src/component/${file}`, import.meta.url), 'utf8'));

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

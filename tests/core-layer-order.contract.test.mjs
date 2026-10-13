import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const order = '@layer sf.reset, sf.tokens, sf.base, sf.utilities, sf.components, sf.overrides, sf.states;';

test('core establishes the existing public layer order before dependencies emit CSS', () => {
  const entry = read('src/core/scss/index.scss');
  assert.equal(entry.match(/@use\s+['"]([^'"]+)/)?.[1], 'sf_layer_order');
  assert.equal(read('src/core/scss/_sf_layer_order.scss').includes(order), true);
  assert.equal(entry.includes(order), false, 'no misleading late declaration');
});

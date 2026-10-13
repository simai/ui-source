import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../src/utility/transform-scale/', import.meta.url);
const source = readFileSync(new URL('default/scss/_sf_var__transform_scale.scss', root), 'utf8');
const values = new Map([...source.matchAll(/'([^']+)'\s*:\s*(scale(?:X|Y)?)\(([^)]+)\)/g)]
  .map(([, name, fn, value]) => [name.replaceAll('\\', ''), {fn, value: Number(value)}]));

for (const [size, value] of Object.entries({'0': 0, '1/4': .8, '1/3': .9, '1/2': .95, '1': 1, '2': 1.05, '3': 1.1, '4': 1.2})) {
  test(`scale ${size}: preserve step value and isolate named axis`, () => {
    assert.deepEqual(values.get(size), {fn: 'scale', value});
    for (const axis of ['x', 'y'])
      assert.deepEqual(values.get(`${axis}-${size}`), {fn: `scale${axis.toUpperCase()}`, value});
  });
}

test('hover shares the base scale map without its own divergent values', () => {
  const hover = readFileSync(new URL('hover/scss/_sf_css__transform_scale.scss', root), 'utf8');
  assert.ok(hover.includes("@use '../../default/scss/sf_var__transform_scale' as *"));
  assert.match(hover, /@each \$transform-scale-name, \$transform-scale-value in \$transform-scale-array/);
});

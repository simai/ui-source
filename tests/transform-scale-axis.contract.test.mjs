import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../src/utility/transform-scale/', import.meta.url);
const source = readFileSync(new URL('default/scss/_sf_var__transform_scale.scss', root), 'utf8');
// C271 (owner 2026-11-17): the scale names say their percent; the former step
// names map onto them. The sheet writes every name with scale(), scaleX() and
// scaleY() of one value (the @each over both maps).
const map = (name) => {
  const body = source.slice(source.indexOf(`$${name}: (`));
  return Object.fromEntries([...body.slice(0, body.indexOf(');')).matchAll(/'([^']+)':\s*'?([^',\s]+)'?,/gu)]
    .map(([, key, value]) => [key.replaceAll('\\', ''), value]));
};
const percent = map('transform-scale-percent');
const former = map('transform-scale-former');
const values = new Map([['0', {fn: 'scale', value: 0}], ['x-0', {fn: 'scaleX', value: 0}], ['y-0', {fn: 'scaleY', value: 0}]]);
for (const [name, value] of [...Object.entries(percent), ...Object.entries(former).map(([key, to]) => [key, percent[to]])]) {
  values.set(name, {fn: 'scale', value: Number(value)});
  for (const axis of ['x', 'y']) values.set(`${axis}-${name}`, {fn: `scale${axis.toUpperCase()}`, value: Number(value)});
}

test('C271: every name is written with scale(), scaleX() and scaleY() of its value', () => {
  assert.match(source, /'#\{\$name\}': scale\(\$value\),\s*'x-#\{\$name\}': scaleX\(\$value\),\s*'y-#\{\$name\}': scaleY\(\$value\),/u);
  assert.match(source, /'#\{\$former\}': scale\(\$value\),\s*'x-#\{\$former\}': scaleX\(\$value\),\s*'y-#\{\$former\}': scaleY\(\$value\),/u);
});

for (const [size, value] of Object.entries({'0': 0, '1/4': .8, '1/3': .9, '1/2': .95, '1': 1, '2': 1.05, '3': 1.1, '4': 1.2,
  '80': .8, '90': .9, '95': .95, '100': 1, '105': 1.05, '110': 1.1, '120': 1.2})) {
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

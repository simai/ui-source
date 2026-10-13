import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const group = readFileSync(new URL('../src/component/button-group/scss/_css__button-group.scss', import.meta.url), 'utf8');
const css = group.replace(/\/\*[\s\S]*?\*\//g, '');

test('button group keeps dimensionful declarations on system tokens', () => {
  assert.doesNotMatch(css, /(?<![\w-])(?:\d*\.)?\d+(?:px|rem|em)\b/);
  const widths = [...css.matchAll(/(?:--sf-button--)?border-[\w-]*width\s*:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(widths.length >= 14, 'must inspect the segmented perimeter, not an empty fixture');
  assert.ok(widths.every(value => value === '0' || value === 'var(--sf-px)'));
});

test('pixel primitive remains defined by the core size system', () => {
  const variables = readFileSync(new URL('../src/core/scss/vars/_sf_var__size.scss', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../src/core/scss/_sf_css__size.scss', import.meta.url), 'utf8');
  assert.match(variables, /\$size-pixel:\s*1px\s*!default/);
  assert.match(core, /--sf-px:\s*#\{size\.\$size-pixel\}\s*;/);
});

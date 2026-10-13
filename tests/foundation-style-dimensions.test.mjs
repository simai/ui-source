import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the physical pixel primitive has one Sass source and one CSS projection', async () => {
  const [sizes, projection, breakpoints] = await Promise.all([
    read('src/core/scss/vars/_sf_var__size.scss'),
    read('src/core/scss/_sf_css__size.scss'),
    read('src/core/scss/mix/_mix__breakpoint.scss'),
  ]);

  assert.match(sizes, /\$size-pixel:\s*1px\s*!default/);
  assert.match(projection, /--sf-px:\s*#\{size\.\$size-pixel\}/);
  assert.match(breakpoints, /@use "vars\/sf_var__size" as size/);
  assert.match(breakpoints, /- size\.\$size-pixel/);
  assert.doesNotMatch(breakpoints, /-\s*1px/);
});

test('special kerning derives relative accessibility modes from typography tokens', async () => {
  const source = await read('src/component/special/scss/_kerning.scss');

  assert.match(source, /var\(--sf-text--tracking-widest\) \* 1\.5/);
  assert.match(source, /var\(--sf-text--tracking-widest\) \* 3/);
  assert.doesNotMatch(source, /-?\d*\.?\d+(?:px|rem|em)\b/);
});

test('legacy slider transport preserves nominal positions through size tokens', async () => {
  const source = await read('src/smart/slider/template/default/index.html');

  assert.match(source, /var\(--sf-a4\)/);
  assert.match(source, /var\(--sf-g3\)/);
  assert.match(source, /calc\(var\(--sf-g2\) \+ var\(--sf-c1\)\)/);
  assert.doesNotMatch(source, /-?\d*\.?\d+(?:px|rem|em)\b/);
});

test('table accent covers cells without an arbitrary paint-spread length', async () => {
  const source = await read('src/utility/table/default/scss/_sf_css__table.scss');

  assert.match(source, /background-image:\s*linear-gradient\(var\(#\{\$prefix\}accent-bg\), var\(#\{\$prefix\}accent-bg\)\)/);
  assert.doesNotMatch(source, /9999px/);
  assert.doesNotMatch(source, /box-shadow:\s*inset\s+0\s+0\s+0/);
});

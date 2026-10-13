import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Spinner normalizes its public visual inputs to bounded contracts', async () => {
  const ordinary = await read('src/component/spinner/js/_spinner.js');
  const smartTemplate = await read('src/smart/spinner/js/templates/default.js');

  assert.match(ordinary, /\['arc', 'dots'\]/);
  assert.match(ordinary, /\['clockwise', 'counterclockwise'\]/);
  assert.match(ordinary, /Math\.floor\(toNumber\(root\.dataset\.dots, 16\)\), 3, 32/);
  assert.match(ordinary, /Math\.floor\(toNumber\(root\.dataset\.filled, 6\)\), 1, dots/);
  assert.match(smartTemplate, /\['1\/2', '1', '2', '3'\]/);
});

test('Spinner owns optional polite status semantics without entering focus order', async () => {
  const ordinary = await read('src/component/spinner/js/_spinner.js');
  const smart = await read('src/smart/spinner/index.js');
  const template = await read('src/smart/spinner/js/templates/default.js');

  assert.match(ordinary, /config\.announce && hasLabel/);
  assert.match(ordinary, /setAttribute\('role', 'status'\)/);
  assert.match(ordinary, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(ordinary, /toggleAttribute\('aria-hidden', !hasLabel\)/);
  assert.match(smart, /announce: \{ type: Boolean, default: false \}/);
  assert.match(template, /data-announce=\$\{String\(!!context\.announce\)\}/);
  assert.doesNotMatch(template, /tabindex=/);
});

test('Spinner motion uses Framework tokens and has a static reduced-motion state', async () => {
  const base = await read('src/component/spinner/scss/_css__spinner.scss');
  const visual = await read('src/component/spinner/scss/_css__spinner_custom.scss');

  assert.match(base, /--sf-loader-cycle-duration: calc\(var\(--sf-duration-slow\) \* 6\)/);
  assert.match(base, /--sf-loader-dot-duration: calc\(var\(--sf-duration-slow\) \* 3\)/);
  assert.match(visual, /animation-iteration-count: infinite/);
  assert.match(visual, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(visual, /stroke-dasharray: 24 76/);
  assert.doesNotMatch(visual, /3\.2s|1\.4s|opacity: 0\.(?:16|32|62)/);
});

test('Spinner machine contract documents status, ownership and closed variants', async () => {
  const manifest = JSON.parse(await read('src/smart/spinner/smart.manifest.json'));

  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2', '3']);
  assert.deepEqual(manifest.inputs.properties.variant.enum, ['arc', 'dots']);
  assert.deepEqual(manifest.inputs.properties.direction.enum, [
    'clockwise',
    'counterclockwise',
  ]);
  assert.equal(manifest.inputs.properties.announce.type, 'boolean');
  assert.deepEqual(manifest.accessibility.keyboard, []);
  assert.equal(manifest.ownership.data, 'host');
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {logicalSide, physicalPlacement} from '../src/core/js/position-placement.js';

test('logical placements map to physical sides and follow the writing direction', () => {
  assert.equal(physicalPlacement('block-end', 'start'), 'bottom-start');
  assert.equal(physicalPlacement('block-start', 'end'), 'top-end');
  assert.equal(physicalPlacement('block-end', 'center'), 'bottom');
  assert.equal(physicalPlacement('inline-start', 'start'), 'left-start');
  assert.equal(physicalPlacement('inline-start', 'start', true), 'right-start');
  assert.equal(physicalPlacement('inline-end', 'center', true), 'left');
  assert.throws(() => physicalPlacement('below'), TypeError);
  assert.throws(() => physicalPlacement('block-end', 'middle'), TypeError);
});

test('resolved placements map back to logical sides', () => {
  assert.equal(logicalSide('bottom-start'), 'block-end');
  assert.equal(logicalSide('top'), 'block-start');
  assert.equal(logicalSide('left-end'), 'inline-start');
  assert.equal(logicalSide('left-end', true), 'inline-end');
  assert.equal(logicalSide('right', true), 'inline-start');
});

test('Core publishes the helper and components reuse it or their bundled copy', async () => {
  const core = await readFile(new URL('../src/core/js/index.js', import.meta.url), 'utf8');
  assert.match(core, /import '\.\/position\.js';/);
  const position = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  assert.match(position, /globalThis\.SF\.Position = Position;/);
  assert.match(position, /from '\.\/position-placement\.js'/);
  assert.match(position, /if \(!globalThis\.SF\.Position\) globalThis\.SF\.Position = Position;/);
  // Components prefer Core's helper and fall back to their bundled copy, so an
  // isolated bundle (no core.js) still positions its panels.
  for (const file of ['src/component/dropdown/portal.js', 'src/smart/datepicker/index.js']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /import BundledPosition from '\.\.\/\.\.\/core\/js\/position\.js';/, file);
    assert.match(source, /globalThis\.SF\?\.Position \|\| BundledPosition/, file);
    assert.doesNotMatch(source, /@floating-ui/, file);
  }
});

test('stylesheet max-width is read before inline writes and stays the width cap', async () => {
    const {readFile} = await import('node:fs/promises');
    const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
    // A percentage cap is of the viewport (the panel is fixed); read as pixels it
    // made every tooltip 100px wide. Browser: anchor-percent-cap.
    assert.match(source, /const widthCap = cap\(floatingStyle\.maxWidth, document\.documentElement\.clientWidth\);/);
    assert.match(source, /endsWith\('%'\) \? number \/ 100 \* whole : number/);
    assert.match(source, /Math\.min\(availableWidth, viewportWidth, widthCap\)/);
});

test('a panel may reach the viewport edge its field reaches, and no further in', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  assert.match(source, /left: Math\.min\(padding, Math\.max\(0, box\.left\)\)/);
  assert.match(source, /right: Math\.min\(padding, Math\.max\(0, clientWidth - box\.right\)\)/);
  assert.match(source, /shift\(\{padding: edges, crossAxis: false\}\)/);
  assert.match(source, /size\(\{\s*padding: edges,/);
});

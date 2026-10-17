import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../src/smart/drawer/scss/_smart__drawer.scss', import.meta.url), 'utf8');

test('drawer design lengths use Core tokens and semantic dynamic viewport', () => {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutComments, /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/);
  assert.match(source, /width:\s*min\(var\(--sf-drawer-width, var\(--sf-g2\)\), 100vi\)/);
  // The panel's block size is its containing block's (inset-block: 0): the
  // viewport on a page, the box of a [data-sf-drawer-container] inside one. A
  // height of 100vb tied it to the viewport (DEV, 2026-10-18).
  const panelRule = withoutComments.match(/\.sf-drawer-panel \{[^}]*\}/u)?.[0] ?? '';
  assert.match(panelRule, /inset-block:\s*0/);
  assert.doesNotMatch(panelRule, /height:\s*100vb/);
  assert.match(source, /border-inline-(?:start|end): var\(--sf-px\) solid/);
});

test('logical and physical compatibility placements retain mirrored transforms', () => {
  for (const name of ['left','right','inline-start','inline-end']) assert.match(source, new RegExp(`data-sf-drawer-placement='${name}'`));
  assert.match(source, /inline-start'\]:dir\(rtl\)[\s\S]*translateX\(100%\)/);
  assert.match(source, /inline-end'\]:dir\(rtl\)[\s\S]*translateX\(-100%\)/);
});

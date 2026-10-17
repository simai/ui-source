import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';
const css=withoutPublicVariables(await readFile(new URL('../src/component/icon-buttons/scss/_css_icon_buttons.scss',import.meta.url),'utf8'));
test('IconButton owns its semantic foreground on the root so currentColor glyphs can inherit it',()=>{
  assert.match(css,/\.sf-icon-button \{\s*(?:\/\*[\s\S]*?\*\/\s*)?color: var\(--sf-icon--color, var\(--sf-on-surface-variant\)\);/);
  const roles=[...css.matchAll(/([^{}]+)\{\s*--sf-icon--color: ([^;]+);\s*\}/g)];
  // Sixteen role colours now: the eleven that were here -- the six that predate
  // the ramp, surface on each scheme (ghost reads as link since the variant
  // cleanup), their shared disabled rule, and tonal primary -- and the five the
  // destructive status brought: default, tonal, outline, link/ghost and its own
  // disabled rule. The count is here so a new one cannot appear unnoticed; the
  // assertions below are what it must obey.
  assert.equal(roles.length,16);
  for(const [,selector] of roles){assert.match(selector,/\.sf-icon-button/);assert.doesNotMatch(selector,/ \.sf-icon(?:,|\s*$)/);}
  assert.match(css,/\.sf-icon-button \.sf-icon \{\s*color: var\(--sf-icon--color/);
  assert.ok(roles.some(([,selector,color])=>selector.includes(':disabled')&&color==='var(--sf-on-disable)'));
});
test('Modal minimize opts into the existing icon variant and keeps its decorative CSS line',async()=>{
  const template=await readFile(new URL('../src/smart/modal/js/templates/default.js',import.meta.url),'utf8');
  assert.match(template,/sf-icon-button sf-icon-button--icon[^'\n]+sf-modal-hide-button/);
  assert.match(template,/class="sf-modal-hide-icon" aria-hidden="true"/);
  const modal=await readFile(new URL('../src/component/modal/scss/_css__modal_buttons.scss',import.meta.url),'utf8');
  assert.match(modal,/\.sf-modal-hide-icon \{\s*background-color: currentColor;/);
});

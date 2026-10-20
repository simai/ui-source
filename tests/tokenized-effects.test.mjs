import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';
const read=file=>withoutPublicVariables(readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8'));

test('stripe, loading and loader motion geometry use system primitives',()=>{
  const files=['utility/stripe/default/scss/_sf_css__stripe.scss','component/buttons/scss/_css__buttons_custom.scss','core/scss/_sf_css__loader.scss'];
  for(const file of files) assert.doesNotMatch(read(file).replace(/\/\*[\s\S]*?\*\//g,''),/(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/,file);
  assert.equal((read(files[0]).match(/var\(--sf-px\)/g)||[]).length,10);
  // The loading look is the spinner now (simai/ui-source#10): its slot is the
  // icon's box on the ladder tokens, and the stripes no longer move.
  assert.match(read(files[1]),/--sf-button-spinner--size: var\(--sf-text-height-1\\\/3\);/);
  assert.doesNotMatch(read(files[1]),/@keyframes|animation:/);
  for(const token of ['a9','a2','b5','a7']) assert.ok(read(files[2]).includes(`var(--sf-${token})`));
});

test('tabs and screen-reader clipping use the fixed pixel primitive consistently',()=>{
  const tabs=read('component/tabs/scss/_css__tabs.scss');
  assert.match(tabs,/border-bottom-width: calc\(var\(--sf-tabs--border-width, var\(--sf-px\)\) \* 2\)/);
  assert.doesNotMatch(tabs,/(?:1|2|0)px/);
  const sr=read('utility/sr-only/default/scss/_sf_css__sr_only.scss');
  assert.equal((sr.match(/var\(--sf-px\)/g)||[]).length,3);
  assert.match(sr,/margin: calc\(-1 \* var\(--sf-px\)\)/);
});

test('toggle focus shadow uses dimensionless zero while keeping token widths',()=>{
  const toggle=read('smart/toggle/scss/styles_default.scss');
  assert.doesNotMatch(toggle,/0px/);
  assert.match(toggle,/box-shadow: 0 0 var\(--sf-a1\) var\(--sf-a5\)/);
});

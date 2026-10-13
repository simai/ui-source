import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('Both Modal renderers reserve natural header space without absolute action defaults',async()=>{
  for(const path of ['src/component/modal/js/_modal.js','src/smart/modal/js/templates/default.js']){
    const text=await read(path);
    assert.match(text,/sf-modal-header-content/);
    assert.match(text,/sf-modal-header-action/);
    assert.doesNotMatch(text,/sf-modal-(close|hide)-button[^'\n]*\babsolute\b/);
    assert.doesNotMatch(text,/p-right-2/);
    assert.doesNotMatch(text,/sf-modal-(close|hide)-button[^'\n]*\bradius-default\b/);
  }
});
test('Header wrapping and target geometry use semantic controls and preserve other close contexts',async()=>{
  const text=await read('src/component/modal/scss/_css__modal_buttons.scss');
  assert.match(text,/overflow-wrap: anywhere/);
  assert.match(text,/min-block-size: var\(--sf-ui-1\\\/3--control-height\)/);
  assert.match(text,/min-inline-size: var\(--sf-ui-1\\\/3--control-height\)/);
  assert.match(text,/--sf-modal-close-inline-end/);
});

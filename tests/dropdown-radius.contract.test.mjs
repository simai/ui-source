import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('dropdown defaults are fallbacks, so inherited radius overrides survive',async()=>{
  const source=await read('src/component/dropdown/scss/_css__dropdown.scss');
  assert.doesNotMatch(source,/--sf-dropdown--radius:\s*var/);
  for(const corner of ['start-start','start-end','end-start','end-end']){
    // The public --sf-dropdown-radius (standard 1.3.8 §6) stands between the corner and the internal fallback.
    assert.ok(source.includes(`border-${corner}-radius: var(--sf-dropdown-field--border-${corner}-radius, var(--sf-dropdown-radius, var(--sf-dropdown--radius, var(--sf-radius--ui))))`));
  }
});

test('dropdown panels use surface radius and preserve individual border overrides',async()=>{
  const source=await read('src/component/dropdown/scss/_css__list.scss');
  assert.equal((source.match(/var\(--sf-radius--surface\)/g)||[]).length,4);
  assert.doesNotMatch(source,/1px|sf-radius-1/);
  assert.ok(source.indexOf('border-width:')<source.indexOf('border-bottom-width:'));
  assert.ok(source.includes('border-bottom-width: var(--sf-list--border-bottom-width, var(--sf-list--border-width, var(--sf-px)))'));
});

test('owned dropdown controls do not carry a surface radius utility',async()=>{
  for(const path of ['src/component/dropdown/js/_dropdown.js','src/smart/dropdown/js/templates/default.js']){
    assert.doesNotMatch(await read(path),/radius-default/);
  }
  const css=await read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(css,/var\(--sf-tag--border-top-left-radius, var\(--sf-radius--ui\)\)/);
});

test('Smart dropdown consumes the standard root class and style context',async()=>{
  const source=await read('src/smart/dropdown/js/templates/default.js');
  assert.ok(source.includes('context.rootClass,'));
  assert.ok(source.includes('style=${context.rootStyle || nothing}'));
});

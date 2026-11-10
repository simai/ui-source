import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
for(const [component,file,roles] of [
  ['inputs','_css__inputs.scss',['input-placeholder','input-text','input-hint-text-wrap']],
  ['textarea','_css__textarea.scss',['textarea-text','textarea-placeholder','textarea-hint-text-wrap']],
  ['quantity','_css__quantity.scss',['quantity-text','quantity-placeholder']],
])test(`${component}: readable secondary text uses the text role, not the muted role`,async()=>{
  const source=await readFile(new URL(`../src/component/${component}/scss/${file}`,import.meta.url),'utf8');
  for(const role of roles){
    assert.ok(source.includes(`--sf-${role}--color: var(--sf-on-surface-variant);`));
    assert.ok(!source.includes(`--sf-${role}--color: var(--sf-on-surface-muted);`));
  }
  assert.ok(source.includes('var(--sf-on-disable)'),'Explicit disabled styling remains separate');
  // The filled placeholder is the place's dim ink, kept on the host above the
  // field's fill (forms batch round 2, item C, 2026-11-10); a strong coloured
  // place keeps its full ink there.
  if(component!=='quantity'){
    const name=component==='inputs'?'input':'textarea';
    assert.ok(source.includes(`--sf-${name}-placeholder--color: var(--sf-${name}--place-variant);`),'Filled placeholder reads the place variant');
    assert.ok(source.includes(`--sf-${name}--place-variant: var(--sf-place--fill-placeholder, var(--sf-on-surface-variant));`),'The place variant is kept on the host');
  }
});

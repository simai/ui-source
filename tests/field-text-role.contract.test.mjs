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
  if(component!=='quantity')assert.ok(source.includes(`--sf-${component==='inputs'?'input':'textarea'}-placeholder--color: var(--sf-on-surface);`),'Tonal placeholder has a stronger foreground role');
});

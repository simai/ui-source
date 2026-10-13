import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('Modal preloads its generated close action through normal Loader relations',async()=>{
  const context={SF:{RuleLoader:{}}};vm.createContext(context);
  for(const name of ['component/modal','smart/modal','smart/gallery']){
    vm.runInContext(await readFile(new URL(`../src/${name}/rule.js`,import.meta.url),'utf8'),context);
  }
  const rules=context.SF.RuleLoader;
  const names=key=>Array.from(rules[key].relation,entry=>entry.name);
  assert.ok(names('modal').includes('close'));
  assert.ok(names('modal').includes('icon-buttons'));
  assert.ok(names('cl-modal').includes('modal'));
  assert.ok(names('cl-gallery').includes('cl-modal'));
  assert.equal(new Set(names('modal')).size,names('modal').length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const ordinary=await readFile(new URL('../src/component/modal/js/_modal.js',import.meta.url),'utf8');
const smart=await readFile(new URL('../src/smart/modal/index.js',import.meta.url),'utf8');
test('Reopening a pending close preserves the original opener in both Modal owners',()=>{
  assert.match(ordinary,/if \(this\._modalState !== 'closing'\) \{\s*this\.lastActive = document\.activeElement;/);
  assert.match(smart,/if \(!wasClosing\) \{\s*this\._lastActive = document\.activeElement;/);
});
test('Smart Modal does not remount the open attribute while closing or finish a cancelled close',()=>{
  assert.match(smart,/this\.hasAttribute\("open"\) && !this\._isOpen && this\._modalState !== "closing"/);
  assert.match(smart,/finishClose\(\) \{\s*if \(this\.display !== "inline" && this\._modalState !== "closing"\) \{\s*return this;/);
});
test('Inline Modal does not programmatically capture or restore focus',()=>{
  assert.match(smart,/focusFirst\(\) \{\s*if \(this\.display === "inline"\) \{\s*return;/);
  assert.doesNotMatch(smart,/this\._lastActive\?\.focus/);
  assert.match(ordinary,/setAttribute\('aria-hidden', String\(!this\.isOpen\)\)/);
});
test('Panel animation option replaces previous choice and reaches Smart default template',async()=>{
  const template=await readFile(new URL('../src/smart/modal/js/templates/default.js',import.meta.url),'utf8');
  assert.match(ordinary,/classList\.toggle\('animate', Boolean\(animate\)\)/);
  assert.match(smart,/this\._animatePanel = Boolean\(animate\)/);
  assert.match(smart,/animate: this\._animatePanel && this\.display !== "inline"/);
  assert.match(template,/!isInline && context\.animate && 'animate'/);
});

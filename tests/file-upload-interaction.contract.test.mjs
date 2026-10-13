import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const js=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/component/file-upload/scss/_css__file_upload.scss',import.meta.url),'utf8');
test('FileUpload keyboard activation stays with its own non-native trigger',()=>{
  assert.match(js,/event\.target !== root \|\| event\.repeat \|\| root\.matches\('button, input, a\[href\]'\)/);
  assert.match(js,/isDisabledRoot\(root\) \|\| \(removeButton \|\| retryButton\)\.disabled/);
});
test('FileUpload focus uses modality and real forced-color outline without changing the surface',()=>{
  assert.doesNotMatch(css,/:focus(?!-)/);
  assert.doesNotMatch(css,/transparent-for-focus/);
  assert.match(css,/@media \(forced-colors: active\)[\s\S]*outline: var\(--sf-focus-outline-width\) solid Highlight/);
});
test('FileUpload synchronizes disabled controls, preserves authored names and tears down its observer',()=>{
  assert.match(js,/__sfFileUploadInteractionObserver\?\.disconnect\(\)/);
  assert.match(js,/!button\.hasAttribute\('aria-labelledby'\) && \(!currentLabel \|\| currentLabel === previous\.label\)/);
  assert.match(js,/const nextDisabled = disabled \|\| previous\.disabled/);
  assert.match(js,/root\.getAttribute\('tabindex'\) \?\? '0'/);
});

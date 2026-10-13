import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('FileUpload observes native selection options as well as compatibility aliases',async()=>{
  const source=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
  assert.match(source,/attributeFilter: \['disabled', 'class', 'accept', 'multiple', 'data-accept', 'data-multiple'\]/);
});
test('FileUpload cancels file drops before disabled guard without intercepting unrelated drags',async()=>{
  const source=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
  const drop=source.slice(source.indexOf('const onDrop ='),source.indexOf('const onFilesClick ='));
  assert.ok(drop.indexOf("includes('Files')")<drop.indexOf('event.preventDefault()'));
  assert.ok(drop.indexOf('event.preventDefault()')<drop.indexOf('isDisabledRoot(root)'));
  assert.match(source,/event\.dataTransfer\.dropEffect = 'none'/);
});

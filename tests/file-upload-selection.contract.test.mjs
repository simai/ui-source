import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('FileUpload observes native selection options as well as compatibility aliases',async()=>{
  const source=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
  assert.match(source,/attributeFilter: \['disabled', 'class', 'accept', 'multiple', 'data-accept', 'data-multiple'\]/);
});
test('FileUpload cancels file drops before disabled guard without intercepting unrelated drags',async()=>{
  // 1.7.2 (FO-1): the area reads a drag through core's files drop; the order
  // of the checks is the helper's: only a drag that carries files is taken,
  // its default is cancelled before the disabled guard, and a disabled area
  // says no with the cursor.
  const source=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
  assert.match(source,/const drop = filesDrop\(root, \{/);
  assert.match(source,/disabled: \(\) => isDisabledRoot\(root\),/);
  const helper=await readFile(new URL('../src/core/js/files-drop.js',import.meta.url),'utf8');
  const drop=helper.slice(helper.indexOf('const onDrop ='),helper.indexOf('const onDragEnd ='));
  assert.ok(drop.indexOf('carriesFiles(event)')<drop.indexOf('event.preventDefault()'));
  assert.ok(drop.indexOf('event.preventDefault()')<drop.indexOf('isDisabled()'));
  assert.match(helper,/event\.dataTransfer\.dropEffect = 'none'/);
});

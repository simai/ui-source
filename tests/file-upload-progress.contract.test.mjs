import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('FileUpload supplies the same authoritative value to ProgressBar data, initial fill and label',async()=>{
  const source=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
  assert.match(source,/progressBar\.dataset\.value = String\(progress\)/);
  assert.match(source,/progressBar\.dataset\.textPosition = 'inline-end'/);
  assert.match(source,/progressValue\.style\.width = `\$\{progress\}%`/);
  assert.match(source,/progressText\.textContent = `\$\{progress\}%`/);
});

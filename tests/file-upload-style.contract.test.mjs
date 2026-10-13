/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('FileUpload preserves base callback registration before rebinding its runtime',async()=>{
  const source=await readFile(new URL('../src/smart/file-upload/index.js',import.meta.url),'utf8');
  assert.match(source,/afterRender\(callback\) \{\s*if \(typeof callback === 'function'\) return super\.afterRender\(callback\);\s*this\._boundRoot/);
});

test('FileUpload styles its existing drop zone once, without duplicating styles on file rows',async()=>{
  const source=await readFile(new URL('../src/smart/file-upload/js/templates/default.js',import.meta.url),'utf8');
  assert.equal((source.match(/style=\$\{context.rootStyle \|\| nothing\}/g)||[]).length,1);
  assert.match(source,/class=\$\{rootClasses\.join\(' '\)\}\s*style=\$\{context.rootStyle \|\| nothing\}\s*data-render-managed/);
});

test('Smart FileUpload uses the upload action icon as its neutral default',async()=>{
  const [source,manifest]=await Promise.all([
    readFile(new URL('../src/smart/file-upload/index.js',import.meta.url),'utf8'),
    readFile(new URL('../src/smart/file-upload/smart.manifest.json',import.meta.url),'utf8').then(JSON.parse),
  ]);
  assert.match(source,/icon: \{ default: 'upload_file' \}/);
  assert.match(source,/return this\.getAttribute\('icon'\) \|\| 'upload_file'/);
  assert.equal(manifest.inputs.properties.icon.default,'upload_file');
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../src/${p}`,import.meta.url),'utf8');
test('FileUpload distinguishes surface and control semantic radii without removing corner overrides',async()=>{
  const css=await read('component/file-upload/scss/_css__file_upload.scss');
  assert.equal((css.match(/var\(--sf-file-upload--border-[a-z-]+-radius, var\(--sf-radius--surface\)\)/g)||[]).length,4);
  for(const path of ['component/file-upload/js/_file_upload.js','smart/file-upload/js/templates/default.js'])assert.doesNotMatch(await read(path),/sf-icon-button[^\n]*radius-default/);
});
test('FileUpload file rows wrap unbroken content and preserve action/icon geometry',async()=>{
  const css=await read('component/file-upload/scss/_css__upload_progress.scss');
  assert.match(css,/\.sf-upload-progress \{\s*min-inline-size: 0;/);
  assert.match(css,/\.sf-upload-progress-name,\s*\.sf-upload-progress-text,\s*\.sf-upload-progress-repeat \{\s*overflow-wrap: anywhere/);
  for(const name of ['content','top','left'])assert.match(css,new RegExp(`\\.sf-upload-progress-${name} \\{\\s*min-inline-size: 0;`));
  assert.match(css,/\.sf-icon-button \{\s*flex-shrink: 0/);
  assert.match(css,/\.sf-upload-progress-repeat \{[^}]*max-inline-size: 100%/);
});

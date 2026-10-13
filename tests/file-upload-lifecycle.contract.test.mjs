import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const ordinary=await readFile(new URL('../src/component/file-upload/js/_file_upload.js',import.meta.url),'utf8');
const smart=await readFile(new URL('../src/smart/file-upload/index.js',import.meta.url),'utf8');

test('FileUpload binding follows listener identity and exact bound nodes, not a cloneable marker',()=>{
  assert.match(ordinary,/typeof root\.__sfFileUploadOnClick === 'function'/);
  assert.match(ordinary,/root\.__sfFileUploadBoundInput === input && root\.__sfFileUploadBoundFiles === filesContainer/);
  assert.match(ordinary,/const input = root\.__sfFileUploadBoundInput \|\| getInput\(root\)/);
  assert.match(ordinary,/const filesContainer = root\.__sfFileUploadBoundFiles \|\| getFilesContainer\(root\)/);
  assert.doesNotMatch(ordinary,/if \(!root \|\| root\.dataset\[FILE_UPLOAD_BOUND_FLAG\]/);
});

test('FileUpload disposes detached ordinary roots without taking ownership of Smart lifecycle',()=>{
  assert.match(ordinary,/mutation\.removedNodes\.forEach/);
  assert.match(ordinary,/!root\.isConnected && !root\.closest\('sf-file-upload'\)/);
  assert.match(ordinary,/root\.isConnected && !root\.closest\('sf-file-upload'\)/);
  const unbind=ordinary.slice(ordinary.indexOf('function unbindFileUpload('),ordinary.indexOf('function initExistingFileUploads('));
  assert.doesNotMatch(unbind,/__sfFileUploadItems|setFileUploadItems|renderFileUploadItems|dispatchEvent/);
});

test('FileUpload copied default render is cleared only through the existing first-render hook',()=>{
  assert.match(smart,/shouldClearLightDomBeforeFirstRender\(\)/);
  assert.match(smart,/super\.shouldClearLightDomBeforeFirstRender\(\)/);
  assert.match(smart,/this\.templateName === 'default'/);
  assert.match(smart,/:scope > \.sf-file-upload\[data-render-managed="1"\]/);
  assert.doesNotMatch(smart,/replaceChildren\(|innerHTML\s*=/);
});

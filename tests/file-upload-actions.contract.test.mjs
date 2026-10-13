import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('ordinary and Smart FileUpload compose the complete non-stretching Icon Button contract',async()=>{
  for(const file of ['src/component/file-upload/js/_file_upload.js','src/smart/file-upload/js/templates/default.js']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    const classes=source.match(/sf-icon-button sf-icon-button--icon[^\n]+/g)||[];
    assert.equal(classes.length,file.startsWith('src/component')?2:1,file);
    for(const value of classes){
      assert.match(value,/sf-icon-button--size-\$\{/);
      assert.match(value,/flex items-cross-center content-main-center self-cross-start/);
    }
  }
});

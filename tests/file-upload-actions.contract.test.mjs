import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('ordinary and Smart FileUpload compose the complete non-stretching Icon Button contract',async()=>{
  // The class row draws its own remove button; a Smart row is sf-file-preview
  // (C81), whose buttons are the preview's (file-preview-c149).
  for(const file of ['src/component/file-upload/js/_file_upload.js']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    const classes=source.match(/sf-icon-button sf-icon-button--icon[^\n]+/g)||[];
    // One remove button per row, in every state (FU-4).
    assert.equal(classes.length,1,file);
    // The class row is the family row (C81, RG-FU-1): the sf-file-preview
    // row's own remove button, size 1 at every zone size, as the Smart row.
    for(const value of classes){
      assert.match(value,/sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1'/);
    }
  }
});

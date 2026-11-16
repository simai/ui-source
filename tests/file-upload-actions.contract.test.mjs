import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('ordinary and Smart FileUpload compose the complete non-stretching Icon Button contract',async()=>{
  // The class row draws its own remove button; a Smart row is sf-file-preview
  // (C81), whose buttons are the preview's (file-preview-c149).
  for(const file of ['src/component/file-upload/js/_file_upload.js']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    const classes=source.match(/sf-icon-button sf-icon-button--icon[^\n]+/g)||[];
    // One remove button per row, in every state (FU-4), and «Повторить» as
    // the icon alone a narrow failed row draws in place of its words (C260).
    assert.equal(classes.length,2,file);
    // The class row is the family row (C81, RG-FU-1): the sf-file-preview
    // row's own remove button, size 1 at every zone size, as the Smart row;
    // the retry icon is the same ghost primary on the same rung.
    assert.match(classes[0],/sf-icon-button--ghost sf-icon-button--primary sf-icon-button--size-1'/);
    assert.match(classes[1],/sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1'/);
  }
});

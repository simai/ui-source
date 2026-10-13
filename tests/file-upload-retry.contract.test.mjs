import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
test('FileUpload retry uses semantic control insets with an internal focus ring',async()=>{
  const css=await readFile(new URL('../src/component/file-upload/scss/_css__upload_progress.scss',import.meta.url),'utf8');
  // The retry control sits inside the upload panel, so the shared ring turns
  // inwards instead of spilling over the panel edge.
  assert.match(css,/outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.match(css,/outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  assert.match(css,/outline-offset: calc\(var\(--sf-focus-outline-width\) \* -1\)/);
  assert.match(css,/--sf-upload-progress-repeat--radius: var\(--sf-radius--ui\)/);
  for(const size of ['1\\/2','1','2']){
    assert.ok(css.includes(`--sf-upload-progress-repeat--padding-block: var(--sf-ui-${size}--space-y-tightness-default)`));
    assert.ok(css.includes(`--sf-upload-progress-repeat--padding-inline: var(--sf-ui-${size}--space-x)`));
  }
  assert.doesNotMatch(css,/outline-offset: var\(--sf-focus-outline-width\)/);
});

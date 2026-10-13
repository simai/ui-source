import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('dropdown size profiles set a minimum height instead of clipping content',async()=>{
  const source=await read('src/component/dropdown/scss/_css__dropdown.scss');
  for(const size of ['1\\/2','1','2'])assert.ok(source.includes(`min-block-size: var(--sf-ui-${size}--control-height)`));
  assert.doesNotMatch(source,/(?<!min-)block-size:\s*var\(--sf-ui-/);
});

test('dropdown tag layout reserves the toggle and keeps a long tag on one line',async()=>{
  const source=await read('src/component/dropdown/scss/_css__custom.scss');
  assert.match(source,/\.sf-dropdown\.sf-dropdown--tag > \.sf-dropdown-field > button\s*\{\s*position: static;\s*flex-shrink: 0;/);
  // a tag in the field ends in an ellipsis: wrapping inside it grew a 220px field to 328px
  assert.match(source,/\.sf-dropdown-tag-container \.sf-tag-container\s*\{\s*min-inline-size: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
  assert.ok(source.includes('max-inline-size: 100%'));
  assert.match(source,/\[role="option"\] \.sf-list-item-container\s*\{\s*overflow-wrap: anywhere;/);
  const template=await read('src/smart/dropdown/js/templates/default.js');
  assert.ok(template.includes('sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${iconButtonSize}"'));
});

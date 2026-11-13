import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('Smart author CSSOM is stable and isolated from the boxless host style',async()=>{
  const source=await read('src/core/js/smart-base.js');
  assert.match(source,/get style\(\)/);
  assert.match(source,/return this\._authorStyleElement\.style/);
  assert.match(source,/flushAuthorStyle\(\)/);
  assert.match(source,/set style\(value\)/);
  assert.doesNotMatch(source,/HTMLElement\.prototype\.[\w]+\s*=/);
  const apply=source.slice(source.indexOf('  applyHostDisplayStyle() {'),source.indexOf('  getRootStyle() {'));
  // The host keeps what its markup inherits (custom properties, colour, the
  // font but its size) beside display: contents, written without being read
  // back as author style.
  assert.match(apply,/\[this\.hostInheritedStyle\(\), "display: contents;"\]/);
  assert.match(apply,/this\.writeHostStyle\(nextStyle\)/);
  const inherited=source.slice(source.indexOf('  hostInheritedStyle() {'),source.indexOf('  writeHostStyle('));
  assert.match(inherited,/name\.startsWith\("--"\)/);
  assert.match(inherited,/HOST_INHERITED_PROPERTIES\.has\(name\)/);
  const list=source.slice(source.indexOf('const HOST_INHERITED_PROPERTIES'),source.indexOf(']);',source.indexOf('const HOST_INHERITED_PROPERTIES')));
  assert.match(list,/"color"/);
  // A relative size held on the host and again on the root would compound.
  assert.doesNotMatch(list,/"font-size"|"font"[,\s]/);
  const get=source.slice(source.indexOf('  getRootStyle() {'),source.indexOf('  setRootClass('));
  assert.match(get,/this\.flushAuthorStyle\(\)/);
  assert.match(get,/\[this\._hostStyle, this\.getAttribute\("root-style"\)\]/);
});

test('Input and Textarea expose the existing root-style contract on their actual roots',async()=>{
  const input=await read('src/smart/input/js/templates/default.js');
  assert.equal((input.match(/style=\$\{rootStyle \|\| nothing\}/g)||[]).length,2);
  const textarea=await read('src/smart/input-textarea/js/templates/default.js');
  assert.match(textarea,/context\.rootClass/);
  assert.match(textarea,/style=\$\{context\.rootStyle \|\| nothing\}/);
});

test('Breadcrumbs wrapper setup does not write through the author CSSOM',async()=>{
  const source=await read('src/smart/breadcrumbs/index.js');
  assert.match(source,/this\.applyHostDisplayStyle\(\)/);
  assert.doesNotMatch(source,/this\.style\.display\s*=/);
});

for (const kind of ['checkbox', 'radio', 'switch']) {
  test(`${kind} applies root customization to the label without replacing its native input`,async()=>{
    const source=await read(`src/smart/${kind}/js/templates/default.js`);
    assert.match(source,/rootClass/);
    // The label also listens for clicks from the help (keepHelpOutOfLabel).
    assert.match(source,/<label class=\$\{[^\n]+\} style=\$\{(?:context\.)?rootStyle \|\| nothing\}(?: @click=\$\{keepHelpOutOfLabel\})?>/);
    assert.match(source,/<input\s/);
    assert.doesNotMatch(source,/unsafeHTML|innerHTML\s*=/);
  });
}

for (const kind of ['button', 'button-icon', 'button-close', 'segmented', 'badge', 'progress-bar', 'progress-scale', 'spinner', 'reference-link', 'file-download', 'alert', 'toast']) {
  test(`${kind} consumes common root classes and styles in its default template`,async()=>{
    const source=await read(`src/smart/${kind}/js/templates/default.js`);
    assert.match(source,/rootClass/);
    assert.match(source,/style=\$\{context\.rootStyle \|\| nothing\}/);
    // The row of each view takes them: the link, the button, the failed row and the ready one that offers «Скачать» (C51).
    if(kind==='file-download') assert.equal((source.match(/style=\$\{context\.rootStyle \|\| nothing\}/g)||[]).length,4);
  });
}

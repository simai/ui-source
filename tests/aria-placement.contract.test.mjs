import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

/* An accessibility sweep of every component example (axe, WCAG 2.1 A/AA) found
   ARIA written where it is not allowed or never read, and controls with no
   name. Each case below names where the state or name belongs instead. */
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('dropdown: open and disabled state live on the trigger, not on the root div', async () => {
  const source = await read('component/dropdown/js/_dropdown.js');
  assert.doesNotMatch(source, /root\.setAttribute\(\s*["']aria-(expanded|disabled)["']/);
  assert.match(source, /trigger\.tagName !== "BUTTON"[\s\S]{0,80}aria-disabled/);
  const smart = await read('smart/dropdown/js/templates/default.js');
  const root = smart.slice(smart.indexOf('return html`\n    <div'), smart.indexOf('>', smart.indexOf('return html`\n    <div')));
  assert.doesNotMatch(root, /aria-expanded|aria-label/);
});

test('country code: a fixed country is a picture, not a control with a name', async () => {
  const source = await read('component/country-code/js/_country_code.js');
  const branch = source.slice(source.indexOf('// With one fixed country'), source.indexOf('toggle.tabIndex = -1;', source.indexOf('// With one fixed country')));
  assert.match(branch, /removeAttribute\('aria-disabled'\)/);
  assert.match(branch, /removeAttribute\('aria-label'\)/);
});

test('file upload: each progress bar is named after its file', async () => {
  const source = await read('component/file-upload/js/_file_upload.js');
  // The word itself lives in a dictionary a product can add a language to; what
  // this contract is about is that each bar is named after its own file.
  assert.match(source, /pageText\(FILE_UPLOAD_ITEM_TEXT, 'uploading'/);
  assert.match(source, /host\.setAttribute\('label', label\)/);
});

test('tabs: an icon-only tab is named on its inner button, not on the host', async () => {
  const template = await read('smart/tabs/js/templates/default.js');
  const icon = template.slice(template.indexOf('<sf-icon-button'), template.indexOf('</sf-icon-button>'));
  assert.doesNotMatch(icon, /aria-label=/);
  assert.match(icon, /data-tab-label=/);
  assert.match(await read('smart/tabs/index.js'), /tab\.setAttribute\('aria-label', item\.label\)/);
});

test('tree: items written straight inside an item are gathered into a group', async () => {
  const source = await read('component/tree/js/_tree.js');
  assert.match(source, /function ensureTreeGroup\(item\)/);
  assert.match(source, /ensureTreeGroup\(item\);\s*const branch = isBranch\(item\);/);
});

test('scrollbar: the scrolling area is the keyboard stop, the thumb is for the pointer', async () => {
  const source = await read('component/scrollbar/js/_scrollbar.js');
  assert.match(source, /thumb\.tabIndex = -1;/);
  assert.match(source, /viewport\.tabIndex = 0;/);
  assert.match(source, /viewport\.setAttribute\('role', 'region'\)/);
});

test('doc: code inside an inverse source block takes the block colour', async () => {
  assert.match(await read('component/doc/scss/_sf_css_doc.scss'), /:is\(\.sf-doc-source, \.source\) code \{\s*color: inherit;/);
});

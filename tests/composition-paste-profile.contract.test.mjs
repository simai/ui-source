import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PASTE_BLOCKS,
  RICH_TEXT_PROFILES,
  cleanTree,
  parseHtml,
  sanitizeRichText,
  serialize,
} from '../src/core/js/composition/html-subset.mjs';

// simai/ui-source#66: html@1 stays as it is stored; the paste profile of a
// structured-content editor keeps a code block and a simple table as blocks
// of their own, cleaned by the same rule.

const paste = (html) => cleanTree(parseHtml(html), {profile: 'paste'});
const text = (value, marks = {}) => ({kind: 'text', value, strong: Boolean(marks.strong), em: Boolean(marks.em), href: marks.href ?? null});
const br = {kind: 'br', strong: false, em: false, href: null};

test('the profiles are named and an unknown one is refused', () => {
  assert.deepEqual(RICH_TEXT_PROFILES, ['html', 'paste']);
  assert.deepEqual(PASTE_BLOCKS, ['pre', 'table']);
  assert.throws(() => cleanTree(parseHtml('<p>a</p>'), {profile: 'html2'}), /rich_text_profile_unknown/u);
});

test('a pasted pre keeps its lines and indentation; its markup and scripts go', () => {
  const blocks = paste('<p>Before</p><pre>\nconst a = 1;\n  if (a) {<script>steal()</script>\r\n    go(<b>a</b>);<br>  }\n\n</pre>');
  assert.deepEqual(blocks, [
    {type: 'p', leaves: [text('Before')]},
    {type: 'pre', text: 'const a = 1;\n  if (a) {\n    go(a);\n  }'},
  ]);
  assert.deepEqual(paste('<pre>   \n\n</pre>'), [], 'an empty pre is not kept');
  assert.deepEqual(paste('<listing>x\n y</listing>'), [{type: 'pre', text: 'x\n y'}]);
});

test('a pasted simple table keeps its rows, header cells, caption and inline marks', () => {
  const blocks = paste(`<table><caption>Prices <i>today</i></caption>
    <thead><tr><th>Name</th><th>Cost</th></tr></thead>
    <tbody><tr><td><b>Tea</b> <a href="https://example.com/t">link</a> <a href="javascript:alert(1)">bad</a></td><td><p>1</p><p>2</p></td></tr>
    <tr><td> </td><td></td></tr>
    <tr><th>Total</th><td><ul><li>a</li><li>b</li></ul></td></tr></tbody></table>`);
  assert.deepEqual(blocks, [{
    type: 'table',
    caption: [text('Prices '), text('today', {em: true})],
    rows: [
      {head: true, cells: [{header: true, leaves: [text('Name')]}, {header: true, leaves: [text('Cost')]}]},
      {head: false, cells: [
        {header: false, leaves: [text('Tea', {strong: true}), text(' '), text('link', {href: 'https://example.com/t'}), text(' bad')]},
        {header: false, leaves: [text('1'), br, text('2')]},
      ]},
      {head: false, cells: [{header: true, leaves: [text('Total')]}, {header: false, leaves: [text('a'), br, text('b')]}]},
    ],
  }]);
  assert.deepEqual(paste('<table><tr><td>a</td></tr></table>'), [{type: 'table', caption: [], rows: [{head: false, cells: [{header: false, leaves: [text('a')]}]}]}], 'rows straight in the table');
  assert.deepEqual(paste('<table><tr><td> </td></tr></table>'), [], 'a table with no text is not kept');
});

test('inside a list item or a cell the paste profile reads as html@1', () => {
  assert.deepEqual(paste('<ul><li><pre>a\nb</pre></li></ul>'), cleanTree(parseHtml('<ul><li><pre>a\nb</pre></li></ul>')));
  const nested = paste('<table><tr><td>x<table><tr><td>y</td></tr></table></td></tr></table>');
  assert.deepEqual(nested[0].rows[0].cells[0].leaves, [text('x'), br, text('y')]);
});

test('html@1 is unchanged: no pre or table in a value, and serialize of paste blocks stays in the subset', () => {
  const html = '<pre>a\n  b</pre><table><tr><th>H</th></tr><tr><td><b>c</b></td></tr></table>';
  assert.equal(sanitizeRichText(html, {document: null}), '<p>a<br>b</p><p>H</p><p><strong>c</strong></p>');
  const written = serialize(paste(html));
  assert.equal(written, '<p>a<br>b</p><p>H</p><p><strong>c</strong></p>');
  assert.doesNotMatch(written, /<(pre|table|tr|td|th)\b/u);
  assert.equal(sanitizeRichText(written, {document: null}), written, 'what serialize writes is a clean html@1 value');
});

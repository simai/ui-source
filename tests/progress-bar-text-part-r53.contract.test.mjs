import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// RG-R-53: sf-progress-bar patched its drawn markup through the class
// (setProgressBarState), whose textContent took out Lit's marker and text
// node; the element's next drawing then wrote into a removed node
// («Cannot set properties of null (setting 'data')»).

const ordinary = await readFile(new URL('../src/component/progress-bar/js/_progressbar.js', import.meta.url), 'utf8');
const smart = await readFile(new URL('../src/smart/progress-bar/index.js', import.meta.url), 'utf8');

// The class's writeText, taken from the source and run over a small node
// model: a renderer's comment marker and its text node, as Lit leaves them.
function loadWriteText() {
  const start = ordinary.indexOf('function writeText(node, text) {');
  assert.ok(start > 0, 'the class writes text through writeText');
  const end = ordinary.indexOf('\n}\n', start) + 2;
  const Node = {TEXT_NODE: 3, COMMENT_NODE: 8};
  // eslint-disable-next-line no-new-func
  return new Function('Node', `${ordinary.slice(start, end)}; return writeText;`)(Node);
}

function element(children) {
  const node = {
    childNodes: children,
    get textContent() { return this.childNodes.filter((child) => child.nodeType === 3).map((child) => child.data).join(''); },
    set textContent(value) { this.childNodes = [{nodeType: 3, data: value}]; },
  };
  return node;
}

test('a drawn value text keeps the renderer marker and text node; the value is written into that node', () => {
  const writeText = loadWriteText();
  const marker = {nodeType: 8, data: '?lit$1$'};
  const text = {nodeType: 3, data: '0%'};
  const node = element([marker, text]);
  writeText(node, '12%');
  assert.equal(node.childNodes.length, 2);
  assert.equal(node.childNodes[0], marker, 'the marker stays');
  assert.equal(node.childNodes[1], text, 'the same text node stays');
  assert.equal(text.data, '12%');
  // What Lit does next: the marker's next sibling is the text it writes.
  const nextSibling = node.childNodes[node.childNodes.indexOf(marker) + 1];
  assert.ok(nextSibling, 'the renderer still finds its text node');
  nextSibling.data = '36%';
  assert.equal(node.textContent, '36%');
});

test('class markup without a renderer takes the text as before', () => {
  const writeText = loadWriteText();
  const node = element([]);
  writeText(node, '40%');
  assert.equal(node.textContent, '40%');
  const same = node.childNodes[0];
  writeText(node, '40%');
  assert.equal(node.childNodes[0], same, 'an unchanged text is not rewritten');
});

test('the class writes the value and the label only through writeText', () => {
  assert.doesNotMatch(ordinary, /labelNode\.textContent\s*=/);
  assert.doesNotMatch(ordinary, /textNode\.textContent\s*=/);
  assert.match(ordinary, /writeText\(labelNode, label\)/);
  assert.match(ordinary, /writeText\(textNode, `\$\{value\}%`\)/);
});

test('sf-progress-bar draws every change with its template, never by patching the drawn markup', () => {
  assert.doesNotMatch(smart, /resolveUpdateMode\s*\(/);
  assert.doesNotMatch(smart, /updateDom\s*\(/);
  assert.doesNotMatch(smart, /import \{[^}]*setProgressBarState/);
  assert.match(smart, /afterRender\(\) \{[\s\S]*bindProgressBar\(this\._boundRoot\)/);
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source = await readFile(new URL('../src/component/tabs/js/_tabs.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/component/tabs/scss/_css__tabs.scss', import.meta.url), 'utf8');
function runtime() {
  const nodes = [];
  // Path ids (standard 1.3.8 §7.1.1): a stand-in that names a root by its id.
  const context = vm.createContext({CSS: {escape: x => x},
    instancePath: (root) => `page/${root.id}`, partId: (path, local) => `${path.replace(/\W+/gu, '-')}--${local}`, document: {
    getElementById: id => nodes.find(e => e.id === id),
    querySelectorAll: selector => nodes.filter(e => `#${e.id}` === selector),
  }});
  vm.runInContext(source.slice(source.indexOf('const TABS_SELECTOR'), source.indexOf('\nclass Tabs')), context);
  return {context, nodes};
}
test('ordinary Tabs respects native, ARIA and legacy disabled controls', () => {
  const {context} = runtime();
  for (const [native, aria, legacy, expected] of [[false, null, false, false], [true, null, false, true], [false, 'true', false, true], [false, 'false', true, true]]) {
    assert.equal(context.isDisabled({disabled: native, getAttribute: () => aria, classList: {contains: () => legacy}}), expected);
  }
});
test('ordinary Tabs stable generated IDs repair copied IDs but retain unique author IDs', () => {
  const {context, nodes} = runtime();
  const first = {id: ''}, second = {id: ''}, author = {id: 'project-tab'}; nodes.push(first, second, author);
  const one = {id: 'one'}, two = {id: 'two'};
  const id = context.ensureId(one, first, 'tab', 0); assert.equal(context.ensureId(one, first, 'tab', 0), id);
  assert.equal(id, 'page-one--tab-0', 'the tab group\'s path id and the local name, not a counter (#41)');
  second.id = id; context.ensureId(two, second, 'tab', 0); assert.notEqual(second.id, first.id);
  assert.equal(context.ensureId(one, author, 'tab', 1), 'project-tab');
});
test('ordinary Tabs initial configured index and selection remain backward compatible', () => {
  const {context} = runtime();
  const buttons = [false, true].map(selected => ({classList: {contains: () => selected}}));
  assert.equal(context.getInitialIndex({getAttribute: () => null}, buttons), 1);
  assert.equal(context.getInitialIndex({getAttribute: name => name === 'data-active-index' ? '0' : null}, buttons), 0);
  assert.equal(context.normalizeIndex('9', 2), 0);
});
test('ordinary Tabs uses weak listener ownership and observes live source inputs, not paint output', () => {
  assert.match(source, /const boundTabs = new WeakSet\(\)/);
  assert.match(source, /if \(boundTabs.has\(root\)\) return/);
  assert.doesNotMatch(source, /dataset\[TABS_BOUND_FLAG\] ===/);
  assert.match(source, /attributeFilter: \['class', 'disabled', 'aria-disabled', 'data-active-index'/);
  assert.match(source, /root.dataset.activeIndex !== String\(activeIndex\)/);
  assert.match(source, /if \(button.classList.contains\(SELECTED_CLASS\) !== active\)/);
});
test('Tabs control geometry uses UI radius and border tokens, not surface radius or literal dimensions', () => {
  assert.doesNotMatch(css, /var\(--sf-radius-default\)|\b\d+(?:\.\d+)?(?:px|rem|em)\b/);
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /var\(--sf-tabs--border-width, var\(--sf-px\)\)/);
  assert.match(css, /var\(--sf-radius-rounded\)/);
  assert.match(css, /var\(--sf-radius-square\)/);
});

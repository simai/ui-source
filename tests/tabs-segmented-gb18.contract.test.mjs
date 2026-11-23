import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// A small attribute list in DOM order: setAttribute keeps an existing
// attribute's place and appends a new one, removeAttribute takes it out.
function fakeButton(names) {
  const list = names.map(([name, value]) => ({name, value}));
  return {
    attributes: list,
    hasAttribute: (name) => list.some((one) => one.name === name),
    getAttribute: (name) => list.find((one) => one.name === name)?.value ?? null,
    setAttribute(name, value) {
      const one = list.find((item) => item.name === name);
      if (one) one.value = value; else list.push({name, value});
    },
    removeAttribute(name) {
      const at = list.findIndex((one) => one.name === name);
      if (at >= 0) list.splice(at, 1);
    },
  };
}

function settleFromSource() {
  const source = read('src/smart/tabs/index.js');
  const match = source.match(/const TAB_OWN_ATTRIBUTES = [\s\S]*?\nfunction settleForwardedAttributes\(tab\) \{[\s\S]*?\n\}\n/u);
  assert.ok(match, 'settleForwardedAttributes is in sf-tabs');
  return new Function(`${match[0]}; return settleForwardedAttributes;`)();
}

// VO-1 (View round 16 acceptance): the view-board phone snapshot read stale
// by chance -- data-sf-tab-index before id when the button host forwarded
// before the tabs wrote their attributes, after tabindex when it forwarded
// again later.
test('VO-1: a forward before the tabs wrote their attributes ends in the order a later forward writes', () => {
  const settle = settleFromSource();
  const early = fakeButton([['type', 'button'], ['class', 'sf-button'], ['data-sf-tab-index', '0'], ['id', 't--tab-0'], ['role', 'tab'], ['aria-selected', 'true'], ['tabindex', '0']]);
  const host = {__sfHostDataAttributeTarget: early, __sfHostDataAttributeTargetKeys: '__keys'};
  early.parentElement = host;
  early.__keys = new Set(['data-sf-tab-index']);
  settle(early);
  assert.deepEqual(early.attributes.map((one) => one.name), ['type', 'class', 'id', 'role', 'aria-selected', 'tabindex', 'data-sf-tab-index']);
  assert.equal(early.getAttribute('data-sf-tab-index'), '0');
});

test('VO-1: the forwarded names keep the host order (data-sf-tab-index, data-tooltip) and an ordered button is left alone', () => {
  const settle = settleFromSource();
  const button = fakeButton([['type', 'button'], ['data-sf-tab-index', '1'], ['data-tooltip', 'h'], ['id', 'x'], ['tabindex', '-1']]);
  button.parentElement = {__sfHostDataAttributeTarget: button, __sfHostDataAttributeTargetKeys: '__keys'};
  button.__keys = new Set(['data-sf-tab-index', 'data-tooltip']);
  settle(button);
  const order = button.attributes.map((one) => one.name);
  assert.deepEqual(order, ['type', 'id', 'tabindex', 'data-sf-tab-index', 'data-tooltip']);
  let writes = 0;
  const set = button.setAttribute;
  button.setAttribute = (...args) => { writes += 1; set(...args); };
  settle(button);
  assert.equal(writes, 0, 'nothing moves when the order already holds');
});

test('VO-1: a name another part adds after the tabs (a tooltip aria-describedby) stays after the forwarded names', () => {
  const settle = settleFromSource();
  const button = fakeButton([['type', 'button'], ['id', 'x'], ['tabindex', '0'], ['data-sf-tab-index', '1'], ['data-tooltip', 'h'], ['aria-describedby', 'h']]);
  button.parentElement = {__sfHostDataAttributeTarget: button, __sfHostDataAttributeTargetKeys: '__keys'};
  button.__keys = new Set(['data-sf-tab-index', 'data-tooltip']);
  settle(button);
  assert.deepEqual(button.attributes.map((one) => one.name), ['type', 'id', 'tabindex', 'data-sf-tab-index', 'data-tooltip', 'aria-describedby']);
});

test('VO-1: a tab that is not a forwarded button (an icon link drawn by the tabs) is not touched', () => {
  const settle = settleFromSource();
  const link = fakeButton([['data-sf-tab-index', '0'], ['href', '/a']]);
  link.parentElement = {};
  settle(link);
  assert.deepEqual(link.attributes.map((one) => one.name), ['data-sf-tab-index', 'href']);
});

test('VO-1: sf-tabs settles the order after it writes the tab semantics', () => {
  const source = read('src/smart/tabs/index.js');
  assert.match(source, /tab\.tabIndex = item === tabStop \? 0 : -1;\n      settleForwardedAttributes\(tab\);/u);
});

// FL-1 (View round 16, msg-987a9dd6): folded, the dropdown's place was read
// at its own full width (508 px) while the track had 462 for a need of 491:
// unfold, squeeze, fold, about 25 times a frame.
test('FL-1: folded, sf-segmented reads the place with the narrow at the track one-line width', () => {
  const source = read('src/smart/segmented/index.js');
  assert.match(source, /narrow\.style\.inlineSize = `\$\{need\}px`;\n      narrow\.style\.maxInlineSize = '100%';\n      const room = layoutWidth\(narrow\);/u);
  assert.match(source, /if \(own === null\) narrow\.removeAttribute\('style'\);\n      else narrow\.setAttribute\('style', own\);/u);
});

test('FL-1: a resize the observer sees is answered in the next frame, the first drawing at once', () => {
  const source = read('src/smart/segmented/index.js');
  assert.match(source, /new ResizeObserver\(\(\) => this\.scheduleFit\(\)\)/u);
  assert.match(source, /this\._fitFrame = requestAnimationFrame\(\(\) => \{\n      this\._fitFrame = 0;\n      this\.checkFit\(\);/u);
  assert.match(source, /this\.observeFit\(\);\n    this\.checkFit\(\);/u);
  assert.match(source, /if \(this\._fitFrame\) cancelAnimationFrame\(this\._fitFrame\);/u);
});

test('Docara admission: sf-tabs has a panels example with a host id and page-owned panels, and the id rule is documented', () => {
  const examples = JSON.parse(read('src/smart/tabs/examples.json')).examples;
  const panels = examples.find((one) => one.name === 'panels');
  assert.ok(panels);
  assert.equal(panels.attributes.id, 'order');
  assert.equal((panels.children.match(/role="tabpanel" data-entry="/gu) ?? []).length, panels.settings.items.length);
  assert.equal((panels.children.match(/ hidden>/gu) ?? []).length, panels.settings.items.length - 1);
  const docs = read('src/smart/tabs/docs/docs.md');
  for (const id of ['page-<id>--tab-<n>', 'page-<id>--label-<n>', 'page-<id>--panel-<n>']) assert.ok(docs.includes(id), id);
});

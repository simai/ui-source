import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Ids from the instance's role path (standard simai.smart-component 1.3.8
// §7.1.1; simai/ui-source#41): never a module counter, the same answer from
// every bundle, and class markup told apart from the Smart element of the
// same name. The browser half is tests/browser/switch-manifest.browser.mjs
// (a class quantity and an <sf-quantity> on one page).

const {instancePath, partId} = await import('../src/core/js/instance-path.js');
const {createFieldContract} = await import('../src/component/field-contract.js');

// A page just big enough: elements with a tag, classes, id and data-sf-role.
function page() {
  const all = [];
  const doc = {
    querySelectorAll(selector) {
      return all.filter((one) => (selector.startsWith('.') ? one.classes.includes(selector.slice(1)) : one.localName === selector));
    },
  };
  const make = (localName, {id = '', role = '', classes = [], parent = null} = {}) => {
    const one = {
      nodeType: 1, localName, id, classes, parentNode: parent, ownerDocument: doc, isConnected: true,
      getAttribute: (name) => (name === 'data-sf-role' ? role || null : null),
    };
    all.push(one);
    return one;
  };
  return {doc, make};
}

test('a path: page/<id>, page/<role>, <parent>/<role>, <tag>[n] in document order', () => {
  const {make} = page();
  const first = make('sf-quantity');
  const named = make('sf-quantity', {id: 'qty'});
  const second = make('sf-quantity');
  const panel = make('sf-record-panel', {id: 'record'});
  const part = make('sf-quantity', {role: 'amount', parent: panel});
  const top = make('sf-switch', {role: 'notify'});
  assert.equal(instancePath(first), 'sf-quantity[1]');
  assert.equal(instancePath(second), 'sf-quantity[2]', 'an instance with an id is not counted');
  assert.equal(instancePath(named), 'page/qty');
  assert.equal(instancePath(part), 'page/record/amount');
  assert.equal(instancePath(top), 'page/notify');
  assert.equal(partId('page/record/amount', 'control'), 'page-record-amount--control');
  assert.equal(partId('sf-quantity[2]', 'control'), 'sf-quantity-2--control');
});

test('class markup and the Smart element of the same name never share an id (#41)', () => {
  const {make} = page();
  const classRoot = make('label', {classes: ['sf-quantity']});
  const smart = make('sf-quantity');
  const a = createFieldContract(classRoot, {prefix: 'sf-quantity'});
  const b = createFieldContract(smart, {prefix: 'sf-quantity'});
  assert.equal(a.controlId, 'class-sf-quantity-1--control');
  assert.equal(b.controlId, 'sf-quantity-1--control');
  assert.notEqual(a.controlId, b.controlId);
  assert.notEqual(a.messageId, b.messageId);
});

test('swapping two instances swaps nothing but their order; an id is kept per instance', () => {
  const {make} = page();
  const one = make('sf-input');
  const first = createFieldContract(one, {prefix: 'sf-input'});
  assert.equal(createFieldContract(one, {prefix: 'sf-input'}).controlId, first.controlId);
  const withId = make('sf-input', {id: 'site'});
  assert.equal(createFieldContract(withId, {prefix: 'sf-input'}).controlId, 'page-site--control');
});

test('no Smart field writes an id from a module counter', () => {
  for (const path of ['src/component/field-contract.js', 'src/smart/quantity/index.js']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\blet \w*[Ss]equence\b|\+\+\w*[Ss]equence/u, path);
  }
});

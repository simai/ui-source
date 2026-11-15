import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {sizeOf, sizeStep, RELATIVE} from '../src/core/js/density.js';

// A popup takes the size and density of what opens it (owner remark
// 2026-11-15, recipe-list-toolbar: the row menu of sf-view-table size="1" had
// 32 px rows and 14 px text). Measured in a browser by
// tests/browser/menu-opener-size.browser.mjs; these keep the rule and the shape.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// A small element tree: tag, attributes, parent.
function element(localName, attributes = {}, parentElement = null) {
  return {
    nodeType: 1, localName, parentElement,
    hasAttribute: (name) => Object.hasOwn(attributes, name),
    getAttribute: (name) => (Object.hasOwn(attributes, name) ? attributes[name] : null),
  };
}

test('sizeOf: the opener, its component, then the Smart component holding it', () => {
  const body = element('body');
  const table = element('sf-view-table', {size: '1'}, body);
  const cell = element('td', {}, element('tr', {}, table));
  // A row's «⋯» drawn as class markup: a native button in a cell.
  assert.equal(sizeOf(element('button', {}, cell)), '1');
  // A part the table's template sized for itself follows the table.
  const drawn = element('sf-button-icon', {size: '1/2', [RELATIVE]: ''}, cell);
  assert.equal(sizeOf(element('button', {}, drawn)), '1');
  assert.equal(sizeOf(drawn), '1');
  // A size the page wrote on the opener is the opener's.
  const authored = element('sf-button', {size: '1/2'}, cell);
  assert.equal(sizeOf(element('button', {}, authored)), '1/2');
  // An unsized button's own component may stand on its default; its host decides.
  const plain = element('sf-button-icon', {}, cell);
  assert.equal(sizeOf(element('button', {}, plain)), '1');
  // Two unsized components up: the default step, not a size from far above.
  const card = element('sf-card', {size: '2'}, body);
  const toolbar = element('sf-toolbar', {}, card);
  const button = element('sf-button', {}, toolbar);
  assert.equal(sizeOf(element('button', {}, button)), null);
  assert.equal(sizeOf(null), null);
});

test('sizeStep reads a ladder step', () => {
  assert.equal(sizeStep('1/2'), 0.5);
  assert.equal(sizeStep('1'), 1);
  assert.equal(sizeStep('2'), 2);
  assert.equal(sizeStep('1/3') < 1, true);
  assert.ok(Number.isNaN(sizeStep('')));
  assert.ok(Number.isNaN(sizeStep(null)));
  assert.ok(Number.isNaN(sizeStep('large')));
});

test('sf-menu-context follows its opener on every opening; a size of its own wins', () => {
  const source = read('src/smart/menu-context/index.js');
  assert.match(source, /import \{ densityOf, followDensity, sizeOf, sizeStep \} from "\.\.\/\.\.\/core\/js\/density\.js";/);
  const open = source.slice(source.indexOf('  async openFor(anchor'), source.indexOf('  async openFor(anchor') + 7000);
  // Before the menu draws, so its rows are drawn at the step.
  assert.ok(open.indexOf('this.followOpenerSize(place);') < open.indexOf('await this.whenRendered();'));
  assert.match(open, /const place = point\?\.under \?\? anchor;/);
  const follow = source.slice(source.indexOf('  followOpenerSize(place)'), source.indexOf('  attributeChangedCallback('));
  assert.match(follow, /if \(this\.hasAttribute\("size"\) && this\._openerSize === undefined\) return;/);
  assert.match(follow, /step < 1 \? "1\/2" : "1"/);
  assert.match(source, /if \(name === "size" && !this\._writingSize\) this\._openerSize = undefined;/);
  // The density of the opener's area is still written on the surface at every opening.
  assert.match(open, /surface\.setAttribute\("data-sf-density", densityOf\(place\) \?\? "normal"\);/);
});

test('SF.menu.open leaves the size to the opener unless it is given one', () => {
  const source = read('src/core/js/menu-open.js');
  assert.match(source, /if \(size\) menu\.setAttribute\('size', String\(size\)\);\n\s*else \{\n\s*menu\.removeAttribute\('size'\);/);
  assert.match(source, /left\n\/\/ {3}out, the step of what opens it/);
});

// A slotted custom element is the slot's content, never a wrapper to unwrap
// (ui-control evidence 2026-11-12-header-page-path-slot). The base unwrapped
// any slot child whose only attribute was `slot`. <sf-breadcrumbs slot="path">
// has only that attribute until its own class connects and writes
// style="display: contents" and data-sf-started, so when sf-header-page
// upgraded first it kept the bare sf-breadcrumbs-item children and dropped
// the trail: every load on which the header's script arrived first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = readFileSync(resolve(root, 'src/core/js/smart-base.js'), 'utf8');

const capture = base.slice(base.indexOf('  captureSlotTemplates() {'), base.indexOf('  holdSlotNode(node) {'));

test('captureSlotTemplates unwraps only a plain wrapper, never a custom element', () => {
  assert.ok(capture.length > 0, 'captureSlotTemplates found');
  const decision = capture.match(/const shouldUnwrapSlotHost =([^;]+);/u);
  assert.ok(decision, 'the unwrap decision is one expression');
  assert.match(decision[1], /!child\.localName\.includes\("-"\)\s*&&/u);
  assert.match(decision[1], /child\.getAttributeNames\(\)\.length === 1 && child\.hasAttribute\("slot"\)/u);
});

// The same rule, run: the decision taken from the source over the four
// shapes a page writes, before and after the slotted element's own upgrade.
test('the decision does not change with the slotted element\'s upgrade', () => {
  const expression = capture.match(/const shouldUnwrapSlotHost =([^;]+);/u)[1];
  const decide = new Function('child', `return (${expression});`);
  const el = (localName, attributes) => ({
    localName,
    getAttributeNames: () => Object.keys(attributes),
    hasAttribute: (name) => Object.hasOwn(attributes, name),
  });
  assert.equal(decide(el('div', {slot: 'content'})), true, 'a plain wrapper gives its children');
  assert.equal(decide(el('div', {slot: 'content', class: 'x'})), false);
  assert.equal(decide(el('sf-breadcrumbs', {slot: 'path'})), false, 'not yet upgraded');
  assert.equal(decide(el('sf-breadcrumbs', {slot: 'path', style: 'display: contents;', 'data-sf-started': ''})), false, 'upgraded');
});

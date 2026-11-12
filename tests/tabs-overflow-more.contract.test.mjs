// sf-tabs overflow (owner decision C54, 2026-11-11; sf-tabs 1.2.0): what does
// not fit goes whole into «Ещё (n)», the current tab stays in the row, no fade
// and no scroll arrows; more is the default and the former scrolling row is
// overflow="scroll". The defect it closes: in the filled look at a 640 px box
// the last tab before «Ещё (n)» stood clipped, because the trigger widened
// with its count after the row was laid out and nothing laid it out again.
// Measured on the built bytes by ui-control evidence 2026-11-11-tabs-overflow-more.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/tabs/index.js');
const manifest = JSON.parse(read('src/smart/tabs/component.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));

test('overflow defaults to more; scroll and wrap stay as written values', () => {
  assert.equal(manifest.settings.overflow.default, 'more');
  assert.deepEqual(manifest.settings.overflow.values, ['scroll', 'wrap', 'more']);
  assert.match(source, /overflow: \{ default: 'more' \}/u);
  assert.match(source, /return OVERFLOWS\.includes\(value\) \? value : 'more';/u);
  assert.equal(manifest.version, '1.2.0');
  const generated = JSON.parse(read('src/smart/tabs/smart.manifest.json'));
  assert.equal(generated.version, '1.2.0');
});

test('the default change is in the change journal', () => {
  const record = journal.records.find((one) => one.id === 'behaviour-tabs-overflow-more');
  assert.ok(record, 'journal record behaviour-tabs-overflow-more');
  assert.equal(record.kind, 'behaviour');
  assert.equal(record.stage, 'compat');
  assert.equal(record.items[0].component, 'sf-tabs');
  assert.equal(record.items[0].attribute, 'overflow');
  assert.match(record.examples.after, /overflow="scroll"/u);
});

test('the row keeps the tabs in their order up to the first that does not fit, in its content box', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  assert.ok(layout.length > 0);
  // C54 return: fractional, not the rounded clientWidth.
  assert.match(layout, /const edges = \['borderInlineStartWidth', 'borderInlineEndWidth', 'paddingInlineStart', 'paddingInlineEnd'\];/u);
  assert.match(layout, /const room = \(\) => list\.getBoundingClientRect\(\)\.width - edges\.reduce\(/u);
  assert.match(layout, /if \(next > available \+ 0\.5\) break;/u);
  assert.doesNotMatch(layout, /list\.clientWidth \+ 0\.5/u);
});

test('the row is laid out again when the trigger, a late tab or the text face changes a width', () => {
  assert.match(source, /this\._resizeObserver\.observe\(trigger\);/u);
  assert.match(source, /document\.fonts\.addEventListener\('loadingdone', this\._fontsListener\);/u);
  assert.match(source, /removeEventListener\?\.\('loadingdone', this\._fontsListener\)/u);
  assert.match(source, /this\.syncTabSemantics\(\);\s*\/\/ A tab drawn after the row was laid out has its width only now;[^]*?this\.observeTabBoxes\(\);\s*this\.scheduleOverflow\(\);/u);
});

// C54 D3 (2026-11-12, ui-control evidence 2026-11-12-tabs-d3-d4): the first
// frame showed every tab clipped. A resize, the first observation included, is
// laid out in the observer's callback, before the paint, and each tab's box is
// watched, so a late sheet or text face is laid out before its frame is painted.
test('the row is laid out before the paint: in the resize observer, with every tab box watched', () => {
  assert.match(source, /new ResizeObserver\(\(\) => this\.layoutOverflowNow\(\)\)/u);
  assert.match(source, /layoutOverflowNow\(\) \{\s*if \(this\._overflowFrame\) \{\s*cancelAnimationFrame\(this\._overflowFrame\);/u);
  assert.match(source, /observeTabBoxes\(\) \{/u);
  assert.match(source, /this\._resizeObserver\.disconnect\(\);\s*this\._observedTrigger = null;\s*this\._observedTabs = null;/u);
});

// C54 return (2026-11-11), measured by ui-control evidence 2026-11-11-tabs-overflow-r2.
test('a pinned tab gives way to the current one, and only a lone current tab is shortened', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  assert.match(layout, /\?\? next\.slice\(\)\.reverse\(\)\.find\(\(at\) => at !== activeAt\);/u);
  assert.match(layout, /if \(kept\.length === 1 && kept\[0\] === activeAt && span\(kept\) > room\(\) \+ 0\.5\) \{\s*hosts\[activeAt\]\.classList\.add\('sf-tabs-squeezed'\);/u);
  assert.match(layout, /host\.classList\.remove\('sf-tabs-overflowed', 'sf-tabs-squeezed'\);/u);
  const docs = read('src/smart/tabs/docs/docs.md');
  assert.match(docs, /закреплённая уступает место выбранной/u);
  assert.match(JSON.stringify(manifest['x-decisions'][0]), /C54 return D1/u);
});

test('the row is laid out with the width «Ещё (n)» will have with its new count', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  // widthOfText, not measure: the bare word asks the Loader for the
  // text-max-width utility (class measure) the tabs never write.
  assert.match(layout, /const extra = widthOfText\(label\(count\)\) - drawn;/u);
  assert.doesNotMatch(layout, /\bmeasure\b/u);
  assert.match(layout, /if \(hosts\.length - chosen\.length === count\) kept = chosen;/u);
  assert.match(layout, /kept \?\?= choose\(free - Math\.max\(\.\.\.besides\)\);/u);
  assert.match(source, /function textWidth\(element\) \{/u);
  assert.match(JSON.stringify(manifest['x-decisions'][0]), /C54 return D2/u);
});

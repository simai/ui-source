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
// The row's arithmetic lives in the shared row engine since the tabs follow-ups
// (2026-11-12): sf-tabs and sf-contents' bar lay out by the same rules.
const engine = read('src/core/js/overflow-row.js');
const manifest = JSON.parse(read('src/smart/tabs/component.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));

test('overflow defaults to more; scroll and wrap stay as written values', () => {
  assert.equal(manifest.settings.overflow.default, 'more');
  assert.deepEqual(manifest.settings.overflow.values, ['scroll', 'wrap', 'more']);
  assert.match(source, /overflow: \{ default: 'more' \}/u);
  assert.match(source, /return OVERFLOWS\.includes\(value\) \? value : 'more';/u);
  // 1.2.0 brought the default; later minors keep it (1.3.0: R184).
  const minor = (version) => version.split('.').slice(0, 2).map(Number);
  const [major, at] = minor(manifest.version);
  assert.ok(major === 1 && at >= 2, `sf-tabs ${manifest.version} is 1.2.0 or later`);
  const generated = JSON.parse(read('src/smart/tabs/smart.manifest.json'));
  assert.equal(generated.version, manifest.version);
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
  assert.match(source, /import \{ fitInOrder, fitBesideMore, rowRoom, standardMenu, triggerExtra \} from '\.\.\/\.\.\/core\/js\/overflow-row\.js';/u);
  // C54 return: fractional, not the rounded clientWidth.
  assert.match(layout, /const room = \(\) => rowRoom\(list\);/u);
  assert.match(engine, /const edges = \['borderInlineStartWidth', 'borderInlineEndWidth', 'paddingInlineStart', 'paddingInlineEnd'\];/u);
  assert.match(engine, /return list\.getBoundingClientRect\(\)\.width - edges\.reduce\(/u);
  assert.match(engine, /const TOLERANCE = 0\.5;/u);
  assert.match(engine, /if \(next > available \+ TOLERANCE\) break;/u);
  assert.doesNotMatch(layout, /list\.clientWidth/u);
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
  assert.match(source, /new ResizeObserver\(\(entries\) => this\.onResize\(entries\)\)/u);
  // The trigger's own resize (its new count, already taken into account) is
  // laid out a frame later: in the callback, every pass of a large page ran
  // before its first paint. Unless the row now stands past its room: then it
  // is laid out at once (2 rows of 470 painted a tab clipped at 390).
  assert.match(source, /onResize\(entries\) \{\s*if \(this\.onlyOwnSizes\(entries\)\) return;\s*const later = entries\.every\(\(entry\) => entry\.target === this\._observedTrigger \|\| this\.ownSize\(entry\)\);\s*if \(later && !this\.rowOverflows\(\)\) this\.scheduleOverflow\(\);\s*else this\.layoutOverflowNow\(\);/u);
  assert.match(source, /rowOverflows\(\) \{\s*const list = this\.tabList;\s*return Boolean\(list\) && list\.scrollWidth > list\.clientWidth;/u);
  // While the host waits for its sheets the row is not laid out yet: its tabs
  // keep their room and are not shown (2029 tabs painted clipped, sheets late).
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /\[data-sf-style-pending\] > \.sf-tabs--overflow-more:not\(\.sf-tabs--vertical\) > \.sf-tabs-top-container > \.sf-tabs-top > \* \{\s*visibility: hidden;\s*\}/u);
  // Its own echo -- the tabs it hid or showed, at the widths it left them --
  // is not laid out again (each row was laid out twice per resize).
  assert.match(source, /this\._resizeObserver\.observe\(box, \{box: 'border-box'\}\)/u);
  assert.match(source, /expected\.set\(box, kept && !kept\.includes\(at\) \? 0 : widths\[at\]\);/u);
  assert.match(source, /if \(!kept\) this\.expectTabSizes\(hosts, widths, null\);/u);
  assert.match(source, /this\.expectTabSizes\(hosts, widths, kept\);\s*if \(more\) \{/u);
  assert.match(source, /const width = \(host\) => tabBox\(host\)\?\.getBoundingClientRect\(\)\.width \?\? 0;/u);
  assert.match(source, /layoutOverflowNow\(\) \{\s*if \(this\._overflowFrame\) \{\s*cancelAnimationFrame\(this\._overflowFrame\);/u);
  assert.match(source, /observeTabBoxes\(\) \{/u);
  assert.match(source, /this\._resizeObserver\.disconnect\(\);\s*this\._observedTrigger = null;\s*this\._observedTabs = null;/u);
});

// C54 return (2026-11-11), measured by ui-control evidence 2026-11-11-tabs-overflow-r2.
test('a pinned tab gives way to the current one, and only a lone current tab is shortened', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  assert.match(engine, /\?\? next\.slice\(\)\.reverse\(\)\.find\(\(at\) => at !== current\);/u);
  assert.match(engine, /const squeezed = kept\.length === 1 && kept\[0\] === current && spanOf\(widths, gap, kept\) > room \+ TOLERANCE \? current : -1;/u);
  assert.match(layout, /if \(laid\.squeezed >= 0\) hosts\[laid\.squeezed\]\.classList\.add\('sf-tabs-squeezed'\);/u);
  assert.match(layout, /host\.classList\.remove\('sf-tabs-overflowed', 'sf-tabs-squeezed'\);/u);
  const docs = read('src/smart/tabs/docs/docs.md');
  assert.match(docs, /закреплённая уступает место выбранной/u);
  assert.match(JSON.stringify(manifest['x-decisions']), /C54 return D1/u);
});

test('the row is laid out with the width «Ещё (n)» will have with its new count', () => {
  const layout = source.slice(source.indexOf('  layoutOverflow() {'), source.indexOf('  async openMore(anchor) {'));
  // widthOfText, not measure: the bare word asks the Loader for the
  // text-max-width utility (class measure) the tabs never write.
  assert.match(layout, /extra: triggerExtra\(textBox, label\)/u);
  assert.doesNotMatch(layout, /\bmeasure\b/u);
  assert.match(engine, /return \(count\) => measure\(label\(count\)\) - drawn;/u);
  assert.match(engine, /if \(widths\.length - chosen\.length === count\) kept = chosen;/u);
  assert.match(engine, /if \(!kept && besides\.length\) kept = chooseBeside\(\{widths, gap, available: room - Math\.max\(\.\.\.besides\), must, current\}\);/u);
  assert.match(engine, /export function textWidth\(element\) \{/u);
  assert.doesNotMatch(source, /function textWidth\(element\) \{/u);
  assert.match(JSON.stringify(manifest['x-decisions']), /C54 return D2/u);
});

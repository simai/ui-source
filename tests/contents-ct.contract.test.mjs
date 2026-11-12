// sf-contents 1.5.0: the defects CT-03, CT-04, CT-05, CT-09 and CT-10 of the
// R181 study (ui-control control/research/2026-11-12-contents.md, prototype
// prototypes/contents-study.html; decision C95 point 5 for CT-03). One test
// per defect, plus the row engine sf-contents shares with sf-tabs' rules
// (core/js/overflow-row.js), which runs here on numbers. Measured on the built
// bytes by ui-control evidence 2026-11-12-contents-ct (group build).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fitInOrder, chooseBeside, fitBesideMore, spanOf} from '../src/core/js/overflow-row.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/contents/index.js');
const template = read('src/smart/contents/js/templates/default.js');
const sheet = read('src/smart/contents/scss/_smart__contents.scss');
const manifest = JSON.parse(read('src/smart/contents/component.json'));
const generated = JSON.parse(read('src/smart/contents/smart.manifest.json'));
const journal = JSON.parse(read('contracts/changes/journal.json'));
const method = (name, next) => source.slice(source.indexOf(`  ${name}`), source.indexOf(`  ${next}`));

test('contents is 1.5.0 in its manifest and its generated manifest', () => {
  assert.equal(manifest.version, '1.5.0');
  assert.equal(generated.version, '1.5.0');
});

test('CT-03: fewer than two sections draw nothing, by the host state and in the printed markup', () => {
  assert.equal(manifest['host-states']['data-empty'], 'boolean');
  const collect = method('collect() {', 'scroller() {');
  assert.match(collect, /this\.sfHostState\('data-empty', sections\.length < 2\);/u);
  // The host state, and the sheet's own count for the markup a server prints.
  assert.match(sheet, /sf-contents\[data-empty\] > \.sf-contents \{\s*display: none;\s*\}/u);
  assert.match(sheet, /\n\.sf-contents:not\(:has\(\.sf-contents-item \+ \.sf-contents-item\)\) \{\s*display: none;\s*\}/u);
  // Two rules, not one list: a browser without :has must keep the host rule.
  assert.doesNotMatch(sheet, /\[data-empty\] > \.sf-contents,\s*\.sf-contents:not\(:has/u);
});

test('CT-04: the rail shows its names on a touch screen -- the first tap opens, a shown name is pressed', () => {
  const choose = method('choose(event, id) {', 'hovers() {');
  assert.match(choose, /this\.layout === 'rail' && !this\.isOpen && this\._lastPointer === 'touch' && !this\.hovers\(\)/u);
  assert.match(choose, /event\.preventDefault\(\);[^]*?this\.openList\(\);\s*return;/u);
  assert.match(choose, /this\.jumpTo\(id, event\);/u);
  assert.match(source, /get canOpen\(\) \{\s*return this\.compact \|\| this\.layout === 'rail';/u);
  assert.match(source, /if \(!this\.canOpen\) return refused\('not-compact'\);/u);
  // A chosen section, a press outside and Escape close it; Escape gives focus
  // back only to the compact button.
  assert.match(method('jumpTo(id, event = null) {', 'openList() {'), /if \(this\.isOpen\) this\.closeList\(\{restoreFocus: false\}\);/u);
  assert.match(source, /if \(restoreFocus && this\.compact\) this\.toggleButton\(\)/u);
  assert.match(sheet, /&\.sf-contents--open \.sf-contents-text \{\s*opacity: 1;\s*pointer-events: auto;\s*\}/u);
});

test('CT-05: the bar puts what does not fit into «Ещё (n)» by default, by the shared row engine', () => {
  assert.deepEqual(manifest.settings.overflow.values, ['more', 'scroll']);
  assert.equal(manifest.settings.overflow.default, 'more');
  assert.ok(manifest.relations.some((one) => one.name === 'cl-menu-context' && one.lazy === true));
  assert.match(source, /from '\.\.\/\.\.\/core\/js\/overflow-row\.js'/u);
  const layout = method('layoutOverflow() {', 'async openMore(anchor) {');
  assert.match(layout, /fitBesideMore\(\{/u);
  assert.match(layout, /must: current >= 0 \? \[current\] : \[\]/u);
  assert.doesNotMatch(layout, /for \(let at = 0; at < /u, 'no second copy of the fit loop');
  assert.match(template, /const more = layout === 'bar' && context\.overflow !== 'scroll';/u);
  assert.match(template, /<sf-button class="sf-contents-more"[^>]*aria-haspopup="menu"/u);
  assert.match(sheet, /&\.sf-contents--overflow-more \{[^]*?overflow-x: clip;/u);
  assert.match(sheet, /&:not\(\[data-more\]\) \.sf-contents-more > button/u);
  const record = journal.records.find((one) => one.id === 'behaviour-contents-bar-overflow-more');
  assert.ok(record);
  assert.equal(record.items[0].attribute, 'overflow');
  assert.match(record.examples.after, /overflow="scroll"/u);
});

test('the row engine: in order up to the first that does not fit; the current one stays; the count is its own', () => {
  const widths = [80, 60, 100, 70, 90];
  assert.equal(fitInOrder(widths, 4, 500), null);
  assert.deepEqual(fitInOrder(widths, 4, 250), [0, 1, 2]);
  // A later narrower item does not jump the queue (C54).
  assert.deepEqual(fitInOrder([80, 200, 20], 0, 110), [0]);
  // The current item (4) is put back; the last kept others give way to it.
  assert.deepEqual(chooseBeside({widths, gap: 4, available: 250, must: [4], current: 4}), [0, 1, 4]);
  // The current item alone wider than the room: kept, and squeezed.
  const alone = fitBesideMore({widths: [80, 400], gap: 0, room: 300, must: [1], current: 1});
  assert.deepEqual(alone, {kept: [1], squeezed: 1});
  // «Ещё (n)» wider with a two-digit count: the row is laid out for its own count.
  const many = Array.from({length: 14}, () => 50);
  const extra = (count) => (count >= 10 ? 8 : 0);
  const {kept} = fitBesideMore({widths: many, gap: 0, room: 210, extra});
  assert.equal(kept.length, 4);
  assert.ok(spanOf(many, 0, kept) + extra(many.length - kept.length) <= 210.5);
});

test('CT-09: the heading is a heading that names the navigation', () => {
  assert.match(template, /<div class="sf-contents-label" id=\$\{labelId\} role="heading" aria-level=\$\{String\(level\)\}>\$\{label\}<\/div>/u);
  assert.match(template, /<nav class=\$\{classes\}[^>]*aria-labelledby=\$\{labelId\}/u);
  assert.doesNotMatch(template, /class="sf-contents-label" aria-hidden/u);
  assert.doesNotMatch(template, /aria-label=\$\{label\}\s*\n\s*@keydown/u);
  const level = manifest.settings['heading-level'];
  assert.deepEqual([level.type, level.min, level.max, level.default], ['number', 2, 6, 2]);
});

test('CT-10: the address is written on choose by default, on scroll only with hash="scroll"', () => {
  assert.deepEqual(manifest.settings.hash.values, ['choose', 'scroll', 'false']);
  assert.equal(manifest.settings.hash.default, 'choose');
  assert.match(source, /const HASH_MODES = \['choose', 'scroll', 'false'\];/u);
  assert.match(source, /return HASH_MODES\.includes\(value\) \? value : 'choose';/u);
  const setCurrent = method('setCurrent(id, {emit = true, via = \'scroll\'} = {}) {', 'writeHash(id) {');
  assert.match(setCurrent, /if \(via === 'scroll' && this\.hashMode === 'scroll'\) this\.writeHash\(id\);/u);
  assert.doesNotMatch(setCurrent, /history\?\.replaceState/u);
  const jump = method('jumpTo(id, event = null) {', '// The compact view\'s list');
  assert.match(jump, /this\.setCurrent\(id, \{emit: true, via: 'choose'\}\);\s*this\.writeHash\(id\);/u);
  assert.match(source, /if \(!id \|\| this\.hashMode === 'false' \|\|/u);
  const record = journal.records.find((one) => one.id === 'behaviour-contents-hash-choose');
  assert.ok(record);
  assert.equal(record.kind, 'behaviour');
  assert.match(record.examples.after, /hash="scroll"/u);
});

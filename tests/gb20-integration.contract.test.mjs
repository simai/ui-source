// Group build 20 integration items (ui-control evidence 2026-11-27-group-build-20):
// I1 choice panels keep the scrollbar's room, I3 device scope before the script,
// I4 the tabs gear on the divider, I5 the Loader drops removed closed containers.
// I2 (C186 (7) clarified) is held by tests/inline-code.contract.test.mjs and
// tests/plain-group-3-c186.contract.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {PHONE_BELOW} from '../src/core/js/device.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const slice = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `anchor not found: ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `anchor not found: ${to}`);
  return source.slice(start, end);
};

test('I1: a choice panel keeps its scrollbar room and its head ends in the checks column (DEV answer 1)', () => {
  const sheet = read('src/smart/input-choice/scss/_smart__choice.scss');
  const scroll = slice(sheet, '.sf-choice--list[data-panel] .sf-choice-scroll {', '}');
  assert.match(scroll, /scrollbar-gutter:\s*stable;/u);
  assert.match(sheet, /\.sf-choice--list\[data-panel\]\[data-sf-choice-track\] \.sf-choice-search \{\s*padding-inline-end:\s*max\(var\(--sf-choice--panel-inset\), var\(--sf-scroll-bg-width\)\);/u);
  assert.match(sheet, /:has\(> \.sf-dropdown--band\):has\(\.sf-choice--list\[data-panel\]\[data-sf-choice-track\]\) > \.sf-dropdown--band \{\s*--sf-dropdown-band-end:/u);
  assert.equal(JSON.parse(read('src/smart/input-choice/component.json')).version, '1.12.1');
});

test('I3: printed items of the other layout are hidden at the phone layout signal width (DEV answer 3)', () => {
  const sheet = read('src/core/scss/_sf_css__placeholder.scss');
  const below = /@media \(width < (\d+)px\) \{\s*:not\(:defined\) \[data-sf-devices~="desktop"\]:not\(\[data-sf-devices~="phone"\]\) \{\s*display: none;/u.exec(sheet);
  const above = /@media \(width >= (\d+)px\) \{\s*:not\(:defined\) \[data-sf-devices~="phone"\]:not\(\[data-sf-devices~="desktop"\]\) \{\s*display: none;/u.exec(sheet);
  assert.ok(below && above, 'both rules are written');
  // One width: the signal's own, not a new step.
  assert.equal(Number(below[1]), PHONE_BELOW);
  assert.equal(Number(above[1]), PHONE_BELOW);
  const template = read('src/smart/tabs/js/templates/default.js');
  assert.match(template, /function devicesMark\(item\) \{\s*const scope = item\.selected \? null : devicesOf\(item\);/u);
  assert.equal((template.match(/data-sf-devices=\$\{devicesMark\(item\)\}/gu) || []).length, 4, 'every tab form carries the mark');
});

test('I4: the settings gear of an underline row sits on the divider as «Ещё» does', () => {
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /> \.sf-tabs-top-container--tools > \.sf-tabs-more > button,\s*:is\(\.sf-tabs--underline, :where\(\.sf-tabs:not\(\.sf-tabs--pills, \.sf-tabs--vertical\)\)\) > \.sf-tabs-top-container--tools > \.sf-tabs-settings > button \{\s*margin-block-end: calc\(/u);
  assert.equal(JSON.parse(read('src/component/tabs/passport.json')).version, '1.5.10');
  assert.equal(JSON.parse(read('src/smart/tabs/component.json')).version, '1.6.2');
});

test('I5: the Loader stops watching a closed container that left the page', () => {
  const loader = read('src/core/js/loader.js');
  const source = slice(loader, 'SFLoaderPlugin.prototype.watchClosedContainer = function (container) {', "// The tag's elements stay invisible while its module is on the way");
  const observed = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target) { observed.push(target); }
    disconnect() { observed.length = 0; }
  }
  const context = {MutationObserver, CLOSED_CONTAINER_ATTRIBUTES: ['hidden'], isClosedContainer: (node) => node.closed, SFLoaderPlugin: function () {}};
  context.SFLoaderPlugin.prototype = {};
  vm.runInNewContext(source, context);
  const loaderPlugin = Object.create(context.SFLoaderPlugin.prototype);
  const kept = {isConnected: true, closed: true};
  const removed = {isConnected: true, closed: true};
  loaderPlugin.watchClosedContainer(kept);
  loaderPlugin.watchClosedContainer(removed);
  assert.deepEqual(observed, [kept, removed]);
  removed.isConnected = false;
  loaderPlugin.dropClosedContainersOutOfPage();
  assert.deepEqual(observed, [kept], 'the removed container is no longer observed');
  assert.equal(loaderPlugin.closedContainers.has(removed), false);
  // The main observer asks for it when nodes leave the page.
  assert.match(loader, /if \(this\.closedContainers\?\.size && relevantChanges\.some\(\(change\) => change\.type === 'childList' && change\.removedNodes\.length\)\) \{\s*this\.dropClosedContainersOutOfPage\(\);/u);
});

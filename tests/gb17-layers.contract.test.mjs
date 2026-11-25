// Group build 17, layers, sizes and states (Y1, Y4, Y5, Y7; Y3 withdrawn for C396): the source holds each rule in its lowest layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Y1: a press on a layer above the popover is that layer\'s, and the popover asks the stack', () => {
  const stack = read('src/core/js/layer-stack.js');
  assert.match(stack, /export function pressInLayerAbove\(owner, event\)/u);
  assert.match(stack, /layers\.slice\(at \+ 1\)\.some\(\(entry\) => isLive\(entry\) && takesInput\(entry\) && !pressedOutside\(entry, event\)\)/u);
  assert.match(read('src/smart/popover/index.js'), /if \(hasLayerAbove\(this\) \|\| pressInLayerAbove\(this, event\)\) return;/u);
  assert.ok(JSON.parse(read('src/core/contracts/shared-runtime.v1.json')).modules['layer-stack'].exports.includes('pressInLayerAbove'));
});

test('Y3 withdrawn (owner decision C396): the drawer steps stay on the measure ladder, which compact density scales', () => {
  const sheet = read('src/smart/drawer/scss/_smart__drawer.scss');
  assert.doesNotMatch(sheet, /--sf-drawer--char/u);
  assert.match(sheet, /--sf-drawer-width: var\(--sf-measure-44\);/u);
  assert.match(sheet, /--sf-drawer-width: var\(--sf-measure-64\);/u);
  assert.doesNotMatch(read('src/smart/drawer/index.js'), /--sf-drawer--char/u);
});

test('Y4: resting vertical tabs take 4 / 8 / 12 for hover, keyboard focus and press', () => {
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  const rest = '.sf-tabs.sf-tabs--vertical > .sf-tabs-top-container > .sf-tabs-top .sf-button:not(.selected):not(:disabled):not(.disabled)';
  for (const [state, role] of [[':hover', 'hover'], [':focus-visible', 'select'], [':is(:active, .active)', 'active']]) {
    const at = sheet.indexOf(`${rest}${state},`);
    assert.ok(at > 0, state);
    assert.match(sheet.slice(at, at + 400), new RegExp(`--sf-button--background-color: var\\(--sf-surface-state-${role}\\);`, 'u'), state);
  }
});

test('Y5: a track shown once keeps in step with its area, and lets it go on detach', () => {
  const js = read('src/core/js/scrollbars.js');
  const show = js.slice(js.indexOf('function show(state) {'), js.indexOf('function busy(state) {'));
  assert.match(show, /watch\(state\);\n {4}queue\(state\);/u);
  assert.match(js, /owner\.values = null;\n {10}queue\(owner\);/u);
  assert.match(js.slice(js.indexOf('function detach(state) {'), js.indexOf('function read(state) {')), /sizes\.unobserve\(state\.area\)/u);
});

test('Y7: in the site theme the media controls lay the state family over their plate', () => {
  const carousel = read('src/component/carousel/scss/_css__carousel.scss');
  assert.match(carousel, /:root:not\(\[data-sf-scheme\]\) :is\(\.sf-carousel-switch:not\(\.sf-carousel-switch--primary\), \.sf-carousel-rotation\):hover \{\n {2}--sf-carousel-control--background-color: var\(--sf-surface-media\);\n {2}--sf-carousel-control--state: var\(--sf-scrim-control-state-hover\);/u);
  assert.match(carousel, /--sf-carousel-control--state: var\(--sf-scrim-control-state-active\);/u);
  assert.match(carousel, /background-image: linear-gradient\(var\(--sf-carousel-control--state, transparent\), var\(--sf-carousel-control--state, transparent\)\);/u);
  const gallery = read('src/smart/gallery/js/templates/default.scss');
  assert.match(gallery, /:root:not\(\[data-sf-scheme\]\) \.sf-gallery-viewer \.sf-gallery-viewer-control \.sf-icon-button:not\(:disabled\):hover \{\n {4}background-color: var\(--sf-black--alfa-48\);\n {4}background-image: linear-gradient\(var\(--sf-scrim-control-state-hover\), var\(--sf-scrim-control-state-hover\)\);/u);
  assert.match(gallery, /linear-gradient\(var\(--sf-scrim-control-state-active\), var\(--sf-scrim-control-state-active\)\)/u);
});

test('GB17 versions', () => {
  const v = (p) => JSON.parse(read(p)).version;
  assert.equal(v('src/smart/popover/component.json'), '1.11.0');
  assert.equal(v('src/smart/drawer/component.json'), '1.22.0');
  assert.equal(v('src/smart/gallery/component.json'), '1.5.6');
  assert.equal(v('src/component/tabs/passport.json'), '1.5.9'); // GB19 touch size (C428)
  assert.equal(v('src/component/carousel/passport.json'), '1.6.1');
});

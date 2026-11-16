import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/component/slider/js/_slider.js', import.meta.url), 'utf8');
const smartSource = await readFile(new URL('../src/smart/slider/index.js', import.meta.url), 'utf8');

test('Slider disables autoplay and transition motion for reduced-motion users', () => {
  assert.match(source, /prefersReducedMotion\(\)/);
  assert.match(source, /options\.speed = 0;\s+delete options\.autoplay/);
});

test('Slider pauses owned autoplay while focus is inside or the document is hidden', () => {
  assert.match(source, /root\.addEventListener\('focusin', onFocusIn\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  // The rotation is the person's (C143 (6)): a stop by the pause button or a
  // keyboard focus holds; the pointer and a hidden tab only hold while they last.
  assert.match(source, /const holds = new Set\(\)/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /findRotationButton\(root, parts\.rotation\)/);
  assert.match(source, /delete sliderOptions\.autoplay/);
});

// The engine owns it since swiper 1.2.0 (owner decision C245): every strip on
// it gets inert hidden slides, an authored inert stays and comes back on destroy.
test('Only active or visible slides remain keyboard reachable and cleanup restores authored inert', async () => {
  const engine = await readFile(new URL('../src/component/swiper/js/index.js', import.meta.url), 'utf8');
  assert.match(engine, /slide\.classList\.toggle\('swiper-slide-visible', visible\)/);
  assert.match(engine, /slide\.toggleAttribute\('inert', !visible \|\| slide\.__sfAuthoredInert\)/);
  assert.match(engine, /slide\.toggleAttribute\('inert', slide\.__sfAuthoredInert\)/);
  assert.doesNotMatch(source, /createSlideInteractivityGuard/);
});

test('Smart Slider preloads the Smart Icon Buttons that its template renders', async () => {
  const sandbox = {SF: {RuleLoader: {}}};
  vm.createContext(sandbox);
  vm.runInContext(
    await readFile(new URL('../src/smart/slider/rule.js', import.meta.url), 'utf8'),
    sandbox,
  );

  const dependencies = Array.from(
    sandbox.SF.RuleLoader['cl-slider'].relation,
    ({name}) => name,
  );
  assert.deepEqual(dependencies, ['slider', 'cl-button-icon']);
});

test('Smart Slider waits for its own controls without an unbounded child-component barrier', () => {
  assert.doesNotMatch(smartSource, /await this\.whenChildrenDefined\(\)/);
  assert.doesNotMatch(smartSource, /requestAnimationFrame/);
  assert.match(smartSource, /new MutationObserver/);
  assert.match(smartSource, /await this\.waitForSliderControls\(this\._boundRoot\)/);
});

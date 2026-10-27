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
  assert.match(source, /resumeOwned/);
});

test('Only active or visible slides remain keyboard reachable and cleanup restores authored inert', () => {
  assert.match(source, /swiper-slide-visible/);
  assert.match(source, /swiper-slide-active/);
  assert.match(source, /slide\.setAttribute\('inert', ''\)/);
  assert.match(source, /authoredState\.forEach/);
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
  assert.deepEqual(dependencies, ['slider', 'cl-icon-button']);
});

test('Smart Slider waits for its own controls without an unbounded child-component barrier', () => {
  assert.doesNotMatch(smartSource, /await this\.whenChildrenDefined\(\)/);
  assert.doesNotMatch(smartSource, /requestAnimationFrame/);
  assert.match(smartSource, /new MutationObserver/);
  assert.match(smartSource, /await this\.waitForSliderControls\(this\._boundRoot\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/smart/gallery/index.js', import.meta.url), 'utf8');
const method = (name, args) => {
  const body = source.split(`  ${name}(${args}) {`)[1]?.split('\n  }')[0];
  assert.ok(body, `${name} exists`);
  return new Function(args, body);
};
const remember = method('_rememberSliderIndex', 'sliderElement, index');
const sync = method('_syncSliderToIndex', 'sliderElement, index');
const makeChild = () => {
  const attributes = new Map();
  return {writes: 0, getAttribute: key => attributes.get(key), setAttribute(key, value) {attributes.set(key, value); this.writes++;}};
};

test('Gallery seeds the next child initialization even when no Slider is bound', () => {
  const child = makeChild();
  sync.call({_rememberSliderIndex: remember}, child, 2);
  assert.equal(child.getAttribute('data-swiper-initial-slide'), '2');
  remember(child, 2);
  assert.equal(child.writes, 1);
  remember(child, 1);
  assert.equal(child.getAttribute('data-swiper-initial-slide'), '1');
  assert.doesNotThrow(() => remember(null, 0));
});

test('Gallery seeds both children but does not drive the originating Slider back', () => {
  const setCurrent = method('_setCurrent', "index, source = 'api', options = {}");
  const inline = makeChild(), lightbox = makeChild(), driven = [], changes = [];
  const gallery = {
    current: 1, _current: 1, slidesTotal: 3,
    _inlineSlider: inline, _lightboxSlider: lightbox,
    _normalizeCurrent: value => value, _rememberSliderIndex: remember,
    _syncSliderToIndex: (child, index) => driven.push({child, index}),
    // Standard 1.3.8: the declared event goes out through sfEmit (§8).
    sfEmit: (name, detail) => changes.push({name, detail}),
  };
  setCurrent.call(gallery, 3, 'lightbox');
  assert.equal(inline.getAttribute('data-swiper-initial-slide'), '2');
  assert.equal(lightbox.getAttribute('data-swiper-initial-slide'), '2');
  assert.deepEqual(driven, [{child: inline, index: 2}]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].detail.current, 3);
});

test('Gallery seeds selection before replacing nested slide slots', () => {
  assert.match(source, /this\._rememberSliderIndex\(sliderElement, this\.current - 1\);\s*sliderElement\.setSlot\('slide', \.\.\.slides\)/);
});

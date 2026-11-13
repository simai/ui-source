/* global URL */
// sf-slider-range in a form (S3): a range submits two entries under one name.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/smart/slider-range/index.js', import.meta.url), 'utf8');
function element(attrs, value) {
  class Base {
    static define() {}
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return name in this.attrs; }
    setAttribute(name, next) { this.attrs[name] = next; }
    removeAttribute(name) { delete this.attrs[name]; }
    getBooleanAttr(name) { return name in this.attrs; }
  }
  class FakeFormData { constructor() { this.entries = []; } append(name, part) { this.entries.push([name, part]); } }
  const context = vm.createContext({SfBaseElement: Base, HTMLElement: class {}, FormData: FakeFormData, elementFromManifest: (manifest, {base}) => base,
    manifest: {}, aliases: {}, en: {}, ru: {}, setRangeSliderValue() {}, getRangeSliderValue: () => value});
  vm.runInContext(`${source.slice(source.indexOf('function serializeValue'), source.indexOf("SfRangeSlider.define('sf-slider-range');"))}\nglobalThis.Slider=SfRangeSlider;`, context);
  const slider = new context.Slider();
  slider.attrs = attrs;
  slider.getSliderRoot = () => ({noUiSlider: {}});
  return slider;
}

test('a range submits both numbers under one name; one handle submits its number (S3)', () => {
  assert.deepEqual(element({name: 'price', value: '5000,20000'}, [5000, 20000]).sfFormValue().entries, [['price', '5000'], ['price', '20000']]);
  assert.equal(element({name: 'volume', value: '30'}, 30).sfFormValue(), '30');
  assert.equal(element({name: 'price', disabled: ''}, [1, 2]).sfFormValue(), null);
});

test('the from/to field reads numbers typed the page\'s way (C80)', () => {
  const context = vm.createContext({Intl});
  vm.runInContext(source.slice(source.indexOf('function parseTyped'), source.indexOf('function getSliderHandleCount')) + '\nglobalThis.parseTyped=parseTyped;', context);
  assert.equal(context.parseTyped('12 500', 'ru'), 12500);
  assert.equal(context.parseTyped('12 500', 'ru'), 12500);
  assert.equal(context.parseTyped('2,5', 'ru'), 2.5);
  assert.equal(context.parseTyped('2.5', 'ru'), 2.5);
  assert.equal(context.parseTyped('12,500', 'en'), 12500);
  assert.ok(Number.isNaN(context.parseTyped('abc', 'ru')));
});

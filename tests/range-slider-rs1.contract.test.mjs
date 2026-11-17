/* global URL */
// DEV msg-5241318c, RANGE-SLIDER items on pair 5.20261115.1622:
// RG-RS-1 -- the slider's name is a field label (C78, C153 (1)): the text ink,
//   and at size 1 it stays 14 on a phone (below 60rem), as sf-input's;
// RG-RS-2 -- C202: in a narrow column the from/to field goes under the track
//   as two boxes «от …» «до …» and the unit moves into the name.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {paintBlocks} from './support/paint-blocks.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = await read('src/component/range-slider/scss/_css__range_slider_field.scss');
const template = await read('src/smart/slider-range/js/templates/default.js');
const host = await read('src/smart/slider-range/index.js');
const rule = (selector, from = sheet) => {
  const at = from.indexOf(`\n${selector} {`);
  assert.ok(at >= 0, selector);
  return from.slice(at, from.indexOf('}', at));
};

test('RG-RS-1: the name takes the text ink, not the variant ink', () => {
  // C273: the ink stands in the sf.paint rule of the same selector (group build 10).
  const name = rule('.sf-range-slider-name') + rule('.sf-range-slider-name', `\n${paintBlocks(sheet).replace(/^ {2}/gmu, '')}`);
  assert.match(name, /color: var\(--sf-range-slider-name--color, var\(--sf-on-surface\)\);/u);
  assert.doesNotMatch(name, /on-surface-variant/u);
});

test('RG-RS-1: at size 1 the name line stays 14 on a phone (below 60rem); the scale keeps its step', () => {
  const at = sheet.indexOf('@media not all and (min-width: 60rem) {');
  assert.ok(at >= 0, 'phone rule');
  const block = sheet.slice(at, sheet.indexOf('\n}\n', at));
  assert.match(block, /\.sf-range-slider-group:not\(\.sf-range-slider-group--size-1\\\/2, \.sf-range-slider-group--size-2\) :is\(\.sf-range-slider-name, \.sf-range-slider-output\) \{/u);
  assert.match(block, /font-size: var\(--sf-text-size-1\);/u);
  assert.match(block, /line-height: var\(--sf-text-height-1\);/u);
  assert.doesNotMatch(block, /sf-range-slider-scale/u);
});

test('RG-RS-2 (C202): a slider with the field is a size container; under 26rem the field goes under the track', () => {
  assert.match(rule('.sf-range-slider-group--field'), /container: sf-range-slider \/ inline-size;/u);
  const at = sheet.indexOf('@container sf-range-slider (inline-size < #{mq.container-step(g3)})');
  assert.ok(at >= 0, 'container query at step g3');
  const block = sheet.slice(at);
  assert.match(block, /\.sf-range-slider-group--field \.sf-range-slider-line \{\n {4}align-items: stretch;\n {4}flex-direction: column;/u);
  // The boxes share the row and wrap rather than clip (C261).
  assert.match(block, /display: flex;\n {4}flex-wrap: wrap;/u);
  assert.match(block, /\.sf-range-slider-group--field \.sf-range-slider-field-unit \{\n {4}display: none;/u);
  assert.match(block, /\.sf-range-slider-group--field \.sf-range-slider-name-unit \{\n {4}display: inline;/u);
});

test('RG-RS-2 (C202): the boxes carry the words from the language file, the name carries the unit', () => {
  assert.match(template, /sf-range-slider-field-word" aria-hidden="true">\$\{context\.fieldWords\[index\]\}/u);
  assert.match(template, /sf-range-slider-name-unit" aria-hidden="true">, \$\{context\.fieldUnit\}/u);
  assert.match(template, /context\.field \? 'sf-range-slider-group--field' : ''/u);
  assert.match(host, /fieldWords: \[this\.sfWord\('from'\), this\.sfWord\('to'\)\]/u);
});

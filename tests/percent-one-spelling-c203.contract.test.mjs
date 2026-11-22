// One spelling of a per cent across SIMAI Framework (owner decision C203 (3),
// IM-3 of ui-control control/research/2026-11-15-inline-meter.md; DEV
// msg-913fd9e4, 2026-11-15): the number, a no-break space (U+00A0) and «%», in
// every language. Each test reads the text a part renders.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {formatNumber, percentSign, percentText} from '../src/core/js/format-number.js';
import {renderProgressBarTemplate} from '../src/smart/progress-bar/js/templates/default.js';
import {renderProgressRingTemplate} from '../src/smart/progress-ring/js/templates/default.js';
import {renderProgressScaleTemplate} from '../src/smart/progress-scale/js/templates/default.js';
import {formatPercent} from '../src/smart/field-renderers/decimal.js';

const NBSP = ' ';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
// The strings a Lit template result carries, nested results included.
const strings = (result, out = []) => {
  if (result && typeof result === 'object' && Array.isArray(result.values)) result.values.forEach((one) => strings(one, out));
  else if (Array.isArray(result)) result.forEach((one) => strings(one, out));
  else if (typeof result === 'string') out.push(result);
  return out;
};
const percents = (result) => strings(result).filter((one) => one.includes('%'));

test('core formatNumber writes every per cent as number, no-break space, sign', () => {
  assert.equal(formatNumber(0.72, 'percent', {locale: 'ru'}), `72${NBSP}%`);
  assert.equal(formatNumber(0.725, 'percent', {locale: 'ru'}), `72,5${NBSP}%`);
  assert.equal(formatNumber(0.72, 'percent', {locale: 'en'}), `72${NBSP}%`);
  assert.equal(formatNumber(83, 'unit-percent', {locale: 'en'}), `83${NBSP}%`);
  assert.equal(formatNumber(83, 'unit-percent', {locale: 'de'}), `83${NBSP}%`);
  // A language that writes the sign first keeps its order.
  assert.equal(percentSign('%72'), '%72');
  assert.equal(percentText(72), `72${NBSP}%`);
  assert.equal(percentText(33.33), `33.33${NBSP}%`);
  assert.equal(percentText('x'), `0${NBSP}%`);
});

test('sf-progress-bar writes «72 %» in every look and says it by default', () => {
  for (const context of [{textPosition: 'top', label: 'Загрузка'}, {textPosition: 'inline-end'}, {inline: true, meter: true}]) {
    const shown = percents(renderProgressBarTemplate({value: 72, ...context}));
    assert.deepEqual(shown, [`72${NBSP}%`], JSON.stringify(context));
  }
  const inline = strings(renderProgressBarTemplate({value: 72, inline: true, meter: true, textPosition: 'top'}));
  assert.ok(inline.some((one) => /\bsf-progress-bar--inline\b/u.test(one) && !/\bflex\b(?!-)/u.test(one)), 'the inline class, no block flex');
  assert.ok(inline.includes('inline-end'), 'text-position does not apply to the inline look');
});

test('sf-progress-bar: the script, the sheet and the words follow the same spelling', async () => {
  const script = await read('src/component/progress-bar/js/_progressbar.js');
  const index = await read('src/smart/progress-bar/index.js');
  assert.doesNotMatch(script, /textContent = `\$\{value\}%`/u);
  assert.match(script, /percentText\(value, root\)/u);
  assert.match(index, /if \(!this\.paused\) return unknown \? '' : percentText\(value, this\);/u);
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(await read(`src/smart/progress-bar/lang/${locale}.json`));
    assert.match(words.runtime['paused-value'], /^\{value\} %, /u, locale);
  }
  // The inline look (C203 (1), (2), (4)): a 64 track of its own, 4 thick, the
  // number before it and in the status colour at a threshold.
  const sheet = await read('src/component/progress-bar/scss/_css__progressbar.scss');
  assert.match(sheet, /--sf-progress-bar--track-size: var\(--sf-d6\);/u);
  assert.match(sheet, /width: var\(--sf-progress-bar-track-size, var\(--sf-progress-bar--track-size\)\);/u);
  assert.match(sheet, /\.sf-progress-bar--inline \.sf-progress-bar-main \{\s*--sf-progress-bar-main--height: var\(--sf-a4\);/u);
  assert.match(sheet, /\.sf-progress-bar--inline \.sf-progress-bar-text \{\s*order: -1;/u);
  // The number's box holds the widest value, «100 %», at every size: three
  // tabular figures and the space with the sign, so 0 % and 100 % stand alike.
  assert.match(sheet, /min-inline-size: calc\(3ch \+ 1\.4em\);/u);
  assert.match(sheet, /\.sf-progress-bar--inline\.sf-progress-bar--error \.sf-progress-bar-text \{\s*color: var\(--sf-progress-bar-color, var\(--sf-error\)\);/u);
  // IM-5: no number below the 1/3 text step; IM-4: compact moves the thickness.
  assert.match(sheet, /--size-1\\\/3 \{\s*--sf-progress-bar--font-size: var\(--sf-text-size-1\\\/3\);/u);
  assert.match(sheet, /\[data-sf-density="compact"\] \.sf-progress-bar--size-1:not\(\.sf-progress-bar--inline\):not\(\[data-sf-density="normal"\] \*\) \.sf-progress-bar-main \{\s*--sf-progress-bar-main--height: var\(--sf-a4\);/u);
});

test('sf-progress-ring says «72 %» and shows «72%» in its middle (DEV look answer 2026-11-20)', () => {
  assert.deepEqual(percents(renderProgressRingTemplate({value: 72, size: '2', showText: true})), [`72${NBSP}%`, '72%']);
  assert.deepEqual(percents(renderProgressRingTemplate({value: 72, size: '2', showText: true, valueText: '3 из 4'})), ['72%']);
  // GB15 A1 (DEV msg-1c3a4f0b): size 1 draws no text inside; the value is the ring's tooltip, spoken «72 %».
  assert.ok(!percents(renderProgressRingTemplate({value: 72, size: '1', showText: true})).includes('72%'));
});

test('sf-progress-scale shows «72 %»', async () => {
  assert.deepEqual(percents(renderProgressScaleTemplate({value: 72, showText: true})), [`72${NBSP}%`]);
  // PS-1: the text is written into the node the template drew (writeScaleText).
  assert.match(await read('src/component/progress-scale/js/_progress_scale.js'), /writeScaleText\(text, (?:level \? \(root\.dataset\.valueText \|\| words\) : )?percentText\(value, root\)\);/u);
});

test('sf-tile-metric and sf-progress-run write the per cent with the no-break space', async () => {
  const tile = await read('src/smart/tile-metric/index.js');
  assert.match(tile, /'\+00,0\\u00a0%'/u);
  assert.match(tile, /formatNumber\(Math\.abs\(found\.share\), 'percent', \{node: this\}\)/u);
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(await read(`src/smart/progress-run/lang/${locale}.json`));
    for (const key of ['percent', 'figures', 'announce-progress']) assert.match(words.runtime[key], /\{percent\} %/u, `${locale} ${key}`);
  }
});

test('field renderers: a percent value and the meter template', async () => {
  assert.equal(formatPercent('12.5', 'ru'), `12,5${NBSP}%`);
  assert.equal(formatPercent('20', 'en'), `20${NBSP}%`);
  const {PROPERTY_TYPES} = await import('../src/smart/field-renderers/registry.js');
  // C302: templates, the default first; the variants are their former ids.
  assert.deepEqual(PROPERTY_TYPES.find((one) => one.type === 'number').templates.map((one) => one.id), ['input', 'stepper', 'scale', 'meter']);
  assert.deepEqual(PROPERTY_TYPES.find((one) => one.type === 'number').variants.map((one) => one.id), ['stepper', 'scale', 'meter']);
  const source = await read('src/smart/field-renderers/index.js');
  assert.match(source, /if \(variant === 'meter'\) return \{component: \{type: 'progress-bar', props: meterProps\(field, number\)\}\};/u);
  assert.match(source, /return \{inline: true, meter: true, value: String\(number\)/u);
});

test('sf-file-download says its preparing per cent as «72 %»', async () => {
  const index = await read('src/smart/file-download/index.js');
  assert.match(index, /import \{ percentText \} from '\.\.\/\.\.\/core\/js\/format-number\.js';/u);
  assert.match(index, /percentText\(value\) \{\s*return percentText\(Math\.round\(Number\(value\)\), this\);\s*\}/u);
  assert.doesNotMatch(index, /style: 'percent'/u);
  const said = {ru: 'Готовим… 72\u00a0%', en: 'Preparing… 72\u00a0%'};
  for (const locale of ['en', 'ru']) {
    const words = JSON.parse(await read(`src/smart/file-download/lang/${locale}.json`));
    const word = (words.runtime ?? words)['preparing-value-text'];
    assert.equal(word.replace('{percent}', percentText(Math.round(72.4), null)), said[locale], locale);
  }
  assert.equal(percentText(Math.round(100), null), '100\u00a0%');
  assert.equal(percentText(Math.round(0), null), '0\u00a0%');
});

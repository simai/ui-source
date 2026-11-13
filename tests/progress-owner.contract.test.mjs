import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Progress Bar normalizes value, size, position and semantic tone', async () => {
  const ordinary = await read('src/component/progress-bar/js/_progressbar.js');
  const template = await read('src/smart/progress-bar/js/templates/default.js');

  assert.match(ordinary, /Math\.max\(0, Math\.min\(100, parsed\)\)/);
  assert.match(ordinary, /\['1\/3', '1\/2', '1', '2', '3'\]/);
  // The shared status words; no status carries no class and draws primary,
  // neutral is grey, primary is the former word for no status (C131 (1)).
  assert.match(ordinary, /const TONES = \['neutral', 'info', 'success', 'warning', 'error'\]/);
  assert.match(template, /tone \? `sf-progress-bar--\$\{tone\}` : ''/);
  // top | inline-end | none; bottom and right are the former words (C131 (4)).
  assert.match(ordinary, /const TEXT_POSITIONS = \['none', 'top', 'inline-end'\]/);
  assert.match(ordinary, /const FORMER_TEXT_POSITIONS = \{ bottom: 'top', right: 'inline-end' \}/);
  assert.match(template, /const FORMER_POSITIONS = \{ bottom: 'top', right: 'inline-end' \}/);
  // meter (C131 (7)) gives role meter.
  assert.match(template, /role=\$\{meter \? 'meter' : 'progressbar'\}/);
  assert.match(ordinary, /root\.setAttribute\('role', isMeter\(root\) \? 'meter' : 'progressbar'\)/);
  assert.match(template, /data-position=\$\{normalizedPosition\}/);
  // Indeterminate (1.3.0, C34) leaves the value unsaid; otherwise the value is said.
  assert.match(template, /aria-valuenow=\$\{indeterminate \? nothing : String\(normalizedValue\)\}/);
  assert.match(ordinary, /if \(isIndeterminate\(root\)\) root\.removeAttribute\('aria-valuenow'\)/);
  assert.doesNotMatch(template, /tabindex=/);
});

test('Progress Bar 1.3.1: a paused indeterminate bar stands still; a status change leaves no neutral class', async () => {
  const ordinary = await read('src/component/progress-bar/js/_progressbar.js');
  const template = await read('src/smart/progress-bar/js/templates/default.js');
  const styles = await read('src/component/progress-bar/scss/_css__progressbar_custom.scss');

  // C34 acceptance D2: pause means time stands still.
  assert.match(template, /paused \? 'sf-progress-bar--paused' : ''/);
  assert.match(template, /data-paused=\$\{paused \? 'true' : nothing\}/);
  assert.match(ordinary, /root\.classList\.toggle\('sf-progress-bar--paused', Boolean\(state\.paused\)\)/);
  assert.match(styles, /\.sf-progress-bar--indeterminate\.sf-progress-bar--paused \.sf-progress-bar-progress \{\s*animation: none;/);
  // I2: one status class at most -- a status change takes every other away.
  assert.match(ordinary, /\['primary', \.\.\.TONES\]\.forEach\(\(name\) => \{\s*root\.classList\.toggle\(`sf-progress-bar--\$\{name\}`, name === tone\);/);
});

test('Progress Scale preserves exact value while rounding visual segments only', async () => {
  const ordinary = await read('src/component/progress-scale/js/_progress_scale.js');
  const template = await read('src/smart/progress-scale/js/templates/default.js');

  // Round down (PG-12): the blocks never show more than is done.
  assert.match(ordinary, /Math\.floor\(normalizeProgressScaleValue\(value\) \/ 10 \+ 1e-9\) \* 10/);
  assert.match(ordinary, /setAttribute\('aria-valuenow', String\(value\)\)/);
  assert.match(template, /aria-valuenow=\$\{String\(value\)\}/);
  assert.match(template, /sf-progress-scale--\$\{step\}/);
  assert.doesNotMatch(template, /tabindex=/);
});

test('Progress percentage never infers error, warning or success paint', async () => {
  const styles = await read('src/component/progress-scale/scss/_css__progress_scale.scss');

  // The public variable reads first, the role token is its fallback (standard 1.3.8 §6).
  assert.match(styles, /--sf-progress-scale--fill-color: var\(--sf-progress-scale-fill-color, var\(--sf-primary\)\)/);
  assert.match(styles, /sf-progress-scale--success/);
  assert.match(styles, /sf-progress-scale--warning/);
  assert.match(styles, /sf-progress-scale--error/);
  assert.doesNotMatch(styles, /sf-progress-scale--20[^}]+sf-error/s);
  assert.doesNotMatch(styles, /sf-progress-scale--60[^}]+sf-warning/s);
  assert.doesNotMatch(styles, /sf-progress-scale--100[^}]+sf-success/s);
});

test('Progress geometry and motion use Framework semantic contracts', async () => {
  const bar = await read('src/component/progress-bar/scss/_css__progressbar.scss');
  const motion = await read('src/component/progress-bar/scss/_css__progressbar_custom.scss');
  const scale = await read('src/component/progress-scale/scss/_css__progress_scale.scss');

  // Round ends on the bar, rounded segments on the scale (C131 (3), (6)).
  assert.match(bar, /var\(--sf-progress-bar-radius, var\(--sf-radius-circle\)\)/);
  assert.match(scale, /border-radius: var\(--sf-progress-scale-radius, var\(--sf-radius-1\\\/3\)\)/);
  assert.match(scale, /gap: var\(--sf-progress-scale-segment-gap, var\(--sf-a2\)\)/);
  // Раньше здесь стояла --sf-duration-default. Такой роли в шкале нет -- она
  // состоит из fast, normal и slow, -- поэтому браузер отбрасывал объявление
  // целиком и полоса не анимировалась вовсе. Контракт закреплял эту ссылку и
  // тем делал её похожей на решение.
  assert.match(motion, /var\(--sf-duration-normal\)/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(`${bar}\n${motion}\n${scale}`, /#[0-9a-f]{3,8}\b/i);
});

test('Progress Smart manifests expose closed accessible contracts', async () => {
  const bar = JSON.parse(await read('src/smart/progress-bar/smart.manifest.json'));
  const scale = JSON.parse(await read('src/smart/progress-scale/smart.manifest.json'));

  for (const manifest of [bar, scale]) {
    assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
    // The axis is named status and speaks the shared vocabulary; `tone` still
    // answers, and `primary` is answered as the empty default (C131 (1)).
    const statuses = ['', 'neutral', 'info', 'success', 'warning', 'error'];
    assert.deepEqual(manifest.inputs.properties.status.enum, statuses);
    assert.deepEqual(manifest.inputs.properties.tone.enum, statuses);
    assert.equal(manifest.accessibility.role, 'progressbar');
    assert.deepEqual(manifest.accessibility.keyboard, []);
    assert.equal(manifest.ownership.data, 'host');
  }
});

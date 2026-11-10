import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Progress Bar normalizes value, size, position and semantic tone', async () => {
  const ordinary = await read('src/component/progress-bar/js/_progressbar.js');
  const template = await read('src/smart/progress-bar/js/templates/default.js');

  assert.match(ordinary, /Math\.max\(0, Math\.min\(100, parsed\)\)/);
  assert.match(ordinary, /\['1\/3', '1\/2', '1', '2', '3'\]/);
  // The shared status words; primary is the old word for no status (2026-10-13).
  assert.match(ordinary, /const TONES = \['info', 'success', 'warning', 'error'\]/);
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
  // I2: the template's neutral class goes with any status change.
  assert.match(ordinary, /if \(tone\) root\.classList\.remove\('sf-progress-bar--neutral'\)/);
});

test('Progress Scale preserves exact value while rounding visual segments only', async () => {
  const ordinary = await read('src/component/progress-scale/js/_progress_scale.js');
  const template = await read('src/smart/progress-scale/js/templates/default.js');

  assert.match(ordinary, /Math\.ceil\(normalizeProgressScaleValue\(value\) \/ 10\) \* 10/);
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

  assert.match(bar, /var\(--sf-radius--ui\)/);
  assert.match(scale, /var\(--sf-radius--ui\)/);
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
    // answers, and `primary` is answered as neutral.
    const statuses = ['neutral', 'info', 'success', 'warning', 'error'];
    assert.deepEqual(manifest.inputs.properties.status.enum, statuses);
    assert.deepEqual(manifest.inputs.properties.tone.enum, statuses);
    assert.equal(manifest.accessibility.role, 'progressbar');
    assert.deepEqual(manifest.accessibility.keyboard, []);
    assert.equal(manifest.ownership.data, 'host');
  }
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {URL} from 'node:url';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Smart Icons distinguishes decorative and informative symbols', async () => {
  const template = await read('src/smart/icon/js/templates/default.js');
  assert.match(template, /role=\$\{label \? "img" : nothing\}/);
  assert.match(template, /aria-label=\$\{label \|\| nothing\}/);
  assert.match(template, /aria-hidden=\$\{label \? nothing : "true"\}/);
  assert.doesNotMatch(template, /tabindex|@click/);
});

test('Smart Icons exposes the source font families and axes', async () => {
  const [source, template, styles] = await Promise.all([
    read('src/smart/icon/index.js'),
    read('src/smart/icon/js/templates/default.js'),
    read('src/component/icons/scss/_css__icons.scss'),
  ]);
  // The settings are made from component.json (core/js/element-manifest.js).
  const manifest = JSON.parse(await read('src/smart/icon/component.json'));
  const aliases = JSON.parse(await read('src/smart/icon/aliases.json'));
  // One family (1.2.0, icons study IC-4): rounded, sharp and shape are dated
  // value aliases of outlined; their fonts were never shipped.
  assert.match(source, /get iconType\(\) \{\n    return "outlined";/);
  assert.deepEqual(manifest.settings.type.values, ['', 'outlined']);
  // Each axis also has its summary (docs precheck smart content SC-S02).
  const {summary: gradeSummary, ...grade} = manifest.settings.grade;
  const {summary: opticalSummary, ...optical} = manifest.settings['optical-size'];
  assert.deepEqual(grade, {type: 'number', integer: true, min: -50, max: 200, default: 0});
  assert.deepEqual(optical, {type: 'number', min: 20, max: 48, default: 24});
  assert.match(gradeSummary, /GRAD/);
  assert.match(opticalSummary, /opsz/);
  for (const from of ['shape', 'rounded', 'sharp']) {
    assert.ok(aliases.aliases.some((row) => row.kind === 'value' && row.setting === 'type' && row.from === from && row.to === 'outlined'), from);
  }
  assert.ok(aliases.aliases.filter((row) => row.from !== 'shape').every((row) => row.remove_after === '2027-01-01'));
  assert.doesNotMatch(template, /sf-icon--rounded|sf-icon--sharp/);
  assert.match(template, /--sf-icon--grade/);
  assert.match(template, /--sf-icon--optical-size/);
  assert.match(styles, /'opsz' var\(--sf-icon--optical-size\)/);
});

test('Smart Icons accepts only the Framework icon size scale', async () => {
  const source = await read('src/smart/icon/index.js');
  assert.match(source, /const iconSizes = \["1\/4", "1\/3", "1\/2", "1", "2", "3", "4", "5", "6", "7"\]/);
  assert.match(source, /iconSizes\.includes\(size\) \? size : ""/);
});

test('Core Loader tracks exact Smart icon descriptors', async () => {
  const source = await read('src/core/js/iconSubsetRuntime.js');
  assert.match(source, /"optical-size", "type"/);
  assert.match(source, /query\.set\("optical_size", requestConfig\.opticalSize\)/);
  assert.match(source, /manifestAxisIncludesValue\(manifest, "GRAD", attrs\.grade\)/);
  assert.match(source, /"opsz",\s*attrs\["optical-size"\]/s);
});

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';

// Display group B from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §6, §8, §16.20): sf-alert, sf-empty-state, sf-spinner,
// sf-skeleton, sf-progress-bar, sf-progress-scale, sf-file-preview,
// sf-gallery, sf-slider, sf-resizer, sf-profile-picker. The browser half, on
// the built bytes, is tests/browser/manifest-probes.browser.mjs (each folder's
// probe.json).

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const {readManifest} = await import('../src/core/js/element-manifest.js');
const {readAliasTable} = await import('../src/core/js/alias-table.js');

const FOLDERS = ['alert', 'empty-state', 'spinner', 'skeleton', 'progress-bar', 'progress-scale',
  'file-preview', 'gallery', 'slider', 'resizer', 'profile-picker'];
const present = FOLDERS.filter((folder) => existsSync(new URL(`../src/smart/${folder}/component.json`, import.meta.url)));

test('every display component of group B is made from its component.json, language files and aliases', () => {
  for (const folder of present) {
    const source = read(`src/smart/${folder}/index.js`);
    for (const file of ['./component.json', './aliases.json', './lang/en.json', './lang/ru.json']) {
      assert.match(source, new RegExp(`from ['"]${file.replace(/[./]/gu, (c) => `\\${c}`)}['"]`), `${folder}: ${file}`);
    }
    assert.match(source, /elementFromManifest\(manifest, \{/u, folder);
    for (const file of ['examples.json', 'probe.json']) assert.ok(existsSync(new URL(`../src/smart/${folder}/${file}`, import.meta.url)), `${folder}/${file}`);
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.equal(manifest.tag, `sf-${folder}`, `${folder}: the folder is the tag's name (§3)`);
    assert.ok(!('x-todo' in manifest), `${folder}: every x-todo is decided`);
    assert.ok(Array.isArray(manifest['x-decisions']) && manifest['x-decisions'].length, `${folder}: x-decisions`);
    const variables = Object.keys(manifest['css-variables'] ?? {});
    assert.ok(variables.length >= 5 && variables.length <= 10, `${folder}: 5–10 public variables (§6)`);
    assert.ok(manifest.accessibility?.role, `${folder}: one role, or none (§4.8)`);
    assert.ok(existsSync(new URL(`../src/smart/${folder}/${manifest.docs}`, import.meta.url)), `${folder}: docs ${manifest.docs}`);
    const en = json(`src/smart/${folder}/lang/en.json`);
    const ru = json(`src/smart/${folder}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime ?? {}).sort(), Object.keys(ru.runtime ?? {}).sort(), `${folder}: ru and en say the same words`);
    for (const [verb, event] of Object.entries(manifest.events ?? {})) {
      if (event['own-verb']) assert.ok(en.events?.[verb]?.label && ru.events?.[verb]?.label, `${folder}: own verb ${verb} has its word (§8)`);
    }
    for (const [name, spec] of Object.entries(manifest.settings ?? {})) {
      if (spec['default-from']?.startsWith('runtime.')) {
        const word = spec['default-from'].slice('runtime.'.length);
        assert.ok(en.runtime?.[word] && ru.runtime?.[word], `${folder}: ${name} takes the word ${word}`);
      }
    }
    const table = json(`src/smart/${folder}/aliases.json`);
    const {rows} = readAliasTable(table, {tag: manifest.tag});
    for (const row of rows) {
      assert.equal(row.since, '2026-10-27', `${folder}: ${row.from}`);
      assert.equal(row.remove_after, '2026-12-01', `${folder}: ${row.from}`);
    }
  }
});

test('the events take the tag and the vocabulary (§8, vocabulary 1.1.5 §5, §7)', () => {
  const names = (folder) => Object.values(readManifest(json(`src/smart/${folder}/component.json`)).events).map((event) => event.name);
  assert.deepEqual(names('file-preview'), ['sf-file-preview-download', 'sf-file-preview-detach']);
  assert.deepEqual(names('profile-picker'), ['sf-profile-picker-select', 'sf-profile-picker-create', 'sf-profile-picker-rename', 'sf-profile-picker-delete', 'sf-profile-picker-reset']);
  assert.deepEqual(names('gallery'), ['change', 'sf-gallery-opened', 'sf-gallery-closed']);
  assert.deepEqual(names('slider'), ['change']);
  assert.deepEqual(names('resizer'), ['sf-resizer-resize']);
  assert.deepEqual(names('alert'), ['sf-alert-action', 'sf-alert-close']);
  const old = (folder) => readAliasTable(json(`src/smart/${folder}/aliases.json`), {tag: `sf-${folder}`}).rows
    .filter((row) => row.kind === 'event' && row.to).map((row) => [row.from, row.to, row.mode]);
  assert.deepEqual(old('file-preview'), [
    ['sf-file-preview:download', 'sf-file-preview-download', 'detail-adds'],
    ['sf-file-preview:remove', 'sf-file-preview-detach', 'detail-adds'],
  ]);
  assert.deepEqual(old('slider'), [['sf-slide-change', 'change', 'same-detail']]);
  assert.deepEqual(old('resizer'), [['sf-resize', 'sf-resizer-resize', 'same-detail']]);
  assert.ok(old('profile-picker').every(([from, to]) => to === from.replace('sf-profile-', 'sf-profile-picker-')));
});

test('a job\'s progress reaches the bars as the stream\'s chunk {done, total} (vocabulary §5.2)', () => {
  for (const folder of ['progress-bar', 'progress-scale']) {
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.deepEqual(Object.keys(manifest.actions), ['chunk']);
    assert.deepEqual(manifest.actions.chunk.with, {done: 'number', total: 'number'});
    assert.equal(manifest.settings.value.type, 'number');
    assert.equal(manifest.accessibility.role, 'progressbar');
    const row = json(`src/smart/${folder}/aliases.json`).aliases.find((one) => one.from === 'setProgress');
    assert.equal(row?.to, 'chunk');
  }
});

test('sf-profile-picker paints skeleton.html before the host\'s profiles arrive (§5.4)', () => {
  const manifest = json('src/smart/profile-picker/component.json');
  assert.equal(manifest.presentation.skeleton.file, 'skeleton.html');
  const skeleton = read('src/smart/profile-picker/skeleton.html');
  assert.match(skeleton, /data-sf-static/u);
  assert.match(skeleton, /sf-profile-picker-skeleton-bar/u);
  assert.doesNotMatch(skeleton, /<script/u, 'no script');
  for (const [, name] of skeleton.matchAll(/\{\{([a-z-]+)\}\}/gu)) assert.ok(manifest.settings[name], `${name} is a setting`);
});

test('the live regions say what the standard asks (§4.8, §7.4.1)', () => {
  const alert = json('src/smart/alert/component.json').accessibility;
  assert.equal(alert.role, 'status');
  assert.equal(alert.otherwise, 'alert');
  assert.match(read('src/smart/alert/index.js'), /ASSERTIVE = new Set\(\['warning', 'error'\]\)/u);
  assert.match(read('src/smart/alert/js/templates/default.js'), /role=\$\{context\.liveRole \|\| nothing\}/u);
  const spinner = json('src/smart/spinner/component.json').accessibility;
  assert.deepEqual(spinner.when, {announce: true});
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.search-port 1.2.0 (C175 (2), dispatcher decision msg-bc1702eb: the
// port field is image): a minor over 1.1.0 that adds and never changes -- a
// result's own picture, a file's thumbnail or a record's image, drawn on a
// plate where the glyph stands.
const root = resolve(import.meta.dirname, '..');
const base = join(root, 'src/core/contracts/ports/simai.search-port');
const read = (edition, file) => JSON.parse(readFileSync(join(base, edition, file), 'utf8'));
const v11 = read('1.1.0', 'port.json');
const v12 = read('1.2.0', 'port.json');
const kit = read('1.2.0', 'kit/manifest.json');

test('1.2.0 adds image to a result and nothing else', () => {
  assert.equal(v12.port, v11.port);
  assert.equal(v12.version, '1.2.0');
  assert.equal(v12.compatibility.previous_major, null);
  const before = Object.keys(v11.data.results.schema.items.properties);
  const after = Object.keys(v12.data.results.schema.items.properties);
  assert.deepEqual(after.filter((name) => !before.includes(name)), ['image']);
  for (const name of before) assert.ok(after.includes(name), name);
  assert.deepEqual(Object.keys(v12.capabilities), Object.keys(v11.capabilities));
  assert.deepEqual(Object.keys(v12.intents), Object.keys(v11.intents));
  assert.deepEqual(Object.keys(v12.data), Object.keys(v11.data));
  assert.deepEqual(v12.data.results.schema.items.properties.image.type, ['string', 'null']);
});

test('the kit keeps 1.1.0\'s cases and adds the picture case', () => {
  const older = read('1.1.0', 'kit/manifest.json').cases;
  assert.equal(kit.version, '1.2.0');
  for (const id of older) assert.ok(kit.cases.includes(id), id);
  assert.deepEqual(kit.cases.filter((id) => !older.includes(id)), ['result-image-is-its-own-picture']);
  const kase = read('1.2.0', 'kit/cases/result-image-is-its-own-picture.json');
  assert.equal(kase.then.answer, 'applied');
  for (const key of Object.keys(kase.when.payload)) assert.ok(key in v12.intents[kase.intent].payload.properties, key);
});

test('the static host passes image through, sf-search draws it on its plate', async () => {
  const host = readFileSync(join(root, 'src/smart/search/js/host.js'), 'utf8');
  assert.match(host, /PORT_VERSION = '1\.2\.0'/u);
  assert.match(host, /result\.image = /u);
  const template = readFileSync(join(root, 'src/smart/search/js/templates/default.js'), 'utf8');
  assert.match(template, /sf-search-row-image/u);
  const sheet = readFileSync(join(root, 'src/smart/search/scss/_smart__search.scss'), 'utf8');
  const rule = sheet.match(/\.sf-search-row-image \{[^}]+\}/u)?.[0] ?? '';
  // The plate is paint (C273): in sf.paint, with the container's dim ink.
  const paintRule = sheet.slice(sheet.indexOf('@layer sf.paint')).match(/\.sf-search-row-image \{[^}]+\}/u)?.[0] ?? '';
  assert.match(paintRule, /background: var\(--sf-surface-container\)/u);
  assert.match(paintRule, /--sf-on-surface-variant: var\(--sf-on-surface-container-variant\)/u);
  assert.match(rule, /inline-size: var\(--sf-ui-1\\\/2--control-height\)/u);
  assert.match(rule, /border-radius: var\(--sf-radius-1\)/u);
});

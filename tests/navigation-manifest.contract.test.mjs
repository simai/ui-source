import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';

// The navigation family from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §7.2.1, §8, §16.20, §18): sf-menu, sf-tabs, sf-accordion,
// sf-breadcrumbs, sf-steps, sf-pagination. The browser half, on the built
// bytes, is each folder's probe.json run by tests/browser/overlays-manifest.browser.mjs
// with SF_OVERLAYS naming the folders.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const {readManifest} = await import('../src/core/js/element-manifest.js');
const {readAliasTable} = await import('../src/core/js/alias-table.js');

const FOLDERS = ['menu', 'tabs', 'accordion', 'breadcrumbs', 'steps', 'pagination'];
const present = FOLDERS.filter((folder) => existsSync(new URL(`../src/smart/${folder}/component.json`, import.meta.url)));

test('every navigation component is made from its component.json, language files and aliases', () => {
  for (const folder of present) {
    const source = read(`src/smart/${folder}/index.js`);
    for (const file of ['./component.json', './aliases.json', './lang/en.json', './lang/ru.json']) {
      assert.match(source, new RegExp(`from ['"]${file.replace(/[./]/gu, (c) => `\\${c}`)}['"]`), `${folder}: ${file}`);
    }
    assert.match(source, /elementFromManifest\(manifest, \{/u, folder);
    for (const file of ['examples.json', 'probe.json']) assert.ok(existsSync(new URL(`../src/smart/${folder}/${file}`, import.meta.url)), `${folder}/${file}`);
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.ok(existsSync(new URL(`../src/smart/${folder}/${manifest.docs}`, import.meta.url)), `${folder}: docs ${manifest.docs}`);
    assert.ok(!('x-todo' in manifest), `${folder}: every x-todo is decided`);
    assert.ok(Array.isArray(manifest['x-decisions']) && manifest['x-decisions'].length, `${folder}: x-decisions`);
    const variables = Object.keys(manifest['css-variables'] ?? {}).length;
    assert.ok(variables >= 5 && variables <= 10, `${folder}: 5–10 public variables (§6)`);
    const en = json(`src/smart/${folder}/lang/en.json`);
    const ru = json(`src/smart/${folder}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime ?? {}).sort(), Object.keys(ru.runtime ?? {}).sort(), `${folder}: ru and en say the same words`);
    for (const [verb, event] of Object.entries(manifest.events ?? {})) {
      if (event['own-verb']) assert.ok(en.events?.[verb]?.label && ru.events?.[verb]?.label, `${folder}: own verb ${verb} has its word (§8)`);
      assert.ok(!verb.includes(':') && !verb.startsWith('sf-'), `${folder}: ${verb} is a verb (§8)`);
    }
    // Keys map to effects of the closed list (§4.8).
    for (const [key, effect] of Object.entries(manifest.accessibility?.keys ?? {})) {
      const name = typeof effect === 'string' ? effect : effect.effect;
      assert.match(name, /^(reach|toggle:[a-z-]+|step:[+-](\d+|page)|to:(min|max|first|last)|focus:(next|prev|first|last)|open|close|commit|revert|select)$/u, `${folder}: ${key}`);
    }
    const table = json(`src/smart/${folder}/aliases.json`);
    const {rows} = readAliasTable(table, {tag: manifest.tag});
    for (const row of rows) {
      assert.equal(row.since, '2026-10-27', `${folder}: ${row.from}`);
      assert.equal(row.remove_after, '2026-12-01', `${folder}: ${row.from}`);
    }
    // Every event row names the DOM name the element sends now (§8).
    const names = Object.values(readManifest(manifest).events).map((event) => event.name);
    for (const row of rows.filter((one) => one.kind === 'event')) assert.ok(names.includes(row.to), `${folder}: ${row.from} → ${row.to}`);
  }
});

test('sf-steps: the person\'s move is sf-steps-change with data only; the action reports nothing', () => {
  const manifest = json('src/smart/steps/component.json');
  assert.equal(readManifest(manifest).events.change.name, 'sf-steps-change');
  assert.deepEqual(Object.keys(manifest.events.change.carries), ['previous', 'current', 'item', 'items']);
  const {rows} = readAliasTable(json('src/smart/steps/aliases.json'), {tag: 'sf-steps'});
  assert.deepEqual(rows.map((row) => [row.from, row.to, row.mode]), [['sf-step-change', 'sf-steps-change', 'split']]);
  const source = read('src/smart/steps/index.js');
  assert.match(source, /'sf-step-change': \(detail\) => \(\{\s*component: this,/u);
  assert.match(source, /goToStep\(index\) \{\s*return this\.moveToStep\(index, \{ person: false \}\);/u);
  assert.doesNotMatch(source, /emitComponentEvent\('step-change'/u);
});

test('sf-breadcrumbs: a press is sf-breadcrumbs-press, cancelable, with data only; the old click keeps its detail', () => {
  const manifest = json('src/smart/breadcrumbs/component.json');
  const event = readManifest(manifest).events.press;
  assert.equal(event.name, 'sf-breadcrumbs-press');
  assert.equal(event.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.press.carries), ['item', 'index', 'items']);
  assert.ok(!('aria-label' in manifest.settings), 'aria-label is a host attribute (§3.1)');
  const {rows} = readAliasTable(json('src/smart/breadcrumbs/aliases.json'), {tag: 'sf-breadcrumbs'});
  assert.deepEqual(rows.filter((row) => row.kind === 'event').map((row) => [row.from, row.to, row.mode]), [['sf-breadcrumb-click', 'sf-breadcrumbs-press', 'split']]);
  const source = read('src/smart/breadcrumbs/index.js');
  assert.match(source, /allowed = this\.sfEmit\('press', \{/u);
  assert.match(source, /originalEvent: this\._pressOrigin \?\? null/u);
  assert.doesNotMatch(source, /new CustomEvent\('sf-breadcrumb-click'/u);
});

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';

// The overlay family from its component.json (standard simai.smart-component
// 1.3.8 §3, §4, §8, §16.20, §19): sf-modal, sf-drawer, sf-popover, sf-dropdown,
// sf-context-menu, sf-toast, sf-tooltip. The browser half, on the built bytes,
// is tests/browser/overlays-manifest.browser.mjs (each folder's probe.json).

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const {readManifest} = await import('../src/core/js/element-manifest.js');
const {readAliasTable} = await import('../src/core/js/alias-table.js');

const FOLDERS = ['modal', 'drawer', 'popover', 'dropdown', 'context-menu', 'toast', 'tooltip'];
const present = FOLDERS.filter((folder) => existsSync(new URL(`../src/smart/${folder}/component.json`, import.meta.url)));

test('every overlay is made from its component.json, language files and aliases', () => {
  for (const folder of present) {
    const source = read(`src/smart/${folder}/index.js`);
    for (const file of ['./component.json', './aliases.json', './lang/en.json', './lang/ru.json']) {
      assert.match(source, new RegExp(`from ['"]${file.replace(/[./]/gu, (c) => `\\${c}`)}['"]`), `${folder}: ${file}`);
    }
    assert.match(source, /elementFromManifest\(manifest, \{/u, folder);
    for (const file of ['examples.json', 'probe.json']) assert.ok(existsSync(new URL(`../src/smart/${folder}/${file}`, import.meta.url)), `${folder}/${file}`);
    const manifest = json(`src/smart/${folder}/component.json`);
    assert.ok(!('x-todo' in manifest), `${folder}: every x-todo is decided`);
    assert.ok(Array.isArray(manifest['x-decisions']) && manifest['x-decisions'].length, `${folder}: x-decisions`);
    assert.ok(Object.keys(manifest['css-variables'] ?? {}).length >= 5, `${folder}: 5–10 public variables (§6)`);
    // A layer, or the decision that the component is none (sf-tooltip draws in place).
    assert.ok(manifest.layer?.kind || manifest['x-decisions'].some((line) => line.startsWith('layer: none')), `${folder}: a layer (§19.1)`);
    const en = json(`src/smart/${folder}/lang/en.json`);
    const ru = json(`src/smart/${folder}/lang/ru.json`);
    assert.deepEqual(Object.keys(en.runtime ?? {}).sort(), Object.keys(ru.runtime ?? {}).sort(), `${folder}: ru and en say the same words`);
    for (const [verb, event] of Object.entries(manifest.events ?? {})) {
      if (event['own-verb']) assert.ok(en.events?.[verb]?.label && ru.events?.[verb]?.label, `${folder}: own verb ${verb} has its word (§8)`);
    }
    const table = json(`src/smart/${folder}/aliases.json`);
    const {rows} = readAliasTable(table, {tag: manifest.tag});
    for (const row of rows) {
      assert.equal(row.since, '2026-10-27', `${folder}: ${row.from}`);
      assert.equal(row.remove_after, '2026-12-01', `${folder}: ${row.from}`);
    }
  }
});

test('sf-modal: names by vocabulary 1.1.5, the old ones through split rows with the old detail', () => {
  const manifest = json('src/smart/modal/component.json');
  const read1 = readManifest(manifest);
  assert.deepEqual(Object.keys(read1.events), ['open', 'opened', 'close', 'closed', 'minimize', 'minimized', 'expand', 'expanded', 'content-upload', 'content-uploaded']);
  assert.equal(read1.events.close.name, 'sf-modal-close');
  assert.equal(read1.events.close.cancelable, true);
  assert.deepEqual(manifest.events.close.carries.reason.values, ['close', 'escape', 'outside', 'cancelled', 'api']);
  assert.deepEqual(manifest.layer, {kind: 'modal', 'locks-page': true, 'traps-focus': true});
  assert.ok(manifest['side-effects'].includes('portal'));
  // §3.1: no prototype names; hide was a setting and an action at once.
  for (const name of ['title', 'blur', 'hide', 'aria-label', 'unclose']) assert.ok(!(name in manifest.settings), name);
  assert.ok(manifest.settings.heading && manifest.settings['backdrop-blur'] && manifest.settings.minimizable);
  const {rows, refused} = readAliasTable(json('src/smart/modal/aliases.json'), {tag: 'sf-modal'});
  const events = rows.filter((row) => row.kind === 'event').map((row) => [row.from, row.to, row.mode]);
  assert.deepEqual(events.find(([from]) => from === 'modal:after-hide'), ['modal:after-hide', 'sf-modal-minimized', 'split']);
  assert.deepEqual(events.find(([from]) => from === 'modal:before-show'), ['modal:before-show', 'sf-modal-expand', 'split']);
  assert.deepEqual(events.find(([from]) => from === 'modal:after-content-upload'), ['modal:after-content-upload', 'sf-modal-content-uploaded', 'split']);
  assert.ok(events.every(([, , mode]) => mode === 'split'));
  assert.deepEqual(rows.filter((row) => row.kind === 'action').map((row) => [row.from, row.to]), [['hide', 'minimize'], ['show', 'expand']]);
  assert.deepEqual(refused.map((one) => one.from), ['unclose', 'aria-label', 'getModalRoot', 'getSlotHtml', 'modal:ready', 'modal:update']);
  const source = read('src/smart/modal/index.js');
  assert.match(source, /sfAliasAdapters\(\) \{\s*const add = \(detail\) => \(\{ \.\.\.detail, component: this, modal: this, root: this\._root\(\) \}\);/);
  assert.doesNotMatch(source, /let modalUid|\+\+modalUid/, 'no module counter (#41)');
  assert.match(source, /partId\(instancePath\(this\)\)/);
  assert.match(source, /noteRetired\("action", "getModalRoot"\)/);
  assert.match(source, /retiredEvent\("modal:ready", this\._readyDetail\)/);
  assert.doesNotMatch(source, /MODAL_TEXT|Закрыть/, 'words live in the language files');
});

test('sf-modal: an assembly\'s ask waits for the person\'s answer {accepted, reason, value} (§19.4)', () => {
  const source = read('src/smart/modal/index.js');
  assert.match(source, /open\(options = \{\}, \{ signal \} = \{\}\) \{/);
  assert.match(source, /return asked \? this\.waitForAnswer\(signal\) : applied\(\);/);
  assert.match(source, /accepted: Boolean\(this\._answer\?\.accepted\),\s*reason,\s*value: this\._answer\?\.value \?\? null,/);
  assert.match(source, /confirm\(params = \{\}\) \{\s*if \(!this\.openState\) return refused\("closed"\);\s*this\._answer = \{ accepted: true, value: params\?\.value \?\? null \};\s*return this\.close\(\{ reason: "close" \}\);/);
  // The assembly reads an element's {outcome} as its {answer}.
  assert.match(read('src/core/js/assembly/values.mjs'), /typeof value\.outcome === 'string'\) return outcomeOf\(\{\.\.\.value, answer: value\.outcome\}\)/);
  assert.match(read('src/core/js/element-manifest.js'), /static get sfInterface\(\) \{ return manifest; \}/);
});

test('one page trigger: data-sf-action="<id>.<action>" runs a declared action (§8)', async () => {
  const {readPageAction} = await import('../src/core/js/page-actions.js');
  assert.deepEqual(readPageAction('m1.confirm'), {id: 'm1', action: 'confirm'});
  assert.deepEqual(readPageAction('page/a1/dialog.open'), {id: 'page/a1/dialog', action: 'open'});
  assert.equal(readPageAction('nothing'), null);
  assert.equal(readPageAction('.open'), null);
  const source = read('src/core/js/page-actions.js');
  assert.match(source, /if \(!declared\.some\(\(action\) => action\.name === read\.action\)\) return null;/);
  assert.match(read('src/core/js/element-manifest.js'), /if \(read\.actions\.length\) bindPageActions\(\);/);
});

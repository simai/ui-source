// Owner decision C151 (icons study control/research/2026-11-14-icons.md, prototype
// prototypes/icons-study.html): the eight points as contracts of the source.
// The drawn sizes, the mirroring, the empty box of an unknown name and the
// registered glyph are measured in a browser by the decision's probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const glyphs = await import(path.join(root, 'src/core/js/icon-glyphs.js'));
const choices = await import(path.join(root, 'src/core/js/icon-choices.js'));
const names = JSON.parse(read('src/core/contracts/icon-names.v1.json'));
const meanings = JSON.parse(read('src/core/contracts/icon-meanings.v1.json'));

test('C151 point 1: ladder size names in a ladder region, the old scale elsewhere until 2027-01-01', () => {
  const styles = read('src/component/icons/scss/_css__icons.scss');
  for (const step of ['1\\/3', '1\\/2', '1', '2', '3']) {
    const key = step.replace('\\', '');
    assert.ok(styles.includes(`'${key}': (var(--sf-text-height-${step}), var(--sf-text-height-${step}))`), step);
  }
  assert.match(styles, /\[data-sf-icon-scale='ladder'\] \.sf-icon--size-#\{icon-step-class\(\$size\)\}/);
  assert.match(styles, /sf-icon\[data-sf-icon-scale='ladder'\]\[size="#\{\$size\}"\]:not\(:defined\)/);
  const source = read('src/smart/icon/index.js');
  assert.match(source, /"1": "1\/3",\n  "2": "1\/2",\n  "3": "1",/);
  assert.match(source, /remove_after: "2027-01-01"/);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((row) => row.id === 'value-icon-size-ladder');
  assert.equal(record?.remove_after, '2027-01-01');
});

test('C151 point 2: an unknown name keeps an empty box and names the nearest icon', () => {
  const styles = read('src/component/icons/scss/_css__icons.scss');
  assert.match(styles, /overflow: clip;/);
  assert.match(styles, /\.sf-icon\[data-sf-icon-missing\] \{\n  -webkit-text-fill-color: transparent;/);
  assert.ok(names.count > 4000 && names.names.length === names.count);
  for (const name of ['home', 'settings', 'more_horiz', 'done', 'mode_edit', 'database']) assert.ok(names.names.includes(name), name);
  assert.equal(glyphs.nearestIconName('setings', names.names), 'settings');
  assert.equal(glyphs.nearestIconName('hom', names.names), 'home');
  assert.equal(glyphs.nearestIconName('Home', names.names), 'home');
  assert.equal(glyphs.nearestIconName('no_such_icon_xyz_qq', names.names), '');
});

test('C151 point 3: directional glyphs turn over in a right-to-left part, mirror auto|on|off', () => {
  for (const name of ['arrow_forward', 'chevron_right', 'send', 'undo', 'redo', 'format_list_bulleted', 'open_in_new']) {
    assert.equal(glyphs.mirrorsInRtl(name), true, name);
    assert.equal(glyphs.mirrorsInRtl(name, 'off'), false, name);
  }
  for (const name of ['schedule', 'check', 'play_arrow', 'home']) {
    assert.equal(glyphs.mirrorsInRtl(name), false, name);
    assert.equal(glyphs.mirrorsInRtl(name, 'on'), true, name);
  }
  const manifest = JSON.parse(read('src/smart/icon/component.json'));
  assert.deepEqual(manifest.settings.mirror.values, ['auto', 'on', 'off']);
  assert.equal(manifest.settings.mirror.default, 'auto');
  assert.match(read('src/component/icons/scss/_css__icons.scss'), /\.sf-icon\[data-sf-icon-mirror\]:dir\(rtl\) \{\n  scale: -1 1;/);
});

test('C151 point 4: weight from the label, grade from the theme, optical size from the size; filled stays the author\'s', () => {
  const runtime = read('src/core/js/iconSubsetRuntime.js');
  assert.match(runtime, /const labelIconWeight = "500";/);
  assert.match(runtime, /const requestWeights = withLabelWeight\(requestConfig\.weights\);/);
  assert.doesNotMatch(runtime, /'wght' var\(--sf-icon--weight, 400\)/);
  assert.doesNotMatch(read('src/core/js/icon-subset-memory.js'), /'wght' var\(--sf-icon--weight, 400\)/);
  const source = read('src/smart/icon/index.js');
  assert.match(source, /if \(!this\.hasAttribute\("weight"\)\) return "";/);
  assert.match(source, /if \(!this\.hasAttribute\("grade"\)\) return "";/);
  const styles = read('src/component/icons/scss/_css__icons.scss');
  assert.match(styles, /\$sf-icon-ladder-optical: \(\n  '1\/3': \(20, 20\),\n  '1\/2': \(20, 20\),\n  '1': \(20, 24\),\n  '2': \(24, 28\),\n  '3': \(24, 36\),/);
  assert.match(styles, /\.sf-icon--filled,/);
});

test('C151 point 5: an icon in running text sits on the middle of the line', () => {
  const styles = read('src/component/icons/scss/_css__icons.scss');
  assert.doesNotMatch(styles, /vertical-align: bottom/);
  assert.equal(styles.match(/vertical-align: middle;/g).length, 2);
});

test('C151 point 6: SF.icons.register draws a product glyph in every icon slot', () => {
  assert.equal(glyphs.registerIcon('Bad Name', '<svg></svg>'), false);
  assert.equal(glyphs.registerIcon('c151-test', 'not svg'), false);
  assert.equal(glyphs.registerIcon('c151-test', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'), true);
  assert.ok(glyphs.registeredIcon('c151-test'));
  assert.equal(globalThis.SF.icons.register, glyphs.registerIcon);
  const runtime = read('src/core/js/iconSubsetRuntime.js');
  assert.match(runtime, /if \(registeredIcon\(normalizedIcon\)\) return 0;/);
  assert.match(runtime, /if \(registeredIcon\(tracked\.icon\)\) return true;/);
  assert.match(runtime, /markCustomGlyph\(el, icon\);/);
  assert.match(read('src/smart/icon/js/templates/default.js'), /data-sf-icon-custom=\$\{custom\}/);
  const api = JSON.parse(read('src/core/contracts/public-js-api.json'));
  assert.deepEqual(api.globals.find((row) => row.name === 'SF.icons').members, ['choices', 'register']);
});

test('C151 point 7: one meaning, one glyph -- the table and the build warning', () => {
  const all = new Set(names.names);
  const glyphNames = new Set(meanings.meanings.map((row) => row.glyph));
  for (const row of meanings.meanings) {
    assert.ok(all.has(row.glyph), row.glyph);
    for (const alternate of row.alternates) {
      assert.ok(all.has(alternate), alternate);
      assert.ok(!glyphNames.has(alternate), `${alternate} is both a glyph and an alternate`);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-alternates-'));
  fs.writeFileSync(path.join(dir, 'page.html'), '<sf-button icon-start="more_vert"></sf-button><i class="sf-icon">keyboard_arrow_down</i><sf-icon icon="more_horiz"></sf-icon>');
  const out = execFileSync(process.execPath, [path.join(root, 'scripts/check-icon-alternates.mjs'), dir], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  assert.equal(out, '');
  let strict = null;
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/check-icon-alternates.mjs'), dir, '--strict'], {stdio: 'pipe'});
  } catch (error) {
    strict = String(error.stderr);
  }
  assert.match(strict, /icon "more_vert" draws «ещё \(меню действий\)»/);
  assert.match(strict, /icon "keyboard_arrow_down"/);
  assert.match(strict, /2 alternate glyphs/);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('C151 point 8: SF.icons.choices carries Russian and English words, the dropdown searches them', () => {
  const list = choices.ICON_CHOICES;
  assert.equal(list.length, 120);
  assert.ok(Object.isFrozen(list));
  for (const name of list) {
    const words = list.words[name];
    assert.ok(words?.ru?.length && words?.en?.length, name);
  }
  assert.deepEqual(choices.iconWords('folder').ru, ['папка', 'каталог']);
  assert.ok(choices.iconWords('arrow_forward').en.includes('forward'));
  assert.ok(list.filter((name) => list.words[name].ru.some((word) => word.includes('папка'))).length >= 2);
  assert.match(read('src/smart/dropdown/index.js'), /const words = iconWords\(option\.icon\);/);
});

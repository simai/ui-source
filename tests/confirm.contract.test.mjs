// Block confirm (owner decision 2026-11-03, component sets, point 13;
// duplication audit 2026-11-03 A-5): sf-confirm, the plain question asked in
// place, and sf-confirm-change, the same question over values, moved in from
// package pro with its tag and API. Both are one confirm surface
// (src/smart/helpers/confirm-surface.js); their behaviour on the built bytes is
// held by tests/browser/confirm.browser.mjs and confirm-change.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the confirm surface applies nothing and keeps the question open when the host refuses the answer', () => {
  const surface = read('src/smart/helpers/confirm-surface.js');
  assert.match(surface, /const delivered = this\.sfEmit\("answer", \{id: this\.questionKey, accepted\}\);/u);
  assert.match(surface, /if \(!delivered\) \{\s*this\._pressed = null;\s*this\.setAttribute\("state", "open"\);/u);
  // Both answers weigh the same: outlined, one size.
  assert.equal([...surface.matchAll(/appearance="outline"/gu)].length, 2);
  for (const folder of ['confirm', 'confirm-change']) {
    const contract = json(`src/smart/${folder}/component.json`);
    assert.equal(contract.events.answer.cancelable, true, folder);
    assert.deepEqual(Object.keys(contract.actions).sort(), ['answer', 'cancel', 'confirm', 'open'], folder);
    assert.equal(contract.family, 'confirm', folder);
    assert.match(read(`src/smart/${folder}/index.js`), /from "\.\.\/helpers\/confirm-surface\.js"/u, folder);
    assert.match(read(`src/smart/${folder}/js/templates/default.js`), /renderConfirmFooter\(context, "sf-(?:confirm|change-confirm)"/u, folder);
  }
});

test('sf-confirm-change keeps its tag, API and former tag after the move from package pro', () => {
  const contract = json('src/smart/confirm-change/component.json');
  assert.equal(contract.tag, 'sf-confirm-change');
  assert.equal(contract.version, '1.4.0');
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['accept-text', 'change-id', 'changes', 'decline-text', 'disabled', 'expires-at', 'heading', 'heading-level', 'state']);
  const tags = json('src/smart/confirm-change/aliases.json').aliases.filter((row) => row.kind === 'tag');
  assert.deepEqual(tags.map((row) => [row.from, row.remove_after]), [['sf-change-confirm', '2027-01-01']]);
  // The Framework rule lists it; the package references no longer do.
  assert.match(read('src/core/js/rule.src.js'), /smart\/confirm-change\/rule\.js/u);
  assert.match(read('src/core/js/rule.src.js'), /smart\/confirm\/rule\.js/u);
  for (const name of ['pro', 'larena']) {
    const provides = json(`src/core/contracts/packages/${name}.package.json`).provides;
    assert.ok(!provides.some((entry) => entry.id === 'smart.confirm-change'), `${name} no longer provides it`);
  }
});

test('sf-confirm: a group named by its question, Escape declines, a destructive acceptance wears the error status', () => {
  const contract = json('src/smart/confirm/component.json');
  assert.equal(contract.tag, 'sf-confirm');
  assert.equal(contract.accessibility.role, 'group');
  assert.equal(contract.keyboard.host.Escape, 'cancel');
  const template = read('src/smart/confirm/js/templates/default.js');
  assert.match(template, /role="group"/u);
  assert.match(template, /acceptStatus: context\.destructive \? "error" : ""/u);
  const source = read('src/smart/confirm/index.js');
  assert.match(source, /event\.key !== "Escape"/u);
  assert.match(source, /event\.stopPropagation\(\);\s*this\.cancel\(\);/u);
  // Words in both languages, the same keys.
  const ru = json('src/smart/confirm/lang/ru.json').runtime;
  const en = json('src/smart/confirm/lang/en.json').runtime;
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  assert.equal(ru['decline-text'], 'Отмена');
});

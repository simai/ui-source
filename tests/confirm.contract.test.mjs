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
  assert.match(surface, /if \(!delivered\) \{\s*this\._pressed = null;\s*this\._declinedHere = false;\s*this\.setAttribute\("state", "open"\);/u);
  // A plain question: two outlined answers of one weight. A dangerous one
  // (decision C25): a filled danger acceptance and a quiet declining answer.
  assert.match(surface, /appearance=\$\{danger \? "default" : "outline"\}/u);
  // In the question window (C39) the declining answer is tonal beside it.
  assert.match(surface, /const quiet = window \? "tonal" : "ghost";/u);
  assert.match(surface, /appearance=\$\{danger \? quiet : "outline"\}/u);
  assert.match(surface, /status=\$\{danger \? "danger" : nothing\}/u);
  // The answers stand on the element's size (default 1), never a fixed 1/2
  // (C22): a template's size is relative, so density moves them.
  assert.doesNotMatch(surface, /size="1\/2"/u);
  assert.equal([...surface.matchAll(/size=\$\{size\}/gu)].length, 2);
  // The safe answer takes the focus when the question is put (C25).
  assert.match(surface, /focusSafeAnswer\(frames = 10\) \{/u);
  assert.match(surface, /\[data-action="decline"\]/u);
  assert.match(surface, /this\.whenRendered\(\(\) => this\.focusSafeAnswer\(\), \{next: reopened\}\);/u);
  // The outcome is the success role on the surface, not a container's ink (C16).
  for (const folder of ['confirm', 'confirm-change']) {
    const css = read(`src/smart/${folder}/js/templates/default.css`);
    assert.match(css, /--accepted [^{]*__status \{ color: var\(--sf-success\); \}/u, folder);
    assert.doesNotMatch(css, /var\(--sf-on-success-container\)/u, folder);
  }
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
  assert.equal(contract.version, '1.7.0');
  // 1.7.0 (C40): the values are sf-change's list, which it fetches.
  assert.ok(contract.relations.some(({name}) => name === 'cl-change'));
  assert.match(read('src/smart/confirm-change/js/templates/default.js'), /<sf-change class="sf-change-confirm__list" layout="list" \.changes=/u);
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

test('sf-confirm: a group named by its question, Escape declines, a dangerous acceptance is status danger (destructive its former name)', () => {
  const contract = json('src/smart/confirm/component.json');
  assert.equal(contract.tag, 'sf-confirm');
  assert.equal(contract.accessibility.role, 'group');
  assert.equal(contract.keyboard.host.Escape, 'cancel');
  const template = read('src/smart/confirm/js/templates/default.js');
  assert.match(template, /role="group"/u);
  assert.match(template, /acceptStatus: context\.danger \? "danger" : ""/u);
  assert.deepEqual(contract.settings.status.values, ['', 'danger']);
  assert.deepEqual(contract.settings.size.values, ['1/3', '1/2', '1', '2', '3']);
  assert.equal(contract.settings.size.default, '1');
  assert.match(contract.settings.destructive.summary, /2027-01-01/u);
  assert.equal(contract.version, '1.3.0');
  assert.ok(contract.slots.description['x-summary']);
  for (const [name, variable] of Object.entries(contract['css-variables'])) assert.ok(variable['x-summary'], name);
  const source = read('src/smart/confirm/index.js');
  assert.match(source, /event\.key !== "Escape"/u);
  // In a page the key goes no further; in a window it goes on to the window (D4).
  assert.match(source, /const result = this\.cancel\(\);\s*if \(result\?\.outcome === "applied" && inWindow\(this\)\) return;\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/u);
  // Words in both languages, the same keys.
  const ru = json('src/smart/confirm/lang/ru.json').runtime;
  const en = json('src/smart/confirm/lang/en.json').runtime;
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  assert.equal(ru['decline-text'], 'Отмена');
  // A declined question says nothing (C35, R067): no «Отменено», no word for it.
  // The surface's own rule, so sf-confirm-change says nothing either.
  assert.match(read('src/smart/helpers/confirm-surface.js'), /if \(shown === "declined"\) return "";/u);
  assert.equal(ru['declined-text'], undefined);
  assert.equal(en['declined-text'], undefined);
  assert.equal(json('src/smart/confirm-change/lang/ru.json').runtime['declined-text'], undefined);
  assert.equal(json('src/smart/confirm-change/lang/en.json').runtime['declined-text'], undefined);
});

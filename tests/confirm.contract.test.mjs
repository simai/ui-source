// Block confirm (owner decision 2026-11-03, component sets, point 13;
// duplication audit 2026-11-03 A-5): sf-confirm, the plain question asked in
// place, and sf-confirm-change, the same question over values, moved in from
// package pro with its tag and API. Both are one confirm surface
// (src/smart/helpers/confirm-surface.js); their behaviour on the built bytes is
// held by tests/browser/confirm.browser.mjs and confirm-change.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {paintBlocks} from './support/paint-blocks.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the confirm surface applies nothing and keeps the question open when the host refuses the answer', () => {
  const surface = read('src/smart/helpers/confirm-surface.js');
  assert.match(surface, /const delivered = this\.sfEmit\("answer", \{id: this\.questionKey, accepted\}\);/u);
  assert.match(surface, /if \(!delivered\) \{\s*this\._pressed = null;\s*this\._declinedHere = false;\s*this\.setAttribute\("state", "open"\);/u);
  // A plain question's accepting answer is outlined; a dangerous one
  // (decision C25) a filled danger acceptance. The declining answer is always
  // quiet, ghost on-surface, in a card and in the window alike (C116, #q-cancel).
  assert.match(surface, /acceptAppearance = "outline"/u);
  assert.match(surface, /appearance=\$\{danger \? "default" : acceptAppearance\}/u);
  // sf-confirm 1.3.7 (written on the branch as 1.3.6; C183, C176; DEV msg-68999d65): a plain question's
  // accepting answer is the main answer, filled primary, in every form.
  const confirmTemplate = read('src/smart/confirm/js/templates/default.js');
  assert.equal([...confirmTemplate.matchAll(/renderConfirmFooter\(context, "sf-confirm", \{acceptStatus: context\.danger \? "danger" : "", acceptAppearance: "default"/gu)].length, 2);
  assert.match(surface, /declineAppearance = "ghost"/u);
  assert.match(surface, /appearance=\$\{declineAppearance\}\s+scheme="on-surface"\s+size=\$\{size\}\s+text=\$\{context\.declineText\}/u);
  // C183 (6), sf-confirm-change 1.9.0: «Подтвердить» the main answer, filled
  // primary, «Отклонить» quiet; a dangerous change (status="danger", CT-4)
  // the filled danger acceptance of C25. The status line (the deadline) under
  // the answers, after them in the markup. The former block's classes ride
  // beside the new ones (CT-13).
  assert.match(read('src/smart/confirm-change/js/templates/default.js'), /renderConfirmFooter\(context, "sf-confirm-change", \{\s*acceptStatus: context\.danger \? "danger" : "",\s*acceptAppearance: "default",\s*declineAppearance: "ghost",\s*statusLast: true,\s*formerBlock: "sf-change-confirm",\s*\}\)/u);
  assert.match(surface, /statusLast \? html`\$\{actions\}\$\{status\}` : html`\$\{status\}\$\{actions\}`/u);
  // The answers at the start, the accepting one first, 8 apart (C166, CT-3).
  const changeSheet = read('src/smart/confirm-change/js/templates/default.css');
  assert.match(changeSheet, /\.sf-confirm-change__footer \{[^}]*flex-direction: column;[^}]*justify-content: flex-start;/u);
  assert.match(changeSheet, /\.sf-confirm-change__actions \{\s*display: flex;\s*gap: var\((?:--sf-space-1\\\/3|--sf-gap--actions)\);/u);
  assert.match(changeSheet, /\.sf-confirm-change__actions:not\(\[hidden\]\) \+ \.sf-confirm-change__status:has\(> span\) \{\s*margin-block-start: var\(--sf-space-1\\\/3\);/u);
  // C183 test: the deadline is an sf-time (CT-12).
  assert.match(read('src/smart/confirm-change/index.js'), /<sf-time class="sf-confirm-change__until"/u);
  assert.doesNotMatch(changeSheet, /space-between/u);
  assert.doesNotMatch(surface, /"tonal"/u);
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
    assert.match(paintBlocks(css), /--accepted [^{]*__status \{\s*color: var\(--sf-success\);\s*\}/u, folder); // C273: paint
    assert.doesNotMatch(css, /var\(--sf-on-success-container\)/u, folder);
  }
  for (const folder of ['confirm', 'confirm-change']) {
    const contract = json(`src/smart/${folder}/component.json`);
    assert.equal(contract.events.answer.cancelable, true, folder);
    assert.deepEqual(Object.keys(contract.actions).sort(), ['answer', 'cancel', 'confirm', 'open'], folder);
    assert.equal(contract.family, 'confirm', folder);
    assert.match(read(`src/smart/${folder}/index.js`), /from "\.\.\/helpers\/confirm-surface\.js"/u, folder);
    assert.match(read(`src/smart/${folder}/js/templates/default.js`), /renderConfirmFooter\(context, "sf-(?:confirm|confirm-change)"/u, folder);
  }
});

test('sf-confirm-change keeps its tag, API and former tag after the move from package pro', () => {
  const contract = json('src/smart/confirm-change/component.json');
  assert.equal(contract.tag, 'sf-confirm-change');
  assert.equal(contract.version, '1.10.6'); // group build 9: 1.9.1 moved on by the merged branches or a GB9 patch // C282: 1.9.2 moved on by the language-file patch (Russian is a language file) // group build 10: 1.10.1 moved on by the merged branches or a GB10 patch // group build 13: 1.10.5 moved on by the merged branches or a GB11 merge
  // 1.7.0 (C40): the values are sf-change's list, which it fetches.
  assert.ok(contract.relations.some(({name}) => name === 'cl-change'));
  assert.match(read('src/smart/confirm-change/js/templates/default.js'), /<sf-change class="sf-confirm-change__list sf-change-confirm__list" layout="list" \.changes=/u);
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['accept-text', 'change-id', 'changes', 'decline-text', 'disabled', 'expires-at', 'heading', 'heading-level', 'state', 'status']);
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
  assert.equal(contract.version, '1.5.6'); // group build 8: 1.3.7 moved on by the merged branches or a GB8 patch // 1.4.0: require-text says {name} (C177 follow-up #86) // C282: 1.4.0 moved on by the language-file patch (Russian is a language file) // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch // group build 13: 1.5.5 moved on by the merged branches or a GB11 merge
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

test('C166 (4), R245: every question puts its answers first, at the start, 8 apart; the inline one stands on a quiet plate', () => {
  // sf-confirm: one row, the answers first at the start, a button group's gap (C173 role, 8) apart.
  {
    const css = read('src/smart/confirm/js/templates/default.css');
    const footer = css.match(/\.sf-confirm__footer \{([^}]*)\}/u)[1];
    assert.match(footer, /justify-content: flex-start;/u, 'confirm: the answers at the start');
    assert.match(footer, /column-gap: var\(--sf-(?:gap--actions|space-1\\\/3)\);/u, "confirm: a button group's gap");
    const actions = css.match(/\.sf-confirm__actions \{([^}]*)\}/u)[1];
    assert.match(actions, /order: -1;/u, 'confirm: the answers before the status line');
    assert.doesNotMatch(css, /justify-content: space-between/u, 'confirm: no answers at the end');
  }
  // sf-confirm-change (group build 7): the same answers at the start, with C183 (6)'s status line under them
  // (a column, the answers first in the markup), the later decision on this element.
  {
    const css = read('src/smart/confirm-change/js/templates/default.css');
    const footer = css.match(/\.sf-confirm-change__footer \{([^}]*)\}/u)[1];
    assert.match(footer, /flex-direction: column;/u);
    assert.match(footer, /align-items: flex-start;/u, 'confirm-change: the answers at the start');
    assert.doesNotMatch(css, /justify-content: space-between/u, 'confirm-change: no answers at the end');
  }
  const css = read('src/smart/confirm/js/templates/default.css');
  const inline = css.match(/\.sf-confirm--inline \{([^}]*)\}/u)[1];
  assert.match(paintBlocks(css), /\.sf-confirm--inline \{\s*background: var\(--sf-confirm-background-color, var\(--sf-surface-container\)\);/u); // C273: paint
  assert.match(inline, /border-radius: var\(--sf-confirm-radius, var\(--sf-radius-2\)\);/u);
  assert.doesNotMatch(inline, /border:/u, 'no second frame');
  // On a phone the answers share the row in halves in every form, measured.
  assert.match(css, /\.sf-confirm__actions > sf-button > button \{\s*inline-size: 100%;/u);
  assert.match(read('src/smart/confirm/index.js'), /const actions = this\.querySelector\("\.sf-confirm__actions"\);/u);
});

test('sf-confirm-change 1.9.1 (RG-DP-1): expires-at names the event the card fires, not its former name', () => {
  const summary = json('src/smart/confirm-change/component.json').settings['expires-at'].summary;
  assert.match(summary, /says so once with sf-confirm-change-expired\./u);
  assert.doesNotMatch(summary, /sf-change-confirm-expired/u);
  const manifest = json('src/smart/confirm-change/smart.manifest.json');
  assert.equal(manifest.version, '1.10.6'); // group build 9: 1.9.1 moved on by the merged branches or a GB9 patch // C282: 1.9.2 moved on by the language-file patch (Russian is a language file) // group build 10: 1.10.1 moved on by the merged branches or a GB10 patch // group build 13: 1.10.5 moved on by the merged branches or a GB11 merge
  assert.equal(manifest.inputs.properties['expires-at'].description, summary);
  // The former names stay dated aliases until their date (the aliases are unchanged).
  const events = json('src/smart/confirm-change/aliases.json').aliases.filter((row) => row.kind === 'event');
  assert.ok(events.some((row) => row.from === 'sf-change-confirm-expired'));
  assert.ok(events.some((row) => row.to === 'sf-change-confirm-expired'));
});

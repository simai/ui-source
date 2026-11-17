// sf-list 1.15.0: owner decisions C189 (8) and C167 (3) for the recipe
// «mail-chat-list» -- a letter unread without a count (item unread), and the
// row's time at its end (setting time-format), drawn by sf-time (C40) in
// sf-list-item's end column (C148 (2)).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the names: item unread (boolean), setting time-format none|auto|relative|exact, word unread-text', () => {
  const contract = json('src/smart/list/component.json');
  assert.equal(contract.version, '1.21.1'); // GB7 refresh: fix/list-lines-c130's number (the branch wrote 1.15.0; group build 7 1.17.0) // group build 8: 1.18.0 moved on by the merged branches or a GB8 patch // group build 9: 1.20.0 moved on by the merged branches or a GB9 patch // C282: 1.20.2 moved on by the language-file patch (Russian is a language file)
  assert.equal(contract.settings.items.of.unread.type, 'boolean');
  const format = contract.settings['time-format'];
  assert.deepEqual(format.values, ['none', 'auto', 'relative', 'exact']);
  assert.equal(format.default, 'none');
  // The values are sf-list-timeline's, plus none.
  const timeline = json('src/smart/list-timeline/component.json').settings['time-format'].values;
  assert.deepEqual(format.values.filter((value) => value !== 'none'), timeline);
  assert.equal(json('src/smart/list/lang/ru.json').runtime['unread-text'], 'не прочитано');
  assert.equal(json('src/smart/list/lang/en.json').runtime['unread-text'], 'unread');
  assert.ok(contract.relations.some((relation) => relation.name === 'cl-time'), 'sf-time is a relation of sf-list');
});

test('the row draws sf-time without a tooltip, before the badge and the count, and the word for an unread row without a count', () => {
  const template = read('src/smart/list/js/templates/default.js');
  assert.match(template, /<sf-time class="sf-list__time" datetime=\$\{moment\} format=\$\{format\} tooltip="none"><\/sf-time>/u);
  assert.ok(template.indexOf('class="sf-list__time"') < template.indexOf('class="sf-list__badge"'));
  assert.ok(template.indexOf('class="sf-list__badge"') < template.indexOf('class="sf-list__count"'));
  assert.match(template, /const unreadWord = !count && context\.unreadOf\(item\);/u);
  assert.match(template, /<span class="sf-list__unread sr-only">\$\{context\.unreadText\}<\/span>/u);
});

test('the format: the clock time under a day heading, sf-time auto elsewhere, none draws nothing', () => {
  const source = read('src/smart/list/index.js');
  assert.match(source, /if \(asked !== "auto" && asked !== "relative" && asked !== "exact"\) return null;/u);
  assert.match(source, /const underDay = this\.groupBy === "day" && typeof group\?\.key === "string" && group\.key\.startsWith\("day:"\);/u);
  assert.match(source, /return underDay \? "time" : "auto";/u);
  assert.match(source, /if \(asked === "exact"\) return underDay \? "time" : "datetime";/u);
});

test('the sheet: the time on the title\'s line of the end column, dim, main ink when unread; a word-only end part takes no place', () => {
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list-item--two-line > \.sf-list-item-wrap > \.sf-list__meta > \.sf-list__time,\n\s*\.sf-list-item--two-line > \.sf-list-item-wrap > \.sf-list__meta > \.sf-list__time > \* \{\n\s*grid-row: 1;\n\s*grid-column: 1;\n\s*justify-self: end;/u);
  assert.match(sheet, /:has\(> \.sf-list__badge\):has\(> \.sf-list__count\) > \.sf-list__time > \* \{\n\s*grid-column: 1 \/ span 2;/u);
  assert.match(sheet, /\.sf-list__row--unread > sf-list-item > \.sf-list-item:not\(\.disabled\) > \.sf-list-item-wrap > \.sf-list__meta > \.sf-list__time \{\n\s*color: var\(--sf-on-surface\);/u);
  // A one-line row's text is its container: the unread weight reaches it too.
  assert.match(sheet, /\.sf-list__row--unread > sf-list-item > \.sf-list-item:not\(\.sf-list-item--two-line\) > \.sf-list-item-wrap > \.sf-list-item-container \{\n\s*font-weight: var\(--sf-weight--semi-bold\);/u);
  assert.match(sheet, /\.sf-list__meta:not\(:empty\):not\(:has\(> :not\(\.sr-only\)\)\) \{ display: contents; \}/u);
  // Values only from the systems: no pixel or raw colour in the new rules.
  const added = sheet.slice(sheet.indexOf('1.15.0: the end part'), sheet.indexOf('/* A two-line row\'s meta'));
  assert.doesNotMatch(added, /\d+px|#[0-9a-f]{3,8}\b|rgb\(/iu);
});

// Block list (component sets, point 13; duplication audit 2026-11-03, A-4 and
// A-6): sf-list, the list a person acts on, and sf-list-feed, the column a
// person reads from the newest at the end. sf-list-feed takes over package
// pro's sf-message-log on the core reading position
// (src/core/js/reading-position.js); sf-list draws its rows as sf-list-item.
// Their behaviour on the built bytes is held by tests/browser/list.browser.mjs
// and list-feed.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('both are the Framework\'s, family list, registered and in the rule', () => {
  const names = json('contracts/registry/names.json');
  const flat = JSON.stringify(names);
  for (const [folder, tag, version] of [['list', 'sf-list', '1.2.0'], ['list-feed', 'sf-list-feed', '1.0.2']]) {
    const contract = json(`src/smart/${folder}/component.json`);
    assert.equal(contract.tag, tag);
    assert.equal(contract.family, 'list', folder);
    assert.equal(contract.version, version, folder);
    assert.ok(flat.includes(`"${tag}"`), `${tag} is in the name registry`);
    assert.match(read('src/core/js/rule.src.js'), new RegExp(`smart/${folder}/rule\\.js`, 'u'));
    assert.match(read(`src/smart/${folder}/index.js`), new RegExp(`\\.define\\("${tag}"\\)`, 'u'));
    const ru = json(`src/smart/${folder}/lang/ru.json`).runtime;
    const en = json(`src/smart/${folder}/lang/en.json`).runtime;
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort(), `${folder}: the same words in both languages`);
  }
});

test('sf-list: rows are sf-list-item, one Tab stop, one shared menu, the next page by the core edge watch', () => {
  const contract = json('src/smart/list/component.json');
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['actions', 'empty-text', 'group-by', 'groups', 'has-more', 'heading-level', 'items', 'label', 'loading', 'no-wrap', 'renamable', 'selected', 'size']);
  assert.deepEqual(contract.settings['group-by'].enum ?? contract.settings['group-by'].values, ['none', 'day', 'key']);
  assert.deepEqual(Object.keys(contract.events).sort(), ['apply', 'load-more', 'open', 'rename']);
  assert.equal(contract.events.rename.cancelable, true);
  assert.equal(contract.events['load-more'].cancelable, true);
  assert.deepEqual(Object.keys(contract.actions).sort(),
    ['append-items', 'detach', 'more-failed', 'open-menu', 'rename', 'request-more', 'set-items', 'upsert']);
  const template = read('src/smart/list/js/templates/default.js');
  // The row is the Framework's row, interactive, inside one [data-sf-list].
  assert.match(template, /<sf-list-item\s+interactive/u);
  assert.equal([...template.matchAll(/^\s+data-sf-list$/gmu)].length, 1);
  // «⋯» is not a Tab stop of its own; one context menu for every row.
  assert.match(template, /class="sf-list__actions[^"]*"\s+tabindex="-1"\s+aria-haspopup="menu"/u);
  assert.equal([...template.matchAll(/<sf-menu-context/gu)].length, 1);
  assert.match(template, /<sf-empty-state kind="no-data"/u);
  const source = read('src/smart/list/index.js');
  assert.match(source, /import \{scrollerOf, watchEdge\} from "\.\.\/\.\.\/core\/js\/reading-position\.js";/u);
  assert.match(source, /formatRelativeDay\(moment, \{now, capital: true, node: this\}\)/u);
  assert.match(source, /this\.sfEmit\("load-more", \{direction: "after", after:/u);
  // A refused rename puts the old title back.
  assert.match(source, /if \(!this\.sfEmit\("rename", \{id, text\}\)\) item\.text = before;/u);
  // The sheet reads its public variables and sets no public variable of the row.
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.doesNotMatch(sheet, /--sf-list-item-[a-z][a-z-]*\s*:/u);
});

test('sf-list 1.1.0: avatar, count, badge and pinned are bounded row data drawn with the Framework\'s parts', () => {
  const contract = json('src/smart/list/component.json');
  const of = contract.settings.items.of;
  assert.deepEqual(Object.keys(of).sort(),
    ['actions', 'avatar', 'badge', 'count', 'date', 'disabled', 'group', 'icon', 'id', 'pinned', 'supporting', 'text']);
  // Additions only: no setting, event or action of 1.0.0 changed (1.2.0 adds no-wrap).
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['actions', 'empty-text', 'group-by', 'groups', 'has-more', 'heading-level', 'items', 'label', 'loading', 'no-wrap', 'renamable', 'selected', 'size']);
  const item = contract['x-registry'].contracts.item.properties;
  assert.deepEqual(item.avatar.properties.shape.enum, ['circle', 'square']);
  // The badge's tone is the Framework's status vocabulary.
  assert.deepEqual([...item.badge.properties.tone.enum].sort(), [...json('contracts/public-api-axes.json').status_vocabulary].sort());
  // A tag it renders is a tag it fetches.
  const relations = contract.relations.map((relation) => relation.name);
  for (const name of ['cl-avatar', 'cl-badge', 'cl-list-item']) assert.ok(relations.includes(name), name);
  assert.match(read('src/smart/list/rule.js'), /\{ name: 'cl-avatar' \},\n\s+\{ name: 'cl-badge' \}/u);
  const template = read('src/smart/list/js/templates/default.js');
  // The parts are the Framework's: sf-avatar, sf-badge; no renderer a host hands in.
  assert.match(template, /<sf-avatar\n/u);
  assert.match(template, /<sf-badge class="sf-list__count" line=\$\{line\} scheme="primary"/u);
  assert.match(template, /<sf-badge class="sf-list__badge" line=\$\{line\} appearance="tonal"/u);
  // A row is a dense place: both keep the tight side room (sf-badge 1.3.0).
  assert.match(template, /class="sf-list__count" line=\$\{line\} scheme="primary" tight/u);
  assert.match(template, /class="sf-list__badge" line=\$\{line\} appearance="tonal" tight/u);
  assert.doesNotMatch(read('src/smart/list/index.js'), /render(Row|Item|er)\s*[:=(]/u);
  // The slot elements are the row template's own, never a value of it: the
  // row takes its slot nodes once (smart-base captureSlotTemplates).
  assert.match(template, /><span slot="leading" class="sf-list__lead">\$\{leadContent\(context, item\)\}<\/span><span\n\s+slot="trailing" class="sf-list__meta">\$\{metaContent\(context, item\)\}<\/span><\/sf-list-item>`/u);
  assert.equal([...template.matchAll(/slot="trailing" class="sf-list__meta"/gu)].length, 2);
  // Pinned leads; the words in both languages, the count in plural forms.
  const source = read('src/smart/list/index.js');
  assert.match(source, /list\.unshift\(\{key: "pinned", heading: this\.sfWord\("pinned-text"\), items: pinned\}\)/u);
  assert.equal(json('src/smart/list/lang/ru.json').runtime['pinned-text'], 'Закреплённые');
  assert.equal(json('src/smart/list/lang/en.json').runtime['pinned-text'], 'Pinned');
  assert.deepEqual(Object.keys(json('src/smart/list/lang/ru.json').runtime['count-label']).sort(), ['few', 'many', 'one', 'other']);
  // The changelog line.
  assert.ok(contract['x-decisions'].some((line) => line.startsWith('version 1.1.0 (owner decision q-3b313e2246')));
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list__meta:empty \{ display: none; \}/u);
});

test('sf-list 1.2.0: no-wrap cuts a row\'s text with an ellipsis and keeps it whole in its tooltip; rows and «⋯» are 44px under a finger', () => {
  const contract = json('src/smart/list/component.json');
  assert.equal(contract.settings['no-wrap'].type, 'boolean');
  assert.equal(contract.settings['no-wrap'].default, false);
  assert.equal(json('src/smart/list/smart.manifest.json').inputs.properties['no-wrap'].type, 'boolean');
  assert.ok(contract['x-decisions'].some((line) => line.startsWith('version 1.2.0 (the UI Chat thread\'s request msg-f44b9ece')));
  const template = read('src/smart/list/js/templates/default.js');
  // The class on the frame and the whole text as the row's tooltip, on both row templates.
  assert.match(template, /\$\{context\.noWrap \? " sf-list--no-wrap" : ""\}/u);
  assert.match(template, /const tip = context\.noWrap \? \(supporting \? `\$\{text\} · \$\{supporting\}` : text\) : "";/u);
  assert.equal([...template.matchAll(/title=\$\{tip \|\| nothing\}/gu)].length, 2);
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list--no-wrap \.sf-list__row > sf-list-item > \.sf-list-item \.sf-list-item-container \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/u);
  // Under a finger: --sf-d1 for the rows, the rename field, the loading rows and the «⋯»; nothing on hover only.
  const touch = sheet.slice(sheet.indexOf('@media (pointer: coarse)'));
  assert.match(touch, /--sf-list--touch-height: max\(var\(--sf-list--row-height\), var\(--sf-d1\)\)/u);
  assert.match(touch, /\.sf-list__row > sf-list-item > \.sf-list-item \{ min-block-size: var\(--sf-list--touch-height\); \}/u);
  assert.match(touch, /\.sf-list__actions \{\s+min-block-size: var\(--sf-d1\);\s+min-inline-size: var\(--sf-d1\);/u);
  assert.doesNotMatch(sheet, /\.sf-list__actions[^{]*\{[^}]*(opacity|visibility)\s*:/u);
});

test('sf-list-feed: sf-message-log\'s behaviour under the list family\'s names, on the core reading position', () => {
  const contract = json('src/smart/list-feed/component.json');
  assert.deepEqual(Object.keys(contract.settings).sort(), ['changes', 'has-more', 'items', 'label', 'live']);
  assert.deepEqual(Object.keys(contract.events).sort(), ['begun', 'cancelled', 'chunk', 'completed', 'failed', 'load-more']);
  assert.equal(contract.events['load-more'].cancelable, true);
  assert.deepEqual(Object.keys(contract.actions).sort(),
    ['announce', 'cancel', 'detach', 'earlier-failed', 'prepend-items', 'redraw', 'request-earlier', 'scroll-to-latest', 'set-items', 'set-view', 'upsert']);
  const source = read('src/smart/list-feed/index.js');
  assert.match(source, /import \{readingPosition\} from "\.\.\/\.\.\/core\/js\/reading-position\.js";/u);
  assert.match(source, /this\._position\.keep\(/u);
  assert.match(source, /this\._position\.toEnd\(/u);
  // The message log's names stay in package pro: none is spelled here.
  for (const folder of ['index.js', 'js/templates/default.js', 'js/templates/default.css']) {
    assert.doesNotMatch(read(`src/smart/list-feed/${folder}`), /sf-message-log[-_]|renderMessage|announceMessage|setMessages|prependMessages/u, folder);
  }
  // The core helper is public, documented and published once.
  const api = JSON.stringify(json('src/core/contracts/public-js-api.json'));
  assert.ok(api.includes('SF.readingPosition'));
  assert.match(read('src/core/js/index.js'), /import '\.\/reading-position\.js';/u);
});

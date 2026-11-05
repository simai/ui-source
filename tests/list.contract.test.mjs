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
  for (const [folder, tag] of [['list', 'sf-list'], ['list-feed', 'sf-list-feed']]) {
    const contract = json(`src/smart/${folder}/component.json`);
    assert.equal(contract.tag, tag);
    assert.equal(contract.family, 'list', folder);
    assert.equal(contract.version, '1.0.0', folder);
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
    ['actions', 'empty-text', 'group-by', 'groups', 'has-more', 'heading-level', 'items', 'label', 'loading', 'renamable', 'selected', 'size']);
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

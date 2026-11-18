// A dated tag alias that ships words of its own (ui-control evidence
// 2026-11-18-pro-over-1ed6): sf-message-log is the heir of sf-list-feed and
// both tags share one words record (canonicalTag). Once the Russian language
// file arrived, the Framework's sf-list-feed words in that record said over
// sf-message-log's own: its region was «Лента», not «Переписка». A Framework
// pack's words are marked as the Framework's (STORE.floor); for a component
// that names itself by the alias, its shipped word wins over them. A word a
// product registers, or a product pack, still wins over everything; a key the
// alias does not ship still takes the pack's word. Both orders: the language
// file before core (its script form fills the store) and after (registerPack).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {registerLanguageFile} from '../scripts/language-file-node.mjs';

const {language, pageWord, localeText} = await import('../src/core/js/page-language.js');
const {canonicalTag, registerTagAliasRows} = await import('../src/core/js/tag-aliases.js');

// ui-pro's sf-message-log gives its row when it is defined (index.js,
// registerTagAliasRows): the Framework's table does not know the set's tags.
registerTagAliasRows([{from: 'sf-message-log', to: 'sf-list-feed', since: '2026-11-05', remove_after: '2027-01-01', package: 'pro'}]);
assert.equal(canonicalTag('sf-message-log'), 'sf-list-feed');

const ruFile = readFileSync(new URL('../src/core/lang/ru.js', import.meta.url), 'utf8');
const ruPack = JSON.parse(/var pack = (\{.*\});\n/u.exec(ruFile)[1]);

// sf-message-log's own words, as ui-pro ships them (lang/en.json, lang/ru.json).
const LOG = {
  en: {'region-label': 'Conversation', 'log-label': 'Messages', 'you-text': 'You'},
  ru: {'region-label': 'Переписка', 'log-label': 'Сообщения'},
};
const FEED = {en: {'region-label': 'Feed', 'log-label': 'Entries', 'you-text': 'You'}};
const russian = (tag) => ({closest: () => ({getAttribute: () => 'ru'}), tagName: tag.toUpperCase()});
const logWord = (key) => pageWord(LOG, key, russian('sf-message-log'), {component: 'sf-message-log', source: 'en'});
const feedWord = (key) => pageWord(FEED, key, russian('sf-list-feed'), {component: 'sf-list-feed', source: 'en'});

const orders = {
  'ru.js before core': () => registerLanguageFile('ru'),
  'pack after core': () => language.registerPack(ruPack),
};

for (const [order, load] of Object.entries(orders)) {
  test(`dated alias words, ${order}: the alias says its own, the feed the pack's`, () => {
    language.forget();
    load();
    assert.equal(ruPack.words['sf-list-feed']['region-label'], 'Лента');
    assert.equal(logWord('region-label'), 'Переписка');
    assert.equal(logWord('log-label'), 'Сообщения');
    assert.equal(localeText(LOG, 'region-label', 'ru', 'sf-message-log'), 'Переписка');
    // A key the alias does not ship in Russian takes the pack's word.
    assert.equal(logWord('you-text'), 'Вы');
    // The successor itself is unchanged.
    assert.equal(feedWord('region-label'), 'Лента');
    assert.equal(feedWord('log-label'), 'Записи');
    // English is not touched.
    assert.equal(pageWord(LOG, 'region-label', {closest: () => ({getAttribute: () => 'en'}), tagName: 'SF-MESSAGE-LOG'}, {component: 'sf-message-log'}), 'Conversation');
    language.forget();
  });

  test(`dated alias words, ${order}: a product's word wins, registered before or after`, () => {
    language.forget();
    language.register('sf-message-log', 'ru', {'log-label': 'Реплики'});
    load();
    assert.equal(logWord('log-label'), 'Реплики');
    language.register('sf-message-log', 'ru', {'region-label': 'Чат'});
    assert.equal(logWord('region-label'), 'Чат');
    // A product pack is a product's word too.
    language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'shop', lang: 'ru', words: {'sf-message-log': {'region-label': 'Беседа'}}});
    assert.equal(logWord('region-label'), 'Беседа');
    // A second Framework pack goes beneath and gives the record back to nobody.
    language.registerPack(ruPack);
    assert.equal(logWord('region-label'), 'Беседа');
    // Removing the product's language returns the alias to its own words.
    language.register('sf-message-log', 'ru', null);
    assert.equal(logWord('region-label'), 'Переписка');
    language.forget();
  });
}

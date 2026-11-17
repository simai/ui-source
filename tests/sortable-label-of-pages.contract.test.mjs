// Two small defects (ui-control control/evidence/2026-11-18-small-defects-2):
// 1. sf-sortable 1.7.1: an item's name in the move menu and the announcements
//    glued its parts («Заказ № 1002 Кафе «Лето»5 070,00 ₽», board study note 2).
// 2. A word asked before core ran (a Smart bundle placed before core.js, as
//    Docara pages and their example frames load core last) was reported
//    missing although the language's pack holds it (sf-pagination "of-pages"
//    in ui-view example frames). The browser half is the probes in the
//    evidence folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sortableItemLabel, sortableReadableText } from '../src/core/js/composition/sortable.mjs';

const read = (path) => readFileSync(new globalThis.URL(`../${path}`, import.meta.url), 'utf8');

// A small DOM: elements with a display, text nodes, attributes, a selector
// matcher good for the selectors the label reads.
function el(tag, { display, attrs = {}, cls = [] } = {}, ...children) {
  const node = {
    nodeType: 1, localName: tag, tagName: tag.toUpperCase(), attrs, cls, childNodes: [], display,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    matches(selector) {
      return selector.split(',').map((one) => one.trim()).some((one) => {
        if (one === tag) return true;
        if (one.startsWith('.')) return cls.includes(one.slice(1));
        const m = one.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/u);
        if (m) return m[1] in attrs && (m[2] === undefined || attrs[m[1]] === m[2]);
        return false;
      });
    },
    querySelector(selector) {
      const walk = (current) => {
        for (const child of current.childNodes) {
          if (child.nodeType !== 1) continue;
          if (child.matches(selector)) return child;
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(node);
    },
    ownerDocument: { defaultView: { getComputedStyle: (element) => ({ display: element.display ?? 'block' }) } },
  };
  for (const child of children) node.childNodes.push(typeof child === 'string' ? { nodeType: 3, nodeValue: child } : child);
  return node;
}

test('sf-sortable 1.7.1: an item is named by its blocks joined with commas, never one glued run', () => {
  // The board study's card: a flex row (checkbox, title button, handle), then two blocks.
  const card = el('div', { display: 'flex', attrs: { 'data-sf-sortable-item': 'o1002' } },
    el('div', { display: 'flex' },
      el('sf-checkbox', { display: 'inline-flex', attrs: { 'aria-label': 'Выбрать заказ № 1002' } }),
      el('button', { display: 'inline-block' }, 'Заказ № 1002'),
      el('sf-button-icon', { display: 'contents', attrs: { 'data-sf-sortable-handle': '' } }, el('span', { display: 'inline', attrs: { 'aria-hidden': 'true' } }, 'drag_indicator'))),
    '\n',
    el('div', {}, 'Кафе «Лето»'),
    el('div', {}, '5 070,00 ₽'));
  assert.equal(sortableItemLabel(card), 'Заказ № 1002, Кафе «Лето», 5 070,00 ₽');
  // Inline parts of one line stay in it; a hidden part, a tooltip and the live region are not read.
  const line = el('li', {}, 'Сек', el('b', { display: 'inline' }, 'ция'), ' первая',
    el('span', { display: 'none' }, 'скрыто'), el('span', { display: 'inline', attrs: { role: 'tooltip' } }, 'Подсказка'),
    el('div', { cls: ['sf-sortable-live'] }, 'Положено'));
  assert.equal(sortableItemLabel(line), 'Секция первая');
  // A flex item is a part of its own whatever its tag.
  assert.equal(sortableReadableText(el('div', { display: 'flex' }, el('span', { display: 'inline' }, 'Один'), el('span', { display: 'inline' }, 'Два'))), 'Один, Два');
  // display: contents passes its parent's layout on.
  assert.equal(sortableReadableText(el('div', { display: 'flex' }, el('x-wrap', { display: 'contents' }, el('span', { display: 'inline' }, 'А'), el('span', { display: 'inline' }, 'Б')))), 'А, Б');
  // Skip names more parts (the row mode's handle).
  assert.equal(sortableReadableText(el('td', {}, el('button', { display: 'inline-block', cls: ['grip'] }, 'Переместить'), 'Задача'), { skip: '.grip' }), 'Задача');
});

test('sf-sortable 1.7.1: aria-label, then aria-labelledby, then the title part name the item', () => {
  assert.equal(sortableItemLabel(el('div', { attrs: { 'aria-label': ' Своё  имя ' } }, el('div', {}, 'Текст'))), 'Своё имя');
  const title = el('div', { attrs: { id: 't1' } }, el('span', { display: 'inline' }, 'Заказ'), ' № 7');
  const labelled = el('div', { attrs: { 'aria-labelledby': 't1' } }, title, el('div', {}, 'Сумма'));
  labelled.getRootNode = () => ({ getElementById: (id) => (id === 't1' ? title : null) });
  assert.equal(sortableItemLabel(labelled), 'Заказ № 7');
  const card = el('div', {}, el('div', { attrs: { slot: 'title' } }, 'Заказ № 8'), el('div', {}, '100 ₽'));
  assert.equal(sortableItemLabel(card), 'Заказ № 8');
  const marked = el('div', {}, el('div', {}, 'Иконка'), el('h3', { attrs: { 'data-sf-sortable-label': '' } }, 'Заказ № 9'));
  assert.equal(sortableItemLabel(marked), 'Заказ № 9');
  // The move menu and the row mode read the same name.
  const menu = read('src/core/js/composition/sortable-move-menu.mjs');
  assert.match(menu, /const itemLabel = \(item\) => sortableItemLabel\(item\);/);
  const core = read('src/core/js/composition/sortable.mjs');
  assert.match(core, /\[\.\.\.item\.cells\]\.map\(\(cell\) => sortableReadableText\(cell, \{ skip \}\)\)/);
});

test('a word asked before core runs is not reported missing; core makes the ask and a word still missing then is reported', async () => {
  const { language, pageWord } = await import('../src/core/js/page-language.js');
  const { installLanguagePacks } = await import('../src/core/js/language-packs.js');
  const PACKS = globalThis.__sfPageLanguage.packs;
  const saved = { document: globalThis.document, warn: console.warn, request: PACKS.request };
  const warnings = [];
  console.warn = (text) => warnings.push(String(text));
  const CDN = 'https://cdn.test/distr/core/lang/';
  const INDEX = { schema: 'simai.language-pack-index', schema_version: 1, delivery: 'framework', languages: ['ru'],
    parts: { ru: { core: ['sf-file-size'], pagination: ['sf-pagination'] } } };
  const node = (lang) => ({ closest: () => ({ getAttribute: () => lang }), tagName: 'SF-PAGINATION', getRootNode: () => null });
  const en = { en: { 'of-pages': '{page} of {count}', 'gone-text': 'gone' } };
  const settle = () => Promise.all([...PACKS.pending.values()]);
  try {
    language.forget();
    globalThis.__sfMissingWords = new Map();
    // A document in Russian whose shadow-drawn pagination the document does not show.
    globalThis.document = { documentElement: { getAttribute: () => 'ru' }, baseURI: 'https://example.test/', readyState: 'complete', querySelectorAll: () => [] };
    // Before core: nobody can fetch yet.
    PACKS.request = null;
    PACKS.early = null;
    assert.equal(pageWord(en, 'of-pages', node('ru')), '{page} of {count}');
    assert.equal(pageWord(en, 'of-pages', node('fr')), '{page} of {count}');
    assert.deepEqual(warnings, [], 'no warning while core has not run');
    assert.deepEqual(language.missing('ru'), []);
    assert.deepEqual([...PACKS.early.keys()].sort(), ['fr', 'ru']);
    // Core starts: the family part of the early ask comes, the words are asked again.
    const fetched = [];
    let redraws = 0;
    const stop = language.onChange(() => { redraws += 1; });
    installLanguagePacks({ root: 'https://cdn.test/distr/core/', again: true, packs: INDEX, fetchJson: async (url) => {
      fetched.push(url);
      const family = url.slice(`${CDN}ru/`.length).replace(/\.json$/u, '');
      return { schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: 'ru',
        words: family === 'pagination' ? { 'sf-pagination': { 'of-pages': '{page} из {count}' } } : { 'sf-file-size': { b: 'Б' } } };
    } });
    assert.equal(PACKS.early, null, 'the early asks are made once');
    assert.ok(fetched.includes(`${CDN}ru/pagination.json`), 'the part of the component asked before core');
    assert.ok(redraws >= 1, 'the words asked before core are asked again');
    await settle();
    assert.equal(pageWord(en, 'of-pages', node('ru')), '{page} из {count}');
    assert.deepEqual(language.missing('ru'), []);
    assert.ok(!warnings.some((text) => text.includes('"ru": words missing')));
    // A word no pack holds is still reported, now that core is here.
    assert.equal(pageWord(en, 'gone-text', node('fr')), 'gone');
    assert.deepEqual(language.missing('fr'), ['sf-pagination|gone-text']);
    assert.ok(warnings.some((text) => text.includes('"fr": words missing')));
    stop?.();
  } finally {
    language.forget();
    PACKS.request = saved.request;
    PACKS.early = null;
    globalThis.document = saved.document;
    console.warn = saved.warn;
  }
});

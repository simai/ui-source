import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pagination 1.7.0: owner decision C167 (1) (2026-11-14; ui-control
// control/research/2026-11-14-list-feed.md, prototypes/list-feed-study.html#q-more;
// names by the dispatcher under delegation, decisions.md C167). The end of a
// list is the more appearance with «Показано X из Y» from the existing total
// and page-size; the line's words are shown-label, the way it asks is load
// (button | auto). The request is the existing sf-pagination-load-more. The
// browser half is the probe of the evidence (c167/probe).

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/pagination/index.js');
const markup = read('src/smart/pagination/js/templates/default.js');
const component = JSON.parse(read('src/smart/pagination/component.json'));
const ru = JSON.parse(read('src/smart/pagination/lang/ru.json'));
const en = JSON.parse(read('src/smart/pagination/lang/en.json'));

const LOADS = JSON.parse(source.match(/const LOADS = (\[[^\]]*\]);/u)[1]);
function getter(name) {
  const start = source.indexOf(`\n  get ${name}() {\n`);
  assert.ok(start >= 0, `${name} is a getter of sf-pagination`);
  const open = source.indexOf('{\n', start);
  const end = source.indexOf('\n  }\n', open);
  return new Function('self', 'LOADS', source.slice(open + 2, end).replace(/this\b/gu, 'self')).bind(null);
}
const words = (file) => (key, {vars = {}} = {}) => String(file.runtime[key]).replace(/\{([a-z-]+)\}/gu, (_, name) => String(vars[name]));

test('C167 (1): two settings, shown-label and load (button | auto, default button)', () => {
  assert.equal(component.version, '1.8.1'); // 1.8.1: FM-9, the page-size dropdown writes bordered
  assert.deepEqual(component.settings['shown-label'], {
    type: 'string',
    'default-from': 'runtime.shown',
    summary: component.settings['shown-label'].summary,
  });
  assert.match(component.settings['shown-label'].summary, /\{shown\}.*\{total\}/u);
  assert.ok(component['x-words'].includes('shown-label'));
  assert.equal(component.settings.load.type, 'enum');
  assert.deepEqual(component.settings.load.values, ['button', 'auto']);
  assert.equal(component.settings.load.default, 'button');
  // No new event: auto and the button ask by the existing load-more.
  assert.deepEqual(Object.keys(component.events).sort(), ['action-change', 'action-for-all-change', 'apply', 'change', 'count', 'load-more', 'selection-clear', 'size-change']);
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.7.0') && line.includes('C167 (1)')));
});

test('C167 (1): «Показано X из Y» from total and page-size; shown-label fills {shown} and {total}', () => {
  assert.equal(ru.runtime.shown, 'Показано {shown} из {total}');
  assert.equal(en.runtime.shown, 'Showing {shown} of {total}');
  const shownText = getter('shownText');
  const base = {countKnown: true, shown: 40, shownTotal: '240', sfWord: words(ru), getAttribute: () => null};
  assert.equal(shownText(base), 'Показано 40 из 240');
  assert.equal(shownText({...base, sfWord: words(en)}), 'Showing 40 of 240');
  assert.equal(shownText({...base, getAttribute: (name) => (name === 'shown-label' ? 'Загружено {shown} из {total}' : null)}), 'Загружено 40 из 240');
  assert.equal(shownText({...base, shownTotal: '~450'}), 'Показано 40 из ~450');
  assert.equal(shownText({...base, countKnown: false}), '', 'no count, no line');
  assert.match(source, /shownText: this\.shownText,/u);
});

test('C167 (1): load reads button unless auto', () => {
  const load = getter('load');
  assert.deepEqual(LOADS, ['button', 'auto']);
  assert.equal(load({getAttribute: () => null}, LOADS), 'button');
  assert.equal(load({getAttribute: () => 'auto'}, LOADS), 'auto');
  assert.equal(load({getAttribute: () => 'scroll'}, LOADS), 'button');
});

test('C167 (1): auto watches the button by core watchEdge, never on load, never while busy or at the end', () => {
  assert.match(source, /import \{ EDGE_MARGIN, scrollerOf, watchEdge \} from "\.\.\/\.\.\/core\/js\/reading-position\.js";/u);
  const body = source.slice(source.indexOf('\n  watchMore() {'), source.indexOf('\n  unwatchMore() {'));
  assert.match(body, /this\.appearance === "more" && !this\.footer && this\.load === "auto"/u);
  assert.match(body, /watchEdge\(button, \(\) => \{\s*if \(moved\) ask\(\);\s*else reached = true;/u, 'the first report, before any scroll, only arms');
  assert.match(body, /if \(!this\.isConnected \|\| this\.showMoreBusy \|\| !this\.hasNext\) return;\s*this\.showMore\(null\);/u);
  assert.doesNotMatch(body, /addEventListener\("scroll", [^,]+, \{ passive: true \}\);[\s\S]*addEventListener\("scroll"/u, 'the scroll is listened to once, to arm');
  assert.match(source, /this\.keepMoreFocus\(\);\s*this\.watchMore\(\);/u);
  assert.match(source, /onDisconnected\(\) \{\s*this\.restoreTitle\(\);\s*this\.unwatchMore\(\);/u);
  // The button stays in both: the template draws it whatever load says.
  const more = markup.slice(markup.indexOf('function renderMore('), markup.indexOf('\n}\n', markup.indexOf('function renderMore(')));
  assert.doesNotMatch(more, /context\.load\b/u);
});

test('C167 (1) a11y: the line is a polite status that can take the focus; the focus stays with the button', () => {
  const more = markup.slice(markup.indexOf('function renderMore('), markup.indexOf('\n}\n', markup.indexOf('function renderMore(')));
  assert.match(more, /<span class="sf-pagination-shown" role="status" tabindex="-1">\$\{context\.shownText\}<\/span>/u);
  const keep = source.slice(source.indexOf('\n  keepMoreFocus() {'), source.indexOf('\n  // The action show-more'));
  assert.match(keep, /if \(!this\._moreFocus \|\| this\.showMoreBusy\) return;/u);
  assert.match(keep, /button\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(keep, /line\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(source, /showMore\(item = null\) \{\s*this\._showMoreItem = item;\s*\/\/[^\n]*\n\s*if \(item && this\.appearance === "more" && item\.contains\?\.\(this\.ownerDocument\.activeElement\)\) this\._moreFocus = true;/u);
});

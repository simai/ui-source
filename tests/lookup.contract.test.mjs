import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  DEFAULTS,
  STATES,
  appendItems,
  choose,
  excludedKeys,
  filterOptions,
  formEntries,
  moveActive,
  normaliseItem,
  normaliseValue,
  readAnswer,
  removeChosen,
  safeImageSource,
  sameValue,
  searchPlan,
  withoutExcluded,
} from '../src/smart/lookup/js/lookup-model.mjs';

// sf-lookup, the people and object picker: its manifest and the pure parts of
// its model (src/smart/lookup/js/lookup-model.mjs) -- the value, exclude,
// max-items, the answers the provider gives and the states they make. The
// browser probe tests/browser/lookup.browser.mjs runs the element itself.

const root = new URL('..', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const component = json('src/smart/lookup/component.json');
const manifest = json('src/smart/lookup/smart.manifest.json');
const en = json('src/smart/lookup/lang/en.json').runtime;
const ru = json('src/smart/lookup/lang/ru.json').runtime;

const anna = {value: 'u1', label: 'Anna', caption: 'Design', avatar: {initials: 'AP'}};
const boris = {value: 'u2', label: 'Boris'};
const vera = {value: 'u3', label: 'Vera', caption: 'Support'};

test('the manifest declares the settings, the value, the events and the form of the design draft', () => {
  assert.equal(component.id, 'smart.lookup');
  assert.equal(component.tag, 'sf-lookup');
  assert.equal(component.family, 'field');
  for (const name of ['name', 'label', 'placeholder', 'hint', 'multiple', 'max-items', 'min-length', 'max-results', 'debounce',
    'maxlength', 'options', 'exclude', 'provider', 'required', 'disabled', 'readonly', 'invalid', 'error-message', 'size', 'appearance']) {
    assert.ok(component.settings[name], `setting ${name}`);
  }
  // No allow-custom and no groups in v1 (consumer answers, 2026-10-30).
  assert.equal(component.settings['allow-custom'], undefined);
  assert.equal(component.settings.groups, undefined);
  assert.deepEqual(component.settings.size.values, ['1/2', '1', '2']);
  assert.deepEqual(component.settings.appearance.values, ['bordered', 'filled']);
  assert.equal(component.settings['min-length'].default, DEFAULTS.minLength);
  assert.equal(component.settings['max-results'].default, DEFAULTS.maxResults);
  assert.equal(component.settings.debounce.default, DEFAULTS.debounce);
  assert.equal(component.settings.provider.type, 'object');
  assert.deepEqual(Object.keys(component.events).sort(), ['change', 'input']);
  assert.equal(component.form.submits, 'value');
  assert.equal(component.accessibility.role, 'combobox');
  assert.equal(manifest.id, 'smart.lookup');
  assert.equal(manifest.custom_element.tag ?? manifest.custom_element, 'sf-lookup');
  assert.deepEqual(manifest.state.machines.search, STATES);
});

test('every word is said in English and Russian, with plural forms where a number is said', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ru).sort());
  for (const key of ['hint-min-length', 'searching', 'nothing-found', 'unavailable', 'error', 'retry', 'show-more', 'max-items', 'remove', 'clear', 'value-missing']) {
    assert.ok(en[key], `en ${key}`);
    assert.ok(ru[key], `ru ${key}`);
  }
  for (const form of ['one', 'few', 'many', 'other']) assert.match(ru['hint-min-length'][form], /\{n\}/u);
  assert.equal(en.remove, 'Remove {label}');
  assert.equal(en['max-items'], 'No more than {n}');
});

test('an item keeps value, label, caption and a safe avatar; one without a value is dropped', () => {
  assert.deepEqual(normaliseItem(anna), anna);
  assert.deepEqual(normaliseItem({value: 7}), {value: 7, label: '7'});
  assert.deepEqual(normaliseItem({value: 'x', text: 'From text'}), {value: 'x', label: 'From text'});
  assert.equal(normaliseItem({label: 'No value'}), null);
  assert.equal(normaliseItem({value: ''}), null);
  assert.equal(normaliseItem(null), null);
  assert.deepEqual(normaliseItem({value: 1, label: 'a', avatar: {src: 'https://e.com/a.png'}}).avatar, {src: 'https://e.com/a.png'});
  assert.equal(normaliseItem({value: 1, label: 'a', avatar: {src: 'javascript:alert(1)'}}).avatar, undefined);
  assert.equal(normaliseItem({value: 1, label: 'a', avatar: {src: 'https://e.com/a.png) ; background: red'}}).avatar, undefined);
  assert.deepEqual(normaliseItem({value: 1, label: 'a', avatar: {initials: '  AB  '}}).avatar, {initials: 'AB'});
});

test('an avatar address is http(s), a path on the site, a data image or a blob', () => {
  assert.equal(safeImageSource('/u/a.png'), '/u/a.png');
  assert.equal(safeImageSource('http://e.com/a.png'), 'http://e.com/a.png');
  assert.equal(safeImageSource('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(safeImageSource('//evil.example/a.png'), '');
  assert.equal(safeImageSource('data:text/html;base64,AAA'), '');
  assert.equal(safeImageSource('a b.png'), '');
  assert.equal(safeImageSource('x"onerror'), '');
});

test('the value: single {value, label} or null; multiple a list in the order chosen, [] when empty', () => {
  assert.equal(normaliseValue(null), null);
  assert.equal(normaliseValue(''), null);
  assert.deepEqual(normaliseValue(null, {multiple: true}), []);
  assert.deepEqual(normaliseValue(boris), boris);
  assert.deepEqual(normaliseValue([anna, boris], {multiple: true}), [anna, boris]);
  // A list given to a single field keeps its first item; one item to a multiple a list of one.
  assert.deepEqual(normaliseValue([boris, anna]), boris);
  assert.deepEqual(normaliseValue(boris, {multiple: true}), [boris]);
  // The value attribute as JSON.
  assert.deepEqual(normaliseValue('{"value":"u2","label":"Boris"}'), boris);
  assert.deepEqual(normaliseValue('[{"value":"u2","label":"Boris"}]', {multiple: true}), [boris]);
  // A bare value is read against the options for its label, as the field renderer reads it.
  assert.deepEqual(normaliseValue('u3', {options: [vera]}), vera);
  assert.deepEqual(normaliseValue(['u1', 'zz'], {multiple: true, options: [anna]}), [anna, {value: 'zz', label: 'zz'}]);
  // Repeats are one.
  assert.deepEqual(normaliseValue([anna, {value: 'u1', label: 'Again'}], {multiple: true}), [anna]);
});

test('the form gets the values alone', () => {
  assert.deepEqual(formEntries(null), []);
  assert.deepEqual(formEntries(anna), ['u1']);
  assert.deepEqual(formEntries([anna, {value: 7, label: 'Seven'}]), ['u1', '7']);
  assert.equal(sameValue([anna, boris], [anna, boris]), true);
  assert.equal(sameValue([anna, boris], [boris, anna]), false);
  assert.equal(sameValue(null, []), true);
});

test('exclude takes values out of every answer and of the options', () => {
  assert.deepEqual([...excludedKeys(['u1', 2, null, ''])], ['u1', '2']);
  assert.deepEqual([...excludedKeys([{value: 'u3'}])], ['u3']);
  assert.deepEqual([...excludedKeys('["u1"]')], ['u1']);
  assert.deepEqual(withoutExcluded([anna, boris, vera], ['u1', 'u3']), [boris]);
  assert.deepEqual(readAnswer({items: [anna, boris]}, {exclude: ['u2']}).items, [anna]);
  assert.deepEqual(filterOptions([anna, boris, vera], '', {exclude: ['u2']}), [anna, vera]);
  // Everything excluded is nothing found.
  assert.equal(readAnswer({items: [anna]}, {exclude: ['u1']}).state, 'empty');
});

test('inline options are searched in place by label and caption, case and accents folded, at any length', () => {
  assert.deepEqual(filterOptions([anna, boris, vera], 'v'), [vera]);
  assert.deepEqual(filterOptions([anna, boris, vera], 'SUPP'), [vera]);
  assert.deepEqual(filterOptions([anna, boris, vera], ''), [anna, boris, vera]);
  assert.deepEqual(filterOptions([{value: 1, label: 'Ёлкин'}, {value: 2, label: 'Café'}], 'елк'), [{value: 1, label: 'Ёлкин'}]);
  assert.deepEqual(filterOptions([{value: 2, label: 'Café'}], 'cafe'), [{value: 2, label: 'Café'}]);
});

test('a query below min-length asks nothing; options are local; no provider is unavailable', () => {
  assert.equal(searchPlan('a', {minLength: 2, hasProvider: true}), 'hint');
  assert.equal(searchPlan('  a ', {minLength: 2, hasProvider: true}), 'hint');
  assert.equal(searchPlan('an', {minLength: 2, hasProvider: true}), 'search');
  assert.equal(searchPlan('', {minLength: 0, hasProvider: true}), 'search');
  assert.equal(searchPlan('a', {minLength: 2, hasOptions: true, hasProvider: true}), 'local');
  assert.equal(searchPlan('abc', {minLength: 2}), 'none');
});

test('an answer is results, nothing found, unavailable or the error; no nextCursor is no Show more', () => {
  assert.deepEqual(readAnswer({items: [anna], nextCursor: 'c2'}), {state: 'results', items: [anna], nextCursor: 'c2'});
  assert.deepEqual(readAnswer({items: []}), {state: 'empty', items: [], nextCursor: null});
  assert.deepEqual(readAnswer({status: 'unavailable'}), {state: 'unavailable', items: [], nextCursor: null});
  assert.equal(readAnswer(null).state, 'error');
  assert.equal(readAnswer('oops').state, 'error');
  assert.equal(readAnswer({items: 'x'}).state, 'error');
  // Exactly max-results items and no cursor: nothing more (simai.chat answers 20, no cursor).
  const twenty = Array.from({length: 20}, (_, index) => ({value: index, label: `P${index}`}));
  assert.deepEqual(readAnswer({items: twenty}, {limit: 20}).nextCursor, null);
  // An answer longer than the limit is cut to it.
  assert.equal(readAnswer({items: [...twenty, {value: 99, label: 'x'}]}, {limit: 20}).items.length, 20);
  // Items without a value never reach the list.
  assert.deepEqual(readAnswer({items: [{label: 'ghost'}, boris]}).items, [boris]);
  // A cursor of 0 is a cursor.
  assert.equal(readAnswer({items: [anna], nextCursor: 0}).nextCursor, 0);
});

test('Show more joins the next page in order, no item twice', () => {
  assert.deepEqual(appendItems([anna, boris], [boris, vera]), [anna, boris, vera]);
});

test('single: a choice replaces the value, the chosen one again changes nothing', () => {
  assert.deepEqual(choose(null, anna), {value: anna, outcome: 'replaced'});
  assert.deepEqual(choose(anna, boris), {value: boris, outcome: 'replaced'});
  assert.deepEqual(choose(anna, {...anna}), {value: anna, outcome: 'unchanged'});
  assert.deepEqual(choose(anna, {label: 'no value'}), {value: anna, outcome: 'unchanged'});
});

test('multiple: a choice adds at the end or removes; past max-items it is refused', () => {
  assert.deepEqual(choose([], anna, {multiple: true}), {value: [anna], outcome: 'added'});
  assert.deepEqual(choose([anna], boris, {multiple: true}), {value: [anna, boris], outcome: 'added'});
  assert.deepEqual(choose([anna, boris], anna, {multiple: true}), {value: [boris], outcome: 'removed'});
  assert.deepEqual(choose([anna, boris], vera, {multiple: true, maxItems: 2}), {value: [anna, boris], outcome: 'refused'});
  // A chosen item still toggles off at the cap.
  assert.deepEqual(choose([anna, boris], boris, {multiple: true, maxItems: 2}), {value: [anna], outcome: 'removed'});
  assert.deepEqual(choose([anna, boris], vera, {multiple: true, maxItems: 0}).outcome, 'added');
});

test('removing a chosen item', () => {
  assert.deepEqual(removeChosen([anna, boris], 'u1', {multiple: true}), [boris]);
  assert.deepEqual(removeChosen([anna], 'zz', {multiple: true}), [anna]);
  assert.equal(removeChosen(anna, 'u1'), null);
  assert.deepEqual(removeChosen(anna, 'u2'), anna);
});

test('the arrows step and stop at the ends, Home and End go to them', () => {
  assert.equal(moveActive(-1, 3, 'ArrowDown'), 0);
  assert.equal(moveActive(0, 3, 'ArrowDown'), 1);
  assert.equal(moveActive(2, 3, 'ArrowDown'), 2);
  assert.equal(moveActive(-1, 3, 'ArrowUp'), 2);
  assert.equal(moveActive(1, 3, 'ArrowUp'), 0);
  assert.equal(moveActive(0, 3, 'ArrowUp'), 0);
  assert.equal(moveActive(1, 3, 'Home'), 0);
  assert.equal(moveActive(0, 3, 'End'), 2);
  assert.equal(moveActive(0, 0, 'ArrowDown'), -1);
});

test('the examples hold a studio example and a conformance page of checks', () => {
  const examples = json('src/smart/lookup/examples.json');
  assert.ok(examples.examples.some((example) => example.studio));
  const page = examples.pages.find((one) => one.name === 'conformance');
  assert.ok(page.checks.length >= 8);
  const probe = json('src/smart/lookup/probe.json');
  assert.ok(probe);
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {anchoredBadgeState, iconBadgeStep, nameWithBadge, pluralForm} from '../src/component/badges/js/_anchored-state.js';

// Anchored badges (simai/ui-source#12): what a count or a dot shows and says,
// held without a browser; tests/browser/anchored-badges.browser.mjs measures
// the geometry and reads the names the browser computes.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const at = (lang) => ({closest: () => ({getAttribute: () => lang}), getRootNode: () => null});

test('a count shows above 0, hides at 0, and caps at 99+ unless told otherwise', () => {
  assert.equal(anchoredBadgeState({count: '0'}).visible, false);
  assert.equal(anchoredBadgeState({count: ''}).visible, false);
  assert.equal(anchoredBadgeState({count: '-4'}).visible, false);
  assert.equal(anchoredBadgeState({count: '7'}).text, '7');
  assert.equal(anchoredBadgeState({count: '99'}).text, '99');
  assert.equal(anchoredBadgeState({count: '100'}).text, '99+');
  assert.equal(anchoredBadgeState({count: '12', cap: '9'}).text, '9+');
  assert.equal(anchoredBadgeState({count: '12', cap: 'x'}).text, '12');
});

test('the name keeps the exact count, in the right plural form', () => {
  const ru = at('ru');
  const forms = Object.fromEntries([1, 2, 5, 11, 21, 22, 120].map((n) => [n, anchoredBadgeState({count: n}, ru).phrase]));
  assert.deepEqual(forms, {
    1: '1 непрочитанное', 2: '2 непрочитанных', 5: '5 непрочитанных', 11: '11 непрочитанных',
    21: '21 непрочитанное', 22: '22 непрочитанных', 120: '120 непрочитанных',
  });
  assert.equal(anchoredBadgeState({count: 3}, at('en')).phrase, '3 unread');
  assert.equal(nameWithBadge('Анна Белова', anchoredBadgeState({count: 3}, ru).phrase), 'Анна Белова, 3 непрочитанных');
  assert.equal(nameWithBadge('Анна Белова', ''), 'Анна Белова');
});

test('a dot has a text equivalent the author can set, and a count can name itself', () => {
  assert.deepEqual(anchoredBadgeState({dot: true}, at('ru')), {visible: true, dot: true, text: '', phrase: 'есть новое', count: null});
  assert.equal(anchoredBadgeState({dot: ''}, at('en')).phrase, 'new');
  assert.equal(anchoredBadgeState({dot: 'false'}).visible, false);
  assert.equal(anchoredBadgeState({dot: true, label: 'новое сообщение'}).phrase, 'новое сообщение');
  assert.equal(anchoredBadgeState({count: 0, dot: true}).visible, false, '0 hides, a dot included');
  const label = '{count} заявка|{count} заявки|{count} заявок';
  assert.equal(anchoredBadgeState({count: 3, label}, at('ru')).phrase, '3 заявки');
  assert.equal(anchoredBadgeState({count: 5, label}, at('ru')).phrase, '5 заявок');
  assert.equal(pluralForm('one|other', 1, 'en'), 'one');
  assert.equal(pluralForm('one|other', 4, 'en'), 'other');
});

test('a Smart icon\'s size maps onto the anchor ladder', () => {
  assert.deepEqual(['1/4', '1', '2', '3', '', '5', '7'].map(iconBadgeStep), ['1/3', '1/3', '1/2', '1', '1', '2', '3']);
});

test('the sheets size the badge from tokens and logical sides only', async () => {
  const sheets = [
    await read('src/component/badges/scss/_anchored-geometry.scss'),
    await read('src/component/badges/scss/_css__badges_anchored.scss'),
    await read('src/component/menu/scss/_css__menu_compact.scss'),
  ].join('\n').replace(/initial-value: 0px;/gu, '');
  assert.doesNotMatch(sheets, /\b\d+(?:\.\d+)?(?:px|rem|em)\b/u, 'no literal lengths');
  assert.doesNotMatch(sheets, /\b(?:left|right|top|bottom):/u, 'no physical sides');
  assert.match(sheets, /inset-inline-start/u);
  assert.match(sheets, /&:dir\(rtl\)/u);
  assert.match(sheets, /var\(--sf-badge-ring-color, var\(--sf-badge--surface, var\(--sf-surface-0\)\)\)/u);
});

test('Smart avatar, icon and icon button declare the badge inputs and the sheet that places them', async () => {
  for (const [folder, rule] of [['avatar', /name: 'badges' \}/u], ['icon-button', /name: 'badges' \}/u], ['icon', /name: 'badges', lazy: true/u]]) {
    const manifest = JSON.parse(await read(`src/smart/${folder}/smart.manifest.json`));
    for (const input of ['badge-count', 'badge-dot', 'badge-cap', 'badge-label']) {
      assert.ok(manifest.inputs.properties[input], `${folder} declares ${input}`);
    }
    assert.equal(manifest.inputs.properties['badge-cap'].default, 99);
    assert.ok(manifest.composition.uses.includes('component.badges'), `${folder} uses component.badges`);
    assert.match(await read(`src/smart/${folder}/rule.js`), rule);
  }
});

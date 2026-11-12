// sf-tabs 1.3.0: the defects of the R184 tabs study (ui-control
// control/research/2026-11-12-tabs.md §4, prototype prototypes/tabs-study.html),
// one test per defect. T1, T2, T6, T7 and T11 are the owner's look questions
// and are not here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/tabs/index.js');
const template = read('src/smart/tabs/js/templates/default.js');
const manifest = JSON.parse(read('src/smart/tabs/component.json'));
const en = JSON.parse(read('src/smart/tabs/lang/en.json'));
const ru = JSON.parse(read('src/smart/tabs/lang/ru.json'));

const parseItems = vm.runInNewContext(
  `${source.slice(source.indexOf('function parseItems'), source.indexOf('function normalizeIndex'))}\nparseItems;`,
);
const computedItems = new Function(source.split('  get computedItems() {')[1].split('\n  get activeIndex()')[0].trim().replace(/\}\s*$/u, ''));

test('T3: an icon tab draws the icon of the "label::icon-start=home" form, not the default add', () => {
  const items = parseItems('Главная::icon-start=home|Настройки::icon-start=settings|Почта::icon-end=mail');
  const computed = computedItems.call({
    dataTabs: [], items, dataPanels: [], activeIndex: 0, tabCount: items.length,
    sfWord: () => '', isLazyClosed: () => false,
  });
  const icons = template.split("if(context.variant !== 'icons')")[1].split('<sf-button-icon')[1].split('>')[0];
  const bound = icons.match(/icon=\$\{([^}]+)\}/u)[1];
  const draw = new Function('item', 'nothing', `return ${bound};`);
  assert.deepEqual(computed.map((item) => draw(item, null)), ['home', 'settings', 'mail']);
  // An item given as an object with icon keeps it.
  assert.equal(draw({icon: 'person', iconStart: '', iconEnd: ''}, null), 'person');
});

test('T14: a tab without a label is named in the page language', () => {
  assert.equal(en.runtime.tab, 'Tab {n}');
  assert.equal(ru.runtime.tab, 'Вкладка {n}');
  assert.doesNotMatch(source, /`Tab \$\{index \+ 1\}`/u);
  const words = [];
  const computed = computedItems.call({
    dataTabs: [], items: [{label: ''}, {label: 'Два'}], dataPanels: [], activeIndex: 0, tabCount: 2,
    sfWord: (key, options) => { words.push([key, options.vars.n]); return `Вкладка ${options.vars.n}`; },
    isLazyClosed: () => false,
  });
  assert.deepEqual(computed.map((item) => item.label), ['Вкладка 1', 'Два']);
  assert.deepEqual(words, [['tab', 1]]);
});

test('sf-tabs 1.3.0 names the R184 work in its decisions', () => {
  assert.equal(manifest.version, '1.3.0');
  assert.match(manifest['x-decisions'][0], /^version: 1\.2\.0 → 1\.3\.0, a minor \(R184/u);
});

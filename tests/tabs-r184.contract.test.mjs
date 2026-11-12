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

// A method of SfTabs as a function of `this`, for a test double.
function method(name, args = '') {
  const start = source.indexOf(`\n  ${name}(${args}) {`);
  assert.ok(start >= 0, `method ${name}`);
  const open = source.indexOf(') {', start) + 2;
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, at);
}

test('T12: sf-tabs-change is sent after the tabs and panels show the new selection', () => {
  const body = method('selectTab', 'index, { person = false } = {}');
  const selectTab = new Function('toNumber', `return function (index, { person = false } = {}) {${body}}`)((value, fallback) => {
    const number = Number(value); return Number.isFinite(number) ? number : fallback;
  });
  const steps = [];
  const host = {
    activeIndex: 0,
    computedItems: [{key: 'a'}, {key: 'b'}],
    hasAttribute: () => false,
    setAttribute(name, value) { steps.push(`write ${name}=${value}`); host.activeIndex = Number(value); },
    showSelection() { steps.push(`show ${host.activeIndex}`); },
    sfEmit(verb, detail) { steps.push(`emit ${verb} ${detail.current}`); },
    whenPanelDrawn: (index, callback) => callback(),
  };
  assert.deepEqual(selectTab.call(host, 1, {person: true}), {outcome: 'applied'});
  assert.deepEqual(steps, ['write active-index=1', 'show 1', 'emit change 1']);

  // showSelection writes aria-selected (syncTabSemantics), the tab's selected
  // class and each drawn panel's hidden and selected class.
  const show = new Function('tabIndexOf', 'tabBox', `return function () {${method('showSelection')}}`)(
    (element) => element.index, (element) => element,
  );
  const classes = () => { const set = new Set(); return {toggle: (name, on) => (on ? set.add(name) : set.delete(name)), has: (name) => set.has(name)}; };
  const tabs = [0, 1].map((index) => ({index, classList: classes()}));
  const panels = [0, 1].map((index) => ({dataset: {sfTabPanel: String(index)}, hidden: index !== 0, classList: classes()}));
  let synced = 0;
  show.call({activeIndex: 1, tabList: {children: tabs}, syncTabSemantics: () => { synced += 1; }, drawnPanels: () => panels});
  assert.equal(synced, 1);
  assert.deepEqual(tabs.map((tab) => tab.classList.has('selected')), [false, true]);
  assert.deepEqual(panels.map((panel) => panel.hidden), [true, false]);
  assert.deepEqual(panels.map((panel) => panel.classList.has('selected')), [false, true]);
});

test('T15: a panel whose slot host was unwrapped carries the slot name', () => {
  const note = new Function(`return function () {${method('notePanelSlots')}}`)();
  const element = (slot) => ({nodeType: 1, getAttribute: (name) => (name === 'slot' ? slot : null)});
  const host = {_liveSlotNodes: new Map([
    ['panel-0', [{nodeType: 3}]], // <p slot="panel-0">text</p>: unwrapped
    ['panel-1', [element('panel-1')]], // <div slot="panel-1" class="x">: kept
    ['tab-0', [{nodeType: 3}]],
  ])};
  note.call(host);
  assert.deepEqual([...host._unwrappedPanelSlots], ['panel-0']);
  const slotOf = new Function(`return function (item) {${method('panelSlotOf', 'item')}}`)();
  host.hasSlotContent = (name) => host._liveSlotNodes.has(name);
  assert.equal(slotOf.call(host, {slotName: 'panel-0'}), 'panel-0');
  assert.equal(slotOf.call(host, {slotName: 'panel-1'}), null);
  assert.match(template, /slot=\$\{context\.panelSlot\?\.\(item\) \|\| nothing\}/u);
  assert.match(source, /if \(first\) this\.notePanelSlots\(\);/u);
});

test('T8: lazy panels are drawn when first opened and kept; a panel is a tab stop only without focusable content', () => {
  assert.deepEqual(manifest.settings.lazy, {...manifest.settings.lazy, type: 'boolean', default: false});
  const drawn = new Function(`return function (item) {${method('panelDrawn', 'item')}}`)();
  const host = {lazy: true, _openedPanels: new Set(['b'])};
  assert.equal(drawn.call(host, {key: 'a', selected: false}), false);
  assert.equal(drawn.call(host, {key: 'a', selected: true}), true);
  assert.equal(drawn.call(host, {key: 'b', selected: false}), true, 'opened once, kept');
  assert.equal(drawn.call({lazy: false, _openedPanels: new Set()}, {key: 'a'}), true);
  // The open entry is remembered at each drawing.
  assert.match(method('templateContext'), /const open = this\.computedItems\[this\.activeIndex\];\s*if \(open\) this\._openedPanels\.add\(open\.key\);/u);
  // A never-opened lazy panel is drawn empty; its id and aria-labelledby stay.
  assert.match(template, /const drawn = context\.panelDrawn \? context\.panelDrawn\(item\) : true;/u);
  assert.match(template, /const panelContent = drawn && context\.component\?\.hasSlotContent/u);
  assert.match(template, /const dataContent = !drawn \? nothing :/u);

  // The first opening of a lazy panel is told after the drawing that fills it.
  const when = new Function(`return function (item, callback) {${method('whenPanelDrawn', 'item, callback')}}`)();
  const listeners = [];
  const lazyHost = {
    panelDrawn: (item) => drawn.call(host, item),
    addEventListener: (name, fn) => listeners.push([name, fn]),
    removeEventListener: (name, fn) => listeners.splice(listeners.findIndex(([, one]) => one === fn), 1),
  };
  const told = [];
  when.call(lazyHost, {key: 'b'}, () => told.push('b'));
  assert.deepEqual(told, ['b'], 'a drawn panel: at once');
  when.call(lazyHost, {key: 'a'}, () => told.push('a'));
  assert.deepEqual(told, ['b']);
  listeners[0][1]({target: {}});
  assert.deepEqual(told, ['b'], 'a child drawing is not the panel drawing');
  listeners[0][1]({target: lazyHost});
  assert.deepEqual(told, ['b', 'a']);
  assert.equal(listeners.length, 0);

  // tabindex: 0 only when nothing in the panel takes the focus; a page panel
  // written with its own tabindex keeps it.
  assert.doesNotMatch(template, /tabindex="0"\s*\n\s*data-sf-tab-panel/u);
  assert.doesNotMatch(template, /panel\.setAttribute\('tabindex', '0'\)/u);
  const focus = new Function('FOCUSABLE', `return function () {${method('syncPanelFocus')}}`)('input, button');
  const panel = (focusable) => ({attrs: new Map(), querySelector: () => (focusable ? {} : null),
    setAttribute(name, value) { this.attrs.set(name, value); }, removeAttribute(name) { this.attrs.delete(name); }});
  const withField = panel(true), withText = panel(false), authored = panel(false);
  withField.attrs.set('tabindex', '0');
  authored.attrs.set('tabindex', '-1');
  focus.call({drawnPanels: () => [withField, withText, authored], _authoredPanelFocus: new WeakSet([authored])});
  assert.equal(withField.attrs.has('tabindex'), false);
  assert.equal(withText.attrs.get('tabindex'), '0');
  assert.equal(authored.attrs.get('tabindex'), '-1');
  assert.match(source, /this\.syncTabSemantics\(\);\s*this\.syncPanelFocus\(\);/u);
  assert.match(source, /if \(panel\.hasAttribute\('tabindex'\)\) this\._authoredPanelFocus\.add\(panel\);/u);
  // A part in a panel drawn after the tabs asks again.
  assert.match(source, /closest\?\.\('\[data-sf-tab-panel\]'\)\?\.closest\('sf-tabs'\) === this\) \{[^]*?this\.schedulePanelFocus\(\);/u);
});

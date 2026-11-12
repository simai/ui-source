// sf-tabs 1.3.0: the defects of the R184 tabs study (ui-control
// control/research/2026-11-12-tabs.md §4, prototype prototypes/tabs-study.html),
// one test per defect; T1, T2, T6, T7 and T11 follow owner decision C96
// (2026-11-12), one test per item.
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
  const body = method('selectTab', 'index, { person = false, fromAddress = false } = {}');
  const selectTab = new Function('toNumber', `return function (index, { person = false, fromAddress = false } = {}) {${body}}`)((value, fallback) => {
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
    writeAddress: (item) => steps.push(`address ${item.key}`),
  };
  assert.deepEqual(selectTab.call(host, 1, {person: true}), {outcome: 'applied'});
  assert.deepEqual(steps, ['write active-index=1', 'show 1', 'address b', 'emit change 1']);

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

test('T9: a disabled tab is focusable, says aria-disabled, and tells why in a tooltip (hint)', () => {
  // Not the native disabled: the class, and aria-disabled from syncTabSemantics.
  for (const tag of ['sf-button', 'sf-button-icon']) {
    const branch = template.split(`<${tag}\n`)[1].split(`</${tag}>`)[0];
    // The native disabled only for a link of a strip of links (T4).
    assert.doesNotMatch(branch.replace('?disabled=${Boolean(context.links && item.disabled)}', ''), /\?disabled=/u, `${tag}: no native disabled`);
    assert.match(branch, /root-class=\$\{tabClasses\(item\)\}/u);
    assert.match(branch, /data-tooltip=\$\{item\.hint \? hintId\(item, context\) : nothing\}/u);
  }
  const classes = new Function('joinClasses', `${template.slice(template.indexOf('function tabClasses'), template.indexOf('// The tooltip of a tab'))}\nreturn tabClasses;`)(
    (...tokens) => tokens.flat().filter(Boolean).join(' '),
  );
  assert.equal(classes({selected: true, disabled: false}), 'selected');
  assert.equal(classes({selected: false, disabled: true}), 'disabled');
  assert.match(source, /tab\.setAttribute\('aria-disabled', item\.disabled \? 'true' : 'false'\);/u);
  // The hint: the Framework's plain tooltip, outside the tablist.
  assert.match(template, /class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-tabs-hint"\s*hidden>/u);
  assert.match(template, /\.filter\(\(item\) => item\.hint\)\.map\(\(item\) => renderHint\(item, context\)\)/u);
  assert.match(source, /hint: item\.hint \? String\(item\.hint\) : '',/u);
  assert.deepEqual(manifest.settings.items.of.hint, {type: 'string', optional: true});
  assert.ok(manifest.relations.some((relation) => relation.name === 'tooltip' && relation.lazy === true));
  // The tabs' sheet gives .disabled the buttons' disabled values.
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /\.sf-tabs-top \.sf-button\.disabled:is\(\.sf-button--default, \.sf-button--tonal\) \{\s*--sf-button--background-color: var\(--sf-disable\);/u);
  assert.match(sheet, /\.sf-tabs-top \.sf-icon-button\.disabled:is\(\.sf-icon-button--default, \.sf-icon-button--tonal\) \{\s*--sf-icon-button--background-color: var\(--sf-surface-disabled\);/u);
  // The arrows reach it; a press selects nothing (activate and selectTab refuse).
  assert.match(source, /const enabledItems = this\.displayItems\.filter\(\(item\) => !overflowed\.has\(item\.index\)\);/u);
  assert.match(method('selectTab', 'index, { person = false, fromAddress = false } = {}'), /if \(item\.disabled\) return \{ outcome: 'refused', reason: 'disabled' \};/u);
  assert.match(method('activate', 'index, event = null, { person = true } = {}'), /if \(!item \|\| item\.disabled\) return;/u);
});

test('T4: when every item has an address the row is a nav of links with aria-current, not a tablist', () => {
  const body = source.slice(source.indexOf('  get links() {') + '  get links() {'.length, source.indexOf('\n  }\n', source.indexOf('  get links() {')));
  const linksOf = new Function(`return function () {${body}}`)();
  assert.equal(linksOf.call({computedItems: [{href: '/a'}, {href: '/b'}]}), true);
  assert.equal(linksOf.call({computedItems: [{href: '/a'}, {href: ''}]}), false);
  assert.equal(linksOf.call({computedItems: []}), false);
  // The row: <nav> with the tabs' own name and classes; sf-button draws <a href>.
  assert.match(template, /\$\{context\.links \? renderLinkRow\(context\) : html`<div\s*class=\$\{topClasses\(context\)\}\s*role="tablist"/u);
  const row = template.slice(template.indexOf('function renderLinkRow'), template.indexOf('// A strip of links draws its panel row'));
  assert.match(row, /<nav\s*class=\$\{topClasses\(context\)\}\s*aria-label=/u);
  assert.doesNotMatch(row, /role=|aria-orientation/u);
  assert.match(template, /href=\$\{context\.links \? item\.href : nothing\}/u);
  assert.match(template, /context\.links \? 'sf-tabs--links' : ''/u);
  // No tabpanel beside links; no panel row when no panel has content.
  assert.match(template, /role=\$\{context\.links \? nothing : 'tabpanel'\}/u);
  assert.match(template, /\$\{context\.links && !hasPanelContent\(context\) \? nothing :/u);
  // The row is found by its class, so the overflow layout and «Ещё» work for both.
  assert.match(source, /return this\.querySelector\(':scope > \.sf-tabs > \.sf-tabs-top-container > \.sf-tabs-top'\);/u);

  // Semantics: no tab roles; the current link aria-current="page".
  const sync = new Function(`return function () {${method('syncLinkSemantics')}}`)();
  const link = (localName) => ({localName, attrs: new Map([['role', 'tab'], ['aria-selected', 'false'], ['tabindex', '-1'], ['aria-controls', 'x']]),
    getAttribute(name) { return this.attrs.get(name) ?? null; }, setAttribute(name, value) { this.attrs.set(name, String(value)); },
    removeAttribute(name) { this.attrs.delete(name); }, querySelector: () => ({})});
  const anchors = [link('a'), link('a')];
  sync.call({computedItems: [{selected: false, label: 'A'}, {selected: true, label: 'B'}], tabTargets: anchors});
  assert.deepEqual(anchors.map((one) => Object.fromEntries(one.attrs)), [{}, {'aria-current': 'page'}]);
  assert.match(source, /syncTabSemantics\(\) \{\s*if \(this\.links\) \{\s*this\.syncLinkSemantics\(\);\s*return;/u);
  // Links are walked with Tab, not arrows; a pressed link is followed by the
  // browser, the strip only marks it current (a modifier opens a new tab natively).
  assert.match(source, /\/\/ A strip of links is walked with Tab and followed with Enter, as links are\.\s*if \(this\.links\) return;/u);
  const activate = method('activate', 'index, event = null, { person = true } = {}');
  assert.match(activate, /if \(item\.href && event\?\.target\?\.closest\?\.\('a\[href\]'\) && this\.links\) \{\s*if \(!\(event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey\)\) this\.selectTab\(index, \{ person \}\);\s*return;/u);
});

test('T10: hash keeps the selected tab in the address; Back and links to #id work', () => {
  assert.deepEqual(manifest.settings.hash, {...manifest.settings.hash, type: 'boolean', default: false});
  const addressed = new Function(`return function () {${method('addressedIndex')}}`)();
  const location = {hash: '#access', pathname: '/user/7', search: '?tab=1'};
  const section = {closest: (selector) => (selector === '[data-sf-tab-panel]' ? panel : null)};
  const panel = {dataset: {sfTabPanel: '2'}, closest: () => host};
  const host = {computedItems: [{key: 'profile'}, {key: 'access'}, {key: 'notify'}]};
  globalThis.location = location;
  globalThis.document = {getElementById: (id) => (id === 'phone' ? section : null)};
  try {
    assert.equal(addressed.call(host), 1, '#<item id>');
    location.hash = '#phone';
    assert.equal(addressed.call(host), 2, '#<element in a panel>');
    location.hash = '#nothing';
    assert.equal(addressed.call(host), null);
    // The person's choice is a history entry; path and query kept.
    const write = new Function(`return function (item) {${method('writeAddress', 'item')}}`)();
    const pushed = [];
    globalThis.history = {state: null, pushState: (state, title, url) => pushed.push(url)};
    write.call({hash: true, links: false}, {key: 'notify'});
    write.call({hash: false, links: false}, {key: 'profile'});
    assert.deepEqual(pushed, ['/user/7?tab=1#notify']);
  } finally {
    delete globalThis.location; delete globalThis.document; delete globalThis.history;
  }
  // First drawing: no change event; hashchange/popstate: the person's, not written back.
  assert.match(source, /if \(!this\._addressRead\) \{\s*this\._addressRead = true;\s*this\.readAddress\(\{ person: false \}\);/u);
  assert.match(source, /this\._addressListener = \(\) => this\.readAddress\(\{ person: true \}\);/u);
  assert.match(source, /addEventListener\?\.\('popstate', this\._addressListener\)/u);
  assert.match(source, /removeEventListener\?\.\('hashchange', this\._addressListener\)/u);
  assert.match(method('readAddress', '{ person }'), /this\.selectTab\(index, \{ person, fromAddress: true \}\);/u);
  assert.match(source, /if \(person && !fromAddress\) this\.writeAddress\(item\);/u);
});

test('sticky: the tab row stays in sight, below --sf-tabs-sticky-top', () => {
  assert.deepEqual(manifest.settings.sticky, {...manifest.settings.sticky, type: 'boolean', default: false});
  assert.match(template, /context\.sticky \? 'sf-tabs--sticky' : ''/u);
  const sheet = read('src/component/tabs/scss/_css__tabs.scss');
  assert.match(sheet, /\.sf-tabs\.sf-tabs--sticky > \.sf-tabs-top-container \{\s*position: sticky;\s*inset-block-start: var\(--sf-tabs-sticky-top, var\(--sf-0\)\);/u);
  const variables = JSON.parse(read('src/core/contracts/public-variables.v1.json'));
  const text = JSON.stringify(variables);
  assert.match(text, /"name":"--sf-tabs-sticky-top"/u);
  assert.ok(manifest['css-variables']['--sf-tabs-sticky-top']);
});

// --- owner decision C96 (2026-11-12) ---------------------------------------
const sheet = read('src/component/tabs/scss/_css__tabs.scss');
const journal = JSON.parse(read('contracts/changes/journal.json'));
const getter = (name) => new Function(
  'FITS',
  `return function () {${source.split(`\n  get ${name}() {`)[1].split('\n  }\n')[0]}\n};`,
)(['auto', 'always', 'never']);
const host = (attributes, extra = {}) => ({getAttribute: (name) => attributes[name] ?? null, ...extra});

test('C96 1 (T1): two looks, the line by default and the plate; full and the scheme fills are retired aliases', () => {
  const look = getter('look');
  assert.equal(look.call(host({})), 'underline', 'no type draws the line');
  assert.equal(look.call(host({type: 'underline'})), 'underline');
  assert.equal(look.call(host({type: 'full'})), 'underline');
  assert.equal(look.call(host({type: 'pills'})), 'pills');
  assert.equal(look.call(host({type: 'vertical'})), 'vertical');
  // The scheme no longer reaches the drawing.
  assert.match(source, /scheme: 'default',/u);
  const ids = journal.records.map((record) => record.id);
  for (const id of ['behaviour-tabs-line-default', 'value-tabs-full-to-underline', 'value-tabs-scheme-retired']) {
    const record = journal.records.find((one) => one.id === id);
    assert.ok(ids.includes(id), id);
    assert.equal(record.remove_after, '2027-01-01');
  }
  const noted = method('noteRetiredLooks');
  assert.match(noted, /noteDeprecated\(/u);
  assert.match(noted, /from: 'full', to: 'underline'/u);
  assert.match(noted, /scheme === 'outline' \|\| scheme === 'link'/u);
  assert.match(manifest.settings.scheme.summary, /Retired/u);
  // One selected rule per look: the line is primary with on-surface ink, the plate primary-container.
  assert.match(sheet, /sf-tabs--underline[^{]*\.selected[^{]*\{[^}]*--sf-button--border-color: var\(--sf-tabs-indicator-color, var\(--sf-primary\)\)/u);
  assert.match(sheet, /sf-tabs--underline[^{]*\.selected[^{]*\.sf-button-text-container \{\s*--sf-button-text-container--color: var\(--sf-on-surface\)/u);
  assert.match(sheet, /sf-tabs--pills[^{]*\.selected[^{]*\{[^}]*--sf-button--background-color: var\(--sf-primary-container\)/u);
});

test('C96 2 (T6): the line is 2 px at every size and switches at once', () => {
  assert.doesNotMatch(sheet, /calc\(var\(--sf-px\) \* 3\)/u);
  assert.match(sheet, /sf-tabs--underline > \.sf-tabs-top-container > \.sf-tabs-top :is\(\.sf-button, \.sf-icon-button\) \{\s*transition-property: background-color, box-shadow, color;/u);
});

test('C96 3 (T11): only the selected label is medium, with its width reserved', () => {
  assert.match(template, /<span class="sf-tabs-name" data-text=\$\{item\.label\}>/u);
  assert.match(sheet, /\.sf-tabs-top \.sf-tabs-name \{\s*display: inline-grid;\s*font-weight: var\(--sf-font-weight-regular\);/u);
  assert.match(sheet, /\.sf-tabs-top \.sf-tabs-name::after \{\s*content: attr\(data-text\) \/ "";\s*grid-area: 1 \/ 1;\s*block-size: 0;\s*visibility: hidden;\s*font-weight: var\(--sf-font-weight-medium\);/u);
  assert.match(sheet, /\.sf-tabs-top \.selected \.sf-tabs-name \{\s*font-weight: var\(--sf-font-weight-medium\);/u);
});

test('C96 4: hover darkens the ink only, no grey line', () => {
  const hover = sheet.split('// Under the pointer or the keyboard a line tab')[1].split('// A tab sits flush')[0];
  assert.doesNotMatch(hover, /outline-variant/u);
  assert.match(hover, /--sf-button--border-color: transparent;/u);
  assert.match(hover, /--sf-button-text-container--color: var\(--sf-on-surface\)/u);
  assert.match(hover, /--sf-icon--color: var\(--sf-on-surface\)/u);
});

test('C96 5 (T2): vertical tabs are the menu column, and a row with More on the phone', () => {
  const look = getter('look');
  assert.equal(look.call(host({type: 'vertical'}, {_narrow: true})), 'underline');
  assert.match(source, /breakpointMedia\('md', \{ below: true \}\)/u);
  const column = sheet.split('// Vertical tabs are the menu')[1];
  assert.match(column, /\.selected[^{]*\{[^}]*--sf-button--background-color: var\(--sf-primary-container-active\)/u);
  assert.match(column, /:hover[^{]*\{[^}]*--sf-button--background-color: var\(--sf-surface-state-hover\)/u);
  assert.match(column, /justify-content: flex-start/u);
  assert.match(column, /text-align: start/u);
  assert.match(source, /if \(type === 'vertical'\) return this\._narrow \? 'underline' : 'vertical';/u);
});

test('C96 6 (T7): a per-tab error count is said with the name; go-to-error opens the first and focuses its field', () => {
  assert.deepEqual(Object.keys(manifest.settings.items.of).includes('errors'), true);
  assert.equal(ru.runtime.errors.few, '{n} ошибки');
  assert.equal(en.runtime.errors.one, '{n} error');
  assert.match(template, /class="sf-tabs-count sf-tabs-count--error" aria-hidden="true"/u);
  assert.match(template, /<span class="sf-tabs-said">, \$\{context\.errorWords/u);
  // Sized by the label (C95): the count inherits the label's size and line.
  assert.match(sheet, /\.sf-tabs-count \{[^}]*font-size: inherit;\s*line-height: inherit;/u);
  assert.doesNotMatch(sheet, /\.sf-tabs-count \{[^}]*--sf-text-size-1\\\/3/u);
  const computed = computedItems.call({
    dataTabs: [], items: [{id: 'a', label: 'Профиль'}, {id: 'b', label: 'Доступ', errors: 1}],
    dataPanels: [], activeIndex: 0, tabCount: 2, sfWord: () => '', _errors: new Map([['b', 2]]),
  });
  assert.deepEqual(computed.map((item) => item.errors), [0, 2]);
  const go = method('goToError');
  assert.match(go, /this\.arrangedItems\.find\(\(item\) => item\.errors > 0 && !item\.disabled\)/u);
  assert.match(go, /this\.selectTab\(target\.index, \{ person: false \}\)/u);
  assert.match(go, /this\.whenPanelDrawn\(target,/u);
  assert.match(go, /querySelector\(INVALID\)/u);
  assert.match(go, /\.focus\?\.\(\)/u);
  assert.ok(manifest.actions['go-to-error']);
});

test('C96 7: two to four tabs share the phone row (fit); overflow stays More', () => {
  const fits = new Function('count', `${method('fitsEqually', 'count').replace(/^[^{]*\{/u, '').replace(/\}\s*$/u, '')}`);
  const at = (attributes, narrow, count) => fits.call({fit: getter('fit').call(host(attributes)), look: getter('look').call(host(attributes, {_narrow: narrow})), _narrow: narrow}, count);
  assert.equal(at({}, true, 3), true);
  assert.equal(at({}, true, 5), false, 'five on the phone go to More');
  assert.equal(at({}, false, 3), false, 'auto: only on the phone');
  assert.equal(at({fit: 'always'}, false, 3), true);
  assert.equal(at({fit: 'never'}, true, 3), false);
  assert.equal(at({type: 'full'}, false, 6), true, 'full is the line with fit always');
  assert.equal(manifest.settings.fit.default, 'auto');
  assert.match(source, /container\?\.setAttribute\('data-sf-tabs-fit', ''\);/u);
  assert.match(sheet, /\.sf-tabs-top-container\[data-sf-tabs-fit\] > \.sf-tabs-top \{/u);
});

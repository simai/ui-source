import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/smart/tabs/index.js', import.meta.url), 'utf8');
const template = await readFile(new URL('../src/smart/tabs/js/templates/default.js', import.meta.url), 'utf8');
const smartBase = await readFile(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
function setup({vertical = false, rtl = false, selected = 0, disabled = [1]} = {}) {
  let Constructor, focused = null;
  class Element {
    attrs = new Map();
    querySelector() {return null;}
    setAttribute(k, v) {this.attrs.set(k, v);}
    focus() {focused = Number(this.dataset.sfTabIndex);}
  }
  class Base extends Element {
    addEventListener() {}
    afterRender(callback) {return callback;}
    static define() {Constructor = this;}
  }
  vm.runInNewContext(source.replace(/^import .*;\n/gm, ''), {
    SfBaseElement: Base, HTMLElement: Element,
    getComputedStyle: () => ({direction: rtl ? 'rtl' : 'ltr'}),
  });
  const host = new Constructor(), list = {getAttribute: () => vertical ? 'vertical' : 'horizontal'};
  const tabs = [0, 1, 2].map(index => {
    const tab = new Element(); tab.dataset = {sfTabIndex: String(index)};
    tab.closest = selector => selector === 'sf-tabs' ? host : selector === '[role="tablist"]' ? list : tab;
    return tab;
  });
  Object.defineProperties(host, {
    tabList: {value: list}, tabTargets: {value: tabs},
    activeIndex: {get: () => selected},
    computedItems: {get: () => tabs.map((_, index) => ({index, selected: index === selected, disabled: disabled.includes(index)}))},
  });
  const changes = [];
  host.goTo = index => {if (!disabled.includes(index) && index !== selected) {selected = index; changes.push(index);}};
  const press = (index, key, extra = {}) => {
    let prevented = false;
    host.handleRootKeyDown({target: tabs[index], key, preventDefault() {prevented = true;}, ...extra});
    return {selected, focused, prevented, changes: [...changes]};
  };
  return {host, tabs, press};
}

test('Tabs binds roles/tabstops to native targets; disabled selected keeps public state but is not a tab stop', () => {
  for (const selected of [0, 1, 2]) {
    const {host, tabs} = setup({selected}); host.syncTabSemantics();
    assert.deepEqual(tabs.map(t => t.tabIndex), selected === 2 ? [-1, -1, 0] : [0, -1, -1]);
    assert.equal(tabs[selected].attrs.get('aria-selected'), 'true');
    assert.equal(tabs[1].attrs.get('aria-disabled'), 'true');
    assert.ok(tabs.every(t => t.attrs.get('role') === 'tab' && t.attrs.get('aria-controls')));
  }
});
test('Tabs preserves the shared afterRender callback registration API', () => {
  const {host} = setup(), callback = () => {};
  assert.equal(host.afterRender(callback), callback);
});
test('Tabs arrow direction follows orientation and RTL; skips disabled, wraps, focuses once', () => {
  for (const vertical of [false, true]) for (const rtl of [false, true]) {
    const {press} = setup({vertical, rtl});
    const key = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    assert.deepEqual(press(0, key), {selected: 2, focused: 2, prevented: true, changes: [2]});
    assert.deepEqual(press(2, key), {selected: 0, focused: 0, prevented: true, changes: [2, 0]});
  }
});
test('Tabs Home/End use enabled endpoints and ignore browser shortcut/perpendicular keys', () => {
  const {press} = setup();
  assert.equal(press(0, 'ArrowDown').prevented, false);
  assert.equal(press(0, 'ArrowRight', {ctrlKey: true}).prevented, false);
  assert.equal(press(0, 'ArrowRight', {defaultPrevented: true}).prevented, false);
  assert.equal(press(0, 'End').focused, 2);
  assert.equal(press(2, 'Home').focused, 0);
});
test('Tabs ignores foreign tablists and keys in custom nested controls', () => {
  const {host, tabs, press} = setup();
  const nestedTarget = {closest: () => tabs[0]};
  assert.equal(press(0, 'ArrowRight', {target: nestedTarget}).prevented, false);
  tabs[0].closest = selector => selector === '[data-sf-tab-index]' ? tabs[0] : {};
  assert.equal(host.ownedTab({target: tabs[0]}), null);
  assert.equal(press(0, 'ArrowRight').prevented, false);
});
test('Tabs all-disabled and independent instances keep valid local semantics', () => {
  const first = setup({disabled: [0, 1, 2]}), second = setup();
  first.host.syncTabSemantics(); second.host.syncTabSemantics();
  assert.ok(first.tabs.every(t => t.tabIndex === -1));
  assert.equal(first.press(0, 'ArrowRight').focused, null);
  // Source module sequence persists across instances in a real browser (covered
  // by the nested runtime matrix); IDs remain stable within each instance.
  const id = second.tabs[0].id; second.host.syncTabSemantics(); assert.equal(second.tabs[0].id, id);
});
test('Tabs template links panels and gives icon-only tabs their text name, without host tabstops', () => {
  assert.match(template, /aria-labelledby=\$\{`\$\{context.tabsId\}-tab-\$\{item.index\}`\}/);
  assert.match(template, /aria-label=\$\{item.label\}/);
  for (const tag of ['sf-button', 'sf-icon-button']) {
    const branch = template.split(`<${tag}\n`)[1].split(`</${tag}>`)[0];
    assert.doesNotMatch(branch, /tabindex=|aria-selected=/);
  }
  const customBranch = template.split('if (item.component) {')[1].split("if(context.variant !== 'icons')")[0];
  assert.match(customBranch, /role="tab"/);
  assert.match(customBranch, /aria-label=\$\{item.label\}/);
  assert.match(customBranch, /<span aria-hidden="true" inert>/);
  assert.match(template, /owner\.renderSmartElement\(component\.type, component\.props \|\| \{\}\)/);
  assert.doesNotMatch(template, /SF\.litHtml/);
  assert.match(smartBase, /renderSmartElement\(type, props = \{\}\)/);
});

test('Tabs presentation does not suppress keyboard focus or mismatch selected icon colors', async () => {
  const css = await readFile(new URL('../src/component/tabs/scss/_css__tabs.scss', import.meta.url), 'utf8');
  // A selected tab is filled with its own colour, so its ring is drawn in the ink
  // that reads on that fill — passed through the ring's own colour token. The
  // mechanism is the shared outline, not a shadow: a shadow shares its property
  // with elevation and is dropped entirely in forced colours.
  assert.doesNotMatch(css, /--sf-(?:icon-)?button--box-shadow/u);
  assert.match(css, /--sf-focus--color: var\(--sf-tabs--focus-color, var\(--sf-tabs--focus-ink\)\)/u);
  assert.match(css, /outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/u);
  assert.match(css, /outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/u, 'a tab is flush with its neighbours');
  assert.doesNotMatch(css, /var\(--sf-ui-focus-inset\)/u);
  assert.match(css, /column-gap: var\(--sf-tabs--gap, var\(--sf-space-2\)\)/);
  assert.doesNotMatch(css, /:focus(?!-visible)/);
  assert.match(css, /--sf-icon-button--background-color: var\(--sf-primary-active\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /outline: var\(--sf-focus--width\) solid currentColor/u);
});

test('ordinary Tabs does not bind or activate a Smart-owned root and only enumerates its own descendants', async () => {
  const ordinary = await readFile(new URL('../src/component/tabs/js/_tabs.js', import.meta.url), 'utf8');
  class Element {}
  const context = vm.createContext({HTMLElement: Element});
  vm.runInContext(ordinary.slice(ordinary.indexOf('const TABS_SELECTOR'), ordinary.indexOf('\nclass Tabs')), context);
  const smartRoot = new Element(); smartRoot.parentElement = {localName: 'sf-tabs'};
  smartRoot.querySelectorAll = () => {throw new Error('Smart subtree must not be queried');};
  context.bindTabs(smartRoot); context.activateTab(smartRoot, 1);
  const root = new Element(), child = new Element();
  const own = {closest: () => root}, nested = {closest: () => child};
  root.querySelectorAll = () => [own, nested];
  assert.deepEqual([...context.getTabButtons(root)], [own]);
});

test('Tabs documents legacy appearance semantics without reinterpreting or restricting custom scheme values', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/smart/tabs/smart.manifest.json', import.meta.url), 'utf8'));
  const scheme = manifest.inputs.properties.scheme;
  assert.equal(scheme.default, 'default');
  assert.equal(scheme.enum, undefined);
  assert.match(scheme.description, /default, outline or link/);
  assert.match(scheme.description, /not a semantic color selector/);
  for (const tag of ['sf-button', 'sf-icon-button']) {
    const branch = template.split(`<${tag}\n`)[1].split(`</${tag}>`)[0];
    assert.match(branch, /appearance="primary"/);
    assert.match(branch, /scheme=\$\{context.scheme\}/);
  }
});

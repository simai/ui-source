import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-tabs 1.4.0. (1) Owner decision C181 (2): vertical tabs fold to the row
// with «Ещё» by the width of their place (the h1 step, md 44rem), not of the
// screen. (2) An empty panel is no tab stop (sf-view-properties' vertical
// tabs drew an empty tabpanel with tabindex 0, evidence
// 2026-11-15-view-bulk-and-properties).

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = read('src/smart/tabs/index.js');
const component = JSON.parse(read('src/smart/tabs/component.json'));

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
function fn(name) {
  const start = source.indexOf(`\nfunction ${name}(`);
  assert.ok(start >= 0, `function ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0, at = open;
  for (; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    else if (source[at] === '}' && --depth === 0) break;
  }
  return new Function(`return ${source.slice(start + 1, at + 1)}`)();
}

test('1.4.0 is noted', () => {
  assert.equal(component.version, '1.5.5'); // GB19 area C: DEV answer 5, the settings menu loads through press; // GB18: VO-1 attribute order, panels example; // GB16-5/6: the label beside the glyph, name tooltips; // GB16 returns: the tightest row; // group build 16: G9 fold; // board-fw: 1.4.5, a panel row with no panel content is hidden // C282: 1.4.0 moved on by the language-file patch (Russian is a language file) // group build 10: 1.4.2 moved on by the merged branches or a GB10 patch // group build 13: 1.4.5 moved on by the merged branches or a GB11 merge // group build 14: 1.4.6 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.ok(component['x-decisions'].some((line) => line.startsWith('version 1.4.0') && line.includes('C181 (2)')));
});

test('C181 (2): the vertical look folds below the h1 step of its place, not of the screen', () => {
  const BREAKPOINTS = {md: '44rem'};
  const globalThis = {getComputedStyle: () => ({fontSize: '16px'})};
  const document = {documentElement: {}};
  const readNarrow = new Function('BREAKPOINTS', 'globalThis', 'document', `return function () {${method('readNarrow')}}`)(BREAKPOINTS, globalThis, document);
  const host = (type, width, mediaNarrow = false) => ({
    getAttribute: (name) => (name === 'type' ? type : null),
    placeWidth: () => width,
    _narrowMedia: {matches: mediaNarrow},
  });
  // A 30rem panel on a wide screen: folds.
  assert.equal(readNarrow.call(host('vertical', 480, false)), true);
  // A wide place on a narrow screen (a wide frame): stays a column.
  assert.equal(readNarrow.call(host('vertical', 800, true)), false);
  assert.equal(readNarrow.call(host('vertical', 703)), true);
  assert.equal(readNarrow.call(host('vertical', 704)), false);
  // No width yet: the window's step.
  assert.equal(readNarrow.call(host('vertical', 0, true)), true);
  // Other looks never fold.
  assert.equal(readNarrow.call(host('pills', 300, true)), false);
  // The look reads the place.
  assert.match(method('connectedCallback'), /this\._narrow = this\.readNarrow\(\);/u);
  assert.match(method('followPlace'), /const narrow = this\.readNarrow\(\);/u);
  assert.doesNotMatch(source, /this\._narrow = this\._narrowMedia\?\.matches === true;/u);
  assert.match(source, /this\.syncPanelFocus\(\);\s*this\.followPlace\(\);/u);
});

test('an empty panel is no tab stop; one with words or a part is', () => {
  const panelHasContent = fn('panelHasContent');
  const text = (value) => ({nodeType: 3, textContent: value});
  assert.equal(panelHasContent({childNodes: []}), false);
  assert.equal(panelHasContent({childNodes: [{nodeType: 8}, text('  \n ')]}), false, 'drawing marks and white space');
  assert.equal(panelHasContent({childNodes: [text('Описание')]}), true);
  assert.equal(panelHasContent({childNodes: [{nodeType: 1}]}), true);

  const sync = new Function('FOCUSABLE', 'panelHasContent', `return function () {${method('syncPanelFocus')}}`)('input', panelHasContent);
  const panel = (nodes, focusable = false) => ({attrs: new Map([['tabindex', '0']]), childNodes: nodes,
    querySelector: () => (focusable ? {} : null),
    setAttribute(name, value) { this.attrs.set(name, value); }, removeAttribute(name) { this.attrs.delete(name); }});
  const empty = panel([{nodeType: 8}]);
  const words = panel([text('Текст')]);
  const field = panel([{nodeType: 1}], true);
  const watched = [];
  sync.call({drawnPanels: () => [empty, words, field], _authoredPanelFocus: new WeakSet(), watchPanelContent: (all) => watched.push(...all)});
  assert.equal(empty.attrs.has('tabindex'), false);
  assert.equal(words.attrs.get('tabindex'), '0');
  assert.equal(field.attrs.has('tabindex'), false);
  assert.equal(watched.length, 3, 'a panel filled later decides again');
  assert.match(method('watchPanelContent', 'panels'), /observe\(panel, \{ childList: true, subtree: true, characterData: true \}\)/u);
});

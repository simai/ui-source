// Queue area B (icons and the Loader's rules), 2026-11-16: each test is red on
// the sources before its fix and says what a rule no longer matches.
//   #125 the slider rule reads the class token, not an id or a label id;
//   #196 a glyph is judged by its em, not by a squeezed box;
//   #203 a regexp rule that names an element finds it anywhere in the page;
//   #164 the kbd script comes only where a kbd[data-sf-shortcut] is;
//   #53  the checkbox asks for its tick with the page's first icons.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const loader = read('src/core/js/loader.js');
const slice = (source, from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `${from} .. ${to}`);
  return source.slice(start, end);
};
// The rules as the Loader's realm holds them: plain objects, regexes of this realm.
const rules = (file) => {
  const SF = {RuleLoader: {}};
  vm.runInNewContext(read(file), {SF});
  return Object.fromEntries(Object.entries(SF.RuleLoader).map(([key, rule]) => [key, {
    ...JSON.parse(JSON.stringify(rule)),
    regex: new RegExp(rule.regex.source, rule.regex.flags),
  }]));
};
// The attribute string the Loader tests a regex rule on (getAttributes).
const attributes = (pairs) => Object.entries(pairs).map(([name, value]) => `${name}="${value}"`).join(' ');

test('#125 the slider rule matches the class sf-slider and its parts, not the name in an id', () => {
  const {slider} = rules('src/component/slider/rule.js');
  const re = slider.regex;
  for (const pairs of [
    {class: 'sf-slider'},
    {class: 'card sf-slider sf-slider--content'},
    {id: 'gallery', class: 'sf-slider-dots sf-slider-dots--framed'},
    {'data-x': '1', class: 'sf-slider'},
  ]) assert.equal(re.test(attributes(pairs)), true, JSON.stringify(pairs));
  // No longer: sf-slider-range's field label (C202 evidence, ui-control 1ae5f663).
  for (const pairs of [
    {id: 'sf-slider-range-field-1', class: 'sf-range-slider-field-label'},
    {'data-labelledby': 'sf-slider-range-field-1', class: 'sf-range-slider'},
    {class: 'sf-range-slider'},
    {class: 'mysf-slider'},
    {class: 'sf-sliders'},
    {title: 'sf-slider'},
  ]) assert.equal(re.test(attributes(pairs)), false, JSON.stringify(pairs));
  assert.equal(slider.js, true);
  assert.deepEqual(slider.relation, [{name: 'swiper'}]);
});

test('#196 a real glyph in a box narrower than its font size is not marked missing; letters still are', async () => {
  const glyphs = await import(path.join(root, 'src/core/js/icon-glyphs.js'));
  const warnings = [];
  const console = {warn: (text) => warnings.push(text)};
  const saved = {console: globalThis.console, raf: globalThis.requestAnimationFrame};
  globalThis.console = console;
  globalThis.requestAnimationFrame = (fn) => {
    fn();
    return 0;
  };
  const glyph = ({name, box, em, text}) => {
    const marks = new Set();
    const doc = {
      createRange: () => ({selectNodeContents() {}, getBoundingClientRect: () => ({width: text})}),
      defaultView: {getComputedStyle: () => ({fontSize: `${em}px`, fontStyle: 'normal', fontWeight: '400', fontFamily: 'Material Symbols'})},
      fonts: {check: () => true},
    };
    return {
      isConnected: true,
      ownerDocument: doc,
      textContent: name,
      marks,
      getAttribute: () => null,
      hasAttribute: (attr) => marks.has(attr),
      setAttribute: (attr) => marks.add(attr),
      removeAttribute: (attr) => marks.delete(attr),
      getBoundingClientRect: () => ({width: box, height: box}),
    };
  };
  try {
    // RG-CC-5: a 12 px box for a 20 px glyph; the ligature is one em wide.
    const squeezed = glyph({name: 'search', box: 12, em: 20, text: 20});
    glyphs.checkIconGlyph(squeezed);
    assert.equal(squeezed.marks.has('data-sf-icon-missing'), false, 'a real glyph in a squeezed box');
    // A misspelt name drawn as letters is still missing, in a squeezed box or not.
    const letters = glyph({name: 'serach', box: 12, em: 20, text: 64});
    glyphs.checkIconGlyph(letters);
    assert.equal(letters.marks.has('data-sf-icon-missing'), true);
    const wide = glyph({name: 'serach_wide', box: 24, em: 24, text: 90});
    glyphs.checkIconGlyph(wide);
    assert.equal(wide.marks.has('data-sf-icon-missing'), true);
  } finally {
    globalThis.console = saved.console;
    globalThis.requestAnimationFrame = saved.raf;
  }
});

// A small element tree for the Loader's element probe: tag names,
// `tag[attr]`, `[attr="value"]` and comma lists are all the probe asks.
class Node {
  constructor(localName, attrs = {}, children = []) {
    this.localName = localName;
    this.attributes = Object.entries(attrs).map(([name, value]) => ({name, value}));
    this.childNodes = children.map((child) => (typeof child === 'string' ? {textContent: child, text: true} : child));
    this.parentElement = null;
    this.childNodes.forEach((child, index) => {
      child.parentElement = this;
      child.nextSibling = this.childNodes[index + 1] || null;
    });
  }

  get firstChild() { return this.childNodes[0] || null; }
  get firstElementChild() { return this.childNodes.find((child) => !child.text) || null; }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(''); }
  getAttribute(name) { return this.attributes.find((attr) => attr.name === name)?.value ?? null; }

  matches(selector) {
    return selector.split(',').some((part) => {
      const [, tag, attr, value] = /^\s*([a-z0-9-]*)(?:\[([a-z0-9-]+)(?:="([^"]*)")?\])?\s*$/u.exec(part) || [];
      if (tag === undefined) return false;
      if (tag && tag !== this.localName) return false;
      if (attr && this.getAttribute(attr) === null) return false;
      return value === undefined || this.getAttribute(attr) === value;
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => node.childNodes.forEach((child) => {
      if (child.text) return;
      if (child.matches(selector)) found.push(child);
      walk(child);
    });
    walk(this);
    return found;
  }
}
const h = (name, attrs, ...children) => new Node(name, attrs || {}, children);

const probe = () => {
  const context = {
    SFLoaderPlugin: function SFLoaderPlugin() {},
    OBSERVER_IGNORE_SELECTOR: '[data-sf-observer="ignore"]',
    escapeAttribute: (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;'),
    WeakMap,
    Set,
    RegExp,
  };
  vm.runInNewContext(slice(loader, '// The element names a regexp rule writes as markup', 'SFLoaderPlugin.prototype.stripIgnoredBlocks ='), context);
  return context;
};

test('#203 a rule that names an element finds it anywhere in the scope, by its own pattern', () => {
  const {SFLoaderPlugin} = probe();
  const plugin = new SFLoaderPlugin();
  const kbd = rules('src/component/kbd/rule.js').kbd;
  // The highlight rule as on main and the tree rule: an element pair and a custom tag.
  const highlight = {regex: /(?:class\s*=\s*["'](?:[^"']*\s)?language-[^"']*["']|<pre\b[^>]*>\s*<code\b[^>]*>)/i};
  const tree = {regex: /(?:<sf-tree(?=[\s>/])|class\s*=\s*["'](?:[^"']*\s)?sf-tree(?=\s|["']))/};
  const filler = Array.from({length: 40}, (_, index) => h('p', {class: 'sf-text'}, `Paragraph ${index} `.repeat(20)));
  const page = h('body', {}, ...filler, h('p', {}, 'Press ', h('kbd', {}, 'Esc')), h('pre', {}, '\n', h('code', {}, 'let a = 1;')), h('sf-tree', {}));
  assert.equal(plugin.ruleMatchesElements(kbd, page), true, 'a kbd below 4 KB of markup');
  assert.equal(plugin.ruleMatchesElements(highlight, page), true, 'a bare pre > code');
  assert.equal(plugin.ruleMatchesElements(tree, page), true, 'a custom tag a rule writes as markup');

  // No longer: what the markup scan leaves out stays out; a rule names no element by a class.
  const quiet = h('body', {},
    h('pre', {}, h('kbd', {}, 'Esc')),
    h('code', {}, h('kbd', {}, 'Tab')),
    h('div', {'data-sf-observer': 'ignore'}, h('kbd', {}, 'K'), h('pre', {}, h('code', {}, 'x'))),
    h('template', {}, h('kbd', {}, 'T')),
    h('pre', {}, 'text first ', h('code', {}, 'x')),
    h('p', {}, h('code', {}, 'inline')),
    h('div', {class: 'sf-tree-like'}),
  );
  assert.equal(plugin.ruleMatchesElements(kbd, quiet), false, 'a key inside pre, code, an ignored subtree or a template');
  assert.equal(plugin.ruleMatchesElements(highlight, quiet), false, 'pre with text before its code, code alone, ignored blocks');
  assert.equal(plugin.ruleMatchesElements(tree, quiet), false);
  assert.equal(plugin.ruleMatchesElements({regex: /data-sf-copy/}, page), false, 'an attribute rule names no element');
  assert.equal(plugin.ruleMatchesElements({regex: /class\s*=\s*["'][^"']*\bsf-icon\b[^"']*["']|<\s*i[^>]*class\s*=\s*["'][^"']*\bsf-icon\b[^"']*["']/}, page), false, 'the icons rule (<\\s*i) names none');
  // The scope itself counts (an added kbd).
  assert.equal(plugin.ruleMatchesElements(kbd, h('kbd', {}, 'K')), true);

  // Wired: the page scan (searchRegexp) and the added subtrees (processChanges).
  const search = slice(loader, 'SFLoaderPlugin.prototype.searchRegexp =', 'SFLoaderPlugin.prototype.getObserverFilteredHTML =');
  assert.match(search, /else if \(scope && this\.ruleMatchesElements\(item, scope\)\)/u);
  const changes = slice(loader, 'SFLoaderPlugin.prototype.search = function', 'SFLoaderPlugin.prototype.prepareTurboEvents');
  assert.match(changes, /for \(const \[key, rule\] of this\.getRegexpScanRules\(\)\) \{\n\s+if \(this\.module\[key\] \|\| !this\.ruleMatchesElements\(rule, objHTML\)\) continue;/u);
});

test('#164 the kbd sheet comes with every key, its script only with kbd[data-sf-shortcut]', () => {
  const {kbd} = rules('src/component/kbd/rule.js');
  assert.equal(kbd.css, true);
  assert.equal(kbd.js, false, 'a page of plain keys fetches no script');
  assert.equal(kbd.jsWhen, 'kbd[data-sf-shortcut]');
  assert.equal(kbd.regex.test('<p>Press <kbd>Esc</kbd></p>'), true);

  const {SFLoaderPlugin} = probe();
  vm.runInNewContext(slice(loader, 'SFLoaderPlugin.prototype.loadScriptOnCall =', '// The lazy relations'), {SFLoaderPlugin, console});
  const plugin = new SFLoaderPlugin();
  plugin.findPlugins = {kbd, buttons: {type: 'component', css: true, js: true}, skeleton: {type: 'component', css: true, js: false, jsOnCall: true}};
  plugin.ComponentRegistry = {};
  plugin.added = [];
  plugin.pathPluginJs = (name) => `/component/${name}/js/${name}.min.js`;
  plugin.addScript = (file) => {
    plugin.added.push(file);
    return Promise.resolve();
  };
  // No longer: plain keys, a combination in a code sample or an ignored part.
  const plain = h('body', {}, h('p', {}, h('kbd', {}, 'Esc'), h('kbd', {class: 'sf-kbd'}, 'K')),
    h('pre', {}, h('kbd', {'data-sf-shortcut': 'mod+k'})),
    h('div', {'data-sf-observer': 'ignore'}, h('kbd', {'data-sf-shortcut': 'mod+k'})),
    h('span', {'data-sf-shortcut': 'mod+k'}));
  assert.equal(plugin.loadScriptsWhen(plain), 0);
  assert.deepEqual(plugin.added, []);
  // A combination in text, on the page or added later: once.
  const text = h('p', {}, 'Press ', h('kbd', {'data-sf-shortcut': 'mod+k'}));
  assert.equal(plugin.loadScriptsWhen(text), 1);
  assert.equal(plugin.loadScriptsWhen(h('kbd', {'data-sf-shortcut': 'escape'})), 0, 'asked once');
  assert.deepEqual(plugin.added, ['/component/kbd/js/kbd.min.js']);
  // SF.Loader.ensurePlugin('kbd') gives the script too; an ordinary rule is untouched.
  assert.equal(plugin.loadScriptOnCall('buttons'), false);

  // Wired: page scan, added subtrees, a changed attribute, Turbo, new rules.
  assert.match(loader, /this\.searchRegexp\(''\);\n\s+this\.loadScriptsWhen\(document\.body\);/u);
  assert.match(loader, /this\.loadScriptsWhen\(objHTML\);/u);
  assert.match(loader, /processedAttributeTargetsCount\+\+;\n\s+this\.loadScriptsWhen\(change\.target\);/u);
  assert.match(loader, /this\.searchRegexp\('', newBody\);\n\s+this\.loadScriptsWhen\(newBody\);/u);
  assert.match(slice(loader, 'SFLoaderPlugin.prototype.rulesChanged =', '// The base a Smart rule'), /this\.scriptWhenRules = null;[\s\S]*this\.loadScriptsWhen\(document\.body\);/u);
});

test('#53 the class checkbox and sf-checkbox ask for check and remove with the first icons', () => {
  const script = read('src/component/checkbox/js/_checkbox.js');
  const fn = slice(script, 'export function preloadCheckboxIcons()', 'function setCheckboxIcon');
  const calls = [];
  const context = {globalThis: {SF: {Loader: {preloadIcons(entries) { calls.push([this === context.globalThis.SF.Loader, entries]); return 2; }}}}};
  vm.runInNewContext(`let boxIconsAsked = false;\n${fn.replace('export ', '')}\nthis.result = [preloadCheckboxIcons(), preloadCheckboxIcons()];`, context);
  assert.deepEqual([...context.result], [true, false], 'once per bundle');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[true, ['check', 'remove']]]);
  assert.match(slice(script, 'function bindCheckbox(root)', 'function unbindCheckbox'), /preloadCheckboxIcons\(\);\n\s+syncCheckboxState\(root\);/u);
  const smart = read('src/smart/checkbox/index.js');
  assert.match(smart, /connectedCallback\(\) \{\n\s+super\.connectedCallback\(\);[\s\S]*?preloadCheckboxIcons\(\);\n\s+\}/u);
});

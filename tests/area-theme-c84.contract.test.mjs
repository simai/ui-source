// C84 / RG-S3-31: a theme applied to an area below the page gives the area the
// roles of the scheme it stands in. The roles are declared on the theme classes
// (core _sf_css__theme.scss), so the area takes the class of its surroundings
// and follows a switch until the theme is taken off. Measured in the browser in
// ui-control control/evidence (area-theme-dark-c84): the tonal button on a dark
// page went from 1.13 : 1 to 8.6 : 1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {applyTheme, themeFromColor} from '../src/core/js/theme-palette.js';

const root = new URL('..', import.meta.url).pathname;

// The least of a DOM the function reads: classes, an inline style, the parent
// chain, a class observer on the document and the system scheme.
function fakeDocument({systemDark = false} = {}) {
  const observers = [];
  const media = {matches: systemDark, listeners: new Set(),
    addEventListener(type, fn) { this.listeners.add(fn); }, removeEventListener(type, fn) { this.listeners.delete(fn); }};
  const view = {
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.push(this); }
      disconnect() { observers.splice(observers.indexOf(this), 1); }
    },
    matchMedia: () => media,
  };
  const doc = {defaultView: view};
  const element = (classes = [], parent = null) => {
    const set = new Set(classes);
    const props = new Map();
    const node = {
      ownerDocument: doc, parentElement: parent,
      classList: {
        contains: (name) => set.has(name),
        add: (name) => { set.add(name); notify(node); },
        remove: (name) => { set.delete(name); notify(node); },
        toggle: (name, force) => { (force ? set.add(name) : set.delete(name)); notify(node); },
      },
      style: {setProperty: (name, value) => props.set(name, value), getPropertyValue: (name) => props.get(name) ?? '', removeProperty: (name) => props.delete(name)},
      contains(other) { for (let n = other; n; n = n.parentElement) if (n === node) return true; return false; },
      closest(selector) {
        const names = selector.split(',').map((part) => part.trim().replace(/^\./u, ''));
        for (let n = node; n; n = n.parentElement) if (names.some((name) => n.classList.contains(name))) return n;
        return null;
      },
      get classes() { return [...set].sort().join(' '); },
      props,
    };
    return node;
  };
  const notify = (target) => { for (const observer of [...observers]) observer.callback([{target}]); };
  doc.documentElement = element(['theme-light']);
  return {doc, element, media, observers, setSystem(dark) { media.matches = dark; for (const fn of [...media.listeners]) fn(); }};
}

const theme = themeFromColor('#2e7d32');

test('C84: an area below the page takes the theme class of the scheme around it, even over a fixed theme-light', () => {
  const {doc, element} = fakeDocument();
  doc.documentElement.classList.remove('theme-light');
  doc.documentElement.classList.add('theme-dark');
  const section = element(['flex'], doc.documentElement);
  const fixed = element(['theme-light', 'p-3'], section);
  const plain = element(['p-3'], section);
  applyTheme(theme, fixed);
  applyTheme(theme, plain);
  assert.equal(fixed.classes, 'p-3 theme-dark');
  assert.equal(plain.classes, 'p-3 theme-dark');
  assert.equal(plain.props.get('--sf-primary-40'), theme.palettes.primary.tones[40]);
});

test('C84: the area follows a switch of the page and of a section, and gets its own classes back when the theme is off', () => {
  const {doc, element, observers} = fakeDocument();
  const section = element([], doc.documentElement);
  const area = element(['theme-light', 'p-3'], section);
  const off = applyTheme(theme, area);
  assert.equal(area.classes, 'p-3 theme-light');
  doc.documentElement.classList.remove('theme-light');
  doc.documentElement.classList.add('theme-dark');
  assert.equal(area.classes, 'p-3 theme-dark');
  section.classList.add('theme-light');
  assert.equal(area.classes, 'p-3 theme-light', 'a themed section is nearer than the page');
  section.classList.remove('theme-light');
  assert.equal(area.classes, 'p-3 theme-dark');
  off();
  assert.equal(area.classes, 'p-3 theme-light', 'the class the area had comes back');
  assert.equal(area.props.size, 0);
  assert.equal(observers.length, 0, 'the observer is gone with the theme');
  doc.documentElement.classList.remove('theme-dark');
  assert.equal(area.classes, 'p-3 theme-light');
});

test('C84: with no themed ancestor the area follows the system scheme', () => {
  const {doc, element, setSystem} = fakeDocument({systemDark: true});
  doc.documentElement.classList.remove('theme-light');
  const area = element([], doc.documentElement);
  const off = applyTheme(theme, area);
  assert.equal(area.classes, 'theme-dark');
  setSystem(false);
  assert.equal(area.classes, 'theme-light');
  off();
  assert.equal(area.classes, '');
});

test('C84: the page root keeps its own class; only the tones are written', () => {
  const {doc} = fakeDocument();
  const off = applyTheme(theme, doc.documentElement);
  assert.equal(doc.documentElement.classes, 'theme-light');
  assert.ok(doc.documentElement.props.get('--sf-primary-40'));
  off();
  assert.equal(doc.documentElement.props.size, 0);
});

test('C84: sf-input-color (brand, theme) puts its theme through core applyTheme, the brand fill beside it', () => {
  const source = readFileSync(`${root}src/smart/input-color/index.js`, 'utf8');
  const apply = source.slice(source.indexOf('    _applyTheme() {'), source.indexOf('    _scheduleTheme('));
  assert.match(apply, /palette\.applyTheme\(theme, target\)/u);
  assert.match(apply, /palette\.brandVariables\?\.\(theme\)/u);
});

test('C84: the docs no longer ask an area to carry a fixed theme class', () => {
  const docs = readFileSync(`${root}src/smart/theme-generator/docs.md`, 'utf8');
  assert.doesNotMatch(docs, /тоже должна\s+нести такой класс/u);
  const examples = readFileSync(`${root}src/smart/theme-generator/examples.json`, 'utf8');
  assert.doesNotMatch(examples, /site-main theme-light/u);
});

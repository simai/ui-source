// sf-settings 1.13.0 (group build 22; owner remark 2026-11-28 relayed by DEV,
// msg-c13782cf26484519b8da): a choice's option may carry swatch -- one CSS
// colour or {light, dark} -- drawn as a circle before its name in the drill,
// rows and panel looks. Measured in a browser in
// tests/browser/settings-swatch.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {cssSupports, entriesFor, optionSwatch} from '../src/smart/settings/js/settings.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const panel = read('src/smart/settings/js/templates/panel.js');
const css = read('src/smart/settings/scss/_smart__settings.scss');
const menu = read('src/smart/menu-context/js/templates/default.js');
const docs = read('src/smart/settings/docs.md');
const manifest = JSON.parse(read('src/smart/settings/component.json'));

// A browser's CSS.supports for the cases: the named colours, codes and the
// colour functions it knows; light-dark() when `lightDark` says so.
function browser({lightDark = true} = {}) {
  const colour = /^(?:#[0-9a-f]{3,8}|red|blue|white|black|transparent|(?:rgb|hsl|oklch)\([^;{}]*\)|var\(--[\w-]+\))$/iu;
  return (property, value) => {
    assert.equal(property, 'color');
    const both = /^light-dark\((.+), (.+)\)$/u.exec(value);
    if (both) return lightDark && colour.test(both[1]) && colour.test(both[2]);
    return colour.test(value);
  };
}

test('one CSS colour is the swatch as it is', () => {
  const supports = browser();
  assert.equal(optionSwatch('#2563eb', supports), '#2563eb');
  assert.equal(optionSwatch('  oklch(60% 0.2 260) ', supports), 'oklch(60% 0.2 260)');
  assert.equal(optionSwatch('var(--sf-blue-50)', supports), 'var(--sf-blue-50)');
});

test('{light, dark} paints light-dark(light, dark), the light one where the browser has no light-dark()', () => {
  assert.equal(optionSwatch({light: '#2563eb', dark: '#93c5fd'}, browser()), 'light-dark(#2563eb, #93c5fd)');
  assert.equal(optionSwatch({light: '#2563eb', dark: '#93c5fd'}, browser({lightDark: false})), '#2563eb');
});

test('anything that is not a colour is no swatch', () => {
  const supports = browser();
  for (const value of [undefined, null, '', '   ', 12, true, [], ['#fff'], 'blue; background: url(x)', 'red}', 'not-a-colour',
    {light: '#fff'}, {dark: '#000'}, {light: '#fff', dark: 'nope'}, {light: 'x;y', dark: '#000'}, 'a'.repeat(201)]) {
    assert.equal(optionSwatch(value, supports), '', JSON.stringify(value));
  }
  // Without CSS.supports (a server, this test): what could close a declaration is refused.
  assert.equal(cssSupports('color', '#fff'), true);
  assert.equal(cssSupports('color', 'red; color: blue'), false);
  assert.equal(cssSupports('color', 'red}'), false);
  assert.equal(optionSwatch({light: '#fff', dark: '#000'}), 'light-dark(#fff, #000)');
});

test('the menu looks get the swatch on the option; with an icon the swatch wins; an invalid one keeps the icon', () => {
  const items = [{id: 'accent', type: 'choice', text: 'Accent', value: 'blue', options: [
    {id: 'blue', text: 'Blue', swatch: {light: '#2563eb', dark: '#93c5fd'}},
    {id: 'red', text: 'Red', icon: 'palette', swatch: '#dc2626'},
    {id: 'odd', text: 'Odd', icon: 'help', swatch: 'red; background: url(x)'},
    {id: 'plain', text: 'Plain'},
  ]}];
  for (const look of ['drill', 'rows']) {
    const [entry] = entriesFor(items, look);
    const [blue, red, odd, plain] = entry.options;
    assert.deepEqual(blue, {id: 'blue', text: 'Blue', swatch: 'light-dark(#2563eb, #93c5fd)', checked: true}, look);
    assert.deepEqual(red, {id: 'red', text: 'Red', swatch: '#dc2626', checked: false}, `${look}: the swatch wins over the icon`);
    assert.deepEqual(odd, {id: 'odd', text: 'Odd', icon: 'help', checked: false}, `${look}: no swatch, the icon stays`);
    assert.deepEqual(plain, {id: 'plain', text: 'Plain', checked: false}, look);
  }
});

test('the panel draws the circle by setProperty, decorative, and keeps its place in a list that has one', () => {
  assert.match(panel, /const SWATCH_PROPERTY = '--sf-settings-row--swatch';/u);
  assert.match(panel, /element\.style\.setProperty\(SWATCH_PROPERTY, color\)/u);
  assert.match(panel, /<span class="sf-settings-row-swatch" aria-hidden="true" \$\{ref\(paint\(row\.swatch\)\)\}><\/span>/u);
  assert.match(panel, /sf-settings-row-swatch-place" aria-hidden="true"/u);
  assert.doesNotMatch(panel, /style=\$\{/u, 'no style attribute built from text');
  assert.match(panel, /swatch: swatches\[at\], swatches: anySwatch,/u);
  // The icon's place of the row's line, on the outline hairline: system values only.
  assert.match(css, /\.sf-settings-row-swatch,\n\.sf-settings-row-swatch-place \{[^}]*inline-size: calc\(var\(--sf-settings-panel--line\) - var\(--sf-space-1\\\/4\)\);/u);
  assert.match(css, /\.sf-settings-row-swatch \{\n\s+border-color: var\(--sf-outline-variant\);\n\s+background-color: var\(--sf-settings-row--swatch, transparent\);/u);
});

test('sf-menu-context sets its circle\'s colour by setProperty too', () => {
  assert.match(menu, /element\.style\.setProperty\("--sf-context-menu-swatch", value\)/u);
  assert.doesNotMatch(menu, /style=\$\{`--sf-context-menu-swatch/u);
});

test('the field is documented and no public CSS variable is added', () => {
  assert.equal(manifest.version, '1.13.0');
  assert.match(docs, /`swatch`/u);
  assert.deepEqual(Object.keys(manifest['css-variables']), ['--sf-settings-panel-width', '--sf-settings-panel-height']);
});

test('the decision line of 1.13.0 is the last', () => {
  assert.match(manifest['x-decisions'].at(-1), /^version 1\.13\.0 \(2026-11-28, group build 22; owner remark 2026-11-28/u);
});

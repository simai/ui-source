import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Kbd is a CSS-only semantic primitive with a neutral chord group', async () => {
  const [rule, css] = await Promise.all([
    read('src/component/kbd/rule.js'),
    read('src/component/kbd/scss/_kbd.scss'),
  ]);

  assert.match(rule, /<kbd\\b/);
  assert.match(rule, /\\bsf-kbd\\b/);
  assert.match(rule, /css:\s*true/);
  assert.match(rule, /js:\s*false/);
  assert.match(css, /\$key: 'kbd:not\(\.sf-kbd--group\):not\(:has\(> kbd\)\), \.sf-kbd:not\(\.sf-kbd--group\)'/);
  assert.match(css, /\$group: 'kbd:has\(> kbd\), \.sf-kbd--group'/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.doesNotMatch(css, /cursor:\s*pointer/);
  assert.doesNotMatch(css, /:focus/);
});

// Owner decision 2026-11-07 (docs review R030, rule C04): one component owns
// the look and the place decides it -- a keycap in running text, a soft cap in
// a control, plain glyphs in a list of commands -- with appearance="cap|plain|key"
// saying it outright.
test('Kbd decides its look by the place, and an appearance said outright wins', async () => {
  const css = await read('src/component/kbd/scss/_kbd.scss');
  const placesOf = (name) => (css.match(new RegExp(`\\$${name}: '([^']+)'`, 'u')) ?? [])[1] ?? '';

  for (const place of ['button', '[role="button"]', '[role="combobox"]', '[role="searchbox"]', '.sf-button', '.sf-input']) {
    assert.ok(placesOf('cap-places').includes(place), `a cap inside ${place}`);
  }
  for (const place of ['[role="menu"]', '[role="listbox"]', '[role="tooltip"]', '.sf-tooltip', '.sf-context-menu']) {
    assert.ok(placesOf('plain-places').includes(place), `plain glyphs inside ${place}`);
  }
  // A menu row is a button inside a menu: the list's rule comes after the control's.
  assert.ok(css.indexOf(':where(#{$plain-places}) :where(#{$key})') > css.indexOf(':where(#{$cap-places}) :where(#{$key})'));
  // The appearance said outright comes after every place.
  for (const appearance of ['cap', 'plain', 'key']) {
    assert.ok(css.indexOf(`:where(#{said(${appearance})})`) > css.indexOf(':where(#{$plain-places}) :where(#{$key})'), appearance);
  }
  assert.match(css, /kbd\[appearance="#\{\$appearance\}"\] kbd/u, 'a group passes its appearance to its keys');
});

test('Kbd caps take the ink they sit in and mix their fill from it, on the alpha scale', async () => {
  const css = await read('src/component/kbd/scss/_kbd.scss');
  const cap = css.slice(css.indexOf('@mixin cap'), css.indexOf('@mixin plain'));
  // The ink whole (C04: the button's text), the fill a state step of it: the
  // 80 % ink of 1.1.0 fell under 4.5:1 (buttons review 2026-11-09).
  assert.match(cap, /color: var\(--sf-kbd-color, currentColor\);/u);
  assert.match(cap, /background: var\(--sf-kbd-background-color, var\(--sf-kbd-background, color-mix\(in srgb, currentColor 8%, transparent\)\)\)/u);
  assert.match(cap, /border: none/u);
  const keycap = css.slice(css.indexOf('@mixin keycap'), css.indexOf('@mixin cap'));
  assert.match(keycap, /border: var\(--sf-px\) solid var\(--sf-kbd-border-color, var\(--sf-outline-variant\)\)/u);
  assert.match(keycap, /box-shadow: inset 0 calc\(-1 \* var\(--sf-px\)\) 0/u);
  const plain = css.slice(css.indexOf('@mixin plain'), css.indexOf('@layer'));
  assert.match(plain, /color: var\(--sf-kbd-plain-color, var\(--sf-on-surface-variant\)\)/u);
  // The row's own text (C38): inherited, no em (C18).
  assert.match(plain, /font-size: inherit;/u);
  // Every mixed step is one of the alpha scale's eleven.
  for (const [, step] of css.matchAll(/currentColor (\d+)%/gu)) {
    assert.ok([4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 80].includes(Number(step)), `${step}% is off the alpha scale`);
  }
});

// Owner decision C38 (2026-11-09, replaces C04's 0.8125em / 1.6em): a cap or a
// key takes the text step one below its place's -- the plate that step's line
// height, the letters its size, never below 1/3. The kbd sheet reads the
// place from its size and text classes: a host sets none of a key's
// variables (the Framework never sets a public variable, and the internal
// ones are the component's).
test('Kbd sizes come from the ladder: the step below the place, never below 1/3', async () => {
  const css = await read('src/component/kbd/scss/_kbd.scss');
  const code = css.replace(/\/\/[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
  assert.doesNotMatch(code, /(?:^|[\s:(,])-?\d*\.?\d+(?:px|rem)\b/mu, 'no pixel or rem literal');
  // No em either (C18): plain glyphs inherit the row's text, their gap is a2.
  assert.doesNotMatch(code, /(?:^|[\s:(,])-?\d*\.?\d+em\b/mu, 'no em literal');
  assert.equal(code.match(/gap: var\(--sf-a2\);/gu)?.length, 2, 'plain glyph gaps on a2');
  assert.match(code, /--sf-kbd--size: var\(--sf-kbd-size, var\(--sf-kbd--step-size, var\(--sf-text-height-1\\\/2\)\)\)/u);
  assert.match(code, /font-size: var\(--sf-kbd-font-size, var\(--sf-kbd--step-font-size, var\(--sf-text-size-1\\\/2\)\)\)/u);
  assert.match(code, /--sf-kbd--padding-inline: var\(--sf-kbd-padding-inline, var\(--sf-space-1\\\/4\)\)/u);
  assert.doesNotMatch(code, /gap: var\(--sf-kbd-gap, (?!var\(--sf-space-1\\\/4\)\))/u);
  for (const token of ['--sf-radius--ui', '--sf-text--family', '--sf-font-weight-medium', '--sf-outline-variant', '--sf-on-surface-variant', '--sf-surface-area', '--sf-on-surface', '--sf-px']) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  // The place list: each host size and text class says the step below its own.
  const list = code.slice(code.indexOf('$steps: ('), code.indexOf('\n);', code.indexOf('$steps: (')));
  const stepOf = {};
  for (const [, step, places] of list.matchAll(/'([^']+)': \(((?:[^()]|\([^()]*\))*)\)/gu)) {
    for (const [, place] of places.matchAll(/'([^']+)'/gu)) stepOf[place.replace(/\\\\/gu, '\\')] = step.replace(/\\\\/gu, '\\');
  }
  const expect = {'1\\/3': '1\\/3', '1\\/2': '1\\/3', 1: '1\\/2', 2: '1', 3: '2'};
  for (const host of ['.sf-button.sf-button--size-', '.sf-input.sf-input--size-']) {
    for (const [size, step] of Object.entries(expect)) assert.equal(stepOf[`${host}${size}`], step, `${host}${size}`);
  }
  for (const [place, step] of Object.entries({':root': '1\\/2', '[data-sf-density]:not(:root)': '1\\/2', '.sf-text-1\\/2': '1\\/3', '.text-small': '1\\/3', '.sf-text-1': '1\\/2', '.sf-text-2': '1', '.sf-text-3': '2'})) {
    assert.equal(stepOf[place], step, place);
  }
  assert.match(code, /--sf-kbd--step-size: var\(--sf-text-height-#\{\$step\}\);\s*--sf-kbd--step-font-size: var\(--sf-text-size-#\{\$step\}\);/u);
});

// A bare control without a size class is the default size 1 and takes its
// step, 1/2, not its text's (DEV review of C38, 2026-11-09). The rule comes
// before the map, so a size class on the same element says otherwise.
test('Kbd in a bare button, combobox or searchbox takes the control step', async () => {
  const css = await read('src/component/kbd/scss/_kbd.scss');
  const code = css.replace(/\/\/[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
  const bare = /^\$bare-controls: '([^']+)';/mu.exec(code)?.[1] ?? '';
  const places = bare.split(',').map((place) => place.trim());
  for (const place of ['button', '[role="button"]', '[role="combobox"]', '[role="searchbox"]']) assert.ok(places.includes(place), `bare control ${place}`);
  for (const place of places) assert.doesNotMatch(place, /\./u, `${place} is bare: no class`);
  const rule = /:where\(#\{\$bare-controls\}\) \{\s*--sf-kbd--step-size: var\(--sf-text-height-1\\\/2\);\s*--sf-kbd--step-font-size: var\(--sf-text-size-1\\\/2\);\s*\}/u.exec(code);
  assert.ok(rule, 'bare controls set step 1/2');
  const map = code.indexOf('@each $step, $places in $steps');
  assert.ok(map > 0 && rule.index < map, 'the bare rule comes before the size map');
});

test('Hosts render shortcuts through the shared view and never style a key', async () => {
  const [view, button, menu, search, buttonSheet, menuSheet, searchSheet, adminSheet] = await Promise.all([
    read('src/component/kbd/js/shortcut.js'),
    read('src/smart/button/js/templates/default.js'),
    read('src/smart/menu-context/js/templates/default.js'),
    read('src/smart/search/js/templates/default.js'),
    read('src/component/buttons/scss/_css__buttons_custom.scss'),
    read('src/component/context-menu/scss/_css__context_menu.scss'),
    read('src/smart/search/scss/_smart__search.scss'),
    read('src/component/admin-menu/scss/_css__admin_menu.scss'),
  ]);
  assert.match(view, /export function shortcutView\(/u);
  for (const template of [menu, search]) assert.match(template, /shortcutView\(/u);
  for (const template of [button, menu, search]) {
    assert.match(template, /sf-kbd--group/u);
    assert.match(template, /sf-kbd-join/u);
    assert.match(template, /sf-kbd--square/u);
  }
  // No host rule names a kbd element, a kbd class or a key's part.
  const strip = (source) => source.replace(/\/\/[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
  for (const [name, sheet] of Object.entries({buttonSheet, menuSheet, searchSheet, adminSheet})) {
    const selectors = [...strip(sheet).matchAll(/([^{};]+)\{/gu)].map(([, selector]) => selector.trim());
    const styling = selectors.filter((selector) => /(?:^|[\s>+~,(])kbd\b|\.sf-kbd|-kbd\b|shortcut-key|context-menu-item-shortcut|search-shortcut/u.test(selector));
    assert.deepEqual(styling, [], `${name} styles a key`);
  }
});

test('Shortcuts read in the platform\'s words: glyphs side by side on Apple, words joined by + elsewhere', async () => {
  const {shortcutView} = await import('../src/component/kbd/js/shortcut.js');
  const text = (view) => view.keys.map((key) => key.text).join(view.join ? '+' : '');
  assert.equal(text(shortcutView('mod+shift+p', true)), '⇧⌘P');
  assert.equal(text(shortcutView('shift+mod+p', false)), 'Ctrl+Shift+P');
  assert.equal(text(shortcutView('mod+k', true)), '⌘K');
  assert.equal(text(shortcutView('mod+k', false)), 'Ctrl+K');
  assert.equal(text(shortcutView('escape', false)), 'Esc');
  assert.equal(text(shortcutView('F2', true)), 'F2');
  assert.deepEqual(shortcutView('mod+k', true).keys.map((key) => key.square), [true, true]);
  assert.deepEqual(shortcutView('mod+k', false).keys.map((key) => key.square), [false, true]);
  // Text a page already wrote for people is shown as written.
  assert.deepEqual(shortcutView('⇧⌘L', false), {keys: [{text: '⇧⌘L', square: false}], join: false});
  assert.deepEqual(shortcutView('', true), {keys: [], join: false});
});

test('Kbd owner documentation covers every semantic scenario', async (context) => {
  let docs;
  try {
    docs = await read('src/component/kbd/docs/docs.md');
  } catch {
    context.skip('owner documentation is not present in this projection');
    return;
  }

  for (const phrase of ['Одна клавиша', 'Сочетание', 'Последовательность', 'sf-kbd--group', 'appearance', 'Вид по месту', 'lint-kbd-styles', '--sf-kbd-plain-color']) {
    assert.match(docs, new RegExp(phrase));
  }
});

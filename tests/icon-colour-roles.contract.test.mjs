import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// What colour a glyph may be. Four roles (C107, owner 2026-11-12, replacing
// the three-role rule of 2026-10-08):
//
//   --sf-on-surface-icon     a neutral icon inside a control -- a button, a
//                            segment, a tab, a header tool, an icon button with
//                            no text: half a step paler than the label
//                            (neutral-25 light, neutral-80 dark);
//   --sf-on-surface-variant  a row's leading icon (list, menu, tree, field,
//                            tag, crumbs, toast, file row) and the service
//                            marks inside a field or a row (chevron, clear, eye);
//   --sf-on-surface          the label's colour: a hovered or pressed control's
//                            icon catches its label up, and a current row's;
//   --sf-on-disable          disabled (--sf-on-surface-disabled).
//
// A neutral icon beside text at rest is never --sf-on-surface (R192: as dark
// as its label, the glyph reads heavier than the text).
//
// Two kinds of answer were found in the Framework when the rule was written
// down. --sf-on-surface-muted, a step paler still, painted the hint in an
// input, the glyph in a step and a table's sort arrow: it measures 3.18:1 on
// the light surface and 2.92:1 on the dark one, where WCAG 1.4.11 asks 3:1 of
// non-text graphics -- on the line in one theme and under it in the other. And
// --sf-outline and --sf-outline-disable, the roles of a boundary, painted a
// tag's glyph and a disabled country code: a glyph is read, not drawn round
// something, and a theme retuning its borders would have moved them.
//
// A colour that belongs to the control -- on-primary inside a filled button,
// error inside an error one -- is the text's own weight in that control and is
// not what this guards against.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// Paler than --sf-on-surface-variant, or not a role for something read.
const refused = new Map([
  ['--sf-on-surface-muted', 'paler than the variant role: 3.18:1 light, 2.92:1 dark, under WCAG 1.4.11'],
  ['--sf-outline', 'the role of a boundary, not of something read'],
  ['--sf-outline-variant', 'the role of a boundary, not of something read'],
  ['--sf-outline-disable', 'the disabled role of a boundary; a glyph takes --sf-on-disable'],
  ['--sf-outline-disabled', 'the disabled role of a boundary (C16 name); a glyph takes --sf-on-surface-disabled'],
]);

const sheets = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return sheets(path);
  return ['.scss', '.css'].includes(extname(entry.name)) ? [path] : [];
});

test('a glyph is coloured by one of the roles an icon may take', () => {
  const wrong = [];
  let declarations = 0;

  for (const path of sheets(root)) {
    if (!statSync(path).isFile()) continue;
    const css = readFileSync(path, 'utf8');
    for (const match of css.matchAll(/--sf-icon--color:\s*([^;]+);/g)) {
      declarations += 1;
      const value = match[1].trim();
      for (const [role, why] of refused) {
        // The role itself, not one that merely starts with its name:
        // --sf-outline-primary is a boundary role this does not name.
        if (new RegExp(`var\\(${role}\\s*[,)]`).test(value)) {
          wrong.push(`${path.slice(root.length + 1)}: ${value} -- ${why}`);
        }
      }
    }
  }

  assert.deepEqual(wrong, [], 'an icon reads at the weight of its text, one step paler, or disabled');
  // A guard that silently checks nothing is worse than no guard.
  assert.ok(declarations >= 100, `only ${declarations} icon colour declarations were read`);
});

test("the colour of a glyph is layered, so a utility and a component can answer it", async () => {
  const icons = readFileSync(resolve(root, 'component/icons/scss/_css__icons.scss'), 'utf8');
  // Unlayered CSS outranks every layer. With the colour declared there, a
  // colour utility on a glyph did nothing at all: the class read as applied
  // and the glyph drew in currentColor regardless.
  assert.match(icons, /@layer sf\.base \{\s*\.sf-icon \{\s*color: var\(--sf-icon--color, var\(--sf-icon-color, currentColor\)\);/);
  const unlayered = icons.slice(0, icons.indexOf('@layer sf.base'));
  assert.doesNotMatch(unlayered, /^\s*color:/mu,
    'the base rule must not also set a colour outside the layer, which would outrank it again');
});

// ---------------------------------------------------------------------------
// C107: the fourth role, and the rule it carries.

const read = (relative) => readFileSync(resolve(root, relative), 'utf8');

test('the icon role is a theme role, half a step under the label, re-declared by every place', () => {
  const theme = read('core/scss/_sf_css__theme.scss');
  assert.match(theme, /--sf-on-surface-icon: light-dark\(var\(--sf-neutral-25\), var\(--sf-neutral-80\)\);/u);
  // An opaque place takes it back, a strong colour and glass give their ink
  // (no half step on the alpha scale), a popover writes the place out.
  const places = read('core/scss/mix/_mix__places.scss');
  assert.match(places, /'on-surface-icon': 'light-dark\(var\(--sf-neutral-25\), var\(--sf-neutral-80\)\)'/u);
  const strong = places.slice(places.indexOf('@mixin sf-place-strong($c)'), places.indexOf('@mixin sf-place-strong-accent'));
  assert.match(strong, /--sf-on-surface-icon: var\(--sf-on-#\{\$c\}\);/u);
  assert.match(read('core/scss/_sf_css__surface_places.scss'), /--sf-on-surface-icon: var\(--sf-on-surface-media\);/u);
  assert.match(read('smart/popover/js/templates/default.css'), /--sf-on-surface-icon: light-dark\(var\(--sf-neutral-25\), var\(--sf-neutral-80\)\);/u);
});

// The rule of the enclosing block of a declaration: the selector text before
// the nearest unclosed `{` (nested Sass blocks are joined).
const selectorsAt = (css, index) => {
  const out = [];
  let depth = 0;
  for (let i = index; i >= 0; i -= 1) {
    const ch = css[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth > 0) { depth -= 1; continue; }
      let j = i - 1;
      while (j >= 0 && !';{}'.includes(css[j])) j -= 1;
      out.unshift(css.slice(j + 1, i).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '').trim());
    }
  }
  return out.join(' ');
};

// Where --sf-on-surface is still a glyph's colour at rest, and why.
const labelColourAtRest = new Map([
  ['component/menu/scss/_css__menu.scss', 'the current item of a header row: the mark of the current page, as the plate\'s on-colour in the navigation look'],
  ['smart/wizard/scss/_smart__wizard.scss', 'a done step\'s state mark, not a neutral icon beside text'],
  ['component/fab/scss/_css_fab.scss', 'follow-up: the tonal on-surface FAB is an icon alone in a control (C107 (3)); not in the C107 group'],
]);
const state = /:hover|:active|\.active\b|:focus-visible|\.selected\b|aria-current|aria-pressed|--pressed|\.open\b/u;

test('a neutral icon beside text is not --sf-on-surface at rest (C107, R192)', () => {
  const wrong = [];
  let seen = 0;
  for (const path of sheets(root)) {
    const css = readFileSync(path, 'utf8');
    const relative = path.slice(root.length + 1);
    for (const match of css.matchAll(/--sf-icon--color:\s*([^;]+);/gu)) {
      if (!/var\(--sf-on-surface\s*\)/u.test(match[1])) continue;
      seen += 1;
      const selector = selectorsAt(css, match.index);
      if (state.test(selector)) continue;
      if (labelColourAtRest.has(relative)) continue;
      wrong.push(`${relative}: ${selector} -- ${match[1].trim()}`);
    }
  }
  assert.deepEqual(wrong, [], 'a neutral icon at rest is --sf-on-surface-icon in a control, --sf-on-surface-variant in a row');
  assert.ok(seen >= 5, `only ${seen} --sf-on-surface glyph declarations were read`);
});

test('the controls of the C107 group name their roles', () => {
  const buttons = read('component/buttons/scss/_css__buttons.scss');
  assert.match(buttons, /\.sf-button\.sf-button--tonal\.sf-button--on-surface \.sf-icon, [^{]+\{\s*--sf-icon--color: var\(--sf-on-surface-icon\);/u);
  // Hovered and pressed, the icon catches its label up (C107 (4)). The label
  // reads the state ink in the light theme and keeps --sf-on-surface in the
  // dark one (C113 follow-up: the dark fill rises, a dimmer ink fell to
  // 3.89:1), so the icon carries the same light-dark pair, never a role of
  // its own.
  for (const [state, ink] of [[':hover', 'hover'], [':active', 'active']]) {
    const pair = `light-dark\\(var\\(--sf-on-surface-${ink}\\), var\\(--sf-on-surface\\)\\)`;
    const head = `\\.sf-button\\.sf-button--tonal\\.sf-button--on-surface:not\\(:disabled\\):not\\(\\.disabled\\)${state}`;
    assert.match(buttons, new RegExp(`${head} \\.sf-icon, [^{]+\\{\\s*--sf-icon--color: ${pair};`, 'u'),
      `${ink}, the icon is the label's --sf-on-surface-${ink} (light) / --sf-on-surface (dark)`);
    assert.match(buttons, new RegExp(`${head} :is\\(\\.sf-button-text-container, \\.sf-button-shortcut\\), [^{]+\\{\\s*--sf-button-text-container--color: ${pair};`, 'u'),
      `${ink}, the label reads the same pair as its icon`);
  }
  const iconButtons = read('component/icon-buttons/scss/_css_icon_buttons.scss');
  assert.match(iconButtons, /:is\(\.sf-icon-button--tonal, \.sf-icon-button--surface\):is\(\.sf-icon-button--on-surface, \.sf-icon-button--secondary\)\.sf-icon-button--icon \{\s*--sf-icon--color: var\(--sf-icon-button-color, var\(--sf-on-surface-icon\)\);/u, 'IC-2');
  assert.match(read('component/menu/scss/_css__menu_element.scss'), /\.sf-menu-element \.sf-menu-element-icon \{\s*--sf-icon--color: var\(--sf-on-surface-variant\);/u, 'IC-1');
  assert.match(read('component/dropdown/scss/_css__custom.scss'), /\.sf-dropdown \.sf-dropdown-field > \.sf-icon-button\.sf-icon-button--on-surface\.sf-icon-button--icon \{\s*--sf-icon--color: var\(--sf-on-surface-variant\);/u, 'IC-3');
});

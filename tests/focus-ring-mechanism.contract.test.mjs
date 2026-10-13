import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// One ring for the whole system: an outline from the focus tokens, drawn on the
// element that takes focus, turned inwards when the element is flush against
// its neighbours. A shadow is not a ring — it shares its property with
// elevation and covers whatever sits next to the element.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

// High contrast draws its ring with a system colour, not with our tokens, so
// those blocks are read separately. Their extent is counted by braces rather
// than guessed by a line window.
const forcedColourLines = (source) => {
  const lines = source.split('\n');
  const inside = new Set();
  let depth = null;
  lines.forEach((line, index) => {
    if (depth === null && /@media[^{]*forced-colors/u.test(line)) {
      depth = 0;
    }
    if (depth === null) return;
    inside.add(index);
    depth += (line.match(/\{/gu) || []).length - (line.match(/\}/gu) || []).length;
    if (depth <= 0) depth = null;
  });
  return inside;
};

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(scss|css)$/u.test(entry.name)) found.push(path);
    }
  };
  for (const base of ['src/component', 'src/smart', 'src/core/scss']) {
    if (existsSync(resolve(root, base)) && statSync(resolve(root, base)).isDirectory()) walk(base);
  }
  return found;
};

// Every component draws the shared ring now, so the rule needs no list: a new
// component or a returning shadow is caught by default. Only the token
// declarations themselves still name the retired shadow, kept for products that
// set it.
const tokenDeclarations = ['src/core/figma_variables', 'src/core/scss/_sf_css__border.scss'];
const isComponent = (path) => !tokenDeclarations.some((prefix) => path.startsWith(prefix));

test('no component draws its ring with a shadow any more', () => {
  for (const path of styleFiles()) {
    if (!isComponent(path)) continue;
    const source = read(path);
    assert.doesNotMatch(
      source,
      /--sf-ui-focus(-inset)?\b/u,
      `${path}: the retired shadow ring is back in a component`,
    );

    // Watching the retired token was not enough: the tabs and the tree drew an
    // inset shadow of their own, from the current focus tokens, and passed. The
    // mechanism is what matters, so any inset shadow under a focus selector —
    // or carrying a focus token — counts as a ring drawn the wrong way.
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (!/box-shadow[^;]*inset|inset[^;]*box-shadow/u.test(line)) return;
      const selector = lines.slice(0, index).reverse().find((candidate) => candidate.includes('{')) || '';
      const aboutFocus = /focus/u.test(selector) || /--sf-focus/u.test(line);
      assert.ok(
        !aboutFocus,
        `${path}: ${line.trim()} — a ring is an outline, not an inset shadow`,
      );
    });
  }
});

test('the ring reads the focus tokens and nothing else', () => {
  const uses = [];
  for (const path of styleFiles()) {
    if (!isComponent(path)) continue;
    const source = read(path);
    const lines = source.split('\n');
    const highContrast = forcedColourLines(source);
    lines.forEach((line, index) => {
      if (!/^\s*outline:/u.test(line) || /none/u.test(line)) return;
      if (highContrast.has(index)) return;
      const selector = lines.slice(0, index).reverse().find((candidate) => candidate.includes('{')) || '';
      // A boundary drawn with an outline is judged by the rule below, not here.
      if (!/focus/u.test(selector)) return;
      uses.push([path, line.trim()]);
      // An editing canvas marks what is being edited in its own colour; it says
      // so in the file, and its width and style are still the system's.
      const editorChrome = /sf-focus-ring:\s*editor/u.test(source);
      // A ring may clamp its own width — the slider dots are too small and too
      // close together for the full one — but the colour and the style are the
      // system's, and the width still comes from the token.
      assert.match(
        line,
        editorChrome
          ? /var\(--sf-focus--width\).*var\(--sf-focus--style\)/u
          : /var\(--sf-focus--width\).*var\(--sf-focus--style\) var\(--sf-focus--color\)/u,
        `${path}: ${line.trim()} — the ring reads the shared tokens`,
      );
    });
  }
  assert.ok(uses.length >= 5, `every migrated component declares its ring (found ${uses.length})`);
});

test('an element flush against its neighbours turns the ring inwards', () => {
  for (const [path, needle] of [
    ['src/component/icon-buttons/scss/_css_icon_buttons.scss', 'segment-start'],
    ['src/component/button-group/scss/_css__button-group.scss', 'sf-button-group'],
    ['src/component/tags/scss/_css__tags.scss', 'sf-tag--removable'],
    ['src/component/dropdown/scss/_css__list-item.scss', 'role="option"'],
    ['src/component/menu/scss/_css__menu_element.scss', 'sf-menu-element'],
    ['src/component/context-menu/scss/_css__context_menu.scss', 'sf-context-menu-content'],
    ['src/component/accordion/scss/_css__accordion.scss', 'sf-accordion-trigger'],
    ['src/component/quantity/scss/_css__quantity.scss', 'sf-quantity-count'],
  ]) {
    const source = read(path);
    assert.match(source, new RegExp(needle, 'u'), `${path}: the seamless case is still described`);
    assert.match(
      source,
      /outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/u,
      `${path}: inwards by the same width, not a second ring`,
    );
  }
});

// A component may clear the outline on a part whose ring is drawn by a
// neighbour or a parent — the slider handle is one — so the pair is looked for
// across the whole component, not one file. A container that takes focus
// programmatically and wants no ring says so with a marker, so the intent is
// reviewable instead of silent.
// The rule of the system: a boundary and a ring never share the outline on one
// element. A part may keep its boundary in the outline — moving it to a border
// would resize some controls — but then the ring belongs to an element that has
// no outline of its own, usually the root. Before this, both wanted the same
// property, and in high contrast the ring simply overwrote the boundary.
test('a boundary and a ring never share the outline on one element', () => {
  const selectorsWith = (source, wantFocus) => {
    const lines = source.split('\n');
    const highContrast = forcedColourLines(source);
    const found = new Set();
    lines.forEach((line, index) => {
      if (!/^\s*outline(-offset|-color|-style|-width)?:/u.test(line)) return;
      if (/none|0;/u.test(line) || highContrast.has(index)) return;
      const selector = lines.slice(0, index).reverse().find((candidate) => candidate.includes('{'));
      if (!selector) return;
      const isFocus = /focus/u.test(selector);
      if (isFocus !== wantFocus) return;
      // The element the rule paints is the last compound of the selector.
      for (const part of selector.replace('{', '').split(',')) {
        const compound = part.trim().split(/\s+/u).pop();
        if (compound) found.add(compound.replace(/:has\([^)]*\)/gu, '').replace(/:[a-z-]+(\([^)]*\))?/gu, ''));
      }
    });
    return found;
  };

  for (const path of styleFiles()) {
    if (!isComponent(path)) continue;
    const source = read(path);
    const boundaries = selectorsWith(source, false);
    const rings = selectorsWith(source, true);
    const shared = [...rings].filter((element) => boundaries.has(element));
    assert.deepEqual(
      shared,
      [],
      `${path}: ${shared.join(', ')} draws both its boundary and its ring with the outline`,
    );
  }
});

test('the toggle ring sits on the switch and its boundary stays where it was', () => {
  const source = read('src/component/toggle/scss/_css_toggle.scss');
  // The root spans the label as well, so a ring there circles a line of text to
  // report a twenty-pixel switch. The control wrapper is the switch and nothing
  // else, and it has no outline of its own to fight over.
  assert.match(
    source,
    /\.sf-toggle:has\(input:not\(:disabled\):not\(\.disabled\):focus-visible\) \.sf-toggle-control \{[^}]*outline: var\(--sf-focus--width\)/u,
    'the ring is drawn on the control wrapper, not on the whole label',
  );
  const containerRule = source.split('\n\n').find((block) => block.trimStart().startsWith('.sf-toggle .sf-toggle-container {')) || '';
  assert.match(containerRule, /outline: var\(--sf-px\)/u, 'the container keeps its boundary in the outline');
  assert.doesNotMatch(source, /--sf-ui-focus\b/u, 'and no shadow ring is left');
});

test('an outline reset never stands alone', () => {
  const marker = /sf-focus-ring:\s*none/u;
  const componentOf = (path) => path.split('/').slice(0, 3).join('/');
  const byComponent = new Map();
  for (const path of styleFiles()) {
    const component = componentOf(path);
    if (!byComponent.has(component)) byComponent.set(component, []);
    byComponent.get(component).push(path);
  }

  const offenders = [];
  for (const [component, paths] of byComponent) {
    const sources = paths.map((path) => [path, read(path)]);
    const declaresRing = sources.some(([, source]) => /:focus-visible/u.test(source));
    for (const [path, source] of sources) {
      const clears = source.split('\n').some((line) => /^\s*outline:\s*(none|0)\s*;/u.test(line));
      if (!clears) continue;
      if (declaresRing || marker.test(source)) continue;
      offenders.push(`${path} (component ${component})`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'clearing the outline without saying where the ring is drawn takes the element away from the keyboard',
  );
});

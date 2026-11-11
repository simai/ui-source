// The pattern utility (owner decisions C57 and C60, 2026-11-11; standard
// simai.backgrounds): six static patterns, the shape a colourless mask, the
// ink a palette role or hue at a fill step of the alpha scale, the cell a
// step of the space ladder, a fade for text. The numbered SF4 tiles
// pattern-1...9 are gone; the stripes join on a transition.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const vars = read('src/utility/pattern/default/scss/_sf_var__pattern.scss');
const sheet = read('src/utility/pattern/default/scss/_sf_css__pattern.scss');
const SHAPES = ['dots', 'grid', 'cross', 'grain', 'hatch', 'checker'];
const FADES = ['none', 'spot', 'clear', 'down'];

const shapeOf = (shapes, shape) => {
  const start = shapes.indexOf(`    '${shape}': (`);
  const end = shapes.indexOf('\n    ),', start);
  assert.ok(start >= 0 && end > start, shape);
  return shapes.slice(start, end);
};
const block = (name) => {
  const start = vars.indexOf(`${name}: (`);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let at = vars.indexOf('(', start); at < vars.length; at++) {
    if (vars[at] === '(') depth++;
    if (vars[at] === ')' && --depth === 0) return vars.slice(start, at + 1);
  }
  throw new Error(name);
};

test('six shapes, each a mask tile with no colour of its own', () => {
  const shapes = block('$pattern-shapes');
  assert.deepEqual([...shapes.matchAll(/^    '([a-z]+)': \(/gmu)].map(([, name]) => name), SHAPES);
  for (const tile of shapes.matchAll(/tile: (.+),$/gmu)) {
    const colours = [...tile[1].matchAll(/#[0-9a-f]{3,8}\b|%23[0-9a-f]{3,8}\b/giu)].map(([text]) => text.replace('%23', '#'));
    // Black only; grain's noise is alpha from feColorMatrix, no colour at all.
    assert.ok(colours.every((colour) => colour === '#000'), `a tile draws in black only: ${tile[1].slice(0, 60)}`);
    assert.doesNotMatch(tile[1], /var\(--sf-(?!px)/u, 'a tile reads no colour token');
  }
  // The vector lines stay one device line thick at any cell and any scaling.
  for (const shape of ['grid', 'cross', 'hatch']) {
    const tile = shapeOf(shapes, shape);
    assert.match(tile, /vector-effect='non-scaling-stroke'/u, `${shape}: the line does not scale with the cell`);
  }
  for (const shape of ['grid', 'cross']) {
    assert.match(shapeOf(shapes, shape), /shape-rendering='crispEdges'/u, `${shape}: crisp at 125 and 150 %`);
  }
});

test('the ink is a role or a hue at a fill step of the alpha scale', () => {
  assert.match(vars, /\$pattern-strengths: \(8, 12, 16, 24\);/u);
  assert.match(vars, /\$pattern-dark-step: 8;/u);
  // Grain's colour spot stays a fill step that keeps text readable on it.
  assert.match(vars, /\$pattern-glow-steps: \(16, 8\);/u);
  // The fill family (tests/alpha-scale.contract.test.mjs): 8 ... 32.
  for (const step of [8, 12, 16, 24]) assert.ok(step + 8 <= 32);
  assert.match(sheet, /background-color: var\(--sf-pattern--color\);/u);
  assert.match(sheet, /--sf-pattern--color-#\{\$step\}: light-dark\(var\(--sf-neutral-50--alfa-#\{\$step\}\), var\(--sf-neutral-90--alfa-#\{\$step\}\)\);/u);
  assert.match(sheet, /--sf-pattern--color-#\{\$step\}: light-dark\(var\(--sf-#\{\$color\}-50--alfa-#\{\$step\}\), var\(--sf-#\{\$color\}-50--alfa-#\{\$step \+ \$pattern-dark-step\}\)\);/u);
  assert.match(sheet, /--sf-pattern--color: var\(--sf-pattern--color-12\);/u, 'the default strength is 12');
  assert.match(vars, /\$pattern-colors: list\.join\(list\.join\(\('neutral',\), \$sf-theme-hues\), list\.join\(\('error', 'warning', 'success', 'info'\), \$sf-static-hues\)\);/u);
});

test('the cell is a step of the space ladder, and a fade clears text', () => {
  const ladder = read('src/utility/padding/default/scss/_sf_var__padding.scss').match(/\$space-size-array: \(([^)]*)\)/u)[1];
  const steps = [...ladder.matchAll(/'([^']+)'/gu)].map(([, step]) => step).filter((step) => step !== '0');
  assert.deepEqual([...vars.match(/\$pattern-sizes: \(([^)]*)\)/u)[1].matchAll(/'([^']+)'/gu)].map(([, step]) => step), steps);
  assert.match(sheet, /--sf-pattern--size: var\(--sf-space-#\{\$size\}\);/u);
  const fades = block('$pattern-fades');
  assert.deepEqual([...fades.matchAll(/^    '([a-z]+)': /gmu)].map(([, name]) => name), FADES);
  // Decoration clears the centre by default (the hero: faint dots fading to
  // the centre, C57); the signs and grain cover the whole element.
  const shapes = block('$pattern-shapes');
  for (const [shape, fade] of [['dots', 'clear'], ['grid', 'clear'], ['cross', 'clear'], ['grain', 'none'], ['hatch', 'none'], ['checker', 'none']]) {
    assert.match(shapeOf(shapes, shape), new RegExp(`fade: '${fade}'`, 'u'), `${shape}: fade ${fade}`);
  }
});

test('a layer under the content: the element keeps its background', () => {
  assert.match(sheet, /:where\(#\{\$hosts\}\) \{\n    position: relative;\n    isolation: isolate;\n\}/u, 'the host is a context, at zero specificity');
  assert.match(sheet, /:is\(#\{\$hosts\}\)::before \{[^}]*z-index: -1;[^}]*pointer-events: none;[^}]*mask-image: var\(--sf-pattern--tile\), var\(--sf-pattern--fade\);[^}]*mask-composite: intersect;/u);
  assert.match(sheet, /\.pattern-grain::after \{[^}]*z-index: -2;[^}]*var\(--sf-pattern--glow\)[^}]*var\(--sf-pattern--glow-weak\)/u, 'grain only with its colour spot');
  assert.doesNotMatch(sheet, /^\s*background:/mu, 'no background shorthand');
});

test('the rule loads every class and nothing of the numbered tiles', () => {
  const source = read('src/utility/pattern/default/rule.js').match(/new RegExp\((".*")\)/u)[1];
  const rule = new RegExp(JSON.parse(source), 'u');
  const colours = ['neutral', 'primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'gray'];
  const names = [
    ...SHAPES.map((shape) => `pattern-${shape}`),
    ...colours.map((colour) => `pattern-color-${colour}`),
    ...[8, 12, 16, 24].map((step) => `pattern-strength-${step}`),
    ...['1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7', '8'].map((step) => `pattern-size-${step}`),
    ...FADES.map((fade) => `pattern-fade-${fade}`),
  ];
  assert.equal(names.length, 49);
  for (const name of names) assert.match(name, rule, name);
  for (const name of ['pattern-1', 'pattern-9', 'pattern-strength-32', 'pattern-size-0', 'pattern-color-white', 'pattern-dots ']) assert.doesNotMatch(name, rule, name);
  for (const condition of ['sm', 'md', 'lg', 'xl', 'xxl']) assert.ok(!existsSync(resolve(root, `src/utility/pattern/${condition}`)), `pattern/${condition} is gone`);
});

test('the numbered tiles are a tombstone and the stripes a transition', () => {
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const numbered = journal.records.find((record) => record.id === 'utility-c57-pattern-numbered');
  assert.equal(numbered.stage, 'removed');
  assert.deepEqual(numbered.items.map(({from}) => from), Array.from({length: 9}, (_, index) => `pattern-${index + 1}`));
  assert.ok(numbered.items.every(({to}) => SHAPES.map((shape) => `pattern-${shape}`).includes(to)));
  const stripes = journal.records.find((record) => record.id === 'utility-c60-stripe-into-pattern');
  assert.equal(stripes.stage, 'compat');
  const to = Object.fromEntries(stripes.items.map(({from, to: next}) => [from, next]));
  assert.equal(to['stripe-3'], 'pattern-grid');
  assert.equal(to['stripe-4'], 'pattern-hatch');
  // The stripes draw as before until remove_after.
  assert.match(read('src/utility/stripe/default/rule.js'), /stripe-\(\?:1\|2\|3\|4\)/u);
});

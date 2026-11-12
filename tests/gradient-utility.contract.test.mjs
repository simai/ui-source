// Gradients (owner decisions C65, 2026-11-11, C91 and C92, 2026-11-12;
// standard simai.backgrounds, Gradients): six kinds and a filled heading over
// the gradient engine, only palette tones and the alpha steps, mixed in OKLab,
// laid over a solid place; text on a picture only as the long soft scrim or
// the plate; the engine mixes in OKLab and opens the palette in from/via/to;
// the former names stay dated.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const kinds = read('src/utility/gradient/default/scss/_sf_css__gradient_kind.scss');
const kindVars = read('src/utility/gradient/default/scss/_sf_var__gradient_kind.scss');
const ruleOf = (path) => new RegExp(JSON.parse(read(path).match(/new RegExp\((".*")\)/u)[1]), 'u');
// The eleven alpha steps (C21): the state, fill and ink families.
const ALPHA = [4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 80];
const WHEEL = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink'];
const COLOURS = ['primary', 'secondary', 'tertiary', ...WHEEL, 'brown', 'gray'];

test('six kinds and their settings load by an exact rule', () => {
  const rule = ruleOf('src/utility/gradient/default/rule.js');
  const names = [
    ...['glow', 'glow-spot', 'tint', 'duo', 'cover', 'scrim', 'scrim-plate', 'fade', 'text'].map((kind) => `gradient-${kind}`),
    ...COLOURS.flatMap((colour) => [`gradient-color-${colour}`, `gradient-to-${colour}`]),
    ...[8, 12, 16, 24].map((step) => `gradient-strength-${step}`),
    ...['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl'].map((side) => `gradient-dir-${side}`),
    // .sf-hue-<c> gives the kinds their colour too, so the sheet owns those
    // selectors and its rule names them (the utility rules audit).
    ...COLOURS.map((colour) => `sf-hue-${colour}`),
  ];
  assert.equal(names.length, 78);
  for (const name of names) assert.match(name, rule, name);
  // C92: the linear 48 and the strength settings of the scrim are gone.
  for (const name of ['gradient-color-error', 'gradient-strength-32', 'gradient-scrim-48', 'gradient-scrim-64', 'gradient-scrim-80', 'gradient-glow ']) assert.doesNotMatch(name, rule, name);
});

test('the alpha kinds reach only the alpha steps, one step stronger in the dark theme', () => {
  // The step expressions in the sheet, evaluated for every strength.
  const steps = {
    'glow light': (s) => [s + 8, Math.max(4, s - 4)],
    'glow dark': (s) => [Math.min(32, s + 16), s + 4],
    'spot light': (s) => [Math.max(4, s - 4)],
    'spot dark': (s) => [s + 4],
    'tint light': (s) => [s],
    'tint dark': (s) => [s + 8],
  };
  for (const [kind, step] of Object.entries(steps)) {
    for (const strength of [8, 12, 16, 24]) {
      for (const value of step(strength)) assert.ok(ALPHA.includes(value), `${kind} at ${strength}: ${value}`);
    }
  }
  assert.match(kinds, /\$s: 'var\(--sf-gradient--strength, 16\)';/u, 'strength 16 by default');
  assert.match(kinds, /ink\(\$c, '#\{\$s\} \+ 8', 'min\(32, #\{\$s\} \+ 16\)'\)\} 0%, #\{ink\(\$c, 'max\(4, #\{\$s\} - 4\)', '#\{\$s\} \+ 4'\)\} 40%/u, 'glow');
  // The round-2 spot: one circle, straight to nothing (R160); 12 / dark 20 at 16.
  assert.match(kinds, /radial-gradient\(circle var\(--sf-gradient--spot-size, calc\(var\(--sf-space-4\) \* 2\.5\)\) at var\(--sf-gradient--spot-x, 50%\) var\(--sf-gradient--spot-y, 33%\) in oklab, #\{ink\(\$c, 'max\(4, #\{\$s\} - 4\)', '#\{\$s\} \+ 4'\)\} 0%, transparent 100%\)/u, 'spot');
  // The tint fades over a fixed length, not a share of the height (R164).
  assert.match(kinds, /ink\(\$c, \$s, '#\{\$s\} \+ 8'\)\} 0, transparent var\(--sf-gradient--tint-size, calc\(var\(--sf-space-4\) \* 6\)\)\)/u, 'tint');
  assert.match(kindVars, /\$gradient-strengths: \(8, 12, 16, 24\);/u);
  // Tone 50 of the colour mixed with transparent at the step: the alpha
  // primitive's colour, not a new one.
  assert.match(kinds, /color-mix\(in oklab, #\{\$color\} calc\(\(#\{\$light\}\) \* 1%\), transparent\)/u);
  assert.match(kinds, /--sf-gradient--from: var\(--sf-gradient--c-50, var\(--sf-primary-50\)\);/u);
});

test('the solid kinds stand on their own first colour, deeper in the dark theme', () => {
  const block = (name) => {
    const start = kinds.indexOf(`\n.${name} {`);
    assert.ok(start >= 0, name);
    return kinds.slice(start, kinds.indexOf('\n}\n', start));
  };
  const duo = block('gradient-duo');
  assert.match(duo, /--sf-gradient--from: #\{tone\('c', 40, 30, 'primary'\)\};/u);
  assert.match(duo, /--sf-gradient--to: #\{tone\('p', 40, 30, 'tertiary'\)\};/u);
  assert.match(duo, /background-color: var\(--sf-gradient--from\);/u);
  assert.match(duo, /color: var\(--sf-white\);/u);
  // The plate is a strong coloured place: white ink, the accent turned white.
  for (const line of ['--sf-surface-place-solid: var(--sf-gradient--from);', '--sf-on-surface: var(--sf-white);', '--sf-outline-variant: var(--sf-white--alfa-24);',
    '--sf-primary: var(--sf-white);', '--sf-on-primary: var(--sf-gradient--from);', '@include aliases.sf-role-aliases(places.$sf-place-aliased);']) assert.ok(duo.includes(line), line);
  const cover = block('gradient-cover');
  assert.match(cover, /--sf-gradient--from: #\{tone\('c', 90, 30, 'primary'\)\};/u);
  assert.match(cover, /--sf-gradient--to: #\{tone\('c', 80, 20, 'primary'\)\};/u);
  assert.match(cover, /background-color: var\(--sf-gradient--from\);/u);
  assert.match(cover, /color: #\{tone\('c', 10, 90, 'primary'\)\};/u);
  // The scrim (C92 look 3): black 64 held under the text, then a long ramp
  // down the alpha scale above it; the plate (look 5) is flat black 64.
  const scrim = block('gradient-scrim');
  const stops = [...scrim.matchAll(/var\(--sf-black--alfa-(\d+)\)/gu)].map(([, step]) => Number(step));
  assert.deepEqual(stops, [64, 64, 48, 28, 16, 8], 'the scrim steps, bottom to top');
  for (const step of stops) assert.ok(ALPHA.includes(step), `scrim step ${step}`);
  assert.ok(scrim.includes('var(--sf-black--alfa-64) 0%, var(--sf-black--alfa-64) calc(100% - #{$ramp})'), 'held under the text');
  assert.match(kinds, /\$ramp: 'var\(--sf-gradient--scrim-ramp, calc\(var\(--sf-space-4\) \* 4\)\)';/u, 'the ramp is four times space-4');
  assert.doesNotMatch(kinds + kindVars, /gradient-scrims|scrim-1|scrim-2|scrim-3/u, 'no strength settings of the scrim');
  const plate = kinds.slice(kinds.indexOf('.gradient-scrim.gradient-scrim-plate {'), kinds.indexOf('}', kinds.indexOf('.gradient-scrim.gradient-scrim-plate {')));
  assert.match(plate, /background-color: var\(--sf-black--alfa-64\);\n {4}background-image: none;/u, 'the plate');
  // The filled heading: tone 40 into the partner's 40, dark 80, through the
  // glyphs, the ink kept for forced colours.
  const text = block('gradient-text');
  assert.ok(text.includes("--sf-gradient--from: #{tone('c', 40, 80, 'primary')};"));
  assert.ok(text.includes("--sf-gradient--to: #{tone('p', 40, 80, 'tertiary')};"));
  assert.ok(text.includes('background-clip: text;'));
  assert.match(kinds, /@media \(forced-colors: active\) \{\n {4}\.gradient-text \{\n {8}-webkit-text-fill-color: currentColor;/u);
  // The fade is a mask, never a paint.
  assert.match(block('gradient-fade'), /mask-image: linear-gradient\(var\(--sf-gradient--angle\), var\(--sf-black\) calc\(100% - var\(--sf-gradient--fade-size, var\(--sf-space-4\)\)\), transparent\);/u);
  assert.doesNotMatch(block('gradient-fade'), /background/u);
});

test('the hue comes from .sf-hue-* or gradient-color-*, the partner is a neighbour', () => {
  assert.match(kinds, /\.sf-hue-#\{\$color\}, \.gradient-color-#\{\$color\} \{/u);
  assert.ok(kinds.indexOf('.gradient-to-#{$color}') > kinds.indexOf('.sf-hue-#{$color}, .gradient-color-#{$color}'), 'gradient-to after the colour');
  // The partner rule, as the sheet's function computes it.
  const partner = (colour) => {
    if (colour === 'primary') return 'tertiary';
    if (colour === 'secondary' || colour === 'tertiary') return 'primary';
    if (colour === 'brown') return 'orange';
    if (colour === 'gray') return 'blue';
    return WHEEL[(WHEEL.indexOf(colour) + 2) % WHEEL.length];
  };
  for (const colour of WHEEL) {
    const distance = Math.abs(WHEEL.indexOf(partner(colour)) - WHEEL.indexOf(colour));
    assert.ok(Math.min(distance, WHEEL.length - distance) <= 2, `${colour}: a neighbour`);
  }
  assert.match(kindVars, /@return list\.nth\(\$gradient-wheel, \(\$at \+ 1\) % list\.length\(\$gradient-wheel\) \+ 1\);/u);
});

test('the engine mixes in OKLab and keeps the plain gradient first', () => {
  const mixin = read('src/utility/gradient-type/default/scss/_sf_mix__gradient.scss');
  assert.match(mixin, /#\{\$property\}: #\{\$function\}\(#\{\$lead\}, #\{\$stops\}\);\n {8}#\{\$property\}: #\{\$function\}\(#\{\$lead\} in oklab, #\{\$stops\}\);/u);
  for (const condition of ['default', 'sm', 'md', 'lg', 'xl', 'xxl']) {
    const sheet = read(`src/utility/gradient-type/${condition}/scss/_sf_css__gradient.scss`);
    for (const name of ['gr-line-2', 'gr-line-3', 'gr-radial-2', 'gr-radial-3', 'gr-conic-2', 'gr-conic-3']) {
      assert.match(sheet, new RegExp(`\\.#\\{\\$infix\\}${name} \\{ @include sf-gradient-image\\(`, 'u'), `${condition} ${name}`);
    }
  }
  assert.match(read('src/utility/background-gradient/default/scss/_sf_css__background_gradient.scss'), /@include sf-gradient-image\(linear-gradient, \$direction, \$stops\);/u);
});

test('from, via and to open the palette; the former names stay until remove_after', () => {
  const rule = ruleOf('src/utility/gradient-stops/default/rule.js');
  for (const name of ['from-teal-40', 'via-primary-90', 'to-error-50', 'from-error', 'to-white', 'from-black', 'via-surface-card', 'to-surface-popup', 'from-surface-inverse',
    'from-surface-0', 'via-surface-1', 'to-surface-2', 'from-surface-page', 'to-info']) {
    assert.match(name, rule, name);
  }
  assert.doesNotMatch('from-teal-45', rule);
  assert.match(read('src/utility/gradient-stops/default/scss/_sf_var__gradient_stops.scss'), /\$stops: former\.\$gradient-color-array;/u, 'the former list first, unchanged');
  const gr = ruleOf('src/utility/gradient-color/default/rule.js');
  for (const name of ['gr1-primary', 'gr2-surface-0', 'gr3-warning']) assert.match(name, gr, name);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find(({id}) => id === 'utility-c65-gradient-names');
  assert.equal(record.stage, 'compat');
  const to = Object.fromEntries(record.items.map(({from, to: next}) => [from, next]));
  assert.equal(to['gr1-*'], 'from-*');
  assert.equal(to['gr2-*'], 'via-*');
  assert.equal(to['gr3-*'], 'to-*');
  assert.equal(to['from-surface-0'], 'from-surface-page');
  assert.equal(to['to-surface-1'], 'to-surface-area');
  assert.equal(to['via-surface-2'], null);
});

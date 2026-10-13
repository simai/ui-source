import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// One scale of transparency, in three families, and nothing outside it.
//
//   state   4, 8, 12          what a pointer does to a surface: hover, select,
//                             press. The same step in both themes, because the
//                             gesture is the same gesture.
//   fill    12, 16, 20        a tinted plate on a light surface, and the two
//           24, 28, 32        steps its own hover and press take; the dark
//                             theme sits twelve higher, where the same tint
//                             over a dark surface reads as the same plate.
//   ink     48, 64, 80        what is read or found: the boundary of a control,
//                             the ink and the line of a disabled one.
//
// The run climbs in fours up to 32 and then takes three long steps, because
// below 32 the question is how much of a tint shows through, and above it the
// question is how legible a line is -- and legibility does not move in fours.
//
// The scale had seventeen steps before 2026-10-08. Six of them -- 10, 15, 30,
// 36, 40, 44 -- were declared and asked for by nothing at all, and a seventh
// pair (2 and 6) sat off the footing of fours in the neutral half. Fifty
// primitives went with them. What is left is what something draws with.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const SCALE = [4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 80];

const sources = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return sources(path);
  return ['.scss', '.css', '.js', '.mjs', '.json', '.html'].includes(extname(entry.name)) ? [path] : [];
});

const palettePath = 'src/core/scss/_sf_figma_colors_variables.scss';
const themePath = 'src/core/scss/_sf_css__theme.scss';

test('every alpha primitive is a step of the scale', () => {
  const declared = [...read(palettePath).matchAll(/(--sf-[a-z0-9-]+)--alfa-(\d+):/gu)];
  const offenders = declared
    .filter(([, , step]) => !SCALE.includes(Number(step)))
    .map(([, tone, step]) => `${tone}--alfa-${step}`);
  assert.deepEqual(offenders, [], 'a step nobody can derive is a value invented at the point of use');
  assert.ok(declared.length >= 90, `only ${declared.length} alpha primitives were read`);
});

test('every alpha primitive is drawn with', () => {
  const declared = new Set([...read(palettePath).matchAll(/(--sf-[a-z0-9-]+--alfa-\d+):/gu)].map(([, name]) => name));
  const used = new Set();
  for (const path of sources(resolve(root, 'src'))) {
    if (!statSync(path).isFile() || path.endsWith('_sf_figma_colors_variables.scss')) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/--sf-[a-z0-9-]+--alfa-\d+/gu)) used.add(match[0]);
  }
  const unused = [...declared].filter((name) => !used.has(name)).sort();
  // A palette is read as the set of answers the system has. One that carries
  // fifty values nothing draws with is a palette that cannot be read at all.
  assert.deepEqual(unused, [], 'an alpha primitive nothing asks for is a step a reader has to rule out by hand');
});

test('an alpha primitive carries the opacity its name gives', () => {
  const wrong = [];
  for (const [, tone, step, hex] of read(palettePath).matchAll(/(--sf-[a-z0-9-]+)--alfa-(\d+): (#[0-9a-f]{8});/gu)) {
    const expected = Math.round((Number(step) / 100) * 255);
    const actual = parseInt(hex.slice(7, 9), 16);
    // One off is the rounding of a hand-written hex, and is allowed; more is a
    // step whose name and value disagree, which no measurement would catch.
    if (Math.abs(actual - expected) > 1) wrong.push(`${tone}--alfa-${step}: ${hex} is ${Math.round(actual / 255 * 100)}%`);
  }
  assert.deepEqual(wrong, [], 'the name of a step is the opacity it carries');
});

test('the neutral half of the scale shares its steps', () => {
  const neutral = [...read(themePath).matchAll(/--sf-alpha-(\d+): color-mix/gu)].map(([, step]) => Number(step));
  assert.ok(neutral.length, 'the neutral ramp is declared');
  assert.deepEqual(neutral.filter((step) => !SCALE.includes(step)), [],
    'the tinted and the neutral halves are one scale and take the same steps');
  const used = new Set();
  for (const path of sources(resolve(root, 'src'))) {
    if (!statSync(path).isFile() || path.endsWith('_sf_css__theme.scss')) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/var\(--sf-alpha-(\d+)\)/gu)) used.add(Number(match[1]));
  }
  assert.deepEqual(neutral.filter((step) => !used.has(step)), [],
    'a neutral step nothing asks for is one more thing to rule out');
});

test('every translucent surface is mixed from the theme neutral, and the veil from the pure base', () => {
  const theme = read(themePath);
  const value = (role) => (theme.match(new RegExp(`--sf-${role}: ([^;]+);`, 'u')) ?? [])[1]?.trim() ?? null;

  // One tone for every surface a pointer touches or a plate sits on:
  // neutral-50 in the light theme, neutral-90 in the dark. The plate used to be
  // neutral-50 in both, and in the dark it had to take 24, 28 and 32 to catch
  // up with a tone that was too dark for the job -- so the same interface was
  // lightened by two different greys, and the steps could not match across
  // themes (owner, 2026-10-08).
  const surfaces = {
    'surface-transparent-hover': 4,
    'surface-transparent-select': 8,
    'surface-transparent-overlay': 32,
    'surface-container': 16,
    'surface-container-hover': 20,
    'surface-container-active': 24,
  };
  const wrong = [];
  for (const [role, step] of Object.entries(surfaces)) {
    const expected = `light-dark(var(--sf-neutral-50--alfa-${step}), var(--sf-neutral-90--alfa-${step}))`;
    if (value(role) !== expected) wrong.push(`${role}: ${value(role)}`);
  }
  assert.deepEqual(wrong, [], 'a translucent surface takes one step of one tone per theme');

  // The plate starts at 16 because at 12 it was the colour of a pressed
  // surface, and a plate that cannot be told from a press is not a plate.
  assert.notEqual(surfaces['surface-container'], surfaces['surface-transparent-select']);
  assert.ok(surfaces['surface-container'] > surfaces['surface-transparent-select']);
  // And the veil is above every plate: a plate sits on the page, a veil covers
  // it. At 24 the backdrop of a modal was the colour of a pressed card.
  assert.ok(surfaces['surface-transparent-overlay'] > surfaces['surface-container-active']);
  // No two surface roles share a value: each is a different thing to see.
  const steps = Object.values(surfaces);
  assert.equal(new Set(steps).size, steps.length, `two surface roles share a step: ${steps}`);

  // The veil is the exception, and it is one on purpose: it darkens a scene
  // rather than tinting a surface. On the neutral tone it came out 7.4 points
  // lighter in the light theme -- a veil that does not veil.
  assert.equal(value('surface-overlay'),
    'light-dark(var(--sf-black--alfa-8), var(--sf-white--alfa-8))');
});

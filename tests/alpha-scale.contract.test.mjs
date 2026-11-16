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
//   fill    8, 12, 16, 24     the neutral plate (surface-container), its hover
//                             and press, and the strong step -- the same in
//                             both themes (C41, owner 2026-11-10).
//           12, 16, 20        a tinted plate on a light surface, and the two
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
    if (!statSync(path).isFile() || path.endsWith('_sf_figma_colors_variables.scss') || path.endsWith('token-aliases.v1.json')) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/--sf-[a-z0-9-]+--alfa-\d+/gu)) used.add(match[0]);
  }
  // A strong coloured place's ink (mix/_mix__places.scss sf-ink) names its
  // steps by interpolation, --sf-#{$c}-20--alfa-#{$step}: the palettes are
  // $sf-place-colours and the steps those its sf-ink calls ask for, so those
  // names are read too (C16 with C17's tone-20 steps).
  const places = read('src/core/scss/mix/_mix__places.scss');
  assert.match(places, /var\(--sf-#\{\$c\}-20--alfa-#\{\$step\}\)/u, 'sf-ink reads the tone-20 steps');
  const placeColours = [...places.match(/\$sf-place-colours:\s*\(([^)]*)\)/u)[1].matchAll(/'([a-z]+)'/gu)].map(([, name]) => name);
  const inkSteps = new Set([...places.matchAll(/sf-ink\(\$c, (\d+)\)/gu)].map(([, step]) => step));
  for (const colour of placeColours) for (const step of inkSteps) used.add(`--sf-${colour}-20--alfa-${step}`);
  // The shadow system (C20) left two steps of black unread; they stay, by name
  // and with a reason, until the alias list's remove_after -- a page or a
  // product may have written them (token-aliases.v1.json, shadows).
  // The background system's values (C16 S3) left two more: the dark
  // boundary's former step and the former skeleton's.
  const aliases = JSON.parse(read('src/core/contracts/token-aliases.v1.json'));
  // The palette's former tone primitives (C17) are dated aliases of the hues:
  // a page may have written them, so they stay declared until remove_after.
  const formerTones = (aliases.palette_tokens ?? []).map(({from}) => from).filter((name) => /--alfa-\d+$/u.test(name));
  const kept = new Set([...[...aliases.shadows.primitives_kept, ...(aliases.primitives_kept ?? [])].map(({name}) => name), ...formerTones]);
  for (const name of kept) assert.ok(declared.has(name) && !used.has(name), `${name}: kept for consumers, so declared and read by nothing in src`);
  const unused = [...declared].filter((name) => !used.has(name) && !kept.has(name)).sort();
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
  // Since DEV acceptance 2026-11-10 Q3 the components read the surface roles
  // of these steps, so no Framework source asks for the neutral ramp. It stays
  // declared: it is a public token (ui-doc guide/colour/transparency and
  // design-tokens) a project may read. No component may go back to it.
  assert.deepEqual([...used], [], 'the components read the surface roles, not --sf-alpha-*');
  assert.deepEqual(neutral, [4, 8, 12, 16], 'the public neutral ramp keeps its four steps');
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
  // The neutral fill takes the fill family's first steps, 12/16/20 and 24
  // strong, in both themes (C113, owner 2026-11-13; was 8/12/16 since C41):
  // the weight of the coloured containers, and no "+12 dark" for grey 90.
  const surfaces = {
    'surface-state-hover': 4,
    'surface-state-select': 8,
    'surface-state-active': 12,
    'surface-container-strong': 24,
    'surface-container': 12,
    'surface-container-hover': 16,
    'surface-container-active': 20,
  };
  const wrong = [];
  for (const [role, step] of Object.entries(surfaces)) {
    const expected = `light-dark(var(--sf-neutral-50--alfa-${step}), var(--sf-neutral-90--alfa-${step}))`;
    if (value(role) !== expected) wrong.push(`${role}: ${value(role)}`);
  }
  assert.deepEqual(wrong, [], 'a translucent surface takes one step of one tone per theme');

  // The plate is the pressed state's step, 12. C113 accepts the overlap, as
  // C41 did with 8: a state is drawn over a plate, not instead of it, and a
  // chosen row is primary-container, not grey (C23).
  // What stays apart: the plate is above the hover state, the pressed plate is
  // above every state, and the strong step is above every plate.
  assert.equal(surfaces['surface-container'], surfaces['surface-state-active']);
  assert.ok(surfaces['surface-container'] > surfaces['surface-state-hover']);
  assert.ok(surfaces['surface-container-active'] > surfaces['surface-state-active']);
  // And the veil is above every plate: a plate sits on the page, a veil covers
  // it. At 24 the backdrop of a modal was the colour of a pressed card.
  assert.ok(surfaces['surface-container-strong'] > surfaces['surface-container-active']);
  // The plate family has four different steps: each is a different thing to see.
  const plates = ['surface-container', 'surface-container-hover', 'surface-container-active', 'surface-container-strong'].map((role) => surfaces[role]);
  assert.equal(new Set(plates).size, plates.length, `two plate roles share a step: ${plates}`);

  // The veil is the exception, and it is one on purpose: it darkens a scene
  // rather than tinting a surface. On the neutral tone it came out 7.4 points
  // lighter in the light theme -- a veil that does not veil.
  assert.equal(value('surface-veil'),
    'light-dark(var(--sf-black--alfa-8), var(--sf-white--alfa-8))');
});

const placesPath = 'src/core/scss/_sf_css__surface_places.scss';
// Ink steps as a fill (C16, 2026-11-08): 48, 64 and 80 are what is read or
// found. As the colour of a surface they are allowed for glass over media and
// for the scrim, and for nothing else -- a plate at 48 is a veil, not a plate.
test('an ink step (48 and above) is a fill only for glass and the scrim', () => {
  const placesPath = 'src/core/scss/_sf_css__surface_places.scss';
  const allowed = new Set(['--sf-surface-media', '--sf-surface-media-hover', '--sf-surface-media-active', '--sf-scrim-color']);
  const wrong = [];
  // The skeletons are a fill since C16 S3 (16 and 24), no longer ink 48.
  for (const path of [themePath, placesPath, 'src/core/scss/_sf_css__placeholder.scss', 'src/core/figma_variables/figma_layer_styles.scss', 'src/component/skeleton/scss/_skeleton.scss']) {
    for (const [, name, value] of read(path).matchAll(/(--sf-[a-z0-9-]+):\s*([^;]+);/gu)) {
      // A place's ink hook (--sf-place--ink, --sf-place--ink-variant) is the colour of
      // text on the place, not a fill: glass dims its text with white at 80.
      if (name.startsWith('--sf-on-') || name.startsWith('--sf-place--ink') || name.includes('outline') || name.startsWith('--sf-alpha')) continue;
      if (!/--alfa-(48|64|80)\b/u.test(value)) continue;
      if (!allowed.has(name)) wrong.push(`${path}: ${name}: ${value.trim()}`);
    }
  }
  assert.deepEqual(wrong, [], 'an ink step as a fill is glass or the scrim');
});

// A fill on a coloured place (C16, owner 2026-11-08): on a strong colour the
// control fill is the place's ink at 12, 16 and 20 -- the neutral plate's steps
// since C113 (it was a named exception to C41's 8/12/16), because white at 16 already gave 4.40 on a
// near-grey header (surfaces research 4.1). 12 there equals the pressed state;
// the two are never next to each other. The states stay 4/8/12, the line 24,
// the boundary 64 and the dim ink 80.
test('a strong coloured place fills at 12, 16 and 20 of its ink, and nothing else is off the neutral steps', () => {
  const mix = read('src/core/scss/mix/_mix__places.scss');
  const strong = mix.slice(mix.indexOf('@mixin sf-place-strong'));
  const step = (role) => Number((strong.match(new RegExp(`--sf-${role}: #\\{sf-ink\\(\\$c, (\\d+)\\)\\}`, 'u')) ?? [])[1]);
  assert.deepEqual(['surface-container', 'surface-container-hover', 'surface-container-active'].map(step), [12, 16, 20]);
  assert.deepEqual(['surface-state-hover', 'surface-state-select', 'surface-state-active'].map(step), [4, 8, 12]);
  assert.deepEqual(['outline-variant', 'outline', 'on-surface-variant'].map(step), [24, 64, 80]);
  for (const value of [...strong.matchAll(/sf-ink\(\$c, (\d+)\)/gu)].map(([, n]) => Number(n))) assert.ok(SCALE.includes(value), `${value} is a step of the scale`);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {AVATAR_TONES, avatarTone, avatarToneHash} from '../src/smart/avatar/js/tone.mjs';
import {TonalPalette} from '../src/core/js/vendor/material-color-utilities/palettes/tonal_palette.js';
import {hexFromArgb} from '../src/core/js/vendor/material-color-utilities/utils/string_utils.js';

// The tones of initials (UI Chat, owner decision q-4f91278cc7): people recognise
// conversations by avatars, and the Framework gets the palette so no product
// invents one. A server prints the class from the same algorithm, so the vectors
// below are the contract: changing one moves every person's colour in every
// product. Measured in a browser by tests/browser/avatar-tones.browser.mjs.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const TONES = ['rose', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'violet'];
const HUES = {rose: 5, amber: 65, lime: 110, green: 150, teal: 190, sky: 245, indigo: 285, violet: 325};

// Name, FNV-1a 32 over its UTF-8 bytes with the high half folded in, tone. The
// third and fourth are Cyrillic, the fifth takes four UTF-8 bytes; the same
// values came out of the Python and PHP forms the documentation gives.
const VECTORS = [
  ['a', 3826044192, 'rose'],
  ['Boris Ilyin', 3558918407, 'violet'],
  ['Анна Захарова', 3082087281, 'amber'],
  ['Анна Белова', 1238467563, 'green'],
  ['\u{1F600} Emoji', 950777869, 'sky'],
  ['Rosa Moreno', 1151840027, 'green'],
];

test('the hash gives the documented value and tone for every vector', () => {
  for (const [name, hash, tone] of VECTORS) {
    assert.equal(avatarToneHash(name), hash, name);
    assert.equal(avatarTone(name), tone, name);
  }
});

test('the hash reads the string as given, and no name means no tone', () => {
  for (const nothing of ['', undefined, null]) assert.equal(avatarTone(nothing), '');
  assert.notEqual(avatarToneHash('Boris Ilyin'), avatarToneHash(' Boris Ilyin'));
  assert.notEqual(avatarToneHash('Boris Ilyin'), avatarToneHash('boris ilyin'));
  for (const [name] of VECTORS) assert.equal(avatarTone(name), avatarTone(name));
});

test('the tones spread evenly over names of people', () => {
  const first = ['Anna', 'Maria', 'Elena', 'Olga', 'Ivan', 'Sergey', 'Alexey', 'Andrey', 'Dmitry', 'Mikhail', 'Pavel',
    'Boris', 'Vera', 'John', 'Mary', 'Ahmed', 'Li', 'Wei', 'Sofia', 'Lucas', 'Emma', 'Noah'];
  const last = ['Ivanova', 'Petrov', 'Smirnova', 'Kuznetsov', 'Popova', 'Sokolov', 'Lebedeva', 'Kozlov', 'Novikova',
    'Morozov', 'Smith', 'Johnson', 'Brown', 'Garcia', 'Lee', 'Kim', 'Chen', 'Patel'];
  const counts = Object.fromEntries(TONES.map((tone) => [tone, 0]));
  for (const one of first) for (const two of last) counts[avatarTone(`${one} ${two}`)] += 1;
  const fair = (first.length * last.length) / TONES.length;
  for (const [tone, count] of Object.entries(counts)) {
    assert.ok(count > fair * 0.6 && count < fair * 1.4, `${tone} took ${count} of ${first.length * last.length}`);
  }
});

test('one list of tones: the module, the setting, the sheet and the documentation', () => {
  assert.deepEqual([...AVATAR_TONES], TONES, 'the order is part of the algorithm');
  assert.ok(Object.isFrozen(AVATAR_TONES));
  const setting = JSON.parse(read('src/smart/avatar/component.json')).settings.tone;
  assert.equal(setting.type, 'enum');
  assert.equal(setting.default, '');
  assert.deepEqual(setting.values, ['', 'auto', ...TONES]);

  const sheet = read('src/component/avatars/scss/_css__avatars.scss');
  const docs = read('src/smart/avatar/docs/docs.md');
  for (const tone of TONES) {
    assert.ok(sheet.includes(`.sf-avatar--text.sf-avatar--tone-${tone} {`), tone);
    assert.ok(sheet.includes(`var(--sf-avatar-background-color, var(--sf-tone-${tone}-container))`), tone);
    assert.ok(sheet.includes(`var(--sf-avatar-color, var(--sf-on-tone-${tone}-container))`), tone);
    assert.ok(docs.includes(`\`${tone}\``), tone);
  }
  // The tone class sits only with initials: a plain image or placeholder that
  // carries one stays as it is, and the sheet's only tone rules are these.
  assert.deepEqual([...new Set([...sheet.matchAll(/([^\s{}]*sf-avatar--tone-[a-z]+)/gu)].map(([, selector]) => selector))].sort(),
    TONES.map((tone) => `.sf-avatar--text.sf-avatar--tone-${tone}`).sort());
});

test('the documentation states the algorithm a server needs', () => {
  const docs = read('src/smart/avatar/docs/docs.md');
  for (const word of ['UTF-8', 'FNV-1a', '2166136261', '16777619', 'hash >> 16', 'hash mod 8', 'heading', 'aria-label']) {
    assert.ok(docs.includes(word), word);
  }
  assert.match(docs, /`Boris Ilyin` is `violet`/u);
});

test('a tone adds no raw colour to the component sheet and no value outside the palette', () => {
  const sheet = read('src/component/avatars/scss/_css__avatars.scss');
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|color-mix\(/iu);

  const palette = read('src/core/scss/_sf_figma_colors_variables.scss');
  const theme = read('src/core/scss/_sf_css__theme.scss');
  for (const tone of TONES) {
    // The palette step is the generator's tone of the hue, so a value cannot drift by hand.
    const made = TonalPalette.fromHueAndChroma(HUES[tone], 48);
    const hex = (step) => hexFromArgb(made.tone(step));
    assert.ok(palette.includes(`--sf-tone-${tone}-50--alfa-20: ${hex(50)}33;`), `${tone} fill, light`);
    assert.ok(palette.includes(`--sf-tone-${tone}-50--alfa-32: ${hex(50)}52;`), `${tone} fill, dark`);
    assert.ok(palette.includes(`--sf-tone-${tone}-30: ${hex(30)};`), `${tone} ink, light`);
    assert.ok(palette.includes(`--sf-tone-${tone}-85: ${hex(85)};`), `${tone} ink, dark`);
    // Fill family of the alpha scale: the dark theme sits twelve higher.
    assert.ok(theme.includes(`--sf-tone-${tone}-container: light-dark(var(--sf-tone-${tone}-50--alfa-20), var(--sf-tone-${tone}-50--alfa-32));`), tone);
    assert.ok(theme.includes(`--sf-on-tone-${tone}-container: light-dark(var(--sf-tone-${tone}-30), var(--sf-tone-${tone}-85));`), tone);
  }
});

test('the element takes a tone only for initials, and the default draws no tone class', () => {
  const element = read('src/smart/avatar/index.js');
  const shared = read('src/smart/avatar/js/templates/shared.js');
  assert.match(element, /if \(!tone \|\| !this\.isText\)/u);
  assert.match(element, /resolvedTone: this\.resolvedTone/u);
  assert.match(element, /avatarTone\(\s*this\.heading \|\| this\.getAttribute\("aria-label"\) \|\| this\.text,?\s*\)/u);
  assert.match(shared, /if \(context\.resolvedTone\) \{\s*classes\.push\(`sf-avatar--tone-\$\{context\.resolvedTone\}`\)/u);
  assert.equal([...shared.matchAll(/sf-avatar--tone-/gu)].length, 1);
});

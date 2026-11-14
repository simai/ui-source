import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {AVATAR_HUES, AVATAR_TONES, STATIC_HUES as AVATAR_STATIC_HUES, avatarHue, avatarTone, avatarToneHash, resolveAvatarHue, resolveAvatarTone} from '../src/smart/avatar/js/tone.mjs';
import {STATIC_HUE_NAMES} from '../src/core/js/theme-palette.js';

// The hues of initials (UI Chat, owner decision q-4f91278cc7; owner decision
// C17, 2026-11-08): people recognise conversations by avatars, and the
// Framework gives the colour so no product invents one -- since C17 a hue of
// the static palette, not a set of tones of the avatar's own. A server prints
// the class from the same algorithm, so the vectors below are the contract:
// changing one moves every person's colour in every product. Measured in a
// browser by tests/browser/avatar-tones.browser.mjs.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const HUES = ['pink', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'purple'];
const TONES = ['rose', 'amber', 'lime', 'green', 'teal', 'sky', 'indigo', 'violet'];

// Name, FNV-1a 32 over its UTF-8 bytes with the high half folded in, tone. The
// third and fourth are Cyrillic, the fifth takes four UTF-8 bytes; the same
// values came out of the Python and PHP forms the documentation gives.
const VECTORS = [
  ['a', 3826044192, 'pink'],
  ['Boris Ilyin', 3558918407, 'purple'],
  ['Анна Захарова', 3082087281, 'amber'],
  ['Анна Белова', 1238467563, 'green'],
  ['\u{1F600} Emoji', 950777869, 'sky'],
  ['Rosa Moreno', 1151840027, 'green'],
];

test('the hash gives the documented value and hue for every vector, and a name keeps its slot', () => {
  for (const [name, hash, hue] of VECTORS) {
    assert.equal(avatarToneHash(name), hash, name);
    assert.equal(avatarHue(name), hue, name);
    // The former tone of the name is the same slot (rose is pink).
    assert.equal(TONES[HUES.indexOf(hue)], avatarTone(name), name);
  }
});

test('the hash reads the string as given, and no name means no tone', () => {
  for (const nothing of ['', undefined, null]) assert.equal(avatarHue(nothing), '');
  assert.notEqual(avatarToneHash('Boris Ilyin'), avatarToneHash(' Boris Ilyin'));
  assert.notEqual(avatarToneHash('Boris Ilyin'), avatarToneHash('boris ilyin'));
  for (const [name] of VECTORS) assert.equal(avatarHue(name), avatarHue(name));
});

test('a setting resolves to itself, to the hue of the name, or to nothing; the former tone is read when hue is empty', () => {
  assert.equal(resolveAvatarHue('teal', 'Boris Ilyin'), 'teal');
  assert.equal(resolveAvatarHue('cyan', 'Boris Ilyin'), 'cyan', 'any static hue, not only the eight of auto');
  assert.equal(resolveAvatarHue('auto', 'Boris Ilyin'), 'purple');
  assert.equal(resolveAvatarHue('auto', ''), '');
  assert.equal(resolveAvatarHue('', 'Boris Ilyin'), '');
  assert.equal(resolveAvatarHue(undefined, 'Boris Ilyin'), '');
  assert.equal(resolveAvatarHue('mauve', 'Boris Ilyin'), '', 'a name the palette does not have');
  assert.equal(resolveAvatarHue('', 'Boris Ilyin', 'rose'), 'pink');
  assert.equal(resolveAvatarHue('', 'Boris Ilyin', 'teal'), 'teal');
  assert.equal(resolveAvatarHue('', 'Boris Ilyin', 'auto'), 'purple');
  assert.equal(resolveAvatarHue('green', 'Boris Ilyin', 'rose'), 'green', 'hue wins over the former name');
  assert.equal(resolveAvatarTone('auto', 'Boris Ilyin'), 'violet', 'the former function still answers');
});

test('the tones spread evenly over names of people', () => {
  const first = ['Anna', 'Maria', 'Elena', 'Olga', 'Ivan', 'Sergey', 'Alexey', 'Andrey', 'Dmitry', 'Mikhail', 'Pavel',
    'Boris', 'Vera', 'John', 'Mary', 'Ahmed', 'Li', 'Wei', 'Sofia', 'Lucas', 'Emma', 'Noah'];
  const last = ['Ivanova', 'Petrov', 'Smirnova', 'Kuznetsov', 'Popova', 'Sokolov', 'Lebedeva', 'Kozlov', 'Novikova',
    'Morozov', 'Smith', 'Johnson', 'Brown', 'Garcia', 'Lee', 'Kim', 'Chen', 'Patel'];
  const counts = Object.fromEntries(HUES.map((hue) => [hue, 0]));
  for (const one of first) for (const two of last) counts[avatarHue(`${one} ${two}`)] += 1;
  const fair = (first.length * last.length) / HUES.length;
  for (const [tone, count] of Object.entries(counts)) {
    assert.ok(count > fair * 0.6 && count < fair * 1.4, `${tone} took ${count} of ${first.length * last.length}`);
  }
});

test('one list of hues: the module, the palette, the setting, the sheet and the documentation', () => {
  assert.deepEqual([...AVATAR_HUES], HUES, 'the order is part of the algorithm');
  assert.deepEqual([...AVATAR_TONES], TONES, 'the former names, slot for slot');
  assert.deepEqual([...AVATAR_STATIC_HUES], [...STATIC_HUE_NAMES], 'the element knows the static palette');
  assert.ok(Object.isFrozen(AVATAR_HUES));
  const settings = JSON.parse(read('src/smart/avatar/component.json')).settings;
  assert.equal(settings.hue.type, 'enum');
  assert.equal(settings.hue.default, '');
  assert.deepEqual(settings.hue.values, ['', 'auto', ...STATIC_HUE_NAMES]);
  assert.deepEqual(settings.tone.values, ['', 'auto', ...TONES], 'the former setting keeps its values until it goes');

  const sheet = read('src/component/avatars/scss/_css__avatars.scss');
  const docs = read('src/smart/avatar/docs/docs.md');
  assert.match(sheet, /\.sf-avatar--text:is\(#\{\$sf-avatar-hue-classes\}\) \{\s*--sf-avatar--background-color: var\(--sf-avatar-background-color, var\(--sf-hue-container\)\);\s*--sf-avatar--color: var\(--sf-avatar-color, var\(--sf-on-hue-container\)\);/u);
  assert.match(sheet, /@use '\.\.\/\.\.\/\.\.\/core\/scss\/vars\/sf_var__hue' as \*;/u, 'the class list is the palette\'s');
  for (const hue of HUES) assert.ok(docs.includes(`\`${hue}\``), hue);
  // The former classes still draw, each from its former role, until they go.
  for (const tone of TONES) {
    assert.ok(sheet.includes(`.sf-avatar--text.sf-avatar--tone-${tone} {`), tone);
    assert.ok(sheet.includes(`var(--sf-avatar-background-color, var(--sf-tone-${tone}-container))`), tone);
  }
});

test('the documentation states the algorithm a server needs', () => {
  const docs = read('src/smart/avatar/docs/docs.md');
  for (const word of ['UTF-8', 'FNV-1a', '2166136261', '16777619', 'hash >> 16', 'hash mod 8', 'heading', 'aria-label']) {
    assert.ok(docs.includes(word), word);
  }
  assert.match(docs, /`Boris Ilyin` is `purple`/u);
});

test('a hue adds no raw colour to the component sheet; the former tone roles hold their hue\'s container', () => {
  const sheet = read('src/component/avatars/scss/_css__avatars.scss');
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|color-mix\(/iu);
  const theme = read('src/core/scss/_sf_css__theme.scss');
  for (const [index, tone] of TONES.entries()) {
    const hue = HUES[index];
    assert.ok(theme.includes(`--sf-tone-${tone}-container: light-dark(var(--sf-${hue}-50--alfa-12), var(--sf-${hue}-50--alfa-24));`), tone);
    assert.ok(theme.includes(`--sf-on-tone-${tone}-container: light-dark(var(--sf-${hue}-10), var(--sf-${hue}-90));`), tone);
  }
  const hues = read('src/core/scss/_sf_css__hue.scss');
  assert.match(hues, /--sf-hue-container: light-dark\(var\(--sf-#\{\$hue\}-50--alfa-12\), var\(--sf-#\{\$hue\}-50--alfa-24\)\);/u);
  assert.match(hues, /--sf-on-hue-container: light-dark\(var\(--sf-#\{\$hue\}-10\), var\(--sf-#\{\$hue\}-90\)\);/u);
});

test('the element takes a hue only for initials, and the default draws no hue class', () => {
  const element = read('src/smart/avatar/index.js');
  // The picture's classes are the one avatar drawing (js/picture.js, AV-8).
  const shared = read('src/smart/avatar/js/picture.js');
  assert.match(element, /if \(!this\.isText\) \{\s*return "";/u);
  assert.match(element, /resolvedHue: this\.resolvedHue/u);
  // The card without a photo takes auto when no hue is set (C124); the round
  // avatar's default stays neutral.
  assert.match(element, /const cardDefault =\s*this\.templateName === "card" && !this\.hue && !this\.tone \? "auto" : "";/u);
  assert.match(element, /resolveAvatarHue\(\s*this\.hue \|\| cardDefault,\s*this\.heading \|\| this\.getAttribute\("aria-label"\) \|\| this\.text,\s*this\.tone,?\s*\)/u);
  assert.match(shared, /if \(context\.resolvedHue\) \{\s*classes\.push\(`sf-hue-\$\{context\.resolvedHue\}`\)/u);
  assert.equal([...shared.matchAll(/sf-avatar--tone-/gu)].length, 0);
});

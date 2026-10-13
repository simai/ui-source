import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Two systems, and everything else built out of them.
//
// The Framework has exactly two places where a value is invented: the colour
// primitives and the size ladder. A palette step and a ladder step are the
// only tokens allowed to say a number out loud. Every other token -- a role, a
// component token, a utility token -- names one of them.
//
// That had always been the rule and had never been checked, so the Figma export
// drifted out of it where nobody looked. On 2026-10-09 the icon sizes were
// still seven loose rem values that each happened to land on a ladder step; the
// five shadows were written in plain pixels while the utility layer wrote the
// same five shadows as ladder steps; the skeleton was a pair of loose greys at
// half alpha; three focus tokens carried raw rgba at 25%, 20% and 50%, alpha
// rungs this Framework does not have, and nothing asked for them (owner,
// 2026-10-09).
//
// A literal is allowed in two places, because in neither is it the value:
//   - inside a var() fallback -- var(--sf-black, #000) is a name with a
//     parachute, not a colour;
//   - zero, which is the same length in every system.
//
// The pill radius is the one standing exception: 1000px is not a size but a
// device, a radius deliberately larger than any box it is given. The half pixel
// that --sf-ui-shadow-top used to carry is gone -- measured at device scale 2,
// one physical pixel differed from it by 4 and 7 levels out of 255 on the two
// rows next to the edge and by nothing anywhere else (owner, 2026-10-09).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Where values are allowed to be invented.
const PRIMITIVE_SOURCES = [
  /src\/core\/scss\/vars\//,              // the size, space and palette maps
  /_sf_figma_colors_variables\.scss$/,    // the colour primitives
];

// The two lengths no ladder step can spell, each with its reason.
const EXCEPTIONS = new Map([
  ['--sf-radius-rounded', 'the pill: a radius larger than any box, not a size'],
  ['--sf-radius-circle', 'the pill: a radius larger than any box, not a size'],
]);

// Every sheet the Framework ships, not only the hand-written SCSS. The smart
// components carry plain .css templates, and the first version of this contract
// read only .scss -- which is how an 8px written out inside sf-table's template
// walked past it (owner, 2026-10-09).
const STYLESHEETS = ['.scss', '.css'];
const stylesheets = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : stylesheets(path);
  return STYLESHEETS.includes(extname(entry.name)) ? [path] : [];
});

// A declaration someone commented out is not a declaration. Four utilities carry
// an old `--sf-shadow: 0 0 #0000` behind `//`, and reading those as live would
// have made this contract cry wolf on its first run.
const withoutComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !/^\s*\/\//.test(line))
  .join('\n');

const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
const LITERAL_LENGTH = /(^|[\s(,])-?\d*\.?\d+(px|rem)\b/i;
const DECLARATION = /^\s*(--sf-[a-z0-9\\/-]+)\s*:\s*(.+?);?\s*$/i;

// var(--name) and var(--name, fallback) both reduce to the name: what they
// resolve to is the named token, and the fallback is only reached when the
// token is absent.
const withoutNames = (value) => {
  let out = value, previous;
  do {
    previous = out;
    out = out.replace(/var\(\s*--[a-z0-9\\/-]+\s*(,[^()]*)?\)/gi, 'NAME');
  } while (out !== previous);
  return out.replace(/(^|[\s(,])-?0(px|rem)?\b/gi, '$1ZERO');
};

const findings = () => {
  const found = [];
  for (const file of stylesheets(resolve(root, 'src'))) {
    if (PRIMITIVE_SOURCES.some((pattern) => pattern.test(file))) continue;
    for (const line of withoutComments(readFileSync(file, 'utf8')).split('\n')) {
      const match = DECLARATION.exec(line);
      if (!match) continue;
      const [, name, value] = match;
      if (EXCEPTIONS.has(name)) continue;
      const bare = withoutNames(value);
      const kind = LITERAL_COLOUR.test(bare) ? 'colour' : LITERAL_LENGTH.test(bare) ? 'length' : null;
      if (kind) found.push({kind, name, where: `${relative(root, file)}: ${name}: ${value.trim()}`});
    }
  }
  return found;
};

test('no token outside the primitives invents a colour', () => {
  const colours = findings().filter((entry) => entry.kind === 'colour');
  assert.deepEqual(colours.map((entry) => entry.where), [],
    'a colour belongs to the palette; name the step instead of repeating its value');
});

test('no token outside the primitives invents a length', () => {
  const lengths = findings().filter((entry) => entry.kind === 'length');
  assert.deepEqual(lengths.map((entry) => entry.where), [],
    'a length belongs to the size ladder; name the step instead of repeating its value');
});

test('the exceptions are the two we know about, and no more', () => {
  assert.deepEqual([...EXCEPTIONS.keys()].sort(),
    ['--sf-radius-circle', '--sf-radius-rounded']);
});

test('the icon sizes are steps of the size ladder', () => {
  const source = readFileSync(resolve(root, 'src/core/figma_variables/figma_icon_sizes.scss'), 'utf8');
  const declared = [...source.matchAll(/--sf-icon-size-[^:]+:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.equal(declared.length, 10);
  for (const value of declared) {
    assert.match(value, /^var\(--sf-[a-i]\d\)$/, `icon size ${value} is not a ladder step`);
  }
});

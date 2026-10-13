import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// What colour a glyph may be. The owner's rule, from the system this theme is
// built on: an icon is read at the weight of the text beside it, or one step
// paler, or it is disabled. Three roles, and nothing else.
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
]);

const sheets = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return sheets(path);
  return ['.scss', '.css'].includes(extname(entry.name)) ? [path] : [];
});

test('a glyph is coloured by one of the three roles an icon may take', () => {
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
  assert.match(icons, /@layer sf\.base \{\s*\.sf-icon \{\s*color: var\(--sf-icon--color, currentColor\);/);
  const unlayered = icons.slice(0, icons.indexOf('@layer sf.base'));
  assert.doesNotMatch(unlayered, /^\s*color:/mu,
    'the base rule must not also set a colour outside the layer, which would outrank it again');
});

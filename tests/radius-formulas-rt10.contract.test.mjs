import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// RT-10 (role tokens C173): a nested corner is the host's corner less what
// lies between, named by its role -- the plate inset (--sf-radius--inner),
// the panel inset (--sf-inset--panel) or the border line (--sf-line--border) --
// never a bare step or the pixel unit. The four hand formulas of GB4: sf-menu
// in the search panel (- px) and the card (- space-2) now read the roles; the
// button group's outer corner (plate + its own padding) and the badge's anchor
// geometry are not nested corners and keep their own variables.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return files(path);
  return extname(entry.name) === '.scss' ? [path] : [];
});
const bare = (path) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

test('no nested corner subtracts a bare step or the pixel unit from a radius role', () => {
  const hand = /calc\(var\(--sf-radius--(?:surface|ui)\)\s*-\s*var\(--sf-(?:px|space-[\w\\/]+)\)\)/gu;
  const found = [];
  for (const path of [...files(resolve(root, 'src/component')), ...files(resolve(root, 'src/smart'))]) {
    for (const [match] of bare(path).matchAll(hand)) found.push(`${path.slice(root.length + 1)}: ${match}`);
  }
  assert.deepEqual(found, []);
});

test('the card and the menu in the search panel read the roles', () => {
  const card = bare(resolve(root, 'src/component/card/scss/_css__card.scss'));
  assert.equal(card.match(/max\(var\(--sf-a4\), calc\(var\(--sf-radius--surface\) - var\(--sf-inset--panel\)\)\)/gu)?.length, 4);
  assert.match(bare(resolve(root, 'src/smart/menu/scss/_smart__menu.scss')), /--sf-menu--radius: calc\(var\(--sf-radius--surface\) - var\(--sf-line--border\)\);/u);
});

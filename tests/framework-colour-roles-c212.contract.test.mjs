import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// C212 (5) follow-up (queue #229): the Framework's own scripts paint with the
// colour roles, never with a palette class or a C16 former spelling. The class
// modal's scrim is the shared scrim role (black 64, C20; the Smart modal's),
// its window the area place; sf-system search's panel edge is the boundary
// role and its clear mark the inverse place, which follow the theme (gray-3
// and gray-9 were static tones, a light line on a dark panel).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return files(path);
  return ['.js', '.mjs'].includes(extname(entry.name)) ? [path] : [];
});

test('no Framework script writes a palette colour class', () => {
  const palette = /(?:^|[\s'"`:])(?:bg|border|color|fill|ring|text|stroke)-(?:white|black|(?:gray|red|orange|yellow|green|blue|purple|pink)-\d)\b/gu;
  const found = [];
  for (const path of [...files(resolve(root, 'src/component')), ...files(resolve(root, 'src/smart'))]) {
    const code = readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gmu, '');
    for (const [match] of code.matchAll(palette)) found.push(`${path.slice(root.length + 1)}: ${match.trim()}`);
  }
  assert.deepEqual(found, []);
});

test('the class modal lays the scrim role and the area place', () => {
  const modal = readFileSync(resolve(root, 'src/component/modal/js/_modal.js'), 'utf8');
  assert.match(modal, /: 'bg-scrim',/u);
  assert.doesNotMatch(modal, /'bg-surface /u, 'the bare surface word is the C212 former spelling of surface-area');
  assert.equal(modal.match(/'bg-surface-area border border-outline-variant radius-surface/gu)?.length, 2);
  const search = readFileSync(resolve(root, 'src/component/sf-system/js/search/_search.js'), 'utf8');
  assert.match(search, /radius-3 border-outline-variant'/u);
  assert.match(search, /before:bg-surface-inverse'/u);
});

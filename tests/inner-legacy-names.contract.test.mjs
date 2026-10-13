import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// The Framework's own templates wrote the legacy names on the elements they
// draw -- sf-datepicker gave its inner sf-input and buttons `type`, the tree
// gave its items `type` while it parsed only `type` back -- so a page using
// nothing legacy filled SF.deprecations with the Framework's own notes. The
// axes and their legacy names are in contracts/public-api-axes.json; a rename
// with different values (badge scheme -> status) is not a rename and is left.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const axes = JSON.parse(readFileSync(resolve(root, 'contracts/public-api-axes.json'), 'utf8'));
const tags = {
  buttons: 'sf-button', 'icon-buttons': 'sf-icon-button', inputs: 'sf-input', dropdown: 'sf-dropdown',
  badges: 'sf-badge', 'tree-item': 'sf-tree-item',
};
const legacy = {};
for (const {component, axis, legacy: names = []} of axes.components) {
  if (!tags[component] || (component === 'badges' && axis === 'status')) continue;
  for (const name of names) (legacy[tags[component]] ??= {})[name] = axis;
}
// Renames the change journal records (tightness -> spacing) count too.
const journal = JSON.parse(readFileSync(resolve(root, 'contracts/changes/journal.json'), 'utf8'));
for (const record of journal.records.filter((entry) => entry.kind === 'attribute')) {
  for (const {component, from, to} of record.items) {
    if (component === 'sf-badge' && from === 'scheme') continue;
    if (component && to && Object.values(tags).includes(component)) (legacy[component] ??= {})[from] ??= to;
  }
}

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
});

test('Smart templates write the axis names on the Framework elements they draw', () => {
  const found = [];
  for (const file of files(resolve(root, 'src/smart'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<(sf-[a-z-]+)\b([^>]*)>/gu)) {
      const names = legacy[match[1]];
      if (!names) continue;
      for (const [, attribute] of match[2].matchAll(/\s([a-z-]+)=/gu)) {
        if (names[attribute]) {
          found.push(`${file.slice(root.length + 1)}: <${match[1]} ${attribute}=> (write ${names[attribute]})`);
        }
      }
    }
  }
  assert.deepEqual(found, []);
});

test('tree and dropdown items read kind before the legacy type', () => {
  for (const file of ['src/smart/tree/index.js', 'src/smart/tree-item/index.js', 'src/smart/dropdown/index.js']) {
    const source = readFileSync(resolve(root, file), 'utf8');
    assert.match(source, /getAttribute\('kind'\) \|\| \w+\.getAttribute\('type'\)/u, file);
  }
});

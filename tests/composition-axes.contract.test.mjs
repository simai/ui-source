import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// A composition document may set only the props its type declares. The
// button's declared `type` -- the legacy name -- and not `appearance`, the
// axis that replaced it, so a document written the way the guide teaches was
// refused and one written the old way passed. Wherever a legacy name stays
// declared, for documents saved before, its axis is declared beside it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const axes = JSON.parse(readFileSync(resolve(root, 'contracts/public-api-axes.json'), 'utf8'));
// The change journal records renames the axes file does not (tightness ->
// spacing); its attribute records count the same way.
const journal = JSON.parse(readFileSync(resolve(root, 'contracts/changes/journal.json'), 'utf8'));
const folder = (tag) => ({'sf-button': 'buttons', 'sf-icon-button': 'icon-buttons', 'sf-button-group': 'button-group'})[tag] ?? tag.replace(/^sf-/u, '');
const renames = [
  ...axes.components,
  ...journal.records.filter((record) => record.kind === 'attribute').flatMap((record) => record.items
    .filter((item) => item.component && item.to)
    .map((item) => ({component: folder(item.component), axis: item.to, legacy: [item.from]}))),
];

test('a composition type that declares a legacy prop declares its replacement too', () => {
  const missing = [];
  for (const {component, axis, legacy = []} of renames) {
    const file = resolve(root, 'src/smart', component, 'smart.manifest.json');
    if (!existsSync(file)) continue;
    const props = JSON.parse(readFileSync(file, 'utf8')).composition?.declarative?.props;
    if (!Array.isArray(props)) continue;
    if (legacy.some((name) => props.includes(name)) && !props.includes(axis)) {
      missing.push(`${component}: declares ${legacy.filter((name) => props.includes(name)).join(', ')} without ${axis}`);
    }
  }
  assert.deepEqual(missing, []);
});

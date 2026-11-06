import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('datepicker tolerates the first render before the nested input ref is ready', async () => {
  const source = await readFile(path.join(root, 'src/smart/input-date/index.js'), 'utf8');
  assert.match(source, /refs\.input\?\.value\?\.querySelector/);
});

test('steps Studio fixture renders a meaningful multi-step example', async () => {
  const fixture = JSON.parse(await readFile(path.join(root, 'src/smart/steps/studio.fixture.json'), 'utf8'));
  assert.equal(fixture.component, 'smart.steps');
  // A list, as the manifest declares items (standard 1.4); "a|b|c" before.
  const items = Array.isArray(fixture.props.items) ? fixture.props.items : String(fixture.props.items).split('|');
  assert.ok(items.length >= 3);
});

test('button link segments keep a closed perimeter without a double selected join', async () => {
  const source = await readFile(path.join(root, 'src/component/buttons/scss/_css__buttons_custom.scss'), 'utf8');
  // The same role the group's own perimeter rests on.
  assert.match(source, /\.sf-button\.sf-button--link\[class\*="segment-"\][\s\S]*border-color: var\(--sf-outline\)/);
  // One line at a join (docs review R003): a follower has no start edge, the
  // first link segment draws the perimeter's start.
  assert.match(source, /\.sf-button:is\(\.segment-middle, \.segment-end\) \{\s*--sf-button--border-inline-start-width: 0;/);
  assert.match(source, /\.sf-button\.sf-button--link\.segment-start \{\s*--sf-button--border-inline-start-width: var\(--sf-px\);/);
  // The outline segment owns both of its joins: the one before it leaves its
  // end edge, and it draws its start edge after a segment that is not one.
  assert.match(source, /:not\(\.sf-button--outline\):has\(\+ :is\(\.sf-button--outline, \.sf-icon-button--outline\)\[class\*="segment-"\]\) \{\s*--sf-button--border-inline-end-width: 0;/);
  assert.match(source, /\+ \.sf-button\.sf-button--outline\[class\*="segment-"\] \{\s*--sf-button--border-inline-start-width: var\(--sf-px\);/);
});

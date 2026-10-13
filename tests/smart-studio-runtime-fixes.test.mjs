import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('datepicker tolerates the first render before the nested input ref is ready', async () => {
  const source = await readFile(path.join(root, 'src/smart/datepicker/index.js'), 'utf8');
  assert.match(source, /refs\.input\?\.value\?\.querySelector/);
});

test('steps Studio fixture renders a meaningful multi-step example', async () => {
  const fixture = JSON.parse(await readFile(path.join(root, 'src/smart/steps/studio.fixture.json'), 'utf8'));
  assert.equal(fixture.component, 'smart.steps');
  assert.ok(String(fixture.props.items).split('|').length >= 3);
});

test('button link segments keep a closed perimeter without a double selected join', async () => {
  const source = await readFile(path.join(root, 'src/component/buttons/scss/_css__buttons_custom.scss'), 'utf8');
  // The same role the group's own perimeter rests on.
  assert.match(source, /\.sf-button\.sf-button--link\[class\*="segment-"\][\s\S]*border-color: var\(--sf-outline\)/);
  assert.match(source, /\.sf-button\.sf-button--link\.segment-start,[\s\S]*--sf-button--border-inline-end-width: 0/);
  assert.match(source, /\.sf-button\.sf-button--link\.segment-end[\s\S]*--sf-button--border-inline-end-width: var\(--sf-px\)/);
  assert.match(source, /sf-button:has\(\.sf-button--outline\[class\*="segment-"\]\)[\s\S]*border-inline-start-width: 0/);
  assert.match(source, /sf-button:has\(\+ sf-button \.sf-button--outline\[class\*="segment-"\]\)[\s\S]*border-inline-end-width: 0/);
});

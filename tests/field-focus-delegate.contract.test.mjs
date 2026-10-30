import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// element.focus() on a Smart field reaches its native control through
// focusDelegate (smart-base). UI Chat, msg-b050db447a3340ae86a0: sf-input had none.
test('sf-input and sf-textarea name the native control that takes focus', () => {
  assert.match(read('src/smart/input/index.js'), /focusDelegate\(\) \{\n\s+return this\.getInputElement\(\);/u);
  assert.match(read('src/smart/textarea/index.js'), /focusDelegate\(\) \{\n\s+return this\.querySelector\('textarea'\);/u);
});

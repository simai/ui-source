import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// What a Smart host does with the light DOM and the attributes an author wrote
// on it. Every case here came from the first real editor built on the
// Framework (ui-mail M2 consumer journal, 2026-10-21).
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('host data attributes are copied to the rendered control and stay on the host', async () => {
  const base = await read('src/core/js/smart-base.js');

  // The host was losing them: forwarding moved data-* to the inner native
  // control, so querySelector('sf-button[data-add]') and host.dataset came
  // back empty (ui-mail.button-data-attributes).
  assert.doesNotMatch(base, /dataAttributeNamesToRemove/, 'data-* are no longer taken off the host');
  assert.doesNotMatch(base, /dataAttributeNamesToRemove\.forEach\(\(name\) => this\.removeAttribute\(name\)\)/);
  assert.match(base, /if \(transferDataAttributes && name\.startsWith\("data-"\)\) \{\s*dataAttributes\.set\(name, value\);\s*\}/);
  // The copy on the target is rebuilt from the host on every pass, so a
  // data-* the author removes leaves the control as well.
  assert.match(base, /const dataAttributes = new Map\(\);/);
  assert.match(base, /this\[storageKey\] = dataAttributes;/);
});

test('a text child is the button label, not a second label beside it', async () => {
  const [button, template] = await Promise.all([
    read('src/smart/buttons/index.js'),
    read('src/smart/buttons/js/templates/default.js'),
  ]);

  // createElement('sf-button') + textContent rendered an empty button with the
  // text node standing beside it, unstyled (ui-mail.button-text-content).
  assert.match(button, /captureTextChildren\(\) \{/);
  assert.match(button, /if \(this\.hasSlotContent\?\.\("text"\)\) return;/, 'a text slot still wins');
  assert.match(button, /node\.nodeType === 3 && String\(node\.textContent\)\.trim\(\) !== ""/);
  assert.match(button, /nodes\.forEach\(\(node\) => node\.remove\(\)\);/, 'the adopted node leaves the light DOM');
  assert.match(button, /get text\(\) \{\s*return this\.getAttribute\("text"\) \|\| this\._textFromChildren \|\| "";/);
  // The props context knows only the attribute, so the template reads the
  // getter: a button whose label is a child has no text attribute.
  assert.match(button, /text: this\.text,/);
  assert.match(button, /onConnected\(\) \{\s*this\.captureTextChildren\(\);/);
  assert.match(template, /component\?\.hasSlotContent\?\.\('text'\)/);
});

test('button documentation names all three label sources and the data-* rule', async () => {
  const docs = await read('src/smart/buttons/docs/docs.md');

  assert.match(docs, /## The label/);
  assert.match(docs, /<sf-button>Добавить<\/sf-button>/);
  assert.match(docs, /copied, not moved/);
  assert.match(docs, /querySelector\('sf-button\[data-add\]'\)/);
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

// What a Smart host does with the light DOM and the attributes an author wrote
// on it. The cases came from the first real editor built on the Framework
// (ui-mail M2 consumer journal, 2026-10-21) and from the Larena package probes
// that the first answer to them broke (larena.property-view-arranging and
// larena.admin-menu-search, 2026-10-22).
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('a host data attribute ends up on the native control and on nothing else', async () => {
  const base = await read('src/core/js/smart-base.js');

  // One element carries a data-*, and it is the native control: the one with a
  // box, the paint, the focus, the click and the drag. Copying it to the
  // control while the host kept it put every one on two elements and doubled a
  // count (larena.property-view-arranging); keeping it on the host alone left
  // one element with no box, so a drag through its bounding box threw
  // (larena.table-sortable-lists) and a probe reading a filled button read the
  // wrong element (larena.property-view).
  assert.match(
    base,
    /if \(transferDataAttributes && name\.startsWith\("data-"\)\) \{\s*dataAttributes\.set\(name, value\);\s*dataAttributeNamesToRemove\.push\(name\);\s*return;\s*\}/u,
    'a data-* is recorded and taken off the host',
  );
  assert.match(
    base,
    /dataAttributes\.forEach\(\(value, name\) => \{\s*nextKeys\.add\(name\);\s*target\.setAttribute\(name, value\);\s*\}\);/u,
    'the record is what the control is given',
  );
  assert.match(
    base,
    /this\.__sfForwardingHostAttributes = true;\s*dataAttributeNamesToRemove\.forEach\(\(name\) => this\.removeAttribute\(name\)\);\s*this\.__sfForwardingHostAttributes = false;/u,
    'the host loses them, under the guard that stops the observer looping',
  );

  // Both buttons ask for it, and no caller asks for the other shape.
  for (const path of ['src/smart/buttons/index.js', 'src/smart/icon-buttons/index.js']) {
    const source = await read(path);
    assert.match(source, /transferDataAttributes: true/, `${path} moves data-* to its control`);
  }
});

test('the host keeps a readable record of the data attributes it was given', async () => {
  const base = await read('src/core/js/smart-base.js');

  // The attribute is not on the host any more, so a product that wrote
  // data-add on <sf-button> needs a way to read it back
  // (ui-mail.button-data-attributes).
  assert.match(base, /this\.__sfHostDataAttributes = dataAttributes;/u);
  assert.match(base, /this\.__sfHostDataAttributeTarget = target;/u);
  assert.match(base, /this\.__sfHostDataAttributeTargetKeys = targetStorageKey;/u, 'the component’s own key, not the default');
  assert.match(base, /get dataAttributes\(\) \{/u);
  assert.match(base, /\.replace\(\/-\(\[a-z\]\)\/gu, \(_, letter\) => letter\.toUpperCase\(\)\)/u, 'read like dataset: data-add -> .add');
  // Removing it from the control alone would be undone on the next render,
  // because the record is what the control is given again.
  assert.match(base, /removeHostDataAttribute\(name\) \{/u);
  assert.match(base, /this\.__sfHostDataAttributes\?\.delete\(attribute\);/u);
  assert.match(base, /this\.__sfHostDataAttributeTarget\?\.removeAttribute\?\.\(attribute\);/u);
});

test('focus() on a host reaches the control inside it', async () => {
  const base = await read('src/core/js/smart-base.js');

  // A host holds no focus: it is display:contents and generates no box, so
  // focus() on it did nothing and left document.activeElement where it was.
  assert.match(base, /focusDelegate\(\) \{\s*return null;\s*\}/u, 'the base names no control; a component does');
  assert.match(
    base,
    /focus\(options\) \{\s*const target = this\.focusDelegate\?\.\(\);\s*\n\s*if \(target && typeof target\.focus === "function"\) \{\s*target\.focus\(options\);\s*return;\s*\}/u,
    'focus() on the host goes to the named control',
  );
  assert.match(base, /blur\(\) \{\s*const target = this\.focusDelegate\?\.\(\);/u, 'blur() follows focus()');

  // Asked before the control exists, the focus waits for the first render --
  // and is dropped if something else took focus meanwhile, so a queued focus
  // never steals it back.
  assert.match(base, /!this\.isRendered/u);
  assert.match(base, /this\.whenRendered\(\(\) => \{/u);
  assert.match(base, /if \(\(this\.ownerDocument\?\.activeElement \|\| null\) !== activeWhenAsked\) return;/u);

  const button = await read('src/smart/buttons/index.js');
  assert.match(button, /focusDelegate\(\) \{\s*return this\.querySelector\("\.sf-button"\);\s*\}/u);

  const iconButton = await read('src/smart/icon-buttons/index.js');
  assert.match(iconButton, /focusDelegate\(\) \{\s*return this\.querySelector\('\.sf-icon-button'\);\s*\}/u);
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
  assert.match(docs, /\*\*moved, not copied\*\*/);
  assert.match(docs, /save\.closest\('sf-button'\)/, 'the docs show the way back to the host');
  assert.match(docs, /add\.dataAttributes\.add/, 'the docs show how to read what the author wrote');
  assert.match(docs, /removeHostDataAttribute\('data-add'\)/);
  assert.match(docs, /`focus\(\)` on it goes to the native button inside/);
});

test('icon button documentation states the same host-attribute and focus rule', async () => {
  const docs = await read('src/smart/icon-buttons/docs/docs.md');

  assert.match(docs, /## Host attributes/);
  assert.match(docs, /\*\*moved, not copied\*\*/);
  assert.match(docs, /data-sf-admin-search-toggle/);
  assert.match(docs, /toggle\.closest\('sf-icon-button'\)/);
  assert.match(docs, /`focus\(\)` on the host goes to the native button inside/);
});

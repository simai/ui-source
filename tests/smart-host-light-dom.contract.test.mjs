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

test('a host data attribute stays on the host and is on no other element', async () => {
  const base = await read('src/core/js/smart-base.js');

  // The host was losing them: forwarding moved data-* to the inner native
  // control, so querySelector('sf-button[data-add]') and host.dataset came
  // back empty (ui-mail.button-data-attributes).
  assert.doesNotMatch(base, /dataAttributeNamesToRemove/, 'data-* are no longer taken off the host');

  // Copying them instead put every data-* on two elements, and a product that
  // counted them got 2 where it wrote 1 (larena.property-view-arranging). The
  // host keeps them and the loop returns: nothing reaches the target.
  assert.match(
    base,
    /if \(hostKeepsDataAttributes && name\.startsWith\("data-"\)\) \{\s*dataAttributes\.set\(name, value\);\s*return;\s*\}/u,
    'a data-* is recorded on the host and the forwarding loop stops there',
  );
  assert.doesNotMatch(base, /transferDataAttributes/, 'the option no longer says the attributes are transferred');

  // Rebuilt from the host on every pass, and the names this pass did not see
  // are removed from the target: a data-* copied by the previous version
  // leaves the control on the first render after the upgrade.
  assert.match(base, /const dataAttributes = new Map\(\);/);
  assert.match(base, /previous\.forEach\(\(name\) => \{\s*target\.removeAttribute\(name\);/u);
  assert.match(base, /this\[storageKey\] = dataAttributes;/);

  // Neither button asks for the old behaviour.
  for (const path of ['src/smart/buttons/index.js', 'src/smart/icon-buttons/index.js']) {
    const source = await read(path);
    assert.doesNotMatch(source, /transferDataAttributes/, `${path} does not ask for data-* to be transferred`);
    assert.match(source, /hostKeepsDataAttributes: true/, `${path} keeps data-* on the host`);
  }
});

test('focus() on a host reaches the control inside it', async () => {
  const base = await read('src/core/js/smart-base.js');

  // A data-* selector answers the host, and a product focuses what it found:
  // the host is display:contents and took no focus, so Escape no longer
  // returned focus to Larena's magnifier (larena.admin-menu-search).
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
  assert.match(docs, /they stay on the host, and only there/);
  assert.match(docs, /event\.target\.closest\('\[data-add\]'\)/, 'the docs show how delegation reads a host attribute');
  assert.match(docs, /`focus\(\)` on it goes to the native button inside/);
});

test('icon button documentation states the same host-attribute and focus rule', async () => {
  const docs = await read('src/smart/icon-buttons/docs/docs.md');

  assert.match(docs, /## Host attributes/);
  assert.match(docs, /they stay on the host, and only there/);
  assert.match(docs, /data-sf-admin-search-toggle/);
  assert.match(docs, /`focus\(\)` on it goes to the native button inside/);
});

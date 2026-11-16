// fix/dot-avatar-badge-c185: the avatar's presence point and the anchored
// badge's dot are the Framework's one .sf-dot (owner decision C185 (8)); a
// tooltip's shortcut is said on its trigger (KB-4); an avatar in a ring
// without slot="content" is said (AR-4); the avatar's size words say 1/4 = 16
// (AR-3, C132 (5)). The look is measured in a browser on a build (evidence
// fix/dot-avatar-badge-c185); these pin the source and the helper.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {surfaceShortcut, writeTriggerKeyShortcuts} from '../src/component/tooltip/js/_keyshortcuts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('C185 (8): the presence point is an .sf-dot inside .sf-online-indicator', async () => {
  const [shared, sheet, avatar, group] = await Promise.all([
    read('src/smart/avatar/js/templates/shared.js'),
    read('src/component/avatars/scss/_css__avatar_online_indicator.scss'),
    json('src/smart/avatar/component.json'),
    json('src/smart/avatar-group/component.json'),
  ]);
  assert.match(shared, /context\.status === "away" \? "sf-dot sf-dot--hollow sf-dot--neutral" : "sf-dot sf-dot--success"/u);
  assert.match(shared, /><span class=\$\{dot\}><span class="sf-dot-item"><\/span><\/span><\/span>/u);
  assert.match(sheet, /\.sf-online-indicator > \.sf-dot \{\s*--sf-dot-item--size: var\(--sf-online-indicator--width\);\s*--sf-dot-item--ring: var\(--sf-online-indicator--ring-width\);/u);
  assert.match(sheet, /\.sf-online-indicator:has\(> \.sf-dot\) \{/u);
  for (const manifest of [avatar, group]) assert.ok(manifest.relations.some((relation) => relation.name === 'dot'), manifest.tag);
});

test('C185 (8): the anchored badge holds an .sf-dot, drawn wherever the badge is a dot', async () => {
  const [helper, runtime, sheet, geometry, icon, button] = await Promise.all([
    read('src/smart/helpers/anchored-badge.js'),
    read('src/component/badges/js/_anchored.js'),
    read('src/component/badges/scss/_css__badges_anchored.scss'),
    read('src/component/badges/scss/_anchored-geometry.scss'),
    json('src/smart/icon/component.json'),
    json('src/smart/button-icon/component.json'),
  ]);
  assert.match(helper, />\$\{badge\.text\}<span class="sf-dot"><span class="sf-dot-item"><\/span><\/span><\/span>`/u);
  assert.match(helper, /ensurePlugin\?\.\('dot'\)/u);
  assert.match(runtime, /writeContent\(badge, state\.text, explicitDot \|\| badge\.classList\.contains\('sf-badge--anchored'\)\)/u);
  assert.match(sheet, /\.sf-badge > \.sf-dot \{\s*display: none;/u);
  assert.match(sheet, /\.sf-badge\.sf-badge--anchored\.sf-badge--dot \{\s*@include anchored\.dot-disc;/u);
  assert.match(geometry, /@mixin dot-disc \{[\s\S]*?--sf-dot-item--size: var\(--sf-badge--anchored-dot\);\s*--sf-dot-item--background-color: var\(--sf-badge--background-color\);/u);
  // The menus that include `dot` keep their own drawing: dot-disc is separate.
  assert.doesNotMatch(geometry.slice(geometry.indexOf('@mixin dot {'), geometry.indexOf('}', geometry.indexOf('@mixin dot {'))), /sf-dot/u);
  assert.ok(icon.relations.some((relation) => relation.name === 'dot' && relation.lazy === true));
  assert.ok(button.relations.some((relation) => relation.name === 'dot'));
});

function fakeTrigger(attributes = {}) {
  const values = new Map(Object.entries(attributes));
  return {
    getAttribute: (name) => (values.has(name) ? values.get(name) : null),
    setAttribute: (name, value) => values.set(name, String(value)),
    removeAttribute: (name) => values.delete(name),
  };
}

test('KB-4: the tooltip shortcut is written on the trigger, the page\'s own wins, and it is taken back', () => {
  const trigger = fakeTrigger();
  writeTriggerKeyShortcuts(trigger, 'mod+b');
  assert.match(trigger.getAttribute('aria-keyshortcuts'), /^(Meta|Control)\+B$/u);
  writeTriggerKeyShortcuts(trigger, 'shift+/');
  assert.equal(trigger.getAttribute('aria-keyshortcuts'), 'Shift+/');
  writeTriggerKeyShortcuts(trigger, '');
  assert.equal(trigger.getAttribute('aria-keyshortcuts'), null);

  const own = fakeTrigger({'aria-keyshortcuts': 'Alt+B'});
  writeTriggerKeyShortcuts(own, 'mod+b');
  assert.equal(own.getAttribute('aria-keyshortcuts'), 'Alt+B');
  writeTriggerKeyShortcuts(own, '');
  assert.equal(own.getAttribute('aria-keyshortcuts'), 'Alt+B');

  assert.equal(surfaceShortcut({localName: 'sf-tooltip', getAttribute: (name) => (name === 'shortcut' ? ' mod+k ' : null)}), 'mod+k');
  assert.equal(surfaceShortcut(null), '');
});

test('KB-4: the controller and sf-tooltip both write it', async () => {
  const [controller, element] = await Promise.all([
    read('src/component/tooltip/js/_tooltip.js'),
    read('src/smart/tooltip/index.js'),
  ]);
  assert.match(controller, /writeTriggerKeyShortcuts\(this\.trigger, surfaceShortcut\(this\.surface\)\);/u);
  assert.match(controller, /writeTriggerKeyShortcuts\(this\.trigger, ''\);/u);
  assert.match(element, /querySelectorAll\(`\[data-tooltip="\$\{escaped\}"\]`\)\.forEach\(\(trigger\) => \{\s*writeTriggerKeyShortcuts\(trigger, shortcut\);/u);
});

test('AR-4: an avatar in a ring without slot="content" is said once', async () => {
  const [ring, docs] = await Promise.all([read('src/smart/progress-ring/index.js'), read('src/smart/progress-ring/docs.md')]);
  assert.match(ring, /noteDeprecated\(\{component: 'sf-progress-ring', tag: 'sf-progress-ring', kind: 'markup', attribute: 'slot', from: 'sf-avatar without slot', to: 'slot="content"'\}\)/u);
  assert.match(ring, /__progressRingAvatarWarned/u);
  assert.match(docs, /The avatar must say `slot="content"`/u);
});

test('AR-3: the avatar size words say 1/4 = 16 on a desktop and a phone', async () => {
  const avatar = await json('src/smart/avatar/component.json');
  const words = avatar.settings.size.summary;
  assert.match(words, /On a desktop 16 \/ 24 \/ 32 \/ 40 \/ 48 \/ 56 px/u);
  assert.match(words, /the phone ladder is 16 \/ 20 \/ 28 \/ 36 \/ 44 \/ 52/u);
  assert.doesNotMatch(words, /20 \/ 24 \/ 32 \/ 40 \/ 48 \/ 56|20 \/ 20 \/ 28/u);
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Avatar Loader rule detects only the public component root', async () => {
  const sandbox = {SF: {RuleLoader: {}}};
  vm.createContext(sandbox);
  vm.runInContext(await read('src/component/avatars/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader.avatars;

  assert.equal(rule.regex.test('class="sf-avatar"'), true);
  assert.equal(rule.regex.test('class="sf-avatar sf-avatar--text"'), true);
  assert.equal(rule.regex.test('class="sf-avatar-copy"'), false);
  assert.equal(rule.regex.test('data-name="sf-avatar"'), false);
  assert.equal(rule.js, false);
});

test('Avatar presentation uses semantic tokens and native interactive states', async () => {
  const styles = [
    await read('src/component/avatars/scss/_css__avatars.scss'),
    await read('src/component/avatars/scss/_css__avatars_group.scss'),
    await read('src/component/avatars/scss/_css__avatar_custom.scss'),
    await read('src/component/avatars/scss/_css__avatar_label_group.scss'),
  ].join('\n');

  assert.match(styles, /:is\(button, a\)\.sf-avatar/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /var\(--sf-radius--ui\)/);
  assert.match(styles, /var\(--sf-px\)/);
  assert.match(styles, /var\(--sf-z-index-9\)/);
  assert.match(styles, /var\(--sf-ui-1--control-height\)/);
  assert.match(styles, /\.sf-avatar-image[\s\S]*object-fit: cover/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(styles, /\b(?:1|2|4|6|8|12|16|20|24|32|40|48|56|64)(?:px|rem)\b/);
});

test('Avatar publishes the full size scale and both semantic shapes', async () => {
  const [avatarStyles, labelStyles] = await Promise.all([
    read('src/component/avatars/scss/_css__avatars.scss'),
    read('src/component/avatars/scss/_css__avatar_label_group.scss'),
  ]);

  for (const size of ['1\\/4', '1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(avatarStyles.includes(`sf-avatar--size-${size}`));
  }
  for (const size of ['1\\/4', '1\\/3', '1\\/2', '1', '2', '3']) {
    assert.ok(labelStyles.includes(`sf-avatar-label-group--size-${size}`));
  }
  assert.match(avatarStyles, /--sf-radius-circle/);
  assert.match(avatarStyles, /\.sf-avatar--square/);
});

test('Smart Avatar projects image, shape and accessibility contracts', async () => {
  const [source, shared, card, manifest, docs] = await Promise.all([
    read('src/smart/avatar/index.js'),
    read('src/smart/avatar/js/templates/shared.js'),
    read('src/smart/avatar/js/templates/card.js'),
    read('src/smart/avatar/smart.manifest.json'),
    read('src/smart/avatar/docs/docs.md'),
  ]);

  // shape is made from component.json (core/js/element-manifest.js).
  assert.match(source, /elementFromManifest\(manifest/);
  assert.deepEqual(JSON.parse(await read('src/smart/avatar/component.json')).settings.shape, {type: 'enum', values: ['circle', 'square'], default: 'circle'});
  assert.match(shared, /<img class="sf-avatar-image"/);
  assert.match(shared, /alt=""/);
  assert.match(shared, /aria-hidden="true"/);
  assert.doesNotMatch(shared, /background-image/);
  assert.match(card, /sf-avatar-card--\$\{variant\}/);
  assert.match(card, /context\.imageAlt \|\| ""/);
  assert.match(manifest, /"shape"/);
  assert.match(manifest, /"offline"/);
  assert.match(manifest, /"disabled"/);
  assert.match(docs, /color alone is\s+not a status contract/i);
});

test('Avatar documentation uses real Framework-only examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, sizes, shapes, status, label, group, cards, focus] = await Promise.all([
    readUiDoc('content/ru/components/content/avatars.md'),
    readUiDoc('examples/components/avatars/overview/index.html'),
    readUiDoc('examples/components/avatars/sizes/index.html'),
    readUiDoc('examples/components/avatars/shapes/index.html'),
    readUiDoc('examples/components/avatars/status/index.html'),
    readUiDoc('examples/components/avatars/label/index.html'),
    readUiDoc('examples/components/avatars/group/index.html'),
    readUiDoc('examples/components/avatars/cards/index.html'),
    readUiDoc('examples/components/avatars/state-focus/index.html'),
  ]);
  const examples = [overview, sizes, shapes, status, label, group, cards, focus].join('\n');

  for (const id of ['overview', 'sizes', 'shapes', 'status', 'label', 'group', 'cards', 'state-focus']) {
    assert.ok(page.includes(`components/avatars/${id}`));
  }
  for (const size of ['1/4', '1/3', '1/2', '1', '2', '3']) {
    assert.ok(sizes.includes(`sf-avatar--size-${size}`));
  }
  assert.match(overview, /<img class="sf-avatar-image"[^>]*alt=""/);
  // An avatar that opens a profile is a native link with its own name.
  assert.match(focus, /<a [^>]*class="sf-avatar[^>]*aria-label="[^"]+"/);
  assert.match(shapes, /sf-avatar--square/);
  // Availability must reach the reader as text, not as indicator colour alone.
  assert.match(status, /в сети/);
  assert.match(group, /role="list"/);
  assert.match(cards, /sf-avatar-card--square/);
  assert.match(cards, /radius-(?:default|surface)/); // ui-doc moves to radius-surface with the 2026-11-01 sweep
  assert.doesNotMatch(examples, /<style\b|style=/);
});

// R212 (AP-2): a card without a photo drew its media box 0 px tall, because the
// square and portrait ratios were on the img alone. The media box keeps them.
test('Avatar card media box keeps its ratio without a photo', async () => {
  const sheet = await read('src/component/avatars/scss/_css__avatar_custom.scss');
  assert.match(sheet, /\.sf-avatar-card\.sf-avatar-card--square \.sf-avatar-card-image,[^{]*\{\s*aspect-ratio: 1 \/ 1;/u);
  assert.match(sheet, /\.sf-avatar-card\.sf-avatar-card--portrait \.sf-avatar-card-image,[^{]*\{\s*aspect-ratio: 9 \/ 16;/u);
});

// C124 (owner 2026-11-13): a card without a photo draws the initials of the
// name on its hue (auto when no hue is set), and with no name the person glyph
// at 45 % of the box on the neutral fill; the initials are 36 % of the box
// width in the medium weight. Round avatars keep their look.
test('Avatar card without a photo draws initials on the hue, else the glyph', async () => {
  const [card, source, sheet, shared] = await Promise.all([
    read('src/smart/avatar/js/templates/card.js'),
    read('src/smart/avatar/index.js'),
    read('src/component/avatars/scss/_css__avatar-card.scss'),
    read('src/smart/avatar/js/templates/shared.js'),
  ]);

  assert.match(card, /context\.isText/);
  assert.match(card, /sf-avatar-card-placeholder--text\$\{hue\}/);
  assert.match(card, /` sf-hue-\$\{context\.resolvedHue\}`/);
  assert.match(card, /<span class="sf-avatar-card-initials">\$\{context\.text\}<\/span>/);
  assert.match(card, /sf-avatar-card-placeholder--icon[\s\S]*<i class="sf-icon" aria-hidden="true">person<\/i>/);
  assert.doesNotMatch(card, /bg-surface-container/);
  assert.match(source, /this\.templateName === "card" && !this\.hue && !this\.tone \? "auto" : ""/);

  assert.match(sheet, /\.sf-avatar-card \.sf-avatar-card-placeholder \{[^}]*container-type: inline-size;[^}]*background-color: var\(--sf-surface-container\);[^}]*color: var\(--sf-on-surface-container-variant\);/u);
  assert.match(sheet, /\.sf-avatar-card-placeholder--text:is\(#\{\$sf-avatar-card-hue-classes\}\) \{[^}]*var\(--sf-hue-container\);[^}]*var\(--sf-on-hue-container\);/u);
  assert.match(sheet, /\.sf-avatar-card-initials \{[^}]*font-size: 36cqi;[^}]*font-weight: var\(--sf-font-weight-medium\);/u);
  assert.match(sheet, /\.sf-avatar-card-placeholder \.sf-icon \{[^}]*--sf-icon--font-size: 45cqi;[^}]*--sf-icon--height: 45cqi;[^}]*--sf-icon--width: 45cqi;/u);
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgba?\(/i);

  // The round avatar is untouched: the same glyph and initials markup.
  assert.match(shared, /<i class="sf-icon" aria-hidden="true">person<\/i>/);
  assert.match(shared, /<span class="sf-avatar-text">\$\{context\.text\}<\/span>/);
});

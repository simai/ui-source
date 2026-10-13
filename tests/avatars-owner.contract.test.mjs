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

  assert.match(source, /shape: \{ default: "circle" \}/);
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
  assert.match(cards, /radius-default/);
  assert.doesNotMatch(examples, /<style\b|style=/);
});

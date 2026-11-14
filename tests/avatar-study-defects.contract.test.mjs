// The avatar study's defects fixed straight in the Framework (ui-control
// control/research/2026-11-14-avatar.md, stage 6): AV-2 the heading names the
// avatar, AV-4 presence joins the name, AV-5 the box before the code, AV-6 the
// group's cut-out is the point's ring (C132), AV-8 one avatar drawing with an
// icon placeholder, AV-9 no picture in a raw colour in the examples (C124, C18).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('AV-2, AV-4: the name is aria-label, else heading, else text; presence and the count follow it', () => {
  const element = read('src/smart/avatar/index.js');
  assert.match(element, /get accessibleName\(\) \{\s*return \(\s*this\.getAttribute\("aria-label"\) \|\|\s*String\(this\.heading \?\? ""\)\.trim\(\) \|\|\s*String\(this\.text \?\? ""\)\.trim\(\) \|\|\s*this\.sfWord\("aria-label"\)/u);
  assert.match(element, /if \(this\.status === "online"\) return this\.sfWord\("status-online"\);/u);
  assert.match(element, /if \(this\.status === "offline"\) return this\.sfWord\("status-offline"\);/u);
  assert.match(element, /presence \? `\$\{this\.accessibleName\}, \$\{presence\}` : this\.accessibleName/u);
  assert.match(element, /return nameWithBadge\(name, elementBadge\(this\)\.phrase\);/u);
  assert.match(element, /buttonLabel: this\.spokenName,/u);
  assert.match(element, /button\.setAttribute\("aria-label", this\.spokenName\);/u);
  // el.ariaLabel still answers the attribute or the word.
  assert.match(element, /get ariaLabel\(\) \{\s*return this\.getAttribute\("aria-label"\) \|\| this\.sfWord\("aria-label"\);/u);
  const ru = json('src/smart/avatar/lang/ru.json').runtime;
  const en = json('src/smart/avatar/lang/en.json').runtime;
  assert.equal(ru['status-online'], 'в сети');
  assert.equal(ru['status-offline'], 'не в сети');
  assert.equal(en['status-online'], 'online');
  assert.equal(en['status-offline'], 'offline');
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  const contract = json('src/smart/avatar/component.json');
  assert.deepEqual(contract.accessibility.name.from, ['aria-label', 'heading', 'text']);
});

test('AV-5: core holds the avatar\'s box before its code, from its attributes alone', () => {
  const core = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(core, /:where\(sf-avatar:not\(:defined\)\) \{\s*--sf-avatar--box: var\(--sf-ui-1--control-height\);/u);
  assert.match(core, /:where\(sf-avatar\[size="1\/4"\]:not\(:defined\)\) \{ --sf-avatar--box: #\{size\.small-step\(16\)\}; \}/u);
  for (const size of ['2', '3']) {
    assert.match(core, new RegExp(`sf-avatar\\[size="${size}"\\]:not\\(:defined\\)\\) \\{ --sf-avatar--box: var\\(--sf-ui-${size}--control-height\\); \\}`, 'u'));
  }
  assert.match(core, /sf-avatar\[line="1\/2"\]:not\(:defined\)\) \{ --sf-avatar--box: var\(--sf-text-height-1\\\/2\); \}/u);
  assert.match(core, /sf-avatar\[line="1"\]:not\(:defined\)\) \{ --sf-avatar--box: var\(--sf-text-height-1\); \}/u);
  assert.match(core, /sf-avatar\[line="2"\]:not\(:defined\)\) \{ --sf-avatar--box: var\(--sf-text-height-2\); \}/u);
  assert.match(core, /sf-avatar\[template="default"\]:not\(:defined\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*display: inline-block;\s*flex: none;\s*vertical-align: middle;\s*inline-size: var\(--sf-avatar--box\);\s*block-size: var\(--sf-avatar--box\);/u);
  assert.match(core, /sf-avatar\[template="label"\]:not\(:defined\)\):not\(:has\(> \[data-sf-static\]\)\) \{\s*display: block;\s*min-block-size: max\(var\(--sf-avatar--box\), calc\(\(var\(--sf-avatar--box-heading\) \+ var\(--sf-avatar--box-description\)\) \* var\(--sf-avatar--box-line\)\)\);/u);
  assert.match(core, /sf-avatar\[template="label"\]\[size="2"\]:not\(:defined\)\) \{ --sf-avatar--box-line: var\(--sf-text-height-2\); \}/u);
});

test('AV-6 (C132): a group\'s cut-out is the presence point\'s ring of the avatar\'s size', () => {
  const group = read('src/component/avatars/scss/_css__avatars_group.scss');
  assert.match(group, /border-width: var\(--sf-avatar-group--ring, var\(--sf-px\)\);/u);
  assert.match(group, /--sf-avatar-group--ring: var\(--sf-micro--ring-#\{\$size\}\);/u);
  const point = read('src/component/avatars/scss/_css__avatar_online_indicator.scss');
  assert.match(point, /--sf-online-indicator--ring-width: var\(--sf-micro--ring-1\\\/2\);/u);
});

test('AV-8: one avatar drawing, with an icon placeholder, for sf-avatar and its hosts', () => {
  const picture = read('src/smart/avatar/js/picture.js');
  assert.match(picture, /export function avatarPicture\(options = \{\}\)/u);
  assert.match(picture, /<sf-icon icon=\$\{context\.icon \|\| AVATAR_PLACEHOLDER_ICON\} aria-hidden="true"><\/sf-icon>/u);
  assert.doesNotMatch(picture, /#[0-9a-f]{3,8}\b|rgba?\(|background-image/iu);
  const shared = read('src/smart/avatar/js/templates/shared.js');
  assert.match(shared, /import \{avatarClasses as pictureClasses, avatarContent\} from "\.\.\/picture";/u);
  // sf-avatar keeps its utility classes where the template-utilities table
  // reads them; the picture file writes none, so a host asks for none.
  assert.match(shared, /box: "transition flex-none",/u);
  assert.match(shared, /return pictureClasses\(context, \{\.\.\.options, layout: AVATAR_LAYOUT\}\);/u);
  assert.doesNotMatch(picture, /"(transition|flex-none|inline-flex|items-cross-center|content-main-center|relative)"/u);
  const sheet = read('src/component/avatars/scss/_css__avatars.scss');
  assert.match(sheet, /@layer sf\.base \{\s*\.sf-avatar--picture \{\s*display: inline-flex;\s*flex: none;\s*align-items: center;\s*justify-content: center;/u);
  const table = json('src/core/js/template-utilities.generated.json');
  assert.ok(table['cl-avatar'].includes('transition-property/default'));
  for (const host of ['cl-tag', 'cl-list-item', 'cl-dropdown', 'cl-input-lookup']) assert.ok(!table[host].includes('background-size/default'), host);
  const avatar = json('src/smart/avatar/component.json');
  assert.equal(avatar.settings.icon.type, 'icon');
  assert.equal(avatar.settings.icon.default, '');
  assert.ok(avatar.relations.some((relation) => relation.name === 'cl-icon'));
  const menu = read('src/component/context-menu/scss/_css__context_menu.scss');
  assert.doesNotMatch(menu, /\.sf-context-menu-(item|header)-avatar \{[^}]*(background-color|color|font-weight):/u);
  assert.match(menu, /\.sf-avatar\.sf-context-menu-item-avatar \{\s*--sf-avatar--width: var\(--sf-context-menu--line\);/u);
  assert.ok(json('src/smart/menu-context/component.json').relations.some((relation) => relation.name === 'avatars'));
});

test('AV-9 (C124, C18): no example draws a picture in a raw colour', () => {
  for (const path of ['src/smart/avatar/examples.json', 'src/smart/avatar-group/examples.json', 'src/smart/avatar-group/studio.fixture.json']) {
    const text = read(path);
    assert.doesNotMatch(text, /data:image\/svg\+xml[^"]*%23[0-9a-f]{3,8}/iu, path);
  }
});

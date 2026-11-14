// sf-avatar, sf-avatar-group and sf-progress-ring, owner decision C152
// (ui-control control/docs-review/decisions.md; research
// control/research/2026-11-14-avatar.md, prototype prototypes/avatar-study.html),
// all eight points. The behaviour is measured in a browser on a build; these
// pin the source that makes it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {getInitials} from '../src/smart/helpers/text.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const uncomment = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

test('C152 (1): a picture by default, a link with href, a button only with its own action', async () => {
  const [element, shared, label, manifest] = await Promise.all([
    read('src/smart/avatar/index.js'),
    read('src/smart/avatar/js/templates/shared.js'),
    read('src/smart/avatar/js/templates/label.js'),
    json('src/smart/avatar/component.json'),
  ]);
  assert.equal(manifest.settings.href.type, 'string');
  assert.equal(manifest.accessibility.role, 'img');
  assert.match(element, /if \(String\(this\.href \?\? ""\)\.trim\(\)\) return "link";/u);
  assert.match(element, /this\.getAttribute\("slot"\) === "trigger" \|\| this\.hasAttribute\("aria-haspopup"\)/u);
  assert.match(element, /return "picture";/u);
  // The picture: role img with the name, no button, no tabindex.
  const picture = shared.match(/if \(mode === "picture"\) \{([\s\S]*?)\n    \}/u)[1];
  assert.match(picture, /<span/u);
  assert.match(picture, /role=\$\{options\.nameShown \? nothing : "img"\}/u);
  assert.doesNotMatch(picture, /tabindex|<button/u);
  assert.match(shared, /<a\s+class=[\s\S]*?href=\$\{context\.disabled \? nothing : context\.href\}/u);
  // The hover ring stays on links and buttons only.
  const sheet = await read('src/component/avatars/scss/_css__avatars.scss');
  assert.match(sheet, /:is\(button, a\)\.sf-avatar:not\(:disabled\):not\(\.disabled\):hover \{/u);
  // Beside a printed heading the picture is hidden: the name is read once.
  assert.match(label, /nameShown: Boolean\(context\.heading\)/u);
});

test('C152 (2): the initials stand under the photo, which fades in and is dropped on error', async () => {
  const [picture, sheet] = await Promise.all([
    read('src/smart/avatar/js/picture.js'),
    read('src/component/avatars/scss/_css__avatars.scss'),
  ]);
  assert.match(picture, /import \{keyed\} from "lit\/directives\/keyed\.js";/u);
  assert.match(picture, /return html`\$\{under\}\$\{keyed\(context\.imageUrl, html`<img class="sf-avatar-image"[^`]*@load=\$\{onImageLoad\} @error=\$\{onImageError\}/u);
  assert.match(picture, /event\.currentTarget\.dataset\.sfLoaded = "error";/u);
  assert.match(sheet, /\.sf-avatar > \.sf-avatar-image \{\s*position: absolute;\s*inset: 0;\s*opacity: 0;/u);
  assert.match(sheet, /\.sf-avatar > \.sf-avatar-image\[data-sf-loaded="true"\] \{\s*opacity: 1;/u);
  assert.match(sheet, /\.sf-avatar > \.sf-avatar-image\[data-sf-loaded="error"\] \{\s*display: none;/u);
  assert.match(sheet, /prefers-reduced-motion: reduce/u);
});

test('C152 (3): initials skip legal forms, titles and particles; an address gives one letter', () => {
  assert.equal(getInitials('ООО «Ромашка»'), 'Р');
  assert.equal(getInitials('Мария фон Штейн'), 'МШ');
  assert.equal(getInitials('Dr. John Smith'), 'JS');
  assert.equal(getInitials('Prof. Dr. Hans Müller'), 'HM');
  assert.equal(getInitials('Ludwig van Beethoven'), 'LB');
  assert.equal(getInitials('ИП Иванов'), 'И');
  assert.equal(getInitials('anna@simai.ru'), 'A');
  assert.equal(getInitials('ivan.petrov@simai.ru'), 'I');
  // A name made of service words alone keeps them.
  assert.equal(getInitials('ООО'), 'О');
  // The rules that stood are unchanged.
  assert.equal(getInitials('Анна Белова'), 'АБ');
  assert.equal(getInitials('Анна-Мария Петрова'), 'АП');
  assert.equal(getInitials('Отдел по работе'), 'ОР');
});

test('C152 (3): two letters from 1/3, one at 1/4, the medium weight', async () => {
  const [picture, sheet] = await Promise.all([
    read('src/smart/avatar/js/picture.js'),
    read('src/component/avatars/scss/_css__avatars.scss'),
  ]);
  assert.match(picture, /if \(String\(size \?\? ""\) !== "1\/4"\) return value;/u);
  assert.match(picture, /value\.match\(\/\^\(\\p\{L\}\\p\{M\}\*\)\\p\{L\}\/u\)/u);
  assert.match(sheet, /font-weight: var\(--sf-avatar--font-weight, var\(--sf-font-weight-medium\)\);/u);
});

test('C152 (4): the square corner grows with the step: 4, 8, 12', async () => {
  const sheet = uncomment(await read('src/component/avatars/scss/_css__avatars.scss'));
  assert.match(sheet, /\.sf-avatar--square:is\(\.sf-avatar--size-1\\\/4, \.sf-avatar--size-1\\\/3\) \{\s*--sf-avatar--square-radius: var\(--sf-radius-1\\\/2\);/u);
  assert.match(sheet, /\.sf-avatar--square:is\(\.sf-avatar--size-1\\\/2, \.sf-avatar--size-1\) \{\s*--sf-avatar--square-radius: var\(--sf-radius-1\);/u);
  assert.match(sheet, /\.sf-avatar--square:is\(\.sf-avatar--size-2, \.sf-avatar--size-3\) \{\s*--sf-avatar--square-radius: var\(--sf-b2\);/u);
  // --sf-avatar-radius still wins.
  assert.match(sheet, /--sf-avatar--border-top-left-radius: var\(--sf-avatar-radius, var\(--sf-avatar--square-radius\)\);/u);
});

test('C152 (5): online and away draw; offline draws nothing; the word joins the name', async () => {
  const [shared, element, indicator, ru, en, manifest] = await Promise.all([
    read('src/smart/avatar/js/templates/shared.js'),
    read('src/smart/avatar/index.js'),
    read('src/component/avatars/scss/_css__avatar_online_indicator.scss'),
    json('src/smart/avatar/lang/ru.json'),
    json('src/smart/avatar/lang/en.json'),
    json('src/smart/avatar/component.json'),
  ]);
  assert.match(shared, /if \(!\["online", "away"\]\.includes\(context\.status\)\) \{\s*return nothing;/u);
  assert.match(element, /if \(this\.status === "away"\) return this\.sfWord\("status-away"\);/u);
  assert.equal(ru.runtime['status-away'], 'отошёл');
  assert.equal(en.runtime['status-away'], 'away');
  assert.deepEqual(manifest.settings.status.values, ['none', 'online', 'away', 'offline', 'company', 'verified']);
  assert.match(indicator, /\.sf-online-indicator--away \{\s*--sf-online-indicator--background-color: var\(--sf-surface-place, transparent\);\s*box-shadow: inset 0 0 0 var\(--sf-online-indicator--ring-width\) var\(--sf-on-surface-variant\)/u);
});

test('C152 (6): the group shows four, «+N» a button with the list, named «Участники: N»', async () => {
  const [template, element, ru, en, manifest, sheet] = await Promise.all([
    read('src/smart/avatar-group/js/templates/default.js'),
    read('src/smart/avatar-group/index.js'),
    json('src/smart/avatar-group/lang/ru.json'),
    json('src/smart/avatar-group/lang/en.json'),
    json('src/smart/avatar-group/component.json'),
    read('src/component/avatars/scss/_css__avatars_group.scss'),
  ]);
  assert.match(template, /const SHOWN = 4;/u);
  assert.match(template, /const withList = list\.length > SHOWN;/u);
  assert.match(template, /<sf-popover class="sf-avatar-group-more"[\s\S]*?<button slot="trigger" type="button" class=\$\{avatarClasses\(plus\)\} aria-label=/u);
  assert.match(template, /role="group" aria-label=\$\{groupLabel \|\| nothing\}/u);
  // The hue of the name.
  assert.match(template, /hue: item\.hue \|\| \(name \? 'auto' : ''\)/u);
  // Overlap 4 up to 1, 8 at 2 and 3.
  assert.match(template, /function groupStep\(size\) \{\s*if \(size === '2' \|\| size === '3'\) return '1\/3';\s*return '1\/4';\s*\}/u);
  assert.match(element, /group: \(count\) => this\.sfWord\('group-label', \{count\}\)/u);
  assert.equal(ru.runtime['group-label'], 'Участники: {n}');
  assert.equal(ru.runtime['more-label'].many, 'Ещё {n} участников');
  assert.equal(en.runtime['group-label'], 'Members: {n}');
  assert.deepEqual(Object.keys(manifest.settings.avatars.of), ['image-url', 'text', 'name', 'status', 'hue']);
  assert.ok(manifest.relations.some((rel) => rel.name === 'cl-popover' && rel.lazy === true));
  // The cut-out is the point's ring (C132), unchanged.
  assert.match(sheet, /--sf-avatar-group--ring: var\(--sf-micro--ring-#\{\$size\}\);/u);
});

test('C152 (7): the name in the Framework tooltip where no name is printed', async () => {
  const [shared, element, group, manifest] = await Promise.all([
    read('src/smart/avatar/js/templates/shared.js'),
    read('src/smart/avatar/index.js'),
    read('src/smart/avatar-group/js/templates/default.js'),
    json('src/smart/avatar/component.json'),
  ]);
  assert.match(shared, /<span class="sf-avatar-anchor sf-tooltip-anchor">\$\{trigger\}<span\s+class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1\/3 sf-tooltip--arrow-bottom-center sf-avatar-tooltip"\s+id=\$\{tipId\} hidden>/u);
  assert.match(element, /if \(this\.templateName !== "default" \|\| this\.mode === "picture"\) return "";/u);
  assert.match(group, /return withNameTooltip\(face, name, tipId\);/u);
  assert.ok(manifest.relations.some((rel) => rel.name === 'tooltip' && rel.lazy === true));
  assert.doesNotMatch(shared, /\stitle=/u);
});

test('C152 (8): the presence point of a slotted avatar stands on the ring at 45 degrees', async () => {
  const ring = await read('src/component/progress-ring/scss/_css__progress_ring.scss');
  assert.match(ring, /\.sf-progress-ring \.sf-progress-ring-content > sf-avatar \.sf-online-indicator,/u);
  assert.match(ring, /\* sin\(45deg\)/u);
  assert.match(ring, /inset-block-end: calc\(var\(--sf-progress-ring--point-inset\) - var\(--sf-avatar--border-bottom-width, 0px\)\);\s*inset-inline-end: calc\(var\(--sf-progress-ring--point-inset\) - var\(--sf-avatar--border-inline-end-width, 0px\)\);/u);
  assert.match(ring, /--sf-online-indicator--width: var\(--sf-micro--point-#\{\$size\}\);/u);
});

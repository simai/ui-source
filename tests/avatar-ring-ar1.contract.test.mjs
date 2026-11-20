// fix/avatar-ring-ar1 (DEV msg-5f9510f3 AR-1..4, KB-4; msg-1d170e4d RG-S1-24):
// AR-1, AR-2 hold on the released pair (5.20261115.1622); AR-3, KB-4 and the
// AR-4 warning are fix/dot-avatar-badge-c185, which this branch carries. Here:
// the ring takes a lone avatar as its content (AR-4, the preferred way), the
// avatar's caption wraps a word longer than the line and a no-wrap line
// carries its full text (RG-S1-24, owner decision C152 (7)), and the avatar's
// sources say 1/4 = 16 (AR-3). Measured in a browser on a build; these pin
// the source that makes it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));

test('AR-4: a lone avatar child is the ring\'s content', async () => {
  const [ring, docs, manifest] = await Promise.all([
    read('src/smart/progress-ring/index.js'),
    read('src/smart/progress-ring/docs.md'),
    json('src/smart/progress-ring/component.json'),
  ]);
  const capture = ring.match(/captureSlotTemplates\(\) \{([\s\S]*?)\n  \}/u);
  assert.ok(capture, 'the ring takes its slots through its own captureSlotTemplates');
  const body = capture[1];
  // Before the slots are taken, and only where no child names the content slot.
  assert.match(body, /if \(!this\._slotTemplatesCaptured && !this\.querySelector\(':scope > \[slot="content"\]'\)\)/u);
  // A printed first paint is not a child.
  assert.match(body, /filter\(\(child\) => !child\.hasAttribute\('data-sf-static'\)\)/u);
  // The only element child, an sf-avatar or a class avatar, without a slot of its own.
  assert.match(body, /children\.length === 1 && !only\.hasAttribute\('slot'\)/u);
  assert.match(body, /only\.localName === 'sf-avatar' \|\| only\.classList\?\.contains\('sf-avatar'\)/u);
  assert.match(body, /only\.setAttribute\('slot', 'content'\);/u);
  assert.match(body, /super\.captureSlotTemplates\(\);\s*$/u);
  // One the ring cannot take is still said.
  assert.match(ring, /an sf-avatar inside the ring beside other content is drawn beside the ring/u);
  assert.match(docs, /A lone sf-avatar child written without it\nis taken as the content too \(1\.6\.0\)/u);
  assert.equal(manifest.version, '1.7.0'); // look answers: «100%» in the middle // C282: 1.6.0 moved on by the language-file patch (Russian is a language file) // group build 13: 1.6.3 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.ok(manifest['x-decisions'].some((note) => /^version 1\.6\.0 \(2026-11-16, fix\/avatar-ring-ar1/u.test(note))); // C282: moved on by the language-file patch (Russian is a language file)
});

test('RG-S1-24: the caption wraps a long word; a no-wrap line carries its full text', async () => {
  const [sheet, label, avatar, passport, docs] = await Promise.all([
    read('src/component/avatars/scss/_css__avatar_label_group.scss'),
    read('src/smart/avatar/js/templates/label.js'),
    json('src/smart/avatar/component.json'),
    json('src/component/avatars/passport.json'),
    read('src/smart/avatar/docs/docs.md'),
  ]);
  assert.match(sheet, /\.sf-avatar-label-group \.sf-avatar-label-group-container \{[^}]*min-inline-size: 0;[^}]*overflow-wrap: break-word;\s*\}/u);
  assert.match(label, /import \{ html, nothing \} from "lit";/u);
  assert.match(label, /class="sf-avatar-label-group-title\$\{context\.noWrap \? ' overflow-hidden wrap-none t-ellipsis' : ''\}" title=\$\{context\.noWrap \? context\.heading : nothing\}>/u);
  assert.match(label, /class="sf-avatar-label-group-text\$\{context\.noWrap \? ' overflow-hidden wrap-none t-ellipsis' : ''\}" title=\$\{context\.noWrap \? context\.description : nothing\}>/u);
  // No comment node in the drawing.
  assert.doesNotMatch(label, /<!--/u);
  assert.match(avatar.settings['no-wrap'].summary, /the full text is each line's title/u);
  assert.match(docs, /^- `no-wrap` -- the label template keeps the heading and the description on one$/mu);
  assert.equal(avatar.version, '1.8.6'); // C282: 1.8.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.8.3 moved on by the merged branches or a GB10 patch // group build 13: 1.8.4 moved on by the merged branches or the C278 language patch // group build 14: 1.8.5 moved on by the merged branches or the C278 language patch
  assert.equal(passport.version, '1.12.1'); // group build 9: 1.10.1 moved on by the merged branches or a GB9 patch // group build 10: 1.12.0 moved on by the merged branches or a GB10 patch
});

test('AR-3: the avatar sources say 1/4 = 16 on every screen', async () => {
  const [sheet, docs, avatar] = await Promise.all([
    read('src/component/avatars/scss/_css__avatars.scss'),
    read('src/smart/avatar/docs/docs.md'),
    json('src/smart/avatar/component.json'),
  ]);
  assert.doesNotMatch(sheet, /1\/4 is 20/u);
  assert.doesNotMatch(sheet, /20 \/ 24 \/ 32 \/ 40 \/ 48 \/ 56 become/u);
  assert.match(docs, /^- `size`: `1\/4 \| 1\/3 \| 1\/2 \| 1 \| 2 \| 3` -- 16 \/ 24 \/ 32 \/ 40 \/ 48 \/ 56 px on a$/mu);
  assert.match(docs, /16 \/ 20 \/ 28 \/ 36 \/ 44 \/ 52 on a phone/u);
  assert.doesNotMatch(avatar.settings.size.summary, /desktop 20 \/|ladder is 20 \//u);
});

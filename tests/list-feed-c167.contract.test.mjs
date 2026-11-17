import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {unfoldModes, paintBlocks} from './support/paint-blocks.mjs';

// sf-list 1.11.0, sf-list-feed 1.2.0, group-heading 1.1.0 (owner decision
// C167, 2026-11-14; study ui-control control/research/2026-11-14-list-feed.md):
// the points built without a new name, held without a browser. The behaviour
// is probed on the built bytes by the probe.json checks (sf-list p7,
// sf-list-feed p8) and measured in the C167 evidence. Points (1) and (5), and
// the feed's own day and «Новые» lines, wait for names the decision does not
// give.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const code = (path) => read(path).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');

test('C167 (2): the day divider is the shared part, quiet medium words on a line, 12 above and 4 below, sticky by class', () => {
  const sheet = unfoldModes(read('src/component/group-heading/scss/_group-heading.scss')); // C273: mode blocks unfolded
  assert.match(sheet, /\.sf-group-heading--divider \{\n\s*flex-wrap: nowrap;\n\s*align-items: center;\n\s*gap: var\(--sf-space-1\\\/2\);\n\s*margin-block: var\(--sf-space-1\\\/2\) var\(--sf-space-1\\\/4\);\n\s*font-size: var\(--sf-text-size-1\\\/2\);\n\s*line-height: var\(--sf-text-height-1\\\/2\);\n\s*font-weight: var\(--sf-weight--medium\);/u);
  // C273: the words' colour is paint
  assert.match(paintBlocks(sheet), /\.sf-group-heading--divider \{\s*color: var\(--sf-group-heading-date-color, var\(--sf-on-surface-variant\)\);/u);
  assert.match(sheet, /\.sf-group-heading--sticky \{\n\s*position: sticky;/u);
  assert.equal(json('src/component/group-heading/passport.json').version, '1.2.0'); // 1.2.0: C273
});

test('C167 (3): a row with a count is unread, its title semibold', () => {
  const template = code('src/smart/list/js/templates/default.js');
  // 1.15.0 (C189 (8)): unreadOf says a row with a count is unread, and a
  // letter marked unread: true without one.
  assert.match(template, /\$\{context\.unreadOf\(item\) \? "sf-list__row--unread" : ""\}/u);
  assert.match(code('src/smart/list/index.js'), /function unreadOf\(item\) \{\n\s*if \(countOf\(item\)\) return true;/u);
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list__row--unread > sf-list-item > \.sf-list-item \.sf-list-item-title \{\n\s*font-weight: var\(--sf-weight--semi-bold\);/u);
  assert.ok(['1.11.0', '1.12.0', '1.14.0', '1.15.0', '1.16.0', '1.17.0', '1.18.0', '1.19.0', '1.20.2', '1.21.1', '1.21.4', '1.22.0', '1.23.0'].includes(json('src/smart/list/component.json').version)); // 1.14.0: fix/first-paint-fp (group build 6)
});

test('C167 (4): the feed\'s default entry is a comment, the author over it, no fill', () => {
  const source = code('src/smart/list-feed/index.js');
  assert.match(source, /if \(first && \(name \|\| moment\)\) \{\n\s*const author = doc\.createElement\("p"\);/u);
  const sheet = read('src/smart/list-feed/js/templates/default.css');
  const text = /\.sf-list-feed__text \{([^}]*)\}/u.exec(sheet)?.[1] ?? '';
  assert.doesNotMatch(text, /background|padding|border-radius/u, 'no capsule');
  assert.doesNotMatch(sheet, /\.sf-list-feed__item--own \.sf-list-feed__(?:entry|text)/u, 'one\'s own comment is not set apart');
  assert.match(sheet, /\.sf-list-feed__entry \{[^}]*align-self: stretch;/u);
  assert.ok(['1.2.0', '1.3.0', '1.3.1', '1.3.2', '1.4.0', '1.4.1', '1.5.1', '1.5.3'].includes(json('src/smart/list-feed/component.json').version)); // 1.3.1: group build 7 patch
});

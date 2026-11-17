// Block list (component sets, point 13; duplication audit 2026-11-03, A-4 and
// A-6): sf-list, the list a person acts on, and sf-list-feed, the column a
// person reads from the newest at the end. sf-list-feed takes over package
// pro's sf-message-log on the core reading position
// (src/core/js/reading-position.js); sf-list draws its rows as sf-list-item.
// Their behaviour on the built bytes is held by tests/browser/list.browser.mjs
// and list-feed.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('both are the Framework\'s, family list, registered and in the rule', () => {
  const names = json('contracts/registry/names.json');
  const flat = JSON.stringify(names);
  for (const [folder, tag, version] of [['list', 'sf-list', '1.21.1'], ['list-feed', 'sf-list-feed', '1.5.1']]) { // C282: both patched for the language file // group build 7: list-feed's patch for moved files // group build 8: both patched for the C185 dot sheet in their first-paint sheet lists
    const contract = json(`src/smart/${folder}/component.json`);
    assert.equal(contract.tag, tag);
    assert.equal(contract.family, 'list', folder);
    assert.equal(contract.version, version, folder);
    assert.ok(flat.includes(`"${tag}"`), `${tag} is in the name registry`);
    assert.match(read('src/core/js/rule.src.js'), new RegExp(`smart/${folder}/rule\\.js`, 'u'));
    assert.match(read(`src/smart/${folder}/index.js`), new RegExp(`\\.define\\("${tag}"\\)`, 'u'));
    const ru = json(`src/smart/${folder}/lang/ru.json`).runtime;
    const en = json(`src/smart/${folder}/lang/en.json`).runtime;
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort(), `${folder}: the same words in both languages`);
  }
});

test('sf-list: rows are sf-list-item, one Tab stop, one shared menu, the next page by the core edge watch', () => {
  const contract = json('src/smart/list/component.json');
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['actions', 'divided', 'empty-text', 'group-by', 'groups', 'has-more', 'heading-level', 'items', 'label', 'leading', 'lines', 'loading', 'no-wrap', 'renamable', 'selected', 'size', 'sticky-headings', 'time-format']);
  assert.deepEqual(contract.settings['group-by'].enum ?? contract.settings['group-by'].values, ['none', 'day', 'key']);
  assert.deepEqual(Object.keys(contract.events).sort(), ['apply', 'load-more', 'open', 'rename']);
  assert.equal(contract.events.rename.cancelable, true);
  assert.equal(contract.events['load-more'].cancelable, true);
  assert.deepEqual(Object.keys(contract.actions).sort(),
    ['append-items', 'detach', 'more-failed', 'open-menu', 'rename', 'request-more', 'set-items', 'upsert']);
  const template = read('src/smart/list/js/templates/default.js');
  // The row is the Framework's row, interactive, inside one [data-sf-list].
  assert.match(template, /<sf-list-item\s+interactive/u);
  assert.equal([...template.matchAll(/^\s+data-sf-list$/gmu)].length, 1);
  // «⋯» is not a Tab stop of its own; the row actions open in the page's one
  // menu (core SF.menu.open, owner decision C184 (4)), not in a menu of the list's.
  assert.match(template, /class="sf-list__actions[^"]*"\s+tabindex="-1"\s+aria-haspopup="menu"/u);
  assert.equal([...template.matchAll(/<sf-menu-context/gu)].length, 0);
  assert.match(template, /<sf-empty-state kind="no-data"/u);
  const source = read('src/smart/list/index.js');
  assert.match(source, /import \{EDGE_MARGIN, scrollerOf, watchEdge\} from "\.\.\/\.\.\/core\/js\/reading-position\.js";/u);
  assert.match(source, /formatRelativeDay\(moment, \{now, capital: true, node: this\}\)/u);
  assert.match(source, /this\.sfEmit\("load-more", \{direction: "after", after:/u);
  // A refused rename puts the old title back.
  assert.match(source, /if \(!this\.sfEmit\("rename", \{id, text\}\)\) item\.text = before;/u);
  // The sheet reads its public variables and sets no public variable of the row.
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.doesNotMatch(sheet, /--sf-list-item-[a-z][a-z-]*\s*:/u);
});

test('sf-list 1.1.0: avatar, count, badge and pinned are bounded row data drawn with the Framework\'s parts', () => {
  const contract = json('src/smart/list/component.json');
  const of = contract.settings.items.of;
  assert.deepEqual(Object.keys(of).sort(),
    ['actions', 'avatar', 'badge', 'count', 'date', 'disabled', 'group', 'icon', 'id', 'pinned', 'supporting', 'text', 'unread']);
  // Additions only: no setting, event or action of 1.0.0 changed (1.2.0 adds no-wrap, 1.17.0 leading, 1.18.0 lines).
  assert.deepEqual(Object.keys(contract.settings).sort(),
    ['actions', 'divided', 'empty-text', 'group-by', 'groups', 'has-more', 'heading-level', 'items', 'label', 'leading', 'lines', 'loading', 'no-wrap', 'renamable', 'selected', 'size', 'sticky-headings', 'time-format']);
  const item = contract['x-registry'].contracts.item.properties;
  assert.deepEqual(item.avatar.properties.shape.enum, ['circle', 'square']);
  // The badge's tone is the Framework's status vocabulary.
  assert.deepEqual([...item.badge.properties.tone.enum].sort(), [...json('contracts/public-api-axes.json').status_vocabulary].sort());
  // A tag it renders is a tag it fetches.
  const relations = contract.relations.map((relation) => relation.name);
  for (const name of ['cl-avatar', 'cl-badge', 'cl-list-item']) assert.ok(relations.includes(name), name);
  assert.match(read('src/smart/list/rule.js'), /\{ name: 'cl-avatar' \},\n\s+\{ name: 'cl-badge' \}/u);
  const template = read('src/smart/list/js/templates/default.js');
  // The parts are the Framework's: sf-avatar's drawing, sf-badge; no renderer a host hands in.
  // The avatar is a picture, not an sf-avatar element (a button, a Tab stop; LI-10).
  assert.doesNotMatch(template, /<sf-avatar\b/u);
  assert.match(template, /avatarPicture\(\{[^}]*hue: "auto"/su);
  // The count is a quantity, grey tonal (C140 (3); LI-8).
  assert.match(template, /<sf-badge class="sf-list__count" line=\$\{line\} appearance="tonal"/u);
  assert.match(template, /<sf-badge class="sf-list__badge" line=\$\{line\} appearance="tonal"/u);
  // A row is a dense place: both keep the tight side room (sf-badge 1.3.0).
  assert.match(template, /class="sf-list__count" line=\$\{line\} appearance="tonal" tight/u);
  assert.match(template, /class="sf-list__badge" line=\$\{line\} appearance="tonal" tight/u);
  assert.doesNotMatch(read('src/smart/list/index.js'), /render(Row|Item|er)\s*[:=(]/u);
  // The slot elements are the row template's own, never a value of it: the
  // row takes its slot nodes once (smart-base captureSlotTemplates).
  assert.match(template, /><span slot="leading" class="sf-list__lead">\$\{leadContent\(context, item\)\}<\/span><span\n\s+slot="trailing" class="sf-list__meta">\$\{metaContent\(context, item, group\)\}<\/span><\/sf-list-item>`/u);
  assert.equal([...template.matchAll(/slot="trailing" class="sf-list__meta"/gu)].length, 2);
  // Pinned leads; the words in both languages, the count in plural forms.
  const source = read('src/smart/list/index.js');
  assert.match(source, /list\.unshift\(\{key: "pinned", heading: this\.sfWord\("pinned-text"\), items: pinned\}\)/u);
  assert.equal(json('src/smart/list/lang/ru.json').runtime['pinned-text'], 'Закреплённые');
  assert.equal(json('src/smart/list/lang/en.json').runtime['pinned-text'], 'Pinned');
  assert.deepEqual(Object.keys(json('src/smart/list/lang/ru.json').runtime['count-label']).sort(), ['few', 'many', 'one', 'other']);
  // The changelog line.
  assert.ok(contract['x-decisions'].some((line) => line.startsWith('version 1.1.0 (owner decision q-3b313e2246')));
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list__meta:empty \{ display: none; \}/u);
});

test('sf-list 1.2.0: no-wrap cuts a row\'s text with an ellipsis and keeps it whole in its tooltip; rows and «⋯» are 44px under a finger', () => {
  const contract = json('src/smart/list/component.json');
  assert.equal(contract.settings['no-wrap'].type, 'boolean');
  assert.equal(contract.settings['no-wrap'].default, false);
  assert.equal(json('src/smart/list/smart.manifest.json').inputs.properties['no-wrap'].type, 'boolean');
  assert.ok(contract['x-decisions'].some((line) => line.startsWith('version 1.2.0 (the UI Chat thread\'s request msg-f44b9ece')));
  const template = read('src/smart/list/js/templates/default.js');
  // The class on the frame and the whole text as the row's tooltip, on both row templates.
  assert.match(template, /\$\{context\.noWrap \? " sf-list--no-wrap" : ""\}/u);
  assert.match(template, /const tip = context\.noWrap \? \(supporting \? `\$\{text\} · \$\{supporting\}` : text\) : "";/u);
  assert.equal([...template.matchAll(/title=\$\{tip \|\| nothing\}/gu)].length, 2);
  const sheet = read('src/smart/list/js/templates/default.css');
  assert.match(sheet, /\.sf-list--no-wrap \.sf-list__row > sf-list-item > \.sf-list-item \.sf-list-item-container \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/u);
  // Under a finger: --sf-d1 for the rows, the rename field, the loading rows and the «⋯»; nothing on hover only.
  const touch = sheet.slice(sheet.indexOf('@media (pointer: coarse)'));
  assert.match(touch, /--sf-list--touch-height: max\(var\(--sf-list--row-height\), var\(--sf-d1\)\)/u);
  assert.match(touch, /\.sf-list__row > sf-list-item > \.sf-list-item \{ min-block-size: var\(--sf-list--touch-height\); \}/u);
  assert.match(touch, /\.sf-list__actions \{\s+min-block-size: var\(--sf-d1\);\s+min-inline-size: var\(--sf-d1\);/u);
  assert.doesNotMatch(sheet, /\.sf-list__actions[^{]*\{[^}]*(opacity|visibility)\s*:/u);
});

test('sf-list-feed: sf-message-log\'s behaviour under the list family\'s names, on the core reading position', () => {
  const contract = json('src/smart/list-feed/component.json');
  assert.deepEqual(Object.keys(contract.settings).sort(), ['changes', 'has-more', 'items', 'label', 'live']);
  assert.deepEqual(Object.keys(contract.events).sort(), ['begun', 'cancelled', 'chunk', 'completed', 'failed', 'load-more']);
  assert.equal(contract.events['load-more'].cancelable, true);
  assert.deepEqual(Object.keys(contract.actions).sort(),
    ['announce', 'cancel', 'detach', 'earlier-failed', 'prepend-items', 'redraw', 'request-earlier', 'scroll-to-latest', 'set-items', 'set-view', 'upsert']);
  const source = read('src/smart/list-feed/index.js');
  assert.match(source, /import \{readingPosition\} from "\.\.\/\.\.\/core\/js\/reading-position\.js";/u);
  assert.match(source, /this\._position\.keep\(/u);
  assert.match(source, /this\._position\.toEnd\(/u);
  // The message log's names stay in package pro: none is spelled here.
  for (const folder of ['index.js', 'js/templates/default.js', 'js/templates/default.css']) {
    assert.doesNotMatch(read(`src/smart/list-feed/${folder}`), /sf-message-log[-_]|renderMessage|announceMessage|setMessages|prependMessages/u, folder);
  }
  // The core helper is public, documented and published once.
  const api = JSON.stringify(json('src/core/contracts/public-js-api.json'));
  assert.ok(api.includes('SF.readingPosition'));
  assert.match(read('src/core/js/index.js'), /import '\.\/reading-position\.js';/u);
});

test('sf-list 1.5.0: a narrow list puts a row\'s badge and count under its text, measured by the list itself (C47)', () => {
  const source = read('src/smart/list/index.js');
  // The list measures its own frame: no page breakpoint and no setting.
  assert.match(source, /const NARROW_REM = 20;/u);
  assert.match(source, /new ResizeObserver\(/u);
  assert.match(source, /let narrow = width < NARROW_REM \* rem;/u);
  assert.match(source, /this\._widthObserver\?\.disconnect\(\);/u);
  // Also narrow when a row's title would keep less than half its text column
  // or 10rem on one line (follow-up: 55 px titles on a 366 px phone column).
  assert.match(source, /const TITLE_MIN_REM = 10;/u);
  assert.match(source, /return title < Math\.max\(column \/ 2, TITLE_MIN_REM \* rem\);/u);
  // The badges and counts are watched too, and the watch starts before the
  // sheets are in, so a late sheet paints no squeezed frame first.
  assert.match(source, /whenRenderedStylesReady\(target\) \{\s*this\.watchWidth\(\);\s*return super\.whenRenderedStylesReady\(target\);/u);
  assert.match(source, /observer\.observe\(meta\)/u);
  assert.match(source, /observer\.unobserve\(meta\)/u);
  // 1.5.1: the frame's width is watched on .sf-list__width, a box of no height
  // out of the flow; the frame itself, whose height the narrow layout changes,
  // is not observed (a ResizeObserver loop error on every narrow list).
  assert.match(source, /this\._widthObserver\.observe\(width\);/u);
  assert.doesNotMatch(source, /_widthObserver\.observe\(frame\)/u);
  assert.match(read('src/smart/list/js/templates/default.js'), /<span class="sf-list__width" aria-hidden="true"><\/span>/u);
  const widthRule = read('src/smart/list/js/templates/default.css').match(/\.sf-list__width \{([^}]*)\}/u)?.[1] ?? '';
  for (const declaration of ['position: absolute;', 'block-size: 0;', 'inset-inline: 0;']) assert.ok(widthRule.includes(declaration), declaration);
  const contract = json('src/smart/list/component.json');
  assert.equal(Object.keys(contract.settings).some((name) => /narrow|breakpoint/u.test(name)), false);
  // The template never binds the mark, so a redraw keeps it.
  assert.doesNotMatch(read('src/smart/list/js/templates/default.js'), /data-sf-list-narrow/u);
  const css = read('src/smart/list/js/templates/default.css');
  // The row grows by whole bands: the step --sf-space-1/4 and the badge's height.
  assert.match(css, /\[data-sf-list-narrow\] \.sf-list__row \.sf-list-item:not\(\.sf-list-item--two-line\) > \.sf-list-item-wrap:has\(> \.sf-list__meta:not\(:empty\)\) \{\s*display: grid;\s*grid-template-columns: auto minmax\(0, 1fr\);\s*row-gap: var\(--sf-space-1\\\/4\);/u);
  assert.match(css, /\[data-sf-list-narrow\] \.sf-list__row \.sf-list-item:not\(\.sf-list-item--two-line\) > \.sf-list-item-wrap > \.sf-list__meta:not\(:empty\) \{\s*grid-column: -2;\s*grid-row: 2;\s*justify-self: start;\s*(?:\/\*[^*]*\*\/\s*)?margin-inline-start: 0;\s*padding-inline-start: 0;/u);
  // No raw length in the rule: every value is a token.
  const narrow = css.slice(css.indexOf('[data-sf-list-narrow]'), css.indexOf('.sf-list__body,'));
  assert.ok(narrow.length > 0);
  assert.doesNotMatch(narrow, /\d+px|\d+rem/u);
});

test('owner decision C148: the list row -- end column, one Tab stop with arrows into its controls, no lines but divided, one line or lines="2", long press', () => {
  const item = json('src/smart/list-item/component.json');
  assert.equal(item.version, '1.6.2'); // group build 7: the patch for moved files (the line had 1.6.0) // C282: 1.6.1 moved on by the language-file patch (Russian is a language file)
  assert.deepEqual([item.settings.divided.type, item.settings.divided.default], ['boolean', false]);
  assert.deepEqual([item.settings.lines.values, item.settings.lines.default], [['1', '2'], '1']);
  const list = json('src/smart/list/component.json');
  assert.deepEqual([list.settings.divided.type, list.settings.divided.default], ['boolean', false]);
  const sheet = read('src/component/dropdown/scss/_css__list-item.scss');
  // (4) no line by default; divided draws one from the text, none under the last row.
  assert.match(sheet, /--sf-list-item--border-bottom-width: 0;/u);
  assert.match(sheet, /:is\(:not\(li\) > sf-list-item:last-child, li:last-child > sf-list-item\) > \.sf-list-item\.sf-list-item--divided/u);
  // (2) the end column: the title's line over the caption's, no step between them.
  assert.match(sheet, /grid-template-rows: var\(--sf-list-item--title-line\) var\(--sf-list-item-supporting--line-height\);/u);
  // (5) one line with an ellipsis, two with lines="2".
  assert.match(sheet, /\.sf-list-item\.sf-list-item--lines-2[^{]*\{[^}]*-webkit-line-clamp: 2;/u);
  // (6) a finger's target for the row's buttons.
  assert.match(sheet, /min-block-size: var\(--sf-d1\);\s*min-inline-size: var\(--sf-d1\);/u);
  const row = read('src/smart/list-item/index.js');
  // (3) the controls take no Tab stop; the arrows and Escape walk them.
  assert.match(row, /function tameControls\(row\)/u);
  assert.match(row, /onControlKeyDown\(event, row\)/u);
  assert.match(row, /\['Escape', 'ArrowUp', 'ArrowDown'\]\.includes\(event\.key\)/u);
  assert.match(row, /markCut\(\)/u);
  // (6) the long press, shared by the row and the list (no swipe).
  const press = read('src/smart/list-item/js/long-press.js');
  assert.match(press, /const LONG_PRESS_MS = 500;/u);
  assert.doesNotMatch(press + row, /swipe\w*\(/u);
  const source = read('src/smart/list/index.js');
  assert.match(source, /import \{watchLongPress\} from "\.\.\/list-item\/js\/long-press\.js";/u);
  assert.match(source, /querySelector\(":scope > \.sf-list__actions"\)/u);
  // The list's badge and count take the caption's line in a two-line row.
  assert.match(read('src/smart/list/js/templates/default.js'), /const line = item\.supporting \? "text" : context\.size;/u);
});

test('sf-list 1.14.0: the narrow layout is a container query on the frame, so a printed first paint is narrow before any script (C47, DEV msg-e5f5f6524)', () => {
  const css = read('src/smart/list/js/templates/default.css');
  const source = read('src/smart/list/index.js');
  // The frame is the container sf-list; below 20rem (the size step g0, C47's
  // width) the rows lay out narrow from the sheet alone.
  assert.match(css, /\.sf-list__frame \{\s*container: sf-list \/ inline-size;\s*\}/u);
  const query = css.match(/@container sf-list \(inline-size < 20rem\) \{([\s\S]*?)\n  \}\n/u)?.[1] ?? '';
  assert.ok(query, 'the container query is in the sheet');
  const marked = css.slice(css.indexOf('  .sf-list__frame[data-sf-list-narrow]'), css.indexOf('.sf-list__body,'));
  // The same rules, as strong as the marked ones (the frame's two classes).
  const rules = (text, prefix) => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
    .map(([, selector, body]) => [selector.replace(/\/\*[\s\S]*?\*\//gu, '').trim().replaceAll(prefix, '').replace(/\s+/gu, ' '), body.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\s+/gu, ' ').trim()]);
  const inQuery = rules(query, '.sf-list__frame.sf-list ');
  const byMark = rules(marked, '.sf-list__frame[data-sf-list-narrow] ');
  assert.equal(inQuery.length, 6); // 6 since group build 7: register smart-2's narrow caption row (RG-S2-34)
  assert.deepEqual(inQuery, byMark);
  assert.doesNotMatch(query, /\d+px/u);
  // The code marks the frame only where the query does not answer: a title
  // squeezed by a long badge, no sheet yet, or a frame taken out of the
  // query because a shrink-to-fit place would fold it.
  assert.match(source, /const queried = style\.containerType === "inline-size";/u);
  assert.match(source, /if \(narrow && queried\) \{\s*frame\.removeAttribute\(NARROW\);\s*return;\s*\}/u);
  assert.match(source, /const FIT = "data-sf-list-fit";/u);
  assert.match(css, /\.sf-list__frame\[data-sf-list-fit\] \{\s*container-type: normal;\s*\}/u);
  // The fit check ends the observer's callback on the layout it began with
  // (no ResizeObserver loop) and changes it in the next frame.
  const check = source.slice(source.indexOf('    checkFit(frame) {'), source.indexOf('    // On one line: the title'));
  assert.match(check, /frame\.toggleAttribute\(FIT, !had\);[\s\S]*frame\.toggleAttribute\(FIT, had\);/u);
  assert.match(check, /requestAnimationFrame\(\(\) => \{[\s\S]*frame\.toggleAttribute\(FIT, fit\);/u);
  // 1.14.0 brought the container query; later versions keep it (group build 7).
  assert.ok(Number(json('src/smart/list/component.json').version.split('.')[1]) >= 14);
});

test('sf-list 1.16.0: a skeleton row keeps the leading place of the rows it stands for (C130, C148 (1))', () => {
  const source = read('src/smart/list/index.js');
  const template = read('src/smart/list/js/templates/default.js');
  const sheet = read('src/smart/list/js/templates/default.css');
  // The shape is the rows' own, kept across items = [] for a reload; none before rows were shown.
  assert.match(source, /skeletonShape\(\) \{/u);
  assert.match(source, /const shown = this\._shownShape \?\? \{twoLine: true, lead: null\};/u);
  assert.match(source, /skeleton: this\.skeletonShape\(\),/u);
  // The skeleton row draws the place in sf-list-item's leading slot: sf-avatar's own box, or the icon square.
  assert.match(template, /kind=\$\{lead \? "icon" : "text"\}/u);
  assert.match(template, /sf-avatar sf-avatar--picture \$\{box\}\$\{shape\} sf-first-paint-fill sf-list__lead-skeleton/u);
  assert.match(template, /sf-first-paint-fill sf-list__lead-skeleton sf-list__lead-skeleton--icon/u);
  assert.match(sheet, /\.sf-list__skeleton--lead-wide \{ --sf-list--lead-size: var\(--sf-list--lead-block\); \}/u);
  assert.match(sheet, /\.sf-list__lead-skeleton\.sf-first-paint-fill \{\n\s*background-color: var\(--sf-skeleton-base\);/u);
  assert.match(sheet, /\.sf-list__lead-skeleton--icon \{[^}]*inline-size: var\(--sf-list--lead-line\);[^}]*border-radius: var\(--sf-radius--ui\);/u);
});

test('sf-list 1.17.0: leading says the skeleton\'s leading place from the first frame (C130, C148 (1))', () => {
  const contract = json('src/smart/list/component.json');
  const manifest = json('src/smart/list/smart.manifest.json');
  const source = read('src/smart/list/index.js');
  // The setting: auto | none | icon | avatar, auto by default (1.16.0's behaviour).
  assert.deepEqual(contract.settings.leading.values, ['auto', 'none', 'icon', 'avatar']);
  assert.equal(contract.settings.leading.default, 'auto');
  assert.deepEqual(manifest.inputs.properties.leading.enum, ['auto', 'none', 'icon', 'avatar']);
  // The rows' own place is leadingPlace(); the setting shapes the skeleton alone.
  assert.match(source, /leadingPlace\(\) \{/u);
  assert.match(source, /leading: this\.leadingPlace\(\),/u);
  assert.doesNotMatch(source, /this\.leading\(\)/u);
  // (1.18.0: the line count is the setting lines' twoLine, auto = the rows shown.)
  assert.match(source, /if \(declared === "auto"\) return \{twoLine, lead: learned \? \{\.\.\.learned, wide\} : shown\.lead\};/u);
  assert.match(source, /if \(declared === "none"\) return \{twoLine, lead: null\};/u);
  assert.match(source, /if \(declared === "icon"\) return \{twoLine, lead: \{kind: "icon"\}\};/u);
  assert.match(source, /return \{twoLine, lead: \{kind: "avatar", wide, shape: learned \? learned\.shape : "circle"\}\};/u);
  // The example and its printed first paint: three skeleton rows, each with the avatar's box of the list's step.
  const example = json('src/smart/list/examples.json').examples.find((one) => one.name === 'loading-avatar');
  assert.deepEqual(example.settings, {label: 'Беседы', loading: true, leading: 'avatar'});
  const printed = read('src/smart/list/static/default/loading-avatar.html');
  assert.match(printed, /leading="avatar"/u);
  assert.equal((printed.match(/sf-avatar sf-avatar--picture sf-avatar--size-1 sf-first-paint-fill sf-list__lead-skeleton/gu) || []).length, 3);
  assert.match(printed, /sf-list__skeleton sf-list__skeleton--lead-wide/u);
});

test('sf-list 1.18.0: lines says the skeleton rows\' line count from the first frame (C130)', () => {
  const contract = json('src/smart/list/component.json');
  const manifest = json('src/smart/list/smart.manifest.json');
  const source = read('src/smart/list/index.js');
  // The setting: auto | 1 | 2, auto by default (1.17.0's behaviour: the rows shown, the caption row before any).
  assert.deepEqual(contract.settings.lines.values, ['auto', '1', '2']);
  assert.equal(contract.settings.lines.default, 'auto');
  assert.deepEqual(manifest.inputs.properties.lines.enum, ['auto', '1', '2']);
  assert.match(source, /const twoLine = lines === "auto" \? shown\.twoLine : lines === "2";/u);
  // A declared count gives an avatar's place its width; auto keeps the width the rows shown had.
  assert.match(source, /const wide = learned && lines === "auto" \? learned\.wide : twoLine;/u);
  // The example and its printed first paint: three one-line skeleton rows, each with the one-line avatar box.
  const example = json('src/smart/list/examples.json').examples.find((one) => one.name === 'loading-one-line');
  assert.deepEqual(example.settings, {label: 'Беседы', loading: true, leading: 'avatar', lines: '1'});
  const printed = read('src/smart/list/static/default/loading-one-line.html');
  assert.match(printed, /lines="1"/u);
  assert.equal((printed.match(/sf-avatar sf-avatar--picture sf-avatar--size-1 sf-avatar--line-1 sf-first-paint-fill sf-list__lead-skeleton/gu) || []).length, 3);
  assert.doesNotMatch(printed, /sf-list__skeleton--lead-wide|sf-list-item--two-line|sf-list__bar--supporting/u);
});

test('sf-list 1.19.0: a right click on a row opens its menu at the pointer (C164 (1), TL-2)', () => {
  const source = readFileSync(new URL('../src/smart/list/index.js', import.meta.url), 'utf8');
  assert.match(source, /this\.addEventListener\("contextmenu", \(event\) => this\.onRowContextMenu\(event\)\);/u);
  assert.match(source, /onRowContextMenu\(event\) \{\s*if \(event\.shiftKey \|\| event\.defaultPrevented\) return;/u);
  assert.match(source, /this\.openMenu\(id, \{x: event\.clientX, y: event\.clientY\}\);/u);
  assert.match(source, /\.\.\.\(point \?\? \{anchor\}\),/u);
});

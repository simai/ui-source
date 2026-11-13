// sf-breadcrumbs and the class component against the defects of R177
// (control/research/2026-11-12-breadcrumbs.md, BC-01..BC-11) and owner
// decision C93. The arithmetic and the item reading are pure modules and run
// here; what only a browser shows (focus, room, first paint) is in the
// conformance page of src/smart/breadcrumbs/examples.json (checks p7..p10).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

import {capRange, collapseRange, cutBelowMin, cutByRoom, fitRange, LABEL_MIN_EM, maxFitHidden, menuEntries, nextFit, starvedFit, trailOverflows, trailStarved} from '../src/component/breadcrumbs/js/_trail.js';
import {markCurrent, normalizeItem, parseItems, readFlag} from '../src/smart/breadcrumbs/js/items.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const trail = (items, mode) => markCurrent(parseItems(items), mode);
const pages = (items) => items.filter((item) => item.current).map((item) => item.label);

test('BC-01: the last crumb is the page unless the items say otherwise', () => {
  assert.deepEqual(pages(trail('[{"label":"А","href":"/"},{"label":"Б"}]')), ['Б']);
  // current: false on the last crumb is kept: a trail of parents.
  const parents = trail('[{"label":"simai.ru","href":"/"},{"label":"Данные","href":"/data","current":false}]');
  assert.deepEqual(pages(parents), []);
  // A one-crumb trail can be a link.
  assert.deepEqual(pages(trail('[{"label":"Раздел","href":"#r","current":false}]')), []);
  // A crumb that says current is the page, wherever it stands; only one is.
  assert.deepEqual(pages(trail('[{"label":"А","current":true},{"label":"Б","current":true},{"label":"В"}]')), ['Б']);
  // The flag form says it too.
  assert.deepEqual(pages(trail('А::href=/|Б::current=false')), []);
  assert.deepEqual(pages(trail('А|Б|В')), ['В']);
});

test('BC-01: current="none" is a trail of parents, no crumb is the page', () => {
  assert.deepEqual(pages(trail('[{"label":"А","href":"/"},{"label":"Б","href":"/b"}]', 'none')), []);
  assert.deepEqual(pages(trail('[{"label":"А","current":true}]', 'none')), []);
  assert.equal(trail('[{"label":"А","active":true}]', 'none')[0].active, false);
});

test('BC-01: a flag reads true, false or nothing', () => {
  assert.equal(readFlag(undefined), undefined);
  assert.equal(readFlag(null), undefined);
  assert.equal(readFlag(false), false);
  assert.equal(readFlag('false'), false);
  assert.equal(readFlag('0'), false);
  assert.equal(readFlag(''), true);
  assert.equal(readFlag('true'), true);
  assert.equal(normalizeItem({label: 'А'}).currentFlag, undefined);
  assert.equal(normalizeItem({label: 'А', current: false}).currentFlag, false);
  // The element reads the property's items once more: the flag survives.
  const twice = (items) => markCurrent(parseItems(items).map((item, index, all) => normalizeItem(item, index, all.length)));
  assert.deepEqual(pages(twice('[{"label":"А","href":"/"},{"label":"Б"}]')), ['Б']);
  assert.deepEqual(pages(twice('[{"label":"А","href":"/"},{"label":"Б","href":"/b","current":false}]')), []);
});

test('BC-06, BC-11: a cap keeps the shape it always had', () => {
  // The arithmetic both runtimes kept before, copied once here as the reference.
  const before = (count, max) => {
    if (max < 3 || count <= max) return null;
    const leading = Math.floor((max - 1) / 2);
    const trailing = max - 1 - leading;
    return count - leading - trailing > 0 ? {start: leading, end: count - trailing} : null;
  };
  for (let count = 0; count <= 10; count += 1) {
    for (let max = 0; max <= 8; max += 1) {
      assert.deepEqual(capRange(count, max), before(count, max), `count ${count}, max ${max}`);
    }
  }
});

test('BC-06: room hides the middle first, then the first crumb, never the tail', () => {
  const shown = (count, fit, tail = 2) => {
    const range = collapseRange(count, {fit, tail});
    return Array.from({length: count}, (_, index) => index)
      .filter((index) => !range || index < range.start || index >= range.end);
  };
  assert.deepEqual(shown(6, 0), [0, 1, 2, 3, 4, 5]);
  // Two at least (L1): one crumb behind «…» saves no width.
  assert.deepEqual(shown(6, 1), [0, 3, 4, 5]);
  assert.deepEqual(shown(6, 2), [0, 3, 4, 5]);
  assert.deepEqual(shown(6, 3), [0, 4, 5]);
  // «… › parent › page» (C93 item 2).
  assert.deepEqual(shown(6, 4), [4, 5]);
  assert.deepEqual(shown(6, 9), [4, 5]);
  // A trail of parents keeps its parent.
  assert.deepEqual(shown(3, 9, 1), [2]);
  assert.equal(maxFitHidden(2, 2), 0);
  assert.equal(fitRange(2, 1, 2), null);
  // «Главная › Настройки › Почта» never becomes «… › Настройки › Почта».
  assert.equal(maxFitHidden(3, 2), 0);
  assert.equal(fitRange(3, 1, 2), null);
  // A trail of parents «simai.ru › Данные» never becomes «… › Данные».
  assert.equal(maxFitHidden(2, 1), 0);
  assert.deepEqual(fitRange(4, 1, 2), {start: 0, end: 2});
});

test('BC-06: room asks for more than the cap only when the cap is not enough', () => {
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 0}), {start: 1, end: 4});
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 3}), {start: 1, end: 4});
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 4}), {start: 0, end: 4});
  assert.equal(nextFit(6, {maxItems: 4, fit: 0}), 4);
  assert.equal(nextFit(6, {maxItems: 4, fit: 4}), null);
  assert.equal(nextFit(6, {fit: 0}), 2);
  assert.equal(nextFit(2, {fit: 0}), null);
  // No cap by default (C93 item 1): nothing folds until room asks.
  assert.equal(collapseRange(9, {}), null);
});

// A fake crumb: a container with a label of `text` px in a box of `room` px,
// the container capped at `cap` px (NaN: no cap).
const crumb = ({text = 40, room = text, cap = NaN} = {}) => {
  const label = {scrollWidth: text, clientWidth: Math.min(text, room)};
  const container = {
    querySelector: () => label,
    getBoundingClientRect: () => ({width: Math.min(text, room, Number.isNaN(cap) ? Infinity : cap)}),
    cap,
  };
  return {
    classList: {contains: () => false},
    matches: () => true,
    querySelector: () => container,
    getBoundingClientRect: () => ({top: 0, height: 28, width: Math.min(text, room)}),
  };
};
const view = {getComputedStyle: (element) => ({maxInlineSize: Number.isNaN(element.cap) ? 'none' : `${element.cap}px`})};
const row = (scrollWidth = 300, clientWidth = 300) => ({scrollWidth, clientWidth});

test('BC-06, L1: a crumb is cut for want of room only below its own cap', () => {
  // Whole name: no want of room.
  assert.equal(cutByRoom(crumb({text: 80}), view), false);
  // An ancestor cut at its cap (C93 item 6) is cut by design, not by room.
  assert.equal(cutByRoom(crumb({text: 300, cap: 192}), view), false);
  // Cut narrower than its cap: the row ran out of room.
  assert.equal(cutByRoom(crumb({text: 300, room: 120, cap: 192}), view), true);
  // The page has no cap: cut at all (the phone's ellipsis) is want of room.
  assert.equal(cutByRoom(crumb({text: 300, room: 120}), view), true);
});

test('BC-06, L1, L2: the trail folds only when the row has no room', () => {
  // A trail that fits stays whole, on every ladder.
  assert.equal(trailOverflows(row(), [crumb(), crumb({text: 300, cap: 192}), crumb({text: 90})], view), false);
  // A row wider than its box.
  assert.equal(trailOverflows(row(340, 300), [crumb()], view), true);
  // A crumb squeezed below its cap, or the page's name cut on the phone.
  assert.equal(trailOverflows(row(), [crumb(), crumb({text: 300, room: 60, cap: 192})], view), true);
  assert.equal(trailOverflows(row(), [crumb(), crumb({text: 300, room: 60})], view), true);
  // An entry below the first (a page that wraps the row by its own CSS).
  const low = {...crumb(), getBoundingClientRect: () => ({top: 34, height: 28, width: 40})};
  assert.equal(trailOverflows(row(), [crumb(), low], view), true);
  // A page name wrapped by words in the rest of the row is taller, not lower.
  const tall = {...crumb(), getBoundingClientRect: () => ({top: 0, height: 48, width: 200})};
  assert.equal(trailOverflows(row(), [crumb(), tall], view), false);
  // Hidden entries take no part.
  assert.equal(trailOverflows(row(), [crumb(), {...low, hidden: true}], view), false);
  assert.equal(trailOverflows(null, [], view), false);
});

test('N1 (nav-4b): a crumb cut below a few letters folds, the parent with it', async () => {
  const sized = {getComputedStyle: (element) => ({...view.getComputedStyle(element), fontSize: '14px'})};
  assert.equal(LABEL_MIN_EM, 3);
  // Whole, or cut but still three letters and more (3em of 14 px = 42 px): reads.
  assert.equal(cutBelowMin(crumb({text: 30}), sized), false);
  assert.equal(cutBelowMin(crumb({text: 300, room: 42, cap: 192}), sized), false);
  // Cut to less: no crumb at all; a cut to nothing too.
  assert.equal(cutBelowMin(crumb({text: 300, room: 20, cap: 192}), sized), true);
  assert.equal(cutBelowMin(crumb({text: 300, room: 0}), sized), true);
  // Separators, «…» and the siblings button are never starved; hidden entries take no part.
  const sep = {...crumb({text: 300, room: 0}), classList: {contains: (name) => name === 'sf-breadcrumbs-item--separator'}};
  const button = {...crumb({text: 300, room: 0}), hasAttribute: (name) => name === 'aria-expanded'};
  assert.equal(trailStarved([crumb(), sep, button], sized), false);
  assert.equal(trailStarved([crumb(), crumb({text: 300, room: 10})], sized), true);
  assert.equal(trailStarved([crumb(), {...crumb({text: 300, room: 10}), hidden: true}], sized), false);
  // The last fold: «… › current». A trail of parents keeps its parent; two crumbs never fold.
  assert.deepEqual(starvedFit(5, {tail: 2}), {tail: 1, fit: 4});
  assert.deepEqual(fitRange(5, 4, 1), {start: 0, end: 4});
  assert.deepEqual(starvedFit(3, {tail: 2}), {tail: 1, fit: 2});
  assert.deepEqual(fitRange(3, 2, 1), {start: 0, end: 2});
  assert.equal(starvedFit(5, {tail: 1}), null);
  assert.equal(starvedFit(2, {tail: 2}), null);
  assert.equal(nextFit(5, {fit: 4, tail: 1}), null);
  // Both runtimes take the last fold only after room has hidden all it may.
  const [classic, smart, sheet, itemSheet] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
    read('src/component/breadcrumbs/scss/_css__breadcrumbs.scss'),
    read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss'),
  ]);
  assert.match(classic, /trailStarved\(getLineEntries\(root\)\) \? starvedFit\(items\.length, \{ tail \}\)/);
  assert.match(smart, /trailStarved\(this\.trailEntries\(\)\) \? starvedFit\(items\.length, options\)/);
  assert.match(smart, /restartFit\(\) \{\n\s+this\._fitHidden = 0;\n\s+this\._fitTail = null;/);
  // «…» never shrinks: its entry and the button keep their size.
  assert.match(sheet, /> li:has\(> \.sf-breadcrumbs-item\[aria-expanded\]:not\(\[data-sf-breadcrumb-siblings\]\)\) \{\n\s+flex: none;/);
  assert.match(itemSheet, /\.sf-breadcrumbs-item\[aria-expanded\] \{\n\s+justify-content: center;\n\s+min-inline-size: var\(--sf-breadcrumbs--target\);\n\s+flex: none;/);
});

test('L1: both runtimes fold by room from the whole trail on every ladder', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  for (const source of [classic, smart]) {
    assert.match(source, /trailOverflows\(/);
    assert.doesNotMatch(source, /\bstartFit|onPhoneLadder|foldGains|trailLines/);
  }
  assert.match(smart, /fit: this\._fitHidden,/);
  assert.match(classic, /let fit = 0;/);
  assert.match(smart, /restartFit\(\)/);
  // A two-crumb trail never hides one crumb behind «…»: nothing can fold.
  assert.equal(nextFit(2, {fit: 0, tail: 2}), null);
  assert.equal(nextFit(2, {fit: 0, tail: 1}), null);
  assert.equal(nextFit(3, {fit: 0, tail: 2}), null);
  assert.equal(nextFit(4, {fit: 0, tail: 2}), 2);
});

test('BC-11: both runtimes fold with the one shared module', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  assert.match(classic, /from '\.\/_trail'/);
  assert.match(smart, /from '\.\.\/\.\.\/component\/breadcrumbs\/js\/_trail'/);
  for (const source of [classic, smart]) {
    assert.doesNotMatch(source, /Math\.floor\(visibleSlots \/ 2\)/);
    assert.match(source, /collapseRange\(/);
    assert.match(source, /trailOverflows\(/);
    assert.match(source, /ResizeObserver/);
  }
});

test('C93 items 1, 3: «…» and siblings open menus', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  assert.match(smart, /this\.openMenu\(item\.hiddenItems \|\| \[\], event\.currentTarget/);
  assert.match(smart, /menu\.toggleFor\(anchor, \{ align: 'start' \}\)/);
  assert.match(smart, /handleSiblingsClick = /);
  assert.match(classic, /openHiddenMenu\(root, ellipsis, hiddenItems\)/);
  assert.deepEqual(menuEntries([{label: 'А', href: '/a'}, {label: 'Б', current: true, value: 'b'}]), [
    {id: '0', text: 'А', href: '/a'},
    {id: '1', text: 'Б', value: 'b', current: true, checked: true},
  ]);
});

test('C93 items 5, 6: grey links, cut ancestor names with a tooltip', async () => {
  const [itemSheet, smart, classic] = await Promise.all([
    read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss'),
    read('src/smart/breadcrumbs/index.js'),
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
  ]);
  assert.match(itemSheet, /--sf-breadcrumbs-link-hover-color, var\(--sf-on-surface\)/);
  assert.match(itemSheet, /text-decoration-line: underline;/);
  assert.match(itemSheet, /max-inline-size: var\(--sf-breadcrumbs--label-max, var\(--sf-f2\)\);/);
  assert.match(itemSheet, /text-overflow: ellipsis;/);
  for (const source of [smart, classic]) assert.match(source, /setAttribute\('title', label\.textContent\.trim\(\)\)/);
});

test('BC-02: opening «…» moves focus to the first crumb it revealed', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  assert.match(classic, /function focusRevealed\(root, first\)/);
  assert.match(classic, /expandBreadcrumbs\(root, hiddenItems\[0\]\)/);
  assert.match(smart, /focusRevealed\(index\)/);
  assert.match(smart, /\{ next: true \}/);
  assert.match(smart, /target\.focus\(\{ preventScroll: true \}\)/);
});

test('BC-03, BC-05, BC-09, BC-10: the template', async () => {
  const template = await read('src/smart/breadcrumbs/js/templates/default.js');
  // BC-03: «…» says it is closed.
  assert.match(template, /aria-expanded=\$\{item\.ellipsis \? 'false' : nothing\}/);
  assert.match(template, /aria-haspopup=\$\{item\.ellipsis \? 'menu' : nothing\}/);
  // C93 item 3: the siblings button, only when the host says siblings.
  assert.match(template, /if \(!context\.siblings \|\| item\.ellipsis \|\| !item\.siblings\?\.length\) return nothing;/);
  assert.match(template, /<sf-menu-context\n\s+class="sf-breadcrumbs-menu"\n\s+popup/);
  // BC-05: a crumb with neither href nor value is text.
  assert.match(template, /if \(item\.href\) return 'a';\n {2}if \(item\.ellipsis \|\| item\.value\) return 'button';\n {2}return 'div';/);
  // BC-09: a list, one entry per crumb.
  assert.match(template, /<ol>[\s\S]*<li>[\s\S]*<\/li>[\s\S]*<\/ol>/);
  // BC-10: the name comes from the host or the language file.
  assert.doesNotMatch(template, /'Breadcrumb'/);
  // BC-07: no utility class in the drawn markup.
  assert.doesNotMatch(template, /\bitems-cross-center\b|['" ]flex['" ]/);
});

test('BC-03, BC-04, BC-07, BC-08: the class sheet', async () => {
  const [rootSheet, itemSheet] = await Promise.all([
    read('src/component/breadcrumbs/scss/_css__breadcrumbs.scss'),
    read('src/component/breadcrumbs/scss/_css__breadcrumbs_item.scss'),
  ]);
  // BC-04: the phone ladder and compact read the body step; the desktop one step under.
  const phone = rootSheet.slice(0, rootSheet.indexOf('@media (min-width: 60rem)'));
  const desktop = rootSheet.slice(rootSheet.indexOf('@media (min-width: 60rem)'));
  assert.match(phone, /--sf-breadcrumbs--text-size: var\(--sf-text-size-1\);/);
  assert.match(desktop, /\.sf-breadcrumbs,\n\s+\[data-sf-density="compact"\] \[data-sf-density="normal"\] \.sf-breadcrumbs \{\n\s+--sf-breadcrumbs--text-size: var\(--sf-text-size-1\\\/2\);/);
  assert.match(desktop, /\[data-sf-density="compact"\] \.sf-breadcrumbs \{\n\s+--sf-breadcrumbs--text-size: var\(--sf-text-size-1\);/);
  assert.doesNotMatch(rootSheet + itemSheet, /--sf-text-size-1\\\/3|--sf-text-size-1\\\/4/);
  assert.match(itemSheet, /--sf-breadcrumbs-item-container--font-size: var\(--sf-breadcrumbs--text-size,/);
  assert.match(itemSheet, /--sf-icon--height: var\(--sf-breadcrumbs--text-height,/);
  // BC-03, BC-04: the target is the 1/3 control height; «…» is its square.
  assert.match(rootSheet, /--sf-breadcrumbs--target: var\(--sf-ui-1\\\/3--control-height\);/);
  assert.match(itemSheet, /\.sf-breadcrumbs-item:is\(a, button\) \{\n\s+min-block-size: var\(--sf-breadcrumbs--target\);/);
  assert.match(itemSheet, /\.sf-breadcrumbs-item\[aria-expanded\] \{\n\s+justify-content: center;\n\s+min-inline-size: var\(--sf-breadcrumbs--target\);/);
  // BC-07: the sheet draws the row itself.
  assert.match(rootSheet, /\.sf-breadcrumbs \{\n\s+display: flex;\n\s+align-items: center;/);
  assert.match(rootSheet, /\.sf-breadcrumbs > :is\(ol, ul\) \{\n\s+display: flex;/);
  assert.match(itemSheet, /\.sf-breadcrumbs-item \.sf-breadcrumbs-item-container \{\n\s+display: flex;\n\s+align-items: center;/);
  // BC-08: the ring has the radius of the Framework's links and buttons.
  assert.match(itemSheet, /\.sf-breadcrumbs-item \{\n\s+display: flex;\n\s+align-items: center;\n\s+min-inline-size: min-content;\n[^}]*border-radius: var\(--sf-radius--ui\);/);
});

test('BC-07, BC-09: the class runtime reads the list form and prints no utility class', async () => {
  const classic = await read('src/component/breadcrumbs/js/breadcrumbs.js');
  assert.match(classic, /child\.tagName === 'OL' \|\| child\.tagName === 'UL'/);
  assert.match(classic, /document\.createElement\('li'\)/);
  assert.doesNotMatch(classic, /items-cross-center/);
  // No cap unless the page sets one.
  assert.match(classic, /Math\.max\(0, Math\.floor\(maxItems\)\) : 0;/);
});

test('the manifest names the new setting and the new default', async () => {
  const manifest = JSON.parse(await read('src/smart/breadcrumbs/component.json'));
  assert.equal(manifest.version, '1.2.4'); // above every branch's 1.2.3
  assert.deepEqual(manifest.settings.current.values, ['last', 'none']);
  assert.equal(manifest.settings.current.default, 'last');
  assert.equal(manifest.settings['max-items'].default, 0);
  assert.equal(manifest.settings.siblings.default, false);
  assert.ok(manifest.relations.some((relation) => relation.name === 'cl-menu-context' && relation.lazy === true));
  const passport = JSON.parse(await read('src/component/breadcrumbs/passport.json'));
  assert.equal(passport.version, '1.1.4'); // above every branch's 1.1.3
  assert.ok(passport.files.includes('src/component/breadcrumbs/js/_trail.js'));
});

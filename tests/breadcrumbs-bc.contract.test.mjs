// sf-breadcrumbs and the class component against the defects of R177
// (control/research/2026-11-12-breadcrumbs.md, BC-01..BC-11) and owner
// decision C93. The arithmetic and the item reading are pure modules and run
// here; what only a browser shows (focus, room, first paint) is in the
// conformance page of src/smart/breadcrumbs/examples.json (checks p7..p10).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

import {capRange, collapseRange, fitRange, foldGains, maxFitHidden, menuEntries, nextFit, onPhoneLadder, startFit, trailLines, trailWraps} from '../src/component/breadcrumbs/js/_trail.js';
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
  assert.deepEqual(shown(6, 1), [0, 2, 3, 4, 5]);
  assert.deepEqual(shown(6, 3), [0, 4, 5]);
  // «… › parent › page» (C93 item 2).
  assert.deepEqual(shown(6, 4), [4, 5]);
  assert.deepEqual(shown(6, 9), [4, 5]);
  // A trail of parents keeps its parent.
  assert.deepEqual(shown(3, 9, 1), [2]);
  assert.equal(maxFitHidden(2, 2), 0);
  assert.equal(fitRange(2, 1, 2), null);
  assert.deepEqual(fitRange(3, 1, 2), {start: 0, end: 1});
});

test('BC-06: room asks for more than the cap only when the cap is not enough', () => {
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 0}), {start: 1, end: 4});
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 3}), {start: 1, end: 4});
  assert.deepEqual(collapseRange(6, {maxItems: 4, fit: 4}), {start: 0, end: 4});
  assert.equal(nextFit(6, {maxItems: 4, fit: 0}), 4);
  assert.equal(nextFit(6, {maxItems: 4, fit: 4}), null);
  assert.equal(nextFit(6, {fit: 0}), 1);
  assert.equal(nextFit(2, {fit: 0}), null);
  // No cap by default (C93 item 1): nothing folds until room asks.
  assert.equal(collapseRange(9, {}), null);
});

test('BC-06: a trail wraps when a crumb starts a new row or its words wrap', () => {
  const box = (top, height, width = 40) => ({hidden: false, getBoundingClientRect: () => ({top, height, width})});
  // A row of 28 px targets and 20 px text crumbs, centred.
  assert.equal(trailWraps([box(0, 28), box(4, 20), box(0, 28)]), false);
  assert.equal(trailWraps([box(0, 28), box(34, 28)]), true);
  assert.equal(trailWraps([box(0, 28), box(0, 48)]), true);
  assert.equal(trailWraps([box(0, 28), {hidden: true, getBoundingClientRect: () => ({top: 90, height: 28, width: 40})}]), false);
  assert.equal(trailWraps([]), false);
});

test('C93 item 1: a fold that saves no line gives the crumbs back', () => {
  const box = (top, height, width = 40) => ({hidden: false, getBoundingClientRect: () => ({top, height, width})});
  // One line of 28 px targets with a 20 px page centred in it.
  assert.equal(trailLines([box(0, 28), box(0, 28), box(4, 20)]), 1);
  // The page's own name on a line of its own, wrapped to two text lines.
  assert.equal(trailLines([box(0, 28), box(0, 28), box(36, 40)]), 2);
  assert.equal(trailLines([box(0, 28), box(36, 28), box(72, 20)]), 3);
  assert.equal(trailLines([]), 0);
  // Whole trail: 2 lines; folded as far as it goes: still 2. Nothing gained.
  assert.equal(foldGains(2, 2), false);
  // Whole trail: 3 lines; folded: 2. The fold stays.
  assert.equal(foldGains(3, 2), true);
  // Nothing measured at the start: keep what the fold did.
  assert.equal(foldGains(0, 2), true);
});

test('C93 item 1: both runtimes give the crumbs back when the fold saved no line', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  for (const source of [classic, smart]) {
    assert.match(source, /trailLines\(/);
    assert.match(source, /foldGains\(/);
  }
  assert.match(smart, /_fitNoGain = true/);
  assert.match(smart, /restartFit\(\)/);
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
    assert.match(source, /trailWraps\(/);
    assert.match(source, /ResizeObserver/);
  }
});

test('C93 items 1, 2, 3: «…» and siblings open menus; the phone starts at «… › parent › page»', async () => {
  const [classic, smart] = await Promise.all([
    read('src/component/breadcrumbs/js/breadcrumbs.js'),
    read('src/smart/breadcrumbs/index.js'),
  ]);
  assert.match(smart, /this\.openMenu\(item\.hiddenItems \|\| \[\], event\.currentTarget/);
  assert.match(smart, /menu\.toggleFor\(anchor, \{ align: 'start' \}\)/);
  assert.match(smart, /handleSiblingsClick = /);
  assert.match(classic, /openHiddenMenu\(root, ellipsis, hiddenItems\)/);
  for (const source of [classic, smart]) assert.match(source, /startFit\(items\.length, \{ tail, phone: onPhoneLadder\(\) \}\)/);
  assert.equal(startFit(6, {tail: 2, phone: true}), 4);
  assert.equal(startFit(6, {tail: 2, phone: false}), 0);
  assert.equal(onPhoneLadder({matchMedia: () => ({matches: false})}), true);
  assert.equal(onPhoneLadder({matchMedia: () => ({matches: true})}), false);
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
  assert.equal(manifest.version, '1.2.0');
  assert.deepEqual(manifest.settings.current.values, ['last', 'none']);
  assert.equal(manifest.settings.current.default, 'last');
  assert.equal(manifest.settings['max-items'].default, 0);
  assert.equal(manifest.settings.siblings.default, false);
  assert.ok(manifest.relations.some((relation) => relation.name === 'cl-menu-context' && relation.lazy === true));
  const passport = JSON.parse(await read('src/component/breadcrumbs/passport.json'));
  assert.equal(passport.version, '1.1.0');
  assert.ok(passport.files.includes('src/component/breadcrumbs/js/_trail.js'));
});

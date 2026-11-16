// RG-TS-1 / RG-TS-2 / RG-BD-1 (2026-11-16). The SF.notify stack (owner
// decision C50) is drawn by the toast sheet: core/js/notify.js only writes
// data-layout, data-placement and data-stack-layer and moves the messages; the
// sheet stands them on the area's edge, hides the fourth and fades the ones
// behind. A merge (b1ef9e87d, group build 3) dropped that block and every pair
// after it drew the notices as a plain list. This test holds the block in the
// source and, when the gate names a build (UI_CORE_ROOT=<ui root>, distr/
// beside), in the built sheet too.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\s+/gu, ' ');

const same = (selector) => selector.trim().replace(/\s*>\s*/gu, ' > ').replace(/"/gu, '');
// The declarations of every rule whose selector list holds `selector`, joined.
function declarations(css, selector) {
  const text = flat(css);
  const found = [];
  const rule = /([^{}]+)\{([^{}]*)\}/gu;
  for (const match of text.matchAll(rule)) {
    // The build writes attribute values unquoted ([data-layout=stack]).
    const selectors = match[1].split(',').map(same);
    if (selectors.includes(same(selector))) found.push(match[2].trim());
  }
  return found.join('; ');
}

const STACK = '.sf-notifications[data-layout="stack"]';
const expectations = [
  [STACK, /display: ?block/u],
  [`${STACK} > .sf-toast`, /position: ?absolute/u],
  [`${STACK} > .sf-toast`, /inset-inline: ?0/u],
  [`${STACK}[data-placement^="bottom"] > .sf-toast`, /inset-block-end: ?0/u],
  [`${STACK}[data-placement^="top"] > .sf-toast`, /inset-block-start: ?0/u],
  [`${STACK} > .sf-toast[data-stack-layer] > *`, /opacity: ?0/u],
  [`${STACK} > .sf-toast[data-stack-layer="hidden"]`, /visibility: ?hidden/u],
  [`${STACK} > .sf-toast[data-stack-entering]`, /opacity: ?0/u],
  [`${STACK} > .sf-toast.closing`, /opacity: ?0/u],
];

function holdsTheStack(css, where) {
  for (const [selector, declaration] of expectations) {
    assert.match(declarations(css, selector), declaration, `${where}: ${selector} ${declaration}`);
  }
  // RG-TS-2: the area is the window less its edges by its containing block,
  // not by 100vw (which counts a classic scrollbar).
  const area = declarations(css, '.sf-notifications');
  assert.match(area, /inline-size: ?min\([^;]*100%/u, `${where}: the area's width from 100%`);
  assert.doesNotMatch(area, /inline-size:[^;]*100vw/u, `${where}: no 100vw in the area's width`);
}

function holdsTheBadgeIcon(css, where) {
  const icon = declarations(css, '.sf-badge .sf-icon');
  assert.match(icon, /--sf-icon--height: ?var\(--sf-text-size-1\\?\/3\)/u, `${where}: unsized badge icon height 1/3`);
  assert.match(icon, /--sf-icon--width: ?var\(--sf-text-size-1\\?\/3\)/u, `${where}: unsized badge icon width 1/3`);
  assert.match(icon, /--sf-icon--font-size: ?var\(--sf-badge--font-size\)/u, `${where}: unsized badge icon font size`);
}

test('RG-TS-1: notify.js still writes what the stack rules read', () => {
  const notify = read('src/core/js/notify.js');
  assert.match(notify, /layout: 'stack'/u, 'the stack is the default layout (C50)');
  assert.match(notify, /area\.dataset\.layout = state\.layout/u);
  assert.match(notify, /toast\.dataset\.stackLayer = 'hidden'/u);
  assert.match(notify, /toast\.dataset\.stackEntering = ''/u);
});

test('RG-TS-1, RG-TS-2: the toast source holds the C50 stack and the area width', () => {
  holdsTheStack(read('src/component/toast/scss/_css__toast.scss'), 'source');
});

test('RG-BD-1: an unsized badge gives its icon the 1/3 size', () => {
  holdsTheBadgeIcon(read('src/component/badges/scss/_css__badges.scss'), 'source');
});

const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
const sheets = (folder) => readdirSync(folder).flatMap((name) => {
  const path = join(folder, name);
  return statSync(path).isDirectory() ? sheets(path) : name.endsWith('.css') && !name.endsWith('.min.css') ? [path] : [];
});
const built = (unit) => {
  const folder = join(distribution, 'components', unit);
  const roots = existsSync(folder) ? sheets(folder) : sheets(distribution).filter((path) => path.includes(`/${unit}/`));
  assert.ok(roots.length, `the build ships a ${unit} sheet`);
  return roots.map((path) => readFileSync(path, 'utf8')).join('\n');
};

test('RG-TS-1, RG-TS-2: the built toast sheet holds the stack', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  holdsTheStack(built('toast'), 'build');
});

test('RG-BD-1: the built badges sheet sizes the unsized icon', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  holdsTheBadgeIcon(built('badges'), 'build');
});

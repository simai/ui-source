// Copy and download rows (2026-11-16, studies actions-clipboard-study.html and
// actions-download-file-study.html, DEV msg-aef58b13).
//
// - C217 (owner, replaces RG-CP-1..3): sf-clipboard-surface is deprecated
//   until 2027-01-01 and draws as the plain icon button of its size (C201): no
//   plate in any state, the glyph on-surface-variant / on-surface / primary /
//   on-surface-disabled, the icon button's five sizes, no forced-colours edge.
// - RG-CP-4: the hidden status stands at the corner of its containing block,
//   so it never lies outside a scrolled table and widens the page.
// - RG-DF-1: a hovered file row keeps its grey frame.
// - RG-DF-2: the open_in_new sign is centred on the name's line.
// - The plain download parts the class does not build are noted as
//   deprecated.
//
// The source is read always; the built sheets when the gate names a build
// (UI_CORE_ROOT=<ui root>, distr/ beside).
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flat = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\s+/gu, ' ');

// Every [selector, body] of the sheet's innermost rules.
function rules(css) {
  const out = [];
  for (const match of flat(css).matchAll(/([^{}]+)\{([^{}]*)\}/gu)) out.push([match[1].trim(), match[2].trim()]);
  return out;
}

const surfaceRule = (selector) => /\.sf-clipboard-surface/u.test(selector) && /:not\(\.sf-button\)/u.test(selector);

function drawsThePlainCopy(css, where) {
  const all = rules(css);
  const surface = all.filter(([selector]) => surfaceRule(selector));
  assert.ok(surface.length >= 4, `${where}: the surface rules are there`);
  for (const [selector, body] of surface) {
    // No plate in any state (C201): no surface fill, no state overlay.
    assert.doesNotMatch(body, /background(?:-color)?: ?var\(--sf-surface/u, `${where}: ${selector} paints no plate`);
    assert.doesNotMatch(body, /background-image: ?linear-gradient/u, `${where}: ${selector} no state overlay`);
  }
  const rest = surface.filter(([selector]) => !/:(?:hover|active|focus-visible|disabled)|aria-disabled|> /u.test(selector));
  const restBody = rest.map(([, body]) => body).join('; ');
  assert.match(restBody, /background-color: ?transparent/u, `${where}: the resting surface is transparent`);
  assert.match(restBody, /--sf-icon--color: ?var\(--sf-on-surface-variant\)/u, `${where}: the resting glyph is on-surface-variant (C201)`);
  const state = (pseudo) => surface.filter(([selector]) => selector.includes(pseudo)).map(([, body]) => body).join('; ');
  assert.match(state(':hover'), /--sf-icon--color: ?var\(--sf-on-surface\)/u, `${where}: hover ink on-surface`);
  assert.match(state(':active'), /--sf-icon--color: ?var\(--sf-primary\)/u, `${where}: press ink primary`);
  // RG-CP-2: the five sizes of the icon button.
  for (const [size, box] of [['1\\\\?/3', 'ui-1\\\\?/3'], ['1\\\\?/2', 'ui-1\\\\?/2'], ['1', 'ui-1'], ['2', 'ui-2'], ['3', 'ui-3']]) {
    const sized = all.filter(([selector]) => new RegExp(`\\.sf-clipboard--size-${size}(?![\\w\\\\/-])`, 'u').test(selector));
    assert.match(sized.map(([, body]) => body).join('; '), new RegExp(`--sf-clipboard--box: ?var\\(--sf-${box}--control-height\\)`, 'u'), `${where}: size ${size} box`);
  }
  // RG-CP-3: the former block's forced-colours edge is not the surface's.
  const edged = all.filter(([, body]) => /solid ButtonText/u.test(body));
  for (const [selector] of edged) assert.match(selector, /:not\(\.sf-clipboard-surface\)/u, `${where}: ${selector} leaves the surface without an edge`);
}

function keepsTheStatusInside(css, where) {
  const status = rules(css).filter(([selector]) => /\.sf-clipboard-status/u.test(selector)).map(([, body]) => body).join('; ');
  assert.match(status, /position: ?absolute/u, `${where}: status absolute`);
  assert.match(status, /inset-block-start: ?0/u, `${where}: status at the block start (RG-CP-4)`);
  assert.match(status, /inset-inline-start: ?0/u, `${where}: status at the inline start (RG-CP-4)`);
}

function drawsTheFileRow(css, where) {
  const all = rules(css);
  const hover = all.filter(([selector]) => /\.sf-download-file:not/u.test(selector) && /:hover$/u.test(selector));
  assert.ok(hover.length, `${where}: a hover rule`);
  for (const [selector, body] of hover) {
    assert.doesNotMatch(body, /--sf-download-file--border-color/u, `${where}: ${selector} keeps the frame (RG-DF-1)`);
    assert.doesNotMatch(body, /primary-outline/u, `${where}: ${selector} no primary-outline frame`);
  }
  const tab = all.filter(([selector]) => /sf-download-file__text\)? ?> ?(?::where\()?\.sf-download-file__tab/u.test(selector)).map(([, body]) => body);
  assert.ok(tab.some((body) => /align-self: ?center/u.test(body)), `${where}: the open_in_new sign centred on the line (RG-DF-2)`);
}

test('C217: sf-clipboard-surface draws the plain icon button, five sizes, no edge', () => {
  drawsThePlainCopy(read('src/component/clipboard/scss/_sf_copy.scss'), 'source');
});

test('RG-CP-4: the status region stands at its containing block corner, in the sheet and inline', () => {
  keepsTheStatusInside(read('src/component/clipboard/scss/_sf_copy.scss'), 'source');
  const js = read('src/component/clipboard/js/index.js');
  assert.match(js, /const UNSEEN = 'position:absolute;inset-block-start:0;inset-inline-start:0;/u);
});

test('C217: the script notes sf-clipboard-surface in SF.deprecations; the journal records it', () => {
  const js = read('src/component/clipboard/js/index.js');
  assert.match(js, /from: 'sf-clipboard-surface'/u);
  assert.match(js, /remove_after: '2027-01-01'/u);
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'class-clipboard-surface-to-plain-icon-button');
  assert.ok(record, 'journal record');
  assert.equal(record.remove_after, '2027-01-01');
  assert.ok(record.items.some((item) => item.from === 'sf-clipboard-surface' && /sf-icon-button--plain/u.test(item.to)));
});

test('RG-DF-1, RG-DF-2: the file row keeps its frame on hover and centres the tab sign', () => {
  drawsTheFileRow(read('src/component/download-file/scss/_css_download-file.scss'), 'source');
});

test('the plain download parts are noted as deprecated; the journal records them', () => {
  const js = read('src/component/download-file/js/_download-file.js');
  assert.match(js, /notePlainParts\(root\);/u);
  for (const part of ['wrap', 'container', 'file-name', 'file-size']) assert.match(js, new RegExp(`'sf-download-file-${part}'`, 'u'));
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'class-download-file-plain-parts');
  assert.ok(record, 'journal record');
  assert.equal(record.items.length, 4);
});

const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
// The readable sheets, or the minified ones where a distribution ships only
// those (the published npm pair does).
const sheets = (folder, min = false) => readdirSync(folder).flatMap((name) => {
  const path = join(folder, name);
  return statSync(path).isDirectory() ? sheets(path, min) : name.endsWith('.css') && name.endsWith('.min.css') === min ? [path] : [];
});
const built = (unit) => {
  const folder = join(distribution, 'components', unit);
  const find = (min) => (existsSync(folder) ? sheets(folder, min) : sheets(distribution, min).filter((path) => path.includes(`/${unit}/`)));
  const readable = find(false);
  const roots = readable.length ? readable : find(true);
  assert.ok(roots.length, `the build ships a ${unit} sheet`);
  return roots.map((path) => readFileSync(path, 'utf8')).join('\n');
};
const noBuild = distribution ? false : 'UI_CORE_ROOT names no build';

test('C217, RG-CP-4: the built clipboard sheet', {skip: noBuild}, () => {
  const css = built('clipboard');
  drawsThePlainCopy(css, 'build');
  keepsTheStatusInside(css, 'build');
});

test('RG-DF-1, RG-DF-2: the built download-file sheet', {skip: noBuild}, () => {
  drawsTheFileRow(built('download-file'), 'build');
});

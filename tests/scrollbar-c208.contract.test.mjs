// Owner decision C208 (2026-11-15; research control/research/2026-11-15-scrollbar.md
// and prototypes/scrollbar-study.html in simai/ui-control): one scrollbar for the
// whole Framework. (1) one hover rule: rest the place's boundary, hover and drag
// the place's text, no width change; (2) no palette of its own, Firefox the same
// colour through scrollbar-color; (3) track 14, thumb 6 at every density, the
// overlay bar 2 -> 6, the width and colour utilities retire; (4) the bar takes its
// room except in strips and media; (5) a strip's track runs inside the content's
// inset, --sf-space-1/4 under the items, round ends. Defects SB-2, SB-3, SB-5,
// SB-7, SB-8 of the study.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {unfoldModes} from './support/paint-blocks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const core = read('src/core/scss/_sf_css__scroll.scss');
const bar = read('src/component/scrollbar/scss/_css__scrollbar.scss');
const runtime = read('src/component/scrollbar/js/_scrollbar.js');

function scss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) scss(path, out);
    else if (/\.s?css$/.test(name)) out.push(path);
  }
  return out;
}

// The text of every block opened by `opener` (brace-balanced), removed.
function without(text, opener) {
  let out = text;
  for (;;) {
    const at = out.search(opener);
    if (at < 0) return out;
    let i = out.indexOf('{', at), depth = 0;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}' && --depth === 0) break;
    }
    out = out.slice(0, at) + out.slice(i + 1);
  }
}

test('C208 (1): core draws one hover rule, the place text, with no width change', () => {
  assert.match(core, /--sf-scroll-bg-thumb:\s*var\(--sf-outline\)/);
  assert.match(core, /--sf-scroll--thumb-hover:\s*var\(--sf-on-surface\)/);
  assert.match(core, /::-webkit-scrollbar-thumb:hover,\s*::-webkit-scrollbar-thumb:active\s*\{\s*background-color:\s*var\(--sf-scroll--thumb-hover\);\s*\}/);
  const panel = unfoldModes(read('src/component/context-menu/scss/_panel.scss')); // C273: mode blocks unfolded
  assert.match(panel, /&::-webkit-scrollbar-thumb:hover,\s*&::-webkit-scrollbar-thumb:active\s*\{\s*background-color:\s*var\(--sf-scroll--thumb-hover\)/);
  assert.match(bar, /\.sf-scrollbar__track:hover \.sf-scrollbar__thumb::before,\s*\.sf-scrollbar\[data-sf-scrollbar-dragging="true"\] \.sf-scrollbar__thumb::before\s*\{\s*background:\s*var\(--sf-scrollbar--thumb-hover\)/);
});

test('C208 (2), SB-3: Firefox gets the same colour behind the support query', () => {
  assert.match(core, /@supports not selector\(::-webkit-scrollbar\)\s*\{\s*\*\s*\{\s*scrollbar-color:\s*var\(--sf-scroll-bg-thumb\) var\(--sf-scroll-bg-track\);\s*scrollbar-width:\s*thin;/);
});

test('SB-7: no sheet sets scrollbar-color or a thin/auto scrollbar-width outside the Firefox query or forced colours', () => {
  const offenders = [];
  for (const file of scss(resolve(root, 'src'))) {
    const text = without(without(readFileSync(file, 'utf8'), /@supports not selector\(::-webkit-scrollbar\)/), /@media\s*\(forced-colors:\s*active\)/);
    const stripped = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/scrollbar-color:\s*(?!auto)|scrollbar-width:\s*(?:thin|auto)/.test(stripped)) offenders.push(relative(root, file));
  }
  assert.deepEqual(offenders, []);
});

test('C208 (3): track 14 and thumb 6 from the a/b ladders; the gaps are two hooks (q-sb-gaps)', () => {
  assert.match(core, /--sf-scroll-bg-width:\s*var\(--sf-b4\)/);
  assert.match(core, /--sf-scroll-thumb-size:\s*var\(--sf-a6\)/);
  assert.match(core, /--sf-scroll--gap-content:\s*var\(--sf-scroll-thumb-inset\)/);
  assert.match(core, /--sf-scroll--gap-edge:\s*var\(--sf-scroll-thumb-inset\)/);
  assert.match(core, /::-webkit-scrollbar-thumb:vertical\s*\{\s*border-left-width:\s*var\(--sf-scroll--gap-content\);\s*border-right-width:\s*var\(--sf-scroll--gap-edge\)/);
  assert.match(core, /::-webkit-scrollbar-thumb:horizontal\s*\{\s*border-top-width:\s*var\(--sf-scroll--gap-content\);\s*border-bottom-width:\s*var\(--sf-scroll--gap-edge\)/);
  assert.doesNotMatch(read('src/core/scss/_sf_css__density.scss'), /--sf-scroll/);
  assert.match(bar, /--sf-scrollbar-rest-size:\s*var\(--sf-a2\)/);
  assert.match(bar, /--sf-scrollbar-active-size:\s*var\(--sf-a6\)/);
});

test('C208 (2), (3): the colour and width utilities retire through the one table', async () => {
  const {default: table} = await import('../src/core/js/retired-classes.table.js');
  const record = table.records.find((item) => item.journal === 'utility-c208-scrollbar-retired-sheets');
  assert.deepEqual(record.sheets, {'scroll-slider-color': null, 'scroll-slider-width': null, 'scroll-backdrop-width': null});
  assert.equal(record.remove_after, '2027-01-01');
  const {noteRetiredUtilitySheets} = await import('../src/core/js/utility-class-aliases.js');
  const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
  clearDeprecations();
  assert.equal(noteRetiredUtilitySheets('scroll-primary', ['scroll-slider-color/default']), true);
  assert.equal(noteRetiredUtilitySheets('scroll-2', ['scroll-slider-width/default']), true);
  assert.equal(noteRetiredUtilitySheets('scroll-bg-3', ['scroll-backdrop-width/default']), true);
  assert.equal(noteRetiredUtilitySheets('scroll-bg-primary', ['scroll-backdrop-color/default']), false, 'the track colour stays');
  assert.deepEqual(listDeprecations().map(({from, remove_after: date}) => `${from} ${date}`), ['scroll-primary 2027-01-01', 'scroll-2 2027-01-01', 'scroll-bg-3 2027-01-01']);
  clearDeprecations();
});

test('SB-2: the drawn thumb has round ends', () => {
  assert.match(bar, /\.sf-scrollbar__thumb\s*\{[^}]*border-radius:\s*var\(--sf-scroll-radius\)/);
  assert.match(bar, /\.sf-scrollbar__thumb::before\s*\{[^}]*border-radius:\s*var\(--sf-scroll-radius\)/);
});

test('C208 (4): the standard mode is the system bar; a persistent bar takes its room while the content overflows', () => {
  assert.doesNotMatch(bar, /data-mode="standard"[^{]*\{[^}]*scrollbar-(?:color|width)/);
  assert.match(bar, /\.sf-scrollbar:not\(\[data-sf-scrollbar-overflow="false"\]\):is\(\s*\[data-mode="persistent"\][^{]*\.sf-scrollbar__viewport\s*\{\s*padding-inline-end:\s*calc\(var\(--sf-scrollbar--gap-content\) \+ var\(--sf-scrollbar-active-size\) \+ var\(--sf-scrollbar--gap-edge\)\)/);
  assert.match(bar, /padding-block-end:\s*calc\(var\(--sf-scrollbar--gap-content\) \+ var\(--sf-scrollbar-active-size\) \+ var\(--sf-scrollbar--gap-edge\)\)/);
});

test('C208 (5), SB-5: a strip track runs inside the content inset, --sf-space-1/4 under the items', () => {
  assert.match(bar, /--sf-scrollbar--inset-inline:\s*var\(--sf-space-1\\\/2\)/);
  assert.match(bar, /--sf-scrollbar--gap-content:\s*var\(--sf-space-1\\\/4\)/);
  assert.match(bar, /\.sf-scrollbar__track--horizontal\s*\{[^}]*inset-inline:\s*var\(--sf-scrollbar--inset-inline\)/);
  assert.match(bar, /\.sf-scrollbar__thumb--horizontal::before\s*\{[^}]*inset-block:\s*auto var\(--sf-scrollbar--gap-edge\)/);
  // The thumb runs along the track, not along the area.
  assert.match(runtime, /const trackSize = trackLength > 0 \? trackLength : viewportSize;/);
  assert.match(runtime, /const maxThumbOffset = Math\.max\(0, trackSize - thumbSize\);/);
});

test('SB-8: on a touch screen the sizes are the variables, so 4 in 8 wins over persistent, hover and drag', () => {
  const coarse = bar.match(/@media \(pointer: coarse\)\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(coarse, /\.sf-scrollbar\s*\{\s*--sf-scrollbar-hit-size:\s*var\(--sf-a8\);\s*--sf-scrollbar-rest-size:\s*var\(--sf-a4\);\s*--sf-scrollbar-active-size:\s*var\(--sf-a4\);/);
  assert.doesNotMatch(coarse, /inline-size:\s*var\(--sf-a/);
});

test('the inverse place gives its text the other theme ink', () => {
  const bg = read('src/utility/background-color/default/scss/_sf_css__background_color.scss');
  const base = bg.slice(bg.indexOf('@layer sf.base'));
  assert.match(base, /\.bg-surface-inverse,\s*\.bg-surface-inverse-fixed\s*\{\s*color:\s*var\(--sf-on-surface\);\s*\}/);
});

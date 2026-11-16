// Owner decision C210 (2026-11-15; research control/research/2026-11-15-scrollbar-system.md
// and prototypes/scrollbar-system-study.html in simai/ui-control): one bar everywhere.
// (1) a strip of 14 (gap 4, thumb 6, 4 to the edge), transparent track, ends off the
// corners, round ends; shown while scrolling, at the strip, with focus inside and once
// on appearing, hidden 1 s after; the room stays; drawn over a transparent native
// spacer; touch keeps the system bar. (2) one colour: the place's boundary, hover does
// not change it, a held thumb takes --sf-on-surface-variant. (3) motion 0.12 / 0.3 /
// 0.15, none under reduced motion. (4) modifiers scrollbar-always, -thin, -flush,
// -square, -hidden and the same words in sf-scrollbar's data-mode. (5) the old modes,
// utilities and own bars retire with a dated alias.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const core = read('src/core/scss/_sf_css__scroll.scss');
const engine = read('src/core/js/scrollbars.js');
const bar = read('src/component/scrollbar/scss/_css__scrollbar.scss');
const runtime = read('src/component/scrollbar/js/_scrollbar.js');

test('C210 (1): the strip is 14 = 4 + 6 + 4 from the a/b ladders, kept by a transparent native spacer', () => {
  assert.match(core, /--sf-scroll-bg-width:\s*var\(--sf-b4\)/);
  assert.match(core, /--sf-scroll-thumb-size:\s*var\(--sf-a6\)/);
  assert.match(core, /--sf-scroll-thumb-inset:\s*var\(--sf-a4\)/);
  assert.match(core, /--sf-scroll--gap-content:\s*var\(--sf-scroll-thumb-inset\)/);
  assert.match(core, /--sf-scroll--gap-edge:\s*var\(--sf-scroll-thumb-inset\)/);
  const spacer = core.slice(core.indexOf('@media not ((pointer: coarse) or (forced-colors: active))'));
  assert.match(spacer, /::-webkit-scrollbar\s*\{\s*width:\s*var\(--sf-scroll-bg-width\);\s*height:\s*var\(--sf-scroll-bg-width\);/);
  assert.match(spacer, /::-webkit-scrollbar-thumb,\s*::-webkit-scrollbar-track,\s*::-webkit-scrollbar-corner\s*\{\s*background:\s*var\(--sf-transparent\);/);
  assert.match(spacer, /@supports not selector\(::-webkit-scrollbar\)\s*\{\s*\*\s*\{\s*scrollbar-color:\s*var\(--sf-transparent\) var\(--sf-transparent\);\s*scrollbar-width:\s*thin;/);
  // No area's native thumb is painted any more, so nothing draws twice; only the root's,
  // whose room no page paint reaches.
  for (const [, selector] of core.replace(/\/\/.*$/gm, '').matchAll(/([^{};/]*::-webkit-scrollbar-thumb[^{]*)\{[^}]*background(?:-color)?:\s*var\(--sf-scroll/g)) {
    assert.match(selector.trim(), /^html(?::dir\(rtl\))?::-webkit-scrollbar-thumb/, selector);
  }
  assert.match(core, /html::-webkit-scrollbar-thumb\s*\{\s*border:\s*var\(--sf-scroll--gap-edge\) solid var\(--sf-transparent\);\s*border-left-width:\s*var\(--sf-scroll--gap-content\);/);
  assert.match(core, /html::-webkit-scrollbar-thumb:active\s*\{\s*background-color:\s*var\(--sf-scroll--thumb-held\);/);
});

test('C210 (1): the drawn bar is one core script over every area; touch and forced colours keep the system bar', async () => {
  assert.match(read('src/core/js/index.js'), /import '\.\/scrollbars\.js';/);
  assert.match(engine, /export const HIDE_AFTER = 1000;/);
  assert.match(engine, /\(pointer: coarse\)/);
  assert.match(engine, /\(forced-colors: active\)/);
  assert.match(engine, /addEventListener\('scroll'[\s\S]*capture: true, passive: true/);
  assert.match(engine, /IntersectionObserver/);
  assert.match(engine, /requestAnimationFrame\(flush\)/);
  assert.match(engine, /area\.after\(y, x\)/);
  assert.match(engine, /aria-hidden/);
  assert.match(core, /@media \(forced-colors: active\)\s*\{\s*\.sf-scrollbar__track\s*\{\s*display:\s*none;/);
  const {thumbFor, trackEnds, pageStep} = await import('../src/core/js/scrollbars.js');
  // The thumb: the visible share of the run, never under the minimum (24), and its offset.
  assert.deepEqual(thumbFor({track: 100, client: 100, scroll: 400, position: 0, min: 24}), {length: 25, offset: 0, at: 0});
  assert.deepEqual(thumbFor({track: 100, client: 100, scroll: 1000, position: 900, min: 24}), {length: 24, offset: 76, at: 1});
  assert.equal(thumbFor({track: 100, client: 100, scroll: 300, position: 100, min: 24}).offset.toFixed(2), '33.33');
  assert.equal(thumbFor({track: 20, client: 100, scroll: 1000, position: 0, min: 24}).length, 20, 'never longer than the run');
  // The ends keep off the corners, a quarter of the run at most.
  assert.deepEqual(trackEnds({run: 200, start: 8, end: 12}), {start: 8, end: 12});
  assert.deepEqual(trackEnds({run: 20, start: 8, end: 8}), {start: 5, end: 5});
  assert.equal(pageStep(300, 40), 260);
  assert.equal(pageStep(30, 40), 40);
});

test('C210 (2): one colour rule -- the place boundary at rest and under the pointer, its secondary text held', () => {
  assert.match(core, /--sf-scroll-bg-thumb:\s*var\(--sf-outline\)/);
  assert.match(core, /--sf-scroll--thumb-held:\s*var\(--sf-on-surface-variant\)/);
  assert.doesNotMatch(core, /--sf-scroll--thumb-hover/);
  assert.match(core, /\.sf-scrollbar__track\[data-sf-scrollbar-held\] > \.sf-scrollbar__thumb::before\s*\{\s*background-color:\s*var\(--sf-scroll--held-colour\);/);
  // Hover changes the thin bar's size only, never the colour.
  const hover = core.match(/\.sf-scrollbar__track:hover,\s*\.sf-scrollbar__track\[data-sf-scrollbar-held\]\s*\{([^}]*)\}/)[1];
  assert.match(hover, /--sf-scroll--shown:\s*var\(--sf-scroll--size\)/);
  assert.doesNotMatch(hover, /colou?r/);
  // The engine reads the colours off the area, so the place's roles reach the bar.
  assert.match(engine, /prop\('--sf-scroll-bg-thumb'\)/);
  assert.match(engine, /prop\('--sf-scroll--thumb-held'\)/);
  assert.doesNotMatch(core + engine, /var\(--sf-on-surface\)/);
});

test('C210 (3): appear 0.12 s, hide 0.3 s (the system normal), growth and colour 0.15 s, none under reduced motion', () => {
  assert.match(core, /--sf-scroll--appear:\s*0\.12s/);
  assert.match(core, /--sf-scroll--hide:\s*var\(--sf-duration-normal\)/);
  assert.match(core, /--sf-scroll--grow:\s*0\.15s/);
  assert.match(core, /transition:\s*opacity var\(--sf-scroll--hide\)/);
  assert.match(core, /\[data-sf-scrollbar-on\]\s*\{[^}]*transition-duration:\s*var\(--sf-scroll--appear\)/);
  assert.match(core, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sf-scrollbar__track,\s*\.sf-scrollbar__thumb::before\s*\{\s*transition:\s*none;/);
});

test('C210 (4): the five modifiers and the same words in sf-scrollbar data-mode', async () => {
  assert.match(core, /\.scrollbar-thin\s*\{\s*--sf-scroll--rest:\s*var\(--sf-a2\);/);
  assert.match(core, /\.scrollbar-flush\s*\{\s*--sf-scroll--gap-edge:\s*var\(--sf-a0\);\s*--sf-scroll-bg-width:\s*calc\(var\(--sf-scroll--gap-content\) \+ var\(--sf-scroll-thumb-size\)\);/);
  assert.match(core, /\.scrollbar-square\s*\{\s*--sf-scroll-radius:\s*var\(--sf-a0\);/);
  assert.match(core, /\.scrollbar-hidden\s*\{\s*scrollbar-width:\s*none;/);
  assert.match(engine, /const ALWAYS = 'scrollbar-always';/);
  assert.match(engine, /const HIDDEN = 'scrollbar-hidden';/);
  assert.match(runtime, /export const MODES = Object\.freeze\(\['always', 'thin', 'flush', 'square', 'hidden'\]\);/);
  assert.match(runtime, /`scrollbar-\$\{mode\}`/);
});

test('C210 (5): the old modes, utilities and the legacy class retire with a dated alias', async () => {
  const {default: table} = await import('../src/core/js/retired-classes.table.js');
  const sheets = table.records.find((item) => item.journal === 'utility-c210-scrollbar-retired-sheets');
  assert.deepEqual(Object.keys(sheets.sheets), ['scroll-hover', 'scroll-subtle', 'scroll-backdrop-color', 'scroll-backdrop-radius', 'scroll-slider-radius']);
  assert.equal(sheets.remove_after, '2027-01-01');
  const legacy = table.records.find((item) => item.journal === 'class-c210-scrollbar-class');
  assert.deepEqual(legacy.names, {scrollbar: null});
  const journal = JSON.parse(read('contracts/changes/journal.json'));
  const modes = journal.records.find(({id}) => id === 'component-c210-scrollbar-modes');
  assert.equal(modes.remove_after, '2027-01-01');
  assert.match(runtime, /RETIRED_MODES = Object\.freeze\(\{overlay: '', standard: '', persistent: 'always'\}\)/);
  assert.match(runtime, /noteDeprecated\(/);
  // The panels give the one bar their values instead of drawing their own.
  const panel = read('src/component/context-menu/scss/_panel.scss');
  assert.doesNotMatch(panel, /::-webkit-scrollbar/);
  assert.match(panel, /--sf-scroll-bg-width:\s*var\(#\{\$track\}\);/);
  assert.match(panel, /--sf-scroll--thumb-min:\s*#\{\$thumb-min\};/);
  // The wizard column is the default bar; the feed keeps one room, not two.
  assert.doesNotMatch(read('src/smart/wizard/js/templates/default.js'), /data-mode="standard"/);
  assert.doesNotMatch(read('src/smart/list-feed/js/templates/default.css'), /both-edges/);
  // The component draws no bar of its own any more.
  assert.doesNotMatch(bar, /::-webkit-scrollbar-thumb|sf-scrollbar__thumb/);
});

test('C210: sf-scrollbar maps the words and notes the retired ones', async () => {
  globalThis.SF = globalThis.SF || {};
  const {modesOf} = await import('../src/component/scrollbar/js/_scrollbar.js');
  const {listDeprecations, clearDeprecations} = await import('../src/core/js/deprecations.js');
  const el = (attrs) => ({getAttribute: (name) => (name in attrs ? attrs[name] : null)});
  clearDeprecations();
  assert.deepEqual([...modesOf(el({'data-mode': 'thin flush'}))], ['thin', 'flush']);
  assert.deepEqual([...modesOf(el({'data-mode': 'persistent'}))], ['always']);
  assert.deepEqual([...modesOf(el({'data-mode': 'overlay'}))], []);
  assert.deepEqual([...modesOf(el({'data-sf-scrollbar': 'hidden'}))], ['hidden']);
  assert.deepEqual([...modesOf(el({}))], []);
  const notes = listDeprecations().map(({from, to}) => `${from}>${to}`);
  assert.deepEqual(notes, ['persistent>always', 'overlay>null', 'data-sf-scrollbar>data-mode']);
  clearDeprecations();
});

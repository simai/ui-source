// Owner decision C208 (2026-11-15; research control/research/2026-11-15-scrollbar.md
// and prototypes/scrollbar-study.html in simai/ui-control): one scrollbar for the
// whole Framework. (1) one hover rule: rest the place's boundary, hover and drag
// the place's text, no width change; (2) no palette of its own, Firefox the same
// colour through scrollbar-color; (3) track 14, thumb 6 at every density, the
// overlay bar 2 -> 6, the width and colour utilities retire; (4) the bar takes its
// room except in strips and media; (5) a strip's track runs inside the content's
// inset, --sf-space-1/4 under the items, round ends. Defects SB-2, SB-3, SB-5,
// SB-7, SB-8 of the study. C210 (2026-11-15) replaces (1), (3), (4), (5) and the
// gaps; what stands of C208 is below, C210 in tests/scrollbar-c210.contract.test.mjs.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {unfoldModes} from './support/paint-blocks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

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

test('SB-7: no sheet sets scrollbar-color or a thin/auto scrollbar-width outside the Firefox query or forced colours', () => {
  const offenders = [];
  for (const file of scss(resolve(root, 'src'))) {
    const text = without(without(readFileSync(file, 'utf8'), /@supports not selector\(::-webkit-scrollbar\)/), /@media\s*\(forced-colors:\s*active\)/);
    const stripped = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/scrollbar-color:\s*(?!auto)|scrollbar-width:\s*(?:thin|auto)/.test(stripped)) offenders.push(relative(root, file));
  }
  assert.deepEqual(offenders, []);
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
  // C210 (5) retires the track colour too (utility-c210-scrollbar-retired-sheets).
  assert.equal(noteRetiredUtilitySheets('scroll-bg-primary', ['scroll-backdrop-color/default']), true);
  assert.deepEqual(listDeprecations().map(({from, remove_after: date}) => `${from} ${date}`), ['scroll-primary 2027-01-01', 'scroll-2 2027-01-01', 'scroll-bg-3 2027-01-01', 'scroll-bg-primary 2027-01-01']);
  clearDeprecations();
});

test('the inverse place gives its text the other theme ink', () => {
  const bg = read('src/utility/background-color/default/scss/_sf_css__background_color.scss');
  const base = bg.slice(bg.indexOf('@layer sf.base'));
  assert.match(base, /\.bg-surface-inverse,\s*\.bg-surface-inverse-fixed\s*\{\s*color:\s*var\(--sf-on-surface\);\s*\}/);
});

// Defects block d11 (2026-11-17, after group build 10):
// (1) pagination: smart-pass-sp1's place rules and nv1's RG-NV 9 rule stood
//     side by side; one set is left, RG-NV 9 winning: a page number is square
//     at least and as wide as its number, it never spills. The place shrinks
//     in a narrow row (SM-PN-1) down to its own number, and its digits are
//     the row's (a place that set two drew «10240» in 48 and it spilled).
// (2) the empty @layer sf.components { } blocks the C273 paint move left in
//     the sheets (verification, menu element) and the comment-only custom
//     and variable stubs are gone, in the source and in the built sheets.
// (6) sf-empty-state size 1/2: the title stands on the text ladder's line for
//     its size (16/24 desktop, 14/20 phone; Pro chat+mail pass msg-bdf82830),
//     the size stays heading-6's (C21), neither moves with density (C44).
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const ruleOf = (sheet, selector) => {
  const at = sheet.indexOf(`${selector} {`);
  assert.ok(at >= 0, `the rule ${selector}`);
  return sheet.slice(at, sheet.indexOf('}', at));
};

test('(1) RG-NV 9: one width rule for a page number, the place hands it the control height and the row\'s digits', () => {
  const pageNumber = read('src/component/pagination/scss/_css__page_number.scss');
  const base = ruleOf(pageNumber, '.sf-page-number');
  assert.match(base, /inline-size: auto;\s*min-inline-size: max\(\s*var\(--sf-page-number--width, var\(--sf-ui-1--control-height\)\),\s*calc\(var\(--sf-pagination--digits, 1\) \* 1ch \+ 2 \* var\(--sf-page-number--space-x, var\(--sf-ui-1--space-x\)\)\)\s*\);/u);
  const sheet = read('src/component/pagination/scss/_css__pagination.scss');
  const item = ruleOf(sheet, '.sf-pagination .sf-pagination-item > .sf-page-number');
  assert.doesNotMatch(item, /min-inline-size/u, 'no second floor beside RG-NV 9\'s');
  assert.doesNotMatch(item, /--sf-page-number--padding-(left|right)/u, 'no variable the page number does not read');
  assert.match(item, /--sf-page-number--width: var\(--sf-pagination--control-height\);/u);
  const place = ruleOf(sheet, '.sf-pagination .sf-pagination-item.sf-pagination-slot,\n.sf-pagination .sf-pagination-item:has(> .sf-page-number)');
  assert.match(place, /min-inline-size: min-content;/u);
  // No rule of the sheet sets the digits: they are the row's (the Smart
  // template writes them on its list).
  assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//gu, ''), /--sf-pagination--digits:/u);
  assert.match(read('src/smart/pagination/js/templates/default.js'), /style=\$\{`--sf-pagination--digits: \$\{context\.slotDigits\}`\}/u);
  // The Smart page button is square at least, as the plain twin.
  assert.match(ruleOf(sheet, '.sf-pagination .sf-pagination-slot > .sf-pagination-page'), /min-inline-size: var\(--sf-pagination--control-height\);/u);
  // The Smart places (the row writes its digits) keep one floor: the widest number.
  assert.match(sheet, /\n\.sf-pagination \.sf-pagination-item\.sf-pagination-slot \{\s*min-inline-size: max\(var\(--sf-pagination--control-height\), calc\(var\(--sf-pagination--digits, 2\) \* 1ch \+ 2 \* var\(--sf-pagination--place-x\)\)\);/u);
});

const LAYER = /@layer\s+(sf\.[\w-]+)\s*\{/gu;
const strip = (body) => body.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '').trim();
function emptyBlocks(text) {
  const found = [];
  for (const m of text.matchAll(LAYER)) {
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    if (/^\s*(\/\/|\*|\/\*)/u.test(text.slice(lineStart, m.index))) continue;
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth) {
      if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue; }
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      i += 1;
    }
    if (!strip(text.slice(m.index + m[0].length, i - 1))) found.push(`${m[1]} at line ${text.slice(0, m.index).split('\n').length}`);
  }
  return found;
}
const sheetsUnder = (dir, test) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sheetsUnder(path, test));
    else if (test(name)) out.push(path);
  }
  return out;
};

test('(2) no empty sf.components or sf.paint block in a component sheet of src/', () => {
  const found = [];
  for (const path of sheetsUnder(join(root, 'src'), (name) => /\.s?css$/u.test(name))) {
    for (const block of emptyBlocks(readFileSync(path, 'utf8'))) if (/^sf\.(components|paint) /u.test(block)) found.push(`${path.slice(root.length + 1)}: ${block}`);
  }
  assert.deepEqual(found, []);
});

test('(2) the scanner sees an empty block, with or without a comment (self-check)', () => {
  assert.deepEqual(emptyBlocks('@layer sf.components {\n}\n@layer sf.components {\n// a note\n}\n@layer sf.paint { .x { color: red; } }\n// @layer sf.components { }\n'), ['sf.components at line 1', 'sf.components at line 3']);
});

const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
test('(2) no built component or Smart sheet carries an empty sf.components or sf.paint block', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const found = [];
  let files = 0;
  for (const kind of ['component', 'smart']) {
    const base = join(distribution, kind);
    if (!existsSync(base)) continue;
    for (const path of sheetsUnder(base, (name) => name.endsWith('.css'))) {
      files += 1;
      for (const block of emptyBlocks(readFileSync(path, 'utf8'))) if (/^sf\.(components|paint) /u.test(block)) found.push(`${path.slice(distribution.length + 1)}: ${block}`);
    }
  }
  assert.ok(files > 50, `built sheets: ${files}`);
  assert.deepEqual(found, []);
});

test('(6) sf-empty-state size 1/2: heading-6 size on the card title\'s line, 16/24 and 14/20, density-independent', () => {
  const sheet = read('src/smart/empty-state/scss/_smart__empty_state.scss');
  const half = ruleOf(sheet, '.sf-empty-state--size-1-2 .sf-empty-state-title');
  assert.match(half, /--sf-placeholder--title-size: var\(--sf-heading-6--size\);/u);
  assert.match(half, /--sf-placeholder--title-height: var\(--sf-title--height-card\);/u);
  // The line is the text ladder's for the size: 20 beside 14 on a phone, 24
  // beside 16 on a desktop (c0, c2), and no density block writes it.
  const titles = read('src/core/figma_variables/figma_text_title_height.scss');
  assert.equal((titles.match(/--sf-title--height-card: var\(--sf-(c0|c2)\);/gu) || []).join(' '), '--sf-title--height-card: var(--sf-c0); --sf-title--height-card: var(--sf-c2);');
  const text = read('src/core/figma_variables/figma_text_body_text_height.scss');
  assert.match(text, /--sf-text--height-1: var\(--sf-c0\);[\s\S]*@media[\s\S]*--sf-text--height-1: var\(--sf-c2\);/u);
  assert.doesNotMatch(read('src/core/scss/_sf_css__density.scss'), /--sf-title--height-card/u);
  // Sizes 1 and 2 keep their rungs.
  assert.match(ruleOf(sheet, '.sf-empty-state .sf-empty-state-title'), /--sf-placeholder--title-height: var\(--sf-heading-4--height\);/u);
  assert.match(ruleOf(sheet, '.sf-empty-state--size-2 .sf-empty-state-title'), /--sf-placeholder--title-height: var\(--sf-heading-3--height\);/u);
  assert.equal(JSON.parse(read('src/smart/empty-state/component.json')).version, '1.6.7'); // group build 13: 1.6.5 moved on by the merged branches or the C278 language patch // group build 14: 1.6.6 moved on by the merged branches or the C278 language patch
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {errorFit, NAME_KEEPS_CHARS, NARROW_BELOW_REM} from '../src/smart/file-download/js/error-fit.js';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* sf-file-download 1.5.1, a failed row (owner decision C88, dispatcher rules F1
   and F2 of 2026-11-12). The numbers are the ones measured on the group build
   at 1440 (control/evidence/2026-11-12-file-download-intent): a 360 px column
   gives the text column 300 at size 1, 292 at size 2 and 284 at size 3, the
   button with its words is 185.3 and 226.4 wide, and 16ch of the name is
   206.5 (20 px) and 247.8 (24 px). */
const size = {
  1: {gap: 12, retryWidth: 148.3, reach: 12, padEnd: 11, chars: 165.2, lead: 48, trail: 12},
  2: {gap: 16, retryWidth: 185.3, reach: 16, padEnd: 15, chars: 206.5, lead: 52, trail: 16},
  3: {gap: 16, retryWidth: 226.4, reach: 20, padEnd: 15, chars: 247.8, lead: 60, trail: 16},
};
const fit = (s, width) => {
  const {lead, trail, ...rest} = size[s];
  return errorFit({width, rem: 16, textColumn: width - lead - trail, ...rest});
};

test('F2: «Повторить» stays beside the name only while the name keeps 16 characters', () => {
  assert.equal(NAME_KEEPS_CHARS, 16);
  // At 360 px sizes 2 and 3 left the name 90.7 and 41.6 px beside the button
  // (the RETURN's point c): now the button goes under the text.
  assert.equal(fit(2, 360).narrow, true);
  assert.equal(fit(3, 360).narrow, true);
  // The boundary is the name's column against 16ch, nothing else.
  for (const s of [1, 2, 3]) {
    const {lead, trail, gap, retryWidth, chars} = size[s];
    const edge = Math.max(NARROW_BELOW_REM * 16, Math.ceil(lead + trail + gap + retryWidth + chars));
    assert.equal(fit(s, edge).narrow, false, `size ${s}: ${edge} px keeps 16ch beside the button`);
    if (edge > NARROW_BELOW_REM * 16) assert.equal(fit(s, edge - 2).narrow, true, `size ${s}: ${edge - 2} px does not`);
  }
  // Wide columns keep it beside at every size.
  for (const s of [1, 2, 3]) assert.equal(fit(s, 720).narrow, false);
});

test('C88 keeps its 360 px bound: below it the button is always under the text', () => {
  const wide = {gap: 8, retryWidth: 80, reach: 8, padEnd: 7, chars: 100};
  assert.equal(errorFit({width: 359, rem: 16, textColumn: 320, ...wide}).narrow, true);
  assert.equal(errorFit({width: 360, rem: 16, textColumn: 320, ...wide}).narrow, false);
});

test('F1: the icon alone only when the worded button does not fit under the text', () => {
  // Size 3 in a 280 column: text column 204, button 226.4, padding 20, row
  // padding 15 -- the RETURN's point b (prototype B keeps the words).
  assert.deepEqual(fit(3, 280), {narrow: true, retryIcon: false});
  // Size 2 and 3 in a 200 column: the icon in the build and in B.
  assert.equal(fit(2, 200).retryIcon, true);
  assert.equal(fit(3, 200).retryIcon, true);
  // The room is the text column plus the button's padding before it and the
  // same after it (prototype B: t.width + 2 * pad) ...
  const base = {width: 300, rem: 16, gap: 16, reach: 16, padEnd: 16, chars: 200};
  assert.equal(errorFit({...base, textColumn: 200, retryWidth: 232}).retryIcon, false);
  assert.equal(errorFit({...base, textColumn: 200, retryWidth: 233}).retryIcon, true);
  // ... but never past the row's own padding: on the phone ladder (size 3 at
  // 390: button padding 18, row padding 11) the plate stopped 0.8 px past the box.
  assert.equal(errorFit({width: 200, rem: 16, textColumn: 144, gap: 16, retryWidth: 174.8, reach: 18, padEnd: 11, chars: 185.8}).retryIcon, true);
  // Never the icon while the button stands beside the name.
  assert.equal(fit(1, 720).retryIcon, false);
});

test('F2: a failed row\'s name breaks only between words, and the element asks the pure rule', async () => {
  const css = await read('component/download-file/scss/_css_download-file.scss');
  const block = css.match(/\.sf-download-file\.sf-download-file--error :where\(\.sf-download-file__name\) \{([^}]*)\}/u)?.[1] ?? '';
  assert.match(block, /overflow-wrap: normal;/u);
  assert.match(block, /word-break: normal;/u);
  assert.match(block, /text-overflow: ellipsis;/u);
  assert.match(block, /-webkit-line-clamp: 2;/u);
  const element = await read('smart/file-download/index.js');
  assert.match(element, /import \{ errorFit, NAME_KEEPS_CHARS \} from '\.\/js\/error-fit\.js';/u);
  assert.match(element, /chars: charsWidth\(name, NAME_KEEPS_CHARS\)/u);
  assert.doesNotMatch(element, /NARROW_BELOW_REM/u);
});

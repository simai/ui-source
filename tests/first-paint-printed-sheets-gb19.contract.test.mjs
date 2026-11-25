import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {DRAWN, PRINTED_SETTLE_MS, placed, printedBody, printedSheets, stripHeader} from '../scripts/first-paint-lib.mjs';

// GB19 (msg-c0a09a5a1e0b4e23a254, Admin 1.2.1): the snapshot script took an
// example's sheet list from the full render only, so a derived skeleton that
// prints parts the full render does not draw (sf-skeleton rows under
// sf-admin-menu's object menu) got a list the strict gate's 24d then
// rejected. The script and the gate now print the snapshot on the same page
// (printedBody) and read its sheets at the same drawn moment (DRAWN,
// PRINTED_SETTLE_MS). Without a browser.
const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

test('1. the snapshot script reads a printed skeleton\'s sheets and lists them with the example\'s', () => {
  const script = read('scripts/snapshot-first-paint.mjs');
  assert.match(script, /printedSheets\(\{browser, site, pages, path: `\/printed\/\$\{component\.folder\}\/\$\{example\.name\}`, component, example, html: got\.skeleton/u);
  assert.match(script, /\[\.\.\.new Set\(\[\.\.\.got\.sheets, \.\.\.printed\.sheets\]\)\]/u, 'the example\'s list is the full render\'s and the printed skeleton\'s');
  // An assembly printing a part's skeleton: the composed page, printed.
  assert.match(script, /if \(got\.skeletons\.length\) \{\s+const printed = await printedSheets\(/u);
  assert.match(script, /html: got\.html, assembly: true, timezoneId: SNAPSHOT_TIME_ZONE\}\)/u);
});

test('2. the gate prints the snapshot through the same body and the same drawn test', () => {
  const gate = read('tests/browser/first-paint-gate.browser.mjs');
  assert.match(gate, /import \{[^}]*DRAWN, PRINTED_SETTLE_MS, stripHeader, printedBody\} from '\.\.\/\.\.\/scripts\/first-paint-lib\.mjs'/u);
  assert.match(gate, /const drawn = \(el\) => \(\$\{DRAWN\}\)\(el, window\.__fpOverlay\);/u);
  assert.match(gate, /\$\{printedBody\(\{component, example, html, assembly, bare, written\}\)\}/u);
  assert.match(gate, /await page\.waitForTimeout\(PRINTED_SETTLE_MS\);\n {4}\/\/ 24d, the printed parts/u);
  assert.doesNotMatch(gate, /function placed\(/u, 'one placed(), in the lib');
  assert.equal(PRINTED_SETTLE_MS, 400);
  assert.equal(typeof printedSheets, 'function');
});

test('3. DRAWN: defined and drawn, awaiting its data, or a started closed overlay', () => {
  // eslint-disable-next-line no-eval
  const drawn = (0, eval)(DRAWN);
  const el = (defined, extra = {}) => ({matches: () => defined, hasAttribute: (name) => Boolean(extra.attrs?.includes(name)), ...extra.props});
  assert.equal(drawn(el(false), false), false, 'not defined');
  assert.equal(drawn(el(true, {props: {isRendered: false}}), false), false, 'defined, not drawn');
  assert.equal(drawn(el(true, {props: {isRendered: true}}), false), true);
  assert.equal(drawn(el(true, {props: {isRendered: false, sfAwaitingData: () => true}}), false), true, 'keeps its printed skeleton for its data');
  assert.equal(drawn(el(true, {props: {isRendered: false}, attrs: ['data-sf-started']}), true), true, 'a closed overlay that started');
  assert.equal(drawn(el(true), false), true, 'a plain element without isRendered');
});

test('4. placed() and printedBody(): the printed host in the example\'s surroundings', () => {
  assert.equal(stripHeader('<!-- header -->\n<sf-x a="1"></sf-x>\n'), '<sf-x a="1"></sf-x>');
  assert.equal(placed({}, 'sf-x', '<sf-x></sf-x>'), '<sf-x></sf-x>');
  assert.equal(placed({markup: '<p>a</p>'}, 'sf-x', '<sf-x></sf-x>'), '<p>a</p><sf-x></sf-x>');
  assert.equal(placed({parent: '<div class="p"></div>'}, 'sf-x', '<sf-x></sf-x>'), '<div class="p"><sf-x></sf-x></div>');
  assert.equal(placed({markup: '<b><sf-x></sf-x></b><i><sf-x></sf-x></i>'}, 'sf-x', '<sf-x n="1"></sf-x>\n<sf-x n="2"></sf-x>'),
    '<b><sf-x n="1"></sf-x></b><i><sf-x n="2"></sf-x></i>');
  const body = printedBody({component: {tag: 'sf-x'}, example: {}, html: '<sf-x></sf-x>'});
  assert.match(body, /^<main id="stage"><sf-x><\/sf-x><\/main>/u);
  assert.match(body, /<p id="after">/u);
  assert.match(printedBody({component: {tag: 'sf-x'}, example: {}, html: '<sf-x></sf-x>', bare: true, written: '<script>w</script>'}), /^<main id="stage"><\/main><script>w<\/script>/u);
});

// container-breakout (utility.container 1.2.0, the one block editor,
// 2026-11-03): a block inside a centred container that spans the page's width
// -- a cover picture, a map, a strip of logos. It reaches out with logical
// margins (the same in a right-to-left page), from the page's width measured
// as the root's content box, so a classic scrollbar never makes the page
// scroll sideways. The geometry is measured in a browser by
// tests/browser/container-breakout.browser.mjs; this test holds the sheet.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const sheet = read('src/utility/container/default/scss/_sf_css__container.scss');
const block = (selector) => {
  const at = sheet.indexOf(`${selector} {`);
  assert.notEqual(at, -1, selector);
  return sheet.slice(at, sheet.indexOf('}', at) + 1);
};

test('the breakout reaches out with logical margins only, from the page width', () => {
  const rule = block('.container-breakout');
  assert.match(rule, /margin-inline-start:\s*calc\(50% - var\(--sf-container-breakout-page, var\(--sf-container-breakout--page, 100vw\)\) \/ 2\);/u);
  assert.match(rule, /margin-inline-end:\s*calc\(50% - var\(--sf-container-breakout-page, var\(--sf-container-breakout--page, 100vw\)\) \/ 2\);/u);
  assert.match(rule, /max-width:\s*none;/u);
  assert.doesNotMatch(rule, /margin-(?:left|right)|(?:^|\s)left:|(?:^|\s)right:|width:\s*100vw/u, 'no physical side and no 100vw width: a scrollbar would make the page scroll sideways');
});

test('the page width is the root\'s content box, measured once and inherited as a length', () => {
  assert.match(sheet, /@property --sf-container-breakout--page \{\s*syntax: "<length>";\s*inherits: true;\s*initial-value: 100vw;\s*\}/u);
  assert.match(block('html:has(.container-breakout)'), /container-type:\s*inline-size;/u);
  assert.match(block('html:has(.container-breakout) body'), /--sf-container-breakout--page:\s*100cqi;/u);
  assert.doesNotMatch(sheet, /contain:\s*(?:layout|strict|content)|overflow-x:\s*(?:hidden|clip)/u, 'no layout containment and no clipping of the page');
});

test('the Loader rule takes container-breakout; the unit moved to 1.2.0', () => {
  const SF = {RuleLoader: {}};
  vm.runInNewContext(read('src/utility/container/default/rule.js'), {SF});
  const rule = SF.RuleLoader['container/default'];
  for (const name of ['container', 'container-flush', 'container-breakout']) assert.ok(rule.test(name), name);
  for (const name of ['container-breakouts', 'md:container-breakout', 'breakout']) assert.ok(!rule.test(name), name);
  assert.equal(JSON.parse(read('src/utility/container/passport.json')).version, '1.2.0');
});
